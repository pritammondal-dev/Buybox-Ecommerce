const mongoose = require("mongoose");

const storefrontMenuItemSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    linkType: {
      type: String,
      enum: ["internal", "external"],
      default: "internal",
    },

    url: {
      type: String,
      required: true,
      trim: true,
    },

    displayOrder: {
      type: Number,
      default: 0,
      min: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  { _id: true }
);

const storefrontMenuSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    location: {
      type: String,
      enum: ["header", "footer"],
      required: true,
      index: true,
    },

    displayOrder: {
      type: Number,
      default: 0,
      min: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    items: {
      type: [storefrontMenuItemSchema],
      default: [],
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

storefrontMenuSchema.index({
  location: 1,
  displayOrder: 1,
});

module.exports = mongoose.model(
  "StorefrontMenu",
  storefrontMenuSchema
);