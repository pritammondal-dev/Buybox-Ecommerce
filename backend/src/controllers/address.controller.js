const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const addressService = require("../services/address.service");

const getAddresses = asyncHandler(async (req, res) => {
  const addresses = await addressService.getMyAddresses(
    req.user.id
  );

  return sendSuccess(res, {
    message: "Addresses retrieved successfully",
    data: {
      addresses,
    },
  });
});

const getAddress = asyncHandler(async (req, res) => {
  const address = await addressService.getMyAddress(
    req.user.id,
    req.params.id
  );

  return sendSuccess(res, {
    message: "Address retrieved successfully",
    data: {
      address,
    },
  });
});

const createAddress = asyncHandler(async (req, res) => {
  const address = await addressService.createAddress(
    req.user.id,
    req.body
  );

  return sendSuccess(res, {
    statusCode: 201,
    message: "Address created successfully",
    data: {
      address,
    },
  });
});

const updateAddress = asyncHandler(async (req, res) => {
  const address = await addressService.updateAddress(
    req.user.id,
    req.params.id,
    req.body
  );

  return sendSuccess(res, {
    message: "Address updated successfully",
    data: {
      address,
    },
  });
});

const deleteAddress = asyncHandler(async (req, res) => {
  await addressService.deleteAddress(
    req.user.id,
    req.params.id
  );

  return sendSuccess(res, {
    message: "Address deleted successfully",
    data: null,
  });
});

module.exports = {
  getAddresses,
  getAddress,
  createAddress,
  updateAddress,
  deleteAddress,
};