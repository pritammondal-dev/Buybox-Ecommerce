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
});

const env = envSchema.parse(process.env);

module.exports = env;