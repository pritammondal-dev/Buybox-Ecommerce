const { z } = require("zod");

const isValidDateString = (val) => {
  if (typeof val !== "string") return false;
  const trimmed = val.trim();

  // Match YYYY-MM-DD date-only or ISO datetime prefix
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(trimmed);
  if (!dateMatch) return false;

  const year = parseInt(dateMatch[1], 10);
  const month = parseInt(dateMatch[2], 10);
  const day = parseInt(dateMatch[3], 10);

  // Validate month and day ranges
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  // Validate calendar day correctness (e.g. rejects 2026-02-31, 2026-04-31)
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day
  ) {
    return false;
  }

  // If full ISO datetime, also ensure the full timestamp is valid
  const fullDate = new Date(trimmed);
  return !isNaN(fullDate.getTime());
};

const baseDateFields = {
  period: z
    .enum(["today", "last_7_days", "last_30_days", "custom"])
    .default("today"),

  startDate: z
    .string()
    .trim()
    .refine((val) => !val || isValidDateString(val), {
      message: "startDate must be a valid ISO date",
    })
    .optional(),

  endDate: z
    .string()
    .trim()
    .refine((val) => !val || isValidDateString(val), {
      message: "endDate must be a valid ISO date",
    })
    .optional(),
};

const refineCustomDateRange = (data, ctx) => {
  if (data.period === "custom") {
    if (!data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "startDate is required when period is custom",
        path: ["startDate"],
      });
    }

    if (!data.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endDate is required when period is custom",
        path: ["endDate"],
      });
    }

    if (data.startDate && data.endDate) {
      const start = new Date(
        /^\d{4}-\d{2}-\d{2}$/.test(data.startDate)
          ? `${data.startDate}T00:00:00.000Z`
          : data.startDate
      );
      const end = new Date(
        /^\d{4}-\d{2}-\d{2}$/.test(data.endDate)
          ? `${data.endDate}T23:59:59.999Z`
          : data.endDate
      );

      if (start.getTime() > end.getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "startDate cannot be after endDate",
          path: ["startDate"],
        });
      }
    }
  }
};

const vendorIdField = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, "Invalid vendor ID format")
  .optional();

const limitField = z.coerce
  .number({
    invalid_type_error: "limit must be an integer",
  })
  .int("limit must be an integer")
  .min(1, "limit must be at least 1")
  .max(100, "limit cannot exceed 100")
  .default(10);

const sortByField = z
  .enum(["units", "revenue"])
  .default("units");

/*
 * ==========================================
 * ENDPOINT-SPECIFIC SCHEMAS
 * ==========================================
 */

// 1. ADMIN OVERVIEW: period, startDate, endDate, vendorId
const adminOverviewQuerySchema = z
  .object({
    ...baseDateFields,
    vendorId: vendorIdField,
  })
  .strict()
  .superRefine(refineCustomDateRange);

// 2. ADMIN TOP-PRODUCTS: period, startDate, endDate, vendorId, limit, sortBy
const adminTopProductsQuerySchema = z
  .object({
    ...baseDateFields,
    vendorId: vendorIdField,
    limit: limitField,
    sortBy: sortByField,
  })
  .strict()
  .superRefine(refineCustomDateRange);

// 3. ADMIN SALES-TREND: period, startDate, endDate, vendorId
const adminSalesTrendQuerySchema = z
  .object({
    ...baseDateFields,
    vendorId: vendorIdField,
  })
  .strict()
  .superRefine(refineCustomDateRange);

// 4. VENDOR OVERVIEW: period, startDate, endDate
const vendorOverviewQuerySchema = z
  .object({
    ...baseDateFields,
  })
  .strict()
  .superRefine(refineCustomDateRange);

// 5. VENDOR TOP-PRODUCTS: period, startDate, endDate, limit, sortBy
const vendorTopProductsQuerySchema = z
  .object({
    ...baseDateFields,
    limit: limitField,
    sortBy: sortByField,
  })
  .strict()
  .superRefine(refineCustomDateRange);

// 6. VENDOR SALES-TREND: period, startDate, endDate
const vendorSalesTrendQuerySchema = z
  .object({
    ...baseDateFields,
  })
  .strict()
  .superRefine(refineCustomDateRange);

// Backward-compatibility alias
const analyticsQuerySchema = adminOverviewQuerySchema;

module.exports = {
  adminOverviewQuerySchema,
  adminTopProductsQuerySchema,
  adminSalesTrendQuerySchema,
  vendorOverviewQuerySchema,
  vendorTopProductsQuerySchema,
  vendorSalesTrendQuerySchema,
  analyticsQuerySchema,
};
