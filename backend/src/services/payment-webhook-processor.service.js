const mongoose = require("mongoose");

const paymentRepository = require("../repositories/payment.repository");
const orderRepository = require("../repositories/order.repository");
const paymentWebhookEventRepository = require("../repositories/payment-webhook-event.repository");
const AppError = require("../errors/AppError");

const {
  canTransitionPaymentStatus,
} = require("../constants/payment.constants");

const { processRefundWebhook } = require("./refund-webhook.service");

const orderService = require("./order.service");
const razorpayProvider = require("../integrations/payments/razorpay.provider");
const logger = require("../config/logger");

const PAYMENT_GATEWAY = "razorpay";

const PAYMENT_EVENT_MAP = Object.freeze({
  "payment.authorized": "authorized",
  "payment.captured": "captured",
  "payment.failed": "failed",
  "order.paid": "captured",
});

const REFUND_EVENTS = new Set([
  "refund.created",
  "refund.processed",
  "refund.failed",
]);

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
  return String(currency || "")
    .trim()
    .toUpperCase();
};

const validateAmountAndCurrency = ({ razorpayPayment, payment, order }) => {
  if (razorpayPayment.amount !== undefined && razorpayPayment.amount !== null) {
    const localAmount = Number(payment.amount.toString());

    const razorpayAmount = Number(razorpayPayment.amount);

    if (
      !Number.isSafeInteger(razorpayAmount) ||
      !Number.isFinite(localAmount)
    ) {
      throw new AppError(
        "Invalid Razorpay payment amount",
        409,
        "INVALID_RAZORPAY_PAYMENT_AMOUNT",
      );
    }

    const expectedAmount = Math.round(localAmount * 100);

    if (razorpayAmount !== expectedAmount) {
      throw new AppError(
        "Razorpay payment amount does not match local payment",
        409,
        "RAZORPAY_AMOUNT_MISMATCH",
      );
    }
  }

  if (razorpayPayment.currency) {
    const razorpayCurrency = normalizeCurrency(razorpayPayment.currency);

    const expectedCurrency = normalizeCurrency(payment.currency);

    const orderCurrency = normalizeCurrency(order.currency);

    if (
      razorpayCurrency !== expectedCurrency ||
      razorpayCurrency !== orderCurrency
    ) {
      throw new AppError(
        "Razorpay payment currency does not match local payment",
        409,
        "RAZORPAY_CURRENCY_MISMATCH",
      );
    }
  }
};

const markEventProcessed = async ({ eventId, session, result }) => {
  await paymentWebhookEventRepository.markProcessed(eventId, { session });

  await session.commitTransaction();

  return result;
};

const synchronizeCapturedOrder = async ({ orderId, session }) => {
  return orderService.markOrderPaymentCaptured(orderId, { session });
};

