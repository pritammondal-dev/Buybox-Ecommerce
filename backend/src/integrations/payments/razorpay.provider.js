const { razorpay } = require("../../config/payment");
const AppError = require("../../errors/AppError");

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

module.exports = {
  createOrder,
  fetchPayment,
  capturePayment,
};