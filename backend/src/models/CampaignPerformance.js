const mongoose = require("mongoose");

const campaignPerformanceSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      index: true,
    },

    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      default: null,
      index: true,
    },

    date: {
      type: Date,
      required: true,
      index: true,
    },

    impressions: {
      type: Number,
      default: 0,
      min: 0,
    },

    redemptions: {
      type: Number,
      default: 0,
      min: 0,
    },

    orders: {
      type: Number,
      default: 0,
      min: 0,
    },

    unitsSold: {
      type: Number,
      default: 0,
      min: 0,
    },

    grossRevenue: {
      type: mongoose.Schema.Types.Decimal128,
      default: "0.00",
    },

    discountAmount: {
      type: mongoose.Schema.Types.Decimal128,
      default: "0.00",
    },

    netRevenue: {
      type: mongoose.Schema.Types.Decimal128,
      default: "0.00",
    },

    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
      default: "INR",
    },

    metadata: {
      type: Map,
      of: String,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

campaignPerformanceSchema.index(
  {
    campaignId: 1,
    couponId: 1,
    date: 1,
    currency: 1,
  },
  {
    unique: true,
  }
);

const CampaignPerformance = mongoose.model(
  "CampaignPerformance",
  campaignPerformanceSchema
);

module.exports = CampaignPerformance;