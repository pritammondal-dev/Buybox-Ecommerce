const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      index: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    description: {
      type: String,
      default: "",
      maxlength: 10000,
    },

    shortDescription: {
      type: String,
      default: "",
      maxlength: 500,
    },

    sku: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },

    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      default: null,
      index: true,
    },

    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    price: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      min: 0,
    },

    compareAtPrice: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
      min: 0,
    },

    currency: {
      type: String,
      default: "INR",
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },

    stockStatus: {
      type: String,
      enum: ["in_stock", "out_of_stock", "preorder"],
      default: "out_of_stock",
      index: true,
    },

    status: {
      type: String,
      enum: ["draft", "active", "inactive", "archived"],
      default: "draft",
      index: true,
    },

    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },

    images: [
      {
        url: {
          type: String,
          required: true,
        },

        publicId: {
          type: String,
          default: null,
        },

        altText: {
          type: String,
          default: "",
          maxlength: 200,
        },

        sortOrder: {
          type: Number,
          default: 0,
        },
      },
    ],

    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],

    specifications: {
      type: Map,
      of: String,
      default: {},
    },

    seo: {
      title: {
        type: String,
        default: "",
        maxlength: 200,
      },

      description: {
        type: String,
        default: "",
        maxlength: 500,
      },

      keywords: [
        {
          type: String,
          trim: true,
        },
      ],
    },

    ratingAverage: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    ratingCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

productSchema.index({
  name: "text",
  description: "text",
  shortDescription: "text",
  tags: "text",
});

productSchema.index({
  categoryId: 1,
  status: 1,
  deletedAt: 1,
});

productSchema.index({
  vendorId: 1,
  status: 1,
  deletedAt: 1,
});

productSchema.index({
  brandId: 1,
  status: 1,
  deletedAt: 1,
});

module.exports = mongoose.model("Product", productSchema);