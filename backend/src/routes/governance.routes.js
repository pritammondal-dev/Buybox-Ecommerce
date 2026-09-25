const express = require("express");
const governanceController = require("../controllers/governance.controller");
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
  createRoleSchema,
  updateRoleSchema,
  updateRolePermissionsSchema,
  createEmployeeSchema,
  updateEmployeeSchema,
  assignEmployeeRoleSchema,
  createPermissionGrantSchema,
  createPermissionRestrictionSchema,
  createWorkAssignmentSchema,
  updateWorkAssignmentSchema,
  auditLogQuerySchema,
  updateEmployeePermissionsBulkSchema,
} = require("../validators/governance/governance.validator");

const router = express.Router();

// All governance endpoints strictly require authentication
router.use(authenticate);

/* =========================================================================
   1. ROLES GOVERNANCE
   ========================================================================= */

router.get(
  "/roles",
  requirePermissions(PERMISSIONS.ROLES_READ),
  governanceController.listRoles,
);

router.get(
  "/roles/:id",
  requirePermissions(PERMISSIONS.ROLES_READ),
  validateObjectId("id"),
  governanceController.getRole,
);

router.post(
  "/roles",
  requirePermissions(PERMISSIONS.ROLES_MANAGE),
  validate(createRoleSchema),
  governanceController.createRole,
);

router.patch(
  "/roles/:id",
  requirePermissions(PERMISSIONS.ROLES_MANAGE),
  validateObjectId("id"),
  validate(updateRoleSchema),
  governanceController.updateRole,
);

router.put(
  "/roles/:id/permissions",
  requirePermissions(PERMISSIONS.ROLES_MANAGE),
  validateObjectId("id"),
  validate(updateRolePermissionsSchema),
  governanceController.updateRolePermissions,
);

/* =========================================================================
   2. PERMISSIONS GOVERNANCE (READ-ONLY)
   ========================================================================= */

router.get(
  "/permissions",
  requirePermissions(PERMISSIONS.PERMISSIONS_READ),
  governanceController.listPermissions,
);

router.get(
  "/permissions/:id",
  requirePermissions(PERMISSIONS.PERMISSIONS_READ),
  validateObjectId("id"),
  governanceController.getPermission,
);

/* =========================================================================
   3. EMPLOYEES GOVERNANCE
   ========================================================================= */

router.get(
  "/employees",
  requirePermissions(PERMISSIONS.EMPLOYEES_READ),
  governanceController.listEmployees,
);

router.get(
  "/employees/:id",
  requirePermissions(PERMISSIONS.EMPLOYEES_READ),
  validateObjectId("id"),
  governanceController.getEmployee,
);

router.post(
  "/employees",
  requirePermissions(PERMISSIONS.EMPLOYEES_MANAGE),
  validate(createEmployeeSchema),
  governanceController.createEmployee,
);

router.patch(
  "/employees/:id",
  requirePermissions(PERMISSIONS.EMPLOYEES_MANAGE),
  validateObjectId("id"),
  validate(updateEmployeeSchema),
  governanceController.updateEmployee,
);

/* =========================================================================
   4. EMPLOYEE ROLES GOVERNANCE
   ========================================================================= */

router.get(
  "/employees/:employeeId/roles",
  requirePermissions(PERMISSIONS.EMPLOYEES_READ),
  validateObjectId("employeeId"),
  governanceController.listEmployeeRoles,
);

router.post(
  "/employees/:employeeId/roles",
  requirePermissions(PERMISSIONS.EMPLOYEES_MANAGE),
  validateObjectId("employeeId"),
  validate(assignEmployeeRoleSchema),
  governanceController.assignEmployeeRole,
);

router.delete(
  "/employees/:employeeId/roles/:roleId",
  requirePermissions(PERMISSIONS.EMPLOYEES_MANAGE),
  validateObjectId("employeeId"),
  validateObjectId("roleId"),
  governanceController.removeEmployeeRole,
);

/* =========================================================================
   5. DIRECT PERMISSION GRANTS GOVERNANCE
   ========================================================================= */

router.get(
  "/employees/:employeeId/permissions/grants",
  requirePermissions(PERMISSIONS.EMPLOYEES_READ),
  validateObjectId("employeeId"),
  governanceController.listGrants,
);

