const mongoose = require("mongoose");

const refundRepository = require("../repositories/refund.repository");
const paymentRepository = require("../repositories/payment.repository");
const orderRepository = require("../repositories/order.repository");

const Customer = require("../models/Customer");
const User = require("../models/User");

const razorpayRefundProvider = require(
  "../integrations/payments/razorpay-refund.provider"
);

const notificationService = require("./notification");

const {
  canTransitionRefundStatus,
} = require("../constants/refund.constants");

const {
  canTransitionPaymentStatus,
} = require("../constants/payment.constants");

const AppError = require("../errors/AppError");

const REFUND_GATEWAY = "razorpay";
const MINOR_UNIT_SCALE = 100;

const REFUND_EVENT_MAP = Object.freeze({
  "refund.created": "pending",
  "refund.processed": "processed",
  "refund.failed": "failed",
});

const getRefundEntity = (payload) => {
  return payload?.payload?.refund?.entity || null;
};

const decimalToMinorUnits = (value) => {
  if (value === null || value === undefined) {
    throw new AppError(
      "Invalid refund amount",
      409,
      "INVALID_REFUND_AMOUNT"
    );
  }

  const normalizedValue = value
    .toString()
    .trim();

  if (!/^\d+(\.\d+)?$/.test(normalizedValue)) {
    throw new AppError(
      "Invalid refund amount",
      409,
      "INVALID_REFUND_AMOUNT"
    );
  }

  const [
    wholePart,
    decimalPart = "",
  ] = normalizedValue.split(".");

  if (decimalPart.length > 2) {
    throw new AppError(
      "Invalid refund amount",
      409,
      "INVALID_REFUND_AMOUNT"
    );
  }

  const minorUnits =
    Number(wholePart) * MINOR_UNIT_SCALE +
    Number(decimalPart.padEnd(2, "0"));

  if (!Number.isSafeInteger(minorUnits)) {
    throw new AppError(
      "Refund amount exceeds supported range",
      409,
      "REFUND_AMOUNT_OUT_OF_RANGE"
    );
  }

  return minorUnits;
};

const minorUnitsToDecimal = (minorUnits) => {
  if (!Number.isSafeInteger(minorUnits)) {
    throw new AppError(
      "Invalid refund amount",
      409,
      "INVALID_REFUND_AMOUNT"
    );
  }

  return (
    minorUnits / MINOR_UNIT_SCALE
  ).toFixed(2);
};

const getProcessedRefundTotal = async (
  paymentId,
  options = {}
) => {
  const refunds =
    await refundRepository.findByPaymentId(
      paymentId,
      options
    );

  return refunds.reduce(
    (total, refund) => {
      if (refund.status !== "processed") {
        return total;
      }

      return (
        total +
        decimalToMinorUnits(refund.amount)
      );
    },
    0
  );
};

const releaseRefundReservation = async ({
  paymentId,
  amount,
  session,
}) => {
  const releasedPayment =
    await paymentRepository.releaseRefundReservation(
      paymentId,
      amount,
      session ? { session } : {}
    );

  if (!releasedPayment) {
    throw new AppError(
      "Unable to release refund reservation",
      500,
      "REFUND_RESERVATION_RELEASE_FAILED"
    );
  }

  return releasedPayment;
};

