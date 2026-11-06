const mongoose = require("mongoose");
const FinancialLedgerEntry = require("../models/FinancialLedgerEntry");
const FinancialLedgerException = require("../models/FinancialLedgerException");
const AuditLog = require("../models/AuditLog");
const AppError = require("../errors/AppError");
const {
  JOURNAL_STATUSES,
  EXCEPTION_CATEGORIES,
  EXCEPTION_STATUSES,
} = require("../constants/finance.constants");

/**
 * Classifies a ledger entry as a legacy or unclassified exception.
 * Strictly preserves the original FinancialLedgerEntry immutable document.
 */
const classifyLegacyException = async ({
  ledgerEntryId,
  exceptionCategory = EXCEPTION_CATEGORIES.LEGACY_PRE_DOUBLE_ENTRY_TEST_ARTIFACT,
  reason,
  evidenceReportReference = "phase_finance_overview_legacy_ledger_disposition_report.md",
  actorId = null,
  operationalScopeExclusion = true,
  metadata = {},
}) => {
  if (!mongoose.isValidObjectId(ledgerEntryId)) {
    throw new AppError("Invalid ledgerEntryId", 400, "INVALID_LEDGER_ENTRY_ID");
  }

  const ledgerEntry = await FinancialLedgerEntry.findById(ledgerEntryId);
  if (!ledgerEntry) {
    throw new AppError("Financial ledger entry not found", 404, "LEDGER_ENTRY_NOT_FOUND");
  }

  if (!reason || String(reason).trim().length < 5) {
    throw new AppError("A reason (minimum 5 characters) is required for exception classification", 400, "INVALID_CLASSIFICATION_REASON");
  }

  if (exceptionCategory && !Object.values(EXCEPTION_CATEGORIES).includes(exceptionCategory)) {
    throw new AppError("Invalid exceptionCategory", 400, "INVALID_EXCEPTION_CATEGORY");
  }

  const existing = await FinancialLedgerException.findOne({ ledgerEntryId });
  if (existing) {
    // Idempotent: update metadata/category if changed
    const beforeState = existing.toObject();
    existing.exceptionCategory = exceptionCategory;
    existing.reason = String(reason).trim();
    existing.evidenceReportReference = evidenceReportReference;
    existing.operationalScopeExclusion = operationalScopeExclusion;
    if (actorId && mongoose.isValidObjectId(actorId)) existing.classifiedBy = actorId;
    existing.metadata = { ...existing.metadata, ...metadata };
    await existing.save();

    await AuditLog.create({
      actorId: actorId && mongoose.isValidObjectId(actorId) ? actorId : new mongoose.Types.ObjectId("000000000000000000000001"),
      targetId: ledgerEntry._id,
      action: "FINANCIAL_EXCEPTION_RECLASSIFIED",
      entityType: "financial_ledger_exception",
      beforeState,
      afterState: existing.toObject(),
      reason: String(reason).trim(),
      metadata: {
        journalId: ledgerEntry.journalId,
        amount: ledgerEntry.amount?.toString(),
        exceptionCategory,
      },
    }).catch(() => {});

    return existing;
  }

  const newException = await FinancialLedgerException.create({
    ledgerEntryId: ledgerEntry._id,
    journalId: ledgerEntry.journalId || "UNKNOWN_JOURNAL",
    exceptionCategory,
    amount: ledgerEntry.amount,
    currency: ledgerEntry.currency || "INR",
    direction: ledgerEntry.direction,
    reason: String(reason).trim(),
    evidenceReportReference,
    status: EXCEPTION_STATUSES.CLASSIFIED,
    operationalScopeExclusion,
    classifiedBy: actorId && mongoose.isValidObjectId(actorId) ? actorId : null,
    metadata,
  });

  await AuditLog.create({
    actorId: actorId && mongoose.isValidObjectId(actorId) ? actorId : new mongoose.Types.ObjectId("000000000000000000000001"),
    targetId: ledgerEntry._id,
    action: "FINANCIAL_EXCEPTION_CLASSIFIED",
    entityType: "financial_ledger_exception",
    beforeState: null,
    afterState: newException.toObject(),
    reason: String(reason).trim(),
    metadata: {
      journalId: ledgerEntry.journalId,
      amount: ledgerEntry.amount?.toString(),
      exceptionCategory,
      evidenceReportReference,
    },
  }).catch(() => {});

  return newException;
};

