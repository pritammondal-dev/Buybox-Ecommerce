const { z } = require("zod");

const objectId = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

const sectionType = z.enum([
  "featured_products",
  "new_arrivals",
  "best_sellers",
  "products",
  "collection",
  "category",
]);

const productIds = z
  .array(objectId)
  .optional();

const createStorefrontSectionSchema = z.object({
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

  type: sectionType,

  subtitle: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .optional(),

  productIds,

  collectionId: objectId.nullable().optional(),

  categoryId: objectId.nullable().optional(),

  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional(),

  displayOrder: z
    .number()
    .int()
    .min(0)
    .optional(),

  isActive: z
    .boolean()
    .optional(),
});

const updateStorefrontSectionSchema = z
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

    type: sectionType.optional(),

    subtitle: z
      .string()
      .trim()
      .max(500)
      .nullable()
      .optional(),

    productIds,

    collectionId: objectId.nullable().optional(),

    categoryId: objectId.nullable().optional(),

    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional(),

    displayOrder: z
      .number()
      .int()
      .min(0)
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

const storefrontSectionIdParamsSchema = z.object({
  sectionId: objectId,
});

const storefrontSectionKeyParamsSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(100),
});

module.exports = {
  createStorefrontSectionSchema,
  updateStorefrontSectionSchema,
  storefrontSectionIdParamsSchema,
  storefrontSectionKeyParamsSchema,
};