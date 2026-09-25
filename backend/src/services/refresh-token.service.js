const RefreshToken = require("../models/RefreshToken");
const User = require("../models/User");
const Employee = require("../models/Employee");
const AppError = require("../errors/AppError");

const {
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken,
} = require("./token.service");

const { hashToken } = require("../utils/token-hash");

const rotateRefreshToken = async ({
  refreshToken,
  ipAddress = null,
  userAgent = null,
  expectedContext = null,
  allowedRoles = null,
}) => {
  let decoded;

  try {
    decoded = verifyRefreshToken(refreshToken, {
      expectedContext,
    });
  } catch (error) {
    throw new AppError(
      "Invalid or expired refresh token",
      401,
      "INVALID_REFRESH_TOKEN"
    );
  }

  if (decoded.type !== "refresh" || !decoded.jti || !decoded.sub) {
    throw new AppError(
      "Invalid refresh token",
      401,
      "INVALID_REFRESH_TOKEN"
    );
  }

  const tokenHash = hashToken(refreshToken);

  const storedToken = await RefreshToken.findOne({
    tokenHash,
  }).select("+tokenHash");

  if (!storedToken) {
    throw new AppError(
      "Refresh token not found",
      401,
      "REFRESH_TOKEN_NOT_FOUND"
    );
  }

  if (storedToken.userId.toString() !== decoded.sub) {
    throw new AppError(
      "Invalid refresh token",
      401,
      "INVALID_REFRESH_TOKEN"
    );
  }

  if (storedToken.revokedAt) {
    if (storedToken.replacedByTokenId) {
      await RefreshToken.updateMany(
        {
          userId: storedToken.userId,
          revokedAt: null,
        },
        {
          $set: {
            revokedAt: new Date(),
            revokedByIp: ipAddress,
          },
        }
      );

      throw new AppError(
        "Refresh token reuse detected. All active sessions have been revoked.",
        401,
        "REFRESH_TOKEN_REUSE_DETECTED"
      );
    }

    throw new AppError(
      "Refresh token has already been revoked",
      401,
      "REFRESH_TOKEN_REVOKED"
    );
  }

  if (storedToken.expiresAt <= new Date()) {
    throw new AppError(
      "Refresh token has expired",
      401,
      "REFRESH_TOKEN_EXPIRED"
    );
  }

  const user = await User.findById(storedToken.userId);

  if (!user) {
    throw new AppError(
      "User not found",
      401,
      "USER_NOT_FOUND"
    );
  }

  if (!user.isActive) {
    throw new AppError(
      "User account is inactive",
      403,
      "ACCOUNT_INACTIVE"
    );
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    throw new AppError(
      "Insufficient privileges for this session context",
      403,
      "INSUFFICIENT_ROLE"
    );
  }

  // If administrator session, ensure employee status is active
  if (expectedContext === "administrator" || decoded.context === "administrator") {
    const employee = await Employee.findOne({ userId: user._id });
    if (employee && employee.status !== "active") {
      throw new AppError(
        "Staff member account is suspended or terminated",
        403,
        "STAFF_SUSPENDED"
      );
    }
  }

  const sessionContext = decoded.context || expectedContext;

  const newAccessToken = generateAccessToken(
    {
      sub: user._id.toString(),
      role: user.role,
      authVersion: user.authVersion || 1,
      permissionVersion: user.permissionVersion || 1,
    },
    { context: sessionContext }
  );

  const newRefreshToken = generateRefreshToken(
    {
      sub: user._id.toString(),
    },
    { context: sessionContext }
  );

  const newDecodedRefreshToken = verifyRefreshToken(newRefreshToken);

  const replacementToken = await RefreshToken.create({
    userId: storedToken.userId,
    tokenHash: hashToken(newRefreshToken),
    expiresAt: new Date(newDecodedRefreshToken.exp * 1000),
    createdByIp: ipAddress,
    userAgent,
  });

  storedToken.revokedAt = new Date();
  storedToken.replacedByTokenId = replacementToken._id;
  storedToken.revokedByIp = ipAddress;

  await storedToken.save();

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    user: {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
    },
  };
};

module.exports = {
  rotateRefreshToken,
};