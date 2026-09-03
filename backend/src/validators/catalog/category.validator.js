const { z } = require("zod");

const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Category name is required")
    .max(100),

  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Category slug is required")
    .max(100)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must contain only lowercase letters, numbers and hyphens"
    ),

  description: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .default(""),

  parentId: z
    .string()
    .regex(/^[a-f\d]{24}$/i, "Invalid parent category ID")
    .nullable()
    .optional()
    .default(null),

  isActive: z
    .boolean()
    .optional()
    .default(true),

  sortOrder: z
    .number()
    .int()
    .min(0)
    .optional()
    .default(0),
});

module.exports = {
  createCategorySchema,
};