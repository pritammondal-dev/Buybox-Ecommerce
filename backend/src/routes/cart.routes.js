const express = require("express");

const cartController = require("../controllers/cart.controller");
const authenticate = require("../middlewares/authentication.middleware");
const validate = require("../middlewares/validate.middleware");

const {
  addCartItemSchema,
} = require("../validators/cart/add-cart-item.validator");

const {
  updateCartItemSchema,
} = require("../validators/cart/update-cart-item.validator");

const {
  cartItemVariantSchema,
} = require("../validators/cart/cart-item-variant.validator");

const router = express.Router();

router.use(authenticate);

router.get("/", cartController.getCart);

router.post(
  "/items",
  validate(addCartItemSchema),
  cartController.addItem
);

router.patch(
  "/items",
  validate(updateCartItemSchema),
  cartController.updateItemQuantity
);

router.delete(
  "/items",
  validate(cartItemVariantSchema),
  cartController.removeItem
);

router.delete(
  "/",
  cartController.clearCart
);

module.exports = router;