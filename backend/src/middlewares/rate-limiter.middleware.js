const rateLimit = require("express-rate-limit");
const env = require("../config/env");
const redis = require("../config/redis");
const RedisRateLimitStore = require("./rate-limit-redis-store");

/**
 * Standard handler for rate limit exceeded events to maintain consistent API error format.
 * Emits Retry-After header and RFC-compliant JSON payload.
 */
const rateLimitHandler = (message, code = "TOO_MANY_REQUESTS") => (req, res, next, options) => {
  const retryAfter = options && options.windowMs ? Math.ceil(options.windowMs / 1000) : 60;
  res.setHeader("Retry-After", String(retryAfter));
  res.status(429).json({
    success: false,
    statusCode: 429,
    code,
    message,
    retryAfter,
    timestamp: new Date().toISOString(),
  });
};

const isTestEnv = env.NODE_ENV === "test" || process.env.NODE_ENV === "test";

/**
 * Stable client identifier resolver.
 * For authenticated callers (customer, vendor, administrator), keys by their secure entity ID
 * to prevent collective IP lockout in shared office or mobile carrier NAT networks.
 * For unauthenticated callers, keys by the validated client IP derived via trusted proxy.
 */
const resolveClientKey = (req) => {
  const authId = req.user?.id || req.administrator?.id || req.customer?.id || req.vendor?.id;
  if (authId) {
    return `user:${authId}`;
  }
  return req.ip || "unknown-ip";
};

/**
 * Factory for creating distributed Redis-backed rate limiters with graceful degradation.
 *
 * @param {Object} config
 * @param {number} config.windowMs - Time window in milliseconds
 * @param {number} config.max - Maximum requests allowed per window
 * @param {string} config.prefix - Redis key prefix
 * @param {"fail-closed"|"fallback-memory"} [config.failPolicy="fallback-memory"] - Outage policy
 * @param {string} config.message - Rate limit message
 * @param {string} config.code - Error code
 * @param {Function} [config.keyGenerator] - Custom key generator
 * @returns {import("express").RequestHandler}
 */
const createRateLimiter = ({
  windowMs,
  max,
  prefix,
  failPolicy = "fallback-memory",
  message,
  code,
  keyGenerator = resolveClientKey,
}) => {
  const store = new RedisRateLimitStore({
    client: redis,
    prefix: `rl:${prefix}:`,
    failPolicy,
  });

  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    store,
    keyGenerator,
    validate: {
      keyGeneratorIpFallback: false,
      xForwardedForHeader: false,
    },
    skip: (req) => isTestEnv && !req.headers["x-test-enforce-rate-limit"] && process.env.ENFORCE_RATE_LIMIT_TEST !== "true",
    handler: rateLimitHandler(message, code),
  });
};

// ============================================================================
// ENDPOINT-SPECIFIC RATE-LIMIT POLICIES
// ============================================================================

/**
 * 1. Customer & Vendor Registration
 * Prevents account creation abuse, bot farms, and credential stuffing.
 * Policy: 20 requests per 15 min, fail-closed on Redis outage.
 */
const authRegistrationLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  prefix: "registration",
  failPolicy: "fail-closed",
  message: "Too many registration attempts from this IP address. Please try again in 15 minutes.",
  code: "REGISTRATION_RATE_LIMIT_EXCEEDED",
  keyGenerator: (req) => req.ip || "unknown-ip",
});

/**
 * 2. Login Endpoints (Customer, Vendor, Administrator, Google Auth)
 * Protects authentication endpoints from password spraying and brute force.
 * Policy: 30 requests per 15 min, fail-closed on Redis outage.
 */
const authLoginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  prefix: "login",
  failPolicy: "fail-closed",
  message: "Too many login attempts from this IP address. Please wait a few minutes before trying again.",
  code: "LOGIN_RATE_LIMIT_EXCEEDED",
  keyGenerator: (req) => req.ip || "unknown-ip",
});

/**
 * 3. Token Refresh Endpoints
 * Protects session token rotation from high-frequency polling abuse.
 * Policy: 120 requests per 15 min, fallback-memory on Redis outage.
 */
const tokenRefreshLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 120,
  prefix: "refresh",
  failPolicy: "fallback-memory",
  message: "Too many token refresh requests. Please wait before retrying.",
  code: "REFRESH_RATE_LIMIT_EXCEEDED",
});

/**
 * 4. OTP Request & Dispatch (Email OTP, SMS OTP)
 * Protects transactional messaging quotas and prevents SMS/email pumping.
 * Policy: 20 requests per 15 min, fail-closed on Redis outage.
 */
const otpRequestLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  prefix: "otp-request",
  failPolicy: "fail-closed",
  message: "Too many code requests from this IP address. Please wait before requesting another code.",
  code: "OTP_REQUEST_RATE_LIMIT_EXCEEDED",
  keyGenerator: (req) => req.ip || "unknown-ip",
});

/**
 * 5. OTP Verification Endpoints
 * Secondary layer above token attempt limits to prevent automated PIN search.
 * Policy: 30 requests per 15 min, fail-closed on Redis outage.
 */
const otpVerificationLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  prefix: "otp-verify",
  failPolicy: "fail-closed",
  message: "Too many verification attempts from this IP address. Please wait a few minutes and try again.",
  code: "OTP_VERIFICATION_RATE_LIMIT_EXCEEDED",
  keyGenerator: (req) => req.ip || "unknown-ip",
});

/**
 * 6. OTP Resend Endpoints
 * Secondary layer above database-enforced 60-second cooldown.
 * Policy: 15 requests per 15 min, fail-closed on Redis outage.
 */
const otpResendLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  prefix: "otp-resend",
  failPolicy: "fail-closed",
  message: "Too many code resend requests. Please wait before requesting additional verification codes.",
  code: "OTP_RESEND_RATE_LIMIT_EXCEEDED",
  keyGenerator: (req) => req.ip || "unknown-ip",
});

/**
 * 7. Sensitive Account Security Changes (Email, Phone, Password)
 * Policy: 15 requests per 15 min, fail-closed on Redis outage.
 */
const accountSecurityLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  prefix: "security",
  failPolicy: "fail-closed",
  message: "Too many account security modification requests. Please wait a few minutes before trying again.",
  code: "ACCOUNT_SECURITY_RATE_LIMIT_EXCEEDED",
});

/**
 * 8. Checkout Quote & Order Placement
 * Prevents checkout abuse, quote flooding, and inventory lockouts.
 * Policy: 60 requests per 15 min per user/IP, fallback-memory on Redis outage.
 */
const checkoutLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  prefix: "checkout",
  failPolicy: "fallback-memory",
  message: "Too many checkout requests. Please wait a few minutes before trying again.",
  code: "CHECKOUT_RATE_LIMIT_EXCEEDED",
});

/**
 * 9. Payment Initiation & Financial Transactions
 * Protects gateway integration against card testing and automated transaction floods.
 * Policy: 45 requests per 15 min per user/IP, fallback-memory on Redis outage.
 */
const paymentLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 45,
  prefix: "payment",
  failPolicy: "fallback-memory",
  message: "Too many payment requests. Please wait a few minutes before trying again.",
  code: "PAYMENT_RATE_LIMIT_EXCEEDED",
});

/**
 * 10. Webhook Ingestion (Razorpay, PayPal, Courier)
 * High-burst budget for legitimate webhook delivery spikes while preventing unbounded DDoS.
 * Policy: 120 requests per 1 min, fallback-memory on Redis outage.
 */
const webhookLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  prefix: "webhook",
  failPolicy: "fallback-memory",
  message: "Too many webhook requests received. Retrying within rate limit window.",
  code: "WEBHOOK_RATE_LIMIT_EXCEEDED",
  keyGenerator: (req) => req.ip || "unknown-ip",
});

/**
 * 11. Protected Digital Asset Downloads
 * Prevents egress bandwidth exhaustion and entitlement asset scraping.
 * Policy: 30 downloads per 15 min per user/IP, fallback-memory on Redis outage.
 */
const digitalDownloadLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  prefix: "download",
  failPolicy: "fallback-memory",
  message: "Download rate limit exceeded. Please wait before initiating additional downloads.",
  code: "DOWNLOAD_RATE_LIMIT_EXCEEDED",
});

/**
 * 12. File Uploads & Catalog Import
 * Protects disk storage and object storage ingest bandwidth from upload flooding.
 * Policy: 40 uploads per 15 min per user/IP, fallback-memory on Redis outage.
 */
const uploadLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 40,
  prefix: "upload",
  failPolicy: "fallback-memory",
  message: "Upload rate limit exceeded. Please wait before uploading additional files.",
  code: "UPLOAD_RATE_LIMIT_EXCEEDED",
});

/**
 * 13. Sensitive Administrator Operations
 * Protects staff provisioning, role updates, bulk import/export, and system settings.
 * Policy: 50 requests per 5 min, fail-closed on Redis outage.
 */
const adminSensitiveOpLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 50,
  prefix: "admin",
  failPolicy: "fail-closed",
  message: "Rate limit exceeded for sensitive administrative operations. Please wait 5 minutes before retrying.",
  code: "ADMIN_RATE_LIMIT_EXCEEDED",
});

/**
 * 14. Global Production API Limiter
 * Broad safety net against unauthenticated scrapers and volumetric traffic.
 * Policy: 300 requests per 15 min per IP, fallback-memory on Redis outage.
 */
const globalApiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
  prefix: "global",
  failPolicy: "fallback-memory",
  message: "Too many requests to Buybox API. Please slow down and try again shortly.",
  code: "GLOBAL_RATE_LIMIT_EXCEEDED",
  keyGenerator: (req) => req.ip || "unknown-ip",
});

module.exports = {
  createRateLimiter,
  rateLimitHandler,
  resolveClientKey,
  authRegistrationLimiter,
  authLoginLimiter,
  tokenRefreshLimiter,
  otpRequestLimiter,
  otpVerificationLimiter,
  otpResendLimiter,
  accountSecurityLimiter,
  checkoutLimiter,
  paymentLimiter,
  webhookLimiter,
  digitalDownloadLimiter,
  uploadLimiter,
  adminSensitiveOpLimiter,
  globalApiLimiter,
};
