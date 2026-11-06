const { z } = require("zod");
const {
  VENDOR_BANK_ACCOUNT_TYPES,
  VENDOR_BANK_ACCOUNT_STATUSES,
} = require("../../models/VendorBankAccount");

const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const accountNumberRegex = /^[0-9]{9,20}$/;

const reasonSchema = z
  .string({
    required_error: "Administrative reason is mandatory",
    invalid_type_error: "Administrative reason must be a string",
  })
  .trim()
  .min(10, "Administrative reason must be at least 10 characters")
  .max(500, "Administrative reason cannot exceed 500 characters");

const submitBankAccountSchema = z
  .object({
    partnerBankId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid partner bank ID")
      .nullable()
      .optional(),

    accountHolderName: z
      .string({ required_error: "Account holder name is required" })
      .trim()
      .min(2, "Account holder name must be at least 2 characters")
      .max(150, "Account holder name cannot exceed 150 characters"),

    bankName: z
      .string()
      .trim()
      .max(150, "Bank name cannot exceed 150 characters")
      .optional()
      .nullable(),

    country: z
      .string()
      .trim()
      .length(2, "Country code must be 2 characters (ISO 3166-1 alpha-2)")
      .default("IN")
      .optional(),

    state: z
      .string()
      .trim()
      .max(100, "State cannot exceed 100 characters")
      .nullable()
      .optional(),

    accountNumber: z
      .string({ required_error: "Bank account number is required" })
      .trim()
      .regex(accountNumberRegex, "Account number must be 9 to 20 digits"),

    confirmAccountNumber: z
      .string({ required_error: "Account number confirmation is required" })
      .trim(),

    ifscCode: z
      .string()
      .trim()
      .toUpperCase()
      .optional()
      .nullable(),

    branchName: z
      .string()
      .trim()
      .max(150, "Branch name cannot exceed 150 characters")
      .nullable()
      .optional(),

    accountType: z
      .enum(VENDOR_BANK_ACCOUNT_TYPES, {
        errorMap: () => ({ message: "Account type must be savings, current, or other" }),
      })
      .default("current"),

    submissionReason: z
      .string()
      .trim()
      .max(500, "Submission note cannot exceed 500 characters")
      .nullable()
      .optional(),
  })
  .refine((data) => data.accountNumber === data.confirmAccountNumber, {
    message: "Bank account number and confirmation account number do not match",
    path: ["confirmAccountNumber"],
  })
  .refine((data) => Boolean(data.partnerBankId || (data.bankName && data.bankName.trim().length >= 2)), {
    message: "Bank selection or bank name is required",
    path: ["bankName"],
  })
  .refine((data) => {
    const isIndia = !data.country || data.country.toUpperCase() === "IN";
    if (isIndia) {
      return data.ifscCode && ifscRegex.test(data.ifscCode);
    }
    return true;
  }, {
    message: "Invalid Indian Financial System Code (IFSC) format. Expected 4 letters, '0', then 6 alphanumeric characters.",
    path: ["ifscCode"],
  });

const resubmitBankAccountSchema = submitBankAccountSchema;

const rejectBankAccountSchema = z.object({
  reason: reasonSchema,
});

const approveBankAccountSchema = z.object({
  reason: z
    .string({
      invalid_type_error: "Approval note must be a string",
    })
    .trim()
    .max(500, "Approval note cannot exceed 500 characters")
    .nullable()
    .optional(),
});

const unmaskBankAccountSchema = z.object({
  reason: reasonSchema,
});

