const mongoose = require("mongoose");
const crypto = require("crypto");
const StockReceiving = require("../models/StockReceiving");
const Warehouse = require("../models/Warehouse");
const ProductVariant = require("../models/ProductVariant");
const Product = require("../models/Product");
const Inventory = require("../models/Inventory");
const Vendor = require("../models/Vendor");
const inventoryTransactionService = require("./inventory-transaction.service");
const { syncVariantStockMirror } = require("./inventory.service");
const { resolveApprovedVendor } = require("../middlewares/vendor.middleware");
const withTransaction = require("../utils/withTransaction");
const AppError = require("../errors/AppError");

const generateReceivingNumber = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `RCV-${dateStr}-${rand}`;
};

/**
 * Create a new inbound stock receiving record in draft status.
 */
const createReceivingRecord = async (data, actor) => {
  const warehouseId = data.warehouseId || data.destinationWarehouseId;
  const supplierName = data.supplierName;
  const referenceDocNumber = data.referenceDocNumber || data.referenceDocumentNumber;
  const items = data.items;
  const notes = data.notes;

  if (!mongoose.isValidObjectId(warehouseId)) {
    throw new AppError("Invalid warehouse ID", 400, "INVALID_WAREHOUSE_ID");
  }

  const warehouse = await Warehouse.findById(warehouseId);
  if (!warehouse || !warehouse.isActive || warehouse.deletedAt) {
    throw new AppError("Destination warehouse not found or inactive", 404, "WAREHOUSE_NOT_FOUND");
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError("Receiving items must not be empty", 400, "EMPTY_RECEIVING_ITEMS");
  }

  const processedItems = [];
  for (const item of items) {
    if (!mongoose.isValidObjectId(item.productVariantId)) {
      throw new AppError(`Invalid product variant ID: ${item.productVariantId}`, 400, "INVALID_VARIANT_ID");
    }

    const variant = await ProductVariant.findById(item.productVariantId).populate("productId");
    if (!variant || variant.deletedAt) {
      throw new AppError(`Product variant not found: ${item.productVariantId}`, 404, "VARIANT_NOT_FOUND");
    }

    const expectedQty = Number(item.expectedQuantity ?? item.quantityExpected ?? 0);
    const receivedQty = Number(item.receivedQuantity ?? item.quantityReceived ?? expectedQty);
    const rejectedQty = Number(item.rejectedQuantity ?? item.quantityRejected ?? 0);

    if (!Number.isInteger(expectedQty) || expectedQty < 0) {
      throw new AppError("Expected quantity must be a non-negative integer", 400, "INVALID_QUANTITY");
    }
    if (!Number.isInteger(receivedQty) || receivedQty < 0) {
      throw new AppError("Received quantity must be a non-negative integer", 400, "INVALID_QUANTITY");
    }
    if (!Number.isInteger(rejectedQty) || rejectedQty < 0) {
      throw new AppError("Rejected quantity must be a non-negative integer", 400, "INVALID_QUANTITY");
    }

    processedItems.push({
      productId: variant.productId?._id || variant.productId,
      productVariantId: variant._id,
      sku: variant.sku,
      productName: variant.productId?.name || variant.productId?.title || variant.name || "Product",
      expectedQuantity: expectedQty,
      receivedQuantity: receivedQty,
      rejectedQuantity: rejectedQty,
      rejectionReason: item.rejectionReason || item.discrepancyNotes || null,
      binLocationId: item.binLocationId || null,
      notes: item.notes || null,
    });
  }

  const receivingNumber = generateReceivingNumber();
  const receiving = await StockReceiving.create({
    receivingNumber,
    warehouseId,
    supplierName: supplierName || null,
    referenceDocNumber: referenceDocNumber || null,
    status: "draft",
    items: processedItems,
    notes: notes || null,
    receivedBy: actor?._id || actor?.id || null,
  });

  return receiving;
};

/**
 * Get receiving record by ID with populated details.
 */
const getReceivingRecord = async (id) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid receiving record ID", 400, "INVALID_ID");
  }

  const record = await StockReceiving.findById(id)
    .populate("warehouseId", "name code address contactEmail contactPhone")
    .populate("receivedBy", "firstName lastName email")
    .populate("confirmedBy", "firstName lastName email")
    .lean();

  if (!record) {
    throw new AppError("Stock receiving record not found", 404, "RECEIVING_NOT_FOUND");
  }

  return record;
};

/**
 * List receiving records with filters and pagination.
 */
