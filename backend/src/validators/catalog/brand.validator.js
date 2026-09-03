const { z } = require("zod");

const createBrandSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Brand name is required")
    .max(100),

  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Brand slug is required")
    .max(100)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must contain only lowercase letters, numbers and hyphens"
    ),

  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .default(""),

  website: z
    .string()
    .url("Invalid website URL")
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
  createBrandSchema,
};