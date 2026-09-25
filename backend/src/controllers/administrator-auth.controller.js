const User = require("../models/User");
const Employee = require("../models/Employee");
const RefreshToken = require("../models/RefreshToken");
const AppError = require("../errors/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const { comparePassword } = require("../utils/password");
const { hashToken } = require("../utils/token-hash");
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  TOKEN_CONTEXTS,
  TOKEN_AUDIENCES,
} = require("../services/token.service");
const { rotateRefreshToken } = require("../services/refresh-token.service");
const { getEffectivePermissions } = require("../services/authorization.service");
const {
  COOKIE_NAMES,
  administratorCookieOptions,
} = require("../config/cookie");
const { ROLES } = require("../constants/auth.constants");

const ALLOWED_STAFF_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.EDITOR];

/**
 * Administrator Login
 * Authenticates internal staff accounts only (SUPERADMIN, ADMIN, EDITOR).
 * Rejects customer and vendor accounts. Rejects inactive or suspended staff.
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError("Email and password are required", 400, "MISSING_CREDENTIALS");
  }

  const normalizedEmail = String(email).toLowerCase().trim();

  const user = await User.findOne({
    email: normalizedEmail,
  }).select("+password");

  if (!user) {
    throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }

  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }

  // Check user active status
  if (!user.isActive) {
    throw new AppError("User account is inactive", 403, "ACCOUNT_INACTIVE");
  }

  // Reject Customer accounts
  if (user.role === ROLES.CUSTOMER) {
    throw new AppError(
      "Access restricted. Customer accounts cannot access the administrator portal.",
      403,
      "CUSTOMER_ACCESS_DENIED"
    );
  }

  // Reject Vendor accounts
  if (user.role === ROLES.VENDOR) {
    throw new AppError(
      "Access restricted. Vendor accounts cannot access the administrator portal.",
      403,
      "VENDOR_ACCESS_DENIED"
    );
  }

  // Reject any non-staff roles
  if (!ALLOWED_STAFF_ROLES.includes(user.role)) {
    throw new AppError(
      "Access restricted. Privileged staff credentials required.",
      403,
      "INSUFFICIENT_ROLE"
    );
  }

  // Check Employee profile status
  const employee = await Employee.findOne({ userId: user._id });
  if (employee && employee.status !== "active") {
    throw new AppError(
      "Staff member account is suspended or terminated",
      403,
      "STAFF_SUSPENDED"
    );
  }

  // Generate tokens with administrator context and audience
  const accessToken = generateAccessToken(
    {
      sub: user._id.toString(),
      role: user.role,
      authVersion: user.authVersion || 1,
      permissionVersion: user.permissionVersion || 1,
    },
    {
      context: TOKEN_CONTEXTS.ADMINISTRATOR,
      audience: TOKEN_AUDIENCES.ADMINISTRATOR,
    }
  );

  const refreshToken = generateRefreshToken(
    {
      sub: user._id.toString(),
    },
    {
      context: TOKEN_CONTEXTS.ADMINISTRATOR,
      audience: TOKEN_AUDIENCES.ADMINISTRATOR,
    }
  );

  const decodedRefreshToken = verifyRefreshToken(refreshToken, {
    expectedContext: TOKEN_CONTEXTS.ADMINISTRATOR,
    expectedAudience: TOKEN_AUDIENCES.ADMINISTRATOR,
  });

  await RefreshToken.create({
    userId: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(decodedRefreshToken.exp * 1000),
    createdByIp: req.ip,
    userAgent: req.get("user-agent") || null,
  });

  user.lastLoginAt = new Date();
  await user.save();

  // Set administrator-specific session cookie
  res.cookie(
    COOKIE_NAMES.ADMINISTRATOR,
    refreshToken,
    administratorCookieOptions
  );

  // Authoritative permissions from DB
  const permissions = await getEffectivePermissions(user._id);

  return sendSuccess(res, {
    statusCode: 200,
    message: "Administrator authentication successful",
    data: {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        employeeNumber: employee?.employeeNumber || null,
        jobTitle: employee?.jobTitle || null,
        department: employee?.department || null,
      },
      accessToken,
      permissions,
    },
  });
});

/**
 * Administrator Token Refresh
 * Rotates the administrator refresh token and issues a new administrator access token.
 */
const refresh = asyncHandler(async (req, res) => {
  const refreshToken =
    req.cookies?.[COOKIE_NAMES.ADMINISTRATOR] ||
    req.cookies?.bb_administrator_session ||
    req.body?.refreshToken;

  if (!refreshToken) {
    throw new AppError(
      "Administrator refresh token is required",
      401,
      "REFRESH_TOKEN_REQUIRED"
    );
  }

  const result = await rotateRefreshToken({
    refreshToken,
    ipAddress: req.ip,
    userAgent: req.get("user-agent") || null,
    expectedContext: TOKEN_CONTEXTS.ADMINISTRATOR,
    allowedRoles: ALLOWED_STAFF_ROLES,
  });

  res.cookie(
    COOKIE_NAMES.ADMINISTRATOR,
    result.refreshToken,
    administratorCookieOptions
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: "Administrator token refreshed successfully",
    data: {
      accessToken: result.accessToken,
    },
  });
});

/**
 * Administrator Logout
 * Revokes administrator session and clears administrator session cookie.
 */
const logout = asyncHandler(async (req, res) => {
  const refreshToken =
    req.cookies?.[COOKIE_NAMES.ADMINISTRATOR] ||
    req.cookies?.bb_administrator_session ||
    req.body?.refreshToken;

  if (refreshToken) {
    try {
      const decoded = verifyRefreshToken(refreshToken, {
        expectedContext: TOKEN_CONTEXTS.ADMINISTRATOR,
      });

      await RefreshToken.findOneAndUpdate(
        {
          tokenHash: hashToken(refreshToken),
          userId: decoded.sub,
          revokedAt: null,
        },
        {
          revokedAt: new Date(),
          revokedByIp: req.ip,
        }
      );
    } catch {
      // Safe logout even if token expired or invalid
    }
  }

  res.clearCookie(COOKIE_NAMES.ADMINISTRATOR, {
    httpOnly: true,
    secure: administratorCookieOptions.secure,
    sameSite: administratorCookieOptions.sameSite,
    path: administratorCookieOptions.path,
  });

  return sendSuccess(res, {
    statusCode: 200,
    message: "Administrator logout successful",
    data: null,
  });
});

/**
 * Administrator Current Staff Profile & Permissions
 */
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).lean();
  if (!user || !user.isActive) {
    throw new AppError("Staff account not found or inactive", 404, "USER_NOT_FOUND");
  }

  const employee = await Employee.findOne({ userId: user._id }).lean();
  if (employee && employee.status !== "active") {
    throw new AppError("Staff member account is suspended", 403, "STAFF_SUSPENDED");
  }

  const permissions = await getEffectivePermissions(user._id);

  return sendSuccess(res, {
    statusCode: 200,
    message: "Administrator session valid",
    data: {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        employeeNumber: employee?.employeeNumber || null,
        jobTitle: employee?.jobTitle || null,
        department: employee?.department || null,
      },
      permissions,
    },
  });
});

module.exports = {
  login,
  refresh,
  logout,
  getMe,
};
