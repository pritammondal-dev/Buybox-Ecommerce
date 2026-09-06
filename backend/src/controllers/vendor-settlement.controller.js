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

module.exports = {
  createSettlement,
  getSettlementById,
  getSettlementsByVendorId,
  markProcessing,
  markPayable,
};