const reconcileOrphanPayment = async ({
  razorpayPayment,
  razorpayOrder,
  session,
}) => {
  let buyboxOrderId = razorpayOrder?.notes?.buyboxOrderId;
  let fetchedOrder = null;

  if (!buyboxOrderId) {
    try {
      fetchedOrder = await razorpayProvider.fetchOrder(
        razorpayPayment.order_id
      );
      buyboxOrderId = fetchedOrder?.notes?.buyboxOrderId;
    } catch (fetchError) {
      logger.warn(
        {
          gatewayOrderId: razorpayPayment.order_id,
          error: fetchError.message,
        },
        "Failed to fetch Razorpay order during orphan reconciliation"
      );
      return null;
    }
  }

  if (
    !buyboxOrderId ||
    typeof buyboxOrderId !== "string" ||
    !mongoose.Types.ObjectId.isValid(buyboxOrderId.trim())
  ) {
    logger.warn(
      {
        gatewayOrderId: razorpayPayment.order_id,
        resolvedOrderId: buyboxOrderId || null,
      },
      "Orphan payment reconciliation failed: invalid or missing buyboxOrderId"
    );
    return null;
  }

  const normalizedBuyboxOrderId = buyboxOrderId.trim();

  const candidatePayment = await paymentRepository.findActiveByOrderId(
    normalizedBuyboxOrderId,
    { session }
  );

  if (!candidatePayment) {
    return null;
  }

  if (
    candidatePayment.gateway !== PAYMENT_GATEWAY ||
    candidatePayment.status !== "created" ||
    candidatePayment.gatewayOrderId !== null ||
    candidatePayment.orderId.toString() !== normalizedBuyboxOrderId
  ) {
    return null;
  }

  const localOrder = await orderRepository.findById(
    candidatePayment.orderId,
    { session }
  );

  if (!localOrder) {
    return null;
  }

  if (
    razorpayOrder?.id &&
    razorpayOrder.id !== razorpayPayment.order_id
  ) {
    return null;
  }

  if (
    fetchedOrder?.id &&
    fetchedOrder.id !== razorpayPayment.order_id
  ) {
    return null;
  }

  const orderNumberNote =
    razorpayOrder?.notes?.orderNumber ||
    fetchedOrder?.notes?.orderNumber;

  if (
    orderNumberNote &&
    String(orderNumberNote).trim() !== String(localOrder.orderNumber).trim()
  ) {
    logger.warn(
      {
        gatewayOrderId: razorpayPayment.order_id,
        orderNumberNote,
        expectedOrderNumber: localOrder.orderNumber,
      },
      "Orphan reconciliation aborted: orderNumber mismatch"
    );
    return null;
  }

  try {
    validateAmountAndCurrency({
      razorpayPayment,
      payment: candidatePayment,
      order: localOrder,
    });
  } catch (validationError) {
    logger.warn(
      {
        gatewayOrderId: razorpayPayment.order_id,
        error: validationError.message,
      },
      "Orphan reconciliation aborted: amount/currency validation failed"
    );
    return null;
  }

  const linkedPayment = await paymentRepository.linkOrphanGatewayOrderId(
    candidatePayment._id,
    razorpayPayment.order_id,
    { session }
  );

  if (linkedPayment) {
    logger.info(
      {
        paymentId: linkedPayment._id,
        orderId: localOrder._id,
        gatewayOrderId: razorpayPayment.order_id,
      },
      "Orphan payment successfully linked to gateway order"
    );
    return linkedPayment;
  }

  const freshPayment = await paymentRepository.findById(
    candidatePayment._id,
    { session }
  );

  if (freshPayment?.gatewayOrderId === razorpayPayment.order_id) {
    logger.info(
      {
        paymentId: freshPayment._id,
        orderId: localOrder._id,
        gatewayOrderId: razorpayPayment.order_id,
      },
      "Orphan payment was concurrently linked with matching gateway order"
    );
    return freshPayment;
  }

  logger.warn(
    {
      paymentId: candidatePayment._id,
      freshGatewayOrderId: freshPayment?.gatewayOrderId || null,
      freshStatus: freshPayment?.status || null,
    },
    "Orphan payment conditional linkage lost race to different gateway state"
  );
  return null;
};

