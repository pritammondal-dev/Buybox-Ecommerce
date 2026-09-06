const { z } = require("zod");

const objectId = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

const createReviewSchema = z.object({
  productId: objectId,

  productVariantId: objectId.nullable().optional(),

  orderId: objectId,

  rating: z
    .number()
    .int()
    .min(1)
    .max(5),

  title: z
    .string()
    .trim()
    .max(150)
    .nullable()
    .optional(),

  comment: z
    .string()
    .trim()
    .max(2000)
    .nullable()
    .optional(),
});

const updateReviewSchema = z
  .object({
    rating: z
      .number()
      .int()
      .min(1)
      .max(5)
      .optional(),

    title: z
      .string()
      .trim()
      .max(150)
      .nullable()
      .optional(),

    comment: z
      .string()
      .trim()
      .max(2000)
      .nullable()
      .optional(),
  })
  .refine(
    (data) =>
      data.rating !== undefined ||
      data.title !== undefined ||
      data.comment !== undefined,
    {
      message: "At least one field is required",
    }
  );

const moderateReviewSchema = z.object({
  status: z.enum([
    "approved",
    "rejected",
    "hidden",
  ]),

  moderationReason: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .optional(),
});

const vendorResponseSchema = z.object({
  response: z
    .string()
    .trim()
    .min(1)
    .max(2000),
});

const reviewIdParamsSchema = z.object({
  reviewId: objectId,
});

const productIdParamsSchema = z.object({
  productId: objectId,
});

module.exports = {
  createReviewSchema,
  updateReviewSchema,
  moderateReviewSchema,
  vendorResponseSchema,
  reviewIdParamsSchema,
  productIdParamsSchema,
};