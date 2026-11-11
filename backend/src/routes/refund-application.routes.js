const express = require("express");
const refundApplicationController = require("../controllers/refund-application.controller");
const { authenticate } = require("../middlewares/authentication.middleware");
const {
  requireRoles,
  requirePermissions,
} = require("../middlewares/authorization.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  rejectRefundApplicationSchema,
  requestRevisionSchema,
  disburseRefundApplicationSchema,
} = require("../validators/order/refund-application.validator");
const { ROLES } = require("../constants/auth.constants");
const { PERMISSIONS } = require("../constants/permissions.constants");

const router = express.Router();

router.use(authenticate);

// Support both /refund-applications/admin/... and /refund-applications/...
const adminAuth = requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.SUPPORT);

// 1. Applications List
router.get(
  ["/admin", "/"],
  adminAuth,
  requirePermissions(PERMISSIONS.REFUND_APPLICATIONS_VIEW),
  refundApplicationController.getAdminRefundApplications
);

// 2. Application Detail
router.get(
  ["/admin/:id", "/:id"],
  adminAuth,
  requirePermissions(PERMISSIONS.REFUND_APPLICATIONS_VIEW),
  refundApplicationController.getAdminRefundApplicationById
);

// 3. Mark Under Review (POST & PUT)
router.all(
  ["/admin/:id/review", "/:id/review"],
  adminAuth,
  requirePermissions(PERMISSIONS.REFUND_APPLICATIONS_REVIEW),
  refundApplicationController.reviewRefundApplication
);

// 4. Approve Application
router.post(
  ["/admin/:id/approve", "/:id/approve"],
  adminAuth,
  requirePermissions(PERMISSIONS.REFUND_APPLICATIONS_APPROVE),
  refundApplicationController.approveRefundApplication
);

// 5. Reject Application
router.post(
  ["/admin/:id/reject", "/:id/reject"],
  adminAuth,
  requirePermissions(PERMISSIONS.REFUND_APPLICATIONS_REJECT),
  validate(rejectRefundApplicationSchema),
  refundApplicationController.rejectRefundApplication
);

// 6. Request Revision
router.post(
  ["/admin/:id/request-revision", "/:id/request-revision"],
  adminAuth,
  requirePermissions(PERMISSIONS.REFUND_APPLICATIONS_REVISE),
  validate(requestRevisionSchema),
  refundApplicationController.requestRevision
);

// 7. Initiate Gateway Disbursement
router.post(
  ["/admin/:id/disburse", "/:id/disburse"],
  adminAuth,
  requirePermissions(PERMISSIONS.REFUND_DISBURSEMENT_INITIATE),
  validate(disburseRefundApplicationSchema),
  refundApplicationController.disburseRefundApplication
);

// 8. Retry Failed Disbursement
router.post(
  ["/admin/:id/retry-disbursement", "/admin/:id/retry", "/:id/retry", "/:id/retry-disbursement"],
  adminAuth,
  requirePermissions(PERMISSIONS.REFUND_DISBURSEMENT_INITIATE),
  validate(disburseRefundApplicationSchema),
  refundApplicationController.retryRefundApplicationDisbursement
);

// 9. Reconcile Gateway Status
router.post(
  ["/admin/:id/reconcile", "/:id/reconcile"],
  adminAuth,
  requirePermissions(PERMISSIONS.REFUND_APPLICATIONS_REVIEW),
  refundApplicationController.reconcileRefundApplication
);

module.exports = router;
