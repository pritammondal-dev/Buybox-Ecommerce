const mongoose = require("mongoose");
const crypto = require("crypto");
const StockTransfer = require("../models/StockTransfer");
const Warehouse = require("../models/Warehouse");
const ProductVariant = require("../models/ProductVariant");
const Inventory = require("../models/Inventory");
const inventoryTransactionService = require("./inventory-transaction.service");
const { syncVariantStockMirror } = require("./inventory.service");
const withTransaction = require("../utils/withTransaction");
const AppError = require("../errors/AppError");

const generateTransferNumber = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `TRF-${dateStr}-${rand}`;
};

/**
 * Create a new transfer request in draft status.
 */
const createTransfer = async (data, actor) => {
  const { sourceWarehouseId, destinationWarehouseId, items, notes } = data;

  if (!mongoose.isValidObjectId(sourceWarehouseId) || !mongoose.isValidObjectId(destinationWarehouseId)) {
    throw new AppError("Invalid warehouse IDs", 400, "INVALID_WAREHOUSE_ID");
  }

  if (sourceWarehouseId.toString() === destinationWarehouseId.toString()) {
    throw new AppError("Source and destination warehouses cannot be the same", 400, "SAME_WAREHOUSE_TRANSFER");
  }

  const [sourceWarehouse, destWarehouse] = await Promise.all([
    Warehouse.findById(sourceWarehouseId),
    Warehouse.findById(destinationWarehouseId),
  ]);

  if (!sourceWarehouse || !sourceWarehouse.isActive || sourceWarehouse.deletedAt) {
    throw new AppError("Source warehouse not found or inactive", 404, "SOURCE_WAREHOUSE_NOT_FOUND");
  }

  if (!destWarehouse || !destWarehouse.isActive || destWarehouse.deletedAt) {
    throw new AppError("Destination warehouse not found or inactive", 404, "DEST_WAREHOUSE_NOT_FOUND");
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError("Transfer items must not be empty", 400, "EMPTY_TRANSFER_ITEMS");
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

    const qty = Number(item.requestedQuantity ?? item.quantityRequested);
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new AppError("Transfer requested quantity must be a positive integer", 400, "INVALID_QUANTITY");
    }

    // Check available stock at source warehouse
    const sourceInv = await Inventory.findOne({
      productVariantId: variant._id,
      warehouseId: sourceWarehouseId,
    });

    const nonSellable = (sourceInv?.damaged || 0) + (sourceInv?.defective || 0) + (sourceInv?.expired || 0);
    const available = Math.max((sourceInv?.onHand || 0) - (sourceInv?.reserved || 0) - nonSellable, 0);

    // Note: Stock availability is strictly checked and deducted at dispatch time.

    processedItems.push({
      productVariantId: variant._id,
      sku: variant.sku,
      productName: variant.productId?.name || variant.productId?.title || variant.name || "Product",
      requestedQuantity: qty,
      dispatchedQuantity: 0,
      receivedQuantity: 0,
      rejectedQuantity: 0,
      discrepancyQuantity: 0,
    });
  }

  const transferNumber = generateTransferNumber();
  const transfer = await StockTransfer.create({
    transferNumber,
    sourceWarehouseId,
    destinationWarehouseId,
    status: "draft",
    items: processedItems,
    notes: notes || null,
    createdBy: actor?._id || actor?.id || null,
  });

  return transfer;
};

/**
 * Approve a draft transfer.
 */
const approveTransfer = async (idOrObj, maybeActor) => {
  let id;
  let actor = maybeActor;
  if (typeof idOrObj === "object" && idOrObj !== null && !mongoose.isValidObjectId(idOrObj)) {
    id = idOrObj.transferId || idOrObj.id;
    actor = maybeActor || { _id: idOrObj.actorUserId };
  } else {
    id = idOrObj;
  }

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid transfer ID", 400, "INVALID_ID");
  }

  const transfer = await StockTransfer.findById(id);
  if (!transfer) {
    throw new AppError("Stock transfer not found", 404, "TRANSFER_NOT_FOUND");
  }

  if (transfer.status !== "draft") {
    throw new AppError(`Cannot approve transfer in '${transfer.status}' status`, 400, "INVALID_TRANSFER_STATUS");
  }

  transfer.status = "approved";
  transfer.approvedBy = actor?._id || actor?.id || null;
  transfer.approvedAt = new Date();
  await transfer.save();

  return transfer;
};

