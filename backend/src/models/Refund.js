const mongoose = require("mongoose");

const refundSchema = new mongoose.Schema(
  {
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
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

    gateway: {
      type: String,
      required: true,
      enum: ["razorpay"],
      default: "razorpay",
      index: true,
    },

    gatewayRefundId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },

    amount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      min: 0.01,
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
      required: true,
      enum: [
        "created",
        "pending",
        "processed",
        "failed",
        "cancelled",
      ],
      default: "created",
      index: true,
    },

    reason: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500,
    },

    failureReason: {
      type: String,
      default: null,
      trim: true,
      maxlength: 1000,
    },

    idempotencyKey: {
      type: String,
      default: null,
      trim: true,
      minlength: 8,
      maxlength: 128,
    },

    metadata: {
      type: Map,
      of: String,
      default: {},
    },

    processedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Prevent duplicate refund requests when the same
// idempotency key is used for the same gateway.
refundSchema.index(
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

// A Razorpay refund ID must identify only one local refund.
refundSchema.index(
  {
    gateway: 1,
    gatewayRefundId: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      gatewayRefundId: {
        $type: "string",
      },
    },
  }
);

// Useful for refund history and reconciliation.
refundSchema.index({
  paymentId: 1,
  status: 1,
  createdAt: -1,
});

refundSchema.index({
  orderId: 1,
  status: 1,
  createdAt: -1,
});

module.exports = mongoose.model("Refund", refundSchema);
