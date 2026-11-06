const { z } = require("zod");
const {
  COMMISSION_POLICY_SCOPES,
} = require("../../constants/finance.constants");

const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId");

const createCommissionPolicySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Policy name is required")
      .max(120, "Policy name must not exceed 120 characters"),

    description: z
      .string()
      .trim()
      .max(500, "Description must not exceed 500 characters")
      .optional()
      .default(""),

    scope: z.enum([
      COMMISSION_POLICY_SCOPES.GLOBAL,
      COMMISSION_POLICY_SCOPES.CATEGORY,
      COMMISSION_POLICY_SCOPES.VENDOR,
      COMMISSION_POLICY_SCOPES.PRODUCT,
    ]),

    productId: objectId.nullable().optional(),
    vendorId: objectId.nullable().optional(),
    categoryId: objectId.nullable().optional(),

    rate: z.coerce
      .number()
      .min(0, "Commission rate must be >= 0")
      .max(1.0, "Commission rate must be <= 1.0 (use decimal e.g. 0.10 for 10%)"),

    percentage: z.coerce
      .number()
      .min(0, "Percentage must be >= 0")
      .max(100, "Percentage must be <= 100")
      .optional(),

    effectiveFrom: z.coerce.date().optional(),
    effectiveUntil: z.coerce.date().nullable().optional(),

    priority: z.coerce.number().int().min(1).max(100).optional(),

    notes: z
      .string()
      .trim()
      .max(500, "Notes must not exceed 500 characters")
      .optional()
      .nullable(),
  })
  .strict();

const updateCommissionPolicySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Policy name is required")
      .max(120, "Policy name must not exceed 120 characters")
      .optional(),

    description: z
      .string()
      .trim()
      .max(500, "Description must not exceed 500 characters")
      .optional(),

    rate: z.coerce
      .number()
      .min(0, "Commission rate must be >= 0")
      .max(1.0, "Commission rate must be <= 1.0")
      .optional(),

    percentage: z.coerce
      .number()
      .min(0, "Percentage must be >= 0")
      .max(100, "Percentage must be <= 100")
      .optional(),

    effectiveFrom: z.coerce.date().optional(),
    effectiveUntil: z.coerce.date().nullable().optional(),

    priority: z.coerce.number().int().min(1).max(100).optional(),

    notes: z
      .string()
      .trim()
      .max(500, "Notes must not exceed 500 characters")
      .optional()
      .nullable(),
  })
  .strict();

const toggleCommissionPolicyStatusSchema = z
  .object({
    isActive: z.boolean(),
    notes: z
      .string()
      .trim()
      .max(500, "Notes must not exceed 500 characters")
      .optional()
      .nullable(),
  })
  .strict();

const resolveCommissionPolicySchema = z
  .object({
    productId: objectId.nullable().optional(),
    vendorId: objectId.nullable().optional(),
    categoryId: objectId.nullable().optional(),
    targetDate: z.coerce.date().optional(),
  })
  .strict();

const previewCommissionCalculationSchema = z
  .object({
    productId: objectId.nullable().optional(),
    vendorId: objectId.nullable().optional(),
    categoryId: objectId.nullable().optional(),
    amount: z.coerce.number().positive("Amount must be a positive number"),
    currency: z.string().min(3).max(3).optional().default("INR"),
    targetDate: z.coerce.date().optional(),
  })
  .strict();

module.exports = {
  createCommissionPolicySchema,
  updateCommissionPolicySchema,
  toggleCommissionPolicyStatusSchema,
  resolveCommissionPolicySchema,
  previewCommissionCalculationSchema,
};