/**
 * Dispatch a transfer: validates source stock, deducts from source inventory, and marks transfer in-transit.
 */
const dispatchTransfer = async (idOrObj, maybeOptions = {}, maybeActor) => {
  let id;
  let options = maybeOptions;
  let actor = maybeActor;
  if (typeof idOrObj === "object" && idOrObj !== null && !mongoose.isValidObjectId(idOrObj)) {
    id = idOrObj.transferId || idOrObj.id;
    options = {
      trackingReference: idOrObj.trackingNumber || idOrObj.trackingReference,
      carrierName: idOrObj.carrier || idOrObj.carrierName,
    };
    actor = maybeActor || { _id: idOrObj.actorUserId };
  } else {
    id = idOrObj;
  }

  const { trackingReference, carrierName } = options;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid transfer ID", 400, "INVALID_ID");
  }

  const existing = await StockTransfer.findById(id);
  if (!existing) {
    throw new AppError("Stock transfer not found", 404, "TRANSFER_NOT_FOUND");
  }

  // Idempotency: if already dispatched or received
  if (existing.status === "dispatched" || existing.status === "partially_received" || existing.status === "received") {
    if (options.idempotencyKey && existing.idempotencyKey && existing.idempotencyKey === options.idempotencyKey) {
      return existing;
    }
    throw new AppError("Transfer is already dispatched or processed", 409, "INVALID_STATUS_TRANSITION");
  }

  if (existing.status !== "draft" && existing.status !== "approved") {
    throw new AppError(`Cannot dispatch transfer in '${existing.status}' status`, 409, "INVALID_STATUS_TRANSITION");
  }

  return await withTransaction(async (session) => {
    const transfer = await StockTransfer.findById(id).session(session);
    if (!transfer || transfer.status === "dispatched" || transfer.status === "received") {
      if (transfer && options.idempotencyKey && transfer.idempotencyKey === options.idempotencyKey) {
        return transfer;
      }
      throw new AppError("Transfer is already dispatched or processed", 409, "INVALID_STATUS_TRANSITION");
    }

    const sourceWarehouseId = transfer.sourceWarehouseId;

    for (const item of transfer.items) {
      const sourceInv = await Inventory.findOne({
        productVariantId: item.productVariantId,
        warehouseId: sourceWarehouseId,
      }).session(session);

      if (!sourceInv) {
        throw new AppError(
          `Inventory record not found at source warehouse for SKU ${item.sku}`,
          404,
          "INVENTORY_NOT_FOUND"
        );
      }

      const nonSellable = (sourceInv.damaged || 0) + (sourceInv.defective || 0) + (sourceInv.expired || 0);
      const available = sourceInv.onHand - sourceInv.reserved - nonSellable;

      if (available < item.requestedQuantity) {
        throw new AppError(
          `Insufficient available stock to dispatch SKU ${item.sku}. Available: ${available}, Requested: ${item.requestedQuantity}`,
          409,
          "INSUFFICIENT_STOCK_FOR_DISPATCH"
        );
      }

      const onHandBefore = sourceInv.onHand;
      const onHandAfter = sourceInv.onHand - item.requestedQuantity;
      const reservedBefore = sourceInv.reserved;

      sourceInv.onHand = onHandAfter;
      sourceInv.lastStockUpdateAt = new Date();
      await sourceInv.save({ session });

      item.dispatchedQuantity = item.requestedQuantity;

      await inventoryTransactionService.createTransaction({
        productVariantId: item.productVariantId,
        warehouseId: sourceWarehouseId,
        type: "transfer",
        quantity: -item.requestedQuantity,
        onHandBefore,
        onHandAfter,
        reservedBefore,
        reservedAfter: reservedBefore,
        referenceType: "transfer_dispatch",
        referenceId: transfer.transferNumber,
        actorUserId: actor?._id || actor?.id || null,
        notes: `Dispatched transfer ${transfer.transferNumber} to destination warehouse`,
        session,
      });

      await syncVariantStockMirror(item.productVariantId, session);
    }

    transfer.status = "dispatched";
    transfer.trackingReference = trackingReference || transfer.trackingReference;
    transfer.carrierName = carrierName || transfer.carrierName;
    transfer.dispatchedAt = new Date();
    transfer.dispatchedBy = actor?._id || actor?.id || null;
    await transfer.save({ session });

    return transfer;
  });
};

