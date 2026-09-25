const User = require("../models/User");
const Vendor = require("../models/Vendor");
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
const {
  COOKIE_NAMES,
  vendorCookieOptions,
} = require("../config/cookie");
const { ROLES } = require("../constants/auth.constants");

/**
 * Vendor Login
 * Authenticates vendor accounts only.
 * Rejects customer and internal staff accounts.
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

  if (!user.isActive) {
    throw new AppError("User account is inactive", 403, "ACCOUNT_INACTIVE");
  }

  // Reject Customer accounts
  if (user.role === ROLES.CUSTOMER) {
    throw new AppError(
      "Your account is registered as a Customer. Please sign in with your Seller account credentials or apply as a new vendor.",
      403,
      "CUSTOMER_ACCESS_DENIED"
    );
  }

  // Reject internal staff accounts
  if ([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.EDITOR].includes(user.role)) {
    throw new AppError(
      "Access restricted. Internal staff accounts cannot sign in through the vendor portal.",
      403,
      "STAFF_ACCESS_DENIED"
    );
  }

  // Require Vendor role
  if (user.role !== ROLES.VENDOR) {
    throw new AppError(
      "Access restricted. Vendor credentials required.",
      403,
      "INSUFFICIENT_ROLE"
    );
  }

  const vendor = await Vendor.findOne({ userId: user._id });

  // Generate tokens with vendor context and audience
  const accessToken = generateAccessToken(
    {
      sub: user._id.toString(),
      role: user.role,
      authVersion: user.authVersion || 1,
      permissionVersion: user.permissionVersion || 1,
    },
    {
      context: TOKEN_CONTEXTS.VENDOR,
      audience: TOKEN_AUDIENCES.VENDOR,
    }
  );

  const refreshToken = generateRefreshToken(
    {
      sub: user._id.toString(),
    },
    {
      context: TOKEN_CONTEXTS.VENDOR,
      audience: TOKEN_AUDIENCES.VENDOR,
    }
  );

  const decodedRefreshToken = verifyRefreshToken(refreshToken, {
    expectedContext: TOKEN_CONTEXTS.VENDOR,
    expectedAudience: TOKEN_AUDIENCES.VENDOR,
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

  // Set vendor-specific session cookie
  res.cookie(
    COOKIE_NAMES.VENDOR,
    refreshToken,
    vendorCookieOptions
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: "Vendor authentication successful",
    data: {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isEmailVerified: Boolean(user.isEmailVerified),
        vendor: vendor
          ? {
              id: vendor._id,
              businessName: vendor.businessName,
              businessSlug: vendor.businessSlug,
              onboardingStatus: vendor.onboardingStatus,
              isActive: vendor.isActive,
            }
          : null,
      },
      accessToken,
    },
  });
});

/**
 * Vendor Token Refresh
 */
const refresh = asyncHandler(async (req, res) => {
  const refreshToken =
    req.cookies?.[COOKIE_NAMES.VENDOR] ||
    req.cookies?.bb_vendor_session ||
    req.body?.refreshToken;

  if (!refreshToken) {
    throw new AppError(
      "Vendor refresh token is required",
      401,
      "REFRESH_TOKEN_REQUIRED"
    );
  }

  const result = await rotateRefreshToken({
    refreshToken,
    ipAddress: req.ip,
    userAgent: req.get("user-agent") || null,
    expectedContext: TOKEN_CONTEXTS.VENDOR,
    allowedRoles: [ROLES.VENDOR],
  });

  res.cookie(
    COOKIE_NAMES.VENDOR,
    result.refreshToken,
    vendorCookieOptions
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: "Vendor token refreshed successfully",
    data: {
      accessToken: result.accessToken,
    },
  });
});

/**
 * Vendor Logout
 */
const logout = asyncHandler(async (req, res) => {
  const refreshToken =
    req.cookies?.[COOKIE_NAMES.VENDOR] ||
    req.cookies?.bb_vendor_session ||
    req.body?.refreshToken;

  if (refreshToken) {
    try {
      const decoded = verifyRefreshToken(refreshToken, {
        expectedContext: TOKEN_CONTEXTS.VENDOR,
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
      // Safe logout
    }
  }

  res.clearCookie(COOKIE_NAMES.VENDOR, {
    httpOnly: true,
    secure: vendorCookieOptions.secure,
    sameSite: vendorCookieOptions.sameSite,
    path: vendorCookieOptions.path,
  });

  return sendSuccess(res, {
    statusCode: 200,
    message: "Vendor logout successful",
    data: null,
  });
});

module.exports = {
  login,
  refresh,
  logout,
};
