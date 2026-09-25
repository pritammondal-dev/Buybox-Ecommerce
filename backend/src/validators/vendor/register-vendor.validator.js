const { z } = require("zod");

const registerVendorSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email("Invalid email address")
      .max(254),

    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(100),

    firstName: z
      .string()
      .trim()
      .min(1, "First name is required")
      .max(50),

    lastName: z
      .string()
      .trim()
      .min(1, "Last name is required")
      .max(50),

    businessName: z
      .string()
      .trim()
      .min(2, "Business name must be at least 2 characters")
      .max(150),

    businessSlug: z
      .string()
      .trim()
      .min(2)
      .max(150)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Business slug must contain only lowercase letters, numbers, and hyphens"
      )
      .optional()
      .nullable(),

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
      .email("Invalid support email address")
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
          .max(100)
          .optional()
          .default("IN"),
      })
      .strict()
      .optional(),

    taxInformation: z
      .object({
        taxId: z.string().trim().max(100).nullable().optional(),
        taxType: z.string().trim().max(50).nullable().optional(),
        gstin: z.string().trim().max(100).nullable().optional(),
        pan: z.string().trim().max(100).nullable().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

module.exports = {
  registerVendorSchema,
};
