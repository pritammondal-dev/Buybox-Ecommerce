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
const logger = require("../config/logger");

const otpService = require("./otp.service");
const smsService = require("./sms.service");
const googleAuthService = require("./google-auth.service");
const AuthAuditService = require("./auth-audit.service");
const authenticationPolicyService = require("./authentication-policy.service");
const { OTP_PURPOSES, AUDIT_ACTIONS } = require("../constants/auth.constants");
const { normalizePhoneNumber, isValidPhoneNumber, maskPhoneNumber } = require("../utils/phone.util");
const EmailService = require("./email.service");
const emailService = new EmailService();

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
  const normalizedEmail = String(email || "").toLowerCase().trim();

  // 1. Check for existing user account
  const existingUser = await User.findOne({ email: normalizedEmail });

  if (existingUser) {
    if (existingUser.isEmailVerified) {
      throw new AppError(
        "An account may already be associated with this email. Please sign in or use Forgot Password.",
        409,
        "EMAIL_ALREADY_EXISTS"
      );
    }

    // Existing unverified account: Resume verification lifecycle rather than duplicating records
    const { otp, resendCooldownSeconds } = await otpService.generateOtp({
      email: normalizedEmail,
      userId: existingUser._id,
      purpose: "email_verification",
    });

    const emailResult = await emailService.sendEmailVerificationOTP({
      to: normalizedEmail,
      customerName: existingUser.firstName,
      otp,
    });

    if (!emailResult || emailResult.success === false) {
      await otpService.invalidateOtp({ email: normalizedEmail, purpose: "email_verification" });
      logger.error("Failed to deliver verification email to customer:", {
        recipient: normalizedEmail,
        status: emailResult?.status,
        error: emailResult?.error,
      });
      throw new AppError(
        "Failed to deliver verification code to your email. Please try again later.",
        500,
        "EMAIL_DELIVERY_FAILED"
      );
    }

    return {
      id: existingUser._id,
      email: normalizedEmail,
      firstName: existingUser.firstName,
      lastName: existingUser.lastName,
      role: existingUser.role,
      isEmailVerified: false,
      requireVerification: true,
      resendCooldownSeconds,
    };
  }

  // 2. New account creation transaction
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const passwordHash = await hashPassword(password);

      const user = await User.create(
        [
          {
            email: normalizedEmail,
            password: passwordHash,
            firstName,
            lastName,
            isEmailVerified: false,
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
        isEmailVerified: false,
        requireVerification: true,
      };
    });

    // 3. Generate secure OTP and dispatch via EmailService
    const { otp, resendCooldownSeconds } = await otpService.generateOtp({
      email: normalizedEmail,
      userId: result.id,
      purpose: "email_verification",
    });

    const emailResult = await emailService.sendEmailVerificationOTP({
      to: normalizedEmail,
      customerName: result.firstName,
      otp,
    });

    if (!emailResult || emailResult.success === false) {
      await otpService.invalidateOtp({ email: normalizedEmail, purpose: "email_verification" });
      logger.error("Failed to deliver verification email to new customer:", {
        recipient: normalizedEmail,
        status: emailResult?.status,
        error: emailResult?.error,
      });
      throw new AppError(
        "Failed to deliver verification code to your email. Please try again later.",
        500,
        "EMAIL_DELIVERY_FAILED"
      );
    }

    return {
      ...result,
      resendCooldownSeconds,
    };
  } catch (err) {
    if (err.code === 11000 || (err.message && err.message.includes("duplicate key"))) {
      throw new AppError(
        "An account may already be associated with this email. Please sign in or use Forgot Password.",
        409,
        "EMAIL_ALREADY_EXISTS"
      );
    }
    throw err;
  } finally {
    await session.endSession();
  }
};

