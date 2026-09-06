const { z } = require("zod");

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

const couponType = z.enum(["percentage", "fixed"]);
const couponStatus = z.enum(["active", "inactive", "expired"]);
const couponScope = z.enum(["all", "products", "categories", "vendors"]);

const createCouponSchema = z.object({
  code: z.string().trim().min(3).max(50).optional(),

  description: z.string().trim().max(500).optional(),

  type: couponType,

  value: z.coerce.number().positive(),

  maxDiscountAmount: z.coerce.number().positive().optional(),

  minOrderAmount: z.coerce.number().min(0).optional(),

  status: couponStatus.optional(),

  startsAt: z.coerce.date(),

  expiresAt: z.coerce.date(),

  scope: couponScope.optional(),

  productIds: z.array(objectId).optional(),

  categoryIds: z.array(objectId).optional(),

  vendorIds: z.array(objectId).optional(),

  usageLimit: z.coerce.number().int().positive().optional(),

  perCustomerLimit: z.coerce.number().int().positive().optional(),

  firstOrderOnly: z.boolean().optional(),

  isActive: z.boolean().optional(),

  metadata: z.record(z.string(), z.string()).optional(),
});

const updateCouponSchema = z.object({
  code: z.string().trim().min(3).max(50).optional(),

  description: z.string().trim().max(500).nullable().optional(),

  type: couponType.optional(),

  value: z.coerce.number().positive().optional(),

  maxDiscountAmount: z.coerce.number().positive().nullable().optional(),

  minOrderAmount: z.coerce.number().min(0).optional(),

  status: couponStatus.optional(),

  startsAt: z.coerce.date().optional(),

  expiresAt: z.coerce.date().optional(),

  scope: couponScope.optional(),

  productIds: z.array(objectId).optional(),

  categoryIds: z.array(objectId).optional(),

  vendorIds: z.array(objectId).optional(),

  usageLimit: z.coerce.number().int().positive().nullable().optional(),

  perCustomerLimit: z.coerce.number().int().positive().optional(),

  firstOrderOnly: z.boolean().optional(),

  isActive: z.boolean().optional(),

  metadata: z.record(z.string(), z.string()).optional(),
});

const validateCouponSchema = z.object({
  code: z.string().trim().min(3).max(50),

  customerId: objectId,

  orderAmount: z.coerce.number().nonnegative(),

  items: z
    .array(
      z.object({
        productId: objectId.optional(),
        categoryId: objectId.optional(),
        vendorId: objectId.optional(),
        lineTotal: z.coerce.number().nonnegative().optional(),
        price: z.coerce.number().nonnegative().optional(),
        quantity: z.coerce.number().int().positive().optional(),
      })
    )
    .min(1),

  isFirstOrder: z.boolean().optional(),
});

module.exports = {
  createCouponSchema,
  updateCouponSchema,
  validateCouponSchema,
};