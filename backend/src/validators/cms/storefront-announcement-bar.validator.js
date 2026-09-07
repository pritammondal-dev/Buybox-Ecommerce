const { z } = require("zod");

const objectId = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

const dateField = z
  .string()
  .datetime()
  .nullable()
  .optional();

const createStorefrontAnnouncementBarSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1)
    .max(200),

  message: z
    .string()
    .trim()
    .min(1)
    .max(500),

  linkUrl: z
    .string()
    .trim()
    .url()
    .nullable()
    .optional(),

  linkLabel: z
    .string()
    .trim()
    .min(1)
    .max(100)
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

const updateStorefrontAnnouncementBarSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional(),

    message: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .optional(),

    linkUrl: z
      .string()
      .trim()
      .url()
      .nullable()
      .optional(),

    linkLabel: z
      .string()
      .trim()
      .min(1)
      .max(100)
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

const storefrontAnnouncementBarIdParamsSchema =
  z.object({
    barId: objectId,
  });

module.exports = {
  createStorefrontAnnouncementBarSchema,
  updateStorefrontAnnouncementBarSchema,
  storefrontAnnouncementBarIdParamsSchema,
};