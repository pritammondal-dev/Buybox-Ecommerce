const mongoose = require("mongoose");

const receivingItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productVariantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
    },
    productName: {
      type: String,
      default: "",
      trim: true,
    },
    expectedQuantity: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Expected quantity must be an integer",
      },
    },
    receivedQuantity: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Received quantity must be an integer",
      },
    },
    rejectedQuantity: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Rejected quantity must be an integer",
      },
    },
    rejectionReason: {
      type: String,
      default: null,
      trim: true,
      maxlength: 200,
    },
    binLocationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WarehouseLocation",
      default: null,
    },
    notes: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500,
    },
  },
  { _id: true }
);

const stockReceivingSchema = new mongoose.Schema(
  {
    receivingNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 50,
      index: true,
    },

    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
      index: true,
    },

    supplierName: {
      type: String,
      default: null,
      trim: true,
      maxlength: 200,
    },

    referenceDocNumber: {
      type: String,
      default: null,
      trim: true,
      maxlength: 100,
    },

    status: {
      type: String,
      enum: ["draft", "confirmed", "cancelled"],
      default: "draft",
      index: true,
    },

    idempotencyKey: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },

    items: {
      type: [receivingItemSchema],
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: "Stock receiving must contain at least one item",
      },
    },

    notes: {
      type: String,
      default: null,
      trim: true,
      maxlength: 1000,
    },

    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    confirmedAt: {
      type: Date,
      default: null,
    },

    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    cancellationReason: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

stockReceivingSchema.index({ warehouseId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("StockReceiving", stockReceivingSchema);
