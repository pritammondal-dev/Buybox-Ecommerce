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
        "carousel",
        "grid",
        "category_showcase",
        "brand_showcase",
        "mixed_collection",
        "promotional_banner",
        "flash_deal",
        "flash_sale",
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

    selectionMode: {
      type: String,
      enum: ["manual", "automatic", "hybrid"],
      default: "manual",
      index: true,
    },

    rankingMetric: {
      type: String,
      enum: ["units_sold", "revenue"],
      default: "units_sold",
    },

    lookbackDays: {
      type: Number,
      min: 1,
      max: 365,
      default: 30,
    },

    productIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],

    pinnedProductIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],

    excludedProductIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],

    automaticRules: {
      categoryIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Category",
        },
      ],
      excludedCategoryIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Category",
        },
      ],
      brandIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Brand",
        },
      ],
      excludedBrandIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Brand",
        },
      ],
      minPrice: { type: Number, min: 0, default: null },
      maxPrice: { type: Number, min: 0, default: null },
      inStockOnly: { type: Boolean, default: false },
      hasDiscountOnly: { type: Boolean, default: false },
      minDiscountPercent: { type: Number, min: 0, max: 100, default: null },
      sortBy: {
        type: String,
        enum: [
          "newest",
          "price_asc",
          "price_desc",
          "sales",
          "discount_desc",
          "rating_desc",
        ],
        default: "newest",
      },
      maxPerBrand: { type: Number, min: 1, max: 50, default: null },
      maxPerCategory: { type: Number, min: 1, max: 50, default: null },
      fallbackStrategy: {
        type: String,
        enum: ["featured", "newest", "none"],
        default: "featured",
      },
    },

    groups: [
      {
        id: { type: String, required: true },
        title: { type: String, required: true, trim: true, maxlength: 200 },
        subtitle: { type: String, trim: true, maxlength: 500, default: null },
        type: {
          type: String,
          enum: ["category", "brand", "custom"],
          default: "category",
        },
        categoryId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Category",
          default: null,
        },
        subcategoryId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Category",
          default: null,
        },
        brandId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Brand",
          default: null,
        },
        logoUrl: { type: String, trim: true, default: null },
        selectionMode: {
          type: String,
          enum: ["manual", "automatic", "hybrid"],
          default: "automatic",
        },
        productIds: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
          },
        ],
        pinnedProductIds: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
          },
        ],
        excludedProductIds: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
          },
        ],
        automaticRules: {
          categoryIds: [
            {
              type: mongoose.Schema.Types.ObjectId,
              ref: "Category",
            },
          ],
          excludedCategoryIds: [
            {
              type: mongoose.Schema.Types.ObjectId,
              ref: "Category",
            },
          ],
          brandIds: [
            {
              type: mongoose.Schema.Types.ObjectId,
              ref: "Brand",
            },
          ],
          excludedBrandIds: [
            {
              type: mongoose.Schema.Types.ObjectId,
              ref: "Brand",
            },
          ],
          minPrice: { type: Number, min: 0, default: null },
          maxPrice: { type: Number, min: 0, default: null },
          inStockOnly: { type: Boolean, default: false },
          hasDiscountOnly: { type: Boolean, default: false },
          minDiscountPercent: { type: Number, min: 0, max: 100, default: null },
          sortBy: {
            type: String,
            enum: [
              "newest",
              "price_asc",
              "price_desc",
              "sales",
              "discount_desc",
              "rating_desc",
            ],
            default: "newest",
          },
          maxPerBrand: { type: Number, min: 1, max: 50, default: null },
          maxPerCategory: { type: Number, min: 1, max: 50, default: null },
          fallbackStrategy: {
            type: String,
            enum: ["featured", "newest", "none"],
            default: "featured",
          },
        },
        limit: { type: Number, min: 1, max: 100, default: 8 },
        listingLimit: { type: Number, min: 1, max: 100, default: 24 },
        sortBy: { type: String, default: "newest" },
        viewMoreUrl: { type: String, trim: true, default: null },
        theme: {
          backgroundColor: { type: String, trim: true, default: null },
          headingColor: { type: String, trim: true, default: null },
          textColor: { type: String, trim: true, default: null },
          accentColor: { type: String, trim: true, default: null },
          badgeColor: { type: String, trim: true, default: null },
          buttonBgColor: { type: String, trim: true, default: null },
          buttonTextColor: { type: String, trim: true, default: null },
          borderColor: { type: String, trim: true, default: null },
        },
        displayOrder: { type: Number, min: 0, default: 0 },
        isActive: { type: Boolean, default: true },
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

    categoryIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],

    bannerData: {
      imageUrl: { type: String, trim: true, default: null },
      linkUrl: { type: String, trim: true, default: null },
      altText: { type: String, trim: true, default: null },
      headline: { type: String, trim: true, default: null },
      badge: { type: String, trim: true, default: null },
      ctaText: { type: String, trim: true, default: null },
    },

    theme: {
      backgroundColor: { type: String, trim: true, default: null },
      headingColor: { type: String, trim: true, default: null },
      textColor: { type: String, trim: true, default: null },
      accentColor: { type: String, trim: true, default: null },
      badgeColor: { type: String, trim: true, default: null },
      buttonBgColor: { type: String, trim: true, default: null },
      buttonTextColor: { type: String, trim: true, default: null },
      borderColor: { type: String, trim: true, default: null },
    },

    limit: {
      type: Number,
      min: 1,
      max: 100,
      default: 12,
    },

    listingLimit: {
      type: Number,
      min: 1,
      max: 100,
      default: 24,
    },

    viewMoreEnabled: {
      type: Boolean,
      default: true,
    },

    viewMoreUrl: {
      type: String,
      trim: true,
      default: null,
    },

    viewMoreTitle: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "View All",
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

    publicationStatus: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "published",
      index: true,
    },

    startsAt: {
      type: Date,
      default: null,
    },

    endsAt: {
      type: Date,
      default: null,
    },

    isSystem: {
      type: Boolean,
      default: false,
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