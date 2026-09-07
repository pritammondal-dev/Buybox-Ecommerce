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

const openGraphSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .nullable()
      .optional(),

    description: z
      .string()
      .trim()
      .max(500)
      .nullable()
      .optional(),

    imageUrl: urlField,

    type: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .optional(),
  })
  .optional();

const twitterSchema = z
  .object({
    card: z
      .enum(["summary", "summary_large_image"])
      .optional(),

    title: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .nullable()
      .optional(),

    description: z
      .string()
      .trim()
      .max(500)
      .nullable()
      .optional(),

    imageUrl: urlField,
  })
  .optional();

const robotsSchema = z
  .object({
    index: z.boolean().optional(),
    follow: z.boolean().optional(),
  })
  .optional();

const createStorefrontSeoSchema = z.object({
  siteName: z
    .string()
    .trim()
    .min(1)
    .max(150),

  defaultTitle: z
    .string()
    .trim()
    .min(1)
    .max(200),

  defaultDescription: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .optional(),

  defaultKeywords: z
    .array(
      z.string().trim().min(1).max(100)
    )
    .optional(),

  canonicalUrl: urlField,

  openGraph: openGraphSchema,

  twitter: twitterSchema,

  robots: robotsSchema,
});

const updateStorefrontSeoSchema = z
  .object({
    siteName: z
      .string()
      .trim()
      .min(1)
      .max(150)
      .optional(),

    defaultTitle: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional(),

    defaultDescription: z
      .string()
      .trim()
      .max(500)
      .nullable()
      .optional(),

    defaultKeywords: z
      .array(
        z.string().trim().min(1).max(100)
      )
      .optional(),

    canonicalUrl: urlField,

    openGraph: openGraphSchema,

    twitter: twitterSchema,

    robots: robotsSchema,

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

const storefrontSeoIdParamsSchema = z.object({
  seoId: objectId,
});

module.exports = {
  createStorefrontSeoSchema,
  updateStorefrontSeoSchema,
  storefrontSeoIdParamsSchema,
};

