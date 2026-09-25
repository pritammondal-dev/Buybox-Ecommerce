const googleAuthService = require("./google-auth.service");
const smsService = require("./sms.service");
const PlatformCredential = require("../models/PlatformCredential");
const env = require("../config/env");
const { decrypt } = require("../utils/crypto.util");

class AuthenticationReadinessService {
  /**
   * Determine Email + Password system readiness.
   * Local password hashing and MongoDB storage are always operational.
   */
  static async getEmailPasswordReadiness() {
    return {
      status: "READY",
      reasonCode: null,
      reason: null,
    };
  }

  /**
   * Determine Google OAuth server-side readiness.
   */
  static async getGoogleReadiness() {
    const clientId = googleAuthService.getClientId();

    if (clientId && clientId.length > 5) {
      return {
        status: "READY",
        reasonCode: null,
        reason: null,
      };
    }

    return {
      status: "NOT_CONFIGURED",
      reasonCode: "GOOGLE_NOT_CONFIGURED",
      reason: "Google OAuth Client ID is not configured.",
    };
  }

  /**
   * Determine Email OTP delivery system readiness.
   * Checks PlatformCredential record and environment variables.
   * NEVER exposes API keys or internal secrets.
   */
  static async getEmailOtpReadiness() {
    // In automated testing environments, ElasticEmailProvider simulates delivery
    if (
      (process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID !== undefined) &&
      process.env.TEST_SIMULATE_EMAIL_DOWN !== "true"
    ) {
      return {
        status: "READY",
        reasonCode: null,
        reason: null,
      };
    }

    // 1. Check if configured in environment variables
    const envApiKey = (
      env.ELASTIC_EMAIL_API_KEY ||
      process.env.ELASTIC_EMAIL_API_KEY ||
      ""
    ).trim();

    const envFromEmail = (
      env.ELASTIC_EMAIL_FROM_EMAIL ||
      process.env.ELASTIC_EMAIL_FROM_EMAIL ||
      ""
    ).trim();

    if (envApiKey && envFromEmail) {
      return {
        status: "READY",
        reasonCode: null,
        reason: null,
      };
    }

    // 2. Check if configured in PlatformCredential collection
    try {
      const record = await PlatformCredential.findOne({
        provider: "elastic_email",
      });

      if (record && record.encryptedPayload) {
        const creds = decrypt(record.encryptedPayload);
        if (creds && creds.apiKey && creds.fromEmail) {
          if (record.status === "error") {
            return {
              status: "ERROR",
              reasonCode: "EMAIL_PROVIDER_ERROR",
              reason: "Email delivery provider encountered connection errors.",
            };
          }
          return {
            status: "READY",
            reasonCode: null,
            reason: null,
          };
        }
      }
    } catch {
      // Best-effort check; fail closed to NOT_READY
    }

    // 3. Fallback check for SMTP if configured as primary provider
    const providerType = (
      env.EMAIL_PROVIDER ||
      process.env.EMAIL_PROVIDER ||
      ""
    ).toLowerCase().trim();

    if (providerType === "smtp") {
      const smtpHost = env.SMTP_HOST || process.env.SMTP_HOST;
      const smtpUser = env.SMTP_USER || process.env.SMTP_USER;
      if (smtpHost && smtpUser) {
        return {
          status: "READY",
          reasonCode: null,
          reason: null,
        };
      }
    }

    return {
      status: "NOT_READY",
      reasonCode: "EMAIL_PROVIDER_UNAVAILABLE",
      reason: "Email delivery provider is unavailable.",
    };
  }

  /**
   * Determine Mobile OTP delivery system readiness.
   * Checks if an external SMS provider (e.g. Twilio, AWS SNS) is configured.
   */
  static async getMobileOtpReadiness() {
    if (
      (process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID !== undefined) &&
      process.env.TEST_SMS_READY === "true"
    ) {
      return {
        status: "READY",
        reasonCode: null,
        reason: null,
      };
    }

    const isConfigured = smsService.isConfigured();

    if (isConfigured) {
      return {
        status: "READY",
        reasonCode: null,
        reason: null,
      };
    }

    return {
      status: "NOT_CONFIGURED",
      reasonCode: "SMS_PROVIDER_NOT_CONFIGURED",
      reason: "SMS provider is not configured.",
    };
  }

  /**
   * Calculate readiness dictionary for all 4 customer login methods.
   */
  static async getAllReadiness() {
    const [emailPassword, google, emailOtp, mobileOtp] = await Promise.all([
      this.getEmailPasswordReadiness(),
      this.getGoogleReadiness(),
      this.getEmailOtpReadiness(),
      this.getMobileOtpReadiness(),
    ]);

    return {
      emailPassword,
      google,
      emailOtp,
      mobileOtp,
    };
  }
}

module.exports = AuthenticationReadinessService;
