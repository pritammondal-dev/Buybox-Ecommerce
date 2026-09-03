const AppError = require("../errors/AppError");
const { ROLE_PERMISSIONS } = require("../constants/role-permissions.constants");

const requirePermissions = (...requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(
        new AppError(
          "Authentication required",
          401,
          "AUTHENTICATION_REQUIRED"
        )
      );
    }

    const userPermissions =
      ROLE_PERMISSIONS[req.user.role] || [];

    const hasAllPermissions = requiredPermissions.every(
      (permission) => userPermissions.includes(permission)
    );

    if (!hasAllPermissions) {
      return next(
        new AppError(
          "You do not have permission to perform this action",
          403,
          "INSUFFICIENT_PERMISSIONS"
        )
      );
    }

    next();
  };
};

const requireRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(
        new AppError(
          "Authentication required",
          401,
          "AUTHENTICATION_REQUIRED"
        )
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          "You do not have permission to access this resource",
          403,
          "INSUFFICIENT_ROLE"
        )
      );
    }

    next();
  };
};

module.exports = {
  requirePermissions,
  requireRoles,
};