const FinancialLedgerEntry = require("../models/FinancialLedgerEntry");

const create = async (data, options = {}) => {
  const documents = await FinancialLedgerEntry.create([data], {
    session: options.session,
  });

  return documents[0];
};

const createMany = async (data, options = {}) => {
  return FinancialLedgerEntry.insertMany(data, {
    session: options.session,
  });
};

const findById = async (id, options = {}) => {
  return FinancialLedgerEntry.findById(id).session(
    options.session || null
  );
};

const findByIdempotencyKey = async (
  idempotencyKey,
  options = {}
) => {
  return FinancialLedgerEntry.findOne({
    idempotencyKey,
  }).session(options.session || null);
};

const findByJournalId = async (
  journalId,
  options = {}
) => {
  return FinancialLedgerEntry.find({
    journalId,
  })
    .session(options.session || null)
    .sort({ createdAt: 1 });
};

const findByOrderId = async (
  orderId,
  options = {}
) => {
  return FinancialLedgerEntry.find({
    orderId,
  })
    .session(options.session || null)
    .sort({ createdAt: 1 });
};

const findByVendorId = async (
  vendorId,
  options = {}
) => {
  return FinancialLedgerEntry.find({
    vendorId,
  })
    .session(options.session || null)
    .sort({ createdAt: -1 });
};

const findByPaymentId = async (
  paymentId,
  options = {}
) => {
  return FinancialLedgerEntry.find({
    paymentId,
  })
    .session(options.session || null)
    .sort({ createdAt: 1 });
};

const findBySettlementId = async (
  settlementId,
  options = {}
) => {
  return FinancialLedgerEntry.find({
    settlementId,
  })
    .session(options.session || null)
    .sort({ createdAt: 1 });
};

const findByReversalOfJournalId = async (
  journalId,
  options = {}
) => {
  return FinancialLedgerEntry.find({
    reversalOfJournalId: journalId,
  })
    .session(options.session || null)
    .sort({ createdAt: 1 });
};

const findVendorEntries = async (
  vendorId,
  { accountCode, entryType, startDate, endDate, skip = 0, limit = 20, session = null } = {}
) => {
  const query = { vendorId };
  if (accountCode) query.accountCode = accountCode;
  if (entryType) query.entryType = entryType;
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  return FinancialLedgerEntry.find(query)
    .session(session || null)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

const countVendorEntries = async (
  vendorId,
  { accountCode, entryType, startDate, endDate, session = null } = {}
) => {
  const query = { vendorId };
  if (accountCode) query.accountCode = accountCode;
  if (entryType) query.entryType = entryType;
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  return FinancialLedgerEntry.countDocuments(query).session(session || null);
};

const findVendorAllEntries = async (
  vendorId,
  currency = "INR",
  options = {}
) => {
  return FinancialLedgerEntry.find({
    vendorId,
    currency: String(currency).toUpperCase(),
  })
    .session(options.session || null)
    .sort({ createdAt: 1 });
};

module.exports = {
  create,
  createMany,
  findById,
  findByIdempotencyKey,
  findByJournalId,
  findByOrderId,
  findByVendorId,
  findByPaymentId,
  findBySettlementId,
  findByReversalOfJournalId,
  findVendorEntries,
  countVendorEntries,
  findVendorAllEntries,
};