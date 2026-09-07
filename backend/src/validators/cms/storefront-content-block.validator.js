const { z } = require("zod");

const objectId = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

const contentBlockType = z.enum([
  "hero",
  "rich_text",
  "image",
  "banner",
  "product_grid",
  "category_grid",
  "collection",
  "cta",
  "custom",
]);

const contentSchema = z.record(z.string(), z.unknown());

const dateField = z
  .string()
  .datetime()
  .nullable()
  .optional();

const createStorefrontContentBlockSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1)
    .max(200),

  key: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(
      /^[a-z0-9_-]+$/,
      "Key can only contain lowercase letters, numbers, hyphens, and underscores"
    ),

  type: contentBlockType,

  content: contentSchema.optional(),

  displayOrder: z
    .number()
    .int()
    .min(0)
    .optional(),

  isActive: z
    .boolean()
    .optional(),

  startsAt: dateField,

  endsAt: dateField,
});

const updateStorefrontContentBlockSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1)
      .max(200)
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

    type: contentBlockType.optional(),

    content: contentSchema.optional(),

    displayOrder: z
      .number()
      .int()
      .min(0)
      .optional(),

    isActive: z
      .boolean()
      .optional(),

    startsAt: dateField,

    endsAt: dateField,
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

const storefrontContentBlockIdParamsSchema =
  z.object({
    blockId: objectId,
  });

const storefrontContentBlockKeyParamsSchema =
  z.object({
    key: z
      .string()
      .trim()
      .min(1)
      .max(100),
  });

module.exports = {
  createStorefrontContentBlockSchema,
  updateStorefrontContentBlockSchema,
  storefrontContentBlockIdParamsSchema,
  storefrontContentBlockKeyParamsSchema,
};