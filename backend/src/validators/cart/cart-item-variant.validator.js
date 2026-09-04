const { z } = require("zod");

const cartItemVariantSchema = z
  .object({
    productVariantId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid product variant ID"),
  })
  .strict();

module.exports = {
  cartItemVariantSchema,
};