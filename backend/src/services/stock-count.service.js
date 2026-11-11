const mongoose = require("mongoose");
const crypto = require("crypto");
const xlsx = require("xlsx");
const StockCount = require("../models/StockCount");
const Warehouse = require("../models/Warehouse");
const ProductVariant = require("../models/ProductVariant");
const Product = require("../models/Product");
const Inventory = require("../models/Inventory");
const inventoryRepository = require("../repositories/inventory.repository");
const inventoryTransactionService = require("./inventory-transaction.service");
const { syncVariantStockMirror } = require("./inventory.service");
const { resolveApprovedVendor } = require("../middlewares/vendor.middleware");
const withTransaction = require("../utils/withTransaction");
const AppError = require("../errors/AppError");

const generateCountNumber = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `CNT-${dateStr}-${rand}`;
};

const sanitizeCellValue = (val) => {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
};

const calculateCountMetrics = (items) => {
  let totalExpected = 0;
  let totalCounted = 0;
  let totalVariance = 0;
  let exactMatchCount = 0;
  let countedItemCount = 0;
  let totalAbsVariance = 0;

  for (const item of items) {
    totalExpected += item.snapshotOnHand || 0;
    if (item.countedOnHand !== null && item.countedOnHand !== undefined) {
      countedItemCount++;
      totalCounted += item.countedOnHand;
      const variance = item.countedOnHand - item.snapshotOnHand;
      totalVariance += variance;
      totalAbsVariance += Math.abs(variance);
      if (variance === 0) {
        exactMatchCount++;
      }
    }
  }

  const skuAccuracyRate = countedItemCount > 0
    ? Math.round((exactMatchCount / countedItemCount) * 10000) / 100
    : 100;

  const quantityAccuracyRate = totalExpected > 0
    ? Math.max(0, Math.round((1 - totalAbsVariance / totalExpected) * 10000) / 100)
    : 100;

  return {
    totalExpectedQty: totalExpected,
    totalCountedQty: totalCounted,
    totalVarianceQty: totalVariance,
    skuAccuracyRate,
    quantityAccuracyRate,
  };
};

/**
 * ============================================================
 * INTERNAL & BACKWARD-COMPATIBLE STAFF STOCK COUNT METHODS
 * ============================================================
 */

/**
 * Create a new stock count / cycle count record with an inventory snapshot.
 */
const createStockCount = async (warehouseIdOrData, maybeOptions = {}, actor) => {
  let warehouseId;
  let options = maybeOptions;
  let actorUser = actor;
  if (typeof warehouseIdOrData === "object" && warehouseIdOrData !== null && !mongoose.isValidObjectId(warehouseIdOrData)) {
    warehouseId = warehouseIdOrData.warehouseId;
    options = warehouseIdOrData;
    actorUser = actor || { _id: warehouseIdOrData.countedByUserId || warehouseIdOrData.actorUserId };
  } else {
    warehouseId = warehouseIdOrData;
  }

  const { variantIds = [], scope = "full", notes } = options;

  if (!mongoose.isValidObjectId(warehouseId)) {
    throw new AppError("Invalid warehouse ID", 400, "INVALID_WAREHOUSE_ID");
  }

  const warehouse = await Warehouse.findById(warehouseId);
  if (!warehouse || !warehouse.isActive || warehouse.deletedAt) {
    throw new AppError("Warehouse not found or inactive", 404, "WAREHOUSE_NOT_FOUND");
  }

  // Find inventory records to snapshot
  const invQuery = { warehouseId };
  if (Array.isArray(variantIds) && variantIds.length > 0) {
    invQuery.productVariantId = { $in: variantIds.map((id) => new mongoose.Types.ObjectId(id)) };
  }

  const inventories = await Inventory.find(invQuery).populate("productVariantId");
  if (inventories.length === 0) {
    throw new AppError("No inventory found to count in this warehouse", 400, "NO_INVENTORY_TO_COUNT");
  }

  const items = [];
  for (const inv of inventories) {
    const variant = inv.productVariantId;
    if (!variant || variant.deletedAt) continue;

    items.push({
      productId: variant.productId,
      productVariantId: variant._id,
      sku: variant.sku,
      productName: variant.name || variant.title || "Product Variant",
      snapshotOnHand: inv.onHand || 0,
      countedOnHand: null,
      discrepancy: 0,
      shortageQuantity: 0,
      excessQuantity: 0,
      variancePercentage: 0,
      countedCondition: "sellable",
      reason: null,
      adjustmentApplied: false,
    });
  }

  const countNumber = generateCountNumber();
  const count = await StockCount.create({
    countNumber,
    warehouseId,
    scope: scope || "full",
    status: "draft",
    items,
    notes: notes || null,
    snapshotAt: new Date(),
    startedBy: actorUser?._id || actorUser?.id || null,
    startedAt: new Date(),
  });

  return count;
};

