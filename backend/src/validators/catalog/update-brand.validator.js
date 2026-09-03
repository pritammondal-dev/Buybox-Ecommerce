const { z } = require("zod");

const updateBrandSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Brand name is required")
      .max(100)
      .optional(),

    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, "Brand slug is required")
      .max(100)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug must contain only lowercase letters, numbers and hyphens"
      )
      .optional(),

    description: z
      .string()
      .trim()
      .max(2000)
      .optional(),

    website: z
      .string()
      .url("Invalid website URL")
      .nullable()
      .optional(),

    isActive: z
      .boolean()
      .optional(),

    sortOrder: z
      .number()
      .int()
      .min(0)
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
  updateBrandSchema,
};