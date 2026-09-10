const express = require("express");

const wishlistController = require("../controllers/wishlist.controller");
const authenticate = require("../middlewares/authentication.middleware");
const validate = require("../middlewares/validate.middleware");

const {
  addWishlistItemSchema,
  wishlistItemIdParamsSchema,
} = require("../validators/wishlist/wishlist.validator");

const router = express.Router();

router.use(authenticate);

router.get("/", wishlistController.getWishlist);

router.post(
  "/items",
  validate(addWishlistItemSchema),
  wishlistController.addItem
);

router.delete(
  "/items/:itemId",
  validate(wishlistItemIdParamsSchema, "params"),
  wishlistController.removeItem
);

router.delete("/", wishlistController.clearWishlist);

module.exports = router;
