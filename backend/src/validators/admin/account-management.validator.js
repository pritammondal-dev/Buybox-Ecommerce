const { z } = require("zod");

/**
 * Shared validator for administrative reasons.
 * Mandates at least 10 non-whitespace characters and maximum 500 characters.
 */
const administrativeReasonSchema = z
  .string({ required_error: "Administrative reason is required" })
  .trim()
  .min(10, "Administrative reason must be at least 10 characters long")
  .max(500, "Administrative reason cannot exceed 500 characters");

const suspendAccountSchema = z
  .object({
    reason: administrativeReasonSchema,
  })
  .strict();

const reactivateAccountSchema = z
  .object({
    reason: administrativeReasonSchema,
  })
  .strict();

const updateCustomerStatusSchema = z
  .object({
    isActive: z.boolean({
      required_error: "Account active status (isActive) is required",
    }),
    reason: administrativeReasonSchema,
  })
  .strict();

const resetPasswordSchema = z
  .object({
    newPassword: z
      .string({ required_error: "New password is required" })
      .min(8, "New password must be at least 8 characters long")
      .max(128, "New password must not exceed 128 characters"),
    reason: administrativeReasonSchema,
  })
  .strict();

const deleteAccountSchema = z
  .object({
    reason: administrativeReasonSchema,
  })
  .strict();

const updateCustomerAdminSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name cannot be empty").max(50).optional(),
    lastName: z.string().trim().min(1, "Last name cannot be empty").max(50).optional(),
    phone: z.string().trim().max(20).nullable().optional(),
    isActive: z.boolean().optional(),
    reason: administrativeReasonSchema,
  })
  .strict()
  .refine(
    (data) => {
      const { reason, ...updatable } = data;
      return Object.keys(updatable).length > 0;
    },
    { message: "At least one customer profile field must be provided for update" }
  );

const updateVendorAdminSchema = z
  .object({
    businessName: z.string().trim().min(2).max(150).optional(),
    phone: z.string().trim().min(7).max(20).nullable().optional(),
    supportEmail: z.string().trim().email().max(254).nullable().optional(),
    commissionRate: z.number().min(0).max(100).optional(),
    isActive: z.boolean().optional(),
    onboardingStatus: z
      .enum([
        "pending",
        "under_review",
        "approved",
        "rejected",
        "changes_requested",
        "suspended",
        "inactive",
      ])
      .optional(),
    businessAddress: z
      .object({
        addressLine1: z.string().trim().max(200).nullable().optional(),
        addressLine2: z.string().trim().max(200).nullable().optional(),
        city: z.string().trim().max(100).nullable().optional(),
        state: z.string().trim().max(100).nullable().optional(),
        postalCode: z.string().trim().max(20).nullable().optional(),
        country: z.string().trim().toUpperCase().optional(),
      })
      .optional(),
    taxInformation: z
      .object({
        taxId: z.string().trim().max(100).nullable().optional(),
        taxType: z.string().trim().max(50).nullable().optional(),
        gstin: z.string().trim().max(100).nullable().optional(),
        pan: z.string().trim().max(100).nullable().optional(),
      })
      .optional(),
    reason: administrativeReasonSchema,
  })
  .strict()
  .refine(
    (data) => {
      const { reason, ...updatable } = data;
      return Object.keys(updatable).length > 0;
    },
    { message: "At least one vendor profile or operational field must be provided for update" }
  );

module.exports = {
  administrativeReasonSchema,
  suspendAccountSchema,
  reactivateAccountSchema,
  updateCustomerStatusSchema,
  resetPasswordSchema,
  deleteAccountSchema,
  updateCustomerAdminSchema,
  updateVendorAdminSchema,
};
