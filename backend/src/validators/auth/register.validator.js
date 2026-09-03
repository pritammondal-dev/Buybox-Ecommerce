const { z } = require("zod");

const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email address"),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must not exceed 128 characters"),

  firstName: z
    .string()
    .trim()
    .min(1, "First name is required")
    .max(50, "First name must not exceed 50 characters"),

  lastName: z
    .string()
    .trim()
    .min(1, "Last name is required")
    .max(50, "Last name must not exceed 50 characters"),
});

module.exports = {
  registerSchema,
};