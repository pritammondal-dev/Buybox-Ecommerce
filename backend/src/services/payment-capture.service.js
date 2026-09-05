const paymentRepository = require("../repositories/payment.repository");
const orderRepository = require("../repositories/order.repository");

const razorpayProvider = require(
  "../integrations/payments/razorpay.provider"
);

const Customer = require("../models/Customer");

const AppError = require("../errors/AppError");

const {
  canTransitionPaymentStatus,
} = require("../constants/payment.constants");

const MINOR_UNIT_SCALE = 100;
const PAYMENT_GATEWAY = "razorpay";

const decimalToMinorUnits = (value) => {
  if (value === null || value === undefined) {
    throw new AppError(
      "Invalid payment amount",
      500,
      "INVALID_PAYMENT_AMOUNT"
    );
  }

  const normalizedValue =
    value.toString().trim();

  if (!/^\d+(\.\d+)?$/.test(normalizedValue)) {
    throw new AppError(
      "Invalid payment amount",
      500,
      "INVALID_PAYMENT_AMOUNT"
    );
  }

  const [wholePart, decimalPart = ""] =
    normalizedValue.split(".");

  if (decimalPart.length > 2) {
    throw new AppError(
      "Payment amount must use at most two decimal places",
      500,
      "INVALID_PAYMENT_AMOUNT"
    );
  }

  const paddedDecimalPart =
    decimalPart.padEnd(2, "0");

  const minorUnits =
    Number(wholePart) *
      MINOR_UNIT_SCALE +
    Number(paddedDecimalPart);

  if (!Number.isSafeInteger(minorUnits)) {
    throw new AppError(
      "Payment amount exceeds supported range",
      500,
      "PAYMENT_AMOUNT_OUT_OF_RANGE"
    );
  }

  return minorUnits;
};

const validateCustomerOrderAccess = async (
  userId,
  order
) => {
  const customer =
    await Customer.findOne({
      userId,
      isActive: true,
      deletedAt: null,
    });

  if (!customer) {
    throw new AppError(
      "Customer profile not found",
      404,
      "CUSTOMER_NOT_FOUND"
    );
  }

  if (
    customer._id.toString() !==
    order.customerId.toString()
  ) {
    throw new AppError(
      "You are not allowed to capture this payment",
      403,
      "PAYMENT_ACCESS_DENIED"
    );
  }

  return customer;
};

const validateOrderPayable = (order) => {
  if (
    ["cancelled", "completed"].includes(
      order.status
    )
  ) {
    throw new AppError(
      "Payment cannot be captured for this order",
      409,
      "ORDER_NOT_PAYABLE"
    );
  }
};

const validatePaymentAmount = (
  payment,
  order
) => {
  const paymentAmount =
    decimalToMinorUnits(
      payment.amount
    );

  const orderAmount =
    decimalToMinorUnits(
      order.grandTotal
    );

  if (paymentAmount !== orderAmount) {
    throw new AppError(
      "Payment amount does not match order amount",
      409,
      "PAYMENT_AMOUNT_MISMATCH"
    );
  }

  return orderAmount;
};

const validatePaymentCurrency = (
  payment,
  order
) => {
  if (
    payment.currency.toUpperCase() !==
    order.currency.toUpperCase()
  ) {
    throw new AppError(
      "Payment currency does not match order currency",
      409,
      "PAYMENT_CURRENCY_MISMATCH"
    );
  }
};

const validateRazorpayPayment = ({
  razorpayPayment,
  payment,
  order,
  expectedAmount,
}) => {
  if (!razorpayPayment) {
    throw new AppError(
      "Razorpay payment not found",
      404,
      "RAZORPAY_PAYMENT_NOT_FOUND"
    );
  }

  if (
    razorpayPayment.id !==
    payment.gatewayPaymentId
  ) {
    throw new AppError(
      "Razorpay payment ID does not match the local payment",
      409,
      "RAZORPAY_PAYMENT_ID_MISMATCH"
    );
  }

  if (
    razorpayPayment.order_id !==
    payment.gatewayOrderId
  ) {
    throw new AppError(
      "Razorpay payment does not belong to this payment order",
      409,
      "RAZORPAY_ORDER_MISMATCH"
    );
  }

  if (
    razorpayPayment.amount !==
    expectedAmount
  ) {
    throw new AppError(
      "Razorpay payment amount does not match order amount",
      409,
      "RAZORPAY_AMOUNT_MISMATCH"
    );
  }

  if (
    String(
      razorpayPayment.currency
    ).toUpperCase() !==
    String(
      order.currency
    ).toUpperCase()
  ) {
    throw new AppError(
      "Razorpay payment currency does not match order currency",
      409,
      "RAZORPAY_CURRENCY_MISMATCH"
    );
  }
};

