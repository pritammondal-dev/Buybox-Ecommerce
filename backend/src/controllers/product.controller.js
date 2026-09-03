const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const productService = require("../services/product.service");

const createProduct = asyncHandler(async (req, res) => {
  const product = await productService.createProduct({
    data: req.body,
    vendorId: req.user.id,
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: "Product created successfully",
    data: { product },
  });
});

const getProduct = asyncHandler(async (req, res) => {
  const product = await productService.getProductById(
    req.params.id
  );

  return sendSuccess(res, {
    message: "Product retrieved successfully",
    data: { product },
  });
});

const getProductBySlug = asyncHandler(async (req, res) => {
  const product = await productService.getProductBySlug(
    req.params.slug
  );

  return sendSuccess(res, {
    message: "Product retrieved successfully",
    data: { product },
  });
});

const listProducts = asyncHandler(async (req, res) => {
  const result = await productService.listProducts(
    req.query
  );

  return sendSuccess(res, {
    message: "Products retrieved successfully",
    data: result.items,
    meta: result.meta,
  });
});

const updateProduct = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct({
  id: req.params.id,
  data: req.body,
  actor: req.user,
});

  return sendSuccess(res, {
    message: "Product updated successfully",
    data: { product },
  });
});

const deleteProduct = asyncHandler(async (req, res) => {
  await productService.deleteProduct({
  id: req.params.id,
  actor: req.user,
});

  return sendSuccess(res, {
    message: "Product deleted successfully",
    data: null,
  });
});

module.exports = {
  createProduct,
  getProduct,
  getProductBySlug,
  listProducts,
  updateProduct,
  deleteProduct,
};