/**
 * Receive transfer at destination warehouse: adds accepted stock to destination inventory and records discrepancies.
 */
const receiveTransfer = async (idOrObj, maybeOptions = {}, maybeActor) => {
  let id;
  let options = maybeOptions;
  let actor = maybeActor;
  if (typeof idOrObj === "object" && idOrObj !== null && !mongoose.isValidObjectId(idOrObj)) {
    id = idOrObj.transferId || idOrObj.id;
    options = {
      receivedItems: idOrObj.receivedItems || [],
      notes: idOrObj.notes,
    };
    actor = maybeActor || { _id: idOrObj.actorUserId };
  } else {
    id = idOrObj;
  }

  const { receivedItems = [] } = options;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid transfer ID", 400, "INVALID_ID");
  }

  const existing = await StockTransfer.findById(id);
  if (!existing) {
    throw new AppError("Stock transfer not found", 404, "TRANSFER_NOT_FOUND");
  }

  // Idempotency: if already fully received
  if (existing.status === "received") {
    if (options.idempotencyKey && existing.idempotencyKey && existing.idempotencyKey === options.idempotencyKey) {
      return existing;
    }
    throw new AppError("Transfer is already fully received", 409, "INVALID_STATUS_TRANSITION");
  }

  if (existing.status !== "dispatched" && existing.status !== "partially_received") {
    throw new AppError(`Cannot receive transfer in '${existing.status}' status. Transfer must be dispatched first.`, 409, "INVALID_STATUS_TRANSITION");
  }

  return await withTransaction(async (session) => {
    const transfer = await StockTransfer.findById(id).session(session);
    if (!transfer || transfer.status === "received") {
      if (transfer && options.idempotencyKey && transfer.idempotencyKey === options.idempotencyKey) {
        return transfer;
      }
      throw new AppError("Transfer is already fully received", 409, "INVALID_STATUS_TRANSITION");
    }

    const destinationWarehouseId = transfer.destinationWarehouseId;
    let allItemsFullyReceived = true;

    for (const item of transfer.items) {
      const remainingDispatched = item.dispatchedQuantity - (item.receivedQuantity + item.rejectedQuantity);
      if (remainingDispatched <= 0) {
        continue;
      }

      // Check if user submitted explicit quantities for this item
      const itemUpdate = receivedItems.find(
        (ri) => ri._id?.toString() === item._id?.toString() ||
                ri.productVariantId?.toString() === item.productVariantId?.toString()
      );

      const acceptedQty = itemUpdate ? Number(itemUpdate.receivedQuantity ?? itemUpdate.quantityReceived ?? remainingDispatched) : remainingDispatched;
      const rejectedQty = itemUpdate ? Number(itemUpdate.rejectedQuantity ?? itemUpdate.quantityRejected ?? 0) : 0;
      const discrepancyReason = itemUpdate?.discrepancyReason || null;

      if (acceptedQty + rejectedQty > remainingDispatched) {
        throw new AppError(
          `Received (${acceptedQty}) + rejected (${rejectedQty}) cannot exceed remaining in-transit quantity (${remainingDispatched}) for SKU ${item.sku}`,
          400,
          "EXCEEDED_IN_TRANSIT_QUANTITY"
        );
      }

      if (acceptedQty > 0) {
        // Upsert destination inventory
        let destInv = await Inventory.findOne({
          productVariantId: item.productVariantId,
          warehouseId: destinationWarehouseId,
        }).session(session);

        const onHandBefore = destInv ? destInv.onHand : 0;
        const reservedBefore = destInv ? destInv.reserved : 0;
        const onHandAfter = onHandBefore + acceptedQty;

        if (!destInv) {
          destInv = new Inventory({
            productVariantId: item.productVariantId,
            warehouseId: destinationWarehouseId,
            onHand: onHandAfter,
            reserved: 0,
            lowStockThreshold: 5,
            lastStockUpdateAt: new Date(),
          });
        } else {
          destInv.onHand = onHandAfter;
          destInv.lastStockUpdateAt = new Date();
        }
        await destInv.save({ session });

        await inventoryTransactionService.createTransaction({
          productVariantId: item.productVariantId,
          warehouseId: destinationWarehouseId,
          type: "transfer",
          quantity: acceptedQty,
          onHandBefore,
          onHandAfter,
          reservedBefore,
          reservedAfter: reservedBefore,
          referenceType: "transfer_receipt",
          referenceId: transfer.transferNumber,
          actorUserId: actor?._id || actor?.id || null,
          notes: `Received stock from transfer ${transfer.transferNumber}`,
          session,
        });

        await syncVariantStockMirror(item.productVariantId, session);
      }

      item.receivedQuantity = (item.receivedQuantity || 0) + acceptedQty;
      item.rejectedQuantity = (item.rejectedQuantity || 0) + rejectedQty;
      item.discrepancyQuantity = item.dispatchedQuantity - (item.receivedQuantity + item.rejectedQuantity);
      if (discrepancyReason) {
        item.discrepancyReason = discrepancyReason;
      }

      if (item.receivedQuantity + item.rejectedQuantity < item.dispatchedQuantity) {
        allItemsFullyReceived = false;
      }
    }

    if (allItemsFullyReceived) {
      transfer.status = "received";
      transfer.receivedAt = new Date();
      transfer.receivedBy = actor?._id || actor?.id || null;
    } else {
      transfer.status = "partially_received";
    }

    await transfer.save({ session });
    return transfer;
  });
};

