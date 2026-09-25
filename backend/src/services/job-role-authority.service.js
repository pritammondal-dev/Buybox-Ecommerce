const mongoose = require("mongoose");
const JobRole = require("../models/JobRole");
const Employee = require("../models/Employee");
const User = require("../models/User");
const AppError = require("../errors/AppError");
const { hasPermission, incrementAuthVersion, incrementPermissionVersion } = require("./authorization.service");
const { recordAuditLog, sanitizeAuditState } = require("./governance.service");

/**
 * Check if user is Superadmin.
 * Superadmin has platform-level executive authority.
 */
const isSuperadmin = (user) => {
  if (!user) return false;
  return user.role === "super_admin";
};

/**
 * Resolve Employee profile and active JobRole for a given User or Employee ID.
 */
const getEmployeeJobRole = async (userIdOrEmployeeId) => {
  if (!userIdOrEmployeeId) return { employee: null, jobRole: null };

  let employee = null;
  if (mongoose.isValidObjectId(userIdOrEmployeeId)) {
    employee = await Employee.findById(userIdOrEmployeeId).populate("jobRoleId").lean();
    if (!employee) {
      employee = await Employee.findOne({ userId: userIdOrEmployeeId }).populate("jobRoleId").lean();
    }
  }

  if (!employee) return { employee: null, jobRole: null };

  const jobRole = employee.jobRoleId || null;
  return { employee, jobRole };
};

/**
 * Evaluates whether an actor can manage a target JobRole.
 *
 * Rules:
 * 1. Superadmin can manage any role.
 * 2. Actor must possess an active JobRole with higher authority (lower tier) than target.
 * 3. Target role must be included in actor's database-backed managementScope.
 * 4. Same-tier management is DENIED.
 * 5. Lower-tier managing higher-tier is DENIED.
 */
const canManageRole = async (actorUser, targetRoleId) => {
  if (!actorUser) return false;
  if (isSuperadmin(actorUser)) return true;

  const { jobRole: actorJobRole } = await getEmployeeJobRole(actorUser.id || actorUser._id);
  if (!actorJobRole || !actorJobRole.isActive) return false;

  const targetRole = await JobRole.findById(targetRoleId).lean();
  if (!targetRole || !targetRole.isActive) return false;

  // Cannot manage Superadmin role
  if (targetRole.isSuperadminRole) return false;

  // Hierarchy check: Actor tier must be lower number (higher authority) than target tier
  if (actorJobRole.tier >= targetRole.tier) return false;

  // Management scope check
  const scopeIds = (actorJobRole.managementScope || []).map((id) => id.toString());
  return scopeIds.includes(targetRole._id.toString());
};

/**
 * Evaluates whether an actor can manage a target employee.
 *
 * Rules:
 * 1. Superadmin can manage all employees.
 * 2. Target cannot be Superadmin.
 * 3. Actor cannot manage themselves for administrative modifications.
 * 4. Actor's JobRole must have strictly higher authority (lower tier) than target's JobRole.
 * 5. Target's JobRole must be within actor's managementScope.
 */
const canManageEmployee = async (actorUser, targetUserIdOrEmployeeId) => {
  if (!actorUser || !targetUserIdOrEmployeeId) return false;

  const { employee: targetEmployee, jobRole: targetJobRole } = await getEmployeeJobRole(
    targetUserIdOrEmployeeId
  );
  if (!targetEmployee) return false;

  const targetUserId = (targetEmployee.userId?._id || targetEmployee.userId).toString();
  const actorUserId = (actorUser.id || actorUser._id).toString();

  // Self-management for administrative authority changes is prohibited
  if (actorUserId === targetUserId) return false;

  // Check if target is platform Superadmin
  const targetUser = await User.findById(targetUserId).lean();
  if (targetUser && targetUser.role === "super_admin") return false;

  // Superadmin can manage all non-superadmin employees
  if (isSuperadmin(actorUser)) return true;

  const { jobRole: actorJobRole } = await getEmployeeJobRole(actorUserId);
  if (!actorJobRole || !actorJobRole.isActive) return false;

  // If target has no assigned JobRole yet, actor can manage if actor has lower tier than default (e.g., manager or above)
  if (!targetJobRole) {
    return actorJobRole.tier < 5;
  }

  // Hierarchy check
  if (actorJobRole.tier >= targetJobRole.tier) return false;

  // Scope check
  const scopeIds = (actorJobRole.managementScope || []).map((id) => id.toString());
  return scopeIds.includes(targetJobRole._id.toString());
};

