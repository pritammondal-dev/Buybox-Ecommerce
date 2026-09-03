const { z } = require("zod");

const updateProductSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional(),

    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(1)
      .max(200)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug must contain only lowercase letters, numbers and hyphens"
      )
      .optional(),

    description: z
      .string()
      .trim()
      .max(10000)
      .optional(),

    shortDescription: z
      .string()
      .trim()
      .max(500)
      .optional(),

    sku: z
      .string()
      .trim()
      .toUpperCase()
      .min(1)
      .max(100)
      .optional(),

    categoryId: z
      .string()
      .regex(/^[a-f\d]{24}$/i, "Invalid category ID")
      .optional(),

    brandId: z
      .string()
      .regex(/^[a-f\d]{24}$/i, "Invalid brand ID")
      .nullable()
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

    currency: z
      .string()
      .trim()
      .toUpperCase()
      .length(3)
      .optional(),

    status: z
      .enum(["draft", "active", "inactive", "archived"])
      .optional(),

    isFeatured: z
      .boolean()
      .optional(),

    tags: z
      .array(z.string().trim().min(1).max(50))
      .max(50)
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
  updateProductSchema,
};