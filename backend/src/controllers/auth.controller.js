const AppError = require("../errors/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const authService = require("../services/auth.service");
const {
  rotateRefreshToken,
} = require("../services/refresh-token.service");
const {
  revokeAllUserSessions,
} = require("../services/session.service");

const crypto = require("crypto");
const {
  COOKIE_NAMES,
  customerCookieOptions,
  guestCookieOptions,
  refreshCookieOptions,
} = require("../config/cookie");
const {
  generateGuestToken,
  verifyGuestToken,
} = require("../services/token.service");
const { isFeatureEnabled } = require("../services/storefront-settings.service");

const register = asyncHandler(async (req, res) => {
  const user = await authService.registerUser(req.body);

  return sendSuccess(res, {
    statusCode: 201,
    message: "User registered successfully",
    data: {
      user,
    },
  });
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.loginUser({
    ...req.body,
    ipAddress: req.ip,
    userAgent: req.get("user-agent") || null,
  });

  res.cookie(
    COOKIE_NAMES.CUSTOMER,
    result.refreshToken,
    customerCookieOptions
  );
  res.cookie(
    COOKIE_NAMES.LEGACY_REFRESH,
    result.refreshToken,
    customerCookieOptions
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: "Login successful",
    data: {
      user: result.user,
      accessToken: result.accessToken,
      permissions: result.user.permissions || [],
    },
  });
});

const refresh = asyncHandler(async (req, res) => {
  const refreshToken =
    req.refreshToken ||
    req.cookies?.[COOKIE_NAMES.CUSTOMER] ||
    req.cookies?.[COOKIE_NAMES.LEGACY_REFRESH] ||
    req.body?.refreshToken;

  if (!refreshToken) {
    throw new AppError(
      "Refresh token is required",
      401,
      "REFRESH_TOKEN_REQUIRED"
    );
  }

  const result = await rotateRefreshToken({
    refreshToken,
    ipAddress: req.ip,
    userAgent: req.get("user-agent") || null,
    expectedContext: "customer",
    allowedRoles: ["customer"],
  });

  res.cookie(
    COOKIE_NAMES.CUSTOMER,
    result.refreshToken,
    customerCookieOptions
  );
  res.cookie(
    COOKIE_NAMES.LEGACY_REFRESH,
    result.refreshToken,
    customerCookieOptions
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: "Token refreshed successfully",
    data: {
      accessToken: result.accessToken,
    },
  });
});

const logout = asyncHandler(async (req, res) => {
  const refreshToken =
    req.refreshToken ||
    req.cookies?.[COOKIE_NAMES.CUSTOMER] ||
    req.cookies?.[COOKIE_NAMES.LEGACY_REFRESH] ||
    req.body?.refreshToken;

  const {
    verifyRefreshToken,
  } = require("../services/token.service");

  const { hashToken } = require("../utils/token-hash");
  const RefreshToken = require("../models/RefreshToken");

  if (refreshToken) {
    try {
      const decoded = verifyRefreshToken(refreshToken, {
        expectedContext: "customer",
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
    } catch (error) {
      // Logout should remain safe even if the token is already invalid.
    }
  }

  const clearOpts = {
    httpOnly: true,
    secure: customerCookieOptions.secure,
    sameSite: customerCookieOptions.sameSite,
    path: customerCookieOptions.path,
  };

  res.clearCookie(COOKIE_NAMES.CUSTOMER, clearOpts);
  res.clearCookie(COOKIE_NAMES.LEGACY_REFRESH, clearOpts);

  return sendSuccess(res, {
    statusCode: 200,
    message: "Logout successful",
    data: null,
  });
});

const logoutAll = asyncHandler(async (req, res) => {
  const result = await revokeAllUserSessions({
    userId: req.user.id,
    ipAddress: req.ip,
  });

  return sendSuccess(res, {
    statusCode: 200,
    message: "All sessions logged out successfully",
    data: result,
  });
});

const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.query;

  const user = await authService.verifyEmail(token);

  return sendSuccess(res, {
    statusCode: 200,
    message: "Email verified successfully",
    data: {
      user,
    },
  });
});

const verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp, purpose } = req.body;

  const user = await authService.verifyEmailOtp({ email, otp, purpose });

  return sendSuccess(res, {
    statusCode: 200,
    message: "Email verified successfully",
    data: {
      user,
    },
  });
});

const resendOtp = asyncHandler(async (req, res) => {
  const { email, purpose } = req.body;

  const result = await authService.resendOtp({ email, purpose });

  return sendSuccess(res, {
    statusCode: 200,
    message: "Verification code sent to your email",
    data: result,
  });
});

