const mongoose = require("mongoose");

const paymentRepository = require("../repositories/payment.repository");
const orderRepository = require("../repositories/order.repository");
const paymentWebhookEventRepository = require("../repositories/payment-webhook-event.repository");
const AppError = require("../errors/AppError");

const {
  canTransitionPaymentStatus,
} = require("../constants/payment.constants");

const PAYMENT_GATEWAY = "razorpay";

const PAYMENT_EVENT_MAP = Object.freeze({
  "payment.authorized": "authorized",
  "payment.captured": "captured",
  "payment.failed": "failed",
  "order.paid": "captured",
});

const getPaymentEntity = (payload) => {
  return payload?.payload?.payment?.entity || null;
};

const getOrderEntity = (payload) => {
  return payload?.payload?.order?.entity || null;
};

const getCapturedAt = (razorpayPayment) => {
  if (
    razorpayPayment?.captured_at !== undefined &&
    razorpayPayment?.captured_at !== null
  ) {
    return new Date(Number(razorpayPayment.captured_at) * 1000);
  }

  return new Date();
};

const normalizeCurrency = (currency) => {
  return String(currency || "").trim().toUpperCase();
};

const validateAmountAndCurrency = ({
  razorpayPayment,
  payment,
  order,
}) => {
  if (
    razorpayPayment.amount !== undefined &&
    razorpayPayment.amount !== null
  ) {
    const localAmount = Number(
      payment.amount.toString()
    );

    const razorpayAmount = Number(
      razorpayPayment.amount
    );

    if (
      !Number.isSafeInteger(razorpayAmount) ||
      !Number.isFinite(localAmount)
    ) {
      throw new AppError(
        "Invalid Razorpay payment amount",
        409,
        "INVALID_RAZORPAY_PAYMENT_AMOUNT"
      );
    }

    const expectedAmount = Math.round(
      localAmount * 100
    );

    if (razorpayAmount !== expectedAmount) {
      throw new AppError(
        "Razorpay payment amount does not match local payment",
        409,
        "RAZORPAY_AMOUNT_MISMATCH"
      );
    }
  }

  if (razorpayPayment.currency) {
    const razorpayCurrency =
      normalizeCurrency(razorpayPayment.currency);

    const expectedCurrency =
      normalizeCurrency(payment.currency);

    const orderCurrency =
      normalizeCurrency(order.currency);

    if (
      razorpayCurrency !== expectedCurrency ||
      razorpayCurrency !== orderCurrency
    ) {
      throw new AppError(
        "Razorpay payment currency does not match local payment",
        409,
        "RAZORPAY_CURRENCY_MISMATCH"
      );
    }
  }
};

const markEventProcessed = async ({
  eventId,
  session,
  result,
}) => {
  await paymentWebhookEventRepository.markProcessed(
    eventId,
    { session }
  );

  await session.commitTransaction();

  return result;
};

