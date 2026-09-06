const vendorPayoutService = require("../services/vendor-payout.service");
const apiResponse = require("../utils/apiResponse");

const createPayout = async (req, res) => {
  const payout = await vendorPayoutService.createPayout({
    settlementId: req.body.settlementId,
    vendorId: req.body.vendorId,
    provider: req.body.provider,
    idempotencyKey: req.get("Idempotency-Key"),
    metadata: req.body.metadata,
  });

  return apiResponse.sendSuccess(res, {
    statusCode: 201,
    message: "Vendor payout created successfully",
    data: payout,
  });
};

const getPayoutById = async (req, res) => {
  const payout = await vendorPayoutService.getPayoutById(
    req.params.payoutId
  );

  return apiResponse.sendSuccess(res, {
    message: "Vendor payout retrieved successfully",
    data: payout,
  });
};

const getPayoutsByVendorId = async (req, res) => {
  const payouts = await vendorPayoutService.getPayoutsByVendorId(
    req.params.vendorId
  );

  return apiResponse.sendSuccess(res, {
    message: "Vendor payouts retrieved successfully",
    data: payouts,
  });
};

const transitionPayoutStatus = async (req, res) => {
  const payout = await vendorPayoutService.transitionPayoutStatus({
    payoutId: req.params.payoutId,
    nextStatus: req.body.status,
    providerReference: req.body.providerReference,
    failureReason: req.body.failureReason,
  });

  return apiResponse.sendSuccess(res, {
    message: "Vendor payout status updated successfully",
    data: payout,
  });
};

module.exports = {
  createPayout,
  getPayoutById,
  getPayoutsByVendorId,
  transitionPayoutStatus,
};
