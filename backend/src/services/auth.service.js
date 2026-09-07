const mongoose = require("mongoose");
const crypto = require("crypto");

const User = require("../models/User");
const Customer = require("../models/Customer");
const RefreshToken = require("../models/RefreshToken");
const EmailVerificationToken = require("../models/EmailVerificationToken");
const PasswordResetToken = require("../models/PasswordResetToken");

const {
  hashPassword,
  comparePassword,
} = require("../utils/password");

const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require("./token.service");

const notificationService = require("./notification");

const { hashToken } = require("../utils/token-hash");
const env = require("../config/env");
const AppError = require("../errors/AppError");

const EMAIL_VERIFICATION_TOKEN_TTL_MS =
  24 * 60 * 60 * 1000;

const PASSWORD_RESET_TOKEN_TTL_MS =
  60 * 60 * 1000;

const registerUser = async ({
  email,
  password,
  firstName,
  lastName,
}) => {
  const normalizedEmail = email.toLowerCase().trim();

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const existingUser = await User.findOne({
        email: normalizedEmail,
      }).session(session);

      if (existingUser) {
        throw new AppError(
          "Email is already registered",
          409,
          "EMAIL_ALREADY_EXISTS"
        );
      }

      const passwordHash = await hashPassword(password);

      const user = await User.create(
        [
          {
            email: normalizedEmail,
            password: passwordHash,
            firstName,
            lastName,
          },
        ],
        { session }
      );

      const createdUser = user[0];

      await Customer.create(
        [
          {
            userId: createdUser._id,
          },
        ],
        { session }
      );

      result = {
        id: createdUser._id,
        email: createdUser.email,
        firstName: createdUser.firstName,
        lastName: createdUser.lastName,
        role: createdUser.role,
      };
    });

    const verificationToken = crypto
      .randomBytes(32)
      .toString("hex");

    await EmailVerificationToken.deleteMany({
      userId: result.id,
      usedAt: null,
    });

    await EmailVerificationToken.create({
      userId: result.id,
      tokenHash: hashToken(verificationToken),
      expiresAt: new Date(
        Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS
      ),
    });

    const verificationUrl =
      `${env.EMAIL_VERIFICATION_BASE_URL}?token=${verificationToken}`;

    if (env.NODE_ENV === "development") {
      console.log(
        `Email verification URL: ${verificationUrl}`
      );
    }

    try {
      await notificationService.sendEmailVerification({
        to: result.email,
        customerName:
          `${result.firstName} ${result.lastName}`.trim(),
        verificationUrl,
      });
    } catch (error) {
      console.warn(
        "Email verification notification failed:",
        error.message
      );
    }

    return result;
  } finally {
    await session.endSession();
  }
};

const verifyEmail = async (token) => {
  if (!token || typeof token !== "string") {
    throw new AppError(
      "Email verification token is required",
      400,
      "VERIFICATION_TOKEN_REQUIRED"
    );
  }

  const tokenHash = hashToken(token);
  const session = await mongoose.startSession();

  try {
    let verifiedUser;

    await session.withTransaction(async () => {
      const verificationToken =
        await EmailVerificationToken.findOne({
          tokenHash,
          usedAt: null,
          expiresAt: {
            $gt: new Date(),
          },
        }).session(session);

      if (!verificationToken) {
        throw new AppError(
          "Invalid or expired email verification token",
          400,
          "INVALID_OR_EXPIRED_VERIFICATION_TOKEN"
        );
      }

      const user = await User.findById(
        verificationToken.userId
      ).session(session);

      if (!user) {
        throw new AppError(
          "User account not found",
          404,
          "USER_NOT_FOUND"
        );
      }

      if (user.isEmailVerified) {
        verificationToken.usedAt = new Date();
        await verificationToken.save({ session });

        verifiedUser = {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        };

        return;
      }

      user.isEmailVerified = true;
      await user.save({ session });

      verificationToken.usedAt = new Date();
      await verificationToken.save({ session });

      verifiedUser = {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      };
    });

    return verifiedUser;
  } finally {
    await session.endSession();
  }
};

