const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const wishlistService = require("../services/wishlist.service");

const getWishlist = asyncHandler(async (req, res) => {
  const wishlist = await wishlistService.getWishlist(req.user.id);

  return sendSuccess(res, {
    message: "Wishlist retrieved successfully",
    data: wishlist,
  });
});

const addItem = asyncHandler(async (req, res) => {
  const { productId, productVariantId } = req.body;

  const wishlist = await wishlistService.addItem(req.user.id, {
    productId,
    productVariantId,
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: "Item added to wishlist successfully",
    data: wishlist,
  });
});

const removeItem = asyncHandler(async (req, res) => {
  const { itemId } = req.params;

  const wishlist = await wishlistService.removeItem(req.user.id, itemId);

  return sendSuccess(res, {
    message: "Item removed from wishlist successfully",
    data: wishlist,
  });
});

const clearWishlist = asyncHandler(async (req, res) => {
  const wishlist = await wishlistService.clearWishlist(req.user.id);

  return sendSuccess(res, {
    message: "Wishlist cleared successfully",
    data: wishlist,
  });
});

module.exports = {
  getWishlist,
  addItem,
  removeItem,
  clearWishlist,
};
