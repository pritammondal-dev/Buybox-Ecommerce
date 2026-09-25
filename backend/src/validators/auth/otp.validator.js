const { z } = require("zod");
const { OTP_PURPOSES } = require("../../constants/auth.constants");

const purposeEnum = z.enum(Object.values(OTP_PURPOSES));

const verifyOtpSchema = z
  .object({
    email: z.string().email("A valid email address is required").trim().toLowerCase().optional(),
    phone: z.string().trim().min(8).max(20).optional(),
    otp: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Verification code must be exactly 6 digits"),
    purpose: purposeEnum.default(OTP_PURPOSES.EMAIL_VERIFICATION),
  })
  .refine((data) => data.email || data.phone, {
    message: "Either email or phone number is required",
    path: ["email"],
  });

const resendOtpSchema = z
  .object({
    email: z.string().email("A valid email address is required").trim().toLowerCase().optional(),
    phone: z.string().trim().min(8).max(20).optional(),
    purpose: purposeEnum.default(OTP_PURPOSES.EMAIL_VERIFICATION),
  })
  .refine((data) => data.email || data.phone, {
    message: "Either email or phone number is required",
    path: ["email"],
  });

module.exports = {
  verifyOtpSchema,
  resendOtpSchema,
};

