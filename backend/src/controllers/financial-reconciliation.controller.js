const financialReconciliationService = require("../services/financial-reconciliation.service");
const apiResponse = require("../utils/apiResponse");
const AppError = require("../errors/AppError");

const getReconciliationSummary = async (req, res) => {
  const { currency } = req.query;

  const summary = await financialReconciliationService.getPlatformReconciliationSummary(
    currency || "INR"
  );

  return apiResponse.sendSuccess(res, {
    message: "Platform reconciliation summary retrieved successfully",
    data: summary,
  });
};

const postCorrectionAdjustment = async (req, res) => {
  const actorId = req.user?.id || req.user?._id;
  const { vendorId, amount, direction, accountCode, contraAccountCode, reason, currency } = req.body;
  const idempotencyKey =
    req.get("Idempotency-Key") ||
    req.get("idempotency-key") ||
    req.body.idempotencyKey;

  if (!reason || String(reason).trim().length < 10) {
    throw new AppError(
      "A mandatory justification reason (min 10 characters) is required for financial adjustments",
      400,
      "ADJUSTMENT_REASON_REQUIRED"
    );
  }

  const result = await financialReconciliationService.postFinancialCorrection({
    vendorId,
    amount,
    direction,
    accountCode,
    contraAccountCode,
    reason: String(reason).trim(),
    actorId,
    currency: currency || "INR",
    idempotencyKey,
  });

  return apiResponse.sendSuccess(res, {
    statusCode: 201,
    message: "Financial correction journal posted successfully",
    data: result,
  });
};

module.exports = {
  getReconciliationSummary,
  postCorrectionAdjustment,
};