const listReceivingRecords = async ({ warehouseId, status, page = 1, limit = 20 } = {}) => {
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
    StockReceiving.countDocuments(query),
    StockReceiving.find(query)
      .populate("warehouseId", "name code city state")
      .populate("receivedBy", "firstName lastName")
      .populate("confirmedBy", "firstName lastName")
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
 * Update a draft receiving record before confirmation.
 */
const updateReceivingRecord = async (id, data, actor) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid receiving ID", 400, "INVALID_ID");
  }

  const record = await StockReceiving.findById(id);
  if (!record) {
    throw new AppError("Stock receiving record not found", 404, "RECEIVING_NOT_FOUND");
  }

  if (record.status !== "draft") {
    throw new AppError("Cannot modify a receiving record that is not in draft status", 400, "RECEIVING_IMMUTABLE");
  }

  if (data.supplierName !== undefined) record.supplierName = data.supplierName;
  if (data.referenceDocNumber !== undefined) record.referenceDocNumber = data.referenceDocNumber;
  if (data.notes !== undefined) record.notes = data.notes;

  if (Array.isArray(data.items)) {
    for (const updateItem of data.items) {
      const match = record.items.find(
        (it) => it._id.toString() === updateItem._id?.toString() ||
                it.productVariantId.toString() === updateItem.productVariantId?.toString()
      );
      if (match) {
        if (typeof updateItem.receivedQuantity === "number" && updateItem.receivedQuantity >= 0) {
          match.receivedQuantity = updateItem.receivedQuantity;
        }
        if (typeof updateItem.rejectedQuantity === "number" && updateItem.rejectedQuantity >= 0) {
          match.rejectedQuantity = updateItem.rejectedQuantity;
        }
        if (updateItem.rejectionReason !== undefined) {
          match.rejectionReason = updateItem.rejectionReason;
        }
        if (updateItem.binLocationId !== undefined) {
          match.binLocationId = updateItem.binLocationId;
        }
      }
    }
  }

  await record.save();
  return record;
};

/**
 * Confirm receiving record: atomically adds stock to Inventory and logs transactions.
 */
const confirmReceiving = async (idOrObj, maybeActor, maybeOptions = {}) => {
  let id;
  let actor = maybeActor;
  let options = maybeOptions;
  if (typeof idOrObj === "object" && idOrObj !== null && !mongoose.isValidObjectId(idOrObj)) {
    id = idOrObj.receivingId || idOrObj.id;
    actor = maybeActor || { _id: idOrObj.actorUserId };
    options = maybeOptions || { idempotencyKey: idOrObj.idempotencyKey };
  } else {
    id = idOrObj;
  }

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid receiving ID", 400, "INVALID_ID");
  }

  const existingRecord = await StockReceiving.findById(id);
  if (!existingRecord) {
    throw new AppError("Stock receiving record not found", 404, "RECEIVING_NOT_FOUND");
  }

  // Idempotency check: if already confirmed
  if (existingRecord.status === "confirmed") {
    if (options.idempotencyKey && existingRecord.idempotencyKey && existingRecord.idempotencyKey === options.idempotencyKey) {
      return existingRecord;
    }
    throw new AppError("Receiving record is already confirmed", 409, "INVALID_STATUS_TRANSITION");
  }

  if (existingRecord.status === "cancelled") {
    throw new AppError("Cannot confirm a cancelled receiving record", 400, "RECEIVING_CANCELLED");
  }

  return await withTransaction(async (session) => {
    const record = await StockReceiving.findById(id).session(session);
    if (!record || record.status === "confirmed") {
      if (record && options.idempotencyKey && record.idempotencyKey === options.idempotencyKey) {
        return record;
      }
      throw new AppError("Receiving record is already confirmed", 409, "INVALID_STATUS_TRANSITION");
    }

    const warehouseId = record.warehouseId;
    const warehouse = await Warehouse.findById(warehouseId).session(session);
    if (!warehouse || !warehouse.isActive) {
      throw new AppError("Destination warehouse is not active", 400, "WAREHOUSE_INACTIVE");
    }

    for (const item of record.items) {
      const acceptedQty = Number(item.receivedQuantity) || 0;
      const rejectedQty = Number(item.rejectedQuantity) || 0;

      if (acceptedQty === 0 && rejectedQty === 0) {
        continue;
      }

      // Upsert Inventory record for variant in warehouse
      let inventory = await Inventory.findOne({
        productVariantId: item.productVariantId,
        warehouseId,
      }).session(session);

      const onHandBefore = inventory ? inventory.onHand : 0;
      const reservedBefore = inventory ? inventory.reserved : 0;
      const onHandAfter = onHandBefore + acceptedQty;

      if (!inventory) {
        inventory = new Inventory({
          productVariantId: item.productVariantId,
          warehouseId,
          onHand: onHandAfter,
          reserved: 0,
          lowStockThreshold: 5,
          lastStockUpdateAt: new Date(),
        });
      } else {
        inventory.onHand = onHandAfter;
        inventory.lastStockUpdateAt = new Date();
      }

      await inventory.save({ session });

      if (acceptedQty > 0) {
        await inventoryTransactionService.createTransaction({
          productVariantId: item.productVariantId,
          warehouseId,
          vendorId: record.vendorId || null,
          type: "receive",
          quantity: acceptedQty,
          onHandBefore,
          onHandAfter,
          reservedBefore,
          reservedAfter: reservedBefore,
          referenceType: "stock_receiving",
          referenceId: record.receivingNumber,
          actorUserId: actor?._id || actor?.id || null,
          notes: `Stock received via ${record.receivingNumber}. Supplier: ${record.supplierName || "N/A"}`,
          session,
        });
      }

      await syncVariantStockMirror(item.productVariantId, session);
    }

    record.status = "confirmed";
    record.confirmedAt = new Date();
    record.confirmedBy = actor?._id || actor?.id || null;
    if (options.idempotencyKey) record.idempotencyKey = options.idempotencyKey;
    await record.save({ session });

    return record;
  });
};