/**
 * Record physically counted quantities and calculate discrepancies.
 */
const recordPhysicalCounts = async (idOrObj, maybeCounts = [], actor) => {
  let id;
  let counts = maybeCounts;
  if (typeof idOrObj === "object" && idOrObj !== null && !mongoose.isValidObjectId(idOrObj)) {
    id = idOrObj.countId || idOrObj.id;
    counts = idOrObj.items || idOrObj.counts || maybeCounts;
  } else {
    id = idOrObj;
    if (typeof maybeCounts === "object" && !Array.isArray(maybeCounts)) {
      counts = maybeCounts.items || maybeCounts.counts || [];
    }
  }

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid count ID", 400, "INVALID_ID");
  }

  const count = await StockCount.findById(id);
  if (!count) {
    throw new AppError("Stock count record not found", 404, "COUNT_NOT_FOUND");
  }

  if (["completed", "finalized", "reconciled", "cancelled"].includes(count.status)) {
    throw new AppError(`Cannot update count in '${count.status}' status`, 400, "COUNT_FINALIZED");
  }

  for (const entry of counts) {
    const item = count.items.find(
      (it) => it._id.toString() === entry._id?.toString() ||
              it.productVariantId.toString() === entry.productVariantId?.toString()
    );

    if (item) {
      const counted = Number(entry.countedOnHand ?? entry.countedQuantity);
      if (Number.isInteger(counted) && counted >= 0) {
        item.countedOnHand = counted;
        item.discrepancy = counted - item.snapshotOnHand;
        item.shortageQuantity = item.discrepancy < 0 ? Math.abs(item.discrepancy) : 0;
        item.excessQuantity = item.discrepancy > 0 ? item.discrepancy : 0;
        item.variancePercentage = item.snapshotOnHand > 0
          ? Math.round(((counted - item.snapshotOnHand) / item.snapshotOnHand) * 10000) / 100
          : (counted > 0 ? 100 : 0);
        item.countingTimestamp = new Date();
        item.countedBy = actor?._id || actor?.id || null;
      }
      if (entry.countedCondition) {
        item.countedCondition = entry.countedCondition;
      }
      if (entry.inspectionNotes) {
        item.inspectionNotes = entry.inspectionNotes;
      }
      if (entry.reason !== undefined || entry.notes !== undefined) {
        item.reason = entry.reason || entry.notes;
      }
    }
  }

  const metrics = calculateCountMetrics(count.items);
  count.totalExpectedQty = metrics.totalExpectedQty;
  count.totalCountedQty = metrics.totalCountedQty;
  count.totalVarianceQty = metrics.totalVarianceQty;
  count.skuAccuracyRate = metrics.skuAccuracyRate;
  count.quantityAccuracyRate = metrics.quantityAccuracyRate;
  count.status = "review";
  await count.save();

  return count;
};

/**
 * Reconcile discrepancies and finalize cycle count using movement-aware reconciliation.
 */
