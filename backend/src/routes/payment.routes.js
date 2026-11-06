const express = require("express");

const paymentController = require("../controllers/payment.controller");
const paymentWebhookController = require("../controllers/payment-webhook.controller");

const {
  authenticate,
  authenticateGuestOrCustomer,
} = require("../middlewares/authentication.middleware");
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
const {
  paymentLimiter,
  webhookLimiter,
} = require("../middlewares/rate-limiter.middleware");

const router = express.Router();

// Public Razorpay webhook.
// Authentication is performed using the Razorpay webhook signature.
router.post(
  "/webhooks/razorpay",
  webhookLimiter,
  paymentWebhookController.handleRazorpayWebhook
);

// Public PayPal webhook.
// Authentication is performed using the PayPal transmission signature.
router.post(
  "/webhooks/paypal",
  webhookLimiter,
  paymentWebhookController.handlePayPalWebhook
);

// Public / Customer available payment methods alias
router.get(
  "/methods/available",
  validate(availablePaymentMethodsQuerySchema, "query"),
  paymentMethodController.getAvailablePaymentMethods
);

// Customer payment endpoints support both registered customers and validated guest checkout
router.post(
  "/orders/:orderId",
  paymentLimiter,
  authenticateGuestOrCustomer,
  validate(createPaymentSchema, "params"),
  paymentController.createPayment
);

router.post(
  "/orders/:orderId/cancel",
  paymentLimiter,
  authenticateGuestOrCustomer,
  validate(createPaymentSchema, "params"),
  paymentController.cancelPayment
);

router.post(
  "/verify",
  paymentLimiter,
  authenticateGuestOrCustomer,
  validate(verifyPaymentSchema),
  paymentController.verifyPayment
);

router.post(
  "/orders/:orderId/capture",
  paymentLimiter,
  authenticateGuestOrCustomer,
  validate(createPaymentSchema, "params"),
  paymentController.capturePayment
);

// PayPal payment flow
router.post(
  "/paypal/orders/:orderId",
  paymentLimiter,
  authenticateGuestOrCustomer,
  validate(createPaymentSchema, "params"),
  paymentController.createPayPalPayment
);

router.post(
  "/paypal/capture",
  paymentLimiter,
  authenticateGuestOrCustomer,
  validate(capturePayPalSchema),
  paymentController.capturePayPalPayment
);

// Admin transaction audit listing
router.get(
  "/admin/transactions",
  authenticate,
  requirePermissions(PERMISSIONS.PAYMENTS_READ),
  paymentController.listPaymentTransactions
);

router.get(
  "/admin/refunds",
  authenticate,
  requirePermissions(PERMISSIONS.REFUNDS_VIEW),
  refundController.listRefunds
);

router.get(
  "/admin/refunds/:id",
  authenticate,
  requirePermissions(PERMISSIONS.REFUNDS_VIEW),
  refundController.getRefundById
);

router.post(
  "/orders/:orderId/refunds",
  authenticate,
  requirePermissions(PERMISSIONS.PAYMENTS_MANAGE),
  validate(createPaymentSchema, "params"),
  validate(createRefundSchema),
  refundController.createRefund
);

module.exports = router;