const { z } = require("zod");
const {
  ALLOWED_TAX_CATEGORIES,
  DEFAULT_TAX_CATEGORY,
  ALLOWED_TAX_PRICING_MODES,
} = require("../../constants/tax.constants");

const createTaxRuleSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    country: z
      .string()
      .trim()
      .length(2)
      .transform((val) => val.toUpperCase()),
    state: z
      .string()
      .trim()
      .max(100)
      .transform((val) => val.toUpperCase())
      .optional()
      .nullable(),
    taxCategory: z
      .enum(ALLOWED_TAX_CATEGORIES)
      .default(DEFAULT_TAX_CATEGORY)
      .optional(),
    rate: z.union([
      z.number().min(0).max(100),
      z.string().regex(/^\d+(\.\d{1,2})?$/).transform(Number),
    ]),
    isShippingTaxable: z.boolean().default(false).optional(),
    priority: z.number().int().min(0).default(0).optional(),
    isActive: z.boolean().default(true).optional(),
    startsAt: z.coerce.date().optional().nullable(),
    expiresAt: z.coerce.date().optional().nullable(),
    description: z.string().trim().max(500).optional().nullable(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.startsAt && data.expiresAt) {
        return new Date(data.expiresAt) > new Date(data.startsAt);
      }
      return true;
    },
    {
      message: "Expiry date must be after start date",
      path: ["expiresAt"],
    }
  );

const updateTaxRuleSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    country: z
      .string()
      .trim()
      .length(2)
      .transform((val) => val.toUpperCase())
      .optional(),
    state: z
      .string()
      .trim()
      .max(100)
      .transform((val) => val.toUpperCase())
      .optional()
      .nullable(),
    taxCategory: z.enum(ALLOWED_TAX_CATEGORIES).optional(),
    rate: z
      .union([
        z.number().min(0).max(100),
        z.string().regex(/^\d+(\.\d{1,2})?$/).transform(Number),
      ])
      .optional(),
    isShippingTaxable: z.boolean().optional(),
    priority: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
    startsAt: z.coerce.date().optional().nullable(),
    expiresAt: z.coerce.date().optional().nullable(),
    description: z.string().trim().max(500).optional().nullable(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.startsAt && data.expiresAt) {
        return new Date(data.expiresAt) > new Date(data.startsAt);
      }
      return true;
    },
    {
      message: "Expiry date must be after start date",
      path: ["expiresAt"],
    }
  );

const taxPreviewSchema = z
  .object({
    shippingAddressId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid shipping address ID")
      .optional(),
    shippingAddress: z
      .object({
        country: z.string().trim().length(2),
        state: z.string().trim().max(100).optional().nullable(),
      })
      .optional(),
    items: z
      .array(
        z
          .object({
            productVariantId: z
              .string()
              .regex(/^[0-9a-fA-F]{24}$/, "Invalid product variant ID"),
            quantity: z.number().int().min(1).max(99),
          })
          .strict()
      )
      .min(1, "At least one item is required"),
    couponCode: z
      .string()
      .trim()
      .min(3)
      .max(50)
      .transform((val) => val.toUpperCase())
      .optional()
      .nullable(),
    pricingMode: z.enum(ALLOWED_TAX_PRICING_MODES).optional(),
  })
  .strict();

module.exports = {
  createTaxRuleSchema,
  updateTaxRuleSchema,
  taxPreviewSchema,
};
