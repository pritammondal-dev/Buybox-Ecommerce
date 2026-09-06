const mongoose = require("mongoose");
const User = require("../models/User");
const Customer = require("../models/Customer");
const RefreshToken = require("../models/RefreshToken");

const {
  hashPassword,
  comparePassword,
} = require("../utils/password");

const {
  generateAccessToken,
  generateRefreshToken,
} = require("./token.service");

const { hashToken } = require("../utils/token-hash");
const AppError = require("../errors/AppError");

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

  const decodedRefreshToken = require("./token.service").verifyRefreshToken(
    refreshToken
  );

  await RefreshToken.create({
    userId: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(decodedRefreshToken.exp * 1000),
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
  loginUser,
};