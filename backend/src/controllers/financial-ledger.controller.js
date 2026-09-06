const financialLedgerService = require("../services/financial-ledger.service");
const apiResponse = require("../utils/apiResponse");

const getLedgerEntryById = async (req, res) => {
  const entry = await financialLedgerService.getLedgerEntryById(
    req.params.entryId
  );

  return apiResponse.sendSuccess(res, {
    message: "Ledger entry retrieved successfully",
    data: entry,
  });
};

const getEntriesByJournalId = async (req, res) => {
  const entries = await financialLedgerService.getEntriesByJournalId(
    req.params.journalId
  );

  return apiResponse.sendSuccess(res, {
    message: "Ledger entries retrieved successfully",
    data: entries,
  });
};

const getEntriesByOrderId = async (req, res) => {
  const entries = await financialLedgerService.getEntriesByOrderId(
    req.params.orderId
  );

  return apiResponse.sendSuccess(res, {
    message: "Order ledger entries retrieved successfully",
    data: entries,
  });
};

const getEntriesByVendorId = async (req, res) => {
  const entries = await financialLedgerService.getEntriesByVendorId(
    req.params.vendorId
  );

  return apiResponse.sendSuccess(res, {
    message: "Vendor ledger entries retrieved successfully",
    data: entries,
  });
};

module.exports = {
  getLedgerEntryById,
  getEntriesByJournalId,
  getEntriesByOrderId,
  getEntriesByVendorId,
};