const express = require("express");

const cartController = require("../controllers/cart.controller");
const {
  authenticate,
  authenticateGuestOrCustomer,
} = require("../middlewares/authentication.middleware");
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

// Cart routes support both authenticated customers and guest sessions
router.use(authenticateGuestOrCustomer);

router.get("/", cartController.getCart);

router.post("/recover", cartController.recoverCart);

router.post("/merge", authenticate, cartController.mergeCart);

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