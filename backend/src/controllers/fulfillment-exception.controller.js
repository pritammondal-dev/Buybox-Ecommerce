const exceptionService = require("../services/fulfillment-exception.service");
const apiResponse = require("../utils/apiResponse");

/**
 * Vendor reports a fulfillment exception
 */
const createVendorException = async (req, res) => {
  const exception = await exceptionService.createException({
    userId: req.user.id || req.user._id,
    orderId: req.body.orderId,
    orderItemId: req.body.orderItemId,
    reason: req.body.reason,
    explanation: req.body.explanation,
    requestedResolution: req.body.requestedResolution,
    quantity: req.body.quantity,
  });

  return apiResponse.sendSuccess(res, {
    statusCode: 201,
    message: "Fulfillment exception reported successfully",
    data: exception,
  });
};

/**
 * Vendor lists their own exceptions
 */
const getVendorExceptions = async (req, res) => {
  const result = await exceptionService.getVendorExceptions({
    userId: req.user.id || req.user._id,
    query: req.query,
  });

  return apiResponse.sendSuccess(res, {
    message: "Fulfillment exceptions retrieved successfully",
    data: result.items,
    meta: result.meta,
  });
};

/**
 * Vendor retrieves single exception detail
 */
const getVendorExceptionById = async (req, res) => {
  const exception = await exceptionService.getVendorExceptionById({
    userId: req.user.id || req.user._id,
    exceptionId: req.params.id,
  });

  return apiResponse.sendSuccess(res, {
    message: "Fulfillment exception retrieved successfully",
    data: exception,
  });
};

/**
 * Vendor responds with clarification
 */
const clarifyVendorException = async (req, res) => {
  const exception = await exceptionService.vendorClarifyException({
    userId: req.user.id || req.user._id,
    exceptionId: req.params.id,
    notes: req.body.notes,
  });

  return apiResponse.sendSuccess(res, {
    message: "Clarification submitted successfully",
    data: exception,
  });
};

/**
 * Vendor withdraws exception
 */
const withdrawVendorException = async (req, res) => {
  const exception = await exceptionService.vendorWithdrawException({
    userId: req.user.id || req.user._id,
    exceptionId: req.params.id,
    reason: req.body.reason,
  });

  return apiResponse.sendSuccess(res, {
    message: "Fulfillment exception withdrawn successfully",
    data: exception,
  });
};

/**
 * Admin lists all exceptions
 */
const getAdminExceptions = async (req, res) => {
  const result = await exceptionService.getAdminExceptions({
    query: req.query,
  });

  return apiResponse.sendSuccess(res, {
    message: "Fulfillment exceptions queue retrieved successfully",
    data: result.items,
    meta: result.meta,
  });
};

/**
 * Admin gets exception detail
 */
const getAdminExceptionById = async (req, res) => {
  const exception = await exceptionService.getAdminExceptionById(req.params.id);

  return apiResponse.sendSuccess(res, {
    message: "Fulfillment exception detail retrieved successfully",
    data: exception,
  });
};

/**
 * Admin transitions exception state
 */
const adminTransitionException = async (req, res) => {
  const exception = await exceptionService.adminTransitionException({
    exceptionId: req.params.id,
    newStatus: req.body.status,
    notes: req.body.notes,
    actorUser: req.user,
  });

  return apiResponse.sendSuccess(res, {
    message: `Fulfillment exception status updated to '${req.body.status}'`,
    data: exception,
  });
};

/**
 * Admin approves item cancellation request
 */
const adminApproveCancellation = async (req, res) => {
  const result = await exceptionService.adminApproveCancellation({
    exceptionId: req.params.id,
    notes: req.body.notes,
    actorUser: req.user,
  });

  return apiResponse.sendSuccess(res, {
    message: "Item cancellation approved and processed successfully",
    data: result,
  });
};

module.exports = {
  createVendorException,
  getVendorExceptions,
  getVendorExceptionById,
  clarifyVendorException,
  withdrawVendorException,
  getAdminExceptions,
  getAdminExceptionById,
  adminTransitionException,
  adminApproveCancellation,
};