const verifyEmailOtp = async ({ email, otp, purpose = "email_verification" }) => {
  const result = await otpService.verifyOtp({ email, otp, purpose });

  const user = await User.findOne({ email: result.email });
  if (!user) {
    throw new AppError("User account not found", 404, "USER_NOT_FOUND");
  }

  user.isEmailVerified = true;
  await user.save();

  let vendorData = null;
  if (user.role === "vendor") {
    const Vendor = require("../models/Vendor");
    const vendor = await Vendor.findOne({ userId: user._id });
    if (vendor) {
      vendorData = {
        id: vendor._id,
        businessName: vendor.businessName,
        businessSlug: vendor.businessSlug,
        onboardingStatus: vendor.onboardingStatus,
        isActive: vendor.isActive,
      };
    }
  } else {
    // Send customer welcome confirmation email
    emailService.sendWelcomeEmail({
      to: user.email,
      customerName: user.firstName,
    }).catch(() => {});
  }

  return {
    id: user._id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isEmailVerified: true,
    vendor: vendorData,
  };
};

const resendOtp = async ({ email, purpose = "email_verification" }) => {
  const normalizedEmail = String(email || "").toLowerCase().trim();

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    throw new AppError("No account found with this email address", 404, "USER_NOT_FOUND");
  }

  if (purpose === "email_verification" && user.isEmailVerified) {
    return {
      message: "Email is already verified",
      isEmailVerified: true,
    };
  }

  const { otp, resendCooldownSeconds } = await otpService.generateOtp({
    email: normalizedEmail,
    userId: user._id,
    purpose,
  });

  let emailResult;
  if (purpose === "email_verification") {
    emailResult = await emailService.sendEmailVerificationOTP({
      to: normalizedEmail,
      customerName: user.firstName,
      otp,
    });
  } else if (purpose === "password_reset") {
    emailResult = await emailService.sendPasswordResetOTP({
      to: normalizedEmail,
      customerName: user.firstName,
      otp,
    });
  }

  if (!emailResult || emailResult.success === false) {
    await otpService.invalidateOtp({ email: normalizedEmail, purpose });
    logger.error("Failed to deliver OTP email on resend:", {
      recipient: normalizedEmail,
      purpose,
      status: emailResult?.status,
      error: emailResult?.error,
    });
    throw new AppError(
      "Failed to deliver verification code to your email. Please try again later.",
      500,
      "EMAIL_DELIVERY_FAILED"
    );
  }

  return {
    success: true,
    email: normalizedEmail,
    resendCooldownSeconds,
  };
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


const changePassword = async ({
  userId,
  currentPassword,
  newPassword,
  ipAddress = null,
}) => {
  const user = await User.findById(userId).select("+password");
  if (!user) {
    throw new AppError("User account not found", 404, "USER_NOT_FOUND");
  }

  const passwordValid = await comparePassword(
    currentPassword,
    user.password
  );

  if (!passwordValid) {
    throw new AppError(
      "Current password is incorrect",
      400,
      "INVALID_CURRENT_PASSWORD"
    );
  }

  if (currentPassword === newPassword) {
    throw new AppError(
      "New password must be different from your current password",
      400,
      "PASSWORD_SAME_AS_OLD"
    );
  }

  user.password = await hashPassword(newPassword);
  user.authVersion = (user.authVersion || 1) + 1;
  await user.save();

  // Revoke active refresh tokens for session security
  await RefreshToken.updateMany(
    {
      userId: user._id,
      revokedAt: null,
    },
    {
      revokedAt: new Date(),
      revokedByIp: ipAddress,
    }
  );

  await AuthAuditService.recordEvent({
    action: AUDIT_ACTIONS.PASSWORD_CHANGED,
    actorId: user._id,
    ipAddress,
  });

  return {
    success: true,
  };
};

/**
 * Standard Customer Session Generator
 * Guarantees every customer authentication method creates the exact same token context,
 * audience, and database-tracked refresh-token session.
 */
