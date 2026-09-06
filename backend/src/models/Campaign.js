const mongoose = require("mongoose");

const {
  COUPON_SCOPE_TYPES,
} = require("../constants/coupon.constants");

const campaignSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      maxlength: 180,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },

    status: {
      type: String,
      enum: [
        "draft",
        "scheduled",
        "active",
        "paused",
        "completed",
        "cancelled",
      ],
      default: "draft",
      index: true,
    },

    startsAt: {
      type: Date,
      required: true,
      index: true,
    },

    endsAt: {
      type: Date,
      required: true,
      index: true,
    },

    scope: {
      type: String,
      enum: Object.values(COUPON_SCOPE_TYPES),
      default: COUPON_SCOPE_TYPES.ALL,
      index: true,
    },

    productIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],

    categoryIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],

    vendorIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Vendor",
      },
    ],

    couponIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Coupon",
      },
    ],

    metadata: {
      type: Map,
      of: String,
      default: {},
    },

    isActive: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

campaignSchema.index({
  status: 1,
  startsAt: 1,
  endsAt: 1,
});

campaignSchema.index({
  isActive: 1,
  startsAt: 1,
  endsAt: 1,
});

campaignSchema.pre("validate", function () {
  if (this.endsAt <= this.startsAt) {
    throw new Error("Campaign end date must be after start date");
  }

  if (
    this.scope === COUPON_SCOPE_TYPES.PRODUCTS &&
    this.productIds.length === 0
  ) {
    throw new Error("Product scope requires at least one product");
  }

  if (
    this.scope === COUPON_SCOPE_TYPES.CATEGORIES &&
    this.categoryIds.length === 0
  ) {
    throw new Error("Category scope requires at least one category");
  }

  if (
    this.scope === COUPON_SCOPE_TYPES.VENDORS &&
    this.vendorIds.length === 0
  ) {
    throw new Error("Vendor scope requires at least one vendor");
  }
});

const Campaign = mongoose.model("Campaign", campaignSchema);

module.exports = Campaign;

