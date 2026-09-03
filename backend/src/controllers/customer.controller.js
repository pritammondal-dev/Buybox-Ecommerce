const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const customerService = require("../services/customer.service");

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

module.exports = {
  getMyProfile,
  createMyProfile,
  updateMyProfile,
};