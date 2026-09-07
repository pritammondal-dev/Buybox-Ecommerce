const mongoose = require("mongoose");

const storefrontSectionSchema = new mongoose.Schema(
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
        "featured_products",
        "new_arrivals",
        "best_sellers",
        "products",
        "collection",
        "category",
      ],
      required: true,
      index: true,
    },

    subtitle: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },

    productIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],

    collectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductCollection",
      default: null,
    },

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },

    limit: {
      type: Number,
      min: 1,
      max: 100,
      default: 12,
    },

    displayOrder: {
      type: Number,
      min: 0,
      default: 0,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
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

storefrontSectionSchema.index({
  isActive: 1,
  displayOrder: 1,
});

storefrontSectionSchema.index({
  type: 1,
  isActive: 1,
  displayOrder: 1,
});

module.exports = mongoose.model(
  "StorefrontSection",
  storefrontSectionSchema
);