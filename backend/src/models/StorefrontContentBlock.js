const mongoose = require("mongoose");

const storefrontContentBlockSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    type: {
      type: String,
      enum: [
        "hero",
        "rich_text",
        "image",
        "banner",
        "product_grid",
        "category_grid",
        "collection",
        "cta",
        "custom",
      ],
      required: true,
      index: true,
    },

    content: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    displayOrder: {
      type: Number,
      default: 0,
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

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

storefrontContentBlockSchema.index({
  isActive: 1,
  displayOrder: 1,
});

storefrontContentBlockSchema.index({
  type: 1,
  isActive: 1,
  displayOrder: 1,
});

module.exports = mongoose.model(
  "StorefrontContentBlock",
  storefrontContentBlockSchema
);