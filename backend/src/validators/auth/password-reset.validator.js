const { z } = require("zod");

const passwordResetSchema = z.object({
  token: z
    .string()
    .min(1, "Reset token is required"),

  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must not exceed 128 characters"),
});

module.exports = {
  passwordResetSchema,
};