const createCustomerSession = async ({ user, ipAddress = null, userAgent = null }) => {
  if (!user.isActive) {
    throw new AppError("User account is inactive", 403, "ACCOUNT_INACTIVE");
  }

  // Enforce customer authentication boundary: Reject internal staff and vendors
  if (["super_admin", "admin", "editor", "manager", "support"].includes(user.role)) {
    throw new AppError(
      "Access restricted. Privileged staff accounts must sign in through the administrator portal.",
      403,
      "STAFF_PORTAL_REQUIRED"
    );
  }

  if (user.role === "vendor") {
    throw new AppError(
      "Access restricted. Vendor accounts must sign in through the merchant center portal.",
      403,
      "VENDOR_PORTAL_REQUIRED"
    );
  }

  if (user.role !== "customer") {
    throw new AppError(
      "Access restricted. Customer accounts only.",
      403,
      "CUSTOMER_AUTH_REQUIRED"
    );
  }

  const { TOKEN_CONTEXTS, TOKEN_AUDIENCES } = require("./token.service");

  const accessToken = generateAccessToken(
    {
      sub: user._id.toString(),
      role: user.role,
      authVersion: user.authVersion || 1,
      permissionVersion: user.permissionVersion || 1,
    },
    {
      context: TOKEN_CONTEXTS.CUSTOMER,
      audience: TOKEN_AUDIENCES.CUSTOMER,
    }
  );

  const refreshToken = generateRefreshToken(
    {
      sub: user._id.toString(),
    },
    {
      context: TOKEN_CONTEXTS.CUSTOMER,
      audience: TOKEN_AUDIENCES.CUSTOMER,
    }
  );

  const decodedRefreshToken = verifyRefreshToken(refreshToken, {
    expectedContext: TOKEN_CONTEXTS.CUSTOMER,
    expectedAudience: TOKEN_AUDIENCES.CUSTOMER,
  });

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
      email: user.email || null,
      phone: user.phone || null,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isEmailVerified: Boolean(user.isEmailVerified),
      isPhoneVerified: Boolean(user.isPhoneVerified),
      authProviders: user.authProviders || {},
      vendor: null,
      permissions: [],
    },
    accessToken,
    refreshToken,
  };
};

/**
 * Method 1: Email + Password Login
 */
const loginUser = async ({
  email,
  password,
  ipAddress = null,
  userAgent = null,
}) => {
  await authenticationPolicyService.assertCustomerLoginMethodEnabled("emailPassword");

  const normalizedEmail = email.toLowerCase().trim();

  const user = await User.findOne({
    email: normalizedEmail,
  }).select("+password");

  if (!user) {
    await AuthAuditService.recordEvent({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      ipAddress,
      userAgent,
      metadata: { email: normalizedEmail, reason: "USER_NOT_FOUND" },
    });
    throw new AppError(
      "Invalid email or password",
      401,
      "INVALID_CREDENTIALS"
    );
  }

  if (!user.isActive) {
    throw new AppError("User account is inactive", 403, "ACCOUNT_INACTIVE");
  }

  // Enforce customer authentication boundary: Reject internal staff and vendors
  if (["super_admin", "admin", "editor", "manager", "support"].includes(user.role)) {
    throw new AppError(
      "Access restricted. Privileged staff accounts must sign in through the administrator portal.",
      403,
      "STAFF_PORTAL_REQUIRED"
    );
  }

  if (user.role === "vendor") {
    throw new AppError(
      "Access restricted. Vendor accounts must sign in through the merchant center portal.",
      403,
      "VENDOR_PORTAL_REQUIRED"
    );
  }

  if (!user.password) {
    await AuthAuditService.recordEvent({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      actorId: user._id,
      ipAddress,
      userAgent,
      metadata: { reason: "PASSWORD_NOT_SET" },
    });
    throw new AppError(
      "This account was created without a password. Please sign in using OTP or Google.",
      400,
      "PASSWORD_NOT_SET"
    );
  }

  const passwordValid = await comparePassword(
    password,
    user.password
  );

  if (!passwordValid) {
    await AuthAuditService.recordEvent({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      actorId: user._id,
      ipAddress,
      userAgent,
      metadata: { reason: "INVALID_PASSWORD" },
    });
    throw new AppError(
      "Invalid email or password",
      401,
      "INVALID_CREDENTIALS"
    );
  }

  // Enforce verified email requirement if mandated by registration policy
  const policy = await authenticationPolicyService.getAuthoritativePolicy();
  if (policy.registration?.requireEmailVerification && !user.isEmailVerified) {
    await AuthAuditService.recordEvent({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      actorId: user._id,
      ipAddress,
      userAgent,
      metadata: { reason: "EMAIL_NOT_VERIFIED", email: normalizedEmail },
    });
    throw new AppError(
      "Your email address has not been verified. Please verify your email before logging in.",
      403,
      "EMAIL_NOT_VERIFIED"
    );
  }

  const session = await createCustomerSession({ user, ipAddress, userAgent });

  await AuthAuditService.recordEvent({
    action: AUDIT_ACTIONS.LOGIN_SUCCESS,
    actorId: user._id,
    ipAddress,
    userAgent,
    metadata: { method: "PASSWORD" },
  });

  return session;
};

