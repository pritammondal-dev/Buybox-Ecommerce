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
      warehouseId: req.body.warehouseId,
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
      vendorId: req.body.vendorId,
      warehouseId: req.body.warehouseId,
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
      carrier: req.body.carrier,
      serviceLevel: req.body.serviceLevel,
      trackingNumber: req.body.trackingNumber || req.body.awbNumber,
      awbNumber: req.body.awbNumber || req.body.trackingNumber,
      trackingUrl: req.body.trackingUrl,
      failureReason: req.body.failureReason,
      notes: req.body.notes,
      reason: req.body.reason,
      location: req.body.location,
      expectedPreviousStatus: req.body.expectedPreviousStatus,
      expectedVersion: req.body.expectedVersion,
      userId: req.user.id,
      actorUser: req.user,
      req,
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
      carrier: req.body.carrier,
      serviceLevel: req.body.serviceLevel,
      trackingNumber: req.body.trackingNumber,
      trackingUrl: req.body.trackingUrl,
      failureReason: req.body.failureReason,
      notes: req.body.notes,
      reason: req.body.reason,
      expectedPreviousStatus: req.body.expectedPreviousStatus,
      expectedVersion: req.body.expectedVersion,
      isOverride: req.body.isOverride,
      overrideReason: req.body.overrideReason,
      actorUser: req.user,
      req,
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
      req.params.trackingNumber,
      req.user
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

const getMyShipmentsByOrderId = async (
  req,
  res
) => {
  const shipments =
    await shipmentService.getCustomerShipmentsByOrderId(
      req.params.orderId,
      req.user.id
    );

  return apiResponse.sendSuccess(res, {
    message: "Order shipments retrieved successfully",
    data: shipments,
  });
};

/*
 * Vendor self-service
 */

