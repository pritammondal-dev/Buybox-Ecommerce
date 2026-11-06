const { z } = require("zod");

const objectId = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

const slug = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(
    /^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$/,
    "Slug must contain only alphanumeric characters separated by single hyphens"
  );

const sectionSchema = z.object({
  id: z.string().trim().min(1),
  type: z.enum([
    "hero_banner",
    "banner_slider",
    "promo_banner",
    "ad_banner",
    "category_grid",
    "product_collection",
    "category_products",
    "brand_showcase",
    "deals_collection",
    "countdown",
    "rich_text",
  ]),
  title: z.string().trim().max(200).default("").optional(),
  subtitle: z.string().trim().max(500).default("").optional(),
  displayOrder: z.number().int().min(0).default(0).optional(),
  isActive: z.boolean().default(true).optional(),
  config: z.record(z.any()).default({}).optional(),
});

const themeSchema = z
  .object({
    primaryColor: z.string().trim().max(50).optional(),
    accentColor: z.string().trim().max(50).optional(),
    backgroundGradient: z.string().trim().max(200).nullable().optional(),
    isDark: z.boolean().optional(),
  })
  .optional();

const seoSchema = z
  .object({
    title: z.string().trim().max(200).nullable().optional(),
    description: z.string().trim().max(500).nullable().optional(),
    keywords: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
  })
  .optional();

const createSpecialEventPageSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    slug,
    description: z.string().trim().max(1000).nullable().optional(),
    badge: z.string().trim().max(60).nullable().optional(),
    status: z.enum(["draft", "scheduled", "published", "archived"]).default("draft").optional(),
    startsAt: z.string().datetime({ offset: true }).nullable().optional(),
    endsAt: z.string().datetime({ offset: true }).nullable().optional(),
    timezone: z.string().trim().max(100).default("Asia/Kolkata").optional(),
    bannerUrl: z.string().trim().max(2000).nullable().optional(),
    mobileBannerUrl: z.string().trim().max(2000).nullable().optional(),
    theme: themeSchema,
    sections: z.array(sectionSchema).default([]).optional(),
    seo: seoSchema,
  })
  .refine(
    (data) => {
      if (data.startsAt && data.endsAt) {
        return new Date(data.startsAt) < new Date(data.endsAt);
      }
      return true;
    },
    { message: "Event startsAt must be before endsAt", path: ["endsAt"] }
  );

const updateSpecialEventPageSchema = z
  .object({
    name: z.string().trim().min(1).max(150).optional(),
    slug: slug.optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    badge: z.string().trim().max(60).nullable().optional(),
    status: z.enum(["draft", "scheduled", "published", "archived"]).optional(),
    startsAt: z.string().datetime({ offset: true }).nullable().optional(),
    endsAt: z.string().datetime({ offset: true }).nullable().optional(),
    timezone: z.string().trim().max(100).optional(),
    bannerUrl: z.string().trim().max(2000).nullable().optional(),
    mobileBannerUrl: z.string().trim().max(2000).nullable().optional(),
    theme: themeSchema,
    sections: z.array(sectionSchema).optional(),
    seo: seoSchema,
  })
  .refine(
    (data) => {
      if (data.startsAt && data.endsAt) {
        return new Date(data.startsAt) < new Date(data.endsAt);
      }
      return true;
    },
    { message: "Event startsAt must be before endsAt", path: ["endsAt"] }
  );

const specialEventPageIdParamsSchema = z.object({
  id: objectId,
});

const specialEventPageSlugParamsSchema = z.object({
  slug: z.string().trim().min(1).max(200),
});

const specialEventPageListQuerySchema = z.object({
  status: z.enum(["all", "draft", "scheduled", "published", "archived"]).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
});

module.exports = {
  sectionSchema,
  createSpecialEventPageSchema,
  updateSpecialEventPageSchema,
  specialEventPageIdParamsSchema,
  specialEventPageSlugParamsSchema,
  specialEventPageListQuerySchema,
};
