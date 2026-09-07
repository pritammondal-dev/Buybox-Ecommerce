const { z } = require("zod");

const objectId = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

const dateField = z
  .string()
  .datetime()
  .nullable()
  .optional();

const createStorefrontBannerSchema = z.object({
  title: z.string().trim().min(1).max(200),

  imageUrl: z
    .string()
    .trim()
    .url(),

  mobileImageUrl: z
    .string()
    .trim()
    .url()
    .nullable()
    .optional(),

  linkUrl: z
    .string()
    .trim()
    .url()
    .nullable()
    .optional(),

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

const updateStorefrontBannerSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),

    imageUrl: z
      .string()
      .trim()
      .url()
      .optional(),

    mobileImageUrl: z
      .string()
      .trim()
      .url()
      .nullable()
      .optional(),

    linkUrl: z
      .string()
      .trim()
      .url()
      .nullable()
      .optional(),

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

const storefrontBannerIdParamsSchema = z.object({
  bannerId: objectId,
});

const storefrontBannerListQuerySchema = z.object({
  isActive: z
    .enum(["true", "false"])
    .optional(),
});

module.exports = {
  createStorefrontBannerSchema,
  updateStorefrontBannerSchema,
  storefrontBannerIdParamsSchema,
  storefrontBannerListQuerySchema,
};