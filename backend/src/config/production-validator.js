/**
 * Phase E12E — Production Deployment Configuration Validator
 *
 * Enforces production readiness guardrails:
 * - Prevents production deployments from silently running on localhost URLs
 * - Verifies secret entropy without exposing secret values
 * - Validates credential encryption key presence
 * - Validates storage provider persistence configuration
 * - Checks reverse proxy / client IP alignment
 */

const logger = require("./logger");

/**
 * Validates environment configuration for production safety.
 *
 * @param {Object} envConfig Configuration object (from src/config/env)
 * @param {string} [currentEnv] Override environment for testing
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateProductionConfiguration(envConfig, currentEnv = process.env.NODE_ENV) {
  const isProd = currentEnv === "production";
  const errors = [];
  const warnings = [];

  if (!isProd) {
    return {
      valid: true,
      errors: [],
      warnings: [],
      mode: "non-production",
    };
  }

  // 1. Host & URL Validations: Production URLs must not point to localhost
  if (!envConfig.BACKEND_URL || /localhost|127\.0\.0\.1/i.test(envConfig.BACKEND_URL)) {
    errors.push("BACKEND_URL must be configured with a public production domain and not localhost.");
  }

  if (!envConfig.FRONTEND_URL || /localhost|127\.0\.0\.1/i.test(envConfig.FRONTEND_URL)) {
    errors.push("FRONTEND_URL must be configured with a public production domain and not localhost.");
  }

  if (envConfig.EMAIL_VERIFICATION_BASE_URL && /localhost|127\.0\.0\.1/i.test(envConfig.EMAIL_VERIFICATION_BASE_URL)) {
    errors.push("EMAIL_VERIFICATION_BASE_URL points to localhost; verification emails will fail externally.");
  }

  if (envConfig.PASSWORD_RESET_BASE_URL && /localhost|127\.0\.0\.1/i.test(envConfig.PASSWORD_RESET_BASE_URL)) {
    errors.push("PASSWORD_RESET_BASE_URL points to localhost; password reset emails will fail externally.");
  }

  // 2. Secret Entropy & Length Guards (without logging secret values)
  if (!envConfig.JWT_ACCESS_SECRET || envConfig.JWT_ACCESS_SECRET.length < 32) {
    errors.push("JWT_ACCESS_SECRET must be at least 32 characters in production.");
  } else if (/secret|default|changeme|test|buybox/i.test(envConfig.JWT_ACCESS_SECRET)) {
    warnings.push("JWT_ACCESS_SECRET appears to contain a common or placeholder phrase.");
  }

  if (!envConfig.JWT_REFRESH_SECRET || envConfig.JWT_REFRESH_SECRET.length < 32) {
    errors.push("JWT_REFRESH_SECRET must be at least 32 characters in production.");
  }

  if (!envConfig.CREDENTIAL_ENCRYPTION_KEY || envConfig.CREDENTIAL_ENCRYPTION_KEY.length < 32) {
    errors.push("CREDENTIAL_ENCRYPTION_KEY is required and must be at least 32 characters in production.");
  }

  // 3. Storage Provider Persistence Guard
  if (envConfig.MEDIA_STORAGE_PROVIDER === "s3") {
    if (!envConfig.S3_BUCKET || !envConfig.S3_ACCESS_KEY_ID || !envConfig.S3_SECRET_ACCESS_KEY) {
      errors.push("S3 storage is selected for production but S3_BUCKET, S3_ACCESS_KEY_ID, or S3_SECRET_ACCESS_KEY is missing.");
    }
  } else if (envConfig.MEDIA_STORAGE_PROVIDER === "local") {
    warnings.push("MEDIA_STORAGE_PROVIDER is set to 'local'. Ephemeral container restarts will lose uploads unless mounted to persistent volume.");
  }

  // 4. Reverse Proxy / Client IP Alignment
  if (!envConfig.TRUST_PROXY || envConfig.TRUST_PROXY === "false") {
    warnings.push("TRUST_PROXY is 'false'. Behind cloud load balancers or Cloudflare, distributed rate limiting requires explicit trust proxy configuration.");
  }

  // 5. MongoDB Database URI
  if (!envConfig.MONGODB_URI) {
    errors.push("MONGODB_URI is required.");
  } else if (/localhost|127\.0\.0\.1/i.test(envConfig.MONGODB_URI)) {
    warnings.push("MONGODB_URI points to localhost. Ensure a managed MongoDB replica set (e.g. Atlas) is configured for production.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    mode: "production",
  };
}

module.exports = {
  validateProductionConfiguration,
};
