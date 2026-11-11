const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const customerService = require("../services/customer.service");
const customerDeletionService = require("../services/customer-deletion.service");
const { COOKIE_NAMES, customerCookieOptions, refreshCookieOptions } = require("../config/cookie");

const getMyProfile = asyncHandler(async (req, res) => {
  const customer = await customerService.getCustomerProfile(
    req.user.id
  );

  return sendSuccess(res, {
    message: "Customer profile retrieved successfully",
    data: {
      customer,
    },
  });
});

const createMyProfile = asyncHandler(async (req, res) => {
  const customer = await customerService.createCustomerProfile(
    req.user.id,
    req.body
  );

  return sendSuccess(res, {
    statusCode: 201,
    message: "Customer profile created successfully",
    data: {
      customer,
    },
  });
});

const updateMyProfile = asyncHandler(async (req, res) => {
  const customer = await customerService.updateCustomerProfile(
    req.user.id,
    req.body
  );

  return sendSuccess(res, {
    message: "Customer profile updated successfully",
    data: {
      customer,
    },
  });
});

const deleteMyAccount = asyncHandler(async (req, res) => {
  const result = await customerDeletionService.executePermanentDeletion({
    userId: req.user.id || req.user._id,
    password: req.body?.password,
    confirmation: req.body?.confirmation,
    reason: req.body?.reason,
    req,
  });

  // Clear session and refresh cookies
  try {
    res.clearCookie(COOKIE_NAMES.CUSTOMER, customerCookieOptions);
    res.clearCookie(COOKIE_NAMES.LEGACY_REFRESH, refreshCookieOptions);
  } catch {}

  return sendSuccess(res, {
    statusCode: 200,
    message: "Customer account and personal data permanently deleted successfully",
    data: result,
  });
});

module.exports = {
  getMyProfile,
  createMyProfile,
  updateMyProfile,
  deleteMyAccount,
};