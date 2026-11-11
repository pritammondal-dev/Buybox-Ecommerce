const { z } = require("zod");

const submitRefundApplicationSchema = z.object({
  merchantRemarks: z
    .string()
    .trim()
    .max(2000, "Merchant remarks cannot exceed 2000 characters")
    .optional()
    .nullable(),
  deductionExplanation: z
    .string()
    .trim()
    .max(1000, "Deduction explanation cannot exceed 1000 characters")
    .optional()
    .nullable(),
  supportingDocuments: z
    .array(z.string().trim().url("Supporting document must be a valid URL"))
    .max(10, "Cannot provide more than 10 supporting documents")
    .optional()
    .nullable(),
  requestedAmount: z.any().optional(), // Silently accepted if passed; overridden by authoritative backend formula
});

const resubmitRefundApplicationSchema = z.object({
  merchantRemarks: z
    .string()
    .trim()
    .min(1, "Updated merchant remarks are required")
    .max(2000, "Merchant remarks cannot exceed 2000 characters"),
  deductionExplanation: z
    .string()
    .trim()
    .max(1000, "Deduction explanation cannot exceed 1000 characters")
    .optional()
    .nullable(),
  supportingDocuments: z
    .array(z.string().trim().url("Supporting document must be a valid URL"))
    .max(10, "Cannot provide more than 10 supporting documents")
    .optional()
    .nullable(),
});

const rejectRefundApplicationSchema = z.object({
  rejectionReason: z
    .string()
    .trim()
    .min(5, "Rejection reason must be at least 5 characters")
    .max(1000, "Rejection reason cannot exceed 1000 characters"),
});

const requestRevisionSchema = z.object({
  revisionInstructions: z
    .string()
    .trim()
    .min(5, "Revision instructions must be at least 5 characters")
    .max(1000, "Revision instructions cannot exceed 1000 characters"),
});

const disburseRefundApplicationSchema = z
  .object({
    remarks: z
      .string()
      .trim()
      .max(1000, "Disbursement remarks cannot exceed 1000 characters")
      .optional()
      .nullable(),
    notes: z
      .string()
      .trim()
      .max(1000, "Disbursement notes cannot exceed 1000 characters")
      .optional()
      .nullable(),
    bankReference: z
      .string()
      .trim()
      .max(100, "Bank reference cannot exceed 100 characters")
      .optional()
      .nullable(),
  })
  .optional()
  .default({});

module.exports = {
  submitRefundApplicationSchema,
  resubmitRefundApplicationSchema,
  rejectRefundApplicationSchema,
  requestRevisionSchema,
  disburseRefundApplicationSchema,
};
