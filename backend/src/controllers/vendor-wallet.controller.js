const vendorWalletService = require("../services/vendor-wallet.service");
const financialReconciliationService = require("../services/financial-reconciliation.service");
const apiResponse = require("../utils/apiResponse");
const AppError = require("../errors/AppError");

const getMyWallet = async (req, res) => {
  const vendorId = req.vendor._id;
  const wallet = await vendorWalletService.getVendorWallet(vendorId);

  return apiResponse.sendSuccess(res, {
    message: "Vendor wallet retrieved successfully",
    data: wallet,
  });
};

const getMyWalletTransactions = async (req, res) => {
  const vendorId = req.vendor._id;
  const result = await vendorWalletService.getVendorTransactions(
    vendorId,
    req.query
  );

  return apiResponse.sendSuccess(res, {
    message: "Vendor wallet transactions retrieved successfully",
    data: result.items,
    meta: result.meta,
  });
};

const getMyClearanceTimeline = async (req, res) => {
  const vendorId = req.vendor._id;
  const timeline = await vendorWalletService.getVendorClearanceTimeline(vendorId);

  return apiResponse.sendSuccess(res, {
    message: "Vendor clearance timeline retrieved successfully",
    data: timeline,
  });
};

const getAdminVendorWallet = async (req, res) => {
  const { vendorId } = req.params;
  const wallet = await vendorWalletService.getVendorWallet(vendorId);

  return apiResponse.sendSuccess(res, {
    message: "Vendor wallet retrieved successfully",
    data: wallet,
  });
};

const getAdminVendorReconciliation = async (req, res) => {
  const { vendorId } = req.params;
  const reconciliation = await financialReconciliationService.reconcileVendorFinances(
    vendorId
  );

  return apiResponse.sendSuccess(res, {
    message: "Vendor wallet reconciliation retrieved successfully",
    data: reconciliation,
  });
};

const syncAdminVendorWallet = async (req, res) => {
  const { vendorId } = req.params;
  const { reason } = req.body || {};

  if (!reason || !String(reason).trim()) {
    throw new AppError(
      "A mandatory reason is required to synchronize wallet balance projections",
      400,
      "REASON_REQUIRED"
    );
  }

  const result = await financialReconciliationService.reconcileVendorFinances(
    vendorId,
    "INR",
    {
      syncCachedWallet: true,
      actorId: req.user.id,
      reason: String(reason).trim(),
    }
  );

  return apiResponse.sendSuccess(res, {
    message: "Vendor wallet balance projections synchronized successfully",
    data: result,
  });
};

const listAdminWallets = async (req, res) => {
  const result = await vendorWalletService.listAdminVendorWallets(req.query);

  return apiResponse.sendSuccess(res, {
    message: "Admin vendor wallets retrieved successfully",
    data: result.items,
    meta: {
      ...result.meta,
      aggregates: result.aggregates,
    },
  });
};

const getAdminVendorDrilldown = async (req, res) => {
  const { vendorId } = req.params;
  const { currency } = req.query;

  const drilldown = await vendorWalletService.getAdminVendorDrilldown(
    vendorId,
    currency
  );

  return apiResponse.sendSuccess(res, {
    message: "Vendor financial drill-down retrieved successfully",
    data: drilldown,
  });
};

module.exports = {
  getMyWallet,
  getMyWalletTransactions,
  getMyClearanceTimeline,
  getAdminVendorWallet,
  getAdminVendorReconciliation,
  syncAdminVendorWallet,
  listAdminWallets,
  getAdminVendorDrilldown,
};

