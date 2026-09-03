const { z } = require("zod");

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email address"),

  password: z
    .string()
    .min(1, "Password is required")
    .max(128, "Password must not exceed 128 characters"),
});

module.exports = {
  loginSchema,
};