const { z } = require("zod");

const rejectVendorSchema = z
  .object({
    reason: z
      .string({ required_error: "Rejection reason is required" })
      .trim()
      .min(5, "Rejection reason must be at least 5 characters")
      .max(1000, "Rejection reason must not exceed 1000 characters"),
  })
  .strict();

const requestChangesSchema = z
  .object({
    reason: z
      .string({ required_error: "Required changes instructions are required" })
      .trim()
      .min(5, "Instructions must be at least 5 characters")
      .max(1000, "Instructions must not exceed 1000 characters"),
  })
  .strict();

const listVendorsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z
      .enum(["pending", "under_review", "approved", "rejected", "changes_requested", "suspended", "inactive", "all"])
      .optional(),
    search: z.string().trim().optional(),
    sortBy: z.enum(["createdAt", "storeName", "onboardingStatus", "approvedAt"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  });

module.exports = {
  rejectVendorSchema,
  requestChangesSchema,
  listVendorsQuerySchema,
};