/**
 * Cancel a draft receiving record.
 */
const cancelReceiving = async (idOrObj, maybeReason = "Cancelled by user", maybeActor) => {
  let id;
  let reason = maybeReason;
  let actor = maybeActor;
  if (typeof idOrObj === "object" && idOrObj !== null && !mongoose.isValidObjectId(idOrObj)) {
    id = idOrObj.receivingId || idOrObj.id;
    reason = idOrObj.notes || idOrObj.reason || "Cancelled by user";
    actor = maybeActor || { _id: idOrObj.actorUserId };
  } else {
    id = idOrObj;
  }

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid receiving ID", 400, "INVALID_ID");
  }

  const record = await StockReceiving.findById(id);
  if (!record) {
    throw new AppError("Stock receiving record not found", 404, "RECEIVING_NOT_FOUND");
  }

  if (record.status === "confirmed") {
    throw new AppError("Cannot cancel an already confirmed receiving record", 400, "RECEIVING_ALREADY_CONFIRMED");
  }

  if (record.status === "cancelled") {
    return record;
  }

  record.status = "cancelled";
  record.cancelledAt = new Date();
  record.cancelledBy = actor?._id || actor?.id || null;
  record.cancellationReason = reason;
  await record.save();

  return record;
};

/**
 * ============================================================
 * VENDOR-SPECIFIC INBOUND GOODS RECEIVING METHODS
 * ============================================================
 */

/**
 * Create a vendor-authorized stock receiving record with strict variant ownership verification.
 */
const createVendorReceivingRecord = async ({
  userId,
  warehouseId,
  destinationWarehouseId,
  supplierName,
  referenceDocNumber,
  items,
  notes,
  autoConfirm = false,
  idempotencyKey = null,
}) => {
  const vendor = await resolveApprovedVendor(userId);
  const targetWarehouseId = warehouseId || destinationWarehouseId;

  if (!mongoose.isValidObjectId(targetWarehouseId)) {
    throw new AppError("Invalid warehouse ID", 400, "INVALID_WAREHOUSE_ID");
  }

  const warehouse = await Warehouse.findById(targetWarehouseId);
  if (!warehouse || !warehouse.isActive || warehouse.deletedAt) {
    throw new AppError("Fulfillment center not found or inactive", 404, "WAREHOUSE_NOT_FOUND");
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError("Receiving items must not be empty", 400, "EMPTY_RECEIVING_ITEMS");
  }

  // Idempotency check
  if (idempotencyKey) {
    const existing = await StockReceiving.findOne({
      vendorId: vendor._id,
      idempotencyKey,
    });
    if (existing) {
      return existing;
    }
  }

  const processedItems = [];
  for (const item of items) {
    if (!mongoose.isValidObjectId(item.productVariantId)) {
      throw new AppError(`Invalid product variant ID: ${item.productVariantId}`, 400, "INVALID_VARIANT_ID");
    }

    const variant = await ProductVariant.findById(item.productVariantId).populate("productId");
    if (!variant || variant.deletedAt) {
      throw new AppError(`Product variant not found: ${item.productVariantId}`, 404, "VARIANT_NOT_FOUND");
    }

    // Strict Tenant Isolation: Ensure product belongs to authenticated merchant
    const product = variant.productId;
    if (!product || !product.vendorId || product.vendorId.toString() !== vendor._id.toString()) {
      throw new AppError(
        `Variant ${variant.sku} does not belong to your merchant account`,
        403,
        "VARIANT_ACCESS_DENIED"
      );
    }

    const expectedQty = Number(item.expectedQuantity ?? item.quantityExpected ?? item.quantity ?? 0);
    const receivedQty = Number(item.receivedQuantity ?? item.quantityReceived ?? expectedQty);
    const rejectedQty = Number(item.rejectedQuantity ?? item.quantityRejected ?? 0);

    if (!Number.isInteger(expectedQty) || expectedQty <= 0) {
      throw new AppError("Expected quantity must be a positive integer", 400, "INVALID_QUANTITY");
    }
    if (!Number.isInteger(receivedQty) || receivedQty < 0) {
      throw new AppError("Received quantity must be a non-negative integer", 400, "INVALID_QUANTITY");
    }
    if (!Number.isInteger(rejectedQty) || rejectedQty < 0) {
      throw new AppError("Rejected quantity must be a non-negative integer", 400, "INVALID_QUANTITY");
    }

    processedItems.push({
      productId: product._id,
      productVariantId: variant._id,
      sku: variant.sku,
      productName: product.name || product.title || variant.name || "Product",
      expectedQuantity: expectedQty,
      receivedQuantity: receivedQty,
      rejectedQuantity: rejectedQty,
      rejectionReason: item.rejectionReason || null,
      notes: item.notes || null,
    });
  }

  const receivingNumber = generateReceivingNumber();
  const receiving = await StockReceiving.create({
    receivingNumber,
    warehouseId: targetWarehouseId,
    vendorId: vendor._id,
    supplierName: supplierName?.trim() || null,
    referenceDocNumber: referenceDocNumber?.trim() || null,
    status: "draft",
    items: processedItems,
    notes: notes?.trim() || null,
    idempotencyKey: idempotencyKey || null,
    receivedBy: vendor.userId,
  });

  if (autoConfirm) {
    return confirmReceiving(receiving._id, { _id: vendor.userId }, { idempotencyKey });
  }

  return receiving;
};

