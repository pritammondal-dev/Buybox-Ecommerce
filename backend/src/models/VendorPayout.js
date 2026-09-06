const mongoose = require("mongoose");

const {
  PAYMENT_GATEWAYS,
} = require("../constants/payment.constants");

const VENDOR_PAYOUT_STATUSES = Object.freeze({
  PENDING: "pending",
  PROCESSING: "processing",
  PAID: "paid",
  FAILED: "failed",
  CANCELLED: "cancelled",
});

const vendorPayoutSchema = new mongoose.Schema(
  {
    settlementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VendorSettlement",
      required: true,
    },

    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },

    payoutNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    provider: {
      type: String,
      required: true,
      enum: Object.values(PAYMENT_GATEWAYS),
      default: PAYMENT_GATEWAYS.RAZORPAY,
    },

    providerReference: {
      type: String,
      trim: true,
      default: null,
    },

    amount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
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
      enum: Object.values(VENDOR_PAYOUT_STATUSES),
      default: VENDOR_PAYOUT_STATUSES.PENDING,
      index: true,
    },

    idempotencyKey: {
      type: String,
      trim: true,
      default: null,
    },

    failureReason: {
      type: String,
      trim: true,
      default: null,
    },

    retryCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    processedAt: {
      type: Date,
      default: null,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    metadata: {
      type: Map,
      of: String,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

vendorPayoutSchema.index(
  { vendorId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: {
        $type: "string",
      },
    },
  }
);

// One payout is allowed per settlement.
vendorPayoutSchema.index(
  { settlementId: 1 },
  {
    unique: true,
  }
);

vendorPayoutSchema.pre("validate", function validatePayout() {
  if (this.amount !== undefined && this.amount !== null) {
    const amount = Number(this.amount.toString());

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Payout amount must be greater than zero");
    }
  }

  if (!/^[A-Z]{3}$/.test(this.currency)) {
    throw new Error("Currency must be a valid 3-letter uppercase code");
  }
});

const VendorPayout = mongoose.model(
  "VendorPayout",
  vendorPayoutSchema
);

module.exports = VendorPayout;
module.exports.VendorPayout = VendorPayout;
module.exports.VENDOR_PAYOUT_STATUSES = VENDOR_PAYOUT_STATUSES;