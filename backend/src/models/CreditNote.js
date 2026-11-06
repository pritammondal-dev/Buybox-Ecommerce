const mongoose = require("mongoose");

const creditNoteItemSchema = new mongoose.Schema(
  {
    orderItemId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
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
    unitPrice: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    customerPaidAmount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    taxRefund: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },
  },
  { _id: false }
);

const creditNoteSchema = new mongoose.Schema(
  {
    creditNoteNumber: {
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
    returnRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReturnRequest",
      required: false,
      default: null,
      index: true,
    },
    returnNumber: {
      type: String,
      required: false,
      default: null,
      trim: true,
      index: true,
    },
    shipmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shipment",
      default: null,
      index: true,
    },
    shipmentNumber: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    refundId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Refund",
      default: null,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      default: null,
      index: true,
    },
    currency: {
      type: String,
      default: "INR",
      uppercase: true,
    },
    taxableAmount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    taxAmount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    totalAmount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    taxBreakdown: {
      cgst: { type: mongoose.Schema.Types.Decimal128, default: 0 },
      sgst: { type: mongoose.Schema.Types.Decimal128, default: 0 },
      igst: { type: mongoose.Schema.Types.Decimal128, default: 0 },
      pricingMode: { type: String, default: "tax_exclusive" },
      taxRate: { type: mongoose.Schema.Types.Decimal128, default: 0 },
    },
    items: [creditNoteItemSchema],
    reason: {
      type: String,
      default: "Customer return & refund",
      trim: true,
    },
    status: {
      type: String,
      enum: ["issued", "cancelled"],
      default: "issued",
      index: true,
    },
    issuedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

creditNoteSchema.index({ orderId: 1, returnRequestId: 1 });
creditNoteSchema.index({ vendorId: 1, issuedAt: -1 });

module.exports = mongoose.model("CreditNote", creditNoteSchema);

