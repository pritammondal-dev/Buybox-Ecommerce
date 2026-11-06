const mongoose = require("mongoose");
const { Schema } = mongoose;
const {
  EXCEPTION_CATEGORIES,
  EXCEPTION_STATUSES,
} = require("../constants/finance.constants");

const financialLedgerExceptionSchema = new Schema(
  {
    ledgerEntryId: {
      type: Schema.Types.ObjectId,
      ref: "FinancialLedgerEntry",
      required: true,
      unique: true,
      index: true,
    },

    journalId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    exceptionCategory: {
      type: String,
      enum: Object.values(EXCEPTION_CATEGORIES),
      default: EXCEPTION_CATEGORIES.LEGACY_PRE_DOUBLE_ENTRY_TEST_ARTIFACT,
      required: true,
      index: true,
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
      default: "INR",
    },

    direction: {
      type: String,
      enum: ["debit", "credit"],
      required: true,
    },

    reason: {
      type: String,
      required: true,
      trim: true,
    },

    evidenceReportReference: {
      type: String,
      trim: true,
      default: "phase_finance_overview_legacy_ledger_disposition_report.md",
    },

    status: {
      type: String,
      enum: Object.values(EXCEPTION_STATUSES),
      default: EXCEPTION_STATUSES.CLASSIFIED,
      required: true,
      index: true,
    },

    operationalScopeExclusion: {
      type: Boolean,
      default: true,
      index: true,
    },

    classifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

const FinancialLedgerException = mongoose.model(
  "FinancialLedgerException",
  financialLedgerExceptionSchema
);

module.exports = FinancialLedgerException;

