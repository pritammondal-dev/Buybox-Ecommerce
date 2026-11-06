const { z } = require("zod");
const { validateImageReference } = require("../../utils/image-validator.util");

const safeImageString = z
  .string()
  .trim()
  .max(500)
  .nullable()
  .optional()
  .refine(
    (val) => {
      if (!val) return true;
      const res = validateImageReference(val);
      return res.isValid;
    },
    {
      message:
        "Image URL must be a valid https:// URL or approved /uploads/ path, and cannot be an SVG file.",
    }
  );

const updateStoreBrandingSchema = z
  .object({
    displayName: z.string().trim().min(2).max(150).nullable().optional(),
    logo: safeImageString,
    banner: safeImageString,
    description: z.string().trim().max(2000).nullable().optional(),
    publicContactEmail: z.string().trim().email().max(254).nullable().optional().or(z.literal("")),
    publicContactPhone: z.string().trim().max(20).nullable().optional(),
    policies: z
      .object({
        shippingPolicy: z.string().trim().max(5000).nullable().optional(),
        returnPolicy: z.string().trim().max(5000).nullable().optional(),
        refundPolicy: z.string().trim().max(5000).nullable().optional(),
      })
      .strict()
      .optional(),
    operatingHours: z.string().trim().max(500).nullable().optional(),
    socialLinks: z
      .object({
        website: z.string().trim().max(500).nullable().optional(),
        instagram: z.string().trim().max(500).nullable().optional(),
        facebook: z.string().trim().max(500).nullable().optional(),
        twitter: z.string().trim().max(500).nullable().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

module.exports = {
  updateStoreBrandingSchema,
};