/**
 * Method 2: Email + OTP Login (Request)
 */
const requestEmailLoginOtp = async ({ email, ipAddress = null }) => {
  await authenticationPolicyService.assertCustomerLoginMethodEnabled("emailOtp");

  const normalizedEmail = String(email || "").toLowerCase().trim();

  const user = await User.findOne({ email: normalizedEmail });

  // Generic response if account doesn't exist (enumeration security)
  if (!user) {
    return {
      success: true,
      message: "If an account exists for this email, a verification code has been sent.",
      resendCooldownSeconds: 60,
    };
  }

  if (!user.isActive) {
    throw new AppError("Account is inactive. Please contact customer support.", 403, "ACCOUNT_INACTIVE");
  }

  if (["super_admin", "admin", "editor", "manager", "support"].includes(user.role)) {
    throw new AppError("Access restricted. Privileged staff accounts must sign in through the administrator portal.", 403, "STAFF_PORTAL_REQUIRED");
  }

  if (user.role === "vendor") {
    throw new AppError("Access restricted. Vendor accounts must sign in through the merchant center portal.", 403, "VENDOR_PORTAL_REQUIRED");
  }

  const { otp, resendCooldownSeconds } = await otpService.generateOtp({
    email: normalizedEmail,
    userId: user._id,
    purpose: OTP_PURPOSES.LOGIN_EMAIL_OTP,
  });

  const emailResult = await emailService.sendEmailVerificationOTP({
    to: normalizedEmail,
    customerName: user.firstName,
    otp,
  });

  if (!emailResult || emailResult.success === false) {
    await otpService.invalidateOtp({ email: normalizedEmail, purpose: OTP_PURPOSES.LOGIN_EMAIL_OTP });
    logger.error("Failed to deliver login OTP email:", {
      recipient: normalizedEmail,
      status: emailResult?.status,
      error: emailResult?.error,
    });
    throw new AppError(
      "Failed to deliver verification code to your email. Please try again later.",
      500,
      "EMAIL_DELIVERY_FAILED"
    );
  }

  await AuthAuditService.recordEvent({
    action: AUDIT_ACTIONS.OTP_REQUESTED,
    actorId: user._id,
    ipAddress,
    metadata: { purpose: OTP_PURPOSES.LOGIN_EMAIL_OTP, channel: "EMAIL" },
  });

  return {
    success: true,
    email: normalizedEmail,
    resendCooldownSeconds,
  };
};

/**
 * Method 2: Email + OTP Login (Verify)
 */
const verifyEmailLoginOtp = async ({ email, otp, ipAddress = null, userAgent = null }) => {
  // Re-check policy before session generation for stale-flow protection
  await authenticationPolicyService.assertCustomerLoginMethodEnabled("emailOtp");

  const normalizedEmail = String(email || "").toLowerCase().trim();

  await otpService.verifyOtp({
    email: normalizedEmail,
    otp,
    purpose: OTP_PURPOSES.LOGIN_EMAIL_OTP,
  });

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    throw new AppError("User account not found", 404, "USER_NOT_FOUND");
  }

  if (!user.isEmailVerified) {
    user.isEmailVerified = true;
    await user.save();
  }

  const session = await createCustomerSession({ user, ipAddress, userAgent });

  await AuthAuditService.recordEvent({
    action: AUDIT_ACTIONS.LOGIN_SUCCESS,
    actorId: user._id,
    ipAddress,
    userAgent,
    metadata: { method: "EMAIL_OTP" },
  });

  return session;
};

