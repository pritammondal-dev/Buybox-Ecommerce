const mongoose = require("mongoose");

const storefrontMediaSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    type: {
      type: String,
      enum: ["image", "video", "file"],
      required: true,
      index: true,
    },

    url: {
      type: String,
      required: true,
      trim: true,
    },

    storageProvider: {
      type: String,
      enum: ["cloudinary", "s3", "external"],
      default: "external",
      index: true,
    },

    storageKey: {
      type: String,
      trim: true,
      default: null,
    },

    mimeType: {
      type: String,
      trim: true,
      default: null,
    },

    fileSize: {
      type: Number,
      min: 0,
      default: null,
    },

    altText: {
      type: String,
      trim: true,
      maxlength: 300,
      default: null,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
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

storefrontMediaSchema.index({
  isActive: 1,
  type: 1,
  createdAt: -1,
});

storefrontMediaSchema.index({
  storageProvider: 1,
  storageKey: 1,
});

module.exports = mongoose.model(
  "StorefrontMedia",
  storefrontMediaSchema
);