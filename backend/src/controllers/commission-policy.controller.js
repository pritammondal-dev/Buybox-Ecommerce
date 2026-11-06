const commissionService = require("../services/commission.service");
const apiResponse = require("../utils/apiResponse");

const createPolicy = async (req, res) => {
  const actorId = req.user?._id || req.user?.id;
  const ipAddress = req.ip || req.connection?.remoteAddress || null;
  const userAgent = req.headers ? req.headers["user-agent"] : null;

  const policy = await commissionService.createPolicy({
    ...req.body,
    actorId,
    ipAddress,
    userAgent,
  });

  return apiResponse.sendSuccess(res, {
    statusCode: 201,
    message: "Commission policy created successfully",
    data: policy,
  });
};

const updatePolicy = async (req, res) => {
  const actorId = req.user?._id || req.user?.id;
  const ipAddress = req.ip || req.connection?.remoteAddress || null;
  const userAgent = req.headers ? req.headers["user-agent"] : null;

  const policy = await commissionService.updatePolicy(req.params.policyId, {
    ...req.body,
    actorId,
    ipAddress,
    userAgent,
  });

  return apiResponse.sendSuccess(res, {
    statusCode: 200,
    message: "Commission policy updated successfully",
    data: policy,
  });
};

const togglePolicyStatus = async (req, res) => {
  const actorId = req.user?._id || req.user?.id;
  const ipAddress = req.ip || req.connection?.remoteAddress || null;
  const userAgent = req.headers ? req.headers["user-agent"] : null;

  const policy = await commissionService.togglePolicyStatus(req.params.policyId, {
    ...req.body,
    actorId,
    ipAddress,
    userAgent,
  });

  return apiResponse.sendSuccess(res, {
    statusCode: 200,
    message: `Commission policy ${policy.isActive ? "activated" : "deactivated"} successfully`,
    data: policy,
  });
};

const deletePolicy = async (req, res) => {
  const actorId = req.user?._id || req.user?.id;
  const ipAddress = req.ip || req.connection?.remoteAddress || null;
  const userAgent = req.headers ? req.headers["user-agent"] : null;

  const policy = await commissionService.deletePolicy(req.params.policyId, {
    notes: req.body?.notes,
    actorId,
    ipAddress,
    userAgent,
  });

  return apiResponse.sendSuccess(res, {
    statusCode: 200,
    message: "Commission policy deleted successfully",
    data: policy,
  });
};

const getPolicyById = async (req, res) => {
  const policy = await commissionService.getPolicyById(req.params.policyId);

  return apiResponse.sendSuccess(res, {
    statusCode: 200,
    message: "Commission policy retrieved successfully",
    data: policy,
  });
};

const listPolicies = async (req, res) => {
  const { scope, isActive, page, limit, search } = req.query;

  const result = await commissionService.listPolicies({
    scope: scope || null,
    isActive: isActive !== undefined ? isActive === "true" || isActive === true : null,
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : 20,
    search: search || null,
  });

  return apiResponse.sendSuccess(res, {
    statusCode: 200,
    message: "Commission policies retrieved successfully",
    data: result.items,
    meta: result.meta,
  });
};

const resolvePolicy = async (req, res) => {
  const { productId, vendorId, categoryId, targetDate } = req.body;

  const resolved = await commissionService.resolveCommissionPolicy({
    productId: productId || null,
    vendorId: vendorId || null,
    categoryId: categoryId || null,
    targetDate: targetDate || new Date(),
  });

  return apiResponse.sendSuccess(res, {
    statusCode: 200,
    message: "Commission policy resolved successfully",
    data: resolved,
  });
};

const previewPolicyCalculation = async (req, res) => {
  const { productId, vendorId, categoryId, amount, currency, targetDate } = req.body;

  const preview = await commissionService.previewCommissionCalculation({
    productId: productId || null,
    vendorId: vendorId || null,
    categoryId: categoryId || null,
    amount,
    currency: currency || "INR",
    targetDate: targetDate || new Date(),
  });

  return apiResponse.sendSuccess(res, {
    statusCode: 200,
    message: "Commission calculation preview computed successfully",
    data: preview,
  });
};

module.exports = {
  createPolicy,
  updatePolicy,
  togglePolicyStatus,
  deletePolicy,
  getPolicyById,
  listPolicies,
  resolvePolicy,
  previewPolicyCalculation,
};

