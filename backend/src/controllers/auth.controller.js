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

const {
  refreshCookieOptions,
} = require("../config/cookie");

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
    "refreshToken",
    result.refreshToken,
    refreshCookieOptions
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: "Login successful",
    data: {
      user: result.user,
      accessToken: result.accessToken,
    },
  });
});

const refresh = asyncHandler(async (req, res) => {
  const refreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

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
  });

  res.cookie(
    "refreshToken",
    result.refreshToken,
    refreshCookieOptions
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
  req.cookies.refreshToken || req.body.refreshToken;

  const {
    verifyRefreshToken,
  } = require("../services/token.service");

  const { hashToken } = require("../utils/token-hash");
  const RefreshToken = require("../models/RefreshToken");

  try {
    const decoded = verifyRefreshToken(refreshToken);

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

  res.clearCookie("refreshToken", {
  httpOnly: true,
  secure: refreshCookieOptions.secure,
  sameSite: refreshCookieOptions.sameSite,
  path: refreshCookieOptions.path,
});

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

module.exports = {
  register,
  login,
  refresh,
  logout,
  logoutAll,
};