const updateCapturedPayment = async ({
  payment,
  order,
  razorpayPayment,
}) => {
  const capturedAt =
    razorpayPayment.captured_at
      ? new Date(
          razorpayPayment.captured_at * 1000
        )
      : payment.capturedAt || new Date();

  const updatedPayment =
    await paymentRepository.updateById(
      payment._id,
      {
        status: "captured",
        gatewayPaymentId:
          razorpayPayment.id,
        method:
          razorpayPayment.method ||
          payment.method ||
          null,
        capturedAt,
        failureReason: null,
      }
    );

  await orderRepository.updateById(
    order._id,
    {
      paymentStatus: "paid",
    }
  );

  return updatedPayment;
};

const captureRazorpayPayment = async ({
  orderId,
  userId,
}) => {
  const order =
    await orderRepository.findById(
      orderId
    );

  if (!order) {
    throw new AppError(
      "Order not found",
      404,
      "ORDER_NOT_FOUND"
    );
  }

  await validateCustomerOrderAccess(
    userId,
    order
  );

  validateOrderPayable(order);

  const payment =
    await paymentRepository.findLatestByOrderId(
      order._id
    );

  if (!payment) {
    throw new AppError(
      "Payment record not found",
      404,
      "PAYMENT_NOT_FOUND"
    );
  }

  if (
    payment.gateway !==
    PAYMENT_GATEWAY
  ) {
    throw new AppError(
      "Unsupported payment gateway",
      409,
      "UNSUPPORTED_PAYMENT_GATEWAY"
    );
  }

  if (!payment.gatewayOrderId) {
    throw new AppError(
      "Razorpay order has not been created",
      409,
      "RAZORPAY_ORDER_NOT_CREATED"
    );
  }

  if (!payment.gatewayPaymentId) {
    throw new AppError(
      "Razorpay payment has not been verified",
      409,
      "PAYMENT_NOT_VERIFIED"
    );
  }

  validatePaymentCurrency(
    payment,
    order
  );

  const expectedAmount =
    validatePaymentAmount(
      payment,
      order
    );

  /*
   * Always ask Razorpay for the current
   * payment state before attempting capture.
   */
  const razorpayPayment =
    await razorpayProvider.fetchPayment(
      payment.gatewayPaymentId
    );

  validateRazorpayPayment({
    razorpayPayment,
    payment,
    order,
    expectedAmount,
  });

  /*
   * Idempotent case:
   * Razorpay already captured the payment.
   */
  if (
    razorpayPayment.status ===
    "captured"
  ) {
    return updateCapturedPayment({
      payment,
      order,
      razorpayPayment,
    });
  }

  /*
   * The payment must currently be
   * authorized before we request capture.
   */
  if (
    razorpayPayment.status !==
    "authorized"
  ) {
    throw new AppError(
      `Razorpay payment cannot be captured from status ${razorpayPayment.status}`,
      409,
      "RAZORPAY_PAYMENT_NOT_CAPTUREABLE"
    );
  }

  /*
   * Local state must also agree with the
   * expected authorized → captured flow.
   */
  if (
    payment.status !== "authorized"
  ) {
    throw new AppError(
      `Local payment cannot be captured from status ${payment.status}`,
      409,
      "PAYMENT_NOT_AUTHORIZED"
    );
  }

  if (
    !canTransitionPaymentStatus(
      payment.status,
      "captured"
    )
  ) {
    throw new AppError(
      `Invalid payment status transition from ${payment.status} to captured`,
      409,
      "INVALID_PAYMENT_STATUS_TRANSITION"
    );
  }

  const capturedPayment =
    await razorpayProvider.capturePayment({
      paymentId:
        payment.gatewayPaymentId,
      amount: expectedAmount,
      currency:
        order.currency,
    });

  if (
    !capturedPayment ||
    capturedPayment.status !==
      "captured"
  ) {
    throw new AppError(
      `Razorpay capture did not complete successfully: ${
        capturedPayment?.status ||
        "unknown"
      }`,
      502,
      "RAZORPAY_CAPTURE_NOT_COMPLETED"
    );
  }

  /*
   * Validate the capture response again
   * before changing our database state.
   */
  validateRazorpayPayment({
    razorpayPayment:
      capturedPayment,
    payment,
    order,
    expectedAmount,
  });

  return updateCapturedPayment({
    payment,
    order,
    razorpayPayment:
      capturedPayment,
  });
};

module.exports = {
  captureRazorpayPayment,
  decimalToMinorUnits,
};