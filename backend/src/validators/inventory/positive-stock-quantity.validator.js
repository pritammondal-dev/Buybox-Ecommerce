const { z } = require("zod");

const positiveStockQuantitySchema = z
  .object({
    quantity: z
      .number()
      .int()
      .positive("Quantity must be greater than zero"),
  })
  .strict();

module.exports = {
  positiveStockQuantitySchema,
};