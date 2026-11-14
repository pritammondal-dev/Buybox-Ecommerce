const crypto = require("crypto");
const mongoose = require("mongoose");
const User = require("../models/User");
const Employee = require("../models/Employee");
const AppError = require("../errors/AppError");
const {
  verifyAccessToken,
  verifyGuestToken,
  generateGuestToken,
  TOKEN_CONTEXTS,
  TOKEN_AUDIENCES,
} = require("../services/token.service");
const { COOKIE_NAMES, guestCookieOptions } = require("../config/cookie");
const { isFeatureEnabled } = require("../services/storefront-settings.service");
const { ROLES, ADMIN_INACTIVITY_TIMEOUT_MS } = require("../constants/auth.constants");

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
      let isStaff = Boolean(
        options.allowPlatformStaff &&
        (req.user.context === TOKEN_CONTEXTS.ADMINISTRATOR ||
          ALLOWED_STAFF_ROLES.includes(req.user.role))
      );
      if (options.allowPlatformStaff && !isStaff && req.user.id && mongoose.connection.readyState === 1) {
        try {
          const hasEmp = await Employee.exists({ userId: req.user.id });
          if (hasEmp) {
            isStaff = true;
          }
        } catch (_) {}
      }

      if (options.expectedContext && req.user.context && req.user.context !== options.expectedContext && !isStaff) {
        return next(
          new AppError(
            `Cross-context session disallowed. Required: ${options.expectedContext}, found: ${req.user.context}`,
            403,
            "INVALID_SESSION_CONTEXT"
          )
        );
      }
      if (options.allowedRoles && !isStaff && !options.allowedRoles.includes(req.user.role)) {
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
      if (options.optional) {
        return next();
      }
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
    let isStaffOverride = Boolean(
      options.allowPlatformStaff &&
      (decoded.context === TOKEN_CONTEXTS.ADMINISTRATOR ||
        ALLOWED_STAFF_ROLES.includes(decoded.role))
    );

    if (options.allowPlatformStaff && !isStaffOverride && decoded.sub && mongoose.connection.readyState === 1) {
      try {
        const hasEmp = await Employee.exists({ userId: decoded.sub });
        if (hasEmp) {
          isStaffOverride = true;
        }
      } catch (_) {}
    }

    if (options.expectedContext && !isStaffOverride && decoded.context !== options.expectedContext) {
      return next(
        new AppError(
          `Cross-context session disallowed. Required: ${options.expectedContext}, found: ${decoded.context || "none"}`,
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
            .select("authVersion permissionVersion isActive deletedAt isEmailVerified role roles adminLastActiveAt")
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
      if (dbUser.isActive === false || dbUser.deletedAt) {
        return next(
          new AppError("User account is inactive or deactivated", 401, "USER_INACTIVE")
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

      // Administrator Session Inactivity Check (30 minutes)
      const isAdministratorSession = Boolean(
        options.expectedContext === TOKEN_CONTEXTS.ADMINISTRATOR ||
        decoded.context === TOKEN_CONTEXTS.ADMINISTRATOR ||
        (options.allowPlatformStaff && isStaffOverride)
      );

      if (isAdministratorSession && dbUser.adminLastActiveAt) {
        const elapsed = Date.now() - new Date(dbUser.adminLastActiveAt).getTime();
        if (elapsed > ADMIN_INACTIVITY_TIMEOUT_MS) {
          return next(
            new AppError(
              "Administrator session has expired due to inactivity. Please log in again.",
              401,
              "ADMIN_INACTIVITY_TIMEOUT"
            )
          );
        }

        // Background polling or automated refreshes do NOT extend inactivity session
        const isBackground = Boolean(
          req.headers["x-background-request"] === "true" ||
          req.headers["x-background-poll"] === "true" ||
          req.query?.background === "true"
        );

        if (!isBackground && elapsed > 60 * 1000) {
          User.updateOne(
            { _id: dbUser._id },
            { $set: { adminLastActiveAt: new Date() } }
          ).exec().catch(() => {});
        }
      }
    }

    const userRoles = Array.isArray(dbUser?.roles) && dbUser.roles.length > 0
      ? dbUser.roles
      : (Array.isArray(decoded.roles) && decoded.roles.length > 0 ? decoded.roles : [dbUser?.role || decoded.role]);

    let activeRole = dbUser?.role || decoded.role;

    // Activate vendor role if user is authorized as vendor and accessing under vendor context or token
    if (
      (decoded.context === TOKEN_CONTEXTS.VENDOR || decoded.role === ROLES.VENDOR) &&
      userRoles.includes(ROLES.VENDOR)
    ) {
      activeRole = ROLES.VENDOR;
    }

    // Allowed Roles Check
    if (options.allowedRoles && !isStaffOverride) {
      const allowed = options.allowPlatformStaff
        ? [...options.allowedRoles, ...ALLOWED_STAFF_ROLES]
        : options.allowedRoles;
      const hasRole =
        allowed.includes(activeRole) ||
        (!["customer", "vendor"].includes(activeRole) &&
          Array.isArray(userRoles) &&
          userRoles.some((r) => allowed.includes(r)));
      if (!hasRole) {
        return next(
          new AppError(
            "You do not have permission to access this resource",
            403,
            "INSUFFICIENT_ROLE"
          )
        );
      }
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

    const resolvedUserId = decoded.sub || decoded.userId || decoded.id || decoded._id;

    req.user = {
      id: resolvedUserId,
      _id: resolvedUserId,
      role: activeRole,
      roles: userRoles,
      context: decoded.context || null,
      isEmailVerified: Boolean(dbUser ? dbUser.isEmailVerified : decoded.isEmailVerified),
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

// Optional authenticator (populates req.user if token present; passes if unauthenticated)
const authenticateOptional = createAuthMiddleware({ optional: true });

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
  allowPlatformStaff: true,
});

// Dedicated Vendor Authenticator
const authenticateVendor = createAuthMiddleware({
  expectedContext: TOKEN_CONTEXTS.VENDOR,
  allowedRoles: [ROLES.VENDOR],
  allowPlatformStaff: true,
});

/**
 * Dual Authenticator: Authenticates registered Customer OR validates/provisions Guest Session.
 * Strictly verifies the authoritative guestCheckout feature flag.
 */
const authenticateGuestOrCustomer = async (req, res, next) => {
  const authorization = req.get("Authorization");
  const hasCustomerSessionCookie = Boolean(
    req.cookies?.[COOKIE_NAMES.CUSTOMER] || req.cookies?.bb_customer_session
  );

  // 1. If customer bearer token or session cookie is present, attempt normal authentication
  if (authorization || hasCustomerSessionCookie) {
    const [scheme, token] = (authorization || "").split(" ");

    // Check if the bearer token is specifically a guest token
    if (scheme === "Bearer" && token) {
      try {
        const guestDecoded = verifyGuestToken(token);
        if (guestDecoded) {
          req.guestId = guestDecoded.guestId || guestDecoded.sub;
          req.isGuest = true;
          req.user = {
            id: req.guestId,
            _id: req.guestId,
            guestId: req.guestId,
            role: "guest",
            context: TOKEN_CONTEXTS.GUEST,
            isGuest: true,
          };
          return next();
        }
      } catch (guestErr) {
        if (guestErr.name === "TokenExpiredError") {
          return next(
            new AppError("Invalid or expired guest session", 401, "INVALID_GUEST_SESSION")
          );
        }
        // Not a guest token or malformed; proceed with standard user authentication
      }
    }

    return authenticate(req, res, (err) => {
      if (!err && req.user) {
        req.isGuest = false;
        return next();
      }
      return next(err);
    });
  }

  // 2. Check for explicit Guest Session headers or cookies
  const guestToken =
    req.get("X-Guest-Session") ||
    req.cookies?.[COOKIE_NAMES.GUEST] ||
    req.cookies?.bb_guest_session;

  if (guestToken) {
    try {
      const decoded = verifyGuestToken(guestToken);
      req.guestId = decoded.guestId || decoded.sub;
      req.isGuest = true;
      req.user = {
        id: req.guestId,
        _id: req.guestId,
        guestId: req.guestId,
        role: "guest",
        context: TOKEN_CONTEXTS.GUEST,
        isGuest: true,
      };
      return next();
    } catch (guestErr) {
      return next(
        new AppError("Invalid or expired guest session", 401, "INVALID_GUEST_SESSION")
      );
    }
  }

  // Check for Order Access Token (e.g. guest viewing order confirmation, status, invoice)
  const orderAccessToken = req.get("X-Order-Token") || req.query?.token;
  if (orderAccessToken) {
    req.isGuest = true;
    req.guestOrderAccessToken = orderAccessToken;
    req.user = {
      id: "guest_token_access",
      _id: "guest_token_access",
      guestOrderAccessToken: orderAccessToken,
      role: "guest",
      context: TOKEN_CONTEXTS.GUEST,
      isGuest: true,
    };
    return next();
  }

  // 3. No credentials provided: authoritative guestCheckout flag check
  const guestCheckoutEnabled = await isFeatureEnabled("guestCheckout");
  if (!guestCheckoutEnabled) {
    return next(
      new AppError(
        "Guest checkout is disabled. Please sign in to complete checkout.",
        403,
        "GUEST_CHECKOUT_DISABLED"
      )
    );
  }

  // 4. Guest checkout enabled: auto-provision cryptographically strong guest session
  const guestId = "gst_" + crypto.randomUUID();
  const token = generateGuestToken({ guestId });
  res.cookie(COOKIE_NAMES.GUEST, token, guestCookieOptions);
  res.setHeader("X-Guest-Session", token);

  req.guestId = guestId;
  req.isGuest = true;
  req.user = {
    id: guestId,
    _id: guestId,
    guestId,
    role: "guest",
    context: TOKEN_CONTEXTS.GUEST,
    isGuest: true,
  };

  return next();
};

/**
 * Payment-route guard supporting authenticated customers AND existing guest/order sessions.
 * Unlike cart/order creation, payment endpoints must reject zero-credential requests with 401
 * rather than silently minting a fresh anonymous guest session or returning 403.
 */
const authenticateExistingGuestOrCustomer = async (req, res, next) => {
  const hasCustomerAuth = Boolean(
    req.get("Authorization") ||
      req.cookies?.[COOKIE_NAMES.CUSTOMER] ||
      req.cookies?.bb_customer_session
  );
  const hasGuestAuth = Boolean(
    req.get("X-Guest-Session") ||
      req.cookies?.[COOKIE_NAMES.GUEST] ||
      req.cookies?.bb_guest_session ||
      req.get("X-Order-Token") ||
      req.query?.token
  );

  if (!hasCustomerAuth && !hasGuestAuth) {
    return next(
      new AppError("Authentication required", 401, "AUTHENTICATION_REQUIRED")
    );
  }

  return authenticateGuestOrCustomer(req, res, next);
};

authenticate.authenticate = authenticate;
authenticate.authenticateOptional = authenticateOptional;
authenticate.authenticateAdministrator = authenticateAdministrator;
authenticate.authenticateCustomer = authenticateCustomer;
authenticate.authenticateVendor = authenticateVendor;
authenticate.authenticateGuestOrCustomer = authenticateGuestOrCustomer;
authenticate.authenticateExistingGuestOrCustomer = authenticateExistingGuestOrCustomer;
authenticate.createAuthMiddleware = createAuthMiddleware;

module.exports = authenticate;
