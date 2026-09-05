const crypto = require("crypto");

const paymentRepository = require("../repositories/payment.repository");
const orderRepository = require("../repositories/order.repository");

const Customer = require("../models/Customer");

const razorpayProvider = require(
  "../integrations/payments/razorpay.provider"
);

const AppError = require("../errors/AppError");
const env = require("../config/env");

const {
  canTransitionPaymentStatus,
} = require("../constants/payment.constants");

const PAYMENT_GATEWAY = "razorpay";
const MINOR_UNIT_SCALE = 100;

const verifyRazorpaySignature = ({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) => {
  if (
    typeof razorpayOrderId !== "string" ||
    typeof razorpayPaymentId !== "string" ||
    typeof razorpaySignature !== "string" ||
    !razorpayOrderId.trim() ||
    !razorpayPaymentId.trim() ||
    !razorpaySignature.trim()
  ) {
    throw new AppError(
      "Incomplete Razorpay payment verification data",
      400,
      "INVALID_PAYMENT_VERIFICATION_DATA"
    );
  }

  const payload =
    `${razorpayOrderId}|${razorpayPaymentId}`;

  const expectedSignature =
    crypto
      .createHmac(
        "sha256",
        env.RAZORPAY_KEY_SECRET
      )
      .update(payload, "utf8")
      .digest("hex");

  const expectedBuffer =
    Buffer.from(expectedSignature, "utf8");

  const receivedBuffer =
    Buffer.from(
      razorpaySignature,
      "utf8"
    );

  if (
    expectedBuffer.length !==
    receivedBuffer.length
  ) {
    throw new AppError(
      "Invalid Razorpay payment signature",
      400,
      "INVALID_PAYMENT_SIGNATURE"
    );
  }

  if (
    !crypto.timingSafeEqual(
      expectedBuffer,
      receivedBuffer
    )
  ) {
    throw new AppError(
      "Invalid Razorpay payment signature",
      400,
      "INVALID_PAYMENT_SIGNATURE"
    );
  }

  return true;
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
      "You are not allowed to verify this payment",
      403,
      "PAYMENT_ACCESS_DENIED"
    );
  }

  return customer;
};

const decimalToMinorUnits = (value) => {
  const numericValue = Number(
    value.toString()
  );

  if (
    !Number.isFinite(numericValue) ||
    numericValue < 0
  ) {
    throw new AppError(
      "Invalid payment amount",
      500,
      "INVALID_PAYMENT_AMOUNT"
    );
  }

  const minorUnits = Math.round(
    numericValue * MINOR_UNIT_SCALE
  );

  if (!Number.isSafeInteger(minorUnits)) {
    throw new AppError(
      "Payment amount exceeds supported range",
      500,
      "PAYMENT_AMOUNT_OUT_OF_RANGE"
    );
  }

  return minorUnits;
};

const validateRazorpayPayment = ({
  razorpayPayment,
  payment,
  order,
}) => {
  if (!razorpayPayment) {
    throw new AppError(
      "Razorpay payment not found",
      404,
      "RAZORPAY_PAYMENT_NOT_FOUND"
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

  const expectedAmount =
    decimalToMinorUnits(order.grandTotal);

  if (
    razorpayPayment.amount !==
    expectedAmount
  ) {
    throw new AppError(
      "Razorpay payment amount does not match the order amount",
      409,
      "RAZORPAY_AMOUNT_MISMATCH"
    );
  }

  if (
    String(razorpayPayment.currency)
      .toUpperCase() !==
    String(order.currency)
      .toUpperCase()
  ) {
    throw new AppError(
      "Razorpay payment currency does not match the order currency",
      409,
      "RAZORPAY_CURRENCY_MISMATCH"
    );
  }

  if (
    payment.gatewayPaymentId &&
    payment.gatewayPaymentId !==
      razorpayPayment.id
  ) {
    throw new AppError(
      "Razorpay payment ID does not match the existing payment",
      409,
      "PAYMENT_ID_MISMATCH"
    );
  }

  return true;
};

const mapRazorpayStatus = (
  razorpayStatus
) => {
  switch (razorpayStatus) {
    case "created":
      return "created";

    case "authorized":
      return "authorized";

    case "captured":
      return "captured";

    case "failed":
      return "failed";

    default:
      throw new AppError(
        `Unsupported Razorpay payment status: ${razorpayStatus}`,
        409,
        "UNSUPPORTED_RAZORPAY_PAYMENT_STATUS"
      );
  }
};

const mapOrderPaymentStatus = (
  paymentStatus
) => {
  switch (paymentStatus) {
    case "authorized":
      return "authorized";

    case "captured":
      return "paid";

    case "failed":
      return "failed";

    default:
      return null;
  }
};

const updateOrderPaymentStatus = async (
  order,
  paymentStatus
) => {
  const nextOrderPaymentStatus =
    mapOrderPaymentStatus(paymentStatus);

  if (!nextOrderPaymentStatus) {
    return order;
  }

  if (
    order.paymentStatus ===
    nextOrderPaymentStatus
  ) {
    return order;
  }

  return orderRepository.updateById(
    order._id,
    {
      paymentStatus:
        nextOrderPaymentStatus,
    }
  );
};

const verifyRazorpayPayment = async ({
  orderId,
  userId,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) => {
  verifyRazorpaySignature({
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  });

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

  const payment =
    await paymentRepository.findByGatewayOrderId(
      PAYMENT_GATEWAY,
      razorpayOrderId
    );

  if (!payment) {
    throw new AppError(
      "Payment record not found",
      404,
      "PAYMENT_NOT_FOUND"
    );
  }

  if (
    payment.orderId.toString() !==
    order._id.toString()
  ) {
    throw new AppError(
      "Payment does not belong to this order",
      409,
      "PAYMENT_ORDER_MISMATCH"
    );
  }

  const razorpayPayment =
    await razorpayProvider.fetchPayment(
      razorpayPaymentId
    );

  validateRazorpayPayment({
    razorpayPayment,
    payment,
    order,
  });

  const nextStatus =
    mapRazorpayStatus(
      razorpayPayment.status
    );

  if (
    payment.status === nextStatus &&
    payment.gatewayPaymentId ===
      razorpayPayment.id
  ) {
    return payment;
  }

  if (
    payment.status !== nextStatus &&
    !canTransitionPaymentStatus(
      payment.status,
      nextStatus
    )
  ) {
    throw new AppError(
      `Invalid payment status transition from ${payment.status} to ${nextStatus}`,
      409,
      "INVALID_PAYMENT_STATUS_TRANSITION"
    );
  }

  const paymentUpdate = {
    gatewayPaymentId:
      razorpayPayment.id,
    status: nextStatus,
    method:
      razorpayPayment.method || null,
    failureReason:
      razorpayPayment.error_description ||
      null,
  };

  if (nextStatus === "captured") {
    paymentUpdate.capturedAt =
      razorpayPayment.captured_at
        ? new Date(
            razorpayPayment.captured_at * 1000
          )
        : new Date();
  }

  const updatedPayment =
    await paymentRepository.updateById(
      payment._id,
      paymentUpdate
    );

  await updateOrderPaymentStatus(
    order,
    nextStatus
  );

  return updatedPayment;
};

module.exports = {
  verifyRazorpaySignature,
  verifyRazorpayPayment,
};