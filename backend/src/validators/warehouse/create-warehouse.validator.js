const { z } = require("zod");

const createWarehouseSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2)
      .max(150),

    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(2)
      .max(30)
      .regex(
        /^[A-Z0-9_-]+$/,
        "Warehouse code may contain only letters, numbers, underscores, and hyphens"
      ),

    description: z
      .string()
      .trim()
      .max(500)
      .nullable()
      .optional(),

    address: z
      .object({
        addressLine1: z
          .string()
          .trim()
          .min(1)
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
          .min(1)
          .max(100),

        state: z
          .string()
          .trim()
          .min(1)
          .max(100),

        postalCode: z
          .string()
          .trim()
          .min(3)
          .max(20),

        country: z
          .string()
          .trim()
          .toUpperCase()
          .length(2)
          .optional()
          .default("IN"),
      })
      .strict(),

    contactPhone: z
      .string()
      .trim()
      .min(7)
      .max(20)
      .nullable()
      .optional(),

    contactEmail: z
      .string()
      .trim()
      .email()
      .max(254)
      .nullable()
      .optional(),
  })
  .strict();

module.exports = {
  createWarehouseSchema,
};