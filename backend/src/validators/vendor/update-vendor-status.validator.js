const { z } = require("zod");

const updateVendorStatusSchema = z
  .object({
    onboardingStatus: z.enum([
      "pending",
      "under_review",
      "approved",
      "rejected",
      "changes_requested",
      "suspended",
      "inactive",
    ]),

    reason: z
      .string({ invalid_type_error: "Reason must be a string" })
      .trim()
      .min(10, "Administrative reason must be at least 10 characters long")
      .max(500, "Administrative reason cannot exceed 500 characters")
      .optional(),

    rejectionReason: z
      .string()
      .trim()
      .max(500)
      .nullable()
      .optional(),

    changesRequestedReason: z
      .string()
      .trim()
      .max(500)
      .nullable()
      .optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (
        data.onboardingStatus === "suspended" &&
        (!data.reason || data.reason.trim().length < 10)
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        "Administrative reason of at least 10 characters is required when suspending a vendor",
      path: ["reason"],
    }
  );

module.exports = {
  updateVendorStatusSchema,
};
