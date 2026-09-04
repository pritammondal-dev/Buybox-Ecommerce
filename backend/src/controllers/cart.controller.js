const cartService = require("../services/cart.service");
const apiResponse = require("../utils/apiResponse");

const getCart = async (req, res) => {
  const cart = await cartService.getCart(req.user.id);

  return apiResponse.sendSuccess(res, {
    message: "Cart retrieved successfully",
    data: cart,
  });
};

const addItem = async (req, res) => {
  const { productVariantId, quantity } = req.body;

  const cart = await cartService.addItem(
    req.user.id,
    productVariantId,
    quantity
  );

  return apiResponse.sendSuccess(res, {
    statusCode: 201,
    message: "Item added to cart successfully",
    data: cart,
  });
};

const updateItemQuantity = async (req, res) => {
  const { productVariantId, quantity } = req.body;

  const cart = await cartService.updateItemQuantity(
    req.user.id,
    productVariantId,
    quantity
  );

  return apiResponse.sendSuccess(res, {
    message: "Cart item quantity updated successfully",
    data: cart,
  });
};

const removeItem = async (req, res) => {
  const { productVariantId } = req.body;

  const cart = await cartService.removeItem(
    req.user.id,
    productVariantId
  );

  return apiResponse.sendSuccess(res, {
    message: "Cart item removed successfully",
    data: cart,
  });
};

const clearCart = async (req, res) => {
  const cart = await cartService.clearCart(req.user.id);

  return apiResponse.sendSuccess(res, {
    message: "Cart cleared successfully",
    data: cart,
  });
};

module.exports = {
  getCart,
  addItem,
  updateItemQuantity,
  removeItem,
  clearCart,
};