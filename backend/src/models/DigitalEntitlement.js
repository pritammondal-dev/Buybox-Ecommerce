const mongoose = require("mongoose");

const digitalEntitlementSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },

    orderNumber: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
      index: true,
    },

    orderItemId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    productVariantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      default: null,
      index: true,
    },

    productName: {
      type: String,
      default: "",
      trim: true,
    },

    productTitle: {
      type: String,
      default: "",
      trim: true,
    },

    variantTitle: {
      type: String,
      default: null,
      trim: true,
    },

    sku: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
    },

    asset: {
      id: {
        type: String,
        required: true,
        trim: true,
      },
      name: {
        type: String,
        required: true,
        trim: true,
      },
      fileName: {
        type: String,
        default: null,
        trim: true,
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
    },

    downloadLimit: {
      type: Number,
      default: null,
      min: 0,
    },

    downloadCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },

    status: {
      type: String,
      enum: ["active", "expired", "exhausted", "revoked"],
      default: "active",
      index: true,
    },

    revocationReason: {
      type: String,
      default: null,
      trim: true,
    },

    revokedAt: {
      type: Date,
      default: null,
    },

    revokedBy: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    downloadLogs: [
      {
        downloadedAt: {
          type: Date,
          default: Date.now,
        },
        ip: {
          type: String,
          default: null,
        },
        ipAddress: {
          type: String,
          default: null,
        },
        userAgent: {
          type: String,
          default: null,
        },
        bytesTransferred: {
          type: Number,
          default: 0,
        },
        status: {
          type: String,
          default: "completed",
        },
        success: {
          type: Boolean,
          default: true,
        },
      },
    ],
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Prevent duplicate entitlements for the same asset within an order
digitalEntitlementSchema.index(
  {
    orderId: 1,
    productId: 1,
    productVariantId: 1,
    "asset.id": 1,
  },
  { unique: true }
);

digitalEntitlementSchema.index({ customerId: 1, status: 1 });
digitalEntitlementSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model("DigitalEntitlement", digitalEntitlementSchema);
