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

  const isGuest = Boolean(req.isGuest || req.user?.isGuest);
  const guestId = req.guestId || req.user?.guestId;
  const token = req.get("X-Order-Token") || req.body?.orderAccessToken;

  const payment =
    await paymentService.createPaymentForOrder(
      req.params.orderId,
      req.user.id,
      idempotencyKey,
      { isGuest, guestId, token, guestOrderAccessToken: token }
    );

  return apiResponse.sendSuccess(res, {
    statusCode: 201,
    message:
      "Payment order created successfully",
    data: payment,
  });
};

const verifyPayment = async (req, res) => {
  const isGuest = Boolean(req.isGuest || req.user?.isGuest);
  const guestId = req.guestId || req.user?.guestId;
  const token = req.get("X-Order-Token") || req.body?.orderAccessToken;

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
        isGuest,
        guestId,
        token,
        guestOrderAccessToken: token,
      }
    );

  return apiResponse.sendSuccess(res, {
    message:
      "Payment verified successfully",
    data: payment,
  });
};

const capturePayment = async (req, res) => {
  const isGuest = Boolean(req.isGuest || req.user?.isGuest);
  const guestId = req.guestId || req.user?.guestId;
  const token = req.get("X-Order-Token") || req.body?.orderAccessToken;

  const payment =
    await paymentCaptureService.captureRazorpayPayment(
      {
        orderId: req.params.orderId,
        userId: req.user.id,
        isGuest,
        guestId,
        token,
        guestOrderAccessToken: token,
      }
    );

  return apiResponse.sendSuccess(res, {
    message:
      "Payment captured successfully",
    data: payment,
  });
};

const createPayPalPayment = async (req, res) => {
  const idempotencyKey = req.get("Idempotency-Key");
  const isGuest = Boolean(req.isGuest || req.user?.isGuest);
  const guestId = req.guestId || req.user?.guestId;
  const token = req.get("X-Order-Token") || req.body?.orderAccessToken;

  const payment = await paymentService.createPayPalOrderForOrder(
    req.params.orderId,
    req.user.id,
    idempotencyKey,
    { isGuest, guestId, token, guestOrderAccessToken: token }
  );

  return apiResponse.sendSuccess(res, {
    statusCode: 201,
    message: "PayPal payment order created successfully",
    data: payment,
  });
};

const capturePayPalPayment = async (req, res) => {
  const isGuest = Boolean(req.isGuest || req.user?.isGuest);
  const guestId = req.guestId || req.user?.guestId;
  const token = req.get("X-Order-Token") || req.body?.orderAccessToken;

  const payment = await paymentService.capturePayPalOrder({
    orderId: req.body.orderId,
    userId: req.user.id,
    paypalOrderId: req.body.paypalOrderId,
    isGuest,
    guestId,
    token,
    guestOrderAccessToken: token,
  });

  return apiResponse.sendSuccess(res, {
    message: "PayPal payment captured successfully",
    data: payment,
  });
};

const listPaymentTransactions = async (req, res) => {
  const result = await paymentService.listPaymentTransactions({
    page: req.query.page,
    limit: req.query.limit,
    status: req.query.status,
    gateway: req.query.gateway,
  });

  return apiResponse.sendSuccess(res, {
    message: "Payment transactions retrieved successfully",
    data: result.transactions,
    meta: result.meta,
  });
};

const cancelPayment = async (req, res) => {
  const isGuest = Boolean(req.isGuest || req.user?.isGuest);
  const guestId = req.guestId || req.user?.guestId;
  const token = req.get("X-Order-Token") || req.body?.orderAccessToken;

  const result = await paymentService.recordPaymentCancellation({
    orderId: req.params.orderId,
    userId: req.user.id,
    isGuest,
    guestId,
    token,
    guestOrderAccessToken: token,
  });

  return apiResponse.sendSuccess(res, {
    message: "Payment cancellation recorded successfully",
    data: result,
  });
};

module.exports = {
  createPayment,
  verifyPayment,
  capturePayment,
  createPayPalPayment,
  capturePayPalPayment,
  listPaymentTransactions,
  cancelPayment,
};