/**
 * Evaluates whether an actor has authority to assign targetRoleId to an employee.
 *
 * Two-Layer Evaluation:
 * Layer 1 — Permissions: Actor must possess employee.assign_role (or Superadmin).
 * Layer 2 — Hierarchy & Scope:
 *   - Target role must be lower authority than actor (target tier > actor tier).
 *   - Target role must be within actor's managementScope.
 *   - Target employee (if existing) must be lower authority than actor and within managementScope.
 */
const canAssignRole = async (actorUser, targetRoleId, targetUserIdOrEmployeeId = null) => {
  if (!actorUser || !targetRoleId) return { allowed: false, reason: "MISSING_PARAMETERS" };

  // 1. Superadmin has full assignment authority (except cannot assign superadmin role directly)
  if (isSuperadmin(actorUser)) {
    const targetRole = await JobRole.findById(targetRoleId).lean();
    if (!targetRole || !targetRole.isActive) {
      return { allowed: false, reason: "TARGET_ROLE_INACTIVE_OR_NOT_FOUND" };
    }
    if (targetRole.isSuperadminRole) {
      return { allowed: false, reason: "SUPERADMIN_ROLE_CANNOT_BE_DIRECTLY_ASSIGNED" };
    }
    return { allowed: true, reason: null };
  }

  // 2. Permission check: Must have employee.assign_role
  const hasAssignPerm =
    (await hasPermission(actorUser.id || actorUser._id, "employee.assign_role")) ||
    (await hasPermission(actorUser.id || actorUser._id, "staff.edit")) ||
    (await hasPermission(actorUser.id || actorUser._id, "staff.create"));

  if (!hasAssignPerm) {
    return { allowed: false, reason: "MISSING_ASSIGN_ROLE_PERMISSION" };
  }

  // 3. Resolve actor's JobRole
  const { jobRole: actorJobRole } = await getEmployeeJobRole(actorUser.id || actorUser._id);
  if (!actorJobRole || !actorJobRole.isActive) {
    return { allowed: false, reason: "ACTOR_JOB_ROLE_INACTIVE" };
  }

  // 4. Resolve target JobRole
  const targetRole = await JobRole.findById(targetRoleId).lean();
  if (!targetRole || !targetRole.isActive) {
    return { allowed: false, reason: "TARGET_ROLE_INACTIVE_OR_NOT_FOUND" };
  }

  if (targetRole.isSuperadminRole) {
    return { allowed: false, reason: "CANNOT_ASSIGN_SUPERADMIN_ROLE" };
  }

  // 5. Hierarchy check on target role: Same-tier or higher-tier assignment is strictly forbidden
  if (targetRole.tier <= actorJobRole.tier) {
    return {
      allowed: false,
      reason: `CANNOT_ASSIGN_EQUAL_OR_HIGHER_ROLE: Requester tier is ${actorJobRole.tier}, target role tier is ${targetRole.tier}`,
    };
  }

  // 6. Management scope check on target role
  const scopeIds = (actorJobRole.managementScope || []).map((id) => id.toString());
  if (!scopeIds.includes(targetRole._id.toString())) {
    return { allowed: false, reason: "TARGET_ROLE_NOT_IN_MANAGEMENT_SCOPE" };
  }

  // 7. If targeting an existing employee, verify actor can manage target's current authority
  if (targetUserIdOrEmployeeId) {
    const isTargetManageable = await canManageEmployee(actorUser, targetUserIdOrEmployeeId);
    if (!isTargetManageable) {
      return {
        allowed: false,
        reason: "TARGET_EMPLOYEE_BEYOND_AUTHORITY_OR_OUTSIDE_MANAGEMENT_SCOPE",
      };
    }
  }

  return { allowed: true, reason: null };
};

/**
 * Pre-flight preview of an employee role change showing diffs, promotion/demotion, and authority validation.
 */
