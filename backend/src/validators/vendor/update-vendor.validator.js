const { z } = require("zod");

const updateVendorSchema = z
  .object({
    businessName: z
      .string()
      .trim()
      .min(2)
      .max(150)
      .optional(),

    businessSlug: z
      .string()
      .trim()
      .min(2)
      .max(150)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Business slug must contain only lowercase letters, numbers, and hyphens"
      )
      .optional(),

    phone: z
      .string()
      .trim()
      .min(7)
      .max(20)
      .nullable()
      .optional(),

    supportEmail: z
      .string()
      .trim()
      .email()
      .max(254)
      .nullable()
      .optional(),

    businessAddress: z
      .object({
        addressLine1: z.string().trim().max(200).nullable().optional(),
        addressLine2: z.string().trim().max(200).nullable().optional(),
        city: z.string().trim().max(100).nullable().optional(),
        state: z.string().trim().max(100).nullable().optional(),
        postalCode: z.string().trim().max(20).nullable().optional(),
        country: z
          .string()
          .trim()
          .toUpperCase()
          .length(2)
          .optional(),
      })
      .strict()
      .optional(),

    taxInformation: z
      .object({
        taxId: z.string().trim().max(100).nullable().optional(),
        taxType: z.string().trim().max(50).nullable().optional(),
      })
      .strict()
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
  updateVendorSchema,
};