/**
 * Ensures known pre-engine prototype entries (e.g. 6a9d1c8bbcd60b99560849f7)
 * are safely and idempotently classified in the Exception Register.
 */
const ensureKnownLegacyExceptionsClassified = async (actorId = null) => {
  const KNOWN_TEST_ENTRY_ID = "6a9d1c8bbcd60b99560849f7";
  if (!mongoose.isValidObjectId(KNOWN_TEST_ENTRY_ID)) return;

  const entry = await FinancialLedgerEntry.findById(KNOWN_TEST_ENTRY_ID);
  if (entry) {
    const existing = await FinancialLedgerException.findOne({ ledgerEntryId: entry._id });
    if (!existing) {
      await classifyLegacyException({
        ledgerEntryId: entry._id,
        exceptionCategory: EXCEPTION_CATEGORIES.LEGACY_PRE_DOUBLE_ENTRY_TEST_ARTIFACT,
        reason: "Pre-double-entry prototype artifact posted prior to commit ce2067b on 2026-09-06 without matching counterpart credits.",
        evidenceReportReference: "phase_finance_overview_legacy_ledger_disposition_report.md",
        actorId,
        operationalScopeExclusion: true,
        metadata: {
          originalJournalId: entry.journalId,
          originalDescription: entry.description,
          identifiedInPhase: "FINANCE-OVERVIEW-D",
        },
      });
    }
  }
};

/**
 * Retrieves classified financial ledger exceptions.
 */
const getLegacyExceptions = async ({ currency = "INR" } = {}) => {
  const normCurrency = String(currency || "INR").trim().toUpperCase();

  const exceptions = await FinancialLedgerException.find({ currency: normCurrency })
    .populate("ledgerEntryId")
    .sort({ createdAt: -1 })
    .lean();

  let totalAmount = 0;
  const items = exceptions.map((e) => {
    const amt = parseFloat(e.amount ? e.amount.toString() : "0");
    totalAmount += amt;

    let categoryLabel = "Pre-Double-Entry Prototype Artifact";
    if (e.exceptionCategory === EXCEPTION_CATEGORIES.MALFORMED_ENTRY) categoryLabel = "Malformed Entry";
    if (e.exceptionCategory === EXCEPTION_CATEGORIES.UNBALANCED_JOURNAL) categoryLabel = "Unbalanced Journal";
    if (e.exceptionCategory === EXCEPTION_CATEGORIES.MISSING_COUNTERPART) categoryLabel = "Missing Counterpart Lines";

    return {
      id: e._id.toString(),
      ledgerEntryId: e.ledgerEntryId?._id?.toString() || e.ledgerEntryId?.toString(),
      journalId: e.journalId,
      amount: Number(amt.toFixed(2)),
      currency: e.currency,
      direction: e.direction,
      exceptionCategory: e.exceptionCategory,
      categoryLabel,
      reason: e.reason,
      evidenceReportReference: e.evidenceReportReference,
      status: e.status,
      statusLabel: "Classified — Accounting Disposition Preserved",
      operationalScopeExclusion: e.operationalScopeExclusion,
      originalDate: e.ledgerEntryId?.createdAt || e.createdAt,
      classifiedAt: e.createdAt,
      recordPreserved: true,
    };
  });

  return {
    count: items.length,
    totalAmount: Number(totalAmount.toFixed(2)),
    currency: normCurrency,
    items,
  };
};

module.exports = {
  classifyLegacyException,
  ensureKnownLegacyExceptionsClassified,
  getLegacyExceptions,
};

