const { z } = require("zod");

const methodToggleSchema = z.union([
  z.boolean(),
  z.object({
    enabled: z.boolean(),
  }),
]);

const updateAuthenticationPolicySchema = z
  .object({
    emailPassword: z.boolean().optional(),
    emailOtp: z.boolean().optional(),
    mobileOtp: z.boolean().optional(),
    google: z.boolean().optional(),

    customerLogin: z
      .object({
        emailPassword: methodToggleSchema.optional(),
        emailOtp: methodToggleSchema.optional(),
        mobileOtp: methodToggleSchema.optional(),
        google: methodToggleSchema.optional(),
      })
      .strict()
      .optional(),

    registration: z
      .object({
        enabled: z.boolean().optional(),
        requireEmailVerification: z.boolean().optional(),
        requirePhoneVerification: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict("Unknown fields are not allowed in authentication policy update.")
  .refine(
    (data) => {
      // Ensure payload is not completely empty
      const hasFlat =
        data.emailPassword !== undefined ||
        data.emailOtp !== undefined ||
        data.mobileOtp !== undefined ||
        data.google !== undefined;

      const hasCustomerLogin =
        data.customerLogin && Object.keys(data.customerLogin).length > 0;

      const hasRegistration =
        data.registration && Object.keys(data.registration).length > 0;

      return hasFlat || hasCustomerLogin || hasRegistration;
    },
    {
      message: "At least one policy setting must be provided for update.",
    }
  );

module.exports = {
  updateAuthenticationPolicySchema,
};