/**
 * List receiving records strictly partitioned to authenticated vendor.
 */
const listVendorReceivingRecords = async ({
  userId,
  warehouseId,
  status,
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
  if (search && typeof search === "string" && search.trim().length > 0) {
    const s = search.trim();
    query.$or = [
      { receivingNumber: { $regex: s, $options: "i" } },
      { supplierName: { $regex: s, $options: "i" } },
      { referenceDocNumber: { $regex: s, $options: "i" } },
      { "items.sku": { $regex: s, $options: "i" } },
      { "items.productName": { $regex: s, $options: "i" } },
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [total, items] = await Promise.all([
    StockReceiving.countDocuments(query),
    StockReceiving.find(query)
      .populate("warehouseId", "name code address city state country")
      .populate("receivedBy", "firstName lastName email")
      .populate("confirmedBy", "firstName lastName email")
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
 * Get receiving record details ensuring vendor ownership.
 */
const getVendorReceivingRecord = async ({ userId, id }) => {
  const vendor = await resolveApprovedVendor(userId);

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid receiving ID", 400, "INVALID_ID");
  }

  const record = await StockReceiving.findOne({ _id: id, vendorId: vendor._id })
    .populate("warehouseId", "name code address contactEmail contactPhone city state country")
    .populate("receivedBy", "firstName lastName email")
    .populate("confirmedBy", "firstName lastName email")
    .lean();

  if (!record) {
    throw new AppError("Stock receiving record not found", 404, "RECEIVING_NOT_FOUND");
  }

  return record;
};

/**
 * Confirm a draft receiving record for the authenticated vendor.
 */
const confirmVendorReceiving = async ({ userId, id, idempotencyKey = null }) => {
  const vendor = await resolveApprovedVendor(userId);

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid receiving ID", 400, "INVALID_ID");
  }

  const record = await StockReceiving.findOne({ _id: id, vendorId: vendor._id });
  if (!record) {
    throw new AppError("Stock receiving record not found", 404, "RECEIVING_NOT_FOUND");
  }

  return confirmReceiving(record._id, { _id: vendor.userId }, { idempotencyKey });
};

/**
 * Cancel a draft receiving record for the authenticated vendor.
 */
const cancelVendorReceiving = async ({ userId, id, reason = "Cancelled by merchant" }) => {
  const vendor = await resolveApprovedVendor(userId);

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid receiving ID", 400, "INVALID_ID");
  }

  const record = await StockReceiving.findOne({ _id: id, vendorId: vendor._id });
  if (!record) {
    throw new AppError("Stock receiving record not found", 404, "RECEIVING_NOT_FOUND");
  }

  return cancelReceiving(record._id, reason, { _id: vendor.userId });
};

module.exports = {
  createReceivingRecord,
  getReceivingRecord,
  listReceivingRecords,
  updateReceivingRecord,
  confirmReceiving,
  cancelReceiving,
  createVendorReceivingRecord,
  listVendorReceivingRecords,
  getVendorReceivingRecord,
  confirmVendorReceiving,
  cancelVendorReceiving,
};