const getMyVendorShipments = async (
  req,
  res
) => {
  const result =
    await shipmentService.getMyVendorShipments(
      req.user.id,
      req.query
    );

  if (result && Array.isArray(result.items)) {
    return apiResponse.sendSuccess(res, {
      message:
        "Your vendor shipments retrieved successfully",
      data: result.items,
      meta: result.meta,
    });
  }

  return apiResponse.sendSuccess(res, {
    message:
      "Your vendor shipments retrieved successfully",
    data: result,
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

const listAllShipments = async (req, res, next) => {
  try {
    const result = await shipmentService.listAllShipments(req.query);
    return apiResponse.sendSuccess(res, {
      message: "Shipments retrieved successfully",
      data: result.items,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
};


/*
 * Phase VD-06: Operational Controller Handlers
 */
const scheduleVendorShipmentPickup = async (req, res) => {
  const shipment = await shipmentService.scheduleShipmentPickup({
    shipmentId: req.params.shipmentId,
    scheduledDate: req.body.scheduledDate,
    timeSlot: req.body.timeSlot,
    notes: req.body.notes,
    userId: req.user.id,
    actorUser: req.user,
  });

  return apiResponse.sendSuccess(res, {
    message: "Carrier pickup scheduled successfully",
    data: shipment,
  });
};

const scheduleShipmentPickup = async (req, res) => {
  const shipment = await shipmentService.scheduleShipmentPickup({
    shipmentId: req.params.shipmentId,
    scheduledDate: req.body.scheduledDate,
    timeSlot: req.body.timeSlot,
    notes: req.body.notes,
    actorUser: req.user,
  });

  return apiResponse.sendSuccess(res, {
    message: "Carrier pickup scheduled successfully",
    data: shipment,
  });
};

const getVendorShipmentLabel = async (req, res) => {
  const result = await shipmentService.generateShipmentLabel({
    shipmentId: req.params.shipmentId,
    userId: req.user.id,
    actorUser: req.user,
  });

  return apiResponse.sendSuccess(res, {
    message: "Shipping label generated successfully",
    data: result,
  });
};

const getShipmentLabel = async (req, res) => {
  const result = await shipmentService.generateShipmentLabel({
    shipmentId: req.params.shipmentId,
    actorUser: req.user,
  });

  return apiResponse.sendSuccess(res, {
    message: "Shipping label generated successfully",
    data: result,
  });
};

const cancelVendorShipment = async (req, res) => {
  const shipment = await shipmentService.cancelShipment({
    shipmentId: req.params.shipmentId,
    reason: req.body.reason,
    userId: req.user.id,
    actorUser: req.user,
  });

  return apiResponse.sendSuccess(res, {
    message: "Shipment cancelled successfully",
    data: shipment,
  });
};

const cancelShipment = async (req, res) => {
  const shipment = await shipmentService.cancelShipment({
    shipmentId: req.params.shipmentId,
    reason: req.body.reason,
    actorUser: req.user,
  });

  return apiResponse.sendSuccess(res, {
    message: "Shipment cancelled successfully",
    data: shipment,
  });
};

const checkServiceability = async (req, res) => {
  const result = await shipmentService.checkServiceability({
    provider: req.query.provider,
    originPostalCode: req.query.originPostalCode,
    destinationPostalCode: req.query.destinationPostalCode,
    weightGrams: req.query.weightGrams ? Number(req.query.weightGrams) : 500,
  });

  return apiResponse.sendSuccess(res, {
    message: "Serviceability checked successfully",
    data: result,
  });
};

const retryVendorCarrierBooking = async (req, res) => {
  const shipment = await shipmentService.retryCarrierBooking({
    shipmentId: req.params.shipmentId,
    userId: req.user.id,
    actorRole: "vendor",
  });

  return apiResponse.sendSuccess(res, {
    message: shipment.status === "booked" ? "Shipment booked with carrier successfully" : "Carrier booking attempted",
    data: shipment,
  });
};

const retryCarrierBooking = async (req, res) => {
  const shipment = await shipmentService.retryCarrierBooking({
    shipmentId: req.params.shipmentId,
    userId: req.user.id,
    actorRole: "admin",
  });

  return apiResponse.sendSuccess(res, {
    message: shipment.status === "booked" ? "Shipment booked with carrier successfully" : "Carrier booking attempted",
    data: shipment,
  });
};

const receiveAndInspectRtoShipment = async (req, res) => {
  const shipment = await shipmentService.receiveAndInspectRtoShipment({
    shipmentId: req.params.shipmentId || req.params.id,
    outcome: req.body?.outcome || "resellable",
    condition: req.body?.condition || "unopened",
    notes: req.body?.notes || "",
    userId: req.user.id || req.user._id,
    actorUser: req.user,
    isAdmin: true,
  });

  return apiResponse.sendSuccess(res, {
    message: "RTO shipment received and inspected successfully",
    data: shipment,
  });
};

const vendorReceiveAndInspectRtoShipment = async (req, res) => {
  const shipment = await shipmentService.receiveAndInspectRtoShipment({
    shipmentId: req.params.shipmentId || req.params.id,
    outcome: req.body?.outcome || "resellable",
    condition: req.body?.condition || "unopened",
    notes: req.body?.notes || "",
    userId: req.user.id || req.user._id,
    actorUser: req.user,
    isAdmin: false,
  });

  return apiResponse.sendSuccess(res, {
    message: "RTO shipment received and inspected successfully",
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
  getMyShipmentsByOrderId,
  getMyVendorShipments,
  getMyVendorShipmentById,
  listAllShipments,
  scheduleVendorShipmentPickup,
  scheduleShipmentPickup,
  getVendorShipmentLabel,
  getShipmentLabel,
  cancelVendorShipment,
  cancelShipment,
  checkServiceability,
  retryVendorCarrierBooking,
  retryCarrierBooking,
  receiveAndInspectRtoShipment,
  vendorReceiveAndInspectRtoShipment,
};