const paymentService = require("../services/payment.service");

const paymentVerificationService = require(
  "../services/payment-verification.service"
);

const paymentCaptureService = require(
  "../services/payment-capture.service"
);

const apiResponse = require("../utils/apiResponse");

const createPayment = async (req, res) => {
  const idempotencyKey =
    req.get("Idempotency-Key");

  const payment =
    await paymentService.createPaymentForOrder(
      req.params.orderId,
      req.user.id,
      idempotencyKey
    );

  return apiResponse.sendSuccess(res, {
    statusCode: 201,
    message:
      "Payment order created successfully",
    data: payment,
  });
};

const verifyPayment = async (req, res) => {
  const payment =
    await paymentVerificationService.verifyRazorpayPayment(
      {
        orderId: req.body.orderId,
        userId: req.user.id,
        razorpayOrderId:
          req.body.razorpayOrderId,
        razorpayPaymentId:
          req.body.razorpayPaymentId,
        razorpaySignature:
          req.body.razorpaySignature,
      }
    );

  return apiResponse.sendSuccess(res, {
    message:
      "Payment verified successfully",
    data: payment,
  });
};

const capturePayment = async (req, res) => {
  const payment =
    await paymentCaptureService.captureRazorpayPayment(
      {
        orderId: req.params.orderId,
        userId: req.user.id,
      }
    );

  return apiResponse.sendSuccess(res, {
    message:
      "Payment captured successfully",
    data: payment,
  });
};

module.exports = {
  createPayment,
  verifyPayment,
  capturePayment,
};