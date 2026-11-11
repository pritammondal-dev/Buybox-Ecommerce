const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const inventoryService = require("../services/inventory.service");
const stockReceivingService = require("../services/stock-receiving.service");
const stockTransferService = require("../services/stock-transfer.service");
const stockCountService = require("../services/stock-count.service");
const warehouseAnalyticsService = require("../services/warehouse-analytics.service");
const {
  ensureInventoryAccess,
  ensureInventoryIdAccess,
  ensureWarehouseScopeForActor,
} = require("../services/inventory-access.service");

const createInventory = asyncHandler(async (req, res) => {
  await ensureInventoryAccess({
    user: req.user,
    productVariantId: req.body.productVariantId,
    warehouseId: req.body.warehouseId,
    isMutation: true,
  });

  const inventory = await inventoryService.createInventory(
    req.body
  );

  return sendSuccess(res, {
    statusCode: 201,
    message: "Inventory created successfully",
    data: {
      inventory,
    },
  });
});

const getInventory = asyncHandler(async (req, res) => {
  const inventory =
    await inventoryService.getInventoryById(
      req.params.id
    );

  await ensureInventoryIdAccess({
    user: req.user,
    inventory,
  });

  return sendSuccess(res, {
    message: "Inventory retrieved successfully",
    data: {
      inventory,
    },
  });
});

const getVariantInventory = asyncHandler(async (req, res) => {
  await ensureInventoryAccess({
    user: req.user,
    productVariantId: req.params.variantId,
  });

  const inventory =
    await inventoryService.getVariantInventory(
      req.params.variantId
    );

  return sendSuccess(res, {
    message: "Variant inventory retrieved successfully",
    data: {
      inventory,
    },
  });
});

const getWarehouseInventory = asyncHandler(async (req, res) => {
  if (!["customer", "vendor"].includes(req.user.role)) {
    await ensureWarehouseScopeForActor(
      req.user,
      req.params.warehouseId
    );
  }

  const inventory =
    await inventoryService.getWarehouseInventory(
      req.params.warehouseId
    );

  if (req.user.role === "vendor") {
    const accessibleInventory = [];

    for (const item of inventory) {
      try {
        await ensureInventoryAccess({
          user: req.user,
          productVariantId: item.productVariantId,
        });

        accessibleInventory.push(item);
      } catch (error) {
        if (error.code === "INVENTORY_ACCESS_DENIED") {
          continue;
        }

        throw error;
      }
    }

    return sendSuccess(res, {
      message: "Warehouse inventory retrieved successfully",
      data: {
        inventory: accessibleInventory,
      },
    });
  }

  return sendSuccess(res, {
    message: "Warehouse inventory retrieved successfully",
    data: {
      inventory,
    },
  });
});

const adjustStock = asyncHandler(async (req, res) => {
  const inventory =
    await inventoryService.getInventoryById(
      req.params.id
    );

  await ensureInventoryIdAccess({
    user: req.user,
    inventory,
    isMutation: true,
  });

  const updatedInventory =
    await inventoryService.adjustStock(
      req.params.id,
      req.body.quantity
    );

  return sendSuccess(res, {
    message: "Stock adjusted successfully",
    data: {
      inventory: updatedInventory,
    },
  });
});

const reserveStock = asyncHandler(async (req, res) => {
  const inventory =
    await inventoryService.getInventoryById(
      req.params.id
    );

  await ensureInventoryIdAccess({
    user: req.user,
    inventory,
    isMutation: true,
  });

  const updatedInventory =
    await inventoryService.reserveStock(
      req.params.id,
      req.body.quantity
    );

  return sendSuccess(res, {
    message: "Stock reserved successfully",
    data: {
      inventory: updatedInventory,
    },
  });
});

const releaseStock = asyncHandler(async (req, res) => {
  const inventory =
    await inventoryService.getInventoryById(
      req.params.id
    );

  await ensureInventoryIdAccess({
    user: req.user,
    inventory,
    isMutation: true,
  });

  const updatedInventory =
    await inventoryService.releaseStock(
      req.params.id,
      req.body.quantity
    );

  return sendSuccess(res, {
    message: "Reserved stock released successfully",
    data: {
      inventory: updatedInventory,
    },
  });
});

