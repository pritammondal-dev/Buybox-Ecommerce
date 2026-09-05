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
