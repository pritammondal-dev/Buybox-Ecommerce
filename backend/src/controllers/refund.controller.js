const refundService = require("../services/refund.service");
const apiResponse = require("../utils/apiResponse");

const createRefund = async (req, res) => {
  const idempotencyKey = req.get("Idempotency-Key");

  const refund = await refundService.createRefund({
    orderId: req.params.orderId,
    userId: req.user.id,
    amount: req.body.amount,
    reason: req.body.reason,
    idempotencyKey,
  });

  return apiResponse.sendSuccess(res, {
    statusCode: 201,
    message: "Refund created successfully",
    data: refund,
  });
};

module.exports = {
  createRefund,
};