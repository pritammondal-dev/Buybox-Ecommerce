const mongoose = require("mongoose");

const transferItemSchema = new mongoose.Schema(
  {
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
    requestedQuantity: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Requested quantity must be a positive integer",
      },
    },
    dispatchedQuantity: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Dispatched quantity must be a non-negative integer",
      },
    },
    receivedQuantity: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Received quantity must be a non-negative integer",
      },
    },
    rejectedQuantity: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Rejected quantity must be a non-negative integer",
      },
    },
    discrepancyQuantity: {
      type: Number,
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: "Discrepancy quantity must be an integer",
      },
    },
    discrepancyReason: {
      type: String,
      default: null,
      trim: true,
      maxlength: 200,
    },
  },
  { _id: true }
);

const stockTransferSchema = new mongoose.Schema(
  {
    transferNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 50,
      index: true,
    },

    sourceWarehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
      index: true,
    },

    destinationWarehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
      index: true,
    },

    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      default: null,
      index: true,
    },

    status: {
      type: String,
      enum: [
        "draft",
        "pending",
        "approved",
        "dispatched",
        "in_transit",
        "partially_received",
        "received",
        "rejected",
        "cancelled",
      ],
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
      type: [transferItemSchema],
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: "Stock transfer must contain at least one item",
      },
    },

    trackingReference: {
      type: String,
      default: null,
      trim: true,
      maxlength: 100,
    },

    carrierName: {
      type: String,
      default: null,
      trim: true,
      maxlength: 100,
    },

    notes: {
      type: String,
      default: null,
      trim: true,
      maxlength: 1000,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    dispatchedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    dispatchedAt: {
      type: Date,
      default: null,
    },

    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    receivedAt: {
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

stockTransferSchema.virtual("trackingNumber")
  .get(function () {
    return this.trackingReference;
  })
  .set(function (val) {
    this.trackingReference = val;
  });

stockTransferSchema.virtual("requestedByUserId", {
  ref: "User",
  localField: "createdBy",
  foreignField: "_id",
  justOne: true,
});

stockTransferSchema.index({ sourceWarehouseId: 1, status: 1 });
stockTransferSchema.index({ destinationWarehouseId: 1, status: 1 });
stockTransferSchema.index({ status: 1, createdAt: -1 });
stockTransferSchema.index({ vendorId: 1, status: 1, createdAt: -1 });
stockTransferSchema.index({ vendorId: 1, status: 1, dispatchedAt: -1 });

module.exports = mongoose.model("StockTransfer", stockTransferSchema);
