const mongoose = require("mongoose");

const EXCEPTION_REASONS = [
  "out_of_stock",
  "damaged_stock",
  "incorrect_sku_or_variant",
  "cannot_pack_or_ship",
  "warehouse_discrepancy",
  "other",
];

const REQUESTED_RESOLUTIONS = [
  "retry_fulfillment",
  "request_cancellation",
  "request_admin_assistance",
];

const EXCEPTION_STATUSES = [
  "open",
  "under_review",
  "awaiting_vendor",
  "resolved",
  "rejected",
  "withdrawn",
];

const timelineEntrySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
      enum: EXCEPTION_STATUSES,
    },
    actorType: {
      type: String,
      required: true,
      enum: ["vendor", "admin", "system"],
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    actorName: {
      type: String,
      default: "",
      trim: true,
    },
    notes: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2000,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const fulfillmentExceptionSchema = new mongoose.Schema(
  {
    exceptionNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
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
      required: true,
      trim: true,
      index: true,
    },
    orderItemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      enum: EXCEPTION_REASONS,
      index: true,
    },
    explanation: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    requestedResolution: {
      type: String,
      required: true,
      enum: REQUESTED_RESOLUTIONS,
      default: "request_cancellation",
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Quantity must be an integer",
      },
    },
    status: {
      type: String,
      required: true,
      enum: EXCEPTION_STATUSES,
      default: "open",
      index: true,
    },
    // Immutable authoritative snapshot of item at time of report
    itemSnapshot: {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
      productVariantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ProductVariant",
      },
      warehouseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Warehouse",
        default: null,
      },
      sku: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
      },
      productName: {
        type: String,
        required: true,
        trim: true,
      },
      variantName: {
        type: String,
        default: "",
        trim: true,
      },
      originalQuantity: {
        type: Number,
        required: true,
      },
      unitPrice: {
        type: mongoose.Schema.Types.Decimal128,
        required: true,
      },
      lineTotal: {
        type: mongoose.Schema.Types.Decimal128,
        required: true,
      },
      fulfillmentStatus: {
        type: String,
        default: "unfulfilled",
      },
      inventoryStatus: {
        type: String,
        default: "reserved",
      },
    },
    resolutionNotes: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2000,
    },
    cancellationDetails: {
      cancelledAt: {
        type: Date,
        default: null,
      },
      stockReleased: {
        type: Boolean,
        default: false,
      },
      quantityReleased: {
        type: Number,
        default: 0,
      },
      refundIssued: {
        type: Boolean,
        default: false,
      },
      refundAmount: {
        type: mongoose.Schema.Types.Decimal128,
        default: null,
      },
      refundId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Refund",
        default: null,
      },
    },
    timeline: [timelineEntrySchema],
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Compound indexes for performant lookups and deduplication checking
fulfillmentExceptionSchema.index({ orderId: 1, orderItemId: 1, status: 1 });
fulfillmentExceptionSchema.index({ vendorId: 1, status: 1, createdAt: -1 });
fulfillmentExceptionSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("FulfillmentException", fulfillmentExceptionSchema);
module.exports.EXCEPTION_REASONS = EXCEPTION_REASONS;
module.exports.REQUESTED_RESOLUTIONS = REQUESTED_RESOLUTIONS;
module.exports.EXCEPTION_STATUSES = EXCEPTION_STATUSES;