const reconcileAndFinalizeCount = async (idOrObj, maybeActor) => {
  let id;
  let actor = maybeActor;
  if (typeof idOrObj === "object" && idOrObj !== null && !mongoose.isValidObjectId(idOrObj)) {
    id = idOrObj.countId || idOrObj.id;
    actor = maybeActor || { _id: idOrObj.actorUserId };
  } else {
    id = idOrObj;
  }

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid count ID", 400, "INVALID_ID");
  }

  const existing = await StockCount.findById(id);
  if (!existing) {
    throw new AppError("Stock count record not found", 404, "COUNT_NOT_FOUND");
  }

  // Idempotency: if already completed, return existing
  if (["completed", "finalized", "reconciled"].includes(existing.status)) {
    return existing;
  }

  if (existing.status === "cancelled") {
    throw new AppError("Cannot finalize a cancelled stock count", 400, "COUNT_CANCELLED");
  }

  return await withTransaction(async (session) => {
    const count = await StockCount.findById(id).session(session);
    if (!count || ["completed", "finalized", "reconciled"].includes(count.status)) {
      return count || existing;
    }

    const warehouseId = count.warehouseId;

    for (const item of count.items) {
      if (item.countedOnHand === null) {
        continue;
      }

      // Movement-Aware Reconciliation:
      // True count discrepancy = Counted - Snapshot
      const delta = item.countedOnHand - item.snapshotOnHand;
      if (delta === 0) {
        item.adjustmentApplied = true;
        continue;
      }

      const currentInv = await Inventory.findOne({
        warehouseId,
        productVariantId: item.productVariantId,
      }).session(session);

      if (!currentInv) {
        continue;
      }

      // Invariant check: LiveOnHand + delta >= reserved + nonSellable
      const nonSellable = (currentInv.damaged || 0) + (currentInv.defective || 0) + (currentInv.expired || 0);
      if (currentInv.onHand + delta < currentInv.reserved + nonSellable) {
        throw new AppError(
          `Count adjustment for SKU ${item.sku} would reduce on-hand (${currentInv.onHand + delta}) below reserved (${currentInv.reserved}) and non-sellable stock (${nonSellable})`,
          409,
          "ADJUSTMENT_VIOLATES_RESERVATION"
        );
      }

      const onHandBefore = currentInv.onHand;
      const onHandAfter = currentInv.onHand + delta;
      const reservedBefore = currentInv.reserved;

      currentInv.onHand = onHandAfter;
      currentInv.lastStockUpdateAt = new Date();
      await currentInv.save({ session });

      await inventoryTransactionService.createTransaction({
        productVariantId: item.productVariantId,
        warehouseId,
        vendorId: count.vendorId || null,
        type: "count_reconciliation",
        quantity: delta,
        onHandBefore,
        onHandAfter,
        reservedBefore,
        reservedAfter: reservedBefore,
        referenceType: "stock_count_reconciliation",
        referenceId: count.countNumber,
        actorUserId: actor?._id || actor?.id || null,
        notes: `Cycle count discrepancy reconciliation for SKU ${item.sku}. Counted: ${item.countedOnHand}, Snapshot: ${item.snapshotOnHand}. Reason: ${item.reason || "Physical count reconciliation"}`,
        session,
      });

      item.adjustmentApplied = true;
      item.appliedAdjustmentDelta = delta;
      item.discrepancy = delta;

      await syncVariantStockMirror(item.productVariantId, session);
    }

    count.status = "reconciled";
    count.completedAt = new Date();
    count.completedBy = actor?._id || actor?.id || null;
    count.reconciledAt = new Date();
    count.reconciledBy = actor?._id || actor?.id || null;
    await count.save({ session });

    return count;
  });
};

/**
 * Cancel a stock count.
 */
const cancelStockCount = async (id, reason = "Cancelled by user", actor) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid count ID", 400, "INVALID_ID");
  }

  const count = await StockCount.findById(id);
  if (!count) {
    throw new AppError("Stock count record not found", 404, "COUNT_NOT_FOUND");
  }

  if (["completed", "finalized", "reconciled"].includes(count.status)) {
    throw new AppError("Cannot cancel an already completed or reconciled stock count", 400, "COUNT_ALREADY_COMPLETED");
  }

  if (count.status === "cancelled") {
    return count;
  }

  count.status = "cancelled";
  count.cancelledAt = new Date();
  count.cancelledBy = actor?._id || actor?.id || null;
  count.cancellationReason = reason;
  await count.save();

  return count;
};

/**
 * Get count by ID.
 */
const getStockCount = async (id) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid count ID", 400, "INVALID_ID");
  }

  const count = await StockCount.findById(id)
    .populate("warehouseId", "name code city state")
    .populate("startedBy", "firstName lastName email")
    .populate("completedBy", "firstName lastName email")
    .populate("approvedBy", "firstName lastName email")
    .populate("reconciledBy", "firstName lastName email")
    .lean();

  if (!count) {
    throw new AppError("Stock count record not found", 404, "COUNT_NOT_FOUND");
  }

  return count;
};

/**
 * List stock counts with filters and pagination.
 */
