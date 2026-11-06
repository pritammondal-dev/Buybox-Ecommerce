const { razorpay } = require("../../config/payment");
const logger = require("../../config/logger");
const AppError = require("../../errors/AppError");

const getRazorpayErrorDetails = (error) => {
  return {
    statusCode:
      error?.statusCode ??
      error?.error?.statusCode ??
      null,

    code:
      error?.error?.code ??
      error?.code ??
      null,

    description:
      error?.error?.description ??
      error?.description ??
      null,

    reason:
      error?.error?.reason ??
      error?.reason ??
      null,
  };
};

const isTimeoutOrNetworkError = (error) => {
  const code = error?.code || error?.error?.code;
  const status =
    error?.statusCode ??
    error?.error?.statusCode ??
    error?.status;
  const message = String(error?.message || "").toLowerCase();
  return (
    code === "ECONNABORTED" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "ENOTFOUND" ||
    status === 504 ||
    status === 503 ||
    status === 502 ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("network")
  );
};

const createRefund = async ({
  paymentId,
  amount,
  notes = {},
}) => {
  try {
    return await razorpay.payments.refund(paymentId, {
      amount,
      notes,
    });
  } catch (error) {
    const details = getRazorpayErrorDetails(error);

    logger.error(
      {
        razorpayStatusCode: details.statusCode,
        razorpayCode: details.code,
        razorpayDescription: details.description,
        razorpayReason: details.reason,
        razorpayPaymentId: paymentId,
      },
      "Razorpay refund creation failed"
    );

    if (isTimeoutOrNetworkError(error)) {
      const timeoutError = new AppError(
        "Razorpay refund request timed out or experienced network uncertainty",
        504,
        "GATEWAY_TIMEOUT"
      );
      timeoutError.isTimeout = true;
      throw timeoutError;
    }

    throw new AppError(
      "Unable to create Razorpay refund",
      502,
      "RAZORPAY_REFUND_CREATION_FAILED"
    );
  }
};

const fetchRefund = async (refundId) => {
  try {
    return await razorpay.refunds.fetch(refundId);
  } catch (error) {
    const details = getRazorpayErrorDetails(error);

    logger.error(
      {
        razorpayStatusCode: details.statusCode,
        razorpayCode: details.code,
        razorpayDescription: details.description,
        razorpayReason: details.reason,
        razorpayRefundId: refundId,
      },
      "Razorpay refund fetch failed"
    );

    throw new AppError(
      "Unable to fetch Razorpay refund",
      502,
      "RAZORPAY_REFUND_FETCH_FAILED"
    );
  }
};

module.exports = {
  createRefund,
  fetchRefund,
};
