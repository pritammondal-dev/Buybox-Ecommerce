const express = require("express");

const productController = require("../controllers/product.controller");
const { authenticate, authenticateOptional, authenticateVendor } = require("../middlewares/authentication.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  requirePermissions,
  requireRoles,
} = require("../middlewares/authorization.middleware");

const { PERMISSIONS } = require("../constants/permissions.constants");
const { ROLES } = require("../constants/auth.constants");
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

const bulkImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB (supports spreadsheet + optional ZIP archive)
    files: 2,
  },
});

const router = express.Router();

// Dedicated Vendor Authenticator for merchant console routes
router.use("/vendor", authenticateVendor);

// Vendor self-service (must precede /:id)
router.get(
  "/vendor/my",
  authenticateVendor,
  requireVendorSession,
  requirePermissions(PERMISSIONS.PRODUCTS_READ),
  productController.listMyProducts
);

router.get(
  "/vendor/import/template",
  authenticateVendor,
  requireApprovedVendor,
  productController.downloadImportTemplate
);

router.post(
  "/vendor/import/validate",
  authenticateVendor,
  requireApprovedVendor,
  bulkImportUpload.fields([
    { name: "file", maxCount: 1 },
    { name: "images", maxCount: 1 },
  ]),
  productController.validateBulkImport
);

router.post(
  "/vendor/import/commit",
  authenticateVendor,
  requireApprovedVendor,
  productController.commitBulkImport
);

router.get(
  "/vendor/export",
  authenticateVendor,
  requireApprovedVendor,
  productController.exportMyProducts
);

router.post(
  "/vendor/import/errors/download",
  authenticateVendor,
  requireApprovedVendor,
  productController.downloadErrorReport
);

router.get(
  "/vendor/inventory/export",
  authenticateVendor,
  requireApprovedVendor,
  productController.exportInventory
);

router.patch(
  "/vendor/bulk-update",
  authenticateVendor,
  requireApprovedVendor,
  productController.bulkUpdatePricesAndStock
);

router.get(
  "/vendor/import/jobs",
  authenticateVendor,
  requireApprovedVendor,
  productController.listJobs
);

router.get(
  "/vendor/import/jobs/:jobId",
  authenticateVendor,
  requireApprovedVendor,
  productController.getJob
);

// Admin bulk import/export
router.get(
  "/admin/import/template",
  authenticate,
  requireRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  requirePermissions(PERMISSIONS.PRODUCTS_CREATE),
  productController.downloadImportTemplate
);

router.post(
  "/admin/import/validate",
  authenticate,
  adminSensitiveOpLimiter,
  requireRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  requirePermissions(PERMISSIONS.PRODUCTS_CREATE),
  bulkImportUpload.fields([
    { name: "file", maxCount: 1 },
    { name: "images", maxCount: 1 },
  ]),
  productController.validateBulkImport
);

router.post(
  "/admin/import/commit",
  authenticate,
  adminSensitiveOpLimiter,
  requireRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  requirePermissions(PERMISSIONS.PRODUCTS_CREATE),
  productController.commitBulkImport
);

router.get(
  "/admin/export",
  authenticate,
  adminSensitiveOpLimiter,
  requireRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  requirePermissions(PERMISSIONS.PRODUCTS_EXPORT),
  productController.exportMyProducts
);

router.post(
  "/admin/import/errors/download",
  authenticate,
  requireRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  requirePermissions(PERMISSIONS.PRODUCTS_CREATE),
  productController.downloadErrorReport
);

router.get(
  "/admin/inventory/export",
  authenticate,
  requireRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  requirePermissions(PERMISSIONS.PRODUCTS_EXPORT),
  productController.exportInventory
);

router.patch(
  "/admin/bulk-update",
  authenticate,
  requireRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  requirePermissions(PERMISSIONS.PRODUCTS_UPDATE),
  productController.bulkUpdatePricesAndStock
);

router.get(
  "/admin/import/jobs",
  authenticate,
  requireRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  requirePermissions(PERMISSIONS.PRODUCTS_READ),
  productController.listJobs
);

router.get(
  "/admin/import/jobs/:jobId",
  authenticate,
  requireRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  requirePermissions(PERMISSIONS.PRODUCTS_READ),
  productController.getJob
);

// Product Image & Gallery Upload
router.post(
  "/images/upload",
  authenticate,
  requirePermissions(PERMISSIONS.PRODUCTS_CREATE),
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "file", maxCount: 1 },
  ]),
  productController.uploadProductImage
);

// Digital Asset Private Storage Upload
const digitalUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for digital product assets
    files: 1,
  },
});

router.post(
  "/digital-assets/upload",
  authenticate,
  requirePermissions(PERMISSIONS.PRODUCTS_CREATE),
  digitalUpload.single("file"),
  productController.uploadDigitalAsset
);

// Dedicated Administrator Catalog Endpoints (DEF-003, DEF-006)
router.get(
  "/admin/catalog",
  authenticate,
  requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.EDITOR),
  requirePermissions(PERMISSIONS.PRODUCTS_READ),
  productController.adminListProducts
);

router.get(
  "/admin/:id",
  authenticate,
  requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.EDITOR),
  requirePermissions(PERMISSIONS.PRODUCTS_READ),
  productController.adminGetProduct
);

// Public (Guarded against unauthorized status leakage)
router.get("/", authenticateOptional, productController.listProducts);
router.get("/recommendations", productController.getRecommendations);
router.get("/:id/related", productController.getRelatedProducts);
router.get("/slug/:slug", productController.getProductBySlug);
router.get("/variants/:variantId/availability", productController.getVariantAvailability);
router.get("/:id", authenticateOptional, productController.getProduct);

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

router.post(
  "/admin/bulk-operations",
  authenticate,
  requirePermissions(PERMISSIONS.PRODUCTS_UPDATE),
  productController.adminBulkOperations
);

router.delete(
  "/:id",
  authenticate,
  requirePermissions(PERMISSIONS.PRODUCTS_DELETE),
  productController.deleteProduct
);

router.post(
  "/:id/restore",
  authenticate,
  requirePermissions(PERMISSIONS.PRODUCTS_UPDATE),
  productController.restoreProduct
);

router.patch(
  "/:id",
  authenticate,
  requirePermissions(PERMISSIONS.PRODUCTS_UPDATE),
  validate(updateProductSchema),
  productController.updateProduct
);

module.exports = router;