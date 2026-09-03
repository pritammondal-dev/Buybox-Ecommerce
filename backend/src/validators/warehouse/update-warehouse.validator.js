const { z } = require("zod");

const updateWarehouseSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2)
      .max(150)
      .optional(),

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
          .max(200)
          .optional(),

        addressLine2: z
          .string()
          .trim()
          .max(200)
          .optional(),

        city: z
          .string()
          .trim()
          .min(1)
          .max(100)
          .optional(),

        state: z
          .string()
          .trim()
          .min(1)
          .max(100)
          .optional(),

        postalCode: z
          .string()
          .trim()
          .min(3)
          .max(20)
          .optional(),

        country: z
          .string()
          .trim()
          .toUpperCase()
          .length(2)
          .optional(),
      })
      .strict()
      .optional(),

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

    isActive: z
      .boolean()
      .optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: "At least one field is required",
    }
  );

module.exports = {
  updateWarehouseSchema,
};