const adminCreateBankAccountSchema = z
  .object({
    partnerBankId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid partner bank ID")
      .nullable()
      .optional(),

    accountHolderName: z
      .string({ required_error: "Account holder name is required" })
      .trim()
      .min(2, "Account holder name must be at least 2 characters")
      .max(150, "Account holder name cannot exceed 150 characters"),

    bankName: z
      .string()
      .trim()
      .max(150, "Bank name cannot exceed 150 characters")
      .optional()
      .nullable(),

    country: z
      .string()
      .trim()
      .length(2, "Country code must be 2 characters (ISO 3166-1 alpha-2)")
      .default("IN")
      .optional(),

    state: z
      .string()
      .trim()
      .max(100, "State cannot exceed 100 characters")
      .nullable()
      .optional(),

    accountNumber: z
      .string({ required_error: "Bank account number is required" })
      .trim()
      .regex(accountNumberRegex, "Account number must be 9 to 20 digits"),

    confirmAccountNumber: z
      .string({ required_error: "Account number confirmation is required" })
      .trim(),

    ifscCode: z
      .string()
      .trim()
      .toUpperCase()
      .optional()
      .nullable(),

    branchName: z
      .string()
      .trim()
      .max(150, "Branch name cannot exceed 150 characters")
      .nullable()
      .optional(),

    accountType: z
      .enum(VENDOR_BANK_ACCOUNT_TYPES)
      .default("current"),

    reason: reasonSchema,

    autoApprove: z
      .boolean()
      .default(false)
      .optional(),

    setActive: z
      .boolean()
      .default(false)
      .optional(),
  })
  .refine((data) => data.accountNumber === data.confirmAccountNumber, {
    message: "Bank account number and confirmation account number do not match",
    path: ["confirmAccountNumber"],
  })
  .refine((data) => Boolean(data.partnerBankId || (data.bankName && data.bankName.trim().length >= 2)), {
    message: "Bank selection or bank name is required",
    path: ["bankName"],
  })
  .refine((data) => {
    const isIndia = !data.country || data.country.toUpperCase() === "IN";
    if (isIndia) {
      return data.ifscCode && ifscRegex.test(data.ifscCode);
    }
    return true;
  }, {
    message: "Invalid Indian Financial System Code (IFSC) format",
    path: ["ifscCode"],
  });

const adminUpdateBankAccountSchema = z
  .object({
    partnerBankId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid partner bank ID")
      .nullable()
      .optional(),

    accountHolderName: z
      .string()
      .trim()
      .min(2, "Account holder name must be at least 2 characters")
      .max(150, "Account holder name cannot exceed 150 characters")
      .optional(),

    bankName: z
      .string()
      .trim()
      .min(2, "Bank name must be at least 2 characters")
      .max(150, "Bank name cannot exceed 150 characters")
      .optional(),

    country: z
      .string()
      .trim()
      .length(2, "Country code must be 2 characters (ISO 3166-1 alpha-2)")
      .optional(),

    state: z
      .string()
      .trim()
      .max(100, "State cannot exceed 100 characters")
      .nullable()
      .optional(),

    branchName: z
      .string()
      .trim()
      .max(150, "Branch name cannot exceed 150 characters")
      .nullable()
      .optional(),

    accountType: z
      .enum(VENDOR_BANK_ACCOUNT_TYPES)
      .optional(),

    accountNumber: z
      .string()
      .trim()
      .regex(accountNumberRegex, "Account number must be 9 to 20 digits")
      .optional(),

    confirmAccountNumber: z
      .string()
      .trim()
      .optional(),

    ifscCode: z
      .string()
      .trim()
      .toUpperCase()
      .optional()
      .nullable(),

    reason: reasonSchema,
  })
  .refine(
    (data) => {
      if (data.accountNumber && !data.confirmAccountNumber) {
        return false;
      }
      if (data.accountNumber && data.confirmAccountNumber) {
        return data.accountNumber === data.confirmAccountNumber;
      }
      return true;
    },
    {
      message: "Confirm account number must match account number",
      path: ["confirmAccountNumber"],
    }
  );

const adminStatusBankAccountSchema = z.object({
  isActive: z.boolean({ required_error: "isActive boolean is required" }),
  reason: reasonSchema,
});

const adminDeleteBankAccountSchema = z.object({
  reason: reasonSchema,
});

const listBankApplicationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum([...VENDOR_BANK_ACCOUNT_STATUSES, "all"]).optional(),
  search: z.string().trim().optional(),
});

module.exports = {
  submitBankAccountSchema,
  resubmitBankAccountSchema,
  approveBankAccountSchema,
  rejectBankAccountSchema,
  unmaskBankAccountSchema,
  adminCreateBankAccountSchema,
  adminUpdateBankAccountSchema,
  adminStatusBankAccountSchema,
  adminDeleteBankAccountSchema,
  listBankApplicationsQuerySchema,
};

