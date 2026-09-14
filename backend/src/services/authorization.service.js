const User = require("../models/User");
const Employee = require("../models/Employee");
const Role = require("../models/Role");
const Permission = require("../models/Permission");
const RolePermission = require("../models/RolePermission");
const EmployeeRole = require("../models/EmployeeRole");
const EmployeePermissionGrant = require("../models/EmployeePermissionGrant");
const EmployeePermissionRestriction = require("../models/EmployeePermissionRestriction");
const { ROLE_PERMISSIONS } = require("../constants/role-permissions.constants");
const AppError = require("../errors/AppError");

/**
 * Consistent expiration & active evaluation helper.
 * A record is effective only when isActive === true AND (expiresAt is null or expiresAt > now).
 *
 * @param {Object} record
 * @param {Date} now
 * @returns {boolean}
 */
const isRecordActiveAndNotExpired = (record, now = new Date()) => {
  if (!record || record.isActive !== true) {
    return false;
  }
  if (record.expiresAt && new Date(record.expiresAt) <= now) {
    return false;
  }
  return true;
};

/**
 * Resolve effective permissions for a user identity.
 *
 * Formula:
 * Effective Permissions = (Active Role Permissions ∪ Active Direct Grants) − Active Direct Restrictions
 *
 * Direct Restriction ALWAYS wins over an inherited role permission or direct grant.
 *
 * @param {string|import("mongoose").Types.ObjectId} userId
 * @param {Object} [options]
 * @param {Date} [options.now] Optional reference time for testing expiration
 * @returns {Promise<string[]>} Sorted array of unique granted permission slugs
 */
const getEffectivePermissions = async (userId, options = {}) => {
  if (!userId) {
    return [];
  }

  const now = options.now instanceof Date ? options.now : new Date();

  // 1. Resolve User
  const user = await User.findById(userId).lean();
  if (!user || user.isActive === false) {
    return [];
  }

  // 2. Resolve Employee Profile
  const employee = await Employee.findOne({ userId: user._id }).lean();

  // If user has no Employee profile:
  if (!employee) {
    // Customer and Vendor fallback: return legacy permissions
    if (["customer", "vendor"].includes(user.role)) {
      const legacy = ROLE_PERMISSIONS[user.role] || [];
      return [...new Set(legacy)].sort();
    }
    // Privileged role without Employee profile gets no permissions
    return [];
  }

  // 3. Status Gate: Suspended or Terminated employees receive NO privileged permissions
  if (employee.status !== "active") {
    return [];
  }

  // 4. Resolve Active, Non-Expired Role Permissions
  const activeEmployeeRoles = await EmployeeRole.find({
    employeeId: employee._id,
    isActive: true,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  }).lean();

  const roleIds = activeEmployeeRoles.map((er) => er.roleId);

  let rolePermissions = new Set();
  if (roleIds.length > 0) {
    // Only query permissions for active Roles
    const activeRoles = await Role.find({
      _id: { $in: roleIds },
      isActive: true,
    }).lean();

    const activeRoleIds = activeRoles.map((r) => r._id);

    if (activeRoleIds.length > 0) {
      const rolePermissionMappings = await RolePermission.find({
        roleId: { $in: activeRoleIds },
      }).lean();

      const permissionIds = rolePermissionMappings.map(
        (rpm) => rpm.permissionId,
      );

      if (permissionIds.length > 0) {
        const activePermissions = await Permission.find({
          _id: { $in: permissionIds },
          isActive: true,
        }).lean();

        for (const p of activePermissions) {
          rolePermissions.add(p.slug);
        }
      }
    }
  }

  // 5. Resolve Active, Non-Expired Direct Grants (+)
  const activeGrants = await EmployeePermissionGrant.find({
    employeeId: employee._id,
    isActive: true,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  }).lean();

  const grantPermissionIds = activeGrants.map((g) => g.permissionId);
  let directGrants = new Set();
  if (grantPermissionIds.length > 0) {
    const activeGrantPermissions = await Permission.find({
      _id: { $in: grantPermissionIds },
      isActive: true,
    }).lean();

    for (const p of activeGrantPermissions) {
      directGrants.add(p.slug);
    }
  }

  // 6. Resolve Active, Non-Expired Direct Restrictions (-)
  const activeRestrictions = await EmployeePermissionRestriction.find({
    employeeId: employee._id,
    isActive: true,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  }).lean();

  const restrictionPermissionIds = activeRestrictions.map(
    (r) => r.permissionId,
  );
  let directRestrictions = new Set();
  if (restrictionPermissionIds.length > 0) {
    const activeRestrictionPermissions = await Permission.find({
      _id: { $in: restrictionPermissionIds },
      isActive: true,
    }).lean();

    for (const p of activeRestrictionPermissions) {
      directRestrictions.add(p.slug);
    }
  }

  // 7. Calculate Union of Roles and Grants
  const grantedUnion = new Set([...rolePermissions, ...directGrants]);

  // 8. Apply Subtractive Direct Restrictions (Direct Restriction Dominance)
  const effectivePermissions = [];
  for (const slug of grantedUnion) {
    if (!directRestrictions.has(slug)) {
      effectivePermissions.push(slug);
    }
  }

  return effectivePermissions.sort();
};

