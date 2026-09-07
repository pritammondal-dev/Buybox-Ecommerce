const { z } = require("zod");

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
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

ELASTIC_EMAIL_API_KEY: z.string().min(1),
ELASTIC_EMAIL_FROM_EMAIL: z
  .string()
  .email()
  .or(z.literal("")),
ELASTIC_EMAIL_FROM_NAME: z.string().min(1).default("Buybox"),

EMAIL_VERIFICATION_BASE_URL: z
  .string()
  .url()
  .default("http://localhost:5000/api/v1/auth/verify-email"),

  PASSWORD_RESET_BASE_URL: z
  .string()
  .url()
  .default("http://localhost:5000/api/v1/auth/reset-password"),
});

const env = envSchema.parse(process.env);

module.exports = env;