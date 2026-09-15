const { z } = require("zod");

const rejectProductSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(1, "Rejection reason is required")
      .max(500, "Rejection reason must not exceed 500 characters"),
  })
  .strict();

module.exports = {
  rejectProductSchema,
};