const previewEmployeeRoleChange = async (actorUser, employeeId, newRoleId) => {
  if (!mongoose.isValidObjectId(employeeId) || !mongoose.isValidObjectId(newRoleId)) {
    throw new AppError("Invalid Employee ID or Role ID", 400, "INVALID_ID");
  }

  let employee = await Employee.findById(employeeId).populate("jobRoleId").lean();
  if (!employee) {
    employee = await Employee.findOne({ userId: employeeId }).populate("jobRoleId").lean();
  }
  if (!employee) {
    throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
  }

  const newRole = await JobRole.findById(newRoleId).populate("managementScope", "name slug tier").lean();
  if (!newRole || !newRole.isActive) {
    throw new AppError("Selected Job Role is not found or inactive", 400, "INVALID_NEW_ROLE");
  }

  const oldRole = employee.jobRoleId || null;
  const oldTier = oldRole ? oldRole.tier : 999;
  const newTier = newRole.tier;

  const isPromotion = newTier < oldTier;
  const isDemotion = newTier > oldTier;
  const isLateral = newTier === oldTier;

  const oldPerms = new Set(oldRole ? oldRole.permissions || [] : []);
  const newPerms = new Set(newRole.permissions || []);

  const addedPermissions = [...newPerms].filter((p) => !oldPerms.has(p));
  const removedPermissions = [...oldPerms].filter((p) => !newPerms.has(p));

  const authEvaluation = await canAssignRole(actorUser, newRoleId, employeeId);

  return {
    employee: {
      id: employee._id,
      employeeNumber: employee.employeeNumber,
      jobTitle: employee.jobTitle,
      department: employee.department,
    },
    oldRole: oldRole
      ? {
          id: oldRole._id,
          name: oldRole.name,
          slug: oldRole.slug,
          tier: oldRole.tier,
          permissionsCount: (oldRole.permissions || []).length,
        }
      : null,
    newRole: {
      id: newRole._id,
      name: newRole.name,
      slug: newRole.slug,
      tier: newRole.tier,
      permissionsCount: (newRole.permissions || []).length,
      managementScope: newRole.managementScope || [],
    },
    oldTier: oldRole ? oldRole.tier : null,
    newTier,
    changeType: isPromotion ? "PROMOTION" : isDemotion ? "DEMOTION" : "LATERAL",
    permissionsDiff: {
      added: addedPermissions,
      removed: removedPermissions,
    },
    allowed: authEvaluation.allowed,
    denialReason: authEvaluation.reason,
  };
};

/**
 * Execute safe role change (promotion, demotion, or lateral re-assignment) for an employee.
 * Enforces two-layer authorization, updates employee, invalidates sessions, and records audit log.
 */
const assignEmployeeJobRole = async (
  actorUser,
  employeeId,
  newRoleId,
  options = {}
) => {
  const { reason = null, req = null } = options;

  const authEvaluation = await canAssignRole(actorUser, newRoleId, employeeId);
  if (!authEvaluation.allowed) {
    throw new AppError(
      `Role assignment unauthorized: ${authEvaluation.reason}`,
      403,
      "FORBIDDEN"
    );
  }

  let employee = await Employee.findById(employeeId).populate("jobRoleId");
  if (!employee) {
    employee = await Employee.findOne({ userId: employeeId }).populate("jobRoleId");
  }
  if (!employee) {
    throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
  }

  const newRole = await JobRole.findById(newRoleId);
  if (!newRole || !newRole.isActive) {
    throw new AppError("Target Job Role is inactive or does not exist", 400, "INVALID_TARGET_ROLE");
  }

  const oldRole = employee.jobRoleId;
  const oldTier = oldRole ? oldRole.tier : 999;
  const newTier = newRole.tier;

  const actionType =
    newTier < oldTier
      ? "EMPLOYEE_PROMOTED"
      : newTier > oldTier
      ? "EMPLOYEE_DEMOTED"
      : "EMPLOYEE_ROLE_CHANGED";

  const beforeState = {
    employeeId: employee._id,
    jobRoleId: oldRole ? oldRole._id : null,
    jobRoleName: oldRole ? oldRole.name : null,
    tier: oldTier,
  };

  employee.jobRoleId = newRole._id;
  await employee.save();

  // Invalidate authorization and sessions for affected employee
  const targetUser = await User.findById(employee.userId);
  if (targetUser) {
    await incrementAuthVersion(targetUser._id);
    await incrementPermissionVersion(targetUser._id);
  }

  const actorId = actorUser._id || actorUser.id;

  await recordAuditLog({
    actorId,
    targetId: employee._id,
    action: actionType,
    entityType: "employee",
    beforeState,
    afterState: {
      employeeId: employee._id,
      jobRoleId: newRole._id,
      jobRoleName: newRole.name,
      tier: newTier,
      reason,
      actionType,
    },
    req,
  });

  return {
    success: true,
    message: `Employee role successfully updated to ${newRole.name} (${actionType})`,
    actionType,
    employee: {
      id: employee._id,
      jobRoleId: newRole._id,
      jobRoleName: newRole.name,
      tier: newRole.tier,
    },
  };
};

module.exports = {
  isSuperadmin,
  getEmployeeJobRole,
  canManageRole,
  canManageEmployee,
  canAssignRole,
  previewEmployeeRoleChange,
  assignEmployeeJobRole,
};
