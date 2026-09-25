const { z } = require("zod");

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "staging", "production"])
    .default("development"),

  PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(5000),

  MONGODB_URI: z
    .string()
    .min(1, "MONGODB_URI is required"),

  JWT_ACCESS_SECRET: z
  .string()
  .min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),

JWT_ACCESS_EXPIRES_IN: z
  .string()
  .default("15m"),

JWT_REFRESH_SECRET: z
  .string()
  .min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),

JWT_REFRESH_EXPIRES_IN: z
  .string()
  .default("7d"),

LOG_LEVEL: z.string().default("info"),

  RAZORPAY_KEY_ID: z.string().min(1),
  RAZORPAY_KEY_SECRET: z.string().min(1),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1),

  PAYPAL_CLIENT_ID: z.string().default(""),
  PAYPAL_CLIENT_SECRET: z.string().default(""),
  PAYPAL_MODE: z.enum(["sandbox", "live"]).default("sandbox"),

  GOOGLE_CLIENT_ID: z.string().default(""),

  EMAIL_PROVIDER: z.string().default("elastic_email"),
  ELASTIC_EMAIL_API_KEY: z.string().default(""),
  ELASTIC_EMAIL_FROM_EMAIL: z
    .string()
    .email()
    .or(z.literal(""))
    .default(""),
  ELASTIC_EMAIL_FROM_NAME: z.string().default("Buybox"),
  ELASTIC_EMAIL_REPLY_TO: z.string().default(""),

  CREDENTIAL_ENCRYPTION_KEY: z.string().default(""),

  DELHIVERY_API_KEY: z.string().default(""),
  DELHIVERY_CLIENT_ID: z.string().default(""),
  DELHIVERY_CLIENT_SECRET: z.string().default(""),

  SHIPROCKET_EMAIL: z.string().default(""),
  SHIPROCKET_PASSWORD: z.string().default(""),
  SHIPROCKET_API_KEY: z.string().default(""),

  EMAIL_VERIFICATION_BASE_URL: z
    .string()
    .url()
    .default("http://localhost:5000/api/v1/auth/verify-email"),

  PASSWORD_RESET_BASE_URL: z
    .string()
    .url()
    .default("http://localhost:5000/api/v1/auth/reset-password"),

  CART_ABANDONMENT_INACTIVITY_MINUTES: z.coerce
    .number()
    .int()
    .positive()
    .default(60),

  CART_ABANDONMENT_BATCH_SIZE: z.coerce
    .number()
    .int()
    .positive()
    .default(50),

  CART_ABANDONMENT_SCAN_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(300000),

  PAYMENT_RECONCILIATION_SCAN_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60000),

  PAYMENT_RECONCILIATION_BATCH_SIZE: z.coerce
    .number()
    .int()
    .positive()
    .default(50),

  ORDER_EXPIRATION_TIMEOUT_MINUTES: z.coerce
    .number()
    .int()
    .positive()
    .default(30),

  ORDER_EXPIRATION_SCAN_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60000),

  ORDER_EXPIRATION_BATCH_SIZE: z.coerce
    .number()
    .int()
    .positive()
    .default(50),

  CORS_ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:3000,http://127.0.0.1:3000"),

  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_SECURE: z
    .string()
    .transform((val) => val === "true" || val === "1")
    .or(z.boolean())
    .default(false),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  SMTP_FROM_EMAIL: z.string().email().or(z.literal("")).default(""),
  SMTP_FROM_NAME: z.string().default("Buybox"),
  SMTP_REPLY_TO: z.string().default(""),
});

const env = envSchema.parse(process.env);

module.exports = env;