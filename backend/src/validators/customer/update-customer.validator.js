const { z } = require("zod");

const updateCustomerSchema = z
  .object({
    phone: z
      .string()
      .trim()
      .min(7)
      .max(20)
      .nullable()
      .optional(),

    dateOfBirth: z
      .string()
      .datetime()
      .nullable()
      .optional(),

    gender: z
      .enum([
        "male",
        "female",
        "other",
        "prefer_not_to_say",
      ])
      .nullable()
      .optional(),

    avatar: z
      .object({
        url: z.string().url().nullable().optional(),
        publicId: z.string().max(255).nullable().optional(),
      })
      .strict()
      .optional(),

    preferences: z
      .object({
        marketingEmails: z.boolean().optional(),
        marketingSms: z.boolean().optional(),
        marketingPush: z.boolean().optional(),
      })
      .strict()
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
  updateCustomerSchema,
};