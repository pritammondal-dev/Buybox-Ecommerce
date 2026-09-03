const { z } = require("zod");

const createProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Product name is required")
    .max(200),

  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Product slug is required")
    .max(200)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must contain only lowercase letters, numbers and hyphens"
    ),

  description: z
    .string()
    .trim()
    .max(10000)
    .optional()
    .default(""),

  shortDescription: z
    .string()
    .trim()
    .max(500)
    .optional()
    .default(""),

  sku: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "SKU is required")
    .max(100),

  categoryId: z
    .string()
    .regex(/^[a-f\d]{24}$/i, "Invalid category ID"),

  brandId: z
    .string()
    .regex(/^[a-f\d]{24}$/i, "Invalid brand ID")
    .nullable()
    .optional()
    .default(null),

  price: z
    .string()
    .regex(/^\d+(?:\.\d{1,2})?$/, "Invalid price"),

  compareAtPrice: z
    .string()
    .regex(/^\d+(?:\.\d{1,2})?$/, "Invalid compare-at price")
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

  status: z
    .enum(["draft", "active", "inactive", "archived"])
    .optional()
    .default("draft"),

  isFeatured: z
    .boolean()
    .optional()
    .default(false),

  tags: z
    .array(z.string().trim().min(1).max(50))
    .max(50)
    .optional()
    .default([]),
});

module.exports = {
  createProductSchema,
};