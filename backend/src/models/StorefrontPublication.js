const mongoose = require("mongoose");

const storefrontPublicationSchema = new mongoose.Schema(
  {
    resourceType: {
      type: String,
      enum: [
        "page",
        "banner",
        "menu",
        "settings",
        "seo",
        "redirect",
        "content_block",
        "homepage",
        "section",
        "announcement_bar",
        "media",
      ],
      required: true,
      index: true,
    },

    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
      index: true,
    },

    publishedAt: {
      type: Date,
      default: null,
      index: true,
    },

    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    previewToken: {
      type: String,
      unique: true,
      sparse: true,
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

storefrontPublicationSchema.index({
  resourceType: 1,
  resourceId: 1,
});

storefrontPublicationSchema.index({
  status: 1,
  publishedAt: -1,
});

module.exports = mongoose.model(
  "StorefrontPublication",
  storefrontPublicationSchema
);