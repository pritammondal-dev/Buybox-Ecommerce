const { z } = require("zod");

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

const campaignScope = z.enum([
  "all",
  "products",
  "categories",
  "vendors",
]);

const campaignStatus = z.enum([
  "draft",
  "scheduled",
  "active",
  "paused",
  "completed",
  "cancelled",
]);

const createCampaignSchema = z.object({
  name: z.string().trim().min(1).max(150),

  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(180)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid campaign slug"),

  description: z.string().trim().max(1000).nullable().optional(),

  startsAt: z.coerce.date(),

  endsAt: z.coerce.date(),

  scope: campaignScope.default("all"),

  productIds: z.array(objectId).default([]),

  categoryIds: z.array(objectId).default([]),

  vendorIds: z.array(objectId).default([]),

  couponIds: z.array(objectId).default([]),

  metadata: z.record(z.string(), z.string()).optional(),

  isActive: z.boolean().optional(),
});

const updateCampaignSchema = z
  .object({
    name: z.string().trim().min(1).max(150).optional(),

    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(1)
      .max(180)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid campaign slug")
      .optional(),

    description: z.string().trim().max(1000).nullable().optional(),

    startsAt: z.coerce.date().optional(),

    endsAt: z.coerce.date().optional(),

    scope: campaignScope.optional(),

    productIds: z.array(objectId).optional(),

    categoryIds: z.array(objectId).optional(),

    vendorIds: z.array(objectId).optional(),

    couponIds: z.array(objectId).optional(),

    metadata: z.record(z.string(), z.string()).optional(),

    isActive: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.startsAt === undefined ||
      data.endsAt === undefined ||
      data.endsAt > data.startsAt,
    {
      message: "Campaign end date must be after start date",
      path: ["endsAt"],
    }
  );

const transitionCampaignSchema = z.object({
  status: campaignStatus,
});

module.exports = {
  createCampaignSchema,
  updateCampaignSchema,
  transitionCampaignSchema,
};