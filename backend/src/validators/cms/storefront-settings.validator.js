const { z } = require("zod");

const objectId = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

const urlField = z
  .string()
  .trim()
  .url()
  .nullable()
  .optional();

const hexColor = z
  .string()
  .trim()
  .regex(
    /^#[0-9A-Fa-f]{6}$/,
    "Color must be a valid 6-digit hex color"
  );

const contactSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .nullable()
      .optional(),

    phone: z
      .string()
      .trim()
      .max(30)
      .nullable()
      .optional(),

    address: z
      .string()
      .trim()
      .max(500)
      .nullable()
      .optional(),
  })
  .optional();

const themeSchema = z
  .object({
    primaryColor: hexColor.optional(),
    secondaryColor: hexColor.optional(),
  })
  .optional();

const socialLinksSchema = z
  .object({
    facebook: urlField,
    instagram: urlField,
    twitter: urlField,
    youtube: urlField,
    linkedin: urlField,
  })
  .optional();

const currencySchema = z
  .object({
    code: z
      .string()
      .trim()
      .length(3)
      .regex(/^[A-Za-z]{3}$/)
      .optional(),

    symbol: z
      .string()
      .trim()
      .min(1)
      .max(5)
      .optional(),
  })
  .optional();

const createStorefrontSettingsSchema = z.object({
  storeName: z
    .string()
    .trim()
    .min(1)
    .max(150),

  logoUrl: urlField,

  faviconUrl: urlField,

  theme: themeSchema,

  contact: contactSchema,

  socialLinks: socialLinksSchema,

  currency: currencySchema,
});

const updateStorefrontSettingsSchema = z
  .object({
    storeName: z
      .string()
      .trim()
      .min(1)
      .max(150)
      .optional(),

    logoUrl: urlField,

    faviconUrl: urlField,

    theme: themeSchema,

    contact: contactSchema,

    socialLinks: socialLinksSchema,

    currency: currencySchema,

    isActive: z.boolean().optional(),
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

const storefrontSettingsIdParamsSchema = z.object({
  settingsId: objectId,
});

module.exports = {
  createStorefrontSettingsSchema,
  updateStorefrontSettingsSchema,
  storefrontSettingsIdParamsSchema,
};