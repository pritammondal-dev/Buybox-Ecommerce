const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const governanceService = require("../services/governance.service");

const getActorContext = (req) => ({
  id: req.user.id,
  role: req.user.role,
  isPlatformActor: req.auth?.isPlatformActor ?? !["customer", "vendor"].includes(req.user.role),
});

/* =========================================================================
   1. ROLES
   ========================================================================= */

const listRoles = asyncHandler(async (req, res) => {
  const result = await governanceService.listRoles(req.query);
  return sendSuccess(res, {
    message: "Roles retrieved successfully",
    data: { roles: result.roles },
    meta: { total: result.total, page: result.page, limit: result.limit },
  });
});

const getRole = asyncHandler(async (req, res) => {
  const role = await governanceService.getRoleById(req.params.id);
  return sendSuccess(res, {
    message: "Role retrieved successfully",
    data: { role },
  });
});

const createRole = asyncHandler(async (req, res) => {
  const role = await governanceService.createRole(
    req.body,
    getActorContext(req),
    req,
  );
  return sendSuccess(res, {
    statusCode: 201,
    message: "Role created successfully",
    data: { role },
  });
});

const updateRole = asyncHandler(async (req, res) => {
  const role = await governanceService.updateRole(
    req.params.id,
    req.body,
    getActorContext(req),
    req,
  );
  return sendSuccess(res, {
    message: "Role updated successfully",
    data: { role },
  });
});

const updateRolePermissions = asyncHandler(async (req, res) => {
  const result = await governanceService.updateRolePermissions(
    req.params.id,
    req.body.permissionIds,
    getActorContext(req),
    req,
  );
  return sendSuccess(res, {
    message: "Role permissions updated successfully",
    data: result,
  });
});

/* =========================================================================
   2. PERMISSIONS (READ-ONLY)
   ========================================================================= */

const listPermissions = asyncHandler(async (req, res) => {
  const result = await governanceService.listPermissions(req.query);
  return sendSuccess(res, {
    message: "Permissions retrieved successfully",
    data: { permissions: result.permissions },
    meta: { total: result.total, page: result.page, limit: result.limit },
  });
});

const getPermission = asyncHandler(async (req, res) => {
  const permission = await governanceService.getPermissionById(req.params.id);
  return sendSuccess(res, {
    message: "Permission retrieved successfully",
    data: { permission },
  });
});

/* =========================================================================
   3. EMPLOYEES
   ========================================================================= */

const listEmployees = asyncHandler(async (req, res) => {
  const result = await governanceService.listEmployees(req.query);
  return sendSuccess(res, {
    message: "Employees retrieved successfully",
    data: { employees: result.employees },
    meta: { total: result.total, page: result.page, limit: result.limit },
  });
});

const getEmployee = asyncHandler(async (req, res) => {
  const employee = await governanceService.getEmployeeById(req.params.id);
  return sendSuccess(res, {
    message: "Employee retrieved successfully",
    data: { employee },
  });
});

const createEmployee = asyncHandler(async (req, res) => {
  const employee = await governanceService.createEmployee(
    req.body,
    getActorContext(req),
    req,
  );
  return sendSuccess(res, {
    statusCode: 201,
    message: "Employee created successfully",
    data: { employee },
  });
});

const updateEmployee = asyncHandler(async (req, res) => {
  const employee = await governanceService.updateEmployee(
    req.params.id,
    req.body,
    getActorContext(req),
    req,
  );
  return sendSuccess(res, {
    message: "Employee updated successfully",
    data: { employee },
  });
});

/* =========================================================================
   4. EMPLOYEE ROLES
   ========================================================================= */

const listEmployeeRoles = asyncHandler(async (req, res) => {
  const roles = await governanceService.listEmployeeRoles(req.params.employeeId);
  return sendSuccess(res, {
    message: "Employee roles retrieved successfully",
    data: { roles },
  });
});

const assignEmployeeRole = asyncHandler(async (req, res) => {
  const assignment = await governanceService.assignEmployeeRole(
    req.params.employeeId,
    req.body,
    getActorContext(req),
    req,
  );
  return sendSuccess(res, {
    statusCode: 201,
    message: "Role assigned to employee successfully",
    data: { assignment },
  });
});

const removeEmployeeRole = asyncHandler(async (req, res) => {
  const result = await governanceService.removeEmployeeRole(
    req.params.employeeId,
    req.params.roleId,
    getActorContext(req),
    req,
  );
  return sendSuccess(res, {
    message: result.message,
    data: null,
  });
});

