const mongoose = require("mongoose");

const paymentRepository = require("../repositories/payment.repository");
const refundRepository = require("../repositories/refund.repository");
const orderRepository = require("../repositories/order.repository");

const Customer = require("../models/Customer");
const User = require("../models/User");

const razorpayRefundProvider = require(
  "../integrations/payments/razorpay-refund.provider"
);
const paypalProvider = require(
  "../integrations/payments/paypal.provider"
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
  if (!["razorpay", "paypal"].includes(payment.gateway)) {
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

  if (
    order.status === "cancelled" &&
    !["captured", "partially_refunded"].includes(payment.status)
  ) {
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

  if (orderPaymentStatus === "refunded") {
    try {
      const digitalEntitlementService = require("./digital-entitlement.service");
      await digitalEntitlementService.revokeEntitlementsForOrder(
        order._id,
        "Order fully refunded",
        null,
        options
      );
    } catch (revokeErr) {
      logger.error("Failed to revoke digital entitlements on order refund", {
        orderId: order._id,
        error: revokeErr.message,
      });
    }
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

  if (!payment.gatewayPaymentId) {
    throw new AppError(
      `Captured payment is missing ${payment.gateway === "paypal" ? "PayPal" : "Razorpay"} payment ID`,
      409,
      "PAYMENT_GATEWAY_ID_MISSING"
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

  const gateway = payment.gateway || PAYMENT_GATEWAY;

  let refund =
    await refundRepository.findByIdempotencyKey(
      gateway,
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
     * already has a gateway refund ID.
     */
    if (
      refund.status === "failed" &&
      refund.gatewayRefundId
    ) {
      let gatewayRefund;
      const gwName = gateway === "paypal" ? "PayPal" : "Razorpay";

      try {
        if (gateway === "paypal") {
          gatewayRefund = await paypalProvider.fetchRefund(refund.gatewayRefundId);
        } else {
          gatewayRefund =
            await razorpayRefundProvider.fetchRefund(
              refund.gatewayRefundId
            );
        }
      } catch (error) {
        throw new AppError(
          `Unable to reconcile previous ${gwName} refund`,
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
          `Previous ${gwName} refund could not be reconciled`,
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
          `Previous ${gwName} refund belongs to a different payment`,
          409,
          "REFUND_PAYMENT_MISMATCH"
        );
      }

      const gatewayStatus =
        gateway === "paypal"
          ? (gatewayRefund.status === "COMPLETED" ? "processed" : (gatewayRefund.status === "FAILED" ? "failed" : "pending"))
          : (gatewayRefund.status === "processed" ? "processed" : (gatewayRefund.status === "failed" ? "failed" : "pending"));

      if (
        gatewayRefund.amount !==
          undefined &&
        gateway !== "paypal" &&
        Number(
          gatewayRefund.amount
        ) !== requestedAmount
      ) {
        throw new AppError(
          `Previous ${gwName} refund amount does not match`,
          409,
          "REFUND_AMOUNT_MISMATCH"
        );
      }

      if (
        gatewayStatus === "processed"
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
        gatewayStatus === "pending"
      ) {
        throw new AppError(
          `Previous ${gwName} refund is still being processed`,
          409,
          "REFUND_ALREADY_IN_PROGRESS"
        );
      }

      if (
        gatewayStatus !== "failed"
      ) {
        throw new AppError(
          `Previous ${gwName} refund requires reconciliation`,
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
          gateway,
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
            gateway,
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
     * Create refund at Gateway (Razorpay or PayPal).
     */
    let razorpayRefund;
    if (gateway === "paypal") {
      const paypalResult = await paypalProvider.refundCapture(
        payment.gatewayPaymentId,
        {
          amount: requestedAmountDecimal,
          currency: payment.currency || "INR",
          note: reason || `Refund for order ${order.orderNumber || order._id}`,
        }
      );
      razorpayRefund = {
        id: paypalResult?.id,
        payment_id: payment.gatewayPaymentId,
        amount: requestedAmount,
        status:
          paypalResult?.status === "COMPLETED"
            ? "processed"
            : paypalResult?.status === "FAILED"
            ? "failed"
            : "pending",
      };
    } else {
      razorpayRefund =
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
    }

    gatewayRequestCompleted = true;

    if (
      !razorpayRefund ||
      !razorpayRefund.id
    ) {
      throw new AppError(
        `${gateway === "paypal" ? "PayPal" : "Razorpay"} did not return a refund ID`,
        502,
        `${gateway === "paypal" ? "PAYPAL" : "RAZORPAY"}_REFUND_RESPONSE_INVALID`
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

        try {
          const rewardService = require("./reward.service");
          await rewardService.adjustPointsForCancelledOrRefundedOrder(
            order._id,
            requestedAmountDecimal
          );
        } catch {
          // Non-blocking reward adjustment
        }

        try {
          // Phase VW-03: Post refund reversal double-entry journal
          const financialLedgerService = require("./financial-ledger.service");
          const isSettled = Boolean(order.items?.some((it) => it.settlementId));
          const primaryVendorId = order.items?.[0]?.vendorId;
          await financialLedgerService.postRefundReversalJournal(updatedRefund, {
            orderDoc: order,
            vendorId: primaryVendorId,
            isSettled,
            actorId: userId,
          });
        } catch {
          // Non-blocking ledger reversal
        }
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
     *
     * EXCEPTION: If the error was a gateway timeout or network error, the gateway outcome
     * is uncertain (the refund may have been created or is pending on the gateway).
     * DO NOT release the reservation, and keep the refund in pending state to prevent
     * double-refunding or exceeding the refundable limit.
     */
    if (!gatewayRequestCompleted) {
      const isUncertainTimeout =
        Boolean(error?.isTimeout) ||
        error?.errorCode === "GATEWAY_TIMEOUT" ||
        error?.statusCode === 504 ||
        /timeout|timed out|network/i.test(error?.message || "");

      if (!isUncertainTimeout) {
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
        // Uncertain outcome / timeout:
        // Hold reservation intact and mark pending for reconciliation
        try {
          await refundRepository.updateById(
            refund._id,
            {
              status: "pending",
              failureReason:
                "Gateway timeout during refund creation; reservation held for reconciliation: " +
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

/**
 * Reconciles a local refund record against authoritative payment gateway state (Razorpay/PayPal).
 * Queries gateway directly using gatewayRefundId and transactionally synchronizes local records.
 */
const reconcileGatewayRefund = async ({
  refundId,
  gatewayRefundId,
  userId = null,
  role = "admin",
  ipAddress = null,
  userAgent = null,
}) => {
  let refund = null;
  if (refundId) {
    refund = await refundRepository.findById(refundId);
  }
  if (!refund && gatewayRefundId) {
    refund = await refundRepository.findByGatewayRefundId(PAYMENT_GATEWAY, gatewayRefundId);
    if (!refund) {
      refund = await refundRepository.findByGatewayRefundId("paypal", gatewayRefundId);
    }
  }

  if (!refund) {
    throw new AppError("Refund record not found", 404, "REFUND_NOT_FOUND");
  }

  const effectiveGatewayRefundId = gatewayRefundId || refund.gatewayRefundId;
  if (!effectiveGatewayRefundId) {
    throw new AppError(
      "Cannot reconcile refund without gateway refund ID",
      400,
      "MISSING_GATEWAY_REFUND_ID"
    );
  }

  const payment = await paymentRepository.findById(refund.paymentId);
  if (!payment) {
    throw new AppError("Associated payment record not found", 404, "PAYMENT_NOT_FOUND");
  }

  const order = await orderRepository.findById(refund.orderId);
  if (!order) {
    throw new AppError("Associated order not found", 404, "ORDER_NOT_FOUND");
  }

  const gateway = refund.gateway || payment.gateway || PAYMENT_GATEWAY;
  let gatewayRefund = null;

  try {
    if (gateway === "paypal") {
      gatewayRefund = await paypalProvider.fetchRefund(effectiveGatewayRefundId);
    } else {
      gatewayRefund = await razorpayRefundProvider.fetchRefund(effectiveGatewayRefundId);
    }
  } catch (err) {
    throw new AppError(
      `Unable to fetch gateway refund status: ${err.message}`,
      502,
      "GATEWAY_FETCH_FAILED"
    );
  }

  if (!gatewayRefund || gatewayRefund.id !== effectiveGatewayRefundId) {
    throw new AppError(
      "Gateway refund record could not be verified",
      409,
      "REFUND_RECONCILIATION_FAILED"
    );
  }

  // Identity validation
  if (gatewayRefund.payment_id && payment.gatewayPaymentId && gatewayRefund.payment_id !== payment.gatewayPaymentId) {
    throw new AppError(
      "Gateway refund belongs to a different payment",
      409,
      "REFUND_PAYMENT_MISMATCH"
    );
  }

  // Amount validation (in minor units)
  const localMinor = decimalToMinorUnits(refund.amount);
  if (gatewayRefund.amount !== undefined && Number(gatewayRefund.amount) !== localMinor) {
    throw new AppError(
      "Gateway refund amount does not match local refund record",
      409,
      "REFUND_AMOUNT_MISMATCH"
    );
  }

  // Canonical mapping
  let mappedStatus = "pending";
  if (gateway === "paypal") {
    if (gatewayRefund.status === "COMPLETED") mappedStatus = "processed";
    else if (gatewayRefund.status === "FAILED") mappedStatus = "failed";
    else mappedStatus = "pending";
  } else {
    if (gatewayRefund.status === "processed") mappedStatus = "processed";
    else if (gatewayRefund.status === "failed") mappedStatus = "failed";
    else if (gatewayRefund.status === "reversed") mappedStatus = "reversed";
    else mappedStatus = "pending";
  }

  const previousStatus = refund.status;
  const requestedAmountDecimal = minorUnitsToDecimal(localMinor);

  const arn = gatewayRefund.acquirer_data?.arn || gatewayRefund.arn || gatewayRefund.acquirer_data?.rrn || null;
  const acquirerData = gatewayRefund.acquirer_data || {};
  const speedProcessed = gatewayRefund.speed_processed || null;

  const session = await mongoose.startSession();
  let syncResult;
  let updatedRefund;
  let returnIds = [];
  let matchedReturnDocs = [];

  try {
    session.startTransaction();

    const updateFields = {
      gatewayRefundId: effectiveGatewayRefundId,
      gatewayStatus: gatewayRefund.status || mappedStatus,
      arn,
      acquirerData,
      speedProcessed,
      normalizedGatewayMessage:
        gatewayRefund.error_description ||
        gatewayRefund.error_reason ||
        (mappedStatus === "processed"
          ? `Refund processed successfully via gateway${arn ? ` (ARN/RRN: ${arn})` : ""}`
          : mappedStatus === "pending"
          ? "Refund pending at gateway"
          : "Gateway refund failed"),
      lastReconciledAt: new Date(),
    };

    if (gatewayRefund.created_at) {
      updateFields.gatewayCreatedAt = new Date(Number(gatewayRefund.created_at) * 1000);
    }

    if (mappedStatus === "processed") {
      updateFields.status = "processed";
      updateFields.processedAt = updateFields.gatewayCreatedAt || new Date();
      updateFields.failureReason = null;

      if (previousStatus !== "processed") {
        await releaseRefundReservation({
          paymentId: payment._id,
          amount: requestedAmountDecimal,
          session,
        });
      }
    } else if (mappedStatus === "failed") {
      updateFields.status = "failed";
      updateFields.failureReason = updateFields.normalizedGatewayMessage;

      if (previousStatus === "pending" || previousStatus === "created") {
        await releaseRefundReservation({
          paymentId: payment._id,
          amount: requestedAmountDecimal,
          session,
        });
      }
    } else if (mappedStatus === "reversed") {
      updateFields.status = "reversed";
      updateFields.failureReason = "Refund reversed by bank/gateway";
    } else {
      updateFields.status = "pending";
    }

    updatedRefund = await refundRepository.updateById(refund._id, updateFields, { session });

    syncResult = await synchronizePaymentRefundState({
      payment,
      order,
      options: { session },
    });

    // Synchronize ReturnRequest
    const ReturnRequest = require("../models/ReturnRequest");
    matchedReturnDocs = await ReturnRequest.find({
      $or: [
        { refundId: refund._id },
        { orderId: order._id, status: { $in: ["refund_pending", "inspected", "approved", "refunded"] } },
      ],
    }).session(session);

    returnIds = matchedReturnDocs.map((r) => r._id);

    if (mappedStatus === "processed") {
      const arnDisplay = arn ? ` (ARN/RRN: ${arn})` : "";
      await ReturnRequest.updateMany(
        {
          _id: { $in: returnIds },
        },
        {
          $set: {
            status: "refunded",
            refundId: refund._id,
            gatewayRefundId: effectiveGatewayRefundId,
            arn,
            refundProcessedAt: updateFields.processedAt,
            resolutionNotes: `Refund confirmed via gateway reconciliation${arnDisplay}`,
          },
          $push: {
            timeline: {
              status: "refunded",
              notes: `Refund processed and confirmed by gateway (${effectiveGatewayRefundId})${arnDisplay}. Funds typically reflect in 5-7 working days.`,
              timestamp: new Date(),
            },
          },
        },
        { session }
      );

      try {
        if (order.items && order.items.length > 0) {
          for (const retDoc of matchedReturnDocs) {
            for (const item of retDoc.items || []) {
              const matchedOi = (order.items || []).find((x) => x._id.toString() === item.orderItemId?.toString());
              if (matchedOi) {
                matchedOi.returnStatus = "returned";
                matchedOi.fulfillmentStatus = "returned";
              }
            }
          }
          const allItemsReturned = order.items.every((it) => it.returnStatus === "returned");
          if (allItemsReturned && order.fulfillmentStatus !== "returned") {
            order.fulfillmentStatus = "returned";
            await orderRepository.updateById(
              order._id,
              { fulfillmentStatus: "returned" },
              { session }
            );
          }
        }
      } catch {}
    } else if (mappedStatus === "failed") {
      await ReturnRequest.updateMany(
        {
          _id: { $in: returnIds },
        },
        {
          $set: {
            resolutionNotes: `Refund failed at gateway: ${updateFields.normalizedGatewayMessage}`,
          },
          $push: {
            timeline: {
              status: "refund_pending",
              notes: `Gateway reported refund failure: ${updateFields.normalizedGatewayMessage}. Available for administrative review.`,
              timestamp: new Date(),
            },
          },
        },
        { session }
      );
    }

    // Synchronize RefundApplication if one exists
    const RefundApplication = require("../models/RefundApplication");
    const appUpdate = {
      disbursementReference: refund._id,
      gatewayRefundId: effectiveGatewayRefundId,
      gatewayStatus: gatewayRefund.status || mappedStatus,
      arn,
      acquirerData,
      normalizedGatewayMessage: updateFields.normalizedGatewayMessage,
      lastReconciledAt: new Date(),
    };

    if (mappedStatus === "processed") {
      appUpdate.applicationStatus = "disbursed";
      appUpdate.disbursementStatus = "disbursed";
      appUpdate.disbursedAt = updateFields.processedAt;
      appUpdate.disbursedAmount = refund.amount;
      appUpdate.approvedAmount = refund.amount;
      appUpdate.failureDetails = null;
    } else if (mappedStatus === "failed") {
      appUpdate.applicationStatus = "disbursement_failed";
      appUpdate.disbursementStatus = "failed";
      appUpdate.failureDetails = {
        code: gatewayRefund.error_code || "GATEWAY_FAILED",
        message: updateFields.normalizedGatewayMessage,
        failedAt: new Date(),
      };
    } else if (mappedStatus === "pending") {
      appUpdate.applicationStatus = "pending_confirmation";
      appUpdate.disbursementStatus = "pending";
    }

    await RefundApplication.updateMany(
      {
        $or: [
          { disbursementReference: refund._id },
          { returnId: { $in: returnIds } },
          { orderId: order._id, applicationStatus: { $in: ["submitted", "under_review", "disbursement_processing", "pending_confirmation", "approved", "disbursement_failed"] } },
          { gatewayRefundId: effectiveGatewayRefundId },
        ],
      },
      {
        $set: appUpdate,
        $push: {
          reconciliationHistory: {
            reconciledAt: new Date(),
            reconciledBy: userId,
            previousStatus,
            newStatus: mappedStatus,
            gatewayStatus: gatewayRefund.status,
            message: updateFields.normalizedGatewayMessage,
            rawMetadata: {
              arn,
              acquirerData,
            },
          },
          timeline: {
            status: appUpdate.applicationStatus || mappedStatus,
            notes: `Disbursement confirmed via authoritative gateway reconciliation (${effectiveGatewayRefundId})${arn ? ` [ARN: ${arn}]` : ""}`,
            timestamp: new Date(),
            actor: { actorType: "admin", actorId: userId, role: "admin" },
          },
        },
      },
      { session }
    );

    // Record immutable audit event
    try {
      const AuditLog = require("../models/AuditLog");
      if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        await AuditLog.create(
          [
            {
              actorId: userId,
              targetId: refund._id,
              action: "REFUND_GATEWAY_RECONCILED_SUCCESS",
              entityType: "Refund",
              beforeState: {
                status: previousStatus,
                paymentStatus: payment.status,
                refundReservedAmount: payment.refundReservedAmount ? Number(payment.refundReservedAmount.toString()) : 0,
                refundedAmount: payment.refundedAmount ? Number(payment.refundedAmount.toString()) : 0,
              },
              afterState: {
                status: mappedStatus,
                paymentStatus: syncResult?.paymentStatus,
                refundReservedAmount: syncResult?.updatedPayment?.refundReservedAmount ? Number(syncResult.updatedPayment.refundReservedAmount.toString()) : 0,
                refundedAmount: syncResult?.updatedPayment?.refundedAmount ? Number(syncResult.updatedPayment.refundedAmount.toString()) : 0,
                arn,
                gatewayRefundId: effectiveGatewayRefundId,
              },
              reason: `Authoritative gateway reconciliation synchronized processed refund (${effectiveGatewayRefundId}) with ARN ${arn || "N/A"}`,
              ipAddress: ipAddress || null,
              userAgent: userAgent || null,
            },
          ],
          { session }
        );
      }
    } catch {}

    await session.commitTransaction();
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch {}
    throw err;
  } finally {
    await session.endSession();
  }

  // Post-commit side effects outside transaction session (non-blocking)
  if (mappedStatus === "processed") {
    try {
      const { generateCreditNoteForReturn } = require("./return-request.service");
      for (const retDoc of matchedReturnDocs) {
        await generateCreditNoteForReturn({
          returnDoc: retDoc,
          orderDoc: order,
          refundDoc: updatedRefund,
        }).catch(() => {});
      }
    } catch {}

    try {
      const financialLedgerService = require("./financial-ledger.service");
      const isSettled = Boolean(order.items?.some((it) => it.settlementId));
      const primaryVendorId = order.items?.[0]?.vendorId;
      await financialLedgerService.postRefundReversalJournal(updatedRefund, {
        orderDoc: order,
        vendorId: primaryVendorId,
        isSettled,
        actorId: userId,
      });
    } catch {}
  }

  return {
    reconciled: true,
    previousStatus,
    newStatus: mappedStatus,
    gatewayStatus: gatewayRefund.status,
    arn,
    refund: updatedRefund,
    payment: syncResult.updatedPayment,
    order: syncResult.updatedOrder,
  };
};

module.exports = {
  createRefund,
  reconcileGatewayRefund,
  decimalToMinorUnits,
  minorUnitsToDecimal,
  getRefundTotals,
  synchronizePaymentRefundState,
};