const { OAuth2Client } = require("google-auth-library");
const AppError = require("../errors/AppError");
const logger = require("../config/logger");

const VALID_ISSUERS = ["accounts.google.com", "https://accounts.google.com"];

/**
 * Production Google OAuth / OIDC Server-Side Verification Service
 */
class GoogleAuthService {
  constructor() {
    this.clientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
    this.client = new OAuth2Client(this.clientId);
  }

  /**
   * Dynamically resolve current Google Client ID from environment.
   * @returns {string}
   */
  getClientId() {
    return (process.env.GOOGLE_CLIENT_ID || this.clientId || "").trim();
  }

  /**
   * Cryptographically verify a Google ID Token received from frontend Google Sign-In.
   *
   * @param {string} idToken Google ID token
   * @returns {Promise<{ sub: string, email: string, emailVerified: boolean, firstName: string, lastName: string, picture: string|null }>}
   */
  async verifyIdToken(idToken) {
    if (!idToken || typeof idToken !== "string") {
      throw new AppError("Google ID token is required", 400, "GOOGLE_TOKEN_REQUIRED");
    }

    try {
      const currentClientId = this.getClientId();
      const verifyOptions = {
        idToken,
      };

      // If GOOGLE_CLIENT_ID is configured, enforce strict audience matching
      if (currentClientId) {
        verifyOptions.audience = currentClientId;
      }

      const ticket = await this.client.verifyIdToken(verifyOptions);
      const payload = ticket.getPayload();

      if (!payload) {
        throw new AppError("Invalid Google token payload", 401, "INVALID_GOOGLE_TOKEN");
      }

      // Verify Audience explicitly if configured
      if (currentClientId && payload.aud && payload.aud !== currentClientId) {
        throw new AppError("Google token audience mismatch", 401, "INVALID_GOOGLE_AUDIENCE");
      }

      // Verify Issuer
      if (!payload.iss || !VALID_ISSUERS.includes(payload.iss)) {
        throw new AppError("Untrusted Google token issuer", 401, "INVALID_GOOGLE_ISSUER");
      }

      // Verify Expiration
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < nowSeconds) {
        throw new AppError("Google token has expired. Please sign in again.", 401, "GOOGLE_TOKEN_EXPIRED");
      }

      // Ensure stable provider identity (sub) is present
      if (!payload.sub) {
        throw new AppError("Google token is missing verified user subject (sub)", 401, "INVALID_GOOGLE_SUBJECT");
      }

      // Ensure email is verified by Google to prevent spoofing
      if (!payload.email) {
        throw new AppError("Google account does not provide an email address", 400, "GOOGLE_EMAIL_MISSING");
      }

      if (!payload.email_verified) {
        throw new AppError("Google email address is not verified by Google. Cannot proceed with sign-in.", 403, "GOOGLE_EMAIL_NOT_VERIFIED");
      }

      return {
        sub: payload.sub,
        email: payload.email.toLowerCase().trim(),
        emailVerified: Boolean(payload.email_verified),
        firstName: payload.given_name || payload.name || "Customer",
        lastName: payload.family_name || "",
        picture: payload.picture || null,
      };
    } catch (err) {
      if (err instanceof AppError) {
        throw err;
      }

      logger.warn("Google ID token verification failed:", {
        error: err.message,
      });

      throw new AppError(
        "Google authentication failed. The verification token was invalid or expired.",
        401,
        "GOOGLE_AUTH_FAILED"
      );
    }
  }
}

module.exports = new GoogleAuthService();
