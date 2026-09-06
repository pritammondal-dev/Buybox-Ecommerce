const { z } = require("zod");

const objectId = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

const redeemCouponSchema = z.object({
  couponId: objectId,
  customerId: objectId,
  orderId: objectId,
});

const getCustomerRedemptionsSchema = z.object({
  customerId: objectId,
});

module.exports = {
  redeemCouponSchema,
  getCustomerRedemptionsSchema,
};