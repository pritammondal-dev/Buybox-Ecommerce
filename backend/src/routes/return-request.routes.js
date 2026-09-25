const express = require("express");
const returnRequestController = require("../controllers/return-request.controller");
const authenticate = require("../middlewares/authentication.middleware");
const {
  requireRoles,
  requirePermissions,
} = require("../middlewares/authorization.middleware");
const { ROLES } = require("../constants/auth.constants");
const { PERMISSIONS } = require("../constants/permissions.constants");

const router = express.Router();

router.use(authenticate);

// Admin returns management (must precede generic routes)
router.get(
  "/admin",
  requirePermissions(PERMISSIONS.RETURNS_VIEW),
  returnRequestController.getAdminReturns
);

router.get(
  "/admin/:id",
  requirePermissions(PERMISSIONS.RETURNS_VIEW),
  returnRequestController.getAdminReturnById
);

router.post(
  "/admin/:id/approve",
  requirePermissions(PERMISSIONS.RETURNS_APPROVE),
  returnRequestController.approveReturn
);

router.post(
  "/admin/:id/reject",
  requirePermissions(PERMISSIONS.RETURNS_REJECT),
  returnRequestController.rejectReturn
);

router.post(
  "/admin/:id/receive",
  requirePermissions(PERMISSIONS.RETURNS_APPROVE),
  returnRequestController.receiveReturn
);

router.post(
  "/admin/:id/refund",
  requirePermissions(PERMISSIONS.REFUNDS_CREATE),
  returnRequestController.refundReturn
);

// Vendor-scoped returns (must precede generic /:id if any)
router.get(
  "/vendor/my",
  requireRoles(ROLES.VENDOR),
  returnRequestController.getMyVendorReturns
);

router.get(
  "/vendor/my/:returnId",
  requireRoles(ROLES.VENDOR),
  returnRequestController.getMyVendorReturnById
);

router.post(
  "/vendor/my/:returnId/approve",
  requireRoles(ROLES.VENDOR),
  returnRequestController.approveReturn
);

router.post(
  "/vendor/my/:returnId/reject",
  requireRoles(ROLES.VENDOR),
  returnRequestController.rejectReturn
);

router.post(
  "/vendor/my/:returnId/receive",
  requireRoles(ROLES.VENDOR),
  returnRequestController.receiveReturn
);

router.post(
  "/vendor/my/:returnId/refund",
  requireRoles(ROLES.VENDOR),
  returnRequestController.refundReturn
);

router.post("/", returnRequestController.createReturn);
router.get("/my", returnRequestController.getMyReturns);
router.get("/order/:orderId", returnRequestController.getReturnsByOrderId);

module.exports = router;
