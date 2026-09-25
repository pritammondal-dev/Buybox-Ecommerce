const AuthenticationPolicy = require("../models/AuthenticationPolicy");
const AuthenticationReadinessService = require("./authentication-readiness.service");
const AuditLog = require("../models/AuditLog");
const { AUDIT_ACTIONS } = require("../constants/auth.constants");
const AppError = require("../errors/AppError");

const VALID_METHODS = ["emailPassword", "emailOtp", "mobileOtp", "google"];

class AuthenticationPolicyService {
  /**
   * Get the singleton authoritative policy document.
   */
  static async getAuthoritativePolicy() {
    return AuthenticationPolicy.getAuthoritativePolicy();
  }

  /**
   * Returns complete policy with live system readiness and calculated effective states.
   * Safe for Superadmin view.
   */
  static async getAdminPolicyWithReadiness() {
    const [policy, readiness] = await Promise.all([
      this.getAuthoritativePolicy(),
      AuthenticationReadinessService.getAllReadiness(),
    ]);

    const customerLogin = {};

    for (const method of VALID_METHODS) {
      const isPolicyEnabled = Boolean(policy.customerLogin?.[method]?.enabled);
      const methodReadiness = readiness[method] || {
        status: "NOT_CONFIGURED",
        reason: "Provider status unknown",
      };
      const isSystemReady = methodReadiness.status === "READY";
      const isEffective = isPolicyEnabled && isSystemReady;

      customerLogin[method] = {
        enabled: isPolicyEnabled,
        systemStatus: methodReadiness.status,
        effectiveEnabled: isEffective,
        reason: isEffective ? null : methodReadiness.reason || null,
        reasonCode: isEffective ? null : methodReadiness.reasonCode || null,
      };
    }

    return {
      customerLogin,
      registration: {
        enabled: Boolean(policy.registration?.enabled ?? true),
        requireEmailVerification: Boolean(
          policy.registration?.requireEmailVerification ?? true
        ),
        requirePhoneVerification: Boolean(
          policy.registration?.requirePhoneVerification ?? false
        ),
      },
      updatedAt: policy.updatedAt,
      updatedBy: policy.updatedBy,
    };
  }

  /**
   * Returns clean, client-safe boolean flags for storefront/customer login.
   * NEVER exposes internal diagnostics, error reasons, or secrets.
   */
  static async getEffectiveCustomerLoginMethods() {
    const adminView = await this.getAdminPolicyWithReadiness();

    return {
      emailPassword: adminView.customerLogin.emailPassword.effectiveEnabled,
      emailOtp: adminView.customerLogin.emailOtp.effectiveEnabled,
      mobileOtp: adminView.customerLogin.mobileOtp.effectiveEnabled,
      google: adminView.customerLogin.google.effectiveEnabled,
    };
  }

  /**
   * Enforce that a customer authentication method is currently effectively enabled.
   * Used in login controllers and OTP verification completion.
   *
   * @param {"emailPassword" | "emailOtp" | "mobileOtp" | "google"} methodName
   */
  static async assertCustomerLoginMethodEnabled(methodName) {
    if (!VALID_METHODS.includes(methodName)) {
      throw new AppError("Invalid authentication method specified.", 400, "INVALID_AUTH_METHOD");
    }

    const effectiveMethods = await this.getEffectiveCustomerLoginMethods();

    if (!effectiveMethods[methodName]) {
      throw new AppError(
        "The requested login method is currently disabled.",
        403,
        "AUTH_METHOD_DISABLED"
      );
    }
  }

