const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const AppError = require("../errors/AppError");
const stockReceivingService = require("../services/stock-receiving.service");
const stockTransferService = require("../services/stock-transfer.service");
const warehouseLocationService = require("../services/warehouse-location.service");
const stockCountService = require("../services/stock-count.service");
const orderAllocationService = require("../services/order-allocation.service");
const warehouseReportingService = require("../services/warehouse-reporting.service");
const { ROLES } = require("../constants/auth.constants");

const getVendorIdIfVendor = (req) => {
  if (req.user?.role === ROLES.VENDOR) {
    return req.vendor?._id || req.user?.vendorId || req.user?._id;
  }
  return null;
};

// ==========================================
// 1. STOCK RECEIVING CONTROLLERS
// ==========================================
const createReceivingRecord = asyncHandler(async (req, res) => {
  const record = await stockReceivingService.createReceivingRecord({
    ...req.body,
    actorUserId: req.user?._id || req.user?.id,
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: "Stock receiving record created successfully",
    data: record,
  });
});

const getReceivingRecord = asyncHandler(async (req, res) => {
  const record = await stockReceivingService.getReceivingRecord(req.params.id);
  return sendSuccess(res, {
    message: "Stock receiving record retrieved successfully",
    data: record,
  });
});

const listReceivingRecords = asyncHandler(async (req, res) => {
  const result = await stockReceivingService.listReceivingRecords({
    warehouseId: req.query.warehouseId,
    status: req.query.status,
    page: req.query.page,
    limit: req.query.limit,
  });

  return sendSuccess(res, {
    message: "Stock receiving records listed successfully",
    data: result,
  });
});

const updateReceivingRecord = asyncHandler(async (req, res) => {
  const record = await stockReceivingService.updateReceivingRecord(
    req.params.id,
    req.body
  );

  return sendSuccess(res, {
    message: "Stock receiving record updated successfully",
    data: record,
  });
});

const confirmReceiving = asyncHandler(async (req, res) => {
  const record = await stockReceivingService.confirmReceiving({
    receivingId: req.params.id,
    actorUserId: req.user?._id || req.user?.id,
    idempotencyKey: req.headers["idempotency-key"] || req.body?.idempotencyKey,
  });

  return sendSuccess(res, {
    message: "Stock receiving confirmed and inventory ledger updated",
    data: record,
  });
});

const cancelReceiving = asyncHandler(async (req, res) => {
  const record = await stockReceivingService.cancelReceiving({
    receivingId: req.params.id,
    actorUserId: req.user?._id || req.user?.id,
    notes: req.body?.notes,
  });

  return sendSuccess(res, {
    message: "Stock receiving record cancelled",
    data: record,
  });
});

// ==========================================
// 2. STOCK TRANSFER CONTROLLERS
// ==========================================
const createTransfer = asyncHandler(async (req, res) => {
  const transfer = await stockTransferService.createTransfer({
    ...req.body,
    requestedByUserId: req.user?._id || req.user?.id,
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: "Stock transfer draft created successfully",
    data: transfer,
  });
});

const getTransferRecord = asyncHandler(async (req, res) => {
  const transfer = await stockTransferService.getTransferRecord(req.params.id);
  return sendSuccess(res, {
    message: "Stock transfer retrieved successfully",
    data: transfer,
  });
});

const listTransfers = asyncHandler(async (req, res) => {
  const result = await stockTransferService.listTransfers({
    sourceWarehouseId: req.query.sourceWarehouseId,
    destinationWarehouseId: req.query.destinationWarehouseId,
    status: req.query.status,
    page: req.query.page,
    limit: req.query.limit,
  });

  return sendSuccess(res, {
    message: "Stock transfers listed successfully",
    data: result,
  });
});

const approveTransfer = asyncHandler(async (req, res) => {
  const transfer = await stockTransferService.approveTransfer({
    transferId: req.params.id,
    actorUserId: req.user?._id || req.user?.id,
  });

  return sendSuccess(res, {
    message: "Stock transfer approved successfully",
    data: transfer,
  });
});

