const { z } = require("zod");

const addCartItemSchema = z
  .object({
    productVariantId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid product variant ID")
      .optional()
      .nullable(),

    productId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid product ID")
      .optional()
      .nullable(),

    quantity: z
      .number()
      .int("Quantity must be an integer")
      .min(1, "Quantity must be at least 1")
      .max(99, "Quantity cannot exceed 99"),
  })
  .refine((data) => Boolean(data.productVariantId || data.productId), {
    message: "Either productVariantId or productId must be provided",
    path: ["productVariantId"],
  })
  .strict();

module.exports = {
  addCartItemSchema,
};