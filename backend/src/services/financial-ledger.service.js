const mongoose = require("mongoose");

const financialLedgerRepository = require("../repositories/financial-ledger.repository");

const {
  FINANCIAL_ENTRY_TYPES,
  FINANCIAL_ENTRY_DIRECTIONS,
  FINANCIAL_ACCOUNT_TYPES,
} = require("../constants/finance.constants");

const AppError = require("../errors/AppError");

const toDecimal128 = (value) => {
  const normalized = Number(value || 0);

  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new AppError(
      "Ledger amount must be greater than zero",
      422,
      "INVALID_LEDGER_AMOUNT"
    );
  }

  return mongoose.Types.Decimal128.fromString(normalized.toFixed(2));
};

const normalizeCurrency = (currency) => {
  const normalized = String(currency || "")
    .trim()
    .toUpperCase();

  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new AppError(
      "Invalid ledger currency",
      422,
      "INVALID_LEDGER_CURRENCY"
    );
  }

  return normalized;
};

const createLedgerEntry = async ({
  journalId,
  entryType,
  direction,
  accountType,
  accountReference = null,
  amount,
  currency,
  orderId = null,
  paymentId = null,
  refundId = null,
  settlementId = null,
  payoutId = null,
  vendorId = null,
  idempotencyKey = null,
  description = null,
  source = "system",
  metadata = {},
}) => {
  if (!journalId) {
    throw new AppError(
      "Journal ID is required",
      422,
      "JOURNAL_ID_REQUIRED"
    );
  }

  if (!Object.values(FINANCIAL_ENTRY_TYPES).includes(entryType)) {
    throw new AppError(
      "Invalid financial entry type",
      422,
      "INVALID_FINANCIAL_ENTRY_TYPE"
    );
  }

  if (!Object.values(FINANCIAL_ENTRY_DIRECTIONS).includes(direction)) {
    throw new AppError(
      "Invalid financial entry direction",
      422,
      "INVALID_FINANCIAL_ENTRY_DIRECTION"
    );
  }

  if (!Object.values(FINANCIAL_ACCOUNT_TYPES).includes(accountType)) {
    throw new AppError(
      "Invalid financial account type",
      422,
      "INVALID_FINANCIAL_ACCOUNT_TYPE"
    );
  }

  if (idempotencyKey) {
    const existing =
      await financialLedgerRepository.findByIdempotencyKey(
        idempotencyKey
      );

    if (existing) {
      return existing;
    }
  }

  if (vendorId && !mongoose.isValidObjectId(vendorId)) {
    throw new AppError(
      "Invalid vendor ID",
      400,
      "INVALID_VENDOR_ID"
    );
  }

  const entryData = {
    journalId: String(journalId),
    entryType,
    direction,
    accountType,
    accountReference,
    amount: toDecimal128(amount),
    currency: normalizeCurrency(currency),
    orderId,
    paymentId,
    refundId,
    settlementId,
    payoutId,
    vendorId,
    idempotencyKey,
    description,
    source,
    metadata,
  };

  try {
    return await financialLedgerRepository.create(entryData);
  } catch (error) {
    if (error?.code === 11000 && idempotencyKey) {
      const existing =
        await financialLedgerRepository.findByIdempotencyKey(
          idempotencyKey
        );

      if (existing) {
        return existing;
      }
    }

    throw error;
  }
};

const createLedgerEntries = async (entries, options = {}) => {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new AppError(
      "At least one ledger entry is required",
      422,
      "LEDGER_ENTRIES_REQUIRED"
    );
  }

  const session = options.session || null;

  const preparedEntries = entries.map((entry) => ({
    ...entry,
    amount: toDecimal128(entry.amount),
    currency: normalizeCurrency(entry.currency),
  }));

  return financialLedgerRepository.createMany(
    preparedEntries,
    { session }
  );
};

const getLedgerEntryById = async (id) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(
      "Invalid ledger entry ID",
      400,
      "INVALID_LEDGER_ENTRY_ID"
    );
  }

  const entry =
    await financialLedgerRepository.findById(id);

  if (!entry) {
    throw new AppError(
      "Financial ledger entry not found",
      404,
      "LEDGER_ENTRY_NOT_FOUND"
    );
  }

  return entry;
};

const getEntriesByJournalId = async (journalId) => {
  return financialLedgerRepository.findByJournalId(journalId);
};

const getEntriesByOrderId = async (orderId) => {
  if (!mongoose.isValidObjectId(orderId)) {
    throw new AppError(
      "Invalid order ID",
      400,
      "INVALID_ORDER_ID"
    );
  }

  return financialLedgerRepository.findByOrderId(orderId);
};

const getEntriesByVendorId = async (vendorId) => {
  if (!mongoose.isValidObjectId(vendorId)) {
    throw new AppError(
      "Invalid vendor ID",
      400,
      "INVALID_VENDOR_ID"
    );
  }

  return financialLedgerRepository.findByVendorId(vendorId);
};

module.exports = {
  createLedgerEntry,
  createLedgerEntries,
  getLedgerEntryById,
  getEntriesByJournalId,
  getEntriesByOrderId,
  getEntriesByVendorId,
};