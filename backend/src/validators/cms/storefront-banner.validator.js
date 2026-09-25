const { z } = require("zod");

const ALLOWED_BANNER_SLOTS = [
  "hero_main",
  "hero_audio",
  "hero_smart_home",
  "hero_brand_deals",
  "mid_work_smarter",
  "mid_stylish_looks",
  "category_audio",
  "category_workspace",
  "category_smart_living",
  "bottom_home_kitchen",
  "bottom_smart_gadgets",
  "bottom_monsoon_special",
];

const objectId = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

const dateField = z
  .string()
  .datetime()
  .nullable()
  .optional();

const isPathOrUrl = (val) => {
  if (!val || typeof val !== "string") return false;
  if (val.startsWith("/") || val.startsWith("data:image/")) return true;
  try {
    const u = new URL(val);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

const isLinkUrlOrPath = (val) => {
  if (!val) return true;
  if (val.startsWith("/") || val.startsWith("#")) return true;
  try {
    const u = new URL(val);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

const imageField = z
  .string()
  .trim()
  .refine(isPathOrUrl, {
    message: "Invalid image URL, asset path, or data URI",
  });

const optionalImageField = z
  .string()
  .trim()
  .refine((val) => !val || isPathOrUrl(val), {
    message: "Invalid mobile image URL, asset path, or data URI",
  })
  .nullable()
  .optional();

const optionalLinkField = z
  .string()
  .trim()
  .refine(isLinkUrlOrPath, {
    message: "Invalid destination link URL or path",
  })
  .nullable()
  .optional();

const slotKeyField = z
  .enum(ALLOWED_BANNER_SLOTS)
  .nullable()
  .optional();

const createStorefrontBannerSchema = z.object({
  title: z.string().trim().min(1).max(200),

  slotKey: slotKeyField,

  placement: slotKeyField,

  altText: z
    .string()
    .trim()
    .max(300)
    .nullable()
    .optional(),

  imageUrl: imageField,

  mobileImageUrl: optionalImageField,

  linkUrl: optionalLinkField,

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

    slotKey: slotKeyField,

    placement: slotKeyField,

    altText: z
      .string()
      .trim()
      .max(300)
      .nullable()
      .optional(),

    imageUrl: imageField.optional(),

    mobileImageUrl: optionalImageField,

    linkUrl: optionalLinkField,

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
  slotKey: z
    .enum(ALLOWED_BANNER_SLOTS)
    .optional(),
  placement: z
    .enum(ALLOWED_BANNER_SLOTS)
    .optional(),
});

module.exports = {
  ALLOWED_BANNER_SLOTS,
  createStorefrontBannerSchema,
  updateStorefrontBannerSchema,
  storefrontBannerIdParamsSchema,
  storefrontBannerListQuerySchema,
};