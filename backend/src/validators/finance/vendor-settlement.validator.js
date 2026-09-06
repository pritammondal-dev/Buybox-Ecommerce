const { z } = require("zod");

const decimalString = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Invalid monetary amount");

const createVendorSettlementSchema = z
  .object({
    vendorId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid vendor ID"),

    periodStart: z.string().datetime(),

    periodEnd: z.string().datetime(),

    currency: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/, "Invalid currency"),

    grossSales: decimalString.optional(),

    discounts: decimalString.optional(),

    refunds: decimalString.optional(),

    platformCommission: decimalString.optional(),

    idempotencyKey: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional(),

    metadata: z
      .record(z.string(), z.string())
      .optional(),
  })
  .strict();

module.exports = {
  createVendorSettlementSchema,
};