const requestPasswordReset = async (email) => {
  const normalizedEmail = String(email || "")
    .toLowerCase()
    .trim();

  if (!normalizedEmail) {
    throw new AppError(
      "Email is required",
      400,
      "EMAIL_REQUIRED"
    );
  }

  const user = await User.findOne({
    email: normalizedEmail,
    isActive: true,
  });

  if (!user) {
    return;
  }

  const resetToken = crypto
    .randomBytes(32)
    .toString("hex");

  await PasswordResetToken.deleteMany({
    userId: user._id,
    usedAt: null,
  });

  await PasswordResetToken.create({
    userId: user._id,
    tokenHash: hashToken(resetToken),
    expiresAt: new Date(
      Date.now() + PASSWORD_RESET_TOKEN_TTL_MS
    ),
  });

  const resetUrl =
    `${env.PASSWORD_RESET_BASE_URL}?token=${resetToken}`;

  if (env.NODE_ENV === "development") {
    console.log(
      `Password reset URL: ${resetUrl}`
    );
  }

  try {
    await notificationService.sendPasswordReset({
      to: user.email,
      customerName:
        `${user.firstName} ${user.lastName}`.trim(),
      resetUrl,
    });
  } catch (error) {
    console.warn(
      "Password reset notification failed:",
      error.message
    );
  }
};

const resetPassword = async (token, newPassword) => {
  if (!token || typeof token !== "string") {
    throw new AppError(
      "Password reset token is required",
      400,
      "RESET_TOKEN_REQUIRED"
    );
  }

  if (!newPassword || typeof newPassword !== "string") {
    throw new AppError(
      "New password is required",
      400,
      "NEW_PASSWORD_REQUIRED"
    );
  }

  const tokenHash = hashToken(token);
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const resetToken = await PasswordResetToken.findOne({
        tokenHash,
        usedAt: null,
        expiresAt: {
          $gt: new Date(),
        },
      }).session(session);

      if (!resetToken) {
        throw new AppError(
          "Invalid or expired password reset token",
          400,
          "INVALID_OR_EXPIRED_RESET_TOKEN"
        );
      }

      const user = await User.findById(
        resetToken.userId
      ).session(session);

      if (!user) {
        throw new AppError(
          "User account not found",
          404,
          "USER_NOT_FOUND"
        );
      }

      user.password = await hashPassword(newPassword);
      await user.save({ session });

      resetToken.usedAt = new Date();
      await resetToken.save({ session });

      // Revoke all active refresh-token sessions
      // as part of the same transaction.
      await RefreshToken.updateMany(
        {
          userId: user._id,
          revokedAt: null,
        },
        {
          revokedAt: new Date(),
          revokedByIp: null,
        },
        {
          session,
        }
      );

      result = {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
};


const loginUser = async ({
  email,
  password,
  ipAddress = null,
  userAgent = null,
}) => {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await User.findOne({
    email: normalizedEmail,
  }).select("+password");

  if (!user) {
    throw new AppError(
      "Invalid email or password",
      401,
      "INVALID_CREDENTIALS"
    );
  }

  if (!user.isActive) {
    throw new AppError(
      "User account is inactive",
      403,
      "ACCOUNT_INACTIVE"
    );
  }

  const passwordValid = await comparePassword(
    password,
    user.password
  );

  if (!passwordValid) {
    throw new AppError(
      "Invalid email or password",
      401,
      "INVALID_CREDENTIALS"
    );
  }

  const accessToken = generateAccessToken({
    sub: user._id.toString(),
    role: user.role,
  });

  const refreshToken = generateRefreshToken({
    sub: user._id.toString(),
  });

  const decodedRefreshToken =
    verifyRefreshToken(refreshToken);

  await RefreshToken.create({
    userId: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(
      decodedRefreshToken.exp * 1000
    ),
    createdByIp: ipAddress,
    userAgent,
  });

  user.lastLoginAt = new Date();
  await user.save();

  return {
    user: {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
    accessToken,
    refreshToken,
  };
};

module.exports = {
  registerUser,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
  loginUser,
};