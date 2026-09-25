const returnRequestService = require("../services/return-request.service");
const apiResponse = require("../utils/apiResponse");

const createReturn = async (req, res) => {
  const newReturn = await returnRequestService.createReturnRequest({
    userId: req.user.id,
    orderId: req.body.orderId,
    type: req.body.type,
    items: req.body.items,
    customerNotes: req.body.customerNotes,
    replacementVariantId: req.body.replacementVariantId,
  });

  return apiResponse.sendSuccess(res, {
    statusCode: 201,
    message: "Return request submitted successfully",
    data: newReturn,
  });
};

const getMyReturns = async (req, res) => {
  const returns = await returnRequestService.getCustomerReturns(req.user.id);

  return apiResponse.sendSuccess(res, {
    message: "Return requests retrieved successfully",
    data: returns,
  });
};

const getReturnsByOrderId = async (req, res) => {
  const returns = await returnRequestService.getReturnByOrderId(
    req.params.orderId,
    req.user.id
  );

  return apiResponse.sendSuccess(res, {
    message: "Order return history retrieved successfully",
    data: returns,
  });
};

const getMyVendorReturns = async (req, res) => {
  const result = await returnRequestService.getMyVendorReturns({
    userId: req.user.id,
    query: req.query,
  });

  return apiResponse.sendSuccess(res, {
    message: "Vendor return requests retrieved successfully",
    data: result.items,
    meta: result.meta,
  });
};

const getMyVendorReturnById = async (req, res) => {
  const returnReq = await returnRequestService.getMyVendorReturnById({
    userId: req.user.id,
    returnId: req.params.returnId,
  });

  return apiResponse.sendSuccess(res, {
    message: "Vendor return request retrieved successfully",
    data: returnReq,
  });
};

const approveReturn = async (req, res) => {
  const isAdmin =
    req.user?.role === "admin" ||
    req.user?.role === "super_admin" ||
    req.user?.roles?.includes?.("admin") ||
    req.user?.roles?.includes?.("super_admin");
  const returnReq = await returnRequestService.approveReturnRequest({
    userId: req.user.id || req.user._id,
    returnId: req.params.returnId || req.params.id,
    notes: req.body.notes || req.body.note,
    strict: false,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
    isAdmin,
  });

  return apiResponse.sendSuccess(res, {
    message: "Return request approved successfully",
    data: returnReq,
  });
};

const rejectReturn = async (req, res) => {
  const isAdmin =
    req.user?.role === "admin" ||
    req.user?.role === "super_admin" ||
    req.user?.roles?.includes?.("admin") ||
    req.user?.roles?.includes?.("super_admin");
  const returnReq = await returnRequestService.rejectReturnRequest({
    userId: req.user.id || req.user._id,
    returnId: req.params.returnId || req.params.id,
    reason: req.body.reason || req.body.note || "Rejected by administrator",
    strict: false,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
    isAdmin,
  });

  return apiResponse.sendSuccess(res, {
    message: "Return request rejected successfully",
    data: returnReq,
  });
};

const receiveReturn = async (req, res) => {
  const isAdmin =
    req.user?.role === "admin" ||
    req.user?.role === "super_admin" ||
    req.user?.roles?.includes?.("admin") ||
    req.user?.roles?.includes?.("super_admin");
  const returnReq = await returnRequestService.receiveReturnAndRestock({
    userId: req.user.id || req.user._id,
    returnId: req.params.returnId || req.params.id,
    warehouseId: req.body.warehouseId,
    notes: req.body.notes || req.body.note,
    strict: false,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
    isAdmin,
  });

  return apiResponse.sendSuccess(res, {
    message: "Return received and restocked successfully",
    data: returnReq,
  });
};

const refundReturn = async (req, res) => {
  const isAdmin = req.user?.role === "admin" || req.user?.roles?.includes?.("admin");
  const returnReq = await returnRequestService.processReturnRefund({
    userId: req.user.id,
    returnId: req.params.returnId || req.params.id,
    notes: req.body.notes,
    strict: !isAdmin,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
    isAdmin,
  });

  return apiResponse.sendSuccess(res, {
    message: "Return refund processed successfully",
    data: returnReq,
  });
};

const getAdminReturns = async (req, res) => {
  const result = await returnRequestService.getAdminReturns({
    query: req.query,
  });

  return apiResponse.sendSuccess(res, {
    message: "Admin return requests retrieved successfully",
    data: result.items,
    meta: result.meta,
  });
};

const getAdminReturnById = async (req, res) => {
  const returnReq = await returnRequestService.getAdminReturnById(req.params.id);

  return apiResponse.sendSuccess(res, {
    message: "Return request details retrieved successfully",
    data: returnReq,
  });
};

module.exports = {
  createReturn,
  getMyReturns,
  getReturnsByOrderId,
  getMyVendorReturns,
  getMyVendorReturnById,
  approveReturn,
  rejectReturn,
  receiveReturn,
  refundReturn,
  getAdminReturns,
  getAdminReturnById,
};