const deductReservedStock = asyncHandler(async (req, res) => {
  const inventory =
    await inventoryService.getInventoryById(
      req.params.id
    );

  await ensureInventoryIdAccess({
    user: req.user,
    inventory,
    isMutation: true,
  });

  const updatedInventory =
    await inventoryService.deductReservedStock(
      req.params.id,
      req.body.quantity
    );

  return sendSuccess(res, {
    message: "Reserved stock deducted successfully",
    data: {
      inventory: updatedInventory,
    },
  });
});

const getMyVendorInventory = asyncHandler(async (req, res) => {
  const result = await inventoryService.getMyVendorInventory({
    userId: req.user.id,
    query: req.query,
  });

  return sendSuccess(res, {
    message: "Vendor inventory retrieved successfully",
    data: result.items,
    meta: result.meta,
  });
});

const listAllInventory = asyncHandler(async (req, res) => {
  const result = await inventoryService.listAllInventory(req.query);

  return sendSuccess(res, {
    message: "Inventory retrieved successfully",
    data: result.items,
    meta: result.meta,
  });
});

const transferStock = asyncHandler(async (req, res) => {
  const result = await inventoryService.transferStock({
    productVariantId: req.body.productVariantId,
    sourceWarehouseId: req.body.sourceWarehouseId,
    destinationWarehouseId: req.body.destinationWarehouseId,
    quantity: req.body.quantity,
    reason: req.body.reason,
    actor: req.user,
    req,
  });

  return sendSuccess(res, {
    statusCode: 200,
    message: result.message,
    data: result,
  });
});

const getInventorySummary = asyncHandler(async (req, res) => {
  const Vendor = require("../models/Vendor");
  let vendorId = null;

  if (req.user.role === "vendor") {
    const vendor = await Vendor.findOne({ userId: req.user.id });
    vendorId = vendor?._id;
  } else if (req.query.vendorId) {
    vendorId = req.query.vendorId;
  }

  const summary = await inventoryService.getInventorySummary({ vendorId });

  return sendSuccess(res, {
    message: "Inventory summary retrieved successfully",
    data: summary,
  });
});

/**
 * ============================================================
 * VENDOR-AUTHENTICATED WAREHOUSE OPERATIONS CONTROLLERS
 * ============================================================
 */

// 1. Inbound Goods Receiving
const createVendorReceivingRecord = asyncHandler(async (req, res) => {
  const result = await stockReceivingService.createVendorReceivingRecord({
    userId: req.user.id,
    warehouseId: req.body.warehouseId,
    supplierName: req.body.supplierName,
    referenceDocNumber: req.body.referenceDocNumber,
    items: req.body.items,
    notes: req.body.notes,
    autoConfirm: req.body.autoConfirm === true,
    idempotencyKey: req.headers["idempotency-key"] || req.body.idempotencyKey,
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: "Stock receiving record created successfully",
    data: result,
  });
});

const listVendorReceivingRecords = asyncHandler(async (req, res) => {
  const result = await stockReceivingService.listVendorReceivingRecords({
    userId: req.user.id,
    warehouseId: req.query.warehouseId,
    status: req.query.status,
    search: req.query.search,
    page: req.query.page,
    limit: req.query.limit,
  });

  return sendSuccess(res, {
    message: "Receiving records retrieved successfully",
    data: result.items,
    meta: result.pagination,
  });
});

const getVendorReceivingRecord = asyncHandler(async (req, res) => {
  const record = await stockReceivingService.getVendorReceivingRecord({
    userId: req.user.id,
    id: req.params.id,
  });

  return sendSuccess(res, {
    message: "Receiving record retrieved successfully",
    data: record,
  });
});

const confirmVendorReceiving = asyncHandler(async (req, res) => {
  const result = await stockReceivingService.confirmVendorReceiving({
    userId: req.user.id,
    id: req.params.id,
    idempotencyKey: req.headers["idempotency-key"] || req.body.idempotencyKey,
  });

  return sendSuccess(res, {
    message: "Stock receiving confirmed and inventory updated successfully",
    data: result,
  });
});

