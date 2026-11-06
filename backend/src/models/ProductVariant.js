const mongoose = require("mongoose");

const productVariantSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },

    sku: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },

    name: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },

    attributes: {
      type: Map,
      of: String,
      default: {},
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

    costPrice: {
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

    barcode: {
      type: String,
      default: null,
      trim: true,
      maxlength: 100,
    },

    /**
     * @deprecated Deprecated in Phase 2B. The warehouse Inventory collection is the sole
     * authoritative source of physical stock. Do not trust this field for cart, checkout,
     * or reservation decisions. Retained temporarily as an aggregate read mirror for
     * backward compatibility with external catalog consumers.
     */
    stockQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    stockStatus: {
      type: String,
      enum: [
        "in_stock",
        "out_of_stock",
        "preorder",
      ],
      default: "out_of_stock",
      index: true,
    },

    image: {
      url: {
        type: String,
        default: null,
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
        default: "g",
      },
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

    isActive: {
      type: Boolean,
      default: true,
      index: true,
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

productVariantSchema.index(
  { sku: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);

productVariantSchema.index({
  productId: 1,
  isActive: 1,
  deletedAt: 1,
});

productVariantSchema.index({
  productId: 1,
  stockStatus: 1,
});

productVariantSchema.index(
  { barcode: 1 },
  { unique: true, partialFilterExpression: { barcode: { $type: "string" }, deletedAt: null } }
);

module.exports = mongoose.model(
  "ProductVariant",
  productVariantSchema
);