/**
 * Cancel a transfer before it is dispatched.
 */
const cancelTransfer = async (idOrObj, maybeReason = "Cancelled by user", maybeActor) => {
  let id;
  let reason = maybeReason;
  let actor = maybeActor;
  if (typeof idOrObj === "object" && idOrObj !== null && !mongoose.isValidObjectId(idOrObj)) {
    id = idOrObj.transferId || idOrObj.id;
    reason = idOrObj.reason || "Cancelled by user";
    actor = maybeActor || { _id: idOrObj.actorUserId };
  } else {
    id = idOrObj;
  }

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid transfer ID", 400, "INVALID_ID");
  }

  const transfer = await StockTransfer.findById(id);
  if (!transfer) {
    throw new AppError("Stock transfer not found", 404, "TRANSFER_NOT_FOUND");
  }

  if (transfer.status === "dispatched" || transfer.status === "partially_received" || transfer.status === "received") {
    throw new AppError(
      "Cannot cancel a transfer that has already been dispatched. In-transit goods must be received or recorded as discrepancy.",
      409,
      "CANNOT_CANCEL_DISPATCHED_TRANSFER"
    );
  }

  if (transfer.status === "cancelled") {
    return transfer;
  }

  transfer.status = "cancelled";
  transfer.cancelledAt = new Date();
  transfer.cancelledBy = actor?._id || actor?.id || null;
  transfer.cancellationReason = reason;
  await transfer.save();

  return transfer;
};

/**
 * Get transfer record by ID.
 */
const getTransferRecord = async (id) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid transfer ID", 400, "INVALID_ID");
  }

  const transfer = await StockTransfer.findById(id)
    .populate("sourceWarehouseId", "name code city state")
    .populate("destinationWarehouseId", "name code city state")
    .populate("createdBy", "firstName lastName email")
    .populate("approvedBy", "firstName lastName email")
    .populate("dispatchedBy", "firstName lastName email")
    .populate("receivedBy", "firstName lastName email")
    .lean();

  if (!transfer) {
    throw new AppError("Stock transfer not found", 404, "TRANSFER_NOT_FOUND");
  }

  return transfer;
};

/**
 * List transfers with filters and pagination.
 */
const listTransfers = async ({ warehouseId, status, page = 1, limit = 20 } = {}) => {
  const query = {};
  if (warehouseId && mongoose.isValidObjectId(warehouseId)) {
    query.$or = [{ sourceWarehouseId: warehouseId }, { destinationWarehouseId: warehouseId }];
  }
  if (status) {
    query.status = status;
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [total, items] = await Promise.all([
    StockTransfer.countDocuments(query),
    StockTransfer.find(query)
      .populate("sourceWarehouseId", "name code city state")
      .populate("destinationWarehouseId", "name code city state")
      .populate("createdBy", "firstName lastName")
      .populate("dispatchedBy", "firstName lastName")
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
  createTransfer,
  approveTransfer,
  dispatchTransfer,
  receiveTransfer,
  cancelTransfer,
  getTransferRecord,
  listTransfers,
};
