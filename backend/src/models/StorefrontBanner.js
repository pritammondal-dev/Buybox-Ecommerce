const mongoose = require("mongoose");

const ALLOWED_BANNER_SLOTS = [
  "hero_main",
  "hero_audio",
  "hero_smart_home",
  "hero_brand_deals",
  "mid_work_smarter",
  "mid_stylish_looks",
  "category_audio",
  "category_workspace",
  "category_smart_living",
  "bottom_home_kitchen",
  "bottom_smart_gadgets",
  "bottom_monsoon_special",
];

const storefrontBannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    slotKey: {
      type: String,
      enum: ALLOWED_BANNER_SLOTS,
      default: null,
      index: true,
    },

    altText: {
      type: String,
      trim: true,
      default: null,
    },

    imageUrl: {
      type: String,
      required: true,
      trim: true,
    },

    mobileImageUrl: {
      type: String,
      trim: true,
      default: null,
    },

    linkUrl: {
      type: String,
      trim: true,
      default: null,
    },

    displayOrder: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    startsAt: {
      type: Date,
      default: null,
      index: true,
    },

    endsAt: {
      type: Date,
      default: null,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

storefrontBannerSchema.virtual("placement").get(function () {
  return this.slotKey;
}).set(function (val) {
  this.slotKey = val;
});

storefrontBannerSchema.index({
  isActive: 1,
  displayOrder: 1,
});

storefrontBannerSchema.index({
  isActive: 1,
  startsAt: 1,
  endsAt: 1,
});

storefrontBannerSchema.index({
  slotKey: 1,
  isActive: 1,
});

storefrontBannerSchema.pre("validate", function () {
  if (
    this.startsAt &&
    this.endsAt &&
    this.startsAt >= this.endsAt
  ) {
    throw new Error(
      "Banner start time must be before end time"
    );
  }
});

module.exports = mongoose.model(
  "StorefrontBanner",
  storefrontBannerSchema
);