const processPaymentWebhookEvent = async (
  eventId
) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const webhookEvent =
      await paymentWebhookEventRepository.findByEventId(
        eventId,
        { session }
      );

    if (!webhookEvent) {
      throw new AppError(
        "Webhook event not found",
        404,
        "WEBHOOK_EVENT_NOT_FOUND"
      );
    }

    if (webhookEvent.status === "processed") {
      await session.commitTransaction();

      return {
        processed: true,
        duplicate: true,
        eventId,
      };
    }

    await paymentWebhookEventRepository.markProcessing(
      eventId,
      { session }
    );

    const eventType = webhookEvent.eventType;
    const nextStatus =
      PAYMENT_EVENT_MAP[eventType];

    if (!nextStatus) {
      return await markEventProcessed({
        eventId,
        session,
        result: {
          processed: true,
          ignored: true,
          eventId,
          eventType,
          reason: "UNSUPPORTED_EVENT",
        },
      });
    }

    const razorpayPayment =
      getPaymentEntity(webhookEvent.payload);

    const razorpayOrder =
      getOrderEntity(webhookEvent.payload);

    /*
     * payment.authorized / payment.captured /
     * payment.failed contain payment.entity.
     *
     * order.paid is order-level, but Razorpay's
     * payload also contains payment.entity.
     */
    if (
      !razorpayPayment?.id ||
      !razorpayPayment?.order_id
    ) {
      throw new AppError(
        "Invalid Razorpay payment webhook payload",
        400,
        "INVALID_PAYMENT_WEBHOOK_PAYLOAD"
      );
    }

    if (
      eventType === "order.paid" &&
      razorpayOrder?.id &&
      razorpayOrder.id !== razorpayPayment.order_id
    ) {
      throw new AppError(
        "Razorpay order and payment IDs do not match",
        409,
        "RAZORPAY_ORDER_PAYMENT_MISMATCH"
      );
    }

    const payment =
      await paymentRepository.findByGatewayOrderId(
        PAYMENT_GATEWAY,
        razorpayPayment.order_id,
        { session }
      );

    if (!payment) {
      throw new AppError(
        "Local payment record not found",
        404,
        "PAYMENT_NOT_FOUND"
      );
    }

    const order =
      await orderRepository.findById(
        payment.orderId,
        { session }
      );

    if (!order) {
      throw new AppError(
        "Local order record not found",
        404,
        "ORDER_NOT_FOUND"
      );
    }

    if (
      payment.gateway !== PAYMENT_GATEWAY
    ) {
      throw new AppError(
        "Unsupported payment gateway",
        409,
        "UNSUPPORTED_PAYMENT_GATEWAY"
      );
    }

    if (
      payment.gatewayPaymentId &&
      payment.gatewayPaymentId !==
        razorpayPayment.id
    ) {
      throw new AppError(
        "Razorpay payment ID does not match local payment",
        409,
        "RAZORPAY_PAYMENT_ID_MISMATCH"
      );
    }

    if (
      razorpayPayment.order_id !==
      payment.gatewayOrderId
    ) {
      throw new AppError(
        "Razorpay payment does not belong to local payment order",
        409,
        "RAZORPAY_ORDER_MISMATCH"
      );
    }

    validateAmountAndCurrency({
      razorpayPayment,
      payment,
      order,
    });

    /*
     * State-machine protection.
     *
     * Webhooks can arrive out of order. A stale event
     * must never move the local payment backwards.
     */
    if (
      payment.status === nextStatus
    ) {
      return await markEventProcessed({
        eventId,
        session,
        result: {
          processed: true,
          ignored: true,
          reason: "PAYMENT_ALREADY_IN_TARGET_STATE",
          eventId,
          eventType,
          paymentId: payment._id,
          paymentStatus: payment.status,
        },
      });
    }

    if (
      !canTransitionPaymentStatus(
        payment.status,
        nextStatus
      )
    ) {
      return await markEventProcessed({
        eventId,
        session,
        result: {
          processed: true,
          ignored: true,
          reason: "INVALID_OR_STALE_PAYMENT_TRANSITION",
          eventId,
          eventType,
          paymentId: payment._id,
          paymentStatus: payment.status,
          ignoredStatus: nextStatus,
        },
      });
    }

    const update = {
      status: nextStatus,
      gatewayPaymentId:
        razorpayPayment.id,
      method:
        razorpayPayment.method ||
        payment.method ||
        null,
    };

    if (nextStatus === "failed") {
      update.failureReason =
        razorpayPayment.error_description ||
        razorpayPayment.error_reason ||
        "Razorpay payment failed";
    }

    if (nextStatus === "captured") {
      update.capturedAt =
        getCapturedAt(razorpayPayment);

      update.failureReason = null;
    }

    const updatedPayment =
      await paymentRepository.updateById(
        payment._id,
        update,
        { session }
      );

    if (!updatedPayment) {
      throw new AppError(
        "Unable to update payment",
        500,
        "PAYMENT_UPDATE_FAILED"
      );
    }

    const orderPaymentStatus =
      nextStatus === "captured"
        ? "paid"
        : nextStatus === "authorized"
          ? "authorized"
          : "failed";

    await orderRepository.updateById(
      payment.orderId,
      {
        paymentStatus: orderPaymentStatus,
      },
      { session }
    );

    return await markEventProcessed({
      eventId,
      session,
      result: {
        processed: true,
        eventId,
        eventType,
        paymentId: updatedPayment._id,
        paymentStatus:
          updatedPayment.status,
        orderPaymentStatus,
      },
    });
  } catch (error) {
    try {
      await session.abortTransaction();
    } catch (abortError) {
      // Preserve the original processing error.
    }

    try {
      await paymentWebhookEventRepository.markFailed(
        eventId,
        error.message
      );
    } catch (markFailedError) {
      // Do not mask the original webhook-processing error.
    }

    throw error;
  } finally {
    await session.endSession();
  }
};

module.exports = {
  processPaymentWebhookEvent,
};