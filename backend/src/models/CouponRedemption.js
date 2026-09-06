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

// A customer can redeem a coupon only according to the
// per-customer limit enforced by the service.
couponRedemptionSchema.index(
  { couponId: 1, customerId: 1 },
  {
    unique: true,
  }
);

const CouponRedemption = mongoose.model(
  "CouponRedemption",
  couponRedemptionSchema
);

module.exports = CouponRedemption;
module.exports.CouponRedemption = CouponRedemption;