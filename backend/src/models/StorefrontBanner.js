const mongoose = require("mongoose");

const storefrontBannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
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
  }
);

storefrontBannerSchema.index({
  isActive: 1,
  displayOrder: 1,
});

storefrontBannerSchema.index({
  isActive: 1,
  startsAt: 1,
  endsAt: 1,
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