const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
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

    gateway: {
      type: String,
      enum: ["razorpay"],
      required: true,
      default: "razorpay",
      index: true,
    },

    gatewayOrderId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },

    gatewayPaymentId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },

    amount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },

    status: {
      type: String,
      enum: [
        "created",
        "pending",
        "authorized",
        "captured",
        "failed",
        "cancelled",
        "partially_refunded",
        "refunded",
      ],
      required: true,
      default: "created",
      index: true,
    },

    method: {
      type: String,
      enum: [
        "card",
        "netbanking",
        "upi",
        "wallet",
        "emi",
        "bank_transfer",
        "other",
      ],
      default: null,
    },

    receipt: {
      type: String,
      default: null,
      trim: true,
      maxlength: 100,
    },

    failureReason: {
      type: String,
      default: null,
      trim: true,
      maxlength: 1000,
    },

    refundedAmount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      min: 0,
      default: 0,
    },

    capturedAt: {
      type: Date,
      default: null,
    },

    metadata: {
      type: Map,
      of: String,
      default: {},
    },

    idempotencyKey: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

paymentSchema.index({
  orderId: 1,
  createdAt: -1,
});

paymentSchema.index({
  customerId: 1,
  createdAt: -1,
});

paymentSchema.index({
  gateway: 1,
  gatewayOrderId: 1,
});

paymentSchema.index({
  gateway: 1,
  gatewayPaymentId: 1,
});

paymentSchema.index(
  {
    gateway: 1,
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

module.exports = mongoose.model(
  "Payment",
  paymentSchema
);