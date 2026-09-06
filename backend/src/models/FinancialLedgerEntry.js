const mongoose = require("mongoose");

const { Schema } = mongoose;

const {
  FINANCIAL_ENTRY_TYPES,
  FINANCIAL_ENTRY_DIRECTIONS,
  FINANCIAL_ACCOUNT_TYPES,
  FINANCIAL_ENTRY_SOURCES,
} = require("../constants/finance.constants");

const financialLedgerEntrySchema = new Schema(
  {
    journalId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      index: true,
    },

    entryType: {
      type: String,
      enum: Object.values(FINANCIAL_ENTRY_TYPES),
      required: true,
    },

    direction: {
      type: String,
      enum: Object.values(FINANCIAL_ENTRY_DIRECTIONS),
      required: true,
    },

    accountType: {
      type: String,
      enum: Object.values(FINANCIAL_ACCOUNT_TYPES),
      required: true,
    },

    accountReference: {
      type: String,
      trim: true,
      maxlength: 200,
      default: null,
    },

    amount: {
      type: Schema.Types.Decimal128,
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

    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },

    paymentId: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
      index: true,
    },

    refundId: {
      type: Schema.Types.ObjectId,
      ref: "Refund",
      default: null,
      index: true,
    },

    settlementId: {
      type: Schema.Types.ObjectId,
      ref: "VendorSettlement",
      default: null,
      index: true,
    },

    payoutId: {
      type: Schema.Types.ObjectId,
      ref: "VendorPayout",
      default: null,
      index: true,
    },

    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      default: null,
      index: true,
    },

    idempotencyKey: {
      type: String,
      trim: true,
      maxlength: 200,
      default: null,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },

    source: {
      type: String,
      enum: Object.values(FINANCIAL_ENTRY_SOURCES),
      default: "system",
      required: true,
    },

    metadata: {
      type: Map,
      of: String,
      default: {},
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

financialLedgerEntrySchema.index({
  journalId: 1,
  createdAt: 1,
});

financialLedgerEntrySchema.index({
  vendorId: 1,
  createdAt: -1,
});

financialLedgerEntrySchema.index({
  orderId: 1,
  createdAt: -1,
});

financialLedgerEntrySchema.index(
  {
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

financialLedgerEntrySchema.pre("validate", function validateLedgerEntry() {
  if (!this.amount || Number(this.amount.toString()) <= 0) {
    throw new Error("Financial ledger amount must be greater than zero");
  }

  if (!/^[A-Z]{3}$/.test(this.currency)) {
    throw new Error("Financial ledger currency must be a valid ISO code");
  }
});

financialLedgerEntrySchema.pre(
  ["save", "updateOne", "updateMany", "findOneAndUpdate", "deleteOne", "deleteMany"],
  function preventLedgerMutation() {
    if (this instanceof mongoose.Query) {
      throw new Error("FINANCIAL_LEDGER_IMMUTABLE");
    }

    if (!this.isNew) {
      throw new Error("FINANCIAL_LEDGER_IMMUTABLE");
    }
  }
);

const FinancialLedgerEntry = mongoose.model(
  "FinancialLedgerEntry",
  financialLedgerEntrySchema
);

module.exports = FinancialLedgerEntry;
module.exports.FinancialLedgerEntry = FinancialLedgerEntry;