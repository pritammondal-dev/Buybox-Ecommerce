const { z } = require("zod");

const objectId = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

const urlOrPathField = z
  .string()
  .trim()
  .max(1000)
  .nullable()
  .optional();

const hexColor = z
  .string()
  .trim()
  .regex(
    /^#[0-9A-Fa-f]{3,8}$/,
    "Color must be a valid hex color code"
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
    facebook: urlOrPathField,
    instagram: urlOrPathField,
    twitter: urlOrPathField,
    youtube: urlOrPathField,
    linkedin: urlOrPathField,
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

const featureFlagsSchema = z
  .object({
    coupons: z.boolean().optional(),
    flashSale: z.boolean().optional(),
    vendorRegistration: z.boolean().optional(),
    vendorApprovalRequired: z.boolean().optional(),
    productApprovalRequired: z.boolean().optional(),
    reviews: z.boolean().optional(),
    wishlist: z.boolean().optional(),
    compare: z.boolean().optional(),
    guestCheckout: z.boolean().optional(),
    customerRegistration: z.boolean().optional(),
    returns: z.boolean().optional(),
    giftCards: z.boolean().optional(),
  })
  .passthrough()
  .optional();

const policiesSchema = z
  .object({
    returnWindowDays: z.number().int().min(1, 'Return window must be at least 1 day').max(90, 'Return window cannot exceed 90 days').optional(),
    refundWindowDays: z.number().min(0).optional(),
    minOrderValue: z.number().min(0).optional(),
    freeShippingThreshold: z.number().min(0).optional(),
    defaultTaxRate: z.number().min(0).optional(),
    lowStockThreshold: z.number().min(0).optional(),
  })
  .passthrough()
  .optional();

const logoDimensionsSchema = z
  .object({
    desktopWidth: z.number().int().min(40).max(400).optional(),
    desktopMaxHeight: z.number().int().min(20).max(120).optional(),
    mobileWidth: z.number().int().min(30).max(250).optional(),
    mobileMaxHeight: z.number().int().min(16).max(80).optional(),
    footerMaxHeight: z.number().int().min(16).max(100).optional(),
  })
  .optional();

const createStorefrontSettingsSchema = z.object({
  storeName: z
    .string()
    .trim()
    .min(1)
    .max(150),

  tagline: z.string().trim().max(255).optional(),
  logoUrl: urlOrPathField,
  faviconUrl: urlOrPathField,
  logoDimensions: logoDimensionsSchema,
  theme: themeSchema,
  contact: contactSchema,
  socialLinks: socialLinksSchema,
  currency: currencySchema,
  timezone: z.string().trim().max(100).optional(),
  language: z.string().trim().max(10).optional(),
  maintenanceMode: z.boolean().optional(),
  featureFlags: featureFlagsSchema,
  policies: policiesSchema,
});

const updateStorefrontSettingsSchema = z
  .object({
    storeName: z
      .string()
      .trim()
      .min(1)
      .max(150)
      .optional(),

    tagline: z.string().trim().max(255).optional(),
    logoUrl: urlOrPathField,
    faviconUrl: urlOrPathField,
    logoDimensions: logoDimensionsSchema,
    theme: themeSchema,
    contact: contactSchema,
    socialLinks: socialLinksSchema,
    currency: currencySchema,
    timezone: z.string().trim().max(100).optional(),
    language: z.string().trim().max(10).optional(),
    maintenanceMode: z.boolean().optional(),
    featureFlags: featureFlagsSchema,
    policies: policiesSchema,
    isActive: z.boolean().optional(),
  })
  .passthrough();

const updateFeatureFlagsSchema = z
  .record(z.boolean())
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one feature flag must be provided",
  });

const storefrontSettingsIdParamsSchema = z.object({
  settingsId: objectId,
});

module.exports = {
  createStorefrontSettingsSchema,
  updateStorefrontSettingsSchema,
  updateFeatureFlagsSchema,
  storefrontSettingsIdParamsSchema,
};