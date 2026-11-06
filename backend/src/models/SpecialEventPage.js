const mongoose = require("mongoose");
const crypto = require("crypto");

const EVENT_SECTION_TYPES = [
  "hero_banner",
  "banner_slider",
  "promo_banner",
  "ad_banner",
  "category_grid",
  "product_collection",
  "category_products",
  "brand_showcase",
  "deals_collection",
  "countdown",
  "rich_text",
];

const eventSectionSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: EVENT_SECTION_TYPES,
      required: true,
    },
    title: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },
    subtitle: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    displayOrder: {
      type: Number,
      min: 0,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    config: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  { _id: false }
);

const specialEventPageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 200,
      index: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },

    badge: {
      type: String,
      trim: true,
      maxlength: 60,
      default: "Special Event",
    },

    status: {
      type: String,
      enum: ["draft", "scheduled", "published", "archived"],
      default: "draft",
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

    timezone: {
      type: String,
      trim: true,
      default: "Asia/Kolkata",
    },

    bannerUrl: {
      type: String,
      trim: true,
      default: null,
    },

    mobileBannerUrl: {
      type: String,
      trim: true,
      default: null,
    },

    previewToken: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      default: () => crypto.randomBytes(24).toString("hex"),
    },

    theme: {
      primaryColor: {
        type: String,
        trim: true,
        default: "#004D38",
      },
      accentColor: {
        type: String,
        trim: true,
        default: "#E6A800",
      },
      backgroundGradient: {
        type: String,
        trim: true,
        default: null,
      },
      isDark: {
        type: Boolean,
        default: false,
      },
    },

    sections: {
      type: [eventSectionSchema],
      default: () => [],
    },

    seo: {
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
      keywords: {
        type: [String],
        default: () => [],
      },
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
      default: null,
    },

    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    publishedAt: {
      type: Date,
      default: null,
      index: true,
    },

    archivedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

specialEventPageSchema.index({
  status: 1,
  startsAt: 1,
  endsAt: 1,
});

specialEventPageSchema.pre("validate", function () {
  if (this.startsAt && this.endsAt && this.startsAt >= this.endsAt) {
    throw new Error("Event start time must be before end time");
  }

  if (this.status === "published" && !this.publishedAt) {
    this.publishedAt = new Date();
  }

  if (!this.previewToken) {
    this.previewToken = crypto.randomBytes(24).toString("hex");
  }
});

module.exports = mongoose.model("SpecialEventPage", specialEventPageSchema);
module.exports.EVENT_SECTION_TYPES = EVENT_SECTION_TYPES;