/**
 * Check if a user possesses a specific permission.
 *
 * @param {string|import("mongoose").Types.ObjectId} userId
 * @param {string} permission
 * @param {Object} [options]
 * @returns {Promise<boolean>}
 */
const hasPermission = async (userId, permission, options = {}) => {
  if (!permission || typeof permission !== "string") {
    return false;
  }
  const effective = await getEffectivePermissions(userId, options);
  return effective.includes(permission);
};

/**
 * Check if a user possesses at least one of the specified permissions.
 *
 * @param {string|import("mongoose").Types.ObjectId} userId
 * @param {string[]} permissions
 * @param {Object} [options]
 * @returns {Promise<boolean>}
 */
const hasAnyPermission = async (userId, permissions = [], options = {}) => {
  if (!Array.isArray(permissions) || permissions.length === 0) {
    return false;
  }
  const effective = await getEffectivePermissions(userId, options);
  const effectiveSet = new Set(effective);
  return permissions.some((perm) => effectiveSet.has(perm));
};

/**
 * Check if a user possesses all of the specified permissions.
 *
 * @param {string|import("mongoose").Types.ObjectId} userId
 * @param {string[]} permissions
 * @param {Object} [options]
 * @returns {Promise<boolean>}
 */
const hasAllPermissions = async (userId, permissions = [], options = {}) => {
  if (!Array.isArray(permissions) || permissions.length === 0) {
    return false;
  }
  const effective = await getEffectivePermissions(userId, options);
  const effectiveSet = new Set(effective);
  return permissions.every((perm) => effectiveSet.has(perm));
};

/**
 * Increment User authVersion to immediately invalidate all existing sessions/tokens.
 * Used for password changes, account deactivations, or security incidents.
 *
 * @param {string|import("mongoose").Types.ObjectId} userId
 * @returns {Promise<{ authVersion: number }>}
 */
const incrementAuthVersion = async (userId) => {
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $inc: { authVersion: 1 } },
    { returnDocument: "after" },
  );

  if (!updatedUser) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  return { authVersion: updatedUser.authVersion };
};

/**
 * Increment User permissionVersion to invalidate cached authorization contexts.
 * Used when role assignments, grants, restrictions, or employee status changes.
 *
 * @param {string|import("mongoose").Types.ObjectId} userId
 * @returns {Promise<{ permissionVersion: number }>}
 */
const incrementPermissionVersion = async (userId) => {
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $inc: { permissionVersion: 1 } },
    { returnDocument: "after" },
  );

  if (!updatedUser) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  return { permissionVersion: updatedUser.permissionVersion };
};

/**
 * Validate token version claims against authoritative User database state.
 *
 * @param {Object} user User document from database
 * @param {Object} tokenPayload Decoded JWT payload
 * @returns {{ isAuthValid: boolean, isPermissionFresh: boolean, reason?: string }}
 */
const verifyTokenVersions = (user, tokenPayload = {}) => {
  if (!user) {
    return {
      isAuthValid: false,
      isPermissionFresh: false,
      reason: "USER_NOT_FOUND",
    };
  }

  if (user.isActive === false) {
    return {
      isAuthValid: false,
      isPermissionFresh: false,
      reason: "USER_INACTIVE",
    };
  }

  const tokenAuthVersion = Number(tokenPayload.authVersion ?? 1);
  const userAuthVersion = Number(user.authVersion ?? 1);

  if (tokenAuthVersion !== userAuthVersion) {
    return {
      isAuthValid: false,
      isPermissionFresh: false,
      reason: "AUTH_VERSION_MISMATCH",
    };
  }

  const tokenPermissionVersion = Number(tokenPayload.permissionVersion ?? 1);
  const userPermissionVersion = Number(user.permissionVersion ?? 1);

  const isPermissionFresh = tokenPermissionVersion === userPermissionVersion;

  return {
    isAuthValid: true,
    isPermissionFresh,
    reason: isPermissionFresh ? null : "PERMISSION_VERSION_STALE",
  };
};

module.exports = {
  isRecordActiveAndNotExpired,
  getEffectivePermissions,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  incrementAuthVersion,
  incrementPermissionVersion,
  verifyTokenVersions,
};
