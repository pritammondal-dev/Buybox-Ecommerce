const { z } = require("zod");

const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId format");

const createWithdrawalRequestSchema = z
  .object({
    amount: z
      .union([z.number(), z.string()])
      .transform((val) => Number(val))
      .refine((val) => Number.isFinite(val) && val > 0, {
        message: "Amount must be a positive number",
      }),
    bankAccountId: objectId,
    notes: z
      .string()
      .trim()
      .max(500, "Notes cannot exceed 500 characters")
      .optional()
      .nullable(),
  })
  .strict();

const rejectWithdrawalSchema = z
  .object({
    rejectionReason: z
      .string({
        required_error: "Rejection reason is required",
      })
      .trim()
      .min(10, "Rejection reason must be at least 10 characters long")
      .max(1000, "Rejection reason cannot exceed 1000 characters"),
  })
  .strict();

const markWithdrawalPaidSchema = z
  .object({
    providerReference: z
      .string()
      .trim()
      .min(1, "Provider reference cannot be empty")
      .max(200, "Provider reference cannot exceed 200 characters")
      .optional()
      .nullable(),
  })
  .strict();

const markWithdrawalFailedSchema = z
  .object({
    failureReason: z
      .string({
        required_error: "Failure reason is required",
      })
      .trim()
      .min(3, "Failure reason must be at least 3 characters long")
      .max(1000, "Failure reason cannot exceed 1000 characters"),
  })
  .strict();

const withdrawalQuerySchema = z
  .object({
    page: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .optional(),
    limit: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .optional(),
    status: z.string().trim().optional(),
    search: z.string().trim().optional(),
    vendorId: objectId.optional(),
    startDate: z.string().trim().optional(),
    endDate: z.string().trim().optional(),
  })
  .passthrough();

module.exports = {
  createWithdrawalRequestSchema,
  rejectWithdrawalSchema,
  markWithdrawalPaidSchema,
  markWithdrawalFailedSchema,
  withdrawalQuerySchema,
};

