const mongoose = require("mongoose");

const couponRedemptionSchema = new mongoose.Schema(
  {
    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      required: true,
      index: true,
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
      index: true,
    },

    redemptionCount: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    redeemedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Index for fast lookup of customer redemptions per coupon.
// Per-customer limit is enforced atomically by the service.
couponRedemptionSchema.index({ couponId: 1, customerId: 1 });

const CouponRedemption = mongoose.model(
  "CouponRedemption",
  couponRedemptionSchema
);

module.exports = CouponRedemption;
module.exports.CouponRedemption = CouponRedemption;