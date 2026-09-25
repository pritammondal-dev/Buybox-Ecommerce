const express = require("express");

const authController = require("../controllers/auth.controller");
const validate = require("../middlewares/validate.middleware");
const authenticate = require("../middlewares/authentication.middleware");

// Existing validators
const { registerSchema } = require("../validators/auth/register.validator");
const { loginSchema } = require("../validators/auth/login.validator");
const {
  refreshSchema,
  validateRefreshToken,
} = require("../validators/auth/refresh.validator");
const {
  passwordResetRequestSchema,
} = require("../validators/auth/password-reset-request.validator");
const {
  passwordResetSchema,
} = require("../validators/auth/password-reset.validator");
const {
  changePasswordSchema,
} = require("../validators/auth/change-password.validator");
const {
  verifyOtpSchema,
  resendOtpSchema,
} = require("../validators/auth/otp.validator");

// Multi-method validators
const {
  emailLoginOtpRequestSchema,
  emailLoginOtpVerifySchema,
  phoneLoginOtpRequestSchema,
  phoneLoginOtpVerifySchema,
  phoneRegisterRequestSchema,
  phoneRegisterVerifySchema,
  googleAuthSchema,
  changeEmailRequestSchema,
  changeEmailVerifySchema,
  changePhoneRequestSchema,
  changePhoneVerifySchema,
} = require("../validators/auth/multi-method.validator");

// Rate limiters
const {
  authRegistrationLimiter,
  authLoginLimiter,
  otpRequestLimiter,
  otpVerificationLimiter,
  otpResendLimiter,
  accountSecurityLimiter,
} = require("../middlewares/rate-limiter.middleware");

const router = express.Router();

/* ==========================================================================
   1. REGISTRATION ENDPOINTS
   ========================================================================== */

// Email Registration (with OTP dispatch)
router.post(
  "/register",
  authRegistrationLimiter,
  validate(registerSchema),
  authController.register
);

// Mobile Registration (Request OTP)
router.post(
  "/register/phone/request",
  authRegistrationLimiter,
  validate(phoneRegisterRequestSchema),
  authController.registerWithPhoneRequest
);

// Mobile Registration (Verify OTP & Create Account)
router.post(
  "/register/phone/verify",
  otpVerificationLimiter,
  validate(phoneRegisterVerifySchema),
  authController.registerWithPhoneVerify
);

/* ==========================================================================
   2. LOGIN ENDPOINTS
   ========================================================================== */

// Available Customer Login Methods (Public effective availability)
router.get("/login-methods", authController.getPublicLoginMethods);

// Email + Password Login
router.post(
  "/login",
  authLoginLimiter,
  validate(loginSchema),
  authController.login
);

// Email + OTP Login (Request)
router.post(
  "/login/email-otp/request",
  otpRequestLimiter,
  validate(emailLoginOtpRequestSchema),
  authController.loginWithEmailOtpRequest
);

// Email + OTP Login (Verify)
router.post(
  "/login/email-otp/verify",
  otpVerificationLimiter,
  validate(emailLoginOtpVerifySchema),
  authController.loginWithEmailOtpVerify
);

// Mobile + OTP Login (Request)
router.post(
  "/login/phone-otp/request",
  otpRequestLimiter,
  validate(phoneLoginOtpRequestSchema),
  authController.loginWithPhoneOtpRequest
);

// Mobile + OTP Login (Verify)
router.post(
  "/login/phone-otp/verify",
  otpVerificationLimiter,
  validate(phoneLoginOtpVerifySchema),
  authController.loginWithPhoneOtpVerify
);

// Google Sign-In (Server-Side Verified)
router.post(
  "/google",
  authLoginLimiter,
  validate(googleAuthSchema),
  authController.loginWithGoogle
);

/* ==========================================================================
   3. SESSION & TOKEN MANAGEMENT
   ========================================================================== */

// Refresh Access Token
router.post(
  "/refresh",
  validateRefreshToken,
  authController.refresh
);

// Logout Current Session
router.post(
  "/logout",
  validateRefreshToken,
  authController.logout
);

// Logout All Sessions across All Devices
router.post(
  "/logout-all",
  authenticate,
  authController.logoutAll
);

/* ==========================================================================
   4. EMAIL VERIFICATION & OTP MANAGEMENT
   ========================================================================== */

// Verify Email Link
router.get(
  "/verify-email",
  authController.verifyEmail
);

// Verify General OTP (Email Verification)
router.post(
  "/verify-otp",
  otpVerificationLimiter,
  validate(verifyOtpSchema),
  authController.verifyOtp
);

// Resend OTP
router.post(
  "/resend-otp",
  otpResendLimiter,
  validate(resendOtpSchema),
  authController.resendOtp
);

/* ==========================================================================
   5. PASSWORD RESET
   ========================================================================== */

router.post(
  "/forgot-password",
  validate(passwordResetRequestSchema),
  authController.requestPasswordReset
);

router.post(
  "/reset-password",
  validate(passwordResetSchema),
  authController.resetPassword
);

/* ==========================================================================
   6. ACCOUNT SECURITY (AUTHENTICATED CUSTOMER)
   ========================================================================== */

// Change Password
router.post(
  "/change-password",
  authenticate,
  accountSecurityLimiter,
  validate(changePasswordSchema),
  authController.changePassword
);

// Change Email (Request)
router.post(
  "/change-email/request",
  authenticate,
  accountSecurityLimiter,
  validate(changeEmailRequestSchema),
  authController.changeEmailRequest
);

// Change Email (Verify)
router.post(
  "/change-email/verify",
  authenticate,
  accountSecurityLimiter,
  validate(changeEmailVerifySchema),
  authController.changeEmailVerify
);

// Change Mobile Number (Request)
router.post(
  "/change-phone/request",
  authenticate,
  accountSecurityLimiter,
  validate(changePhoneRequestSchema),
  authController.changePhoneRequest
);

// Change Mobile Number (Verify)
router.post(
  "/change-phone/verify",
  authenticate,
  accountSecurityLimiter,
  validate(changePhoneVerifySchema),
  authController.changePhoneVerify
);

module.exports = router;