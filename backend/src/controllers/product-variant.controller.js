const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");

const productVariantService = require("../services/product-variant.service");

const createProductVariant = asyncHandler(async (req, res) => {
  const variant = await productVariantService.createProductVariant({
    data: {
      ...req.body,
      productId: req.params.productId,
    },
    actor: req.user,
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: "Product variant created successfully",
    data: { variant },
  });
});

const getProductVariant = asyncHandler(async (req, res) => {
const variant = await productVariantService.getProductVariant({
  id: req.params.id,
  actor: req.user,
});

  return sendSuccess(res, {
    message: "Product variant retrieved successfully",
    data: { variant },
  });
});

const listProductVariants = asyncHandler(async (req, res) => {
  const variants =
    await productVariantService.listProductVariants({
      productId: req.params.productId,
      actor: req.user,
    });

  return sendSuccess(res, {
    message: "Product variants retrieved successfully",
    data: { variants },
  });
});

const updateProductVariant = asyncHandler(async (req, res) => {
  const variant =
    await productVariantService.updateProductVariant({
      id: req.params.id,
      data: req.body,
      actor: req.user,
    });

  return sendSuccess(res, {
    message: "Product variant updated successfully",
    data: { variant },
  });
});

const deleteProductVariant = asyncHandler(async (req, res) => {
  await productVariantService.deleteProductVariant({
    id: req.params.id,
    actor: req.user,
  });

  return sendSuccess(res, {
    message: "Product variant deleted successfully",
    data: null,
  });
});

const createBulkVariants = asyncHandler(async (req, res) => {
  const variants = await productVariantService.createBulkVariants({
    productId: req.params.productId,
    variants: req.body.variants,
    actor: req.user,
    req,
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: `${variants.length} product variants created successfully`,
    data: { variants },
  });
});

const updateBulkVariants = asyncHandler(async (req, res) => {
  const variants = await productVariantService.updateBulkVariants({
    productId: req.params.productId,
    updates: req.body.updates,
    actor: req.user,
    req,
  });

  return sendSuccess(res, {
    message: `${variants.length} product variants updated successfully`,
    data: { variants },
  });
});

const restoreProductVariant = asyncHandler(async (req, res) => {
  const variant = await productVariantService.restoreProductVariant({
    id: req.params.id,
    actor: req.user,
    req,
  });

  return sendSuccess(res, {
    message: "Product variant restored successfully",
    data: { variant },
  });
});

module.exports = {
  createProductVariant,
  getProductVariant,
  listProductVariants,
  updateProductVariant,
  deleteProductVariant,
  restoreProductVariant,
  createBulkVariants,
  updateBulkVariants,
};