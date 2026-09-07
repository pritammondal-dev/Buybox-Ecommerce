const paymentRepository = require("../repositories/payment.repository");
const orderRepository = require("../repositories/order.repository");

const orderService = require("./order.service");
const notificationService = require("./notification");

const razorpayProvider = require(
  "../integrations/payments/razorpay.provider"
);

const Customer = require("../models/Customer");
const User = require("../models/User");

const AppError = require("../errors/AppError");

const {
  canTransitionPaymentStatus,
} = require("../constants/payment.constants");

const MINOR_UNIT_SCALE = 100;
const PAYMENT_GATEWAY = "razorpay";

/**
 * Convert a monetary value into integer minor units.
 *
 * Example:
 * "2799.00" -> 279900
 */
const decimalToMinorUnits = (value) => {
  if (
    value === null ||
    value === undefined
  ) {
    throw new AppError(
      "Invalid payment amount",
      500,
      "INVALID_PAYMENT_AMOUNT"
    );
  }

  const normalizedValue =
    value.toString().trim();

  if (
    !/^\d+(\.\d+)?$/.test(
      normalizedValue
    )
  ) {
    throw new AppError(
      "Invalid payment amount",
      500,
      "INVALID_PAYMENT_AMOUNT"
    );
  }

  const [
    wholePart,
    decimalPart = "",
  ] = normalizedValue.split(".");

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

  if (
    !Number.isSafeInteger(minorUnits)
  ) {
    throw new AppError(
      "Payment amount exceeds supported range",
      500,
      "PAYMENT_AMOUNT_OUT_OF_RANGE"
    );
  }

  return minorUnits;
};

/**
 * Ensure the authenticated customer owns
 * the order whose payment is being captured.
 */
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

/**
 * Ensure the order can still receive payment.
 */
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

/**
 * Ensure local payment amount and order
 * grand total are identical.
 */
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

  if (
    paymentAmount !==
    orderAmount
  ) {
    throw new AppError(
      "Payment amount does not match order amount",
      409,
      "PAYMENT_AMOUNT_MISMATCH"
    );
  }

  return orderAmount;
};

/**
 * Ensure local payment currency and
 * order currency are identical.
 */
const validatePaymentCurrency = (
  payment,
  order
) => {
  if (
    String(payment.currency)
      .toUpperCase() !==
    String(order.currency)
      .toUpperCase()
  ) {
    throw new AppError(
      "Payment currency does not match order currency",
      409,
      "PAYMENT_CURRENCY_MISMATCH"
    );
  }
};

/**
 * Validate the payment returned by Razorpay
 * against our local payment and order.
 */
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

/**
 * Send payment confirmation notification.
 *
 * Notification failures must never invalidate
 * an already successful payment capture.
 */
const sendPaymentConfirmationNotification =
  async ({
    order,
    customer,
  }) => {
    try {
      const user =
        await User.findById(
          customer.userId
        )
          .select(
            "email firstName lastName"
          )
          .lean();

      if (!user?.email) {
        return;
      }

      const customerName = [
        user.firstName,
        user.lastName,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

      await notificationService
        .sendPaymentConfirmation({
          to: user.email,
          customerName,
          orderNumber:
            order.orderNumber,
          amount:
            order.grandTotal,
        });
    } catch (error) {
      console.error(
        "Payment confirmation notification failed:",
        error
      );
    }
  };

/**
 * Persist a successfully captured payment
 * and synchronize the corresponding order.
 */
const updateCapturedPayment = async ({
  payment,
  order,
  razorpayPayment,
  customer,
}) => {
  const capturedAt =
    razorpayPayment.captured_at
      ? new Date(
          razorpayPayment.captured_at *
            1000
        )
      : payment.capturedAt ||
        new Date();

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

  const updatedOrder =
    await orderService.markOrderPaymentCaptured(
      order._id
    );

  await sendPaymentConfirmationNotification({
    order: updatedOrder || order,
    customer,
  });

  return updatedPayment;
};

/**
 * Capture an authorized Razorpay payment.
 *
 * Flow:
 *
 * 1. Validate order ownership
 * 2. Validate local payment
 * 3. Fetch current Razorpay state
 * 4. If already captured, synchronize locally
 * 5. Otherwise capture authorized payment
 * 6. Validate capture response
 * 7. Persist captured payment
 * 8. Confirm the order
 * 9. Send payment confirmation notification
 */
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

  const customer =
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

  /**
   * Always retrieve the current gateway
   * state before attempting capture.
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

  /**
   * Idempotent case.
   *
   * Razorpay already captured the payment.
   * Synchronize our local state instead
   * of attempting another capture.
   */
  if (
    razorpayPayment.status ===
    "captured"
  ) {
    return updateCapturedPayment({
      payment,
      order,
      razorpayPayment,
      customer,
    });
  }

  /**
   * Razorpay must report authorized before
   * we request capture.
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

  /**
   * Local payment must also be authorized.
   */
  if (
    payment.status !==
    "authorized"
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

  /**
   * Request capture from Razorpay.
   */
  const capturedPayment =
    await razorpayProvider.capturePayment({
      paymentId:
        payment.gatewayPaymentId,

      amount:
        expectedAmount,

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

  /**
   * Validate the gateway capture response
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
    customer,
  });
};

module.exports = {
  captureRazorpayPayment,
  decimalToMinorUnits,
};