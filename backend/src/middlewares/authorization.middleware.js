const mongoose = require("mongoose");
const AppError = require("../errors/AppError");
const Employee = require("../models/Employee");
const { ROLE_PERMISSIONS } = require("../constants/role-permissions.constants");
const {
  resolvePermissionAliases,
} = require("../constants/permissions.constants");
const {
  getEffectivePermissions,
} = require("../services/authorization.service");

/**
 * Check whether an effective permission set satisfies all required permissions,
 * including alias resolutions.
 *
 * @param {string[]} effectivePermissions
 * @param {string[]} requiredPermissions
 * @returns {boolean}
 */
const checkPermissionsMatch = (effectivePermissions, requiredPermissions) => {
  if (!effectivePermissions || !Array.isArray(effectivePermissions)) {
    return false;
  }
  const effectiveSet = new Set(effectivePermissions);
  return requiredPermissions.every((reqPerm) => {
    const aliases = resolvePermissionAliases(reqPerm);
    return aliases.some((alias) => effectiveSet.has(alias));
  });
};

const isSuperAdmin = (role) => {
  if (!role) return false;
  const normalized = String(role).toLowerCase().replace(/[-_]/g, "");
  return normalized === "superadmin";
};

const requirePermissions = (...requiredPermissions) => {
  return async (req, res, next) => {
    if (!req.user) {
      return next(
        new AppError("Authentication required", 401, "AUTHENTICATION_REQUIRED"),
      );
    }

    // Superadmin has platform-level authority and bypasses operational permission checks
    if (isSuperAdmin(req.user.role)) {
      req.auth = {
        effectivePermissions: ["*", ...(ROLE_PERMISSIONS[req.user.role] || [])],
        isPlatformActor: true,
      };
      return next();
    }

    // 1. If permissionVersion is STALE (isPermissionFresh === false):
    // Server MUST NOT trust any permission state derived from the stale token/role.
    // Force permission decision to use current authoritative database state.
    if (req.user.isPermissionFresh === false) {
      try {
        const effectivePermissions = await getEffectivePermissions(req.user.id);
        const hasAll = checkPermissionsMatch(
          effectivePermissions,
          requiredPermissions,
        );

        if (!hasAll) {
          return next(
            new AppError(
              "You do not have permission to perform this action",
              403,
              "INSUFFICIENT_PERMISSIONS",
            ),
          );
        }
        req.auth = {
          effectivePermissions,
          isPlatformActor: !["customer", "vendor"].includes(req.user.role),
        };
        return next();
      } catch (err) {
        return next(err);
      }
    }

    // 2. If user is an Employee in the database:
    // Apply full dynamic RBAC/PBAC (active roles + direct grants - direct restrictions)
    if (mongoose.connection.readyState === 1 && req.user.id) {
      try {
        const hasEmployee = await Employee.exists({ userId: req.user.id });
        if (hasEmployee) {
          const effectivePermissions = await getEffectivePermissions(
            req.user.id,
          );
          const hasAll = checkPermissionsMatch(
            effectivePermissions,
            requiredPermissions,
          );

          if (!hasAll) {
            return next(
              new AppError(
                "You do not have permission to perform this action",
                403,
                "INSUFFICIENT_PERMISSIONS",
              ),
            );
          }
          req.auth = {
            effectivePermissions,
            isPlatformActor: !["customer", "vendor"].includes(req.user.role),
          };
          return next();
        }
      } catch (err) {
        // Fall through to legacy role evaluation if query fails
      }
    }

    // 3. Backward Compatibility Fallback:
    // For customers, vendors, or mock/legacy callers without an Employee record
    let userPermissions = [
      ...(Array.isArray(req.user.permissions) ? req.user.permissions : []),
      ...(Array.isArray(req.user.effectivePermissions) ? req.user.effectivePermissions : []),
      ...(ROLE_PERMISSIONS[req.user.role] || []),
    ];
    // Legitimate role aggregation only within the same security domain (never across customer/vendor boundaries)
    if (!["customer", "vendor"].includes(req.user.role) && Array.isArray(req.user.roles) && req.user.roles.length > 0) {
      const allPerms = new Set(userPermissions);
      req.user.roles.forEach((r) => {
        if (!["customer", "vendor"].includes(r)) {
          (ROLE_PERMISSIONS[r] || []).forEach((p) => allPerms.add(p));
        }
      });
      userPermissions = Array.from(allPerms);
    }

    const hasAllPermissions = checkPermissionsMatch(
      userPermissions,
      requiredPermissions,
    );

    if (!hasAllPermissions) {
      return next(
        new AppError(
          "You do not have permission to perform this action",
          403,
          "INSUFFICIENT_PERMISSIONS",
        ),
      );
    }

    req.auth = {
      effectivePermissions: userPermissions,
      isPlatformActor: !["customer", "vendor"].includes(req.user.role),
    };

    next();
  };
};

const requireRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(
        new AppError("Authentication required", 401, "AUTHENTICATION_REQUIRED"),
      );
    }

    // Superadmin bypasses role requirements
    if (isSuperAdmin(req.user.role)) {
      return next();
    }

    // Authorize based on validated active session role (never grant privileges across customer/vendor boundary)
    const flatRoles = allowedRoles.flat();
    const hasRole =
      flatRoles.includes(req.user.role) ||
      (!["customer", "vendor"].includes(req.user.role) &&
        Array.isArray(req.user.roles) &&
        req.user.roles.some((r) => flatRoles.includes(r)));

    if (!hasRole) {
      return next(
        new AppError(
          "You do not have permission to access this resource",
          403,
          "INSUFFICIENT_ROLE",
        ),
      );
    }

    next();
  };
};

module.exports = {
  requirePermissions,
  requireRoles,
  checkPermissionsMatch,
};
