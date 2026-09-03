const { z } = require("zod");

const createProductVariantSchema = z
  .object({
    sku: z
      .string()
      .trim()
      .toUpperCase()
      .min(1, "Variant SKU is required")
      .max(100),

    name: z
      .string()
      .trim()
      .max(200)
      .optional()
      .default(""),

    attributes: z
      .record(
        z.string().trim().min(1).max(100),
        z.string().trim().min(1).max(100)
      )
      .optional()
      .default({}),

    price: z
      .string()
      .regex(/^\d+(?:\.\d{1,2})?$/, "Invalid price"),

    compareAtPrice: z
      .string()
      .regex(/^\d+(?:\.\d{1,2})?$/, "Invalid compare-at price")
      .nullable()
      .optional()
      .default(null),

    costPrice: z
      .string()
      .regex(/^\d+(?:\.\d{1,2})?$/, "Invalid cost price")
      .nullable()
      .optional()
      .default(null),

    currency: z
      .string()
      .trim()
      .toUpperCase()
      .length(3)
      .optional()
      .default("INR"),

    stockQuantity: z
      .number()
      .int()
      .min(0)
      .optional()
      .default(0),

    stockStatus: z
      .enum([
        "in_stock",
        "out_of_stock",
        "preorder",
      ])
      .optional()
      .default("out_of_stock"),

    isActive: z
      .boolean()
      .optional()
      .default(true),
  })
  .strict();

module.exports = {
  createProductVariantSchema,
};