/* =========================================================================
   5. DIRECT GRANTS
   ========================================================================= */

const listGrants = asyncHandler(async (req, res) => {
  const grants = await governanceService.listEmployeeGrants(req.params.employeeId);
  return sendSuccess(res, {
    message: "Employee permission grants retrieved successfully",
    data: { grants },
  });
});

const createGrant = asyncHandler(async (req, res) => {
  const grant = await governanceService.createEmployeeGrant(
    req.params.employeeId,
    req.body,
    getActorContext(req),
    req,
  );
  return sendSuccess(res, {
    statusCode: 201,
    message: "Permission granted to employee successfully",
    data: { grant },
  });
});

const revokeGrant = asyncHandler(async (req, res) => {
  const result = await governanceService.revokeEmployeeGrant(
    req.params.employeeId,
    req.params.permissionId,
    getActorContext(req),
    req,
  );
  return sendSuccess(res, {
    message: result.message,
    data: null,
  });
});

/* =========================================================================
   6. DIRECT RESTRICTIONS
   ========================================================================= */

const listRestrictions = asyncHandler(async (req, res) => {
  const restrictions = await governanceService.listEmployeeRestrictions(
    req.params.employeeId,
  );
  return sendSuccess(res, {
    message: "Employee permission restrictions retrieved successfully",
    data: { restrictions },
  });
});

const createRestriction = asyncHandler(async (req, res) => {
  const restriction = await governanceService.createEmployeeRestriction(
    req.params.employeeId,
    req.body,
    getActorContext(req),
    req,
  );
  return sendSuccess(res, {
    statusCode: 201,
    message: "Permission restricted for employee successfully",
    data: { restriction },
  });
});

const revokeRestriction = asyncHandler(async (req, res) => {
  const result = await governanceService.revokeEmployeeRestriction(
    req.params.employeeId,
    req.params.permissionId,
    getActorContext(req),
    req,
  );
  return sendSuccess(res, {
    message: result.message,
    data: null,
  });
});

/* =========================================================================
   7. WORK ASSIGNMENTS
   ========================================================================= */

const listAssignments = asyncHandler(async (req, res) => {
  const assignments = await governanceService.listEmployeeAssignments(
    req.params.employeeId,
  );
  return sendSuccess(res, {
    message: "Employee work assignments retrieved successfully",
    data: { assignments },
  });
});

const createAssignment = asyncHandler(async (req, res) => {
  const assignment = await governanceService.createWorkAssignment(
    req.params.employeeId,
    req.body,
    getActorContext(req),
    req,
  );
  return sendSuccess(res, {
    statusCode: 201,
    message: "Work assignment created successfully",
    data: { assignment },
  });
});

const updateAssignment = asyncHandler(async (req, res) => {
  const assignment = await governanceService.updateWorkAssignment(
    req.params.employeeId,
    req.params.assignmentId,
    req.body,
    getActorContext(req),
    req,
  );
  return sendSuccess(res, {
    message: "Work assignment updated successfully",
    data: { assignment },
  });
});

const removeAssignment = asyncHandler(async (req, res) => {
  const result = await governanceService.removeWorkAssignment(
    req.params.employeeId,
    req.params.assignmentId,
    getActorContext(req),
    req,
  );
  return sendSuccess(res, {
    message: result.message,
    data: null,
  });
});

/* =========================================================================
   8. AUDIT LOGS
   ========================================================================= */

const listAuditLogs = asyncHandler(async (req, res) => {
  const result = await governanceService.listAuditLogs(req.query);
  return sendSuccess(res, {
    message: "Audit logs retrieved successfully",
    data: { logs: result.logs },
    meta: { total: result.total, page: result.page, limit: result.limit },
  });
});

const getAuditLog = asyncHandler(async (req, res) => {
  const log = await governanceService.getAuditLogById(req.params.id);
  return sendSuccess(res, {
    message: "Audit log retrieved successfully",
    data: { log },
  });
});

module.exports = {
  listRoles,
  getRole,
  createRole,
  updateRole,
  updateRolePermissions,
  listPermissions,
  getPermission,
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  listEmployeeRoles,
  assignEmployeeRole,
  removeEmployeeRole,
  listGrants,
  createGrant,
  revokeGrant,
  listRestrictions,
  createRestriction,
  revokeRestriction,
  listAssignments,
  createAssignment,
  updateAssignment,
  removeAssignment,
  listAuditLogs,
  getAuditLog,
};
