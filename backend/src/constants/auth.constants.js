const ROLES = Object.freeze({
  CUSTOMER: "customer",
  VENDOR: "vendor",
  SUPPORT: "support",
  MANAGER: "manager",
  EDITOR: "editor",
  ADMIN: "admin",
  SUPER_ADMIN: "super_admin",
});

const OTP_PURPOSES = Object.freeze({
  EMAIL_VERIFICATION: "email_verification",
  PASSWORD_RESET: "password_reset",
  LOGIN_EMAIL_OTP: "login_email_otp",
  LOGIN_PHONE_OTP: "login_phone_otp",
  CHANGE_EMAIL_OTP: "change_email_otp",
  CHANGE_PHONE_OTP: "change_phone_otp",
  LOGIN: "login", // Legacy compatibility
});

const AUDIT_ACTIONS = Object.freeze({
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILED: "LOGIN_FAILED",
  OTP_REQUESTED: "OTP_REQUESTED",
  OTP_VERIFIED: "OTP_VERIFIED",
  OTP_FAILED: "OTP_FAILED",
  GOOGLE_LOGIN_SUCCESS: "GOOGLE_LOGIN_SUCCESS",
  GOOGLE_LOGIN_FAILED: "GOOGLE_LOGIN_FAILED",
  PASSWORD_CHANGED: "PASSWORD_CHANGED",
  EMAIL_CHANGED: "EMAIL_CHANGED",
  PHONE_CHANGED: "PHONE_CHANGED",
  LOGOUT: "LOGOUT",
  LOGOUT_ALL: "LOGOUT_ALL",
  AUTH_POLICY_UPDATED: "AUTH_POLICY_UPDATED",
  AUTH_METHOD_ENABLED: "AUTH_METHOD_ENABLED",
  AUTH_METHOD_DISABLED: "AUTH_METHOD_DISABLED",
});

module.exports = {
  ROLES,
  OTP_PURPOSES,
  AUDIT_ACTIONS,
};