const cancelVendorReceiving = asyncHandler(async (req, res) => {
  const result = await stockReceivingService.cancelVendorReceiving({
    userId: req.user.id,
    id: req.params.id,
    reason: req.body.reason,
  });

  return sendSuccess(res, {
    message: "Stock receiving record cancelled successfully",
    data: result,
  });
});

// 2. Inter-Warehouse Stock Transfers
const createVendorTransfer = asyncHandler(async (req, res) => {
  const result = await stockTransferService.createVendorTransfer({
    userId: req.user.id,
    sourceWarehouseId: req.body.sourceWarehouseId,
    destinationWarehouseId: req.body.destinationWarehouseId,
    items: req.body.items,
    notes: req.body.notes,
    idempotencyKey: req.headers["idempotency-key"] || req.body.idempotencyKey,
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: "Stock transfer request created and approved successfully",
    data: result,
  });
});

const listVendorTransfers = asyncHandler(async (req, res) => {
  const result = await stockTransferService.listVendorTransfers({
    userId: req.user.id,
    warehouseId: req.query.warehouseId,
    status: req.query.status,
    search: req.query.search,
    page: req.query.page,
    limit: req.query.limit,
  });

  return sendSuccess(res, {
    message: "Stock transfers retrieved successfully",
    data: result.items,
    meta: result.pagination,
  });
});

const getVendorTransferRecord = asyncHandler(async (req, res) => {
  const transfer = await stockTransferService.getVendorTransferRecord({
    userId: req.user.id,
    id: req.params.id,
  });

  return sendSuccess(res, {
    message: "Stock transfer retrieved successfully",
    data: transfer,
  });
});

const dispatchVendorTransfer = asyncHandler(async (req, res) => {
  const result = await stockTransferService.dispatchVendorTransfer({
    userId: req.user.id,
    id: req.params.id,
    trackingReference: req.body.trackingReference || req.body.trackingNumber,
    carrierName: req.body.carrierName || req.body.carrier,
    idempotencyKey: req.headers["idempotency-key"] || req.body.idempotencyKey,
  });

  return sendSuccess(res, {
    message: "Transfer dispatched successfully and source stock updated",
    data: result,
  });
});

const receiveVendorTransfer = asyncHandler(async (req, res) => {
  const result = await stockTransferService.receiveVendorTransfer({
    userId: req.user.id,
    id: req.params.id,
    receivedItems: req.body.receivedItems || [],
    notes: req.body.notes,
    idempotencyKey: req.headers["idempotency-key"] || req.body.idempotencyKey,
  });

  return sendSuccess(res, {
    message: "Transfer received and destination inventory updated successfully",
    data: result,
  });
});

const cancelVendorTransfer = asyncHandler(async (req, res) => {
  const result = await stockTransferService.cancelVendorTransfer({
    userId: req.user.id,
    id: req.params.id,
    reason: req.body.reason,
  });

  return sendSuccess(res, {
    message: "Stock transfer cancelled successfully",
    data: result,
  });
});

// 3. Controlled Inventory Adjustments
const adjustVendorStock = asyncHandler(async (req, res) => {
  const result = await inventoryService.adjustVendorStock({
    userId: req.user.id,
    inventoryId: req.params.id || req.body.inventoryId,
    quantity: req.body.quantity,
    reason: req.body.reason,
    condition: req.body.condition || "sellable",
    notes: req.body.notes,
    idempotencyKey: req.headers["idempotency-key"] || req.body.idempotencyKey,
  });

  return sendSuccess(res, {
    message: "Stock adjusted and logged to immutable audit ledger successfully",
    data: result,
  });
});

// 4. Consolidated Stock Movement History
const getMyVendorMovementHistory = asyncHandler(async (req, res) => {
  const result = await inventoryService.getMyVendorMovementHistory({
    userId: req.user.id,
    query: req.query,
  });

  return sendSuccess(res, {
    message: "Stock movement history retrieved successfully",
    data: result.items,
    meta: result.pagination,
  });
});