const processPaymentWebhookEvent = async (eventId) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const webhookEvent = await paymentWebhookEventRepository.findByEventId(
      eventId,
      { session },
    );

    if (!webhookEvent) {
      throw new AppError(
        "Webhook event not found",
        404,
        "WEBHOOK_EVENT_NOT_FOUND",
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

    await paymentWebhookEventRepository.markProcessing(eventId, { session });

    const eventType = webhookEvent.eventType;

    const nextStatus = PAYMENT_EVENT_MAP[eventType];

    /*
     * Refund webhooks are handled by the
     * refund-specific processor.
     */
    if (REFUND_EVENTS.has(eventType)) {
      const result = await processRefundWebhook({
        eventType,
        payload: webhookEvent.payload,
        session,
      });

      return await markEventProcessed({
        eventId,
        session,
        result: {
          ...result,
          eventId,
        },
      });
    }

    /*
     * Ignore events that are not part of the
     * payment state machine.
     */
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

    const razorpayPayment = getPaymentEntity(webhookEvent.payload);

    const razorpayOrder = getOrderEntity(webhookEvent.payload);

    /*
     * payment.authorized / payment.captured /
     * payment.failed contain payment.entity.
     *
     * order.paid is order-level, but the payload
     * also contains payment.entity.
     */
    if (!razorpayPayment?.id || !razorpayPayment?.order_id) {
      throw new AppError(
        "Invalid Razorpay payment webhook payload",
        400,
        "INVALID_PAYMENT_WEBHOOK_PAYLOAD",
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
        "RAZORPAY_ORDER_PAYMENT_MISMATCH",
      );
    }

    let payment = await paymentRepository.findByGatewayOrderId(
      PAYMENT_GATEWAY,
      razorpayPayment.order_id,
      { session },
    );

    if (!payment) {
      payment = await reconcileOrphanPayment({
        razorpayPayment,
        razorpayOrder,
        session,
      });
    }

    if (!payment) {
      throw new AppError(
        "Local payment record not found",
        404,
        "PAYMENT_NOT_FOUND",
      );
    }

    const order = await orderRepository.findById(payment.orderId, { session });

    if (!order) {
      throw new AppError(
        "Local order record not found",
        404,
        "ORDER_NOT_FOUND",
      );
    }

    if (payment.gateway !== PAYMENT_GATEWAY) {
      throw new AppError(
        "Unsupported payment gateway",
        409,
        "UNSUPPORTED_PAYMENT_GATEWAY",
      );
    }

    if (
      payment.gatewayPaymentId &&
      payment.gatewayPaymentId !== razorpayPayment.id
    ) {
      throw new AppError(
        "Razorpay payment ID does not match local payment",
        409,
        "RAZORPAY_PAYMENT_ID_MISMATCH",
      );
    }

    if (razorpayPayment.order_id !== payment.gatewayOrderId) {
      throw new AppError(
        "Razorpay payment does not belong to local payment order",
        409,
        "RAZORPAY_ORDER_MISMATCH",
      );
    }

    validateAmountAndCurrency({
      razorpayPayment,
      payment,
      order,
    });

    /*
     * Captured/order.paid events must always synchronize
     * the order, even when the local payment is already
     * captured.
     *
     * This makes duplicate/out-of-order webhook handling
     * idempotent without losing order synchronization.
     */
    if (nextStatus === "captured" && payment.status === "captured") {
      await synchronizeCapturedOrder({
        orderId: payment.orderId,
        session,
      });

      return await markEventProcessed({
        eventId,
        session,
        result: {
          processed: true,
          ignored: true,
          reason: "PAYMENT_ALREADY_CAPTURED_ORDER_SYNCHRONIZED",
          eventId,
          eventType,
          paymentId: payment._id,
          paymentStatus: payment.status,
          orderStatus: "confirmed",
          orderPaymentStatus: "paid",
        },
      });
    }

    /*
     * Same-state events other than captured are simply
     * treated as already processed.
     */
    if (payment.status === nextStatus) {
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

    /*
     * Webhooks can arrive out of order.
     * Never move a payment backwards.
     */
    if (!canTransitionPaymentStatus(payment.status, nextStatus)) {
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
      gatewayPaymentId: razorpayPayment.id,
      method: razorpayPayment.method || payment.method || null,
    };

    if (nextStatus === "failed") {
      update.failureReason =
        razorpayPayment.error_description ||
        razorpayPayment.error_reason ||
        "Razorpay payment failed";
    }

    if (nextStatus === "captured") {
      update.capturedAt = getCapturedAt(razorpayPayment);

      update.failureReason = null;
    }

    const updatedPayment = await paymentRepository.updateById(
      payment._id,
      update,
      { session },
    );

    if (!updatedPayment) {
      throw new AppError(
        "Unable to update payment",
        500,
        "PAYMENT_UPDATE_FAILED",
      );
    }

    /*
     * Captured/order.paid:
     *
     * Payment -> captured
     * Order.paymentStatus -> paid
     * Order.status pending -> confirmed
     *
     * All are synchronized through the canonical
     * order service helper inside the same transaction.
     */
    if (nextStatus === "captured") {
      const updatedOrder = await synchronizeCapturedOrder({
        orderId: payment.orderId,
        session,
      });

      return await markEventProcessed({
        eventId,
        session,
        result: {
          processed: true,
          eventId,
          eventType,
          paymentId: updatedPayment._id,
          paymentStatus: updatedPayment.status,
          orderId: updatedOrder._id,
          orderStatus: updatedOrder.status,
          orderPaymentStatus: updatedOrder.paymentStatus,
        },
      });
    }

    /*
     * Authorized / failed payment states do not confirm
     * the order.
     */
    const orderPaymentStatus =
      nextStatus === "authorized" ? "authorized" : "failed";

    const updatedOrder = await orderRepository.updateById(
      payment.orderId,
      {
        paymentStatus: orderPaymentStatus,
      },
      { session },
    );

    if (!updatedOrder) {
      throw new AppError(
        "Unable to update order payment status",
        500,
        "ORDER_PAYMENT_STATUS_UPDATE_FAILED",
      );
    }

    return await markEventProcessed({
      eventId,
      session,
      result: {
        processed: true,
        eventId,
        eventType,
        paymentId: updatedPayment._id,
        paymentStatus: updatedPayment.status,
        orderId: updatedOrder._id,
        orderStatus: updatedOrder.status,
        orderPaymentStatus: updatedOrder.paymentStatus,
      },
    });
  } catch (error) {
    try {
      await session.abortTransaction();
    } catch (abortError) {
      // Preserve the original processing error.
    }

    try {
      await paymentWebhookEventRepository.markFailed(eventId, error.message);
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
