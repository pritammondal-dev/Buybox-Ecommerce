const mongoose = require("mongoose");
const { Schema } = mongoose;

const {
  WITHDRAWAL_STATUSES,
} = require("../constants/finance.constants");

const withdrawalRequestSchema = new Schema(
  {
    withdrawalNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },

    walletId: {
      type: Schema.Types.ObjectId,
      ref: "VendorWallet",
      required: true,
      index: true,
    },

    bankAccountId: {
      type: Schema.Types.ObjectId,
      ref: "VendorBankAccount",
      required: true,
      index: true,
    },

    amount: {
      type: Schema.Types.Decimal128,
      required: true,
    },

    amountMinor: {
      type: Number,
      required: true,
      min: 1,
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
      required: true,
      enum: Object.values(WITHDRAWAL_STATUSES),
      default: WITHDRAWAL_STATUSES.PENDING_REVIEW,
      index: true,
    },

    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
    },

    bankSnapshot: {
      bankAccountId: { type: String, required: true },
      accountHolderName: { type: String, required: true },
      bankName: { type: String, required: true },
      ifscCode: { type: String, required: true },
      accountNumberMasked: { type: String, required: true },
      accountType: { type: String, default: "current" },
      partnerBankId: { type: String, default: null },
      snapshotAt: { type: Date, default: Date.now },
    },

    reservationJournalId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    releaseJournalId: {
      type: String,
      default: null,
      trim: true,
    },

    disbursementJournalId: {
      type: String,
      default: null,
      trim: true,
    },

    payoutId: {
      type: Schema.Types.ObjectId,
      ref: "VendorPayout",
      default: null,
    },

    requestedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    rejectionReason: {
      type: String,
      default: null,
      trim: true,
      maxlength: 1000,
    },

    failureReason: {
      type: String,
      default: null,
      trim: true,
      maxlength: 1000,
    },

    processedAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    notes: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500,
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        if (ret.amount !== undefined && ret.amount !== null) {
          ret.amount = ret.amount.toString();
        }
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform(doc, ret) {
        ret.id = ret._id;
        if (ret.amount !== undefined && ret.amount !== null) {
          ret.amount = ret.amount.toString();
        }
        delete ret.__v;
        return ret;
      },
    },
  }
);

withdrawalRequestSchema.index(
  { vendorId: 1, idempotencyKey: 1 },
  { unique: true }
);

withdrawalRequestSchema.index(
  { vendorId: 1, createdAt: -1 }
);

withdrawalRequestSchema.index(
  { status: 1, createdAt: -1 }
);

withdrawalRequestSchema.index(
  { payoutId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      payoutId: { $type: "objectId" },
    },
  }
);

withdrawalRequestSchema.pre("validate", function validateWithdrawal() {
  if (this.amount !== undefined && this.amount !== null) {
    const amount = Number(this.amount.toString());
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Withdrawal amount must be greater than zero");
    }
  }

  if (!/^[A-Z]{3}$/.test(this.currency)) {
    throw new Error("Currency must be a valid 3-letter uppercase code");
  }
});

const WithdrawalRequest = mongoose.model(
  "WithdrawalRequest",
  withdrawalRequestSchema
);

module.exports = WithdrawalRequest;