const listStockCounts = async ({ warehouseId, status, page = 1, limit = 20 } = {}) => {
  const query = {};
  if (warehouseId && mongoose.isValidObjectId(warehouseId)) {
    query.warehouseId = warehouseId;
  }
  if (status && status !== "all") {
    query.status = status;
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [total, items] = await Promise.all([
    StockCount.countDocuments(query),
    StockCount.find(query)
      .populate("warehouseId", "name code city state")
      .populate("startedBy", "firstName lastName")
      .populate("completedBy", "firstName lastName")
      .populate("approvedBy", "firstName lastName")
      .populate("reconciledBy", "firstName lastName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
  ]);

  return {
    items,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
  };
};

/**
 * ============================================================
 * VENDOR-SPECIFIC PHYSICAL COUNT & RECONCILIATION METHODS
 * ============================================================
 */

/**
 * Create a vendor-partitioned stock-count session.
 */
const createVendorStockCount = async ({
  userId,
  warehouseId,
  countType = "physical",
  scope = "full",
  variantIds = [],
  categoryIds = [],
  materialityThresholdPercent = 5,
  notes = null,
}) => {
  const vendor = await resolveApprovedVendor(userId);

  if (!mongoose.isValidObjectId(warehouseId)) {
    throw new AppError("Invalid warehouse ID", 400, "INVALID_WAREHOUSE_ID");
  }

  const warehouse = await Warehouse.findById(warehouseId);
  if (!warehouse || !warehouse.isActive || warehouse.deletedAt) {
    throw new AppError("Warehouse not found or inactive", 404, "WAREHOUSE_NOT_FOUND");
  }

  // Find all products owned by this vendor
  const productQuery = { vendorId: vendor._id, deletedAt: null };
  if (Array.isArray(categoryIds) && categoryIds.length > 0) {
    const validCatIds = categoryIds.filter((id) => mongoose.isValidObjectId(id));
    if (validCatIds.length > 0) {
      productQuery.categoryId = { $in: validCatIds };
    }
  }

  const vendorProducts = await Product.find(productQuery).select("_id name title categoryId price").lean();
  if (vendorProducts.length === 0) {
    throw new AppError("No products found for counting under selected scope", 400, "NO_PRODUCTS_TO_COUNT");
  }

  const productMap = new Map(vendorProducts.map((p) => [p._id.toString(), p]));
  const vendorProductIds = vendorProducts.map((p) => p._id);

  // Find all variants for vendor products
  const variantQuery = { productId: { $in: vendorProductIds }, deletedAt: null };
  if (Array.isArray(variantIds) && variantIds.length > 0) {
    const validVarIds = variantIds.filter((id) => mongoose.isValidObjectId(id));
    if (validVarIds.length > 0) {
      variantQuery._id = { $in: validVarIds };
    }
  }

  const variants = await ProductVariant.find(variantQuery).select("_id productId sku name price").lean();
  if (variants.length === 0) {
    throw new AppError("No product variants found for counting under selected scope", 400, "NO_VARIANTS_TO_COUNT");
  }

  const variantIdsList = variants.map((v) => v._id);
  const variantMap = new Map(variants.map((v) => [v._id.toString(), v]));

  // Find inventory records for these variants in the selected warehouse
  const invQuery = {
    warehouseId,
    productVariantId: { $in: variantIdsList },
    deletedAt: null,
  };

  let inventories = await Inventory.find(invQuery).lean();

  // Apply scope filtering
  if (scope === "low_stock") {
    inventories = inventories.filter((inv) => {
      const nonSellable = (inv.damaged || 0) + (inv.defective || 0) + (inv.expired || 0);
      const available = Math.max(0, (inv.onHand || 0) - (inv.reserved || 0) - nonSellable);
      const threshold = inv.lowStockThreshold || 5;
      return available <= threshold;
    });
  } else if (scope === "high_value") {
    // Sort or filter by high product price
    inventories = inventories.filter((inv) => {
      const v = variantMap.get(inv.productVariantId.toString());
      const p = v ? productMap.get(v.productId.toString()) : null;
      const price = v?.price || p?.price || 0;
      return price >= 5000; // high value threshold
    });
  }

  if (inventories.length === 0) {
    throw new AppError("No inventory records found matching count criteria at this warehouse", 400, "NO_INVENTORY_MATCHING_SCOPE");
  }

  const items = [];
  let totalExpected = 0;

  for (const inv of inventories) {
    const variant = variantMap.get(inv.productVariantId.toString());
    if (!variant) continue;
    const product = productMap.get(variant.productId.toString());
    const onHand = inv.onHand || 0;
    totalExpected += onHand;

    items.push({
      productId: product?._id || variant.productId,
      productVariantId: variant._id,
      sku: variant.sku,
      productName: product?.name || product?.title || variant.name || "Product Variant",
      snapshotOnHand: onHand,
      countedOnHand: null,
      discrepancy: 0,
      shortageQuantity: 0,
      excessQuantity: 0,
      variancePercentage: 0,
      countedCondition: "sellable",
      unitCost: variant.price || product?.price || null,
      reason: null,
      adjustmentApplied: false,
    });
  }

  const countNumber = generateCountNumber();
  const count = await StockCount.create({
    countNumber,
    vendorId: vendor._id,
    warehouseId,
    countType: ["physical", "cycle"].includes(countType) ? countType : "physical",
    scope,
    categoryIds: Array.isArray(categoryIds) ? categoryIds.filter((id) => mongoose.isValidObjectId(id)) : [],
    status: "counting", // Active counting session
    items,
    materialityThresholdPercent: Math.min(100, Math.max(0, Number(materialityThresholdPercent) || 5)),
    totalExpectedQty: totalExpected,
    totalCountedQty: 0,
    totalVarianceQty: 0,
    skuAccuracyRate: 0,
    quantityAccuracyRate: 0,
    notes: notes?.trim() || null,
    snapshotAt: new Date(),
    startedBy: vendor.userId,
    startedAt: new Date(),
  });

  return count;
};

/**
 * Record physical counts and physical inspection conditions for vendor session.
 */
const recordVendorPhysicalCounts = async ({
  userId,
  id,
  items = [],
  notes = null,
}) => {
  const vendor = await resolveApprovedVendor(userId);

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid count ID", 400, "INVALID_ID");
  }

  const count = await StockCount.findOne({ _id: id, vendorId: vendor._id });
  if (!count) {
    throw new AppError("Stock count record not found", 404, "COUNT_NOT_FOUND");
  }

  if (["reconciled", "finalized", "completed", "cancelled"].includes(count.status)) {
    throw new AppError(`Cannot record counts on session in '${count.status}' status`, 400, "COUNT_IMMUTABLE");
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError("Count entries must not be empty", 400, "EMPTY_COUNT_ENTRIES");
  }

  for (const entry of items) {
    const item = count.items.find(
      (it) => it._id.toString() === entry._id?.toString() ||
              it.productVariantId.toString() === entry.productVariantId?.toString()
    );

    if (item) {
      const counted = Number(entry.countedOnHand ?? entry.countedQuantity);
      if (Number.isInteger(counted) && counted >= 0) {
        item.countedOnHand = counted;
        item.discrepancy = counted - item.snapshotOnHand;
        item.shortageQuantity = item.discrepancy < 0 ? Math.abs(item.discrepancy) : 0;
        item.excessQuantity = item.discrepancy > 0 ? item.discrepancy : 0;
        item.variancePercentage = item.snapshotOnHand > 0
          ? Math.round(((counted - item.snapshotOnHand) / item.snapshotOnHand) * 10000) / 100
          : (counted > 0 ? 100 : 0);
        item.countingTimestamp = new Date();
        item.countedBy = vendor.userId;

        if (item.unitCost) {
          item.varianceValue = Math.round(item.discrepancy * item.unitCost * 100) / 100;
        }
      }

      if (entry.countedCondition && ["sellable", "damaged", "defective", "expired", "missing"].includes(entry.countedCondition)) {
        item.countedCondition = entry.countedCondition;
      }
      if (entry.inspectionNotes) {
        item.inspectionNotes = entry.inspectionNotes?.trim();
      }
      if (entry.reason !== undefined || entry.notes !== undefined) {
        item.reason = entry.reason || entry.notes;
      }
      if (entry.recountCountedOnHand !== undefined) {
        const rc = Number(entry.recountCountedOnHand);
        if (Number.isInteger(rc) && rc >= 0) {
          item.recountCountedOnHand = rc;
        }
      }
    }
  }

  const metrics = calculateCountMetrics(count.items);
  count.totalExpectedQty = metrics.totalExpectedQty;
  count.totalCountedQty = metrics.totalCountedQty;
  count.totalVarianceQty = metrics.totalVarianceQty;
  count.skuAccuracyRate = metrics.skuAccuracyRate;
  count.quantityAccuracyRate = metrics.quantityAccuracyRate;

  if (notes) {
    count.notes = notes.trim();
  }

  await count.save();
  return count;
};

/**
 * Submit physical count session for review and variance approval.
 */
const submitVendorStockCount = async ({ userId, id, notes = null }) => {
  const vendor = await resolveApprovedVendor(userId);

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid count ID", 400, "INVALID_ID");
  }

  const count = await StockCount.findOne({ _id: id, vendorId: vendor._id });
  if (!count) {
    throw new AppError("Stock count record not found", 404, "COUNT_NOT_FOUND");
  }

  if (count.status !== "counting" && count.status !== "draft" && count.status !== "recount_required") {
    throw new AppError(`Cannot submit count in '${count.status}' status`, 400, "INVALID_COUNT_STATE");
  }

  // Verify all items have recorded counts
  const uncounted = count.items.filter((it) => it.countedOnHand === null || it.countedOnHand === undefined);
  if (uncounted.length > 0) {
    throw new AppError(
      `Cannot submit session: ${uncounted.length} item(s) have not been counted. Record physical quantities for all SKUs before submitting.`,
      400,
      "UNCOUNTED_ITEMS_EXIST"
    );
  }

  count.status = "submitted";
  count.submittedBy = vendor.userId;
  count.submittedAt = new Date();
  if (notes) {
    count.notes = notes.trim();
  }

  await count.save();
  return count;
};

