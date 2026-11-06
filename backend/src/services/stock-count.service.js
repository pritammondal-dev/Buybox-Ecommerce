const mongoose = require("mongoose");
const crypto = require("crypto");
const StockCount = require("../models/StockCount");
const Warehouse = require("../models/Warehouse");
const ProductVariant = require("../models/ProductVariant");
const Inventory = require("../models/Inventory");
const inventoryRepository = require("../repositories/inventory.repository");
const inventoryTransactionService = require("./inventory-transaction.service");
const { syncVariantStockMirror } = require("./inventory.service");
const withTransaction = require("../utils/withTransaction");
const AppError = require("../errors/AppError");

const generateCountNumber = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `CNT-${dateStr}-${rand}`;
};

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
      productVariantId: variant._id,
      sku: variant.sku,
      productName: variant.name || variant.title || "Product Variant",
      snapshotOnHand: inv.onHand || 0,
      countedOnHand: null,
      discrepancy: 0,
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

  if (count.status === "completed" || count.status === "finalized" || count.status === "cancelled") {
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
      }
      if (entry.reason !== undefined || entry.notes !== undefined) {
        item.reason = entry.reason || entry.notes;
      }
    }
  }

  count.status = "review";
  await count.save();

  return count;
};

/**
 * Reconcile discrepancies and finalize cycle count with stale-snapshot protection.
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
  if (existing.status === "completed" || existing.status === "finalized") {
    return existing;
  }

  if (existing.status === "cancelled") {
    throw new AppError("Cannot finalize a cancelled stock count", 400, "COUNT_CANCELLED");
  }

  return await withTransaction(async (session) => {
    const count = await StockCount.findById(id).session(session);
    if (!count || count.status === "completed") {
      return count || existing;
    }

    const warehouseId = count.warehouseId;

    for (const item of count.items) {
      if (item.countedOnHand === null) {
        continue;
      }

      // Query current real-time inventory (stale-snapshot protection)
      const currentInv = await Inventory.findOne({
        warehouseId,
        productVariantId: item.productVariantId,
      }).session(session);

      if (!currentInv) {
        continue;
      }

      // Calculate true adjustment delta from current real-time stock
      const delta = item.countedOnHand - currentInv.onHand;
      if (delta === 0) {
        item.adjustmentApplied = true;
        continue;
      }

      // Ensure adjustment does not violate reserved stock constraints
      if (currentInv.onHand + delta < currentInv.reserved) {
        throw new AppError(
          `Count adjustment for SKU ${item.sku} would reduce on-hand (${currentInv.onHand + delta}) below reserved stock (${currentInv.reserved})`,
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
        type: "count_reconciliation",
        quantity: delta,
        onHandBefore,
        onHandAfter,
        reservedBefore,
        reservedAfter: reservedBefore,
        referenceType: "cycle_count",
        referenceId: count.countNumber,
        actorUserId: actor?._id || actor?.id || null,
        notes: `Cycle count discrepancy reconciliation for SKU ${item.sku}. Counted: ${item.countedOnHand}, Previous on-hand: ${onHandBefore}. Reason: ${item.reason || "Physical count adjustment"}`,
        session,
      });

      item.adjustmentApplied = true;
      item.discrepancy = delta;

      await syncVariantStockMirror(item.productVariantId, session);
    }

    count.status = "finalized";
    count.completedAt = new Date();
    count.completedBy = actor?._id || actor?.id || null;
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

  if (count.status === "completed") {
    throw new AppError("Cannot cancel a completed stock count", 400, "COUNT_ALREADY_COMPLETED");
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
  if (status) {
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

module.exports = {
  createStockCount,
  recordPhysicalCounts,
  reconcileAndFinalizeCount,
  cancelStockCount,
  getStockCount,
  listStockCounts,
};
