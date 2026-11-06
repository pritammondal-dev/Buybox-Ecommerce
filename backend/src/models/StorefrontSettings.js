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

    logoDimensions: {
      desktopWidth: {
        type: Number,
        default: 160,
        min: 40,
        max: 400,
      },
      desktopMaxHeight: {
        type: Number,
        default: 48,
        min: 20,
        max: 120,
      },
      mobileWidth: {
        type: Number,
        default: 120,
        min: 30,
        max: 250,
      },
      mobileMaxHeight: {
        type: Number,
        default: 36,
        min: 16,
        max: 80,
      },
      footerMaxHeight: {
        type: Number,
        default: 40,
        min: 16,
        max: 100,
      },
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

    tagline: {
      type: String,
      trim: true,
      default: "High-Performance Audio, Tech & Peripherals",
    },

    timezone: {
      type: String,
      trim: true,
      default: "Asia/Kolkata",
    },

    language: {
      type: String,
      trim: true,
      default: "en",
    },

    maintenanceMode: {
      type: Boolean,
      default: false,
    },

    featureFlags: {
      coupons: { type: Boolean, default: true },
      flashSale: { type: Boolean, default: true },
      vendorRegistration: { type: Boolean, default: true },
      vendorApprovalRequired: { type: Boolean, default: true },
      productApprovalRequired: { type: Boolean, default: true },
      reviews: { type: Boolean, default: true },
      wishlist: { type: Boolean, default: true },
      compare: { type: Boolean, default: true },
      guestCheckout: { type: Boolean, default: false },
      customerRegistration: { type: Boolean, default: true },
      returns: { type: Boolean, default: true },
      giftCards: { type: Boolean, default: true },
    },

    policies: {
      returnWindowDays: { type: Number, default: 7 },
      refundWindowDays: { type: Number, default: 7 },
      minOrderValue: { type: Number, default: 0 },
      freeShippingThreshold: { type: Number, default: 999 },
      defaultTaxRate: { type: Number, default: 18 },
      lowStockThreshold: { type: Number, default: 5 },
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
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