/**
 * Flag specific items or count session as requiring a recount.
 */
const requestVendorRecount = async ({ userId, id, itemIds = [], recountNotes = "" }) => {
  const vendor = await resolveApprovedVendor(userId);

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid count ID", 400, "INVALID_ID");
  }

  const count = await StockCount.findOne({ _id: id, vendorId: vendor._id });
  if (!count) {
    throw new AppError("Stock count record not found", 404, "COUNT_NOT_FOUND");
  }

  if (["reconciled", "finalized", "cancelled"].includes(count.status)) {
    throw new AppError(`Cannot request recount on session in '${count.status}' status`, 400, "COUNT_IMMUTABLE");
  }

  const hasSpecificIds = Array.isArray(itemIds) && itemIds.length > 0;
  for (const item of count.items) {
    if (!hasSpecificIds || itemIds.includes(item._id.toString()) || itemIds.includes(item.productVariantId.toString())) {
      item.recountRequested = true;
      item.recountNotes = recountNotes || "Recount required due to material discrepancy";
    }
  }

  count.status = "recount_required";
  count.recountCount = (count.recountCount || 0) + 1;
  count.reviewNotes = recountNotes || count.reviewNotes;
  count.reviewedBy = vendor.userId;
  count.reviewedAt = new Date();

  await count.save();
  return count;
};

