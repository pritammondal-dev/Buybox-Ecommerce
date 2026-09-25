const Otp = require("../models/Otp");
const AppError = require("../errors/AppError");
const {
  generateSecureNumericOtp,
  hashOtp,
  verifyOtpHash,
} = require("../utils/crypto.util");
const { OTP_PURPOSES } = require("../constants/auth.constants");

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_SECONDS = 60; // 60 seconds
const MAX_VERIFICATION_ATTEMPTS = 5;
const MAX_RESENDS_PER_WINDOW = 5;

/**
 * Secure OTP Lifecycle Service
 * Supports multi-identifier OTP workflows (Email and Mobile Phone)
 * with strict purpose isolation, attempt limiting, and timing-safe verification.
 */
class OtpService {
  /**
   * Helper to build destination filter for either email or phone.
   * @private
   */
  static _getDestinationFilter({ email, phone, purpose }) {
    const filter = { purpose };
    if (phone) {
      filter.phone = String(phone).trim();
    } else if (email) {
      filter.email = String(email).toLowerCase().trim();
    } else {
      throw new AppError("Valid email or phone number is required to process OTP", 400, "IDENTIFIER_REQUIRED");
    }
    return filter;
  }

  /**
   * Generate and persist a secure 6-digit numeric OTP hash.
   *
   * @param {Object} params
   * @param {string} [params.email]
   * @param {string} [params.phone]
   * @param {string|mongoose.Types.ObjectId} [params.userId]
   * @param {string} [params.purpose='email_verification']
   * @returns {Promise<{ otp: string, expiresAt: Date, resendCooldownSeconds: number }>}
   */
  static async generateOtp({ email = null, phone = null, userId = null, purpose = OTP_PURPOSES.EMAIL_VERIFICATION }) {
    const destFilter = this._getDestinationFilter({ email, phone, purpose });

    // 1. Check for active cooldown on existing active OTP
    const existingActiveOtp = await Otp.findOne({
      ...destFilter,
      isUsed: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (existingActiveOtp) {
      const now = Date.now();
      const lastSentTime = new Date(existingActiveOtp.lastResentAt || existingActiveOtp.createdAt).getTime();
      const elapsedSeconds = Math.floor((now - lastSentTime) / 1000);

      if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
        const retryAfter = RESEND_COOLDOWN_SECONDS - elapsedSeconds;
        throw new AppError(
          `Please wait ${retryAfter} seconds before requesting a new code.`,
          429,
          "RESEND_COOLDOWN_ACTIVE",
          { retryAfter }
        );
      }

      if (existingActiveOtp.resendCount >= MAX_RESENDS_PER_WINDOW) {
        throw new AppError(
          "Maximum resend attempts reached. Please wait for the current code to expire before trying again.",
          429,
          "MAX_RESEND_EXCEEDED"
        );
      }

      // Invalidate existing OTP as a newer one is being issued
      existingActiveOtp.isUsed = true;
      await existingActiveOtp.save();
    }

    // 2. Invalidate any older pending OTPs for this destination and purpose
    await Otp.updateMany(
      { ...destFilter, isUsed: false },
      { $set: { isUsed: true } }
    );

    // 3. Generate secure OTP and persist only its SHA-256 hash
    const rawOtp = generateSecureNumericOtp();
    const otpHash = hashOtp(rawOtp);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    const prevCount = existingActiveOtp ? existingActiveOtp.resendCount + 1 : 0;

    await Otp.create({
      email: destFilter.email || null,
      phone: destFilter.phone || null,
      userId,
      purpose,
      otpHash,
      expiresAt,
      attemptsCount: 0,
      resendCount: prevCount,
      lastResentAt: new Date(),
      isUsed: false,
    });

    return {
      otp: rawOtp, // Only returned to caller for immediate transmission; NEVER stored raw in DB
      expiresAt,
      resendCooldownSeconds: RESEND_COOLDOWN_SECONDS,
    };
  }

  /**
   * Verify an incoming OTP against the persisted cryptographic hash.
   *
   * @param {Object} params
   * @param {string} [params.email]
   * @param {string} [params.phone]
   * @param {string} params.otp
   * @param {string} [params.purpose='email_verification']
   * @returns {Promise<{ success: boolean, email?: string, phone?: string, userId: string|null, purpose: string }>}
   */
  static async verifyOtp({ email = null, phone = null, otp, purpose = OTP_PURPOSES.EMAIL_VERIFICATION }) {
    if (!otp) {
      throw new AppError("Verification code is required", 400, "MISSING_REQUIRED_FIELDS");
    }

    const destFilter = this._getDestinationFilter({ email, phone, purpose });
    const cleanOtp = String(otp).trim();

    // Query active, non-expired OTP record
    const otpRecord = await Otp.findOne({
      ...destFilter,
      isUsed: false,
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      throw new AppError(
        "No active verification code found. Please request a new code.",
        400,
        "INVALID_OTP"
      );
    }

    // Expiry check
    if (new Date() > otpRecord.expiresAt) {
      otpRecord.isUsed = true;
      await otpRecord.save();
      throw new AppError(
        "Verification code has expired. Please request a new code.",
        400,
        "OTP_EXPIRED"
      );
    }

    // Rate-limit attempt ceiling check
    if (otpRecord.attemptsCount >= MAX_VERIFICATION_ATTEMPTS) {
      otpRecord.isUsed = true;
      await otpRecord.save();
      throw new AppError(
        "Maximum verification attempts exceeded. Please request a new code.",
        429,
        "OTP_MAX_ATTEMPTS_EXCEEDED"
      );
    }

    // Timing-safe cryptographic comparison
    const isMatch = verifyOtpHash(cleanOtp, otpRecord.otpHash);

    if (!isMatch) {
      otpRecord.attemptsCount += 1;
      const remainingAttempts = Math.max(0, MAX_VERIFICATION_ATTEMPTS - otpRecord.attemptsCount);

      if (remainingAttempts === 0) {
        otpRecord.isUsed = true;
      }

      await otpRecord.save();

      throw new AppError(
        remainingAttempts > 0
          ? `Invalid verification code. ${remainingAttempts} attempt(s) remaining.`
          : "Maximum verification attempts exceeded. Please request a new code.",
        remainingAttempts > 0 ? 400 : 429,
        remainingAttempts > 0 ? "INVALID_OTP" : "OTP_MAX_ATTEMPTS_EXCEEDED",
        { remainingAttempts }
      );
    }

    // Successfully verified: invalidate this OTP and record verification timestamp
    otpRecord.isUsed = true;
    otpRecord.verifiedAt = new Date();
    await otpRecord.save();

    // Invalidate any other leftover tokens for this purpose & destination
    await Otp.updateMany(
      { ...destFilter, _id: { $ne: otpRecord._id } },
      { $set: { isUsed: true } }
    );

    return {
      success: true,
      email: otpRecord.email,
      phone: otpRecord.phone,
      userId: otpRecord.userId,
      purpose: otpRecord.purpose,
    };
  }

  /**
   * Invalidate active pending OTPs for an identifier and purpose (e.g. after dispatch failure).
   *
   * @param {Object} params
   * @param {string} [params.email]
   * @param {string} [params.phone]
   * @param {string} [params.purpose='email_verification']
   * @returns {Promise<void>}
   */
  static async invalidateOtp({ email = null, phone = null, purpose = OTP_PURPOSES.EMAIL_VERIFICATION }) {
    if (!email && !phone) return;
    try {
      const destFilter = this._getDestinationFilter({ email, phone, purpose });
      await Otp.updateMany(
        { ...destFilter, isUsed: false },
        { $set: { isUsed: true } }
      );
    } catch {
      // Ignore filter error on invalidation
    }
  }
}

module.exports = OtpService;