const requestPasswordReset = asyncHandler(async (req, res) => {
  await authService.requestPasswordReset(req.body.email);

  return sendSuccess(res, {
    statusCode: 200,
    message:
      "If the email is registered, a password reset link has been sent",
    data: null,
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  const user = await authService.resetPassword(
    token,
    newPassword
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: "Password reset successfully",
    data: {
      user,
    },
  });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  await authService.changePassword({
    userId: req.user.id,
    currentPassword,
    newPassword,
    ipAddress: req.ip,
  });

  return sendSuccess(res, {
    statusCode: 200,
    message: "Password changed successfully",
    data: null,
  });
});

const setCustomerAuthCookies = (res, refreshToken) => {
  res.cookie(
    COOKIE_NAMES.CUSTOMER,
    refreshToken,
    customerCookieOptions
  );
  res.cookie(
    COOKIE_NAMES.LEGACY_REFRESH,
    refreshToken,
    customerCookieOptions
  );
};

const loginWithEmailOtpRequest = asyncHandler(async (req, res) => {
  const result = await authService.requestEmailLoginOtp({
    email: req.body.email,
    ipAddress: req.ip,
  });

  return sendSuccess(res, {
    statusCode: 200,
    message: result.message || "Verification code sent to your email",
    data: result,
  });
});

const loginWithEmailOtpVerify = asyncHandler(async (req, res) => {
  const result = await authService.verifyEmailLoginOtp({
    email: req.body.email,
    otp: req.body.otp,
    ipAddress: req.ip,
    userAgent: req.get("user-agent") || null,
  });

  setCustomerAuthCookies(res, result.refreshToken);

  return sendSuccess(res, {
    statusCode: 200,
    message: "Login successful",
    data: {
      user: result.user,
      accessToken: result.accessToken,
      permissions: result.user.permissions || [],
    },
  });
});

const loginWithPhoneOtpRequest = asyncHandler(async (req, res) => {
  const result = await authService.requestPhoneLoginOtp({
    phone: req.body.phone,
    ipAddress: req.ip,
  });

  return sendSuccess(res, {
    statusCode: 200,
    message: result.message || "Verification code sent to your mobile phone",
    data: result,
  });
});

const loginWithPhoneOtpVerify = asyncHandler(async (req, res) => {
  const result = await authService.verifyPhoneLoginOtp({
    phone: req.body.phone,
    otp: req.body.otp,
    ipAddress: req.ip,
    userAgent: req.get("user-agent") || null,
  });

  setCustomerAuthCookies(res, result.refreshToken);

  return sendSuccess(res, {
    statusCode: 200,
    message: "Login successful",
    data: {
      user: result.user,
      accessToken: result.accessToken,
      permissions: result.user.permissions || [],
    },
  });
});

const registerWithPhoneRequest = asyncHandler(async (req, res) => {
  const result = await authService.requestPhoneRegister({
    phone: req.body.phone,
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    ipAddress: req.ip,
  });

  return sendSuccess(res, {
    statusCode: 200,
    message: "Verification code sent to your mobile phone",
    data: result,
  });
});

const registerWithPhoneVerify = asyncHandler(async (req, res) => {
  const result = await authService.verifyPhoneRegister({
    phone: req.body.phone,
    otp: req.body.otp,
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    ipAddress: req.ip,
    userAgent: req.get("user-agent") || null,
  });

  setCustomerAuthCookies(res, result.refreshToken);

  return sendSuccess(res, {
    statusCode: 201,
    message: "Registration and login successful",
    data: {
      user: result.user,
      accessToken: result.accessToken,
      permissions: result.user.permissions || [],
    },
  });
});

const loginWithGoogle = asyncHandler(async (req, res) => {
  const result = await authService.authenticateGoogleUser({
    idToken: req.body.idToken,
    ipAddress: req.ip,
    userAgent: req.get("user-agent") || null,
  });

  setCustomerAuthCookies(res, result.refreshToken);

  return sendSuccess(res, {
    statusCode: 200,
    message: "Google sign-in successful",
    data: {
      user: result.user,
      accessToken: result.accessToken,
      permissions: result.user.permissions || [],
    },
  });
});

const changeEmailRequest = asyncHandler(async (req, res) => {
  const result = await authService.requestChangeEmail({
    userId: req.user.id,
    newEmail: req.body.newEmail,
    ipAddress: req.ip,
  });

  return sendSuccess(res, {
    statusCode: 200,
    message: "Verification code sent to your new email address",
    data: result,
  });
});

const changeEmailVerify = asyncHandler(async (req, res) => {
  const result = await authService.verifyChangeEmail({
    userId: req.user.id,
    newEmail: req.body.newEmail,
    otp: req.body.otp,
    ipAddress: req.ip,
  });

  return sendSuccess(res, {
    statusCode: 200,
    message: "Email address updated successfully",
    data: result,
  });
});

const changePhoneRequest = asyncHandler(async (req, res) => {
  const result = await authService.requestChangePhone({
    userId: req.user.id,
    newPhone: req.body.newPhone,
    ipAddress: req.ip,
  });

  return sendSuccess(res, {
    statusCode: 200,
    message: "Verification code sent to your new mobile number",
    data: result,
  });
});

const changePhoneVerify = asyncHandler(async (req, res) => {
  const result = await authService.verifyChangePhone({
    userId: req.user.id,
    newPhone: req.body.newPhone,
    otp: req.body.otp,
    ipAddress: req.ip,
  });

  return sendSuccess(res, {
    statusCode: 200,
    message: "Mobile number updated successfully",
    data: result,
  });
});

const getPublicLoginMethods = asyncHandler(async (req, res) => {
  const authenticationPolicyService = require("../services/authentication-policy.service");
  const methods = await authenticationPolicyService.getEffectiveCustomerLoginMethods();

  return sendSuccess(res, {
    statusCode: 200,
    message: "Available login methods retrieved successfully",
    data: methods,
  });
});

const createGuestSession = asyncHandler(async (req, res) => {
  const guestCheckoutEnabled = await isFeatureEnabled("guestCheckout");
  if (!guestCheckoutEnabled) {
    throw new AppError(
      "Guest checkout is disabled. Please sign in to complete checkout.",
      403,
      "GUEST_CHECKOUT_DISABLED"
    );
  }

  const existingToken =
    req.get("X-Guest-Session") ||
    req.cookies?.[COOKIE_NAMES.GUEST] ||
    req.cookies?.bb_guest_session;

  if (existingToken) {
    try {
      const decoded = verifyGuestToken(existingToken);
      const guestId = decoded.guestId || decoded.sub;
      return sendSuccess(res, {
        statusCode: 200,
        message: "Existing guest session active",
        data: {
          guestId,
          guestToken: existingToken,
          expiresIn: "7d",
        },
      });
    } catch (_) {
      // Token invalid or expired, generate new session below
    }
  }

  const guestId = "gst_" + crypto.randomUUID();
  const guestToken = generateGuestToken({ guestId });

  res.cookie(COOKIE_NAMES.GUEST, guestToken, guestCookieOptions);
  res.setHeader("X-Guest-Session", guestToken);

  return sendSuccess(res, {
    statusCode: 201,
    message: "Guest session initiated successfully",
    data: {
      guestId,
      guestToken,
      expiresIn: "7d",
    },
  });
});

const getGuestSession = asyncHandler(async (req, res) => {
  const token =
    req.get("X-Guest-Session") ||
    req.cookies?.[COOKIE_NAMES.GUEST] ||
    req.cookies?.bb_guest_session ||
    (req.get("Authorization")?.startsWith("Bearer ") ? req.get("Authorization").slice(7) : null);

  if (!token) {
    throw new AppError("No guest session found", 401, "INVALID_GUEST_SESSION");
  }

  let decoded;
  try {
    decoded = verifyGuestToken(token);
  } catch (err) {
    throw new AppError("Invalid or expired guest session", 401, "INVALID_GUEST_SESSION");
  }

  const guestCheckoutEnabled = await isFeatureEnabled("guestCheckout");

  return sendSuccess(res, {
    statusCode: 200,
    message: "Guest session active",
    data: {
      guestId: decoded.guestId || decoded.sub,
      guestCheckoutEnabled,
    },
  });
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  verifyEmail,
  verifyOtp,
  resendOtp,
  requestPasswordReset,
  resetPassword,
  changePassword,
  loginWithEmailOtpRequest,
  loginWithEmailOtpVerify,
  loginWithPhoneOtpRequest,
  loginWithPhoneOtpVerify,
  registerWithPhoneRequest,
  registerWithPhoneVerify,
  loginWithGoogle,
  changeEmailRequest,
  changeEmailVerify,
  changePhoneRequest,
  changePhoneVerify,
  getPublicLoginMethods,
  createGuestSession,
  getGuestSession,
};