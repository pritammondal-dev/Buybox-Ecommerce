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

module.exports = {
  createProductVariant,
  getProductVariant,
  listProductVariants,
  updateProductVariant,
  deleteProductVariant,
};