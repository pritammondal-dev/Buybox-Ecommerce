const RefreshToken = require("../models/RefreshToken");
const User = require("../models/User");
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
}) => {
  let decoded;

  try {
    decoded = verifyRefreshToken(refreshToken);
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

  const newAccessToken = generateAccessToken({
    sub: user._id.toString(),
    role: user.role,
  });

  const newRefreshToken = generateRefreshToken({
    sub: user._id.toString(),
  });

  const newDecodedRefreshToken =
    verifyRefreshToken(newRefreshToken);

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
  };
};

module.exports = {
  rotateRefreshToken,
};