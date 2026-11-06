const fulfillmentService = require("../services/fulfillment-operations.service");
const apiResponse = require("../utils/apiResponse");

/**
 * Retrieve packing slip for an order (or warehouse package)
 */
const getOrderPackingSlip = async (req, res) => {
  const orderId = req.params.orderId || req.params.id;
  const warehouseId = req.query.warehouseId || null;
  const shipmentId = req.query.shipmentId || null;

  const packingSlip = await fulfillmentService.getPackingSlip({
    orderId,
    warehouseId,
    shipmentId,
    user: req.user,
  });

  return apiResponse.sendSuccess(res, {
    message: "Packing slip generated successfully",
    data: packingSlip,
  });
};

/**
 * Retrieve packing slip for a specific shipment
 */
const getShipmentPackingSlip = async (req, res) => {
  const shipmentId = req.params.shipmentId || req.params.id;

  const packingSlip = await fulfillmentService.getPackingSlip({
    shipmentId,
    user: req.user,
  });

  return apiResponse.sendSuccess(res, {
    message: "Shipment packing slip generated successfully",
    data: packingSlip,
  });
};

/**
 * Generate grouped warehouse pick list
 */
const getPickList = async (req, res) => {
  const { warehouseId, dateFrom, dateTo, orderStatus, orderIds } = req.query;

  const parsedOrderIds = orderIds
    ? (Array.isArray(orderIds) ? orderIds : String(orderIds).split(","))
    : null;

  const pickList = await fulfillmentService.generatePickList({
    warehouseId,
    dateFrom,
    dateTo,
    orderStatus,
    orderIds: parsedOrderIds,
    user: req.user,
  });

  return apiResponse.sendSuccess(res, {
    message: "Warehouse pick list generated successfully",
    data: pickList,
  });
};

/**
 * Export warehouse pick list to CSV or XLSX
 */
const exportPickList = async (req, res) => {
  const format = req.query.format || "csv";
  const warehouseId = req.query.warehouseId || null;

  const result = await fulfillmentService.exportPickList({
    warehouseId,
    format,
    user: req.user,
  });

  res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
  res.setHeader("Content-Type", result.contentType);
  return res.send(result.buffer);
};

/**
 * Export orders to CSV or XLSX
 */
const exportOrders = async (req, res) => {
  const format = req.query.format || "csv";

  const result = await fulfillmentService.exportOrders({
    query: req.query,
    format,
    user: req.user,
  });

  res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
  res.setHeader("Content-Type", result.contentType);
  return res.send(result.buffer);
};

/**
 * Export order items to CSV or XLSX
 */
const exportOrderItems = async (req, res) => {
  const format = req.query.format || "csv";

  const result = await fulfillmentService.exportOrderItems({
    query: req.query,
    format,
    user: req.user,
  });

  res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
  res.setHeader("Content-Type", result.contentType);
  return res.send(result.buffer);
};

/**
 * Export shipments to CSV or XLSX
 */
const exportShipments = async (req, res) => {
  const format = req.query.format || "csv";

  const result = await fulfillmentService.exportShipments({
    query: req.query,
    format,
    user: req.user,
  });

  res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
  res.setHeader("Content-Type", result.contentType);
  return res.send(result.buffer);
};

module.exports = {
  getOrderPackingSlip,
  getShipmentPackingSlip,
  getPickList,
  exportPickList,
  exportOrders,
  exportOrderItems,
  exportShipments,
};
