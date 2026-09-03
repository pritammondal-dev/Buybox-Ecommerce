const express = require("express");

const productVariantController = require("../controllers/product-variant.controller");

const authenticate = require("../middlewares/authentication.middleware");
const validate = require("../middlewares/validate.middleware");

const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");

const { PERMISSIONS } = require("../constants/permissions.constants");

const {
  createProductVariantSchema,
} = require("../validators/catalog/product-variant.validator");

const {
  updateProductVariantSchema,
} = require("../validators/catalog/update-product-variant.validator");

const router = express.Router();

router.use(authenticate);

// List variants for a product
router.get(
  "/product/:productId",
  requirePermissions(PERMISSIONS.PRODUCTS_READ),
  productVariantController.listProductVariants
);

// Get one variant
router.get(
  "/:id",
  requirePermissions(PERMISSIONS.PRODUCTS_READ),
  productVariantController.getProductVariant
);

// Create variant
router.post(
  "/product/:productId",
  requirePermissions(PERMISSIONS.PRODUCTS_CREATE),
  validate(createProductVariantSchema),
  productVariantController.createProductVariant
);

// Update variant
router.patch(
  "/:id",
  requirePermissions(PERMISSIONS.PRODUCTS_UPDATE),
  validate(updateProductVariantSchema),
  productVariantController.updateProductVariant
);

// Delete variant
router.delete(
  "/:id",
  requirePermissions(PERMISSIONS.PRODUCTS_DELETE),
  productVariantController.deleteProductVariant
);

module.exports = router;