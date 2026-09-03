const { z } = require("zod");

const createAddressSchema = z
  .object({
    type: z
      .enum(["home", "work", "other"])
      .optional()
      .default("home"),

    firstName: z
      .string()
      .trim()
      .min(1, "First name is required")
      .max(50),

    lastName: z
      .string()
      .trim()
      .min(1, "Last name is required")
      .max(50),

    phone: z
      .string()
      .trim()
      .min(7, "Invalid phone number")
      .max(20),

    addressLine1: z
      .string()
      .trim()
      .min(1, "Address line 1 is required")
      .max(200),

    addressLine2: z
      .string()
      .trim()
      .max(200)
      .optional()
      .default(""),

    city: z
      .string()
      .trim()
      .min(1, "City is required")
      .max(100),

    state: z
      .string()
      .trim()
      .min(1, "State is required")
      .max(100),

    postalCode: z
      .string()
      .trim()
      .min(3, "Invalid postal code")
      .max(20),

    country: z
      .string()
      .trim()
      .toUpperCase()
      .length(2)
      .optional()
      .default("IN"),

    isDefault: z
      .boolean()
      .optional()
      .default(false),
  })
  .strict();

module.exports = {
  createAddressSchema,
};