router.post(
  "/employees/:employeeId/permissions/grants",
  requirePermissions(PERMISSIONS.EMPLOYEES_MANAGE),
  validateObjectId("employeeId"),
  validate(createPermissionGrantSchema),
  governanceController.createGrant,
);

router.delete(
  "/employees/:employeeId/permissions/grants/:permissionId",
  requirePermissions(PERMISSIONS.EMPLOYEES_MANAGE),
  validateObjectId("employeeId"),
  validateObjectId("permissionId"),
  governanceController.revokeGrant,
);

/* =========================================================================
   6. DIRECT PERMISSION RESTRICTIONS GOVERNANCE
   ========================================================================= */

router.get(
  "/employees/:employeeId/permissions/restrictions",
  requirePermissions(PERMISSIONS.EMPLOYEES_READ),
  validateObjectId("employeeId"),
  governanceController.listRestrictions,
);

router.post(
  "/employees/:employeeId/permissions/restrictions",
  requirePermissions(PERMISSIONS.EMPLOYEES_MANAGE),
  validateObjectId("employeeId"),
  validate(createPermissionRestrictionSchema),
  governanceController.createRestriction,
);

router.delete(
  "/employees/:employeeId/permissions/restrictions/:permissionId",
  requirePermissions(PERMISSIONS.EMPLOYEES_MANAGE),
  validateObjectId("employeeId"),
  validateObjectId("permissionId"),
  governanceController.revokeRestriction,
);

router.get(
  "/employees/:employeeId/permissions",
  requirePermissions(PERMISSIONS.EMPLOYEES_READ),
  validateObjectId("employeeId"),
  governanceController.getEmployeePermissions,
);

router.put(
  "/employees/:employeeId/permissions",
  requireRoles(ROLES.SUPER_ADMIN),
  validateObjectId("employeeId"),
  validate(updateEmployeePermissionsBulkSchema),
  governanceController.updateEmployeePermissionsBulk,
);

/* =========================================================================
   7. WORK ASSIGNMENTS GOVERNANCE
   ========================================================================= */

router.get(
  "/employees/:employeeId/assignments",
  requirePermissions(PERMISSIONS.WORK_ASSIGNMENTS_READ),
  validateObjectId("employeeId"),
  governanceController.listAssignments,
);

router.post(
  "/employees/:employeeId/assignments",
  requirePermissions(PERMISSIONS.WORK_ASSIGNMENTS_MANAGE),
  validateObjectId("employeeId"),
  validate(createWorkAssignmentSchema),
  governanceController.createAssignment,
);

router.patch(
  "/employees/:employeeId/assignments/:assignmentId",
  requirePermissions(PERMISSIONS.WORK_ASSIGNMENTS_MANAGE),
  validateObjectId("employeeId"),
  validateObjectId("assignmentId"),
  validate(updateWorkAssignmentSchema),
  governanceController.updateAssignment,
);

router.delete(
  "/employees/:employeeId/assignments/:assignmentId",
  requirePermissions(PERMISSIONS.WORK_ASSIGNMENTS_MANAGE),
  validateObjectId("employeeId"),
  validateObjectId("assignmentId"),
  governanceController.removeAssignment,
);

/* =========================================================================
   8. AUDIT LOGS GOVERNANCE (READ-ONLY)
   ========================================================================= */

router.get(
  "/audit-logs",
  requirePermissions(PERMISSIONS.AUDIT_LOGS_READ),
  validate(auditLogQuerySchema, "query"),
  governanceController.listAuditLogs,
);

router.get(
  "/audit-logs/:id",
  requirePermissions(PERMISSIONS.AUDIT_LOGS_READ),
  validateObjectId("id"),
  governanceController.getAuditLog,
);

/* =========================================================================
   9. SUPERADMIN GOVERNANCE & AUTHORITY TRANSFER
   ========================================================================= */

const jobRoleController = require("../controllers/job-role.controller");

router.post(
  "/superadmin/transfer",
  requireRoles(ROLES.SUPER_ADMIN),
  jobRoleController.transferSuperadmin
);

module.exports = router;