/**
 * Method 3: Mobile + OTP Login (Request)
 */
const requestPhoneLoginOtp = async ({ phone, ipAddress = null }) => {
  await authenticationPolicyService.assertCustomerLoginMethodEnabled("mobileOtp");

  const normalizedPhone = normalizePhoneNumber(phone);

  const user = await User.findOne({ phone: normalizedPhone });

  // Generic response if account doesn't exist (enumeration security)
  if (!user) {
    return {
      success: true,
      message: "If an account exists for this mobile number, a verification code has been sent.",
      resendCooldownSeconds: 60,
    };
  }

  if (!user.isActive) {
    throw new AppError("Account is inactive. Please contact customer support.", 403, "ACCOUNT_INACTIVE");
  }

  if (["super_admin", "admin", "editor", "manager", "support"].includes(user.role)) {
    throw new AppError("Access restricted. Privileged staff accounts must sign in through the administrator portal.", 403, "STAFF_PORTAL_REQUIRED");
  }

  if (user.role === "vendor") {
    throw new AppError("Access restricted. Vendor accounts must sign in through the merchant center portal.", 403, "VENDOR_PORTAL_REQUIRED");
  }

  const { otp, resendCooldownSeconds } = await otpService.generateOtp({
    phone: normalizedPhone,
    userId: user._id,
    purpose: OTP_PURPOSES.LOGIN_PHONE_OTP,
  });

  const smsResult = await smsService.sendOtp({
    to: normalizedPhone,
    otp,
    purpose: OTP_PURPOSES.LOGIN_PHONE_OTP,
  });

  if (!smsResult || smsResult.success === false) {
    await otpService.invalidateOtp({ phone: normalizedPhone, purpose: OTP_PURPOSES.LOGIN_PHONE_OTP });
    throw new AppError(
      smsResult.error || "SMS delivery service is unavailable. Please try again later.",
      smsResult.code === "SMS_PROVIDER_NOT_CONFIGURED" ? 503 : 500,
      smsResult.code || "SMS_DELIVERY_FAILED"
    );
  }

  await AuthAuditService.recordEvent({
    action: AUDIT_ACTIONS.OTP_REQUESTED,
    actorId: user._id,
    ipAddress,
    metadata: { purpose: OTP_PURPOSES.LOGIN_PHONE_OTP, channel: "SMS" },
  });

  return {
    success: true,
    phone: normalizedPhone,
    resendCooldownSeconds,
  };
};

/**
 * Method 3: Mobile + OTP Login (Verify)
 */
const verifyPhoneLoginOtp = async ({ phone, otp, ipAddress = null, userAgent = null }) => {
  // Re-check policy before session generation for stale-flow protection
  await authenticationPolicyService.assertCustomerLoginMethodEnabled("mobileOtp");

  const normalizedPhone = normalizePhoneNumber(phone);

  await otpService.verifyOtp({
    phone: normalizedPhone,
    otp,
    purpose: OTP_PURPOSES.LOGIN_PHONE_OTP,
  });

  const user = await User.findOne({ phone: normalizedPhone });
  if (!user) {
    throw new AppError("User account not found", 404, "USER_NOT_FOUND");
  }

  if (!user.isPhoneVerified) {
    user.isPhoneVerified = true;
    await user.save();
  }

  const session = await createCustomerSession({ user, ipAddress, userAgent });

  await AuthAuditService.recordEvent({
    action: AUDIT_ACTIONS.LOGIN_SUCCESS,
    actorId: user._id,
    ipAddress,
    userAgent,
    metadata: { method: "PHONE_OTP" },
  });

  return session;
};

/**
 * Mobile Registration Request
 */
