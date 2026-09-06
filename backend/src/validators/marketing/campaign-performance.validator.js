const { z } = require("zod");

const objectId = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

const nonNegativeInteger = z
  .number()
  .int()
  .min(0);

const decimalAmount = z
  .string()
  .regex(/^\d+(?:\.\d{1,2})?$/, "Invalid monetary amount");

const recordDailyPerformanceSchema = z.object({
  couponId: objectId.nullable().optional(),

  date: z.coerce.date().optional(),

  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Invalid currency"),

  impressions: nonNegativeInteger.optional(),

  redemptions: nonNegativeInteger.optional(),

  orders: nonNegativeInteger.optional(),

  unitsSold: nonNegativeInteger.optional(),

  grossRevenue: decimalAmount.optional(),

  discountAmount: decimalAmount.optional(),

  netRevenue: decimalAmount.optional(),

  metadata: z
    .record(z.string(), z.string())
    .optional(),
});

const incrementDailyPerformanceSchema = z.object({
  impressions: nonNegativeInteger.optional(),

  redemptions: nonNegativeInteger.optional(),

  orders: nonNegativeInteger.optional(),

  unitsSold: nonNegativeInteger.optional(),
});

const campaignPerformanceParamsSchema = z.object({
  campaignId: objectId,
});

const performanceIdParamsSchema = z.object({
  performanceId: objectId,
});

module.exports = {
  recordDailyPerformanceSchema,
  incrementDailyPerformanceSchema,
  campaignPerformanceParamsSchema,
  performanceIdParamsSchema,
};