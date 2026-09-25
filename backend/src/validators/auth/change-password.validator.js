const { z } = require("zod");

const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, "Current password is required"),

    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters")
      .max(128, "New password must not exceed 128 characters"),

    confirmPassword: z
      .string()
      .min(1, "Please confirm your new password")
      .optional(),
  })
  .refine(
    (data) => {
      if (data.confirmPassword) {
        return data.newPassword === data.confirmPassword;
      }
      return true;
    },
    {
      message: "New password and confirmation do not match",
      path: ["confirmPassword"],
    }
  );

module.exports = {
  changePasswordSchema,
};
