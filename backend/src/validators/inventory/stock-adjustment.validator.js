const { z } = require("zod");

const stockAdjustmentSchema = z
  .object({
    quantity: z
      .number()
      .int()
      .refine(
        (value) => value !== 0,
        "Quantity must not be zero"
      ),
    notes: z.string().trim().max(1000).optional(),
    reason: z.string().trim().max(1000).optional(),
  })
  .strict();

module.exports = {
  stockAdjustmentSchema,
};