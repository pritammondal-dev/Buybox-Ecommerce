const mongoose = require("mongoose");

const returnItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productVariantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      default: null,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    itemPrice: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      enum: [
        "defective",
        "wrong_item",
        "not_as_described",
        "damaged_packaging",
        "size_fit_issue",
        "changed_mind",
        "other",
      ],
    },
    condition: {
      type: String,
      enum: ["unopened", "opened_unused", "defective_in_box", "damaged"],
      default: "unopened",
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      default: null,
    },
  },
  { _id: false }
);

const returnRequestSchema = new mongoose.Schema(
  {
    returnNumber: {
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
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    vendorIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Vendor",
        index: true,
      },
    ],
    type: {
      type: String,
      enum: ["return", "exchange"],
      default: "return",
      required: true,
    },
    status: {
      type: String,
      enum: [
        "requested",
        "under_review",
        "approved",
        "rejected",
        "pickup_scheduled",
        "received",
        "inspected",
        "refund_pending",
        "refunded",
        "exchange_fulfilled",
        "cancelled",
      ],
      default: "requested",
      index: true,
    },
    items: [returnItemSchema],
    replacementVariantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      default: null,
    },
    customerNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
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
    resolutionNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },
    restockedAt: {
      type: Date,
      default: null,
    },
    restockedWarehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      default: null,
    },
    timeline: [
      {
        status: { type: String, required: true },
        notes: { type: String, default: null },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

returnRequestSchema.index({
  vendorIds: 1,
  status: 1,
  createdAt: -1,
});

returnRequestSchema.index({
  customerId: 1,
  createdAt: -1,
});

returnRequestSchema.index({
  orderId: 1,
  createdAt: -1,
});

module.exports = mongoose.model("ReturnRequest", returnRequestSchema);
