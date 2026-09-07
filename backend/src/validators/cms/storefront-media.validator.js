const { z } = require("zod");

const objectId = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

const mediaType = z.enum([
  "image",
  "video",
  "file",
]);

const storageProvider = z.enum([
  "cloudinary",
  "s3",
  "external",
]);

const createStorefrontMediaSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1)
    .max(200),

  type: mediaType,

  url: z
    .string()
    .trim()
    .url(),

  storageProvider: storageProvider.optional(),

  storageKey: z
    .string()
    .trim()
    .nullable()
    .optional(),

  mimeType: z
    .string()
    .trim()
    .max(150)
    .nullable()
    .optional(),

  fileSize: z
    .number()
    .min(0)
    .nullable()
    .optional(),

  altText: z
    .string()
    .trim()
    .max(300)
    .nullable()
    .optional(),

  metadata: z
    .record(z.string(), z.unknown())
    .optional(),

  isActive: z
    .boolean()
    .optional(),
});

const updateStorefrontMediaSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional(),

    type: mediaType.optional(),

    url: z
      .string()
      .trim()
      .url()
      .optional(),

    storageProvider: storageProvider.optional(),

    storageKey: z
      .string()
      .trim()
      .nullable()
      .optional(),

    mimeType: z
      .string()
      .trim()
      .max(150)
      .nullable()
      .optional(),

    fileSize: z
      .number()
      .min(0)
      .nullable()
      .optional(),

    altText: z
      .string()
      .trim()
      .max(300)
      .nullable()
      .optional(),

    metadata: z
      .record(z.string(), z.unknown())
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

const storefrontMediaIdParamsSchema = z.object({
  mediaId: objectId,
});

module.exports = {
  createStorefrontMediaSchema,
  updateStorefrontMediaSchema,
  storefrontMediaIdParamsSchema,
};