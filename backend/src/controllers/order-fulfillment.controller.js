const orderFulfillmentService = require("../services/order-fulfillment.service");
const apiResponse = require("../utils/apiResponse");

const getShipmentPartners = async (req, res) => {
  const partners = orderFulfillmentService.getShipmentPartners();
  return apiResponse.sendSuccess(res, {
    message: "Supported shipment partners retrieved successfully",
    data: partners,
  });
};

const acceptVendorOrder = async (req, res) => {
  const order = await orderFulfillmentService.acceptVendorOrderItems({
    userId: req.user.id,
    orderId: req.params.orderId,
    notes: req.body.notes,
    expectedVersion: req.body.expectedVersion,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return apiResponse.sendSuccess(res, {
    message: "Order items accepted successfully",
    data: order,
  });
};

const rejectVendorOrder = async (req, res) => {
  const order = await orderFulfillmentService.rejectVendorOrderItems({
    userId: req.user.id,
    orderId: req.params.orderId,
    rejectionReason: req.body.rejectionReason || req.body.reason,
    notes: req.body.notes,
    expectedVersion: req.body.expectedVersion,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return apiResponse.sendSuccess(res, {
    message: "Order items rejected and flagged for administrative review",
    data: order,
  });
};

const updateVendorFulfillmentDetails = async (req, res) => {
  const order = await orderFulfillmentService.updateVendorFulfillmentDetails({
    userId: req.user.id,
    orderId: req.params.orderId,
    partnerId: req.body.partnerId,
    partnerName: req.body.partnerName,
    serviceCode: req.body.serviceCode,
    expectedDeliveryDate: req.body.expectedDeliveryDate,
    expectedVersion: req.body.expectedVersion,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return apiResponse.sendSuccess(res, {
    message: "Fulfillment details updated successfully",
    data: order,
  });
};

const confirmVendorFulfillment = async (req, res) => {
  const order = await orderFulfillmentService.confirmVendorFulfillment({
    userId: req.user.id,
    orderId: req.params.orderId,
    notes: req.body.notes,
    expectedVersion: req.body.expectedVersion,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return apiResponse.sendSuccess(res, {
    message: "Vendor fulfillment confirmed and moving to processing",
    data: order,
  });
};

const adminOverrideFulfillment = async (req, res) => {
  const order = await orderFulfillmentService.adminOverrideFulfillment({
    adminUser: req.user,
    orderId: req.params.id || req.params.orderId,
    vendorId: req.body.vendorId,
    action: req.body.action,
    partnerId: req.body.partnerId,
    partnerName: req.body.partnerName,
    serviceCode: req.body.serviceCode,
    expectedDeliveryDate: req.body.expectedDeliveryDate,
    expectedVersion: req.body.expectedVersion,
    overrideReason: req.body.overrideReason || req.body.reason,
    notes: req.body.notes,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return apiResponse.sendSuccess(res, {
    message: `Fulfillment overridden successfully (${req.body.action})`,
    data: order,
  });
};

module.exports = {
  getShipmentPartners,
  acceptVendorOrder,
  rejectVendorOrder,
  updateVendorFulfillmentDetails,
  confirmVendorFulfillment,
  adminOverrideFulfillment,
};

