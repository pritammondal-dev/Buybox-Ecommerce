const mongoose = require("mongoose");
const User = require("../models/User");
const Employee = require("../models/Employee");
const AppError = require("../errors/AppError");
const {
  verifyAccessToken,
  TOKEN_CONTEXTS,
  TOKEN_AUDIENCES,
} = require("../services/token.service");
const { ROLES } = require("../constants/auth.constants");

const ALLOWED_STAFF_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.EDITOR];

/**
 * Core authentication middleware creator.
 *
 * @param {Object} [options]
 * @param {string} [options.expectedContext] - Expected session context ("customer", "vendor", "administrator")
 * @param {string} [options.expectedAudience] - Expected token audience
 * @param {string[]} [options.allowedRoles] - Specific allowed roles
 * @param {boolean} [options.requireActiveEmployee] - Whether active Employee profile is required
 */
const createAuthMiddleware = (options = {}) => {
  return async function authenticate(req, res, next) {
    if (req.user) {
      if (options.expectedContext && req.user.context && req.user.context !== options.expectedContext) {
        return next(
          new AppError(
            `Cross-context session disallowed. Required: ${options.expectedContext}, found: ${req.user.context}`,
            403,
            "INVALID_SESSION_CONTEXT"
          )
        );
      }
      if (options.allowedRoles && !options.allowedRoles.includes(req.user.role)) {
        return next(
          new AppError(
            "You do not have permission to access this resource",
            403,
            "INSUFFICIENT_ROLE"
          )
        );
      }
      return next();
    }

    const authorization = req.get("Authorization");

    if (!authorization) {
      return next(
        new AppError("Authentication required", 401, "AUTHENTICATION_REQUIRED")
      );
    }

    const [scheme, token] = authorization.split(" ");

    if (scheme !== "Bearer" || !token) {
      return next(
        new AppError(
          "Invalid authorization header",
          401,
          "INVALID_AUTHORIZATION_HEADER"
        )
      );
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token, {
        expectedAudience: options.expectedAudience,
      });
    } catch (error) {
      return next(
        new AppError(
          "Invalid or expired access token",
          401,
          "INVALID_ACCESS_TOKEN"
        )
      );
    }

    if (decoded.type !== "access") {
      return next(
        new AppError("Invalid access token", 401, "INVALID_ACCESS_TOKEN")
      );
    }

    // Context Isolation Check
    if (options.expectedContext && decoded.context && decoded.context !== options.expectedContext) {
      return next(
        new AppError(
          `Cross-context session disallowed. Required: ${options.expectedContext}, found: ${decoded.context}`,
          403,
          "INVALID_SESSION_CONTEXT"
        )
      );
    }

    const tokenAuthVersion = Number(decoded.authVersion ?? 1);
    const tokenPermissionVersion = Number(decoded.permissionVersion ?? 1);

    let dbUser = null;
    let dbEmployee = null;

    if (decoded.sub && mongoose.connection.readyState === 1) {
      try {
        const query = User.findById(decoded.sub);
        if (query && typeof query.select === "function") {
          dbUser = await query
            .select("authVersion permissionVersion isActive role")
            .lean();
        } else if (query && typeof query.then === "function") {
          dbUser = await query;
        }

        if (options.requireActiveEmployee && dbUser) {
          dbEmployee = await Employee.findOne({ userId: dbUser._id }).lean();
        }
      } catch (err) {
        dbUser = null;
        dbEmployee = null;
      }
    }

    if (dbUser) {
      if (dbUser.isActive === false) {
        return next(
          new AppError("User account is inactive", 401, "USER_INACTIVE")
        );
      }

      const userAuthVersion = Number(dbUser.authVersion ?? 1);
      if (tokenAuthVersion !== userAuthVersion) {
        return next(
          new AppError(
            "Session expired or invalidated",
            401,
            "AUTH_VERSION_MISMATCH"
          )
        );
      }
    }

    const activeRole = dbUser?.role || decoded.role;

    // Allowed Roles Check
    if (options.allowedRoles && !options.allowedRoles.includes(activeRole)) {
      return next(
        new AppError(
          "You do not have permission to access this resource",
          403,
          "INSUFFICIENT_ROLE"
        )
      );
    }

    // Active Employee check for administrator boundary
    if (options.requireActiveEmployee) {
      if (!dbEmployee) {
        // Superadmin without employee record fallback: only allow if super_admin in DB
        if (activeRole !== ROLES.SUPER_ADMIN) {
          return next(
            new AppError(
              "Staff profile not found. Administrator access denied.",
              403,
              "STAFF_PROFILE_REQUIRED"
            )
          );
        }
      } else if (dbEmployee.status !== "active") {
        return next(
          new AppError(
            "Staff member account is suspended or terminated",
            403,
            "STAFF_SUSPENDED"
          )
        );
      }
    }

    const dbPermissionVersion = dbUser
      ? Number(dbUser.permissionVersion ?? 1)
      : tokenPermissionVersion;
    const isPermissionFresh = tokenPermissionVersion === dbPermissionVersion;

    req.user = {
      id: decoded.sub,
      _id: decoded.sub,
      role: activeRole,
      context: decoded.context || null,
      authVersion: tokenAuthVersion,
      permissionVersion: tokenPermissionVersion,
      dbAuthVersion: dbUser ? Number(dbUser.authVersion ?? 1) : tokenAuthVersion,
      dbPermissionVersion,
      isPermissionFresh,
      employee: dbEmployee,
    };

    next();
  };
};

// Default generic authenticator (backward compatible)
const authenticate = createAuthMiddleware();

// Dedicated Administrator Authenticator
const authenticateAdministrator = createAuthMiddleware({
  expectedContext: TOKEN_CONTEXTS.ADMINISTRATOR,
  allowedRoles: ALLOWED_STAFF_ROLES,
  requireActiveEmployee: true,
});

// Dedicated Customer Authenticator
const authenticateCustomer = createAuthMiddleware({
  expectedContext: TOKEN_CONTEXTS.CUSTOMER,
  allowedRoles: [ROLES.CUSTOMER],
});

// Dedicated Vendor Authenticator
const authenticateVendor = createAuthMiddleware({
  expectedContext: TOKEN_CONTEXTS.VENDOR,
  allowedRoles: [ROLES.VENDOR],
});

authenticate.authenticate = authenticate;
authenticate.authenticateAdministrator = authenticateAdministrator;
authenticate.authenticateCustomer = authenticateCustomer;
authenticate.authenticateVendor = authenticateVendor;
authenticate.createAuthMiddleware = createAuthMiddleware;

module.exports = authenticate;
