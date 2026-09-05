const express = require("express");

const paymentController = require("../controllers/payment.controller");
const paymentWebhookController = require("../controllers/payment-webhook.controller");

const authenticate = require("../middlewares/authentication.middleware");
const validate = require("../middlewares/validate.middleware");

const {
  createPaymentSchema,
} = require("../validators/payment/create-payment.validator");

const {
  verifyPaymentSchema,
} = require("../validators/payment/verify-payment.validator");

const refundController = require("../controllers/refund.controller");

const {
  createRefundSchema,
} = require("../validators/refund/create-refund.validator");

const router = express.Router();

// Public Razorpay webhook.
// Authentication is performed using the Razorpay webhook signature.
router.post(
  "/webhooks/razorpay",
  paymentWebhookController.handleRazorpayWebhook
);

// All customer payment APIs below require JWT authentication.
router.use(authenticate);

router.post(
  "/orders/:orderId",
  validate(createPaymentSchema, "params"),
  paymentController.createPayment
);

router.post(
  "/verify",
  validate(verifyPaymentSchema),
  paymentController.verifyPayment
);

router.post(
  "/orders/:orderId/capture",
  validate(createPaymentSchema, "params"),
  paymentController.capturePayment
);

router.post(
  "/orders/:orderId/refunds",
  validate(createPaymentSchema, "params"),
  validate(createRefundSchema),
  refundController.createRefund
);

module.exports = router;