const synchronizePaymentRefundState = async ({
  payment,
  order,
  options = {},
}) => {
  const refundedTotal =
    await getProcessedRefundTotal(
      payment._id,
      options
    );

  const paymentAmount =
    decimalToMinorUnits(payment.amount);

  if (refundedTotal > paymentAmount) {
    throw new AppError(
      "Refund total exceeds payment amount",
      409,
      "REFUND_TOTAL_EXCEEDS_PAYMENT"
    );
  }

  const refundedAmount =
    minorUnitsToDecimal(refundedTotal);

  let paymentStatus = payment.status;
  let orderPaymentStatus =
    order.paymentStatus;

  if (refundedTotal === 0) {
    paymentStatus = "captured";
    orderPaymentStatus = "paid";
  } else if (
    refundedTotal < paymentAmount
  ) {
    paymentStatus = "partially_refunded";
    orderPaymentStatus =
      "partially_refunded";
  } else {
    paymentStatus = "refunded";
    orderPaymentStatus = "refunded";
  }

  if (
    payment.status !== paymentStatus &&
    !canTransitionPaymentStatus(
      payment.status,
      paymentStatus
    )
  ) {
    throw new AppError(
      `Invalid payment status transition from ${payment.status} to ${paymentStatus}`,
      409,
      "INVALID_PAYMENT_STATUS_TRANSITION"
    );
  }

  const updatedPayment =
    await paymentRepository.updateById(
      payment._id,
      {
        status: paymentStatus,
        refundedAmount,
      },
      options
    );

  if (!updatedPayment) {
    throw new AppError(
      "Unable to synchronize payment refund state",
      500,
      "PAYMENT_REFUND_STATE_UPDATE_FAILED"
    );
  }

  const updatedOrder =
    await orderRepository.updateById(
      order._id,
      {
        paymentStatus:
          orderPaymentStatus,
      },
      options
    );

  if (!updatedOrder) {
    throw new AppError(
      "Unable to synchronize order refund state",
      500,
      "ORDER_REFUND_STATE_UPDATE_FAILED"
    );
  }

  return {
    updatedPayment,
    updatedOrder,
    refundedAmount,
    refundedTotal,
    paymentStatus,
    orderPaymentStatus,
  };
};

/**
 * Send refund confirmation email.
 *
 * This is an external side effect and must never
 * invalidate an already successful refund.
 */
const sendRefundConfirmationNotification =
  async ({
    order,
    refundAmount,
  }) => {
    try {
      const customer =
        await Customer.findById(
          order.customerId
        ).lean();

      if (!customer?.userId) {
        return;
      }

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
        .sendRefundConfirmation({
          to: user.email,
          customerName,
          orderNumber:
            order.orderNumber,
          amount: refundAmount,
        });
    } catch (error) {
      console.error(
        "Refund webhook confirmation notification failed:",
        error
      );
    }
  };

