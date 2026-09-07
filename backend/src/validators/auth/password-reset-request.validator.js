const { z } = require("zod");

const passwordResetRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .transform((value) => value.toLowerCase()),
});

module.exports = {
  passwordResetRequestSchema,
};