/**
 * Approve a submitted stock count for reconciliation.
 */
const approveVendorStockCount = async ({ userId, id, approvalNotes = null }) => {
  const vendor = await resolveApprovedVendor(userId);

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid count ID", 400, "INVALID_ID");
  }

  const count = await StockCount.findOne({ _id: id, vendorId: vendor._id });
  if (!count) {
    throw new AppError("Stock count record not found", 404, "COUNT_NOT_FOUND");
  }

  if (count.status !== "submitted" && count.status !== "under_review" && count.status !== "review") {
    throw new AppError(`Cannot approve count in '${count.status}' status. Count must be submitted for review first.`, 400, "INVALID_APPROVAL_STATE");
  }

  count.status = "approved";
  count.approvedBy = vendor.userId;
  count.approvedAt = new Date();
  count.approvalNotes = approvalNotes?.trim() || null;

  await count.save();
  return count;
};

/**
 * Reject a submitted stock count.
 */
const rejectVendorStockCount = async ({ userId, id, rejectionReason = "Variance rejected upon operational review" }) => {
  const vendor = await resolveApprovedVendor(userId);

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid count ID", 400, "INVALID_ID");
  }

  const count = await StockCount.findOne({ _id: id, vendorId: vendor._id });
  if (!count) {
    throw new AppError("Stock count record not found", 404, "COUNT_NOT_FOUND");
  }

  if (["reconciled", "finalized", "cancelled"].includes(count.status)) {
    throw new AppError(`Cannot reject count in '${count.status}' status`, 400, "COUNT_IMMUTABLE");
  }

  count.status = "rejected";
  count.rejectedBy = vendor.userId;
  count.rejectedAt = new Date();
  count.rejectionReason = rejectionReason?.trim() || "Rejected";

  await count.save();
  return count;
};

/**
 * Execute movement-aware inventory reconciliation for approved vendor count.
 */