const requestPhoneRegister = async ({ phone, firstName, lastName = "", ipAddress = null }) => {
  const normalizedPhone = normalizePhoneNumber(phone);

  const existingUser = await User.findOne({ phone: normalizedPhone });
  if (existingUser && existingUser.isPhoneVerified) {
    throw new AppError(
      "An account is already associated with this mobile number. Please sign in.",
      409,
      "PHONE_ALREADY_EXISTS"
    );
  }

  const { otp, resendCooldownSeconds } = await otpService.generateOtp({
    phone: normalizedPhone,
    userId: existingUser ? existingUser._id : null,
    purpose: OTP_PURPOSES.LOGIN_PHONE_OTP,
  });

  const smsResult = await smsService.sendOtp({
    to: normalizedPhone,
    otp,
    purpose: OTP_PURPOSES.LOGIN_PHONE_OTP,
  });

  if (!smsResult || smsResult.success === false) {
    await otpService.invalidateOtp({ phone: normalizedPhone, purpose: OTP_PURPOSES.LOGIN_PHONE_OTP });
    throw new AppError(
      smsResult.error || "SMS delivery service is unavailable. Please try again later.",
      smsResult.code === "SMS_PROVIDER_NOT_CONFIGURED" ? 503 : 500,
      smsResult.code || "SMS_DELIVERY_FAILED"
    );
  }

  return {
    success: true,
    phone: normalizedPhone,
    resendCooldownSeconds,
  };
};

/**
 * Mobile Registration Verify
 */
const verifyPhoneRegister = async ({
  phone,
  otp,
  firstName,
  lastName = "",
  ipAddress = null,
  userAgent = null,
}) => {
  const normalizedPhone = normalizePhoneNumber(phone);

  await otpService.verifyOtp({
    phone: normalizedPhone,
    otp,
    purpose: OTP_PURPOSES.LOGIN_PHONE_OTP,
  });

  let user = await User.findOne({ phone: normalizedPhone });

  if (user) {
    user.firstName = firstName.trim();
    if (lastName) user.lastName = lastName.trim();
    user.isPhoneVerified = true;
    await user.save();
  } else {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const createdUsers = await User.create(
          [
            {
              phone: normalizedPhone,
              firstName: firstName.trim(),
              lastName: (lastName || "").trim(),
              role: "customer",
              isPhoneVerified: true,
            },
          ],
          { session }
        );

        user = createdUsers[0];

        await Customer.create(
          [
            {
              userId: user._id,
              phone: normalizedPhone,
            },
          ],
          { session }
        );
      });
    } finally {
      await session.endSession();
    }
  }

  const userSession = await createCustomerSession({ user, ipAddress, userAgent });

  await AuthAuditService.recordEvent({
    action: AUDIT_ACTIONS.LOGIN_SUCCESS,
    actorId: user._id,
    ipAddress,
    userAgent,
    metadata: { method: "PHONE_REGISTRATION" },
  });

  return userSession;
};

/**
 * Method 4: Google OAuth / OIDC Sign-In
 */
