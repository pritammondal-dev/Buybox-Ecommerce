const express = require("express");
const jobRoleController = require("../controllers/job-role.controller");
const authenticate = require("../middlewares/authentication.middleware");
const {
  requirePermissions,
  requireRoles,
} = require("../middlewares/authorization.middleware");
const { PERMISSIONS } = require("../constants/permissions.constants");
const { ROLES } = require("../constants/auth.constants");
const { adminSensitiveOpLimiter } = require("../middlewares/rate-limiter.middleware");

const router = express.Router();

router.use(authenticate);

// List all Job Roles
router.get(
  "/",
  requirePermissions(PERMISSIONS.JOB_ROLES_VIEW),
  jobRoleController.listJobRoles
);

// Reorder Job Roles hierarchy (Superadmin only)
router.patch(
  "/reorder",
  adminSensitiveOpLimiter,
  requireRoles(ROLES.SUPER_ADMIN),
  jobRoleController.reorderJobRoles
);

// Get Job Role details
router.get(
  "/:id",
  requirePermissions(PERMISSIONS.JOB_ROLES_VIEW),
  jobRoleController.getJobRole
);

// Create Job Role (Superadmin only)
router.post(
  "/",
  adminSensitiveOpLimiter,
  requireRoles(ROLES.SUPER_ADMIN),
  jobRoleController.createJobRole
);

// Update Job Role (Superadmin only)
router.patch(
  "/:id",
  adminSensitiveOpLimiter,
  requireRoles(ROLES.SUPER_ADMIN),
  jobRoleController.updateJobRole
);

// Preview employee migration before deactivating
router.post(
  "/:id/migrate-preview",
  requireRoles(ROLES.SUPER_ADMIN),
  jobRoleController.previewRoleMigration
);

// Deactivate Job Role with migration
router.post(
  "/:id/deactivate",
  requireRoles(ROLES.SUPER_ADMIN),
  jobRoleController.deactivateJobRole
);

// Bulk migrate employees between roles
router.post(
  "/:id/migrate",
  requireRoles(ROLES.SUPER_ADMIN),
  jobRoleController.migrateEmployees
);

module.exports = router;