const reconcileVendorStockCount = async ({ userId, id, idempotencyKey = null }) => {
  const vendor = await resolveApprovedVendor(userId);

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid count ID", 400, "INVALID_ID");
  }

  const existing = await StockCount.findOne({ _id: id, vendorId: vendor._id });
  if (!existing) {
    throw new AppError("Stock count record not found", 404, "COUNT_NOT_FOUND");
  }

  // Idempotency: if already reconciled
  if (existing.status === "reconciled" || existing.status === "finalized") {
    return existing;
  }

  if (existing.status !== "approved" && existing.status !== "submitted") {
    throw new AppError(
      `Cannot reconcile count in '${existing.status}' status. Count must be approved before reconciliation.`,
      400,
      "INVALID_RECONCILIATION_STATE"
    );
  }

  return await withTransaction(async (session) => {
    const count = await StockCount.findOne({ _id: id, vendorId: vendor._id }).session(session);
    if (!count || count.status === "reconciled" || count.status === "finalized") {
      return count || existing;
    }

    const warehouseId = count.warehouseId;

    for (const item of count.items) {
      if (item.countedOnHand === null || item.countedOnHand === undefined) {
        continue;
      }

      // Movement-Aware Reconciliation Formula:
      // delta = Counted - Snapshot
      const delta = item.countedOnHand - item.snapshotOnHand;

      const currentInv = await Inventory.findOne({
        warehouseId,
        productVariantId: item.productVariantId,
      }).session(session);

      if (!currentInv) {
        continue;
      }

      // If condition was marked damaged, defective, or expired:
      if (["damaged", "defective", "expired"].includes(item.countedCondition)) {
        const conditionQty = item.shortageQuantity > 0 ? item.shortageQuantity : Math.min(item.countedOnHand, 1);
        if (conditionQty > 0) {
          await inventoryRepository.adjustStockCondition(
            currentInv._id,
            {
              condition: item.countedCondition,
              quantity: conditionQty,
              disposition: "mark_condition",
            },
            { session }
          );
        }
      }

      if (delta === 0) {
        item.adjustmentApplied = true;
        continue;
      }

      // Invariant check: live stock + delta >= reserved + nonSellable
      const nonSellable = (currentInv.damaged || 0) + (currentInv.defective || 0) + (currentInv.expired || 0);
      if (currentInv.onHand + delta < currentInv.reserved + nonSellable) {
        throw new AppError(
          `Reconciliation adjustment for SKU ${item.sku} (delta: ${delta}) would reduce live on-hand (${currentInv.onHand + delta}) below reserved (${currentInv.reserved}) and non-sellable stock (${nonSellable}). Operational resolution required.`,
          409,
          "ADJUSTMENT_VIOLATES_RESERVATION"
        );
      }

      const onHandBefore = currentInv.onHand;
      const onHandAfter = currentInv.onHand + delta;
      const reservedBefore = currentInv.reserved;

      currentInv.onHand = onHandAfter;
      currentInv.lastStockUpdateAt = new Date();
      await currentInv.save({ session });

      await inventoryTransactionService.createTransaction({
        productVariantId: item.productVariantId,
        warehouseId,
        vendorId: vendor._id,
        type: "count_reconciliation",
        quantity: delta,
        onHandBefore,
        onHandAfter,
        reservedBefore,
        reservedAfter: reservedBefore,
        referenceType: "stock_count_reconciliation",
        referenceId: count.countNumber,
        idempotencyKey,
        actorUserId: vendor.userId,
        notes: `Physical cycle count reconciliation for SKU ${item.sku}. Counted: ${item.countedOnHand}, Snapshot: ${item.snapshotOnHand}. Condition: ${item.countedCondition}. Reason: ${item.reason || "Physical count audit"}`,
        session,
      });

      item.adjustmentApplied = true;
      item.appliedAdjustmentDelta = delta;
      item.discrepancy = delta;

      await syncVariantStockMirror(item.productVariantId, session);
    }

    count.status = "reconciled";
    count.reconciledAt = new Date();
    count.reconciledBy = vendor.userId;
    count.completedAt = new Date();
    count.completedBy = vendor.userId;
    await count.save({ session });

    return count;
  });
};

/**
 * Cancel a vendor stock count session.
 */
const cancelVendorStockCount = async ({ userId, id, reason = "Cancelled by merchant" }) => {
  const vendor = await resolveApprovedVendor(userId);

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid count ID", 400, "INVALID_ID");
  }

  const count = await StockCount.findOne({ _id: id, vendorId: vendor._id });
  if (!count) {
    throw new AppError("Stock count record not found", 404, "COUNT_NOT_FOUND");
  }

  if (["reconciled", "finalized", "completed"].includes(count.status)) {
    throw new AppError("Cannot cancel an already reconciled stock count", 400, "COUNT_ALREADY_COMPLETED");
  }

  if (count.status === "cancelled") {
    return count;
  }

  count.status = "cancelled";
  count.cancelledAt = new Date();
  count.cancelledBy = vendor.userId;
  count.cancellationReason = reason?.trim() || "Cancelled by merchant";
  await count.save();

  return count;
};

/**
 * List stock counts strictly partitioned to authenticated vendor.
 */
