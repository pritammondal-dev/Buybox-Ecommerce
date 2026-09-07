const { z } = require("zod");

const objectId = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

const blockSchema = z.object({
  blockId: objectId,

  displayOrder: z
    .number()
    .int()
    .min(0),

  isVisible: z
    .boolean()
    .optional(),
});

const createStorefrontHomepageSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1)
    .max(150),

  key: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(
      /^[a-z0-9_-]+$/,
      "Key can only contain lowercase letters, numbers, hyphens, and underscores"
    ),

  blocks: z
    .array(blockSchema)
    .default([]),

  isActive: z
    .boolean()
    .optional(),
});

const updateStorefrontHomepageSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1)
      .max(150)
      .optional(),

    key: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(
        /^[a-z0-9_-]+$/,
        "Key can only contain lowercase letters, numbers, hyphens, and underscores"
      )
      .optional(),

    blocks: z
      .array(blockSchema)
      .optional(),

    isActive: z
      .boolean()
      .optional(),
  })
  .refine(
    (data) =>
      Object.values(data).some(
        (value) => value !== undefined
      ),
    {
      message: "At least one field is required",
    }
  );

const storefrontHomepageIdParamsSchema = z.object({
  homepageId: objectId,
});

const storefrontHomepageKeyParamsSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(100),
});

module.exports = {
  createStorefrontHomepageSchema,
  updateStorefrontHomepageSchema,
  storefrontHomepageIdParamsSchema,
  storefrontHomepageKeyParamsSchema,
};