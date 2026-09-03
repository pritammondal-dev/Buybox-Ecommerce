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
  })
  .strict();

module.exports = {
  stockAdjustmentSchema,
};