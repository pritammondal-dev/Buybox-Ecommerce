const mongoose = require("mongoose");

const storefrontSeoSchema = new mongoose.Schema(
  {
    siteName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    defaultTitle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    defaultDescription: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },

    defaultKeywords: {
      type: [String],
      default: [],
    },

    canonicalUrl: {
      type: String,
      trim: true,
      default: null,
    },

    openGraph: {
      title: {
        type: String,
        trim: true,
        maxlength: 200,
        default: null,
      },

      description: {
        type: String,
        trim: true,
        maxlength: 500,
        default: null,
      },

      imageUrl: {
        type: String,
        trim: true,
        default: null,
      },

      type: {
        type: String,
        trim: true,
        default: "website",
      },
    },

    twitter: {
      card: {
        type: String,
        enum: ["summary", "summary_large_image"],
        default: "summary_large_image",
      },

      title: {
        type: String,
        trim: true,
        maxlength: 200,
        default: null,
      },

      description: {
        type: String,
        trim: true,
        maxlength: 500,
        default: null,
      },

      imageUrl: {
        type: String,
        trim: true,
        default: null,
      },
    },

    robots: {
      index: {
        type: Boolean,
        default: true,
      },

      follow: {
        type: Boolean,
        default: true,
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

storefrontSeoSchema.index({
  isActive: 1,
  updatedAt: -1,
});

module.exports = mongoose.model(
  "StorefrontSeo",
  storefrontSeoSchema
);
