const axios = require("axios");

const { razorpay } = require("../../config/payment");
const env = require("../../config/env");
const AppError = require("../../errors/AppError");

const RAZORPAY_API_BASE_URL = "https://api.razorpay.com/v1";

const createOrder = async ({
  amount,
  currency,
  receipt,
  notes = {},
}) => {
  try {
    return await razorpay.orders.create({
      amount,
      currency,
      receipt,
      notes,
    });
  } catch (error) {
    throw new AppError(
      "Unable to create Razorpay order",
      502,
      "RAZORPAY_ORDER_CREATION_FAILED"
    );
  }
};

const fetchOrder = async (orderId) => {
  if (!orderId || typeof orderId !== "string" || !orderId.trim()) {
    throw new AppError(
      "Invalid Razorpay order ID",
      400,
      "INVALID_GATEWAY_ORDER_ID"
    );
  }

  try {
    return await razorpay.orders.fetch(orderId.trim());
  } catch (error) {
    throw new AppError(
      "Unable to fetch Razorpay order",
      502,
      "RAZORPAY_ORDER_FETCH_FAILED"
    );
  }
};

const fetchOrderPayments = async (orderId) => {
  if (!orderId || typeof orderId !== "string" || !orderId.trim()) {
    throw new AppError(
      "Invalid Razorpay order ID",
      400,
      "INVALID_GATEWAY_ORDER_ID"
    );
  }

  try {
    return await razorpay.orders.fetchPayments(orderId.trim());
  } catch (error) {
    throw new AppError(
      "Unable to fetch Razorpay order payments",
      502,
      "RAZORPAY_ORDER_PAYMENTS_FETCH_FAILED"
    );
  }
};

const fetchOrdersByReceipt = async (receipt) => {
  if (!receipt || typeof receipt !== "string" || !receipt.trim()) {
    throw new AppError(
      "Invalid receipt identifier",
      400,
      "INVALID_RECEIPT"
    );
  }

  try {
    return await razorpay.orders.all({
      receipt: receipt.trim(),
    });
  } catch (error) {
    throw new AppError(
      "Unable to fetch Razorpay orders by receipt",
      502,
      "RAZORPAY_ORDER_RECEIPT_FETCH_FAILED"
    );
  }
};

const fetchPayment = async (paymentId) => {
  try {
    return await razorpay.payments.fetch(paymentId);
  } catch (error) {
    throw new AppError(
      "Unable to fetch Razorpay payment",
      502,
      "RAZORPAY_PAYMENT_FETCH_FAILED"
    );
  }
};

const capturePayment = async ({
  paymentId,
  amount,
  currency,
}) => {
  try {
    return await razorpay.payments.capture(
      paymentId,
      amount,
      currency
    );
  } catch (error) {
    throw new AppError(
      "Unable to capture Razorpay payment",
      502,
      "RAZORPAY_PAYMENT_CAPTURE_FAILED"
    );
  }
};

const refundPayment = async ({
  paymentId,
  amount,
  notes = {},
  idempotencyKey,
}) => {
  try {
    const response = await axios.post(
      `${RAZORPAY_API_BASE_URL}/payments/${paymentId}/refund`,
      {
        amount,
        notes,
      },
      {
        auth: {
          username: env.RAZORPAY_KEY_ID,
          password: env.RAZORPAY_KEY_SECRET,
        },
        headers: {
          "Content-Type": "application/json",
          "X-Refund-Idempotency": idempotencyKey,
        },
        timeout: 10000,
      }
    );

    return response.data;
  } catch (error) {
    throw new AppError(
      "Unable to refund Razorpay payment",
      502,
      "RAZORPAY_PAYMENT_REFUND_FAILED"
    );
  }
};

module.exports = {
  createOrder,
  fetchOrder,
  fetchOrderPayments,
  fetchOrdersByReceipt,
  fetchPayment,
  capturePayment,
  refundPayment,
};
