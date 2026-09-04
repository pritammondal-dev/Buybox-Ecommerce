const { z } = require("zod");

const updateCartItemSchema = z
  .object({
    productVariantId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid product variant ID"),

    quantity: z
      .number()
      .int("Quantity must be an integer")
      .min(1, "Quantity must be at least 1")
      .max(99, "Quantity cannot exceed 99"),
  })
  .strict();

module.exports = {
  updateCartItemSchema,
};