// 5. Reorder & Threshold Management
const updateVendorInventoryThreshold = asyncHandler(async (req, res) => {
  const result = await inventoryService.updateVendorInventoryThreshold({
    userId: req.user.id,
    inventoryId: req.params.id,
    lowStockThreshold: req.body.lowStockThreshold,
    reorderLevel: req.body.reorderLevel,
  });

  return sendSuccess(res, {
    message: "Reorder threshold updated successfully",
    data: result,
  });
});

// 6. Vendor Physical Stock Counting & Reconciliation
const createVendorStockCount = asyncHandler(async (req, res) => {
  const result = await stockCountService.createVendorStockCount({
    userId: req.user.id,
    warehouseId: req.body.warehouseId,
    countType: req.body.countType || "physical",
    scope: req.body.scope || "full",
    variantIds: req.body.variantIds || [],
    categoryIds: req.body.categoryIds || [],
    materialityThresholdPercent: req.body.materialityThresholdPercent,
    notes: req.body.notes,
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: "Stock count session created successfully",
    data: result,
  });
});

const listVendorStockCounts = asyncHandler(async (req, res) => {
  const result = await stockCountService.listVendorStockCounts({
    userId: req.user.id,
    warehouseId: req.query.warehouseId,
    status: req.query.status,
    countType: req.query.countType,
    scope: req.query.scope,
    search: req.query.search,
    page: req.query.page,
    limit: req.query.limit,
  });

  return sendSuccess(res, {
    message: "Stock count sessions retrieved successfully",
    data: result.items,
    meta: result.pagination,
  });
});

const getVendorStockCount = asyncHandler(async (req, res) => {
  const result = await stockCountService.getVendorStockCount({
    userId: req.user.id,
    id: req.params.id,
  });

  return sendSuccess(res, {
    message: "Stock count session retrieved successfully",
    data: result,
  });
});

const recordVendorPhysicalCounts = asyncHandler(async (req, res) => {
  const result = await stockCountService.recordVendorPhysicalCounts({
    userId: req.user.id,
    id: req.params.id,
    items: req.body.items,
    notes: req.body.notes,
  });

  return sendSuccess(res, {
    message: "Physical counts and inspection conditions recorded successfully",
    data: result,
  });
});

const submitVendorStockCount = asyncHandler(async (req, res) => {
  const result = await stockCountService.submitVendorStockCount({
    userId: req.user.id,
    id: req.params.id,
    notes: req.body.notes,
  });

  return sendSuccess(res, {
    message: "Stock count session submitted for review successfully",
    data: result,
  });
});

const requestVendorRecount = asyncHandler(async (req, res) => {
  const result = await stockCountService.requestVendorRecount({
    userId: req.user.id,
    id: req.params.id,
    itemIds: req.body.itemIds,
    recountNotes: req.body.recountNotes,
  });

  return sendSuccess(res, {
    message: "Recount request initiated successfully",
    data: result,
  });
});

const approveVendorStockCount = asyncHandler(async (req, res) => {
  const result = await stockCountService.approveVendorStockCount({
    userId: req.user.id,
    id: req.params.id,
    approvalNotes: req.body.approvalNotes,
  });

  return sendSuccess(res, {
    message: "Stock count variances approved for reconciliation successfully",
    data: result,
  });
});

const rejectVendorStockCount = asyncHandler(async (req, res) => {
  const result = await stockCountService.rejectVendorStockCount({
    userId: req.user.id,
    id: req.params.id,
    rejectionReason: req.body.rejectionReason,
  });

  return sendSuccess(res, {
    message: "Stock count rejected successfully",
    data: result,
  });
});

const reconcileVendorStockCount = asyncHandler(async (req, res) => {
  const result = await stockCountService.reconcileVendorStockCount({
    userId: req.user.id,
    id: req.params.id,
    idempotencyKey: req.headers["idempotency-key"] || req.body.idempotencyKey,
  });

  return sendSuccess(res, {
    message: "Inventory reconciled atomically and ledger transactions generated successfully",
    data: result,
  });
});

const cancelVendorStockCount = asyncHandler(async (req, res) => {
  const result = await stockCountService.cancelVendorStockCount({
    userId: req.user.id,
    id: req.params.id,
    reason: req.body.reason,
  });

  return sendSuccess(res, {
    message: "Stock count session cancelled successfully",
    data: result,
  });
});

const exportVendorStockCount = asyncHandler(async (req, res) => {
  const result = await stockCountService.exportVendorStockCount({
    userId: req.user.id,
    id: req.params.id,
    format: req.query.format || "csv",
  });

  res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
  res.setHeader("Content-Type", result.contentType);
  return res.send(result.buffer);
});

const getVendorWarehouseOverview = asyncHandler(async (req, res) => {
  const result = await warehouseAnalyticsService.getVendorWarehouseOverview({
    userId: req.user.id,
    query: req.query,
  });

  return sendSuccess(res, {
    message: "Warehouse overview metrics retrieved successfully",
    data: result,
  });
});

const getVendorMovementAnalytics = asyncHandler(async (req, res) => {
  const result = await warehouseAnalyticsService.getVendorMovementAnalytics({
    userId: req.user.id,
    query: req.query,
  });

  return sendSuccess(res, {
    message: "Inventory movement analytics retrieved successfully",
    data: result,
  });
});

const getVendorInventoryAging = asyncHandler(async (req, res) => {
  const result = await warehouseAnalyticsService.getVendorInventoryAging({
    userId: req.user.id,
    query: req.query,
  });

  return sendSuccess(res, {
    message: "Inventory aging report retrieved successfully",
    data: result,
  });
});

const getVendorInventoryTurnover = asyncHandler(async (req, res) => {
  const result = await warehouseAnalyticsService.getVendorInventoryTurnover({
    userId: req.user.id,
    query: req.query,
  });

  return sendSuccess(res, {
    message: "Inventory turnover and velocity metrics retrieved successfully",
    data: result,
  });
});

const getVendorDemandAndReplenishment = asyncHandler(async (req, res) => {
  const result = await warehouseAnalyticsService.getVendorDemandAndReplenishment({
    userId: req.user.id,
    query: req.query,
  });

  return sendSuccess(res, {
    message: "Demand and replenishment intelligence retrieved successfully",
    data: result,
  });
});

const getVendorWarehouseOperations = asyncHandler(async (req, res) => {
  const result = await warehouseAnalyticsService.getVendorWarehouseOperations({
    userId: req.user.id,
    query: req.query,
  });

  return sendSuccess(res, {
    message: "Warehouse operational performance metrics retrieved successfully",
    data: result,
  });
});

const exportVendorWarehouseAnalytics = asyncHandler(async (req, res) => {
  const result = await warehouseAnalyticsService.exportVendorWarehouseAnalytics({
    userId: req.user.id,
    query: req.query,
  });

  res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
  res.setHeader("Content-Type", result.contentType);
  return res.send(result.buffer);
});

module.exports = {
  createInventory,
  getInventory,
  getVariantInventory,
  getWarehouseInventory,
  adjustStock,
  reserveStock,
  releaseStock,
  deductReservedStock,
  getMyVendorInventory,
  listAllInventory,
  transferStock,
  getInventorySummary,
  createVendorReceivingRecord,
  listVendorReceivingRecords,
  getVendorReceivingRecord,
  confirmVendorReceiving,
  cancelVendorReceiving,
  createVendorTransfer,
  listVendorTransfers,
  getVendorTransferRecord,
  dispatchVendorTransfer,
  receiveVendorTransfer,
  cancelVendorTransfer,
  adjustVendorStock,
  getMyVendorMovementHistory,
  updateVendorInventoryThreshold,
  createVendorStockCount,
  listVendorStockCounts,
  getVendorStockCount,
  recordVendorPhysicalCounts,
  submitVendorStockCount,
  requestVendorRecount,
  approveVendorStockCount,
  rejectVendorStockCount,
  reconcileVendorStockCount,
  cancelVendorStockCount,
  exportVendorStockCount,
  getVendorWarehouseOverview,
  getVendorMovementAnalytics,
  getVendorInventoryAging,
  getVendorInventoryTurnover,
  getVendorDemandAndReplenishment,
  getVendorWarehouseOperations,
  exportVendorWarehouseAnalytics,
};