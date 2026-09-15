const express = require("express");

const productController = require("../controllers/product.controller");
const authenticate = require("../middlewares/authentication.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");

const { PERMISSIONS } = require("../constants/permissions.constants");
const {
  createProductSchema,
} = require("../validators/catalog/product.validator");

const {
  updateProductSchema,
} = require("../validators/catalog/update-product.validator");
const {
  rejectProductSchema,
} = require("../validators/catalog/moderate-product.validator");

const router = express.Router();

// Vendor self-service (must precede /:id)
router.get(
  "/vendor/my",
  authenticate,
  requirePermissions(PERMISSIONS.PRODUCTS_READ),
  productController.listMyProducts
);

// Public
router.get("/", productController.listProducts);
router.get("/slug/:slug", productController.getProductBySlug);
router.get("/:id", productController.getProduct);

// Vendor/Admin
router.post(
  "/",
  authenticate,
  requirePermissions(PERMISSIONS.PRODUCTS_CREATE),
  validate(createProductSchema),
  productController.createProduct
);

router.post(
  "/:id/submit",
  authenticate,
  requirePermissions(PERMISSIONS.PRODUCTS_UPDATE),
  productController.submitProductForApproval
);

router.patch(
  "/:id/approve",
  authenticate,
  requirePermissions(PERMISSIONS.PRODUCTS_MODERATE),
  productController.approveProduct
);

router.patch(
  "/:id/reject",
  authenticate,
  requirePermissions(PERMISSIONS.PRODUCTS_MODERATE),
  validate(rejectProductSchema),
  productController.rejectProduct
);

router.delete(
  "/:id",
  authenticate,
  requirePermissions(PERMISSIONS.PRODUCTS_DELETE),
  productController.deleteProduct
);

router.patch(
  "/:id",
  authenticate,
  requirePermissions(PERMISSIONS.PRODUCTS_UPDATE),
  validate(updateProductSchema),
  productController.updateProduct
);

module.exports = router;