const express = require("express");

const paymentController = require("../controllers/payment.controller");
const paymentWebhookController = require("../controllers/payment-webhook.controller");

const authenticate = require("../middlewares/authentication.middleware");
const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");
const {
  PERMISSIONS,
} = require("../constants/permissions.constants");
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

const paymentMethodController = require("../controllers/payment-method.controller");
const {
  capturePayPalSchema,
} = require("../validators/payment/paypal-payment.validator");
const {
  availablePaymentMethodsQuerySchema,
} = require("../validators/payment/payment-method.validator");

const router = express.Router();

// Public Razorpay webhook.
// Authentication is performed using the Razorpay webhook signature.
router.post(
  "/webhooks/razorpay",
  paymentWebhookController.handleRazorpayWebhook
);

// Public / Customer available payment methods alias
router.get(
  "/methods/available",
  validate(availablePaymentMethodsQuerySchema, "query"),
  paymentMethodController.getAvailablePaymentMethods
);

// All customer payment APIs below require JWT authentication.
router.use(authenticate);

router.post(
  "/orders/:orderId",
  validate(createPaymentSchema, "params"),
  paymentController.createPayment
);

router.post(
  "/orders/:orderId/cancel",
  validate(createPaymentSchema, "params"),
  paymentController.cancelPayment
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

// PayPal payment flow
router.post(
  "/paypal/orders/:orderId",
  validate(createPaymentSchema, "params"),
  paymentController.createPayPalPayment
);

router.post(
  "/paypal/capture",
  validate(capturePayPalSchema),
  paymentController.capturePayPalPayment
);

// Admin transaction audit listing
router.get(
  "/admin/transactions",
  requirePermissions(PERMISSIONS.PAYMENTS_READ),
  paymentController.listPaymentTransactions
);

router.get(
  "/admin/refunds",
  requirePermissions(PERMISSIONS.REFUNDS_VIEW),
  refundController.listRefunds
);

router.get(
  "/admin/refunds/:id",
  requirePermissions(PERMISSIONS.REFUNDS_VIEW),
  refundController.getRefundById
);

router.post(
  "/orders/:orderId/refunds",
  requirePermissions(PERMISSIONS.PAYMENTS_MANAGE),
  validate(createPaymentSchema, "params"),
  validate(createRefundSchema),
  refundController.createRefund
);

module.exports = router;