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
    "Slug must contain only letters, numbers, and hyphens"
  );

const seoSchema = z
  .object({
    title: z.string().trim().max(200).nullable().optional(),
    description: z.string().trim().max(500).nullable().optional(),
    keywords: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
  })
  .optional();

const createCmsPageSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug,
  content: z.string().trim().min(1),
  seo: seoSchema,
});

const updateCmsPageSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    slug: slug.optional(),
    content: z.string().trim().min(1).optional(),
    seo: seoSchema,
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.slug !== undefined ||
      data.content !== undefined ||
      data.seo !== undefined,
    {
      message: "At least one field is required",
    }
  );

const cmsPageIdParamsSchema = z.object({
  pageId: objectId,
});

const cmsPageSlugParamsSchema = z.object({
  slug: z.string().trim().min(1).max(200),
});

const cmsPageListQuerySchema = z.object({
  status: z
    .enum(["draft", "published", "archived"])
    .optional(),
});

const publishCmsPageSchema = z.object({});

module.exports = {
  createCmsPageSchema,
  updateCmsPageSchema,
  cmsPageIdParamsSchema,
  cmsPageSlugParamsSchema,
  cmsPageListQuerySchema,
  publishCmsPageSchema,
};