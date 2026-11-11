const mongoose = require("mongoose");

const returnItemSchema = new mongoose.Schema(
  {
    orderItemId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
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
    itemPrice: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    originalUnitPrice: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
    },
    allocatedDiscount: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },
    taxRefund: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },
    shippingRefund: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },
    customerPaidAmount: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
    },
    taxBreakdown: {
      taxRate: { type: mongoose.Schema.Types.Decimal128, default: 0 },
      taxCategory: { type: String, default: null },
      pricingMode: { type: String, default: "tax_exclusive" },
      cgst: { type: mongoose.Schema.Types.Decimal128, default: 0 },
      sgst: { type: mongoose.Schema.Types.Decimal128, default: 0 },
      igst: { type: mongoose.Schema.Types.Decimal128, default: 0 },
    },
    reason: {
      type: String,
      required: true,
      enum: [
        "damaged_item",
        "defective_product",
        "wrong_item",
        "missing_parts",
        "not_as_described",
        "quality_issue",
        "size_fit_issue",
        "changed_mind",
        "other",
        // Backward compatibility & legacy aliases
        "defective",
        "damaged_packaging",
        "buyer_remorse",
      ],
    },
    customerComments: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },
    condition: {
      type: String,
      enum: ["unopened", "opened_unused", "defective_in_box", "damaged", "missing_parts"],
      default: "unopened",
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      default: null,
    },
    images: [
      {
        url: { type: String, required: true },
        publicId: { type: String, default: null },
        caption: { type: String, default: null },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    restocked: {
      type: Boolean,
      default: false,
    },
    restockedAt: {
      type: Date,
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
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      default: null,
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
        "picked_up",
        "received",
        "inspected",
        "refund_pending",
        "refunded",
        "replacement_fulfillment",
        "replacement_shipped",
        "exchange_completed",
        "exchange_fulfilled",
        "cancelled",
      ],
      default: "requested",
      index: true,
    },
    items: [returnItemSchema],
    images: [
      {
        url: { type: String, required: true },
        publicId: { type: String, default: null },
        caption: { type: String, default: null },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    replacementVariantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      default: null,
    },
    exchangePriceDiffMinor: {
      type: Number,
      default: 0,
    },
    replacementOrder: {
      orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
        default: null,
      },
      orderNumber: { type: String, default: null },
      replacementVariantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ProductVariant",
        default: null,
      },
      sku: { type: String, default: null },
      name: { type: String, default: null },
      shipmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Shipment",
        default: null,
      },
      trackingNumber: { type: String, default: null },
      expectedDeliveryDate: { type: Date, default: null },
      status: { type: String, default: null },
    },
    pickupAddress: {
      fullName: { type: String, default: null, trim: true },
      phone: { type: String, default: null, trim: true },
      addressLine1: { type: String, default: null, trim: true },
      addressLine2: { type: String, default: null, trim: true },
      city: { type: String, default: null, trim: true },
      state: { type: String, default: null, trim: true },
      postalCode: { type: String, default: null, trim: true },
      country: { type: String, default: "IN", trim: true },
    },
    refundMethod: {
      type: String,
      enum: ["original_source", "bank_transfer", "upi"],
      default: "original_source",
    },
    bankDetails: {
      accountNumberMasked: { type: String, default: null },
      accountNumberEncrypted: { type: String, default: null },
      ifscCode: { type: String, default: null, trim: true, uppercase: true },
      accountHolderName: { type: String, default: null, trim: true },
      upiId: { type: String, default: null, trim: true },
      isVerified: { type: Boolean, default: false },
    },
    reversePickupSchedule: {
      pickupToken: { type: String, default: null, trim: true },
      scheduledDate: { type: Date, default: null },
      timeSlot: { type: String, default: null, trim: true },
      carrier: { type: String, default: "Delhivery", trim: true },
      awbNumber: { type: String, default: null, trim: true },
      trackingNumber: { type: String, default: null, trim: true },
      trackingUrl: { type: String, default: null, trim: true },
      status: {
        type: String,
        enum: ["unassigned", "scheduled", "completed", "failed", "cancelled"],
        default: "unassigned",
      },
      notes: { type: String, default: null },
      scheduledAt: { type: Date, default: null },
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    eligibilityDeadline: {
      type: Date,
      default: null,
    },
    reviewTargetDeadline: {
      type: Date,
      default: null,
    },
    refundEligibleAt: {
      type: Date,
      default: null,
    },
    refundTargetDeadline: {
      type: Date,
      default: null,
    },
    customerNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },
    customerComments: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },
    reason: {
      type: String,
      trim: true,
      default: null,
    },
    refundAmount: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
    },
    taxRefundTotal: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },
    shippingRefundTotal: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },
    customerDeductionsTotal: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },
    previouslyRefundedTotal: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },
    discountDeductedTotal: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },
    netItemRefundTotal: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },
    refundId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Refund",
      default: null,
    },
    gatewayRefundId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    arn: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    refundProcessedAt: {
      type: Date,
      default: null,
    },
    refundApplicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RefundApplication",
      default: null,
      index: true,
    },
    creditNote: {
      creditNoteNumber: { type: String, default: null, trim: true },
      issuedAt: { type: Date, default: null },
      taxableAmount: { type: mongoose.Schema.Types.Decimal128, default: null },
      taxAmount: { type: mongoose.Schema.Types.Decimal128, default: null },
      totalAmount: { type: mongoose.Schema.Types.Decimal128, default: null },
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
    idempotencyKey: {
      type: String,
      default: null,
      trim: true,
      maxlength: 128,
    },
    inspection: {
      inspectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
      },
      inspectedAt: {
        type: Date,
        default: null,
      },
      passed: {
        type: Boolean,
        default: null,
      },
      outcome: {
        type: String,
        default: null,
      },
      status: {
        type: String,
        enum: ["pending", "passed", "failed", "partially_passed"],
        default: "pending",
      },
      receivedCondition: {
        type: String,
        default: null,
      },
      packagingCondition: {
        type: String,
        default: null,
      },
      productCondition: {
        type: String,
        default: null,
      },
      missingAccessories: {
        type: Boolean,
        default: false,
      },
      missingAccessoriesNotes: {
        type: String,
        default: null,
      },
      photos: [
        {
          url: { type: String, required: true },
          publicId: { type: String, default: null },
          caption: { type: String, default: null },
          uploadedAt: { type: Date, default: Date.now },
        },
      ],
      notes: {
        type: String,
        default: null,
      },
      deductionAmount: {
        type: mongoose.Schema.Types.Decimal128,
        default: 0,
      },
      deductionReason: {
        type: String,
        default: null,
      },
      deductionCategory: {
        type: String,
        default: null,
      },
      restocked: {
        type: Boolean,
        default: false,
      },
    },
    merchantInspection: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    timeline: [
      {
        status: { type: String, required: true },
        notes: { type: String, default: null },
        timestamp: { type: Date, default: Date.now },
        actor: {
          actorType: { type: String, default: "system" },
          actorId: { type: mongoose.Schema.Types.ObjectId, default: null },
        },
      },
    ],
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

returnRequestSchema.index(
  {
    customerId: 1,
    idempotencyKey: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: {
        $type: "string",
      },
    },
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
