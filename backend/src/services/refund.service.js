const mongoose = require("mongoose");

const paymentRepository = require("../repositories/payment.repository");
const refundRepository = require("../repositories/refund.repository");
const orderRepository = require("../repositories/order.repository");

const Customer = require("../models/Customer");
const User = require("../models/User");

const razorpayRefundProvider = require(
  "../integrations/payments/razorpay-refund.provider"
);

const notificationService = require("./notification");

const AppError = require("../errors/AppError");

const {
  canTransitionRefundStatus,
} = require("../constants/refund.constants");

const {
  canTransitionPaymentStatus,
} = require("../constants/payment.constants");

const PAYMENT_GATEWAY = "razorpay";
const MINOR_UNIT_SCALE = 100;

const REFUNDABLE_PAYMENT_STATUSES = [
  "captured",
  "partially_refunded",
];

const decimalToMinorUnits = (value) => {
  if (value === null || value === undefined) {
    throw new AppError(
      "Invalid refund amount",
      500,
      "INVALID_REFUND_AMOUNT"
    );
  }

  const normalizedValue = value
    .toString()
    .trim();

  if (!/^\d+(\.\d+)?$/.test(normalizedValue)) {
    throw new AppError(
      "Invalid refund amount",
      500,
      "INVALID_REFUND_AMOUNT"
    );
  }

  const [
    wholePart,
    decimalPart = "",
  ] = normalizedValue.split(".");

  if (decimalPart.length > 2) {
    throw new AppError(
      "Refund amount must use at most two decimal places",
      500,
      "INVALID_REFUND_AMOUNT"
    );
  }

  const minorUnits =
    Number(wholePart) * MINOR_UNIT_SCALE +
    Number(decimalPart.padEnd(2, "0"));

  if (!Number.isSafeInteger(minorUnits)) {
    throw new AppError(
      "Refund amount exceeds supported range",
      500,
      "REFUND_AMOUNT_OUT_OF_RANGE"
    );
  }

  return minorUnits;
};

const minorUnitsToDecimal = (minorUnits) => {
  if (!Number.isSafeInteger(minorUnits)) {
    throw new AppError(
      "Invalid refund amount",
      500,
      "INVALID_REFUND_AMOUNT"
    );
  }

  return (
    minorUnits / MINOR_UNIT_SCALE
  ).toFixed(2);
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
      "You are not allowed to refund this order",
      403,
      "REFUND_ACCESS_DENIED"
    );
  }

  return customer;
};

/**
 * Returns only refunds that have actually
 * been processed by the gateway.
 *
 * Pending/created refunds are accounted for
 * through Payment.refundReservedAmount.
 */
const getRefundTotals = async (
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
      if (refund.status === "processed") {
        return (
          total +
          decimalToMinorUnits(refund.amount)
        );
      }

      return total;
    },
    0
  );
};

const validateRefundRequest = ({
  payment,
  order,
  refundAmount,
}) => {
  if (payment.gateway !== PAYMENT_GATEWAY) {
    throw new AppError(
      "Unsupported payment gateway",
      409,
      "UNSUPPORTED_PAYMENT_GATEWAY"
    );
  }

  if (
    !REFUNDABLE_PAYMENT_STATUSES.includes(
      payment.status
    )
  ) {
    throw new AppError(
      "Payment is not refundable",
      409,
      "PAYMENT_NOT_REFUNDABLE"
    );
  }

  if (order.status === "cancelled") {
    throw new AppError(
      "Refund cannot be created for this order",
      409,
      "ORDER_NOT_REFUNDABLE"
    );
  }

  const paymentAmount =
    decimalToMinorUnits(payment.amount);

  const requestedAmount =
    decimalToMinorUnits(refundAmount);

  if (requestedAmount <= 0) {
    throw new AppError(
      "Refund amount must be greater than zero",
      400,
      "INVALID_REFUND_AMOUNT"
    );
  }

  if (requestedAmount > paymentAmount) {
    throw new AppError(
      "Refund amount exceeds payment amount",
      409,
      "REFUND_AMOUNT_EXCEEDS_PAYMENT"
    );
  }

  return {
    paymentAmount,
    requestedAmount,
  };
};