const processRefundWebhook = async ({
  eventType,
  payload,
  session: providedSession = null,
}) => {
  const nextStatus =
    REFUND_EVENT_MAP[eventType];

  if (!nextStatus) {
    return {
      processed: true,
      ignored: true,
      reason: "UNSUPPORTED_REFUND_EVENT",
    };
  }

  const razorpayRefund =
    getRefundEntity(payload);

  if (
    !razorpayRefund?.id ||
    !razorpayRefund?.payment_id
  ) {
    throw new AppError(
      "Invalid Razorpay refund webhook payload",
      400,
      "INVALID_REFUND_WEBHOOK_PAYLOAD"
    );
  }

  const ownsSession = !providedSession;

  const session =
    providedSession ||
    (await mongoose.startSession());

  try {
    if (ownsSession) {
      session.startTransaction();
    }

    const refund =
      await refundRepository.findByGatewayRefundId(
        REFUND_GATEWAY,
        razorpayRefund.id,
        { session }
      );

    if (!refund) {
      throw new AppError(
        "Local refund record not found",
        404,
        "REFUND_NOT_FOUND"
      );
    }

    const payment =
      await paymentRepository.findById(
        refund.paymentId,
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
        refund.orderId,
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
      payment.gateway !== REFUND_GATEWAY
    ) {
      throw new AppError(
        "Unsupported payment gateway",
        409,
        "UNSUPPORTED_PAYMENT_GATEWAY"
      );
    }

    if (
      payment.gatewayPaymentId !==
      razorpayRefund.payment_id
    ) {
      throw new AppError(
        "Razorpay refund payment does not match local payment",
        409,
        "REFUND_PAYMENT_MISMATCH"
      );
    }

    if (
      razorpayRefund.amount !== undefined &&
      razorpayRefund.amount !== null
    ) {
      const localRefundAmount =
        decimalToMinorUnits(
          refund.amount
        );

      if (
        Number(razorpayRefund.amount) !==
        localRefundAmount
      ) {
        throw new AppError(
          "Razorpay refund amount does not match local refund",
          409,
          "REFUND_AMOUNT_MISMATCH"
        );
      }
    }

    /**
     * Duplicate webhook for the same refund state.
     */
    if (
      refund.status === nextStatus
    ) {
      if (ownsSession) {
        await session.commitTransaction();
      }

      return {
        processed: true,
        ignored: true,
        reason:
          "REFUND_ALREADY_IN_TARGET_STATE",
        refundId: refund._id,
        refundStatus: refund.status,
      };
    }

    /**
     * Ignore stale/out-of-order refund events.
     */
    if (
      !canTransitionRefundStatus(
        refund.status,
        nextStatus
      )
    ) {
      if (ownsSession) {
        await session.commitTransaction();
      }

      return {
        processed: true,
        ignored: true,
        reason:
          "INVALID_OR_STALE_REFUND_TRANSITION",
        refundId: refund._id,
        refundStatus: refund.status,
        ignoredStatus: nextStatus,
      };
    }

    const update = {
      status: nextStatus,
      gatewayRefundId:
        razorpayRefund.id,
    };

    if (nextStatus === "pending") {
      update.failureReason = null;
      update.processedAt = null;
    }

    if (nextStatus === "failed") {
      update.failureReason =
        razorpayRefund.error_description ||
        razorpayRefund.error_reason ||
        "Razorpay refund failed";

      update.processedAt = null;
    }

    if (nextStatus === "processed") {
      update.failureReason = null;

      update.processedAt =
        razorpayRefund.created_at
          ? new Date(
              Number(
                razorpayRefund.created_at
              ) * 1000
            )
          : new Date();
    }

    const updatedRefund =
      await refundRepository.updateById(
        refund._id,
        update,
        { session }
      );

    if (!updatedRefund) {
      throw new AppError(
        "Unable to update refund",
        500,
        "REFUND_UPDATE_FAILED"
      );
    }

    /**
     * Both processed and failed refund states
     * release the temporary refund reservation.
     */
    if (
      nextStatus === "processed" ||
      nextStatus === "failed"
    ) {
      await releaseRefundReservation({
        paymentId: payment._id,
        amount: refund.amount,
        session,
      });
    }

    const syncResult =
      await synchronizePaymentRefundState({
        payment,
        order,
        options: { session },
      });

    /**
     * Commit the transaction before sending
     * any external notification.
     */
    if (ownsSession) {
      await session.commitTransaction();
    }

    /**
     * Send refund confirmation only after
     * the refund transaction has committed.
     *
     * If another service owns the transaction,
     * the caller is responsible for committing it,
     * so the notification must not be sent here.
     */
    if (
      ownsSession &&
      nextStatus === "processed"
    ) {
      await sendRefundConfirmationNotification({
        order:
          syncResult.updatedOrder ||
          order,
        refundAmount:
          refund.amount,
      });
    }

    return {
      processed: true,
      eventType,
      refundId: updatedRefund._id,
      refundStatus:
        updatedRefund.status,
      paymentId:
        syncResult.updatedPayment._id,
      paymentStatus:
        syncResult.updatedPayment.status,
      orderPaymentStatus:
        syncResult.updatedOrder.paymentStatus,
      refundedAmount:
        syncResult.updatedPayment
          .refundedAmount,
    };
  } catch (error) {
    if (ownsSession) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        // Preserve original error.
      }
    }

    throw error;
  } finally {
    if (ownsSession) {
      await session.endSession();
    }
  }
};

module.exports = {
  processRefundWebhook,
  decimalToMinorUnits,
  minorUnitsToDecimal,
  getProcessedRefundTotal,
  synchronizePaymentRefundState,
};

