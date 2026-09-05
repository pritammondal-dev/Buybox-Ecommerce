const { z } = require("zod");

const createRefundSchema = z
  .object({
    amount: z
      .string()
      .regex(
        /^\d+(\.\d{1,2})?$/,
        "Amount must be a positive decimal with at most two decimal places"
      )
      .refine(
        (value) => Number(value) > 0,
        "Refund amount must be greater than zero"
      ),

    reason: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .optional(),
  })
  .strict();

module.exports = {
  createRefundSchema,
};