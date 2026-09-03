const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const brandService = require("../services/brand.service");

const createBrand = asyncHandler(async (req, res) => {
  const brand = await brandService.createBrand(req.body);

  return sendSuccess(res, {
    statusCode: 201,
    message: "Brand created successfully",
    data: { brand },
  });
});

const getBrand = asyncHandler(async (req, res) => {
  const brand = await brandService.getBrandById(
    req.params.id
  );

  return sendSuccess(res, {
    message: "Brand retrieved successfully",
    data: { brand },
  });
});

const listBrands = asyncHandler(async (req, res) => {
  const result = await brandService.listBrands(req.query);

  return sendSuccess(res, {
    message: "Brands retrieved successfully",
    data: result.items,
    meta: result.meta,
  });
});

const updateBrand = asyncHandler(async (req, res) => {
  const brand = await brandService.updateBrand(
    req.params.id,
    req.body
  );

  return sendSuccess(res, {
    message: "Brand updated successfully",
    data: { brand },
  });
});

const deleteBrand = asyncHandler(async (req, res) => {
  await brandService.deleteBrand(req.params.id);

  return sendSuccess(res, {
    message: "Brand deleted successfully",
    data: null,
  });
});

module.exports = {
  createBrand,
  getBrand,
  listBrands,
  updateBrand,
  deleteBrand,
};