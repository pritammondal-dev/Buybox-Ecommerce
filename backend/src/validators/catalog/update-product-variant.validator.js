const { z } = require("zod");

const updateProductVariantSchema = z
  .object({
    sku: z
      .string()
      .trim()
      .toUpperCase()
      .min(1)
      .max(100)
      .optional(),

    name: z
      .string()
      .trim()
      .max(200)
      .optional(),

    attributes: z
      .record(
        z.string().trim().min(1).max(100),
        z.string().trim().min(1).max(100)
      )
      .optional(),

    price: z
      .string()
      .regex(/^\d+(?:\.\d{1,2})?$/, "Invalid price")
      .optional(),

    compareAtPrice: z
      .string()
      .regex(/^\d+(?:\.\d{1,2})?$/, "Invalid compare-at price")
      .nullable()
      .optional(),

    costPrice: z
      .string()
      .regex(/^\d+(?:\.\d{1,2})?$/, "Invalid cost price")
      .nullable()
      .optional(),

    currency: z
      .string()
      .trim()
      .toUpperCase()
      .length(3)
      .optional(),

    stockQuantity: z
      .number()
      .int()
      .min(0)
      .optional(),

    stockStatus: z
      .enum([
        "in_stock",
        "out_of_stock",
        "preorder",
      ])
      .optional(),

    isActive: z
      .boolean()
      .optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: "At least one field is required",
    }
  );

module.exports = {
  updateProductVariantSchema,
};