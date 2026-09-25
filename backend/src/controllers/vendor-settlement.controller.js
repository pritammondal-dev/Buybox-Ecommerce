const vendorSettlementService = require("../services/vendor-settlement.service");
const apiResponse = require("../utils/apiResponse");

const createSettlement = async (req, res) => {
  const settlement = await vendorSettlementService.createSettlement({
    vendorId: req.body.vendorId,
    periodStart: req.body.periodStart,
    periodEnd: req.body.periodEnd,
    currency: req.body.currency,
    grossSales: req.body.grossSales,
    discounts: req.body.discounts,
    refunds: req.body.refunds,
    platformCommission: req.body.platformCommission,
    idempotencyKey: req.get("Idempotency-Key"),
    metadata: req.body.metadata,
  });

  return apiResponse.sendSuccess(res, {
    statusCode: 201,
    message: "Vendor settlement created successfully",
    data: settlement,
  });
};

const getSettlementById = async (req, res) => {
  const settlement = await vendorSettlementService.getSettlementById(
    req.params.settlementId
  );

  return apiResponse.sendSuccess(res, {
    message: "Vendor settlement retrieved successfully",
    data: settlement,
  });
};

const getSettlementsByVendorId = async (req, res) => {
  const settlements =
    await vendorSettlementService.getSettlementsByVendorId(
      req.params.vendorId
    );

  return apiResponse.sendSuccess(res, {
    message: "Vendor settlements retrieved successfully",
    data: settlements,
  });
};

const markProcessing = async (req, res) => {
  const settlement = await vendorSettlementService.markProcessing(
    req.params.settlementId
  );

  return apiResponse.sendSuccess(res, {
    message: "Vendor settlement marked as processing",
    data: settlement,
  });
};

const markPayable = async (req, res) => {
  const settlement = await vendorSettlementService.markPayable(
    req.params.settlementId
  );

  return apiResponse.sendSuccess(res, {
    message: "Vendor settlement marked as payable",
    data: settlement,
  });
};

const getMyVendorSettlements = async (req, res) => {
  const result = await vendorSettlementService.getMyVendorSettlements({
    userId: req.user.id,
    query: req.query,
  });

  return apiResponse.sendSuccess(res, {
    message: "Vendor settlements retrieved successfully",
    data: result.items,
    meta: result.meta,
  });
};

const getMyVendorSettlementById = async (req, res) => {
  const settlement = await vendorSettlementService.getMyVendorSettlementById({
    userId: req.user.id,
    settlementId: req.params.settlementId,
  });

  return apiResponse.sendSuccess(res, {
    message: "Vendor settlement retrieved successfully",
    data: settlement,
  });
};

const getVendorFinanceSummary = async (req, res) => {
  const summary = await vendorSettlementService.getVendorFinanceSummary({
    userId: req.user.id,
  });

  return apiResponse.sendSuccess(res, {
    message: "Vendor finance summary retrieved successfully",
    data: summary,
  });
};

const generateSettlements = async (req, res) => {
  const settlements = await vendorSettlementService.generateEligibleSettlements({
    vendorId: req.body.vendorId || null,
    periodStart: req.body.periodStart || null,
    periodEnd: req.body.periodEnd || null,
    adminUserId: req.user.id,
    idempotencyKey: req.get("Idempotency-Key"),
  });

  return apiResponse.sendSuccess(res, {
    message: `Generated ${settlements.length} settlement(s) successfully`,
    data: settlements,
  });
};

const markSettlementPaid = async (req, res) => {
  const settlement = await vendorSettlementService.markSettlementPaid({
    settlementId: req.params.settlementId || req.params.id,
    payoutReference: req.body.payoutReference,
    notes: req.body.notes,
    adminUserId: req.user.id,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return apiResponse.sendSuccess(res, {
    message: "Settlement marked as paid successfully",
    data: settlement,
  });
};

const getAdminSettlements = async (req, res) => {
  const result = await vendorSettlementService.getAdminSettlements({
    query: req.query,
  });

  return apiResponse.sendSuccess(res, {
    message: "Admin settlements retrieved successfully",
    data: result.items,
    meta: result.meta,
  });
};

const getAdminSettlementById = async (req, res) => {
  const settlement = await vendorSettlementService.getAdminSettlementById(
    req.params.settlementId || req.params.id
  );

  return apiResponse.sendSuccess(res, {
    message: "Admin settlement retrieved successfully",
    data: settlement,
  });
};

module.exports = {
  createSettlement,
  getSettlementById,
  getSettlementsByVendorId,
  getMyVendorSettlements,
  getMyVendorSettlementById,
  getVendorFinanceSummary,
  generateSettlements,
  markSettlementPaid,
  getAdminSettlements,
  getAdminSettlementById,
  markProcessing,
  markPayable,
};

