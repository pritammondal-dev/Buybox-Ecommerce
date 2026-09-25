const logger = require("../config/logger");
const AppError = require("../errors/AppError");
const env = require("../config/env");
const { maskPhoneNumber } = require("../utils/phone.util");

/**
 * Production SMS Delivery Service Interface
 *
 * Implements standard SMS abstraction without faking delivery.
 * When no active SMS provider (e.g., Twilio, AWS SNS, Msg91) is configured,
 * it safely reports unconfigured status and fails closed, ensuring OTPs are
 * promptly invalidated and never exposed.
 */
class SmsService {
  constructor() {
    this.provider = (process.env.SMS_PROVIDER || "").toLowerCase().trim();
  }

  /**
   * Determine whether an external SMS delivery provider is actively configured.
   * @returns {boolean}
   */
  isConfigured() {
    if (!this.provider || this.provider === "none") {
      return false;
    }

    if (this.provider === "twilio") {
      return Boolean(
        process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_PHONE_NUMBER
      );
    }

    if (this.provider === "aws_sns") {
      return Boolean(
        process.env.AWS_ACCESS_KEY_ID &&
        process.env.AWS_SECRET_ACCESS_KEY &&
        process.env.AWS_REGION
      );
    }

    return false;
  }

  /**
   * Dispatch an OTP to a verified mobile number.
   *
   * @param {Object} params
   * @param {string} params.to E.164 normalized recipient mobile number
   * @param {string} params.otp Plaintext 6-digit OTP (used ONLY in memory for transmission)
   * @param {string} [params.purpose='login_phone_otp']
   * @returns {Promise<{ success: boolean, messageId?: string, error?: string, code?: string }>}
   */
  async sendOtp({ to, otp, purpose = "login_phone_otp" }) {
    if (!to) {
      throw new AppError("Recipient mobile number is required", 400, "PHONE_REQUIRED");
    }

    if (!this.isConfigured()) {
      logger.warn("SMS delivery requested but SMS provider is not configured:", {
        recipient: maskPhoneNumber(to),
        purpose,
        configuredProvider: this.provider || "none",
      });

      return {
        success: false,
        error: "SMS delivery service is not configured on this server. Please contact support or use Email OTP.",
        code: "SMS_PROVIDER_NOT_CONFIGURED",
      };
    }

    try {
      if (this.provider === "twilio") {
        // Twilio integration driver
        const twilio = require("twilio")(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );

        const message = await twilio.messages.create({
          body: `Your Buybox verification code is ${otp}. Valid for 10 minutes. Do not share this code.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to,
        });

        logger.info("SMS OTP dispatched successfully via Twilio:", {
          recipient: maskPhoneNumber(to),
          messageId: message.sid,
          purpose,
        });

        return {
          success: true,
          messageId: message.sid,
        };
      }

      return {
        success: false,
        error: `Unsupported SMS provider: ${this.provider}`,
        code: "SMS_PROVIDER_UNSUPPORTED",
      };
    } catch (err) {
      logger.error("SMS provider transmission failed:", {
        recipient: maskPhoneNumber(to),
        purpose,
        error: err.message,
      });

      return {
        success: false,
        error: "Failed to dispatch SMS verification code. Please try again later.",
        code: "SMS_DELIVERY_FAILED",
      };
    }
  }
}

module.exports = new SmsService();
