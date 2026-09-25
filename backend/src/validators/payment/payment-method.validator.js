const { z } = require("zod");

const createPaymentMethodSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(50)
    .regex(/^[a-z0-9_-]+$/, "Code must contain only lowercase letters, numbers, hyphens, or underscores"),
  gateway: z.string().trim().min(1, "Gateway is required"),
  type: z.enum([
    "upi",
    "card",
    "netbanking",
    "wallet",
    "international_card",
    "paypal",
    "cod",
    "emi",
    "other",
  ]).default("other"),
  description: z.string().trim().max(500).optional().default(""),
  icon: z.string().trim().optional().default("CreditCard"),
  enabled: z.boolean().optional().default(false),
  displayOrder: z.coerce.number().int().optional().default(0),
  supportedCountries: z.array(z.string().trim().toUpperCase()).optional().default(["IN"]),
  supportedCurrencies: z.array(z.string().trim().toUpperCase()).optional().default(["INR"]),
  minimumOrderAmount: z.coerce.number().min(0).optional().default(0),
  maximumOrderAmount: z.coerce.number().min(0).nullable().optional(),
  customerEligibilityRules: z.record(z.any()).optional().default({}),
  configuration: z.record(z.any()).optional().default({}),
});

const updatePaymentMethodSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100).optional(),
  code: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9_-]+$/, "Code must contain only lowercase letters, numbers, hyphens, or underscores")
    .optional(),
  gateway: z.string().trim().min(1).optional(),
  type: z
    .enum([
      "upi",
      "card",
      "netbanking",
      "wallet",
      "international_card",
      "paypal",
      "cod",
      "emi",
      "other",
    ])
    .optional(),
  description: z.string().trim().max(500).optional(),
  icon: z.string().trim().optional(),
  enabled: z.boolean().optional(),
  displayOrder: z.coerce.number().int().optional(),
  supportedCountries: z.array(z.string().trim().toUpperCase()).optional(),
  supportedCurrencies: z.array(z.string().trim().toUpperCase()).optional(),
  minimumOrderAmount: z.coerce.number().min(0).optional(),
  maximumOrderAmount: z.coerce.number().min(0).nullable().optional(),
  customerEligibilityRules: z.record(z.any()).optional(),
  configuration: z.record(z.any()).optional(),
});

const reorderPaymentMethodsSchema = z.object({
  orderedIds: z
    .array(z.string().trim().min(1))
    .min(1, "At least one payment method ID is required"),
});

const availablePaymentMethodsQuerySchema = z.object({
  country: z.string().trim().optional(),
  currency: z.string().trim().optional(),
  orderAmount: z.coerce.number().optional(),
  orderId: z.string().trim().optional(),
});

module.exports = {
  createPaymentMethodSchema,
  updatePaymentMethodSchema,
  reorderPaymentMethodsSchema,
  availablePaymentMethodsQuerySchema,
};
