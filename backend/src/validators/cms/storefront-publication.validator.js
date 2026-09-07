const { z } = require("zod");

const objectId = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

const resourceType = z.enum([
  "page",
  "banner",
  "menu",
  "settings",
  "seo",
  "redirect",
  "content_block",
  "homepage",
  "section",
  "announcement_bar",
  "media",
]);

const publicationStatus = z.enum([
  "draft",
  "published",
]);

const createStorefrontPublicationSchema = z.object({
  resourceType,

  resourceId: objectId,

  status: publicationStatus.optional(),
});

const storefrontPublicationIdParamsSchema = z.object({
  publicationId: objectId,
});

const storefrontPublicationResourceParamsSchema =
  z.object({
    resourceType,
    resourceId: objectId,
  });

const storefrontPreviewTokenParamsSchema = z.object({
  previewToken: z
    .string()
    .trim()
    .min(1)
    .max(100),
});

module.exports = {
  createStorefrontPublicationSchema,
  storefrontPublicationIdParamsSchema,
  storefrontPublicationResourceParamsSchema,
  storefrontPreviewTokenParamsSchema,
};