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
});

const env = envSchema.parse(process.env);

module.exports = env;