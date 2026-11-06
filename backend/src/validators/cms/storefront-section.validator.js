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
  "carousel",
  "grid",
  "category_showcase",
  "brand_showcase",
  "mixed_collection",
  "promotional_banner",
  "flash_deal",
  "flash_sale",
]);

const hexColor = z
  .string()
  .trim()
  .regex(
    /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/,
    "Invalid hex color format (e.g. #007A55, #FFF, or #RRGGBBAA)"
  )
  .nullable()
  .optional();

const themeSchema = z
  .object({
    backgroundColor: hexColor,
    headingColor: hexColor,
    textColor: hexColor,
    accentColor: hexColor,
    badgeColor: hexColor,
    buttonBgColor: hexColor,
    buttonTextColor: hexColor,
    borderColor: hexColor,
  })
  .optional();

const bannerDataSchema = z
  .object({
    imageUrl: z.string().trim().nullable().optional(),
    linkUrl: z.string().trim().nullable().optional(),
    altText: z.string().trim().max(200).nullable().optional(),
    headline: z.string().trim().max(200).nullable().optional(),
    badge: z.string().trim().max(100).nullable().optional(),
    ctaText: z.string().trim().max(50).nullable().optional(),
  })
  .optional();

const productIds = z
  .array(objectId)
  .optional();

const categoryIds = z
  .array(objectId)
  .optional();

const automaticRulesSchema = z
  .object({
    categoryIds: z.array(objectId).optional(),
    excludedCategoryIds: z.array(objectId).optional(),
    brandIds: z.array(objectId).optional(),
    excludedBrandIds: z.array(objectId).optional(),
    minPrice: z.number().min(0).nullable().optional(),
    maxPrice: z.number().min(0).nullable().optional(),
    inStockOnly: z.boolean().optional(),
    hasDiscountOnly: z.boolean().optional(),
    minDiscountPercent: z.number().min(0).max(100).nullable().optional(),
    sortBy: z
      .enum([
        "newest",
        "price_asc",
        "price_desc",
        "sales",
        "discount_desc",
        "rating_desc",
      ])
      .optional(),
    maxPerBrand: z.number().int().min(1).max(50).nullable().optional(),
    maxPerCategory: z.number().int().min(1).max(50).nullable().optional(),
    fallbackStrategy: z.enum(["featured", "newest", "none"]).optional(),
  })
  .optional();

const groupSchema = z.object({
  id: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(200),
  subtitle: z.string().trim().max(500).nullable().optional(),
  type: z.enum(["category", "brand", "custom"]).optional(),
  categoryId: objectId.nullable().optional(),
  subcategoryId: objectId.nullable().optional(),
  brandId: objectId.nullable().optional(),
  logoUrl: z.string().trim().nullable().optional(),
  selectionMode: z.enum(["manual", "automatic", "hybrid"]).optional(),
  productIds: z.array(objectId).optional(),
  pinnedProductIds: z.array(objectId).optional(),
  excludedProductIds: z.array(objectId).optional(),
  automaticRules: automaticRulesSchema,
  limit: z.number().int().min(1).max(100).optional(),
  listingLimit: z.number().int().min(1).max(100).optional(),
  sortBy: z.string().trim().optional(),
  viewMoreUrl: z.string().trim().nullable().optional(),
  theme: themeSchema,
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

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

  selectionMode: z.enum(["manual", "automatic", "hybrid"]).optional(),

  rankingMetric: z.enum(["units_sold", "revenue"]).optional(),

  lookbackDays: z
    .number()
    .int()
    .min(1)
    .max(365)
    .optional(),

  productIds,

  pinnedProductIds: z.array(objectId).optional(),

  excludedProductIds: z.array(objectId).optional(),

  automaticRules: automaticRulesSchema,

  groups: z.array(groupSchema).optional(),

  collectionId: objectId.nullable().optional(),

  categoryId: objectId.nullable().optional(),

  categoryIds,

  bannerData: bannerDataSchema,

  theme: themeSchema,

  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional(),

  listingLimit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional(),

  viewMoreEnabled: z.boolean().optional(),

  viewMoreUrl: z.string().trim().nullable().optional(),

  viewMoreTitle: z.string().trim().max(100).nullable().optional(),

  displayOrder: z
    .number()
    .int()
    .min(0)
    .optional(),

  isActive: z
    .boolean()
    .optional(),

  publicationStatus: z
    .enum(["draft", "published", "archived"])
    .optional(),

  startsAt: z.coerce.date().nullable().optional(),

  endsAt: z.coerce.date().nullable().optional(),
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

    selectionMode: z.enum(["manual", "automatic", "hybrid"]).optional(),

    rankingMetric: z.enum(["units_sold", "revenue"]).optional(),

    lookbackDays: z
      .number()
      .int()
      .min(1)
      .max(365)
      .optional(),

    productIds,

    pinnedProductIds: z.array(objectId).optional(),

    excludedProductIds: z.array(objectId).optional(),

    automaticRules: automaticRulesSchema,

    groups: z.array(groupSchema).optional(),

    collectionId: objectId.nullable().optional(),

    categoryId: objectId.nullable().optional(),

    categoryIds,

    bannerData: bannerDataSchema,

    theme: themeSchema,

    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional(),

    listingLimit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional(),

    viewMoreEnabled: z.boolean().optional(),

    viewMoreUrl: z.string().trim().nullable().optional(),

    viewMoreTitle: z.string().trim().max(100).nullable().optional(),

    displayOrder: z
      .number()
      .int()
      .min(0)
      .optional(),

    isActive: z
      .boolean()
      .optional(),

    publicationStatus: z
      .enum(["draft", "published", "archived"])
      .optional(),

    startsAt: z.coerce.date().nullable().optional(),

    endsAt: z.coerce.date().nullable().optional(),
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

const reorderStorefrontSectionsSchema = z.object({
  sections: z
    .array(
      z.object({
        id: objectId,
        displayOrder: z.number().int().min(0),
        isActive: z.boolean().optional(),
      })
    )
    .min(1, "At least one section must be provided for reordering"),
});

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

const storefrontSectionProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  groupId: z.string().trim().optional(),
  category: z.string().trim().optional(),
  brand: z.string().trim().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  inStockOnly: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  sortBy: z
    .enum([
      "newest",
      "price_asc",
      "price_desc",
      "sales",
      "discount_desc",
      "rating_desc",
    ])
    .optional(),
});

module.exports = {
  createStorefrontSectionSchema,
  updateStorefrontSectionSchema,
  reorderStorefrontSectionsSchema,
  storefrontSectionIdParamsSchema,
  storefrontSectionKeyParamsSchema,
  storefrontSectionProductsQuerySchema,
  groupSchema,
  automaticRulesSchema,
};