const mongoose = require("mongoose");

const storefrontHomepageSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    blocks: [
      {
        blockId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "StorefrontContentBlock",
          required: true,
        },

        displayOrder: {
          type: Number,
          required: true,
          min: 0,
        },

        isVisible: {
          type: Boolean,
          default: true,
        },
      },
    ],

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

storefrontHomepageSchema.index({
  isActive: 1,
  key: 1,
});

module.exports = mongoose.model(
  "StorefrontHomepage",
  storefrontHomepageSchema
);