const shipmentService = require("../services/shipment.service");
const apiResponse = require("../utils/apiResponse");

/*
 * Vendor shipment creation.
 *
 * The service uses req.user.id to resolve the
 * authenticated user's Vendor profile and enforce
 * vendor ownership.
 */
const createVendorShipment = async (
  req,
  res
) => {
  const shipment =
    await shipmentService.createShipment({
      orderId: req.body.orderId,
      carrier: req.body.carrier,
      serviceLevel: req.body.serviceLevel,
      idempotencyKey:
        req.get("Idempotency-Key"),
      userId: req.user.id,
    });

  return apiResponse.sendSuccess(res, {
    statusCode: 201,
    message: "Shipment created successfully",
    data: shipment,
  });
};

/*
 * Admin / manager shipment creation.
 *
 * No vendor userId is passed because privileged
 * users are not required to have a Vendor profile.
 */
const createShipment = async (
  req,
  res
) => {
  const shipment =
    await shipmentService.createShipment({
      orderId: req.body.orderId,
      carrier: req.body.carrier,
      serviceLevel: req.body.serviceLevel,
      idempotencyKey:
        req.get("Idempotency-Key"),
    });

  return apiResponse.sendSuccess(res, {
    statusCode: 201,
    message: "Shipment created successfully",
    data: shipment,
  });
};

/*
 * Vendor shipment lifecycle.
 */
const transitionVendorShipmentStatus = async (
  req,
  res
) => {
  const shipment =
    await shipmentService.transitionShipmentStatus({
      shipmentId: req.params.shipmentId,
      nextStatus: req.body.status,
      trackingNumber:
        req.body.trackingNumber,
      trackingUrl:
        req.body.trackingUrl,
      failureReason:
        req.body.failureReason,
      userId: req.user.id,
    });

  return apiResponse.sendSuccess(res, {
    message:
      "Shipment status updated successfully",
    data: shipment,
  });
};

/*
 * Admin / manager shipment lifecycle.
 */
const transitionShipmentStatus = async (
  req,
  res
) => {
  const shipment =
    await shipmentService.transitionShipmentStatus({
      shipmentId: req.params.shipmentId,
      nextStatus: req.body.status,
      trackingNumber:
        req.body.trackingNumber,
      trackingUrl:
        req.body.trackingUrl,
      failureReason:
        req.body.failureReason,
    });

  return apiResponse.sendSuccess(res, {
    message:
      "Shipment status updated successfully",
    data: shipment,
  });
};

const getShipmentById = async (
  req,
  res
) => {
  const shipment =
    await shipmentService.getShipmentById(
      req.params.shipmentId
    );

  return apiResponse.sendSuccess(res, {
    message: "Shipment retrieved successfully",
    data: shipment,
  });
};

const getShipmentsByOrderId = async (
  req,
  res
) => {
  const shipments =
    await shipmentService.getShipmentsByOrderId(
      req.params.orderId
    );

  return apiResponse.sendSuccess(res, {
    message:
      "Order shipments retrieved successfully",
    data: shipments,
  });
};

const getShipmentsByVendorId = async (
  req,
  res
) => {
  const shipments =
    await shipmentService.getShipmentsByVendorId(
      req.params.vendorId
    );

  return apiResponse.sendSuccess(res, {
    message:
      "Vendor shipments retrieved successfully",
    data: shipments,
  });
};

const getShipmentsByWarehouseId = async (
  req,
  res
) => {
  const shipments =
    await shipmentService.getShipmentsByWarehouseId(
      req.params.warehouseId
    );

  return apiResponse.sendSuccess(res, {
    message:
      "Warehouse shipments retrieved successfully",
    data: shipments,
  });
};

const getShipmentByTrackingNumber = async (
  req,
  res
) => {
  const shipment =
    await shipmentService.getShipmentByTrackingNumber(
      req.params.trackingNumber
    );

  return apiResponse.sendSuccess(res, {
    message: "Shipment retrieved successfully",
    data: shipment,
  });
};

/*
 * Customer self-service
 */

const getMyShipments = async (
  req,
  res
) => {
  const shipments =
    await shipmentService.getCustomerShipments(
      req.user.id
    );

  return apiResponse.sendSuccess(res, {
    message:
      "Your shipments retrieved successfully",
    data: shipments,
  });
};

const getMyShipmentById = async (
  req,
  res
) => {
  const shipment =
    await shipmentService.getCustomerShipmentById(
      req.params.shipmentId,
      req.user.id
    );

  return apiResponse.sendSuccess(res, {
    message: "Shipment retrieved successfully",
    data: shipment,
  });
};

/*
 * Vendor self-service
 */

const getMyVendorShipments = async (
  req,
  res
) => {
  const shipments =
    await shipmentService.getMyVendorShipments(
      req.user.id
    );

  return apiResponse.sendSuccess(res, {
    message:
      "Your vendor shipments retrieved successfully",
    data: shipments,
  });
};

const getMyVendorShipmentById = async (
  req,
  res
) => {
  const shipment =
    await shipmentService.getVendorShipmentById(
      req.params.shipmentId,
      req.user.id
    );

  return apiResponse.sendSuccess(res, {
    message:
      "Vendor shipment retrieved successfully",
    data: shipment,
  });
};

module.exports = {
  createShipment,
  createVendorShipment,
  transitionShipmentStatus,
  transitionVendorShipmentStatus,
  getShipmentById,
  getShipmentsByOrderId,
  getShipmentsByVendorId,
  getShipmentsByWarehouseId,
  getShipmentByTrackingNumber,
  getMyShipments,
  getMyShipmentById,
  getMyVendorShipments,
  getMyVendorShipmentById,
};