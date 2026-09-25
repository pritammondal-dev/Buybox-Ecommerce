const { z } = require("zod");

// 6-digit numeric OTP regex
const OTP_REGEX = /^\d{6}$/;

const emailLoginOtpRequestSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("A valid email address is required"),
  })
  .strict();

const emailLoginOtpVerifySchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("A valid email address is required"),
    otp: z
      .string()
      .trim()
      .regex(OTP_REGEX, "Verification code must be exactly 6 digits"),
  })
  .strict();

const phoneLoginOtpRequestSchema = z
  .object({
    phone: z
      .string()
      .trim()
      .min(8, "Phone number is too short")
      .max(20, "Phone number is too long"),
  })
  .strict();

const phoneLoginOtpVerifySchema = z
  .object({
    phone: z
      .string()
      .trim()
      .min(8, "Phone number is too short")
      .max(20, "Phone number is too long"),
    otp: z
      .string()
      .trim()
      .regex(OTP_REGEX, "Verification code must be exactly 6 digits"),
  })
  .strict();

const phoneRegisterRequestSchema = z
  .object({
    phone: z
      .string()
      .trim()
      .min(8, "Phone number is too short")
      .max(20, "Phone number is too long"),
    firstName: z
      .string()
      .trim()
      .min(1, "First name is required")
      .max(50, "First name must not exceed 50 characters"),
    lastName: z
      .string()
      .trim()
      .max(50, "Last name must not exceed 50 characters")
      .optional()
      .default(""),
  })
  .strict();

const phoneRegisterVerifySchema = z
  .object({
    phone: z
      .string()
      .trim()
      .min(8, "Phone number is too short")
      .max(20, "Phone number is too long"),
    otp: z
      .string()
      .trim()
      .regex(OTP_REGEX, "Verification code must be exactly 6 digits"),
    firstName: z
      .string()
      .trim()
      .min(1, "First name is required")
      .max(50, "First name must not exceed 50 characters"),
    lastName: z
      .string()
      .trim()
      .max(50, "Last name must not exceed 50 characters")
      .optional()
      .default(""),
  })
  .strict();

const googleAuthSchema = z
  .object({
    idToken: z
      .string()
      .trim()
      .min(10, "Google ID token is required"),
  })
  .strict();

const changeEmailRequestSchema = z
  .object({
    newEmail: z
      .string()
      .trim()
      .toLowerCase()
      .email("A valid new email address is required"),
  })
  .strict();

const changeEmailVerifySchema = z
  .object({
    newEmail: z
      .string()
      .trim()
      .toLowerCase()
      .email("A valid new email address is required"),
    otp: z
      .string()
      .trim()
      .regex(OTP_REGEX, "Verification code must be exactly 6 digits"),
  })
  .strict();

const changePhoneRequestSchema = z
  .object({
    newPhone: z
      .string()
      .trim()
      .min(8, "Phone number is too short")
      .max(20, "Phone number is too long"),
  })
  .strict();

const changePhoneVerifySchema = z
  .object({
    newPhone: z
      .string()
      .trim()
      .min(8, "Phone number is too short")
      .max(20, "Phone number is too long"),
    otp: z
      .string()
      .trim()
      .regex(OTP_REGEX, "Verification code must be exactly 6 digits"),
  })
  .strict();

module.exports = {
  emailLoginOtpRequestSchema,
  emailLoginOtpVerifySchema,
  phoneLoginOtpRequestSchema,
  phoneLoginOtpVerifySchema,
  phoneRegisterRequestSchema,
  phoneRegisterVerifySchema,
  googleAuthSchema,
  changeEmailRequestSchema,
  changeEmailVerifySchema,
  changePhoneRequestSchema,
  changePhoneVerifySchema,
};