const synchronizePaymentRefundState = async ({
  payment,
  order,
  options = {},
}) => {
  const refundTotal =
    await getRefundTotals(
      payment._id,
      options
    );

  const paymentAmount =
    decimalToMinorUnits(payment.amount);

  if (refundTotal > paymentAmount) {
    throw new AppError(
      "Refund total exceeds payment amount",
      409,
      "REFUND_TOTAL_EXCEEDS_PAYMENT"
    );
  }

  const refundedAmount =
    minorUnitsToDecimal(refundTotal);

  let paymentStatus = payment.status;
  let orderPaymentStatus =
    order.paymentStatus;

  if (refundTotal === 0) {
    paymentStatus = "captured";
    orderPaymentStatus = "paid";
  } else if (
    refundTotal < paymentAmount
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
    refundTotal,
    paymentStatus,
    orderPaymentStatus,
  };
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
      session
        ? { session }
        : {}
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

/**
 * Send refund confirmation email.
 *
 * Email failures must never invalidate a
 * successfully committed refund.
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
        "Refund confirmation notification failed:",
        error
      );
    }
  };

const createRefund = async ({
  orderId,
  userId,
  amount,
  reason = null,
  idempotencyKey,
}) => {
  if (
    typeof idempotencyKey !== "string" ||
    idempotencyKey.trim().length < 8 ||
    idempotencyKey.trim().length > 128
  ) {
    throw new AppError(
      "A valid Idempotency-Key is required",
      400,
      "INVALID_IDEMPOTENCY_KEY"
    );
  }

  const normalizedIdempotencyKey =
    idempotencyKey.trim();

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

  if (!payment.gatewayPaymentId) {
    throw new AppError(
      "Payment has not been captured by Razorpay",
      409,
      "PAYMENT_NOT_CAPTURED"
    );
  }

  const {
    requestedAmount,
  } = validateRefundRequest({
    payment,
    order,
    refundAmount: amount,
  });

  const requestedAmountDecimal =
    minorUnitsToDecimal(
      requestedAmount
    );

  let refund =
    await refundRepository.findByIdempotencyKey(
      PAYMENT_GATEWAY,
      normalizedIdempotencyKey
    );

  /*
   * Existing idempotency record.
   */
  if (refund) {
    const existingAmount =
      decimalToMinorUnits(
        refund.amount
      );

    if (
      existingAmount !==
      requestedAmount
    ) {
      throw new AppError(
        "Idempotency key was already used for a different refund amount",
        409,
        "IDEMPOTENCY_KEY_REUSED"
      );
    }

    /*
     * Never resend the refund email here.
     * The original successful operation already
     * handled its notification.
     */
    if (
      [
        "created",
        "pending",
        "processed",
      ].includes(refund.status)
    ) {
      return refund;
    }

    /*
     * Reconcile a failed local refund that
     * already has a Razorpay refund ID.
     */
    if (
      refund.status === "failed" &&
      refund.gatewayRefundId
    ) {
      let gatewayRefund;

      try {
        gatewayRefund =
          await razorpayRefundProvider.fetchRefund(
            refund.gatewayRefundId
          );
      } catch (error) {
        throw new AppError(
          "Unable to reconcile previous Razorpay refund",
          502,
          "REFUND_RECONCILIATION_FAILED"
        );
      }

      if (
        !gatewayRefund ||
        gatewayRefund.id !==
          refund.gatewayRefundId
      ) {
        throw new AppError(
          "Previous Razorpay refund could not be reconciled",
          409,
          "REFUND_RECONCILIATION_REQUIRED"
        );
      }

      if (
        gatewayRefund.payment_id &&
        gatewayRefund.payment_id !==
          payment.gatewayPaymentId
      ) {
        throw new AppError(
          "Previous Razorpay refund belongs to a different payment",
          409,
          "REFUND_PAYMENT_MISMATCH"
        );
      }

      if (
        gatewayRefund.amount !==
          undefined &&
        Number(
          gatewayRefund.amount
        ) !== requestedAmount
      ) {
        throw new AppError(
          "Previous Razorpay refund amount does not match",
          409,
          "REFUND_AMOUNT_MISMATCH"
        );
      }

      if (
        gatewayRefund.status ===
        "processed"
      ) {
        const session =
          await mongoose.startSession();

        try {
          session.startTransaction();

          const updatedRefund =
            await refundRepository.updateById(
              refund._id,
              {
                status: "processed",
                failureReason: null,
                processedAt:
                  new Date(),
              },
              { session }
            );

          await releaseRefundReservation({
            paymentId: payment._id,
            amount:
              requestedAmountDecimal,
            session,
          });

          const syncResult =
            await synchronizePaymentRefundState({
              payment,
              order,
              options: {
                session,
              },
            });

          await session.commitTransaction();

          await sendRefundConfirmationNotification({
            order:
              syncResult.updatedOrder ||
              order,
            refundAmount:
              requestedAmountDecimal,
          });

          return {
            refund:
              updatedRefund,
            payment:
              syncResult.updatedPayment,
            order:
              syncResult.updatedOrder,
            refundedAmount:
              syncResult.refundedAmount,
          };
        } catch (error) {
          try {
            await session.abortTransaction();
          } catch (abortError) {
            // Preserve original error.
          }

          throw error;
        } finally {
          await session.endSession();
        }
      }

      if (
        gatewayRefund.status ===
          "pending" ||
        gatewayRefund.status ===
          "created"
      ) {
        throw new AppError(
          "Previous Razorpay refund is still being processed",
          409,
          "REFUND_ALREADY_IN_PROGRESS"
        );
      }

      if (
        gatewayRefund.status !==
        "failed"
      ) {
        throw new AppError(
          "Previous Razorpay refund requires reconciliation",
          409,
          "REFUND_RECONCILIATION_REQUIRED"
        );
      }
    }
  }

  /*
   * Failed local refund without a gateway
   * refund ID can safely be retried.
   */
  if (
    refund &&
    refund.status === "failed"
  ) {
    refund =
      await refundRepository.updateById(
        refund._id,
        {
          status: "created",
          failureReason: null,
        }
      );
  }

  if (!refund) {
    try {
      refund =
        await refundRepository.create({
          paymentId: payment._id,
          orderId: order._id,
          customerId:
            order.customerId,
          gateway:
            PAYMENT_GATEWAY,
          amount:
            requestedAmountDecimal,
          currency:
            payment.currency,
          status: "created",
          reason,
          idempotencyKey:
            normalizedIdempotencyKey,
        });
    } catch (error) {
      if (error?.code === 11000) {
        const concurrentRefund =
          await refundRepository.findByIdempotencyKey(
            PAYMENT_GATEWAY,
            normalizedIdempotencyKey
          );

        if (concurrentRefund) {
          return concurrentRefund;
        }
      }

      throw error;
    }
  }

  /*
   * Reserve the refund amount atomically.
   */
  const reservedPayment =
    await paymentRepository.reserveRefundAmount(
      payment._id,
      requestedAmountDecimal
    );

  if (!reservedPayment) {
    throw new AppError(
      "Refund amount exceeds refundable payment balance",
      409,
      "REFUND_AMOUNT_EXCEEDS_BALANCE"
    );
  }

  let gatewayRequestCompleted = false;

  try {
    /*
     * Move local refund into pending state.
     */
    if (
      refund.status === "created" &&
      canTransitionRefundStatus(
        "created",
        "pending"
      )
    ) {
      const pendingRefund =
        await refundRepository.updateById(
          refund._id,
          {
            status: "pending",
            failureReason: null,
          }
        );

      if (!pendingRefund) {
        throw new AppError(
          "Unable to move refund into pending state",
          500,
          "REFUND_PENDING_UPDATE_FAILED"
        );
      }

      refund = pendingRefund;
    }

    /*
     * Create refund at Razorpay.
     */
    const razorpayRefund =
      await razorpayRefundProvider.createRefund({
        paymentId:
          payment.gatewayPaymentId,
        amount:
          requestedAmount,
        notes: {
          orderId:
            order._id.toString(),
          refundId:
            refund._id.toString(),
        },
      });

    gatewayRequestCompleted = true;

    if (
      !razorpayRefund ||
      !razorpayRefund.id
    ) {
      throw new AppError(
        "Razorpay did not return a refund ID",
        502,
        "RAZORPAY_REFUND_RESPONSE_INVALID"
      );
    }

    if (
      razorpayRefund.payment_id &&
      razorpayRefund.payment_id !==
        payment.gatewayPaymentId
    ) {
      throw new AppError(
        "Razorpay refund belongs to a different payment",
        409,
        "REFUND_PAYMENT_MISMATCH"
      );
    }

    if (
      razorpayRefund.amount !==
        undefined &&
      Number(
        razorpayRefund.amount
      ) !== requestedAmount
    ) {
      throw new AppError(
        "Razorpay refund amount does not match requested amount",
        409,
        "REFUND_AMOUNT_MISMATCH"
      );
    }

    /*
     * Razorpay explicitly returned failed.
     * Release the reservation immediately.
     */
    if (
      razorpayRefund.status ===
      "failed"
    ) {
      const session =
        await mongoose.startSession();

      try {
        session.startTransaction();

        const updatedRefund =
          await refundRepository.updateById(
            refund._id,
            {
              gatewayRefundId:
                razorpayRefund.id,
              status: "failed",
              processedAt: null,
              failureReason:
                "Razorpay refund failed",
            },
            { session }
          );

        if (!updatedRefund) {
          throw new AppError(
            "Unable to update failed refund",
            500,
            "REFUND_UPDATE_FAILED"
          );
        }

        await releaseRefundReservation({
          paymentId: payment._id,
          amount:
            requestedAmountDecimal,
          session,
        });

        await session.commitTransaction();

        return {
          refund: updatedRefund,
          payment,
          order,
          refundedAmount:
            "0.00",
        };
      } catch (error) {
        try {
          await session.abortTransaction();
        } catch (abortError) {
          // Preserve original error.
        }

        throw error;
      } finally {
        await session.endSession();
      }
    }

    const gatewayStatus =
      razorpayRefund.status ===
      "processed"
        ? "processed"
        : "pending";

    if (
      refund.status !==
        gatewayStatus &&
      !canTransitionRefundStatus(
        refund.status,
        gatewayStatus
      )
    ) {
      throw new AppError(
        `Invalid refund status transition from ${refund.status} to ${gatewayStatus}`,
        409,
        "INVALID_REFUND_STATUS_TRANSITION"
      );
    }

    const session =
      await mongoose.startSession();

    try {
      session.startTransaction();

      const updatedRefund =
        await refundRepository.updateById(
          refund._id,
          {
            gatewayRefundId:
              razorpayRefund.id,
            status:
              gatewayStatus,
            processedAt:
              gatewayStatus ===
              "processed"
                ? new Date()
                : null,
            failureReason: null,
          },
          { session }
        );

      if (!updatedRefund) {
        throw new AppError(
          "Unable to update refund",
          500,
          "REFUND_UPDATE_FAILED"
        );
      }

      /*
       * Processed refunds release the reservation.
       * Pending refunds retain it until webhook
       * confirmation.
       */
      if (
        gatewayStatus ===
        "processed"
      ) {
        await releaseRefundReservation({
          paymentId: payment._id,
          amount:
            requestedAmountDecimal,
          session,
        });
      }

      const syncResult =
        await synchronizePaymentRefundState({
          payment,
          order,
          options: {
            session,
          },
        });

      await session.commitTransaction();

      /*
       * Email only after successful transaction.
       */
      if (
        gatewayStatus ===
        "processed"
      ) {
        await sendRefundConfirmationNotification({
          order:
            syncResult.updatedOrder ||
            order,
          refundAmount:
            requestedAmountDecimal,
        });
      }

      return {
        refund:
          updatedRefund,
        payment:
          syncResult.updatedPayment,
        order:
          syncResult.updatedOrder,
        refundedAmount:
          syncResult.refundedAmount,
      };
    } catch (error) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        // Preserve original error.
      }

      throw error;
    } finally {
      await session.endSession();
    }
  } catch (error) {
    /*
     * If Razorpay did NOT accept the refund request,
     * release our reservation.
     */
    if (!gatewayRequestCompleted) {
      try {
        await releaseRefundReservation({
          paymentId: payment._id,
          amount:
            requestedAmountDecimal,
        });
      } catch (releaseError) {
        // Reconciliation will handle
        // an unreleased reservation.
      }

      if (
        refund.status !==
        "processed"
      ) {
        try {
          await refundRepository.updateById(
            refund._id,
            {
              status: "failed",
              failureReason:
                error.message,
            }
          );
        } catch (persistenceError) {
          // Preserve original error.
        }
      }
    } else {
      /*
       * Razorpay accepted the request but
       * local persistence failed.
       *
       * Never release the reservation here.
       * Never create another refund.
       */
      try {
        await refundRepository.updateById(
          refund._id,
          {
            failureReason:
              "Gateway refund accepted but local synchronization failed: " +
              error.message,
          }
        );
      } catch (persistenceError) {
        // Preserve original error.
      }
    }

    throw error;
  }
};

module.exports = {
  createRefund,
  decimalToMinorUnits,
  minorUnitsToDecimal,
  getRefundTotals,
  synchronizePaymentRefundState,
};