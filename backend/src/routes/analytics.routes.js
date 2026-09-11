const express = require("express");
const analyticsController = require("../controllers/analytics.controller");
const authenticate = require("../middlewares/authentication.middleware");
const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");
const validate = require("../middlewares/validate.middleware");
const { PERMISSIONS } = require("../constants/permissions.constants");
const {
  adminOverviewQuerySchema,
  adminTopProductsQuerySchema,
  adminSalesTrendQuerySchema,
  vendorOverviewQuerySchema,
  vendorTopProductsQuerySchema,
  vendorSalesTrendQuerySchema,
} = require("../validators/analytics/analytics.validator");

const router = express.Router();

router.use(authenticate);

/*
 * ==========================================
 * ADMIN ANALYTICS ROUTES
 * ==========================================
 */
router.get(
  "/admin/overview",
  requirePermissions(PERMISSIONS.ANALYTICS_READ),
  validate(adminOverviewQuerySchema, "query"),
  analyticsController.getAdminOverview
);

router.get(
  "/admin/top-products",
  requirePermissions(PERMISSIONS.ANALYTICS_READ),
  validate(adminTopProductsQuerySchema, "query"),
  analyticsController.getAdminTopProducts
);

router.get(
  "/admin/sales-trend",
  requirePermissions(PERMISSIONS.ANALYTICS_READ),
  validate(adminSalesTrendQuerySchema, "query"),
  analyticsController.getAdminSalesTrend
);

/*
 * ==========================================
 * VENDOR ANALYTICS ROUTES
 * ==========================================
 */
router.get(
  "/vendor/overview",
  requirePermissions(PERMISSIONS.ANALYTICS_READ_OWN),
  validate(vendorOverviewQuerySchema, "query"),
  analyticsController.getVendorOverview
);

router.get(
  "/vendor/top-products",
  requirePermissions(PERMISSIONS.ANALYTICS_READ_OWN),
  validate(vendorTopProductsQuerySchema, "query"),
  analyticsController.getVendorTopProducts
);

router.get(
  "/vendor/sales-trend",
  requirePermissions(PERMISSIONS.ANALYTICS_READ_OWN),
  validate(vendorSalesTrendQuerySchema, "query"),
  analyticsController.getVendorSalesTrend
);

module.exports = router;
