const mongoose = require("mongoose");
const {
  ALLOWED_TAX_CATEGORIES,
  DEFAULT_TAX_CATEGORY,
} = require("../constants/tax.constants");

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

    productType: {
      type: String,
      enum: ["simple", "variable"],
      default: "simple",
      index: true,
    },

    defaultVariantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      default: null,
      index: true,
    },

    sku: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      default: null,
    },

    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
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

    isTaxable: {
      type: Boolean,
      default: true,
      required: true,
    },

    taxCategory: {
      type: String,
      enum: ALLOWED_TAX_CATEGORIES,
      default: DEFAULT_TAX_CATEGORY,
      required: true,
    },

    stockStatus: {
      type: String,
      enum: ["in_stock", "out_of_stock", "preorder"],
      default: "out_of_stock",
      index: true,
    },

    status: {
      type: String,
      enum: [
        "draft",
        "pending_approval",
        "active",
        "rejected",
        "inactive",
        "archived",
      ],
      default: "draft",
      index: true,
    },

    submittedAt: {
      type: Date,
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    rejectedAt: {
      type: Date,
      default: null,
    },

    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    rejectionReason: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500,
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

    dimensions: {
      length: {
        type: Number,
        default: null,
        min: 0,
      },
      width: {
        type: Number,
        default: null,
        min: 0,
      },
      height: {
        type: Number,
        default: null,
        min: 0,
      },
      unit: {
        type: String,
        enum: ["cm", "in", "m", "mm"],
        default: "cm",
      },
    },

    weight: {
      value: {
        type: Number,
        default: null,
        min: 0,
      },
      unit: {
        type: String,
        enum: ["g", "kg", "lb", "oz"],
        default: "kg",
      },
    },

    shippingClass: {
      type: String,
      default: null,
      trim: true,
      maxlength: 100,
    },

    isVirtual: {
      type: Boolean,
      default: false,
      index: true,
    },

    isDownloadable: {
      type: Boolean,
      default: false,
      index: true,
    },

    isStoreVisible: {
      type: Boolean,
      default: true,
      index: true,
    },

    downloadableFiles: [
      {
        id: {
          type: String,
          required: true,
          default: () => new mongoose.Types.ObjectId().toString(),
        },
        name: {
          type: String,
          required: true,
          trim: true,
          maxlength: 200,
        },
        fileKey: {
          type: String,
          default: null,
          trim: true,
        },
        storageKey: {
          type: String,
          default: null,
          trim: true,
        },
        fileUrl: {
          type: String,
          default: null,
          trim: true,
        },
        fileSize: {
          type: Number,
          default: 0,
          min: 0,
        },
        mimeType: {
          type: String,
          default: "application/octet-stream",
          trim: true,
        },
        version: {
          type: String,
          default: "1.0",
          trim: true,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    downloadLimit: {
      type: Number,
      default: null,
      min: 0,
    },

    downloadExpiryDays: {
      type: Number,
      default: null,
      min: 0,
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
  },
);

productSchema.index(
  { sku: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
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

productSchema.index({
  status: 1,
  deletedAt: 1,
  createdAt: -1,
});

module.exports = mongoose.model("Product", productSchema);
