const { z } = require("zod");

const updateVendorStatusSchema = z
  .object({
    onboardingStatus: z.enum([
      "pending",
      "under_review",
      "approved",
      "rejected",
      "suspended",
      "inactive",
    ]),

    rejectionReason: z
      .string()
      .trim()
      .max(500)
      .nullable()
      .optional(),
  })
  .strict();

module.exports = {
  updateVendorStatusSchema,
};