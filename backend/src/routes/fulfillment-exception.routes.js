const express = require("express");
const controller = require("../controllers/fulfillment-exception.controller");
const { authenticate, authenticateVendor } = require("../middlewares/authentication.middleware");
const { requireApprovedVendor } = require("../middlewares/vendor.middleware");
const {
  requirePermissions,
  requireRoles,
} = require("../middlewares/authorization.middleware");
const { PERMISSIONS } = require("../constants/permissions.constants");
const { ROLES } = require("../constants/auth.constants");

const router = express.Router();

router.use(authenticate);

// ==========================================
// VENDOR EXCEPTION ENDPOINTS
// ==========================================
router.use("/vendor", authenticateVendor);
router.post(
  "/vendor",
  requireApprovedVendor,
  controller.createVendorException
);

router.get(
  "/vendor",
  requireApprovedVendor,
  controller.getVendorExceptions
);

router.get(
  "/vendor/:id",
  requireApprovedVendor,
  controller.getVendorExceptionById
);

router.post(
  "/vendor/:id/clarify",
  requireApprovedVendor,
  controller.clarifyVendorException
);

router.post(
  "/vendor/:id/withdraw",
  requireApprovedVendor,
  controller.withdrawVendorException
);

// ==========================================
// ADMINISTRATOR QUEUE & RESOLUTION ENDPOINTS
// ==========================================
router.get(
  "/admin",
  requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER),
  requirePermissions(PERMISSIONS.ORDERS_READ),
  controller.getAdminExceptions
);

router.get(
  "/admin/:id",
  requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER),
  requirePermissions(PERMISSIONS.ORDERS_READ),
  controller.getAdminExceptionById
);

router.post(
  "/admin/:id/transition",
  requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER),
  requirePermissions(PERMISSIONS.ORDERS_MANAGE),
  controller.adminTransitionException
);

router.post(
  "/admin/:id/approve-cancellation",
  requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER),
  requirePermissions(PERMISSIONS.ORDERS_MANAGE),
  controller.adminApproveCancellation
);

module.exports = router;