const authenticateGoogleUser = async ({ idToken, ipAddress = null, userAgent = null }) => {
  await authenticationPolicyService.assertCustomerLoginMethodEnabled("google");

  let actorId = null;
  let verifiedEmail = null;
  let verifiedSub = null;

  try {
    const payload = await googleAuthService.verifyIdToken(idToken);
    verifiedEmail = payload.email;
    verifiedSub = payload.sub;

    // 1. Check if user with this verified Google Provider ID exists
    let user = await User.findOne({ "authProviders.google.id": payload.sub });

    if (user) {
      actorId = user._id;
      const session = await createCustomerSession({ user, ipAddress, userAgent });
      await AuthAuditService.recordEvent({
        action: AUDIT_ACTIONS.GOOGLE_LOGIN_SUCCESS,
        actorId: user._id,
        ipAddress,
        userAgent,
        metadata: { sub: payload.sub, email: payload.email },
      });
      return session;
    }

    // 2. Check if a user with the same verified email already exists
    const existingEmailUser = await User.findOne({ email: payload.email });

    if (existingEmailUser) {
      actorId = existingEmailUser._id;
      // Safe Account Linking: Require existing account to be independently verified
      if (!existingEmailUser.isEmailVerified) {
        throw new AppError(
          "An unverified account exists with this email address. Please verify your email first before connecting Google Sign-In.",
          403,
          "ACCOUNT_LINKING_VERIFICATION_REQUIRED"
        );
      }

      // Link Google Provider to existing verified customer
      existingEmailUser.authProviders = existingEmailUser.authProviders || {};
      existingEmailUser.authProviders.google = {
        id: payload.sub,
        email: payload.email,
        linkedAt: new Date(),
      };
      await existingEmailUser.save();

      user = existingEmailUser;
    } else {
      // 3. Create new customer user with Google Identity
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const createdUsers = await User.create(
            [
              {
                email: payload.email,
                firstName: payload.firstName,
                lastName: payload.lastName,
                role: "customer",
                isEmailVerified: true, // Google identity independently verified
                authProviders: {
                  google: {
                    id: payload.sub,
                    email: payload.email,
                    linkedAt: new Date(),
                  },
                },
              },
            ],
            { session }
          );

          user = createdUsers[0];

          await Customer.create(
            [
              {
                userId: user._id,
              },
            ],
            { session }
          );
        });
      } finally {
        await session.endSession();
      }
    }

    actorId = user._id;
    const authSession = await createCustomerSession({ user, ipAddress, userAgent });

    await AuthAuditService.recordEvent({
      action: AUDIT_ACTIONS.GOOGLE_LOGIN_SUCCESS,
      actorId: user._id,
      ipAddress,
      userAgent,
      metadata: { sub: payload.sub, email: payload.email },
    });

    return authSession;
  } catch (err) {
    await AuthAuditService.recordEvent({
      action: AUDIT_ACTIONS.GOOGLE_LOGIN_FAILED,
      actorId,
      ipAddress,
      userAgent,
      metadata: {
        reason: err.code || err.message,
        email: verifiedEmail || undefined,
      },
    }).catch(() => {});

    throw err;
  }
};

/**
 * Account Security: Request Email Change
 */
const requestChangeEmail = async ({ userId, newEmail, ipAddress = null }) => {
  const normalizedNewEmail = String(newEmail || "").toLowerCase().trim();

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User account not found", 404, "USER_NOT_FOUND");
  }

  if (user.email === normalizedNewEmail) {
    throw new AppError("The new email must be different from your current email.", 400, "EMAIL_SAME_AS_CURRENT");
  }

  const conflictingUser = await User.findOne({
    email: normalizedNewEmail,
    _id: { $ne: user._id },
  });

  if (conflictingUser) {
    throw new AppError("This email address is already in use by another account.", 409, "EMAIL_ALREADY_EXISTS");
  }

  const { otp, resendCooldownSeconds } = await otpService.generateOtp({
    email: normalizedNewEmail,
    userId: user._id,
    purpose: OTP_PURPOSES.CHANGE_EMAIL_OTP,
  });

  const emailResult = await emailService.sendEmailVerificationOTP({
    to: normalizedNewEmail,
    customerName: user.firstName,
    otp,
  });

  if (!emailResult || emailResult.success === false) {
    await otpService.invalidateOtp({ email: normalizedNewEmail, purpose: OTP_PURPOSES.CHANGE_EMAIL_OTP });
    throw new AppError("Failed to deliver verification code to new email. Please try again.", 500, "EMAIL_DELIVERY_FAILED");
  }

  return {
    success: true,
    newEmail: normalizedNewEmail,
    resendCooldownSeconds,
  };
};

/**
 * Account Security: Verify Email Change
 */
