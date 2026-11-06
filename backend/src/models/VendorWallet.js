const mongoose = require("mongoose");
const { Schema } = mongoose;

const {
  WALLET_STATUSES,
} = require("../constants/finance.constants");

const zeroDecimal = () => mongoose.Types.Decimal128.fromString("0.00");

const vendorWalletSchema = new Schema(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },

    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
      default: "INR",
    },

    status: {
      type: String,
      enum: Object.values(WALLET_STATUSES),
      default: WALLET_STATUSES.ACTIVE,
      required: true,
      index: true,
    },

    // Cached balance projections (authoritative source remains the immutable double-entry ledger)
    pendingBalance: {
      type: Schema.Types.Decimal128,
      default: zeroDecimal,
      required: true,
    },

    availableBalance: {
      type: Schema.Types.Decimal128,
      default: zeroDecimal,
      required: true,
    },

    reservedBalance: {
      type: Schema.Types.Decimal128,
      default: zeroDecimal,
      required: true,
    },

    totalEarned: {
      type: Schema.Types.Decimal128,
      default: zeroDecimal,
      required: true,
    },

    totalCommission: {
      type: Schema.Types.Decimal128,
      default: zeroDecimal,
      required: true,
    },

    totalPaidOut: {
      type: Schema.Types.Decimal128,
      default: zeroDecimal,
      required: true,
    },

    totalRefunded: {
      type: Schema.Types.Decimal128,
      default: zeroDecimal,
      required: true,
    },

    lastSequence: {
      type: Number,
      default: 0,
    },

    lastReconciledAt: {
      type: Date,
      default: null,
    },

    lastReconciliationStatus: {
      type: String,
      enum: ["reconciled", "discrepancy", "pending"],
      default: "pending",
    },

    reconciliationNotes: {
      type: String,
      default: null,
      maxlength: 1000,
    },

    metadata: {
      type: Map,
      of: String,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

vendorWalletSchema.index(
  { vendorId: 1, currency: 1 },
  { unique: true }
);

vendorWalletSchema.pre("validate", function validateWallet() {
  if (!/^[A-Z]{3}$/.test(this.currency)) {
    throw new Error("Wallet currency must be a valid 3-letter ISO code");
  }
});

const VendorWallet = mongoose.model("VendorWallet", vendorWalletSchema);

module.exports = VendorWallet;
module.exports.VendorWallet = VendorWallet;

