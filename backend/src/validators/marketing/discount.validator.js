const { z } = require("zod");
const {
  DISCOUNT_TYPES,
  DISCOUNT_STATUSES,
  DISCOUNT_SCOPES,
  FUNDING_SOURCES,
} = require("../../constants/promotion.constants");

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

const createDiscountSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(200, "Name too long"),
    description: z.string().trim().max(1000).nullable().optional(),
    discountType: z.enum(Object.values(DISCOUNT_TYPES), {
      errorMap: () => ({ message: "Invalid discount type. Must be percentage or fixed_amount" }),
    }),
    value: z.coerce.number().positive("Discount value must be a positive number"),
    scope: z
      .enum(Object.values(DISCOUNT_SCOPES))
      .optional()
      .default(DISCOUNT_SCOPES.ALL),
    productIds: z.array(objectId).optional().default([]),
    variantIds: z.array(objectId).optional().default([]),
    categoryIds: z.array(objectId).optional().default([]),
    brandIds: z.array(objectId).optional().default([]),
    startsAt: z.coerce.date({ invalid_type_error: "Valid startsAt date is required" }),
    endsAt: z.coerce.date({ invalid_type_error: "Valid endsAt date is required" }),
    status: z.enum(Object.values(DISCOUNT_STATUSES)).optional().default(DISCOUNT_STATUSES.ACTIVE),
    priority: z.coerce.number().int().optional().default(0),
    maxDiscountAmount: z.coerce.number().min(0).nullable().optional(),
    minSellingPrice: z.coerce.number().min(0).nullable().optional(),
    fundingSource: z
      .enum(Object.values(FUNDING_SOURCES))
      .optional()
      .default(FUNDING_SOURCES.PLATFORM),
    allowCoupons: z.boolean().optional().default(true),
  })
  .refine((data) => data.endsAt.getTime() > data.startsAt.getTime(), {
    message: "Promotion endsAt must be strictly after startsAt",
    path: ["endsAt"],
  })
  .refine(
    (data) => {
      if (data.discountType === DISCOUNT_TYPES.PERCENTAGE && data.value > 100) {
        return false;
      }
      return true;
    },
    {
      message: "Percentage discount cannot exceed 100%",
      path: ["value"],
    }
  )
  .refine(
    (data) => {
      if (data.scope === DISCOUNT_SCOPES.PRODUCTS && (!data.productIds || data.productIds.length === 0)) {
        return false;
      }
      if (data.scope === DISCOUNT_SCOPES.VARIANTS && (!data.variantIds || data.variantIds.length === 0)) {
        return false;
      }
      if (data.scope === DISCOUNT_SCOPES.CATEGORIES && (!data.categoryIds || data.categoryIds.length === 0)) {
        return false;
      }
      if (data.scope === DISCOUNT_SCOPES.BRANDS && (!data.brandIds || data.brandIds.length === 0)) {
        return false;
      }
      return true;
    },
    {
      message: "At least one target identifier must be provided for the selected scope",
      path: ["scope"],
    }
  );

const updateDiscountSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    discountType: z.enum(Object.values(DISCOUNT_TYPES)).optional(),
    value: z.coerce.number().positive().optional(),
    scope: z.enum(Object.values(DISCOUNT_SCOPES)).optional(),
    productIds: z.array(objectId).optional(),
    variantIds: z.array(objectId).optional(),
    categoryIds: z.array(objectId).optional(),
    brandIds: z.array(objectId).optional(),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().optional(),
    status: z.enum(Object.values(DISCOUNT_STATUSES)).optional(),
    priority: z.coerce.number().int().optional(),
    maxDiscountAmount: z.coerce.number().min(0).nullable().optional(),
    minSellingPrice: z.coerce.number().min(0).nullable().optional(),
    fundingSource: z.enum(Object.values(FUNDING_SOURCES)).optional(),
    allowCoupons: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.startsAt && data.endsAt && data.endsAt.getTime() <= data.startsAt.getTime()) {
        return false;
      }
      return true;
    },
    {
      message: "Promotion endsAt must be strictly after startsAt",
      path: ["endsAt"],
    }
  )
  .refine(
    (data) => {
      if (data.discountType === DISCOUNT_TYPES.PERCENTAGE && data.value !== undefined && data.value > 100) {
        return false;
      }
      return true;
    },
    {
      message: "Percentage discount cannot exceed 100%",
      path: ["value"],
    }
  );

const previewDiscountSchema = z
  .object({
    promotionId: objectId.optional(),
    promotionData: z
      .object({
        name: z.string().optional().default("Preview Promotion"),
        discountType: z.enum(Object.values(DISCOUNT_TYPES)).default(DISCOUNT_TYPES.PERCENTAGE),
        value: z.coerce.number().positive(),
        scope: z.enum(Object.values(DISCOUNT_SCOPES)).optional().default(DISCOUNT_SCOPES.ALL),
        productIds: z.array(objectId).optional().default([]),
        variantIds: z.array(objectId).optional().default([]),
        categoryIds: z.array(objectId).optional().default([]),
        brandIds: z.array(objectId).optional().default([]),
        maxDiscountAmount: z.coerce.number().min(0).nullable().optional(),
        minSellingPrice: z.coerce.number().min(0).nullable().optional(),
        fundingSource: z.enum(Object.values(FUNDING_SOURCES)).optional().default(FUNDING_SOURCES.PLATFORM),
        allowCoupons: z.boolean().optional().default(true),
        priority: z.coerce.number().int().optional().default(0),
        status: z.enum(Object.values(DISCOUNT_STATUSES)).optional().default(DISCOUNT_STATUSES.ACTIVE),
        startsAt: z.coerce.date().optional().default(() => new Date(Date.now() - 60000)),
        endsAt: z.coerce.date().optional().default(() => new Date(Date.now() + 86400000 * 30)),
      })
      .optional(),
    productIds: z.array(objectId).optional().default([]),
    variantIds: z.array(objectId).optional().default([]),
    limit: z.coerce.number().int().min(1).max(50).optional().default(10),
    overrideFloor: z.boolean().optional().default(false),
    overrideReason: z.string().trim().max(500).optional(),
  })
  .refine(
    (data) => {
      if (!data.promotionId && !data.promotionData) {
        return false;
      }
      return true;
    },
    {
      message: "Either promotionId or promotionData must be provided for preview",
      path: ["promotionData"],
    }
  )
  .refine(
    (data) => {
      if (data.overrideFloor && (!data.overrideReason || data.overrideReason.length < 3)) {
        return false;
      }
      return true;
    },
    {
      message: "An explicit overrideReason (at least 3 characters) is required when overrideFloor is enabled",
      path: ["overrideReason"],
    }
  );

const assignProductsSchema = z.object({
  action: z.enum(["add", "remove", "set"]).default("add"),
  productIds: z.array(objectId).optional().default([]),
  variantIds: z.array(objectId).optional().default([]),
  categoryIds: z.array(objectId).optional().default([]),
  brandIds: z.array(objectId).optional().default([]),
});

const transitionStatusSchema = z
  .object({
    reason: z.string().trim().max(500).optional(),
  })
  .optional()
  .default({});

module.exports = {
  createDiscountSchema,
  updateDiscountSchema,
  previewDiscountSchema,
  assignProductsSchema,
  transitionStatusSchema,
};
