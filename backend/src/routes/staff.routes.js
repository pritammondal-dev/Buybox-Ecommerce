const express = require("express");
const staffController = require("../controllers/staff.controller");
const authenticate = require("../middlewares/authentication.middleware");
const {
  requirePermissions,
  requireRoles,
} = require("../middlewares/authorization.middleware");
const validate = require("../middlewares/validate.middleware");
const validateObjectId = require("../middlewares/validate-object-id.middleware");
const { PERMISSIONS } = require("../constants/permissions.constants");
const { ROLES } = require("../constants/auth.constants");
const {
  createStaffSchema,
  updateStaffSchema,
  resetPasswordSchema,
  listStaffQuerySchema,
} = require("../validators/staff.validator");

const router = express.Router();

router.use(authenticate);

// List staff
router.get(
  "/",
  requirePermissions(PERMISSIONS.STAFF_VIEW),
  validate(listStaffQuerySchema, "query"),
  staffController.listStaff
);

// Get staff details
router.get(
  "/:id",
  requirePermissions(PERMISSIONS.STAFF_VIEW),
  validateObjectId("id"),
  staffController.getStaff
);

const AppError = require("../errors/AppError");
const { getEffectivePermissions } = require("../services/authorization.service");
const { checkPermissionsMatch } = require("../middlewares/authorization.middleware");

const requireStaffProvisioningAuthority = async (req, res, next) => {
  if (!req.user) {
    return next(new AppError("Authentication required", 401, "AUTHENTICATION_REQUIRED"));
  }
  if (req.user.role === ROLES.SUPER_ADMIN || req.user.role === "super_admin") {
    return next();
  }
  try {
    const effectivePermissions = await getEffectivePermissions(req.user.id || req.user._id);
    const hasPerm = checkPermissionsMatch(effectivePermissions, [PERMISSIONS.STAFF_CREATE]);
    if (!hasPerm) {
      return next(
        new AppError(
          "You do not have permission to access this resource",
          403,
          "INSUFFICIENT_ROLE"
        )
      );
    }
    next();
  } catch (err) {
    next(err);
  }
};

const { adminSensitiveOpLimiter } = require("../middlewares/rate-limiter.middleware");

// Create staff member (Superadmin or authorized staff with dynamic authority)
router.post(
  "/",
  adminSensitiveOpLimiter,
  requireStaffProvisioningAuthority,
  validate(createStaffSchema),
  staffController.createStaff
);

// Update staff details (Superadmin only)
router.patch(
  "/:id",
  requireRoles(ROLES.SUPER_ADMIN),
  validateObjectId("id"),
  validate(updateStaffSchema),
  staffController.updateStaff
);

// Suspend staff member (Superadmin only)
router.post(
  "/:id/suspend",
  requireRoles(ROLES.SUPER_ADMIN),
  validateObjectId("id"),
  staffController.suspendStaff
);
router.put(
  "/:id/suspend",
  requireRoles(ROLES.SUPER_ADMIN),
  validateObjectId("id"),
  staffController.suspendStaff
);

// Reactivate staff member (Superadmin only)
router.post(
  "/:id/reactivate",
  requireRoles(ROLES.SUPER_ADMIN),
  validateObjectId("id"),
  staffController.reactivateStaff
);
router.put(
  "/:id/reactivate",
  requireRoles(ROLES.SUPER_ADMIN),
  validateObjectId("id"),
  staffController.reactivateStaff
);

// Reset password securely (Superadmin only)
router.post(
  "/:id/reset-password",
  requireRoles(ROLES.SUPER_ADMIN),
  validateObjectId("id"),
  validate(resetPasswordSchema),
  staffController.resetPassword
);

// Get staff active session info
router.get(
  "/:id/sessions",
  requirePermissions(PERMISSIONS.STAFF_VIEW),
  validateObjectId("id"),
  staffController.getSessions
);

// Revoke all active sessions for a staff member (Superadmin only)
router.post(
  "/:id/revoke-sessions",
  requireRoles(ROLES.SUPER_ADMIN),
  validateObjectId("id"),
  staffController.revokeSessions
);

const jobRoleController = require("../controllers/job-role.controller");

// Pre-flight preview of employee role change (diff calculation)
router.post(
  "/:id/role-preview",
  validateObjectId("id"),
  jobRoleController.previewRoleChange
);

// Assign dynamic Job Role to employee (promotion / demotion / lateral)
router.post(
  "/:id/change-role",
  validateObjectId("id"),
  jobRoleController.assignEmployeeRole
);

module.exports = router;
