const { z } = require("zod");

const createInventorySchema = z
  .object({
    productVariantId: z
      .string()
      .regex(
        /^[a-f\d]{24}$/i,
        "Invalid product variant ID"
      ),

    warehouseId: z
      .string()
      .regex(
        /^[a-f\d]{24}$/i,
        "Invalid warehouse ID"
      ),

    onHand: z
      .number()
      .int()
      .min(0)
      .default(0),

    lowStockThreshold: z
      .number()
      .int()
      .min(0)
      .default(5),
  })
  .strict();

module.exports = {
  createInventorySchema,
};