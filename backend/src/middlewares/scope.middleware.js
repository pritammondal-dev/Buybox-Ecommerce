const AppError = require("../errors/AppError");
const Employee = require("../models/Employee");
const {
  hasScopeAccess,
  normalizeScopeId,
} = require("../services/scope-authorization.service");
const { ALLOWED_SCOPE_TYPES } = require("../constants/scope.constants");

/**
 * Helper to resolve scopeId from a dot-delimited path on req (e.g. 'params.id', 'body.warehouseId').
 *
 * @param {Object} req Express request
 * @param {string} path Path expression
 * @returns {string|null}
 */
const getScopeIdFromPath = (req, path) => {
  if (!path || typeof path !== "string") return null;
  const parts = path.split(".");
  let current = req;
  for (const part of parts) {
    if (!current || typeof current !== "object") return null;
    current = current[part];
  }
  return normalizeScopeId(current);
};

/**
 * Reusable Scope Authorization Middleware.
 *
 * Enforces that an authenticated employee possesses active WorkAssignment(s)
 * covering the target operational scope (vendor, warehouse, category, support_queue).
 *
 * Requirements:
 * 1. Requires authentication (req.user).
 * 2. Requires an active Employee context (fails closed for customers, vendors, or suspended/terminated staff).
 * 3. Resolves the target resource scopeId.
 * 4. Validates scope access against active WorkAssignments.
 * 5. Fails closed with 403 on unresolved, missing, or mismatched scope.
 * 6. Attaches req.scope = { scopeType, scopeId, employeeId }.
 *
 * @param {Object} options
 * @param {string} options.scopeType Target scope type ('vendor', 'warehouse', 'category', 'support_queue')
 * @param {Function|string} options.resolveScopeId Extractor function (req) => string|Promise<string> OR dot-path on req ('params.id', 'body.vendorId')
 * @param {boolean} [options.allowGlobalPlatformActor=false] If true, an unassigned platform actor operates globally for this scopeType
 * @returns {import("express").RequestHandler}
 */
const requireScope = (options = {}) => {
  const {
    scopeType,
    resolveScopeId,
    allowGlobalPlatformActor = false,
  } = options;

  if (!scopeType || !ALLOWED_SCOPE_TYPES.includes(scopeType)) {
    throw new Error(
      `requireScope middleware requires a valid scopeType from: ${ALLOWED_SCOPE_TYPES.join(", ")}`,
    );
  }

  return async (req, res, next) => {
    try {
      // 1. Authentication Check
      if (!req.user) {
        return next(
          new AppError(
            "Authentication required",
            401,
            "AUTHENTICATION_REQUIRED",
          ),
        );
      }

      // 2. Reject non-employee callers (customers, vendors cannot access employee scopes)
      if (["customer", "vendor"].includes(req.user.role)) {
        return next(
          new AppError(
            "You do not have scope access to this resource",
            403,
            "INSUFFICIENT_SCOPE",
          ),
        );
      }

      // 3. Resolve Employee Profile
      const employee = await Employee.findOne({ userId: req.user.id }).lean();
      if (!employee) {
        return next(
          new AppError(
            "Employee profile required for scoped access",
            403,
            "EMPLOYEE_PROFILE_REQUIRED",
          ),
        );
      }

      // Status Gate: Suspended or Terminated employees receive NO operational scope
      if (employee.status !== "active") {
        return next(
          new AppError(
            "Employee account is not active",
            403,
            "INSUFFICIENT_SCOPE",
          ),
        );
      }

      // 4. Resolve Scope ID
      let rawScopeId = null;
      if (typeof resolveScopeId === "function") {
        rawScopeId = await resolveScopeId(req);
      } else if (typeof resolveScopeId === "string") {
        rawScopeId = getScopeIdFromPath(req, resolveScopeId);
      } else if (req.params && req.params.id) {
        rawScopeId = req.params.id;
      }

      const scopeId = normalizeScopeId(rawScopeId);
      if (!scopeId) {
        // Fail closed: Cannot determine required scope
        return next(
          new AppError(
            "Unable to resolve required scope for resource",
            403,
            "UNRESOLVED_SCOPE",
          ),
        );
      }

      // 5. Evaluate Scope Access
      const isPlatformActor =
        req.auth?.isPlatformActor ??
        !["customer", "vendor"].includes(req.user.role);

      const hasAccess = await hasScopeAccess({
        employeeId: employee._id,
        scopeType,
        scopeId,
        allowGlobal: allowGlobalPlatformActor === true,
        isPlatformActor,
      });

      if (!hasAccess) {
        return next(
          new AppError(
            "You do not have scope access to this resource",
            403,
            "INSUFFICIENT_SCOPE",
          ),
        );
      }

      // 6. Attach Scope Context
      req.scope = {
        scopeType,
        scopeId,
        employeeId: employee._id,
      };

      return next();
    } catch (err) {
      return next(err);
    }
  };
};

module.exports = {
  requireScope,
};
