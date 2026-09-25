const rateLimit = require("express-rate-limit");
const env = require("../config/env");

/**
 * Standard handler for rate limit exceeded events to maintain consistent API error format.
 */
const rateLimitHandler = (message, code = "TOO_MANY_REQUESTS") => (req, res) => {
  res.status(429).json({
    success: false,
    statusCode: 429,
    code,
    message,
    timestamp: new Date().toISOString(),
  });
};

const isTestEnv = env.NODE_ENV === "test" || process.env.NODE_ENV === "test";

/**
 * Rate limiter for customer & vendor registration attempts.
 * Prevents account creation abuse and credential stuffing.
 */
const authRegistrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTestEnv ? 1000 : 20, // 20 requests per 15 min in prod/dev
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  handler: rateLimitHandler(
    "Too many registration attempts from this IP address. Please try again in 15 minutes.",
    "REGISTRATION_RATE_LIMIT_EXCEEDED"
  ),
});

/**
 * Rate limiter for OTP verification endpoints.
 * Secondary layer above single-token attempt limits.
 */
const otpVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTestEnv ? 1000 : 30, // 30 requests per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  handler: rateLimitHandler(
    "Too many verification attempts from this IP address. Please wait a few minutes and try again.",
    "OTP_VERIFICATION_RATE_LIMIT_EXCEEDED"
  ),
});

/**
 * Rate limiter for OTP resend endpoints.
 * Secondary layer above the 60-second database-enforced cooldown.
 */
const otpResendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTestEnv ? 1000 : 15, // 15 requests per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  handler: rateLimitHandler(
    "Too many code resend requests. Please wait before requesting additional verification codes.",
    "OTP_RESEND_RATE_LIMIT_EXCEEDED"
  ),
});

/**
 * Rate limiter for login endpoints (password, email OTP, phone OTP, Google).
 */
const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTestEnv ? 1000 : 30, // 30 requests per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  handler: rateLimitHandler(
    "Too many login attempts from this IP address. Please wait a few minutes before trying again.",
    "LOGIN_RATE_LIMIT_EXCEEDED"
  ),
});

/**
 * Rate limiter for OTP dispatch requests (email OTP, phone OTP).
 */
const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTestEnv ? 1000 : 20, // 20 requests per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  handler: rateLimitHandler(
    "Too many code requests from this IP address. Please wait before requesting another code.",
    "OTP_REQUEST_RATE_LIMIT_EXCEEDED"
  ),
});

/**
 * Rate limiter for sensitive account security changes (change email, change phone, change password).
 */
const accountSecurityLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTestEnv ? 1000 : 15, // 15 requests per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  handler: rateLimitHandler(
    "Too many account security modification requests. Please wait a few minutes before trying again.",
    "ACCOUNT_SECURITY_RATE_LIMIT_EXCEEDED"
  ),
});

/**
 * Rate limiter for sensitive administrator operations.
 * Protects staff provisioning, role updates, bulk import/export, and financial operations.
 */
const adminSensitiveOpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: isTestEnv ? 1000 : 50, // 50 requests per 5 min
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  handler: rateLimitHandler(
    "Rate limit exceeded for sensitive administrative operations. Please wait 5 minutes before retrying.",
    "ADMIN_RATE_LIMIT_EXCEEDED"
  ),
});

module.exports = {
  authRegistrationLimiter,
  authLoginLimiter,
  otpRequestLimiter,
  otpVerificationLimiter,
  otpResendLimiter,
  accountSecurityLimiter,
  adminSensitiveOpLimiter,
};

