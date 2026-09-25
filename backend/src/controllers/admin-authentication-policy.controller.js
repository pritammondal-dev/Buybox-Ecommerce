const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const authenticationPolicyService = require("../services/authentication-policy.service");

/**
 * Superadmin / Admin: Retrieve current login methods policy with live provider readiness.
 * GET /api/v1/admin/authentication/login-methods
 */
const getLoginMethods = asyncHandler(async (req, res) => {
  const data = await authenticationPolicyService.getAdminPolicyWithReadiness();

  return sendSuccess(res, {
    statusCode: 200,
    message: "Authentication login methods retrieved successfully",
    data,
  });
});

/**
 * Superadmin / Admin: Update customer login methods policy.
 * PATCH /api/v1/admin/authentication/login-methods
 */
const updateLoginMethods = asyncHandler(async (req, res) => {
  const data = await authenticationPolicyService.updatePolicy({
    updates: req.body,
    actorUser: req.user,
    ipAddress: req.ip,
    userAgent: req.get("user-agent") || null,
  });

  return sendSuccess(res, {
    statusCode: 200,
    message: "Authentication login methods updated successfully",
    data,
  });
});

module.exports = {
  getLoginMethods,
  updateLoginMethods,
};