const verifyChangeEmail = async ({ userId, newEmail, otp, ipAddress = null }) => {
  const normalizedNewEmail = String(newEmail || "").toLowerCase().trim();

  await otpService.verifyOtp({
    email: normalizedNewEmail,
    otp,
    purpose: OTP_PURPOSES.CHANGE_EMAIL_OTP,
  });

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User account not found", 404, "USER_NOT_FOUND");
  }

  user.email = normalizedNewEmail;
  user.isEmailVerified = true;
  user.authVersion = (user.authVersion || 1) + 1;
  await user.save();

  // Invalidate other active sessions
  await RefreshToken.updateMany(
    { userId: user._id, revokedAt: null },
    { revokedAt: new Date(), revokedByIp: ipAddress }
  );

  await AuthAuditService.recordEvent({
    action: AUDIT_ACTIONS.EMAIL_CHANGED,
    actorId: user._id,
    ipAddress,
    metadata: { newEmail: normalizedNewEmail },
  });

  return {
    success: true,
    email: user.email,
  };
};

/**
 * Account Security: Request Phone Change
 */
const requestChangePhone = async ({ userId, newPhone, ipAddress = null }) => {
  const normalizedNewPhone = normalizePhoneNumber(newPhone);

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User account not found", 404, "USER_NOT_FOUND");
  }

  if (user.phone === normalizedNewPhone) {
    throw new AppError("The new mobile number must be different from your current mobile number.", 400, "PHONE_SAME_AS_CURRENT");
  }

  const conflictingUser = await User.findOne({
    phone: normalizedNewPhone,
    _id: { $ne: user._id },
  });

  if (conflictingUser) {
    throw new AppError("This mobile number is already registered with another account.", 409, "PHONE_ALREADY_EXISTS");
  }

  const { otp, resendCooldownSeconds } = await otpService.generateOtp({
    phone: normalizedNewPhone,
    userId: user._id,
    purpose: OTP_PURPOSES.CHANGE_PHONE_OTP,
  });

  const smsResult = await smsService.sendOtp({
    to: normalizedNewPhone,
    otp,
    purpose: OTP_PURPOSES.CHANGE_PHONE_OTP,
  });

  if (!smsResult || smsResult.success === false) {
    await otpService.invalidateOtp({ phone: normalizedNewPhone, purpose: OTP_PURPOSES.CHANGE_PHONE_OTP });
    throw new AppError(
      smsResult.error || "SMS delivery service is unavailable. Please try again later.",
      smsResult.code === "SMS_PROVIDER_NOT_CONFIGURED" ? 503 : 500,
      smsResult.code || "SMS_DELIVERY_FAILED"
    );
  }

  return {
    success: true,
    newPhone: normalizedNewPhone,
    resendCooldownSeconds,
  };
};

/**
 * Account Security: Verify Phone Change
 */
const verifyChangePhone = async ({ userId, newPhone, otp, ipAddress = null }) => {
  const normalizedNewPhone = normalizePhoneNumber(newPhone);

  await otpService.verifyOtp({
    phone: normalizedNewPhone,
    otp,
    purpose: OTP_PURPOSES.CHANGE_PHONE_OTP,
  });

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User account not found", 404, "USER_NOT_FOUND");
  }

  user.phone = normalizedNewPhone;
  user.isPhoneVerified = true;
  await user.save();

  // Also update Customer profile
  await Customer.updateOne(
    { userId: user._id },
    { $set: { phone: normalizedNewPhone } }
  );

  await AuthAuditService.recordEvent({
    action: AUDIT_ACTIONS.PHONE_CHANGED,
    actorId: user._id,
    ipAddress,
    metadata: { newPhone: normalizedNewPhone },
  });

  return {
    success: true,
    phone: user.phone,
  };
};

module.exports = {
  createCustomerSession,
  registerUser,
  verifyEmail,
  verifyEmailOtp,
  resendOtp,
  requestPasswordReset,
  resetPassword,
  changePassword,
  loginUser,
  requestEmailLoginOtp,
  verifyEmailLoginOtp,
  requestPhoneLoginOtp,
  verifyPhoneLoginOtp,
  requestPhoneRegister,
  verifyPhoneRegister,
  authenticateGoogleUser,
  requestChangeEmail,
  verifyChangeEmail,
  requestChangePhone,
  verifyChangePhone,
};