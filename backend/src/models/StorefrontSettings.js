const mongoose = require("mongoose");

const storefrontSettingsSchema = new mongoose.Schema(
  {
    storeName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    logoUrl: {
      type: String,
      trim: true,
      default: null,
    },

    faviconUrl: {
      type: String,
      trim: true,
      default: null,
    },

    theme: {
      primaryColor: {
        type: String,
        trim: true,
        default: "#000000",
      },

      secondaryColor: {
        type: String,
        trim: true,
        default: "#ffffff",
      },
    },

    contact: {
      email: {
        type: String,
        trim: true,
        lowercase: true,
        default: null,
      },

      phone: {
        type: String,
        trim: true,
        default: null,
      },

      address: {
        type: String,
        trim: true,
        maxlength: 500,
        default: null,
      },
    },

    socialLinks: {
      facebook: {
        type: String,
        trim: true,
        default: null,
      },

      instagram: {
        type: String,
        trim: true,
        default: null,
      },

      twitter: {
        type: String,
        trim: true,
        default: null,
      },

      youtube: {
        type: String,
        trim: true,
        default: null,
      },

      linkedin: {
        type: String,
        trim: true,
        default: null,
      },
    },

    currency: {
      code: {
        type: String,
        trim: true,
        uppercase: true,
        default: "INR",
      },

      symbol: {
        type: String,
        trim: true,
        default: "₹",
      },
    },

    isActive: {
      type: Boolean,
      default: true,
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

module.exports = mongoose.model(
  "StorefrontSettings",
  storefrontSettingsSchema
);