const listVendorStockCounts = async ({
  userId,
  warehouseId,
  status,
  countType,
  scope,
  search,
  page = 1,
  limit = 20,
}) => {
  const vendor = await resolveApprovedVendor(userId);

  const query = { vendorId: vendor._id };

  if (warehouseId && mongoose.isValidObjectId(warehouseId)) {
    query.warehouseId = warehouseId;
  }
  if (status && status !== "all") {
    query.status = status;
  }
  if (countType && countType !== "all") {
    query.countType = countType;
  }
  if (scope && scope !== "all") {
    query.scope = scope;
  }
  if (search && typeof search === "string" && search.trim().length > 0) {
    const s = search.trim();
    query.$or = [
      { countNumber: { $regex: s, $options: "i" } },
      { "items.sku": { $regex: s, $options: "i" } },
      { "items.productName": { $regex: s, $options: "i" } },
      { notes: { $regex: s, $options: "i" } },
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [total, items] = await Promise.all([
    StockCount.countDocuments(query),
    StockCount.find(query)
      .populate("warehouseId", "name code city state country")
      .populate("startedBy", "firstName lastName email")
      .populate("submittedBy", "firstName lastName email")
      .populate("approvedBy", "firstName lastName email")
      .populate("reconciledBy", "firstName lastName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
  ]);

  return {
    items,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
  };
};

/**
 * Get vendor stock count session details ensuring tenant ownership.
 */
const getVendorStockCount = async ({ userId, id }) => {
  const vendor = await resolveApprovedVendor(userId);

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid count ID", 400, "INVALID_ID");
  }

  const count = await StockCount.findOne({ _id: id, vendorId: vendor._id })
    .populate("warehouseId", "name code address city state contactPhone contactEmail")
    .populate("categoryIds", "name slug")
    .populate("startedBy", "firstName lastName email")
    .populate("submittedBy", "firstName lastName email")
    .populate("reviewedBy", "firstName lastName email")
    .populate("approvedBy", "firstName lastName email")
    .populate("rejectedBy", "firstName lastName email")
    .populate("reconciledBy", "firstName lastName email")
    .lean();

  if (!count) {
    throw new AppError("Stock count record not found", 404, "COUNT_NOT_FOUND");
  }

  return count;
};

/**
 * Export vendor stock count and accuracy metrics as spreadsheet (CSV or XLSX).
 */
const exportVendorStockCount = async ({ userId, id, format = "csv" }) => {
  const count = await getVendorStockCount({ userId, id });

  const headers = [
    "Session Number",
    "Warehouse Code",
    "Warehouse Name",
    "SKU",
    "Product Name",
    "Snapshot (Expected)",
    "Physical Counted",
    "Variance Qty",
    "Shortage Qty",
    "Excess Qty",
    "Variance %",
    "Inspection Condition",
    "Discrepancy Reason",
    "Recount Requested",
    "Adjustment Applied",
    "Count Status",
  ];

  const rows = [];
  for (const item of count.items || []) {
    rows.push([
      count.countNumber,
      count.warehouseId?.code || "N/A",
      count.warehouseId?.name || "Warehouse",
      item.sku,
      item.productName,
      item.snapshotOnHand,
      item.countedOnHand !== null ? item.countedOnHand : "Not Counted",
      item.discrepancy,
      item.shortageQuantity,
      item.excessQuantity,
      `${item.variancePercentage}%`,
      item.countedCondition,
      item.reason || item.inspectionNotes || "N/A",
      item.recountRequested ? "Yes" : "No",
      item.adjustmentApplied ? "Yes" : "No",
      count.status,
    ]);
  }

  const isXlsx = String(format).toLowerCase() === "xlsx";
  const sanitizedRows = rows.map((r) => r.map(sanitizeCellValue));
  const data = [headers.map(sanitizeCellValue), ...sanitizedRows];

  const ws = xlsx.utils.aoa_to_sheet(data);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, "Stock Count");

  const ext = isXlsx ? "xlsx" : "csv";
  const filename = `${count.countNumber}_report_${new Date().toISOString().slice(0, 10)}.${ext}`;

  if (isXlsx) {
    const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
    return {
      buffer,
      filename,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  const buffer = xlsx.write(wb, { type: "buffer", bookType: "csv" });
  return {
    buffer,
    filename,
    contentType: "text/csv; charset=utf-8",
  };
};

module.exports = {
  createStockCount,
  recordPhysicalCounts,
  reconcileAndFinalizeCount,
  cancelStockCount,
  getStockCount,
  listStockCounts,
  createVendorStockCount,
  recordVendorPhysicalCounts,
  submitVendorStockCount,
  requestVendorRecount,
  approveVendorStockCount,
  rejectVendorStockCount,
  reconcileVendorStockCount,
  cancelVendorStockCount,
  listVendorStockCounts,
  getVendorStockCount,
  exportVendorStockCount,
  calculateCountMetrics,
};
