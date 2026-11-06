const express = require("express");
const digitalDownloadController = require("../controllers/digital-download.controller");
const authenticate = require("../middlewares/authentication.middleware");
const { requirePermissions, requireRoles } = require("../middlewares/authorization.middleware");
const { PERMISSIONS } = require("../constants/permissions.constants");
const { ROLES } = require("../constants/auth.constants");
const { digitalDownloadLimiter } = require("../middlewares/rate-limiter.middleware");

const router = express.Router();

// Customer: list own entitlements
router.get("/my", authenticate, digitalDownloadController.getMyEntitlements);

// Admin controls
router.get(
  "/admin/all",
  authenticate,
  requireRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  requirePermissions(PERMISSIONS.PRODUCTS_READ),
  digitalDownloadController.adminListEntitlements
);

router.post(
  "/admin/:id/revoke",
  authenticate,
  requireRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  requirePermissions(PERMISSIONS.PRODUCTS_UPDATE),
  digitalDownloadController.adminRevokeEntitlement
);

router.post(
  "/admin/:id/reset",
  authenticate,
  requireRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  requirePermissions(PERMISSIONS.PRODUCTS_UPDATE),
  digitalDownloadController.adminResetEntitlement
);

// Customer/Admin: download specific entitlement asset (rate-limited against bandwidth scraping)
router.get("/:entitlementId", digitalDownloadLimiter, authenticate, digitalDownloadController.downloadFile);

module.exports = router;
