const express = require("express");

const productController = require("../controllers/product.controller");
const authenticate = require("../middlewares/authentication.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");

const { PERMISSIONS } = require("../constants/permissions.constants");
const { adminSensitiveOpLimiter } = require("../middlewares/rate-limiter.middleware");
const {
  createProductSchema,
} = require("../validators/catalog/product.validator");

const {
  updateProductSchema,
} = require("../validators/catalog/update-product.validator");
const {
  rejectProductSchema,
} = require("../validators/catalog/moderate-product.validator");

const multer = require("multer");
const {
  requireVendorSession,
  requireApprovedVendor,
} = require("../middlewares/vendor.middleware");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1,
  },
});

const router = express.Router();

// Vendor self-service (must precede /:id)
router.get(
  "/vendor/my",
  authenticate,
  requireVendorSession,
  requirePermissions(PERMISSIONS.PRODUCTS_READ),
  productController.listMyProducts
);

router.get(
  "/vendor/import/template",
  authenticate,
  requireApprovedVendor,
  productController.downloadImportTemplate
);

router.post(
  "/vendor/import/validate",
  authenticate,
  requireApprovedVendor,
  upload.single("file"),
  productController.validateBulkImport
);

router.post(
  "/vendor/import/commit",
  authenticate,
  requireApprovedVendor,
  productController.commitBulkImport
);

router.get(
  "/vendor/export",
  authenticate,
  requireApprovedVendor,
  productController.exportMyProducts
);

router.post(
  "/vendor/import/errors/download",
  authenticate,
  requireApprovedVendor,
  productController.downloadErrorReport
);

router.get(
  "/vendor/inventory/export",
  authenticate,
  requireApprovedVendor,
  productController.exportInventory
);

router.patch(
  "/vendor/bulk-update",
  authenticate,
  requireApprovedVendor,
  productController.bulkUpdatePricesAndStock
);

router.get(
  "/vendor/import/jobs",
  authenticate,
  requireApprovedVendor,
  productController.listJobs
);

router.get(
  "/vendor/import/jobs/:jobId",
  authenticate,
  requireApprovedVendor,
  productController.getJob
);

// Admin bulk import/export
router.get(
  "/admin/import/template",
  authenticate,
  requirePermissions(PERMISSIONS.PRODUCTS_CREATE),
  productController.downloadImportTemplate
);

router.post(
  "/admin/import/validate",
  authenticate,
  adminSensitiveOpLimiter,
  requirePermissions(PERMISSIONS.PRODUCTS_CREATE),
  upload.single("file"),
  productController.validateBulkImport
);

router.post(
  "/admin/import/commit",
  authenticate,
  adminSensitiveOpLimiter,
  requirePermissions(PERMISSIONS.PRODUCTS_CREATE),
  productController.commitBulkImport
);

router.get(
  "/admin/export",
  authenticate,
  adminSensitiveOpLimiter,
  requirePermissions(PERMISSIONS.PRODUCTS_EXPORT),
  productController.exportMyProducts
);

router.post(
  "/admin/import/errors/download",
  authenticate,
  requirePermissions(PERMISSIONS.PRODUCTS_CREATE),
  productController.downloadErrorReport
);

router.get(
  "/admin/inventory/export",
  authenticate,
  requirePermissions(PERMISSIONS.PRODUCTS_EXPORT),
  productController.exportInventory
);

router.patch(
  "/admin/bulk-update",
  authenticate,
  requirePermissions(PERMISSIONS.PRODUCTS_UPDATE),
  productController.bulkUpdatePricesAndStock
);

router.get(
  "/admin/import/jobs",
  authenticate,
  requirePermissions(PERMISSIONS.PRODUCTS_READ),
  productController.listJobs
);

router.get(
  "/admin/import/jobs/:jobId",
  authenticate,
  requirePermissions(PERMISSIONS.PRODUCTS_READ),
  productController.getJob
);

// Public
router.get("/", productController.listProducts);
router.get("/recommendations", productController.getRecommendations);
router.get("/:id/related", productController.getRelatedProducts);
router.get("/slug/:slug", productController.getProductBySlug);
router.get("/:id", productController.getProduct);

// Duplicate product
router.post(
  "/:id/duplicate",
  authenticate,
  requirePermissions(PERMISSIONS.PRODUCTS_CREATE),
  productController.duplicateProduct
);

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