const dispatchTransfer = asyncHandler(async (req, res) => {
  const transfer = await stockTransferService.dispatchTransfer({
    transferId: req.params.id,
    actorUserId: req.user?._id || req.user?.id,
    carrier: req.body?.carrier,
    trackingNumber: req.body?.trackingNumber,
  });

  return sendSuccess(res, {
    message: "Stock transfer dispatched and source inventory deducted to in-transit",
    data: transfer,
  });
});

const receiveTransfer = asyncHandler(async (req, res) => {
  const transfer = await stockTransferService.receiveTransfer({
    transferId: req.params.id,
    actorUserId: req.user?._id || req.user?.id,
    receivedItems: req.body?.receivedItems,
    notes: req.body?.notes,
  });

  return sendSuccess(res, {
    message: "Stock transfer receipt recorded and destination inventory updated",
    data: transfer,
  });
});

const cancelTransfer = asyncHandler(async (req, res) => {
  const transfer = await stockTransferService.cancelTransfer({
    transferId: req.params.id,
    actorUserId: req.user?._id || req.user?.id,
    reason: req.body?.reason,
  });

  return sendSuccess(res, {
    message: "Stock transfer cancelled successfully",
    data: transfer,
  });
});

// ==========================================
// 3. BIN / LOCATION CONTROLLERS
// ==========================================
const createLocation = asyncHandler(async (req, res) => {
  const location = await warehouseLocationService.createLocation(req.body);
  return sendSuccess(res, {
    statusCode: 201,
    message: "Warehouse location created successfully",
    data: location,
  });
});

const updateLocation = asyncHandler(async (req, res) => {
  const location = await warehouseLocationService.updateLocation(
    req.params.id,
    req.body
  );
  return sendSuccess(res, {
    message: "Warehouse location updated successfully",
    data: location,
  });
});

const listLocations = asyncHandler(async (req, res) => {
  const locations = await warehouseLocationService.listLocations({
    warehouseId: req.query.warehouseId,
    zone: req.query.zone,
    isActive: req.query.isActive !== undefined ? req.query.isActive === "true" : undefined,
  });

  return sendSuccess(res, {
    message: "Warehouse locations listed successfully",
    data: locations,
  });
});

const assignItemToLocation = asyncHandler(async (req, res) => {
  const location = await warehouseLocationService.assignItemToLocation({
    locationId: req.params.id,
    productVariantId: req.body.productVariantId,
    quantity: req.body.quantity,
  });

  return sendSuccess(res, {
    message: "Product variant assigned to location successfully",
    data: location,
  });
});

const moveItemBetweenLocations = asyncHandler(async (req, res) => {
  const result = await warehouseLocationService.moveItemBetweenLocations({
    sourceLocationId: req.body.sourceLocationId,
    destinationLocationId: req.body.destinationLocationId,
    productVariantId: req.body.productVariantId,
    quantity: req.body.quantity,
  });

  return sendSuccess(res, {
    message: "Item moved between bin locations successfully",
    data: result,
  });
});

// ==========================================
// 4. STOCK COUNTS / CYCLE COUNTING
// ==========================================
const createStockCount = asyncHandler(async (req, res) => {
  const count = await stockCountService.createStockCount({
    ...req.body,
    countedByUserId: req.user?._id || req.user?.id,
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: "Stock count audit initialized with inventory snapshot",
    data: count,
  });
});

const recordPhysicalCounts = asyncHandler(async (req, res) => {
  const count = await stockCountService.recordPhysicalCounts(
    req.params.id,
    req.body.items
  );

  return sendSuccess(res, {
    message: "Physical counts and discrepancies recorded",
    data: count,
  });
});

const reconcileAndFinalizeCount = asyncHandler(async (req, res) => {
  const count = await stockCountService.reconcileAndFinalizeCount({
    countId: req.params.id,
    actorUserId: req.user?._id || req.user?.id,
    notes: req.body?.notes,
  });

  return sendSuccess(res, {
    message: "Stock count reconciled and finalized with authoritative ledger adjustments",
    data: count,
  });
});

const cancelStockCount = asyncHandler(async (req, res) => {
  const count = await stockCountService.cancelStockCount({
    countId: req.params.id,
    actorUserId: req.user?._id || req.user?.id,
    notes: req.body?.notes,
  });

  return sendSuccess(res, {
    message: "Stock count cancelled",
    data: count,
  });
});

const getStockCount = asyncHandler(async (req, res) => {
  const count = await stockCountService.getStockCount(req.params.id);
  return sendSuccess(res, {
    message: "Stock count retrieved successfully",
    data: count,
  });
});

const listStockCounts = asyncHandler(async (req, res) => {
  const result = await stockCountService.listStockCounts({
    warehouseId: req.query.warehouseId,
    status: req.query.status,
    page: req.query.page,
    limit: req.query.limit,
  });

  return sendSuccess(res, {
    message: "Stock counts listed successfully",
    data: result,
  });
});

// ==========================================
// 5. ORDER ALLOCATION
// ==========================================
const getEligibleWarehousesForItem = asyncHandler(async (req, res) => {
  const warehouses = await orderAllocationService.getEligibleWarehousesForItem({
    productVariantId: req.params.productVariantId,
    requiredQuantity: Number(req.query.quantity) || 1,
    strategy: req.query.strategy || "deepest_stock",
  });

  return sendSuccess(res, {
    message: "Eligible warehouses for item allocation retrieved",
    data: warehouses,
  });
});

const reallocateOrderItem = asyncHandler(async (req, res) => {
  const result = await orderAllocationService.reallocateOrderItem({
    orderId: req.params.orderId,
    productVariantId: req.body.productVariantId,
    targetWarehouseId: req.body.targetWarehouseId,
    actorUserId: req.user?._id || req.user?.id,
    reason: req.body.reason,
  });

  return sendSuccess(res, {
    message: "Order item reallocated to target warehouse successfully",
    data: result,
  });
});

// ==========================================
// 6. WAREHOUSE DASHBOARD & REPORTING
// ==========================================
const getWarehouseDashboardOverview = asyncHandler(async (req, res) => {
  const vendorId = getVendorIdIfVendor(req);
  const overview = await warehouseReportingService.getWarehouseDashboardOverview({
    warehouseId: req.query.warehouseId || null,
    vendorId,
  });

  return sendSuccess(res, {
    message: "Warehouse dashboard overview retrieved",
    data: overview,
  });
});

const getWarehouseInventoryReport = asyncHandler(async (req, res) => {
  const vendorId = getVendorIdIfVendor(req);
  const report = await warehouseReportingService.getWarehouseInventoryReport({
    warehouseId: req.query.warehouseId || null,
    search: req.query.search || "",
    isLowStock: req.query.isLowStock,
    isOutOfStock: req.query.isOutOfStock,
    page: req.query.page,
    limit: req.query.limit,
    vendorId,
  });

  return sendSuccess(res, {
    message: "Warehouse inventory report retrieved",
    data: report,
  });
});

const getWarehouseMovementHistory = asyncHandler(async (req, res) => {
  const vendorId = getVendorIdIfVendor(req);
  const history = await warehouseReportingService.getWarehouseMovementHistory({
    warehouseId: req.query.warehouseId || null,
    type: req.query.type || null,
    dateFrom: req.query.dateFrom || null,
    dateTo: req.query.dateTo || null,
    page: req.query.page,
    limit: req.query.limit,
    vendorId,
  });

  return sendSuccess(res, {
    message: "Warehouse movement history ledger retrieved",
    data: history,
  });
});

module.exports = {
  createReceivingRecord,
  getReceivingRecord,
  listReceivingRecords,
  updateReceivingRecord,
  confirmReceiving,
  cancelReceiving,

  createTransfer,
  getTransferRecord,
  listTransfers,
  approveTransfer,
  dispatchTransfer,
  receiveTransfer,
  cancelTransfer,

  createLocation,
  updateLocation,
  listLocations,
  assignItemToLocation,
  moveItemBetweenLocations,

  createStockCount,
  recordPhysicalCounts,
  reconcileAndFinalizeCount,
  cancelStockCount,
  getStockCount,
  listStockCounts,

  getEligibleWarehousesForItem,
  reallocateOrderItem,

  getWarehouseDashboardOverview,
  getWarehouseInventoryReport,
  getWarehouseMovementHistory,
};
