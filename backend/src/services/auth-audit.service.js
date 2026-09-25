const AuditLog = require("../models/AuditLog");
const logger = require("../config/logger");
const { AUDIT_ACTIONS } = require("../constants/auth.constants");

/**
 * Customer Authentication Audit Logger
 * Records security audit events without storing sensitive secrets, passwords, tokens, or OTPs.
 */
class AuthAuditService {
  /**
   * Record a customer authentication security event.
   *
   * @param {Object} params
   * @param {string} params.action Must be one of AUDIT_ACTIONS
   * @param {string|mongoose.Types.ObjectId} [params.actorId] User ID of the actor (if authenticated/known)
   * @param {string|mongoose.Types.ObjectId} [params.targetId] Target user ID
   * @param {string} [params.ipAddress]
   * @param {string} [params.userAgent]
   * @param {Object} [params.metadata] Safe non-sensitive context
   */
  static async recordEvent({
    action,
    actorId = null,
    targetId = null,
    ipAddress = null,
    userAgent = null,
    metadata = null,
  }) {
    // Sanitize metadata to guarantee no secrets, OTPs, or passwords are ever captured
    const sanitizedMetadata = metadata ? { ...metadata } : {};
    delete sanitizedMetadata.password;
    delete sanitizedMetadata.currentPassword;
    delete sanitizedMetadata.newPassword;
    delete sanitizedMetadata.confirmPassword;
    delete sanitizedMetadata.otp;
    delete sanitizedMetadata.otpHash;
    delete sanitizedMetadata.token;
    delete sanitizedMetadata.accessToken;
    delete sanitizedMetadata.refreshToken;
    delete sanitizedMetadata.idToken;

    // Structured logger record
    logger.info(`[AUTH_AUDIT] ${action}`, {
      action,
      actorId: actorId ? String(actorId) : undefined,
      ipAddress,
      metadata: sanitizedMetadata,
    });

    // If an actorId is available, record to immutable AuditLog collection
    if (actorId) {
      try {
        await AuditLog.create({
          actorId,
          targetId: targetId || actorId,
          action,
          entityType: "CUSTOMER_AUTH",
          beforeState: null,
          afterState: sanitizedMetadata,
          ipAddress,
          userAgent,
        });
      } catch (err) {
        // Log error but never break user auth flow on audit persistence failure
        logger.error("Failed to write to AuditLog collection:", {
          action,
          error: err.message,
        });
      }
    }
  }
}

module.exports = AuthAuditService;
