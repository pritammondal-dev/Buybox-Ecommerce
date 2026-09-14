const mongoose = require("mongoose");
const AppError = require("../errors/AppError");
const Employee = require("../models/Employee");
const { ROLE_PERMISSIONS } = require("../constants/role-permissions.constants");
const {
  getEffectivePermissions,
} = require("../services/authorization.service");

const requirePermissions = (...requiredPermissions) => {
  return async (req, res, next) => {
    if (!req.user) {
      return next(
        new AppError("Authentication required", 401, "AUTHENTICATION_REQUIRED"),
      );
    }

    // 1. If permissionVersion is STALE (isPermissionFresh === false):
    // Server MUST NOT trust any permission state derived from the stale token/role.
    // Force permission decision to use current authoritative database state.
    if (req.user.isPermissionFresh === false) {
      try {
        const effectivePermissions = await getEffectivePermissions(req.user.id);
        const hasAll = requiredPermissions.every((permission) =>
          effectivePermissions.includes(permission),
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
          const hasAll = requiredPermissions.every((permission) =>
            effectivePermissions.includes(permission),
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
    const userPermissions = ROLE_PERMISSIONS[req.user.role] || [];

    const hasAllPermissions = requiredPermissions.every((permission) =>
      userPermissions.includes(permission),
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

    if (!allowedRoles.includes(req.user.role)) {
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
};
