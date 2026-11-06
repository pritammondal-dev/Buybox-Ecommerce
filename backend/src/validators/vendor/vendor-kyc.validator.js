const { z } = require("zod");

const kycDocumentCategories = [
  "identity_proof",
  "business_registration",
  "tax_id",
  "address_proof",
];

const uploadKycDocumentSchema = z
  .object({
    documentCategory: z.enum(kycDocumentCategories, {
      errorMap: () => ({
        message:
          "documentCategory must be one of: identity_proof, business_registration, tax_id, address_proof",
      }),
    }),
    documentType: z.string().trim().min(2).max(100),
    documentNumber: z.string().trim().max(100).nullable().optional(),
  })
  .strict();

const reviewKycDocumentSchema = z
  .object({
    status: z.enum(["approved", "rejected"], {
      errorMap: () => ({
        message: "Status must be either 'approved' or 'rejected'",
      }),
    }),
    rejectionReason: z
      .string()
      .trim()
      .min(5, "Rejection reason must be at least 5 characters")
      .max(500, "Rejection reason cannot exceed 500 characters")
      .optional()
      .nullable(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.status === "rejected") {
        return Boolean(data.rejectionReason && data.rejectionReason.trim().length >= 5);
      }
      return true;
    },
    {
      message: "A meaningful rejection reason (minimum 5 characters) is required when rejecting a document.",
      path: ["rejectionReason"],
    }
  );

const listKycQueueQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z
      .enum(["not_submitted", "pending", "under_review", "approved", "rejected", "all"])
      .optional(),
    search: z.string().trim().max(150).optional(),
  })
  .strict();

module.exports = {
  kycDocumentCategories,
  uploadKycDocumentSchema,
  reviewKycDocumentSchema,
  listKycQueueQuerySchema,
};