  /**
   * Update the authentication policy with strict invariant checking and audit logging.
   */
  static async updatePolicy({ updates, actorUser, ipAddress = null, userAgent = null }) {
    if (!updates || typeof updates !== "object") {
      throw new AppError("Invalid update payload.", 400, "INVALID_PAYLOAD");
    }

    // Reject attempts to submit server-calculated fields
    const forbiddenFields = ["systemStatus", "effectiveEnabled", "status", "reason", "reasonCode"];
    for (const field of forbiddenFields) {
      if (field in updates) {
        throw new AppError(
          `Field '${field}' is server-calculated and cannot be modified.`,
          400,
          "FORBIDDEN_FIELD"
        );
      }
    }

    const policy = await this.getAuthoritativePolicy();
    const readiness = await AuthenticationReadinessService.getAllReadiness();

    // Normalize incoming updates (support both flat and nested payload)
    const proposedCustomerLogin = {
      emailPassword:
        updates.customerLogin?.emailPassword?.enabled ??
        (typeof updates.customerLogin?.emailPassword === "boolean" ? updates.customerLogin.emailPassword : null) ??
        (typeof updates.emailPassword === "boolean" ? updates.emailPassword : null) ??
        policy.customerLogin?.emailPassword?.enabled ??
        true,

      emailOtp:
        updates.customerLogin?.emailOtp?.enabled ??
        (typeof updates.customerLogin?.emailOtp === "boolean" ? updates.customerLogin.emailOtp : null) ??
        (typeof updates.emailOtp === "boolean" ? updates.emailOtp : null) ??
        policy.customerLogin?.emailOtp?.enabled ??
        false,

      mobileOtp:
        updates.customerLogin?.mobileOtp?.enabled ??
        (typeof updates.customerLogin?.mobileOtp === "boolean" ? updates.customerLogin.mobileOtp : null) ??
        (typeof updates.mobileOtp === "boolean" ? updates.mobileOtp : null) ??
        policy.customerLogin?.mobileOtp?.enabled ??
        false,

      google:
        updates.customerLogin?.google?.enabled ??
        (typeof updates.customerLogin?.google === "boolean" ? updates.customerLogin.google : null) ??
        (typeof updates.google === "boolean" ? updates.google : null) ??
        policy.customerLogin?.google?.enabled ??
        true,
    };

    // Calculate effective availability for all 4 methods
    let effectiveCount = 0;
    for (const method of VALID_METHODS) {
      const willBePolicyEnabled = Boolean(proposedCustomerLogin[method]);
      const isReady = readiness[method]?.status === "READY";
      if (willBePolicyEnabled && isReady) {
        effectiveCount++;
      }
    }

    // CRITICAL SECURITY INVARIANT:
    // Never allow Superadmin to disable all effective login methods.
    if (effectiveCount === 0) {
      throw new AppError(
        "At least one usable customer login method must remain enabled.",
        400,
        "NO_USABLE_AUTH_METHOD"
      );
    }

    const beforeState = {
      customerLogin: {
        emailPassword: policy.customerLogin?.emailPassword?.enabled,
        emailOtp: policy.customerLogin?.emailOtp?.enabled,
        mobileOtp: policy.customerLogin?.mobileOtp?.enabled,
        google: policy.customerLogin?.google?.enabled,
      },
      registration: {
        enabled: policy.registration?.enabled,
        requireEmailVerification: policy.registration?.requireEmailVerification,
        requirePhoneVerification: policy.registration?.requirePhoneVerification,
      },
    };

    // Apply updates
    policy.customerLogin = policy.customerLogin || {};
    for (const method of VALID_METHODS) {
      policy.customerLogin[method] = {
        enabled: Boolean(proposedCustomerLogin[method]),
      };
    }

    if (updates.registration && typeof updates.registration === "object") {
      policy.registration = policy.registration || {};
      if (typeof updates.registration.enabled === "boolean") {
        policy.registration.enabled = updates.registration.enabled;
      }
      if (typeof updates.registration.requireEmailVerification === "boolean") {
        policy.registration.requireEmailVerification = updates.registration.requireEmailVerification;
      }
      if (typeof updates.registration.requirePhoneVerification === "boolean") {
        policy.registration.requirePhoneVerification = updates.registration.requirePhoneVerification;
      }
    }

    policy.updatedBy = actorUser?._id || actorUser?.id || null;
    await policy.save();

    const afterState = {
      customerLogin: {
        emailPassword: policy.customerLogin.emailPassword.enabled,
        emailOtp: policy.customerLogin.emailOtp.enabled,
        mobileOtp: policy.customerLogin.mobileOtp.enabled,
        google: policy.customerLogin.google.enabled,
      },
      registration: {
        enabled: policy.registration.enabled,
        requireEmailVerification: policy.registration.requireEmailVerification,
        requirePhoneVerification: policy.registration.requirePhoneVerification,
      },
    };

    // Audit Logging
    try {
      if (actorUser) {
        await AuditLog.create({
          actorId: actorUser._id || actorUser.id,
          targetId: policy._id,
          action: AUDIT_ACTIONS.AUTH_POLICY_UPDATED,
          entityType: "AuthenticationPolicy",
          beforeState,
          afterState,
          ipAddress,
          userAgent,
        });

        // Record individual toggle actions if state changed
        for (const method of VALID_METHODS) {
          const oldVal = beforeState.customerLogin[method];
          const newVal = afterState.customerLogin[method];
          if (oldVal !== newVal) {
            await AuditLog.create({
              actorId: actorUser._id || actorUser.id,
              targetId: policy._id,
              action: newVal ? AUDIT_ACTIONS.AUTH_METHOD_ENABLED : AUDIT_ACTIONS.AUTH_METHOD_DISABLED,
              entityType: "AuthenticationPolicy",
              beforeState: { method, enabled: oldVal },
              afterState: { method, enabled: newVal },
              ipAddress,
              userAgent,
            });
          }
        }
      }
    } catch {
      // Audit log failures must not crash the update operation
    }

    return this.getAdminPolicyWithReadiness();
  }
}

module.exports = AuthenticationPolicyService;
