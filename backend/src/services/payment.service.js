const crypto = require("crypto");

const orderRepository = require("../repositories/order.repository");
const paymentRepository = require("../repositories/payment.repository");
const refundRepository = require("../repositories/refund.repository");
const getOrderService = () => require("./order.service");

const razorpayProvider = require("../integrations/payments/razorpay.provider");
const paypalProvider = require("../integrations/payments/paypal.provider");
const paymentOrphanRecoveryService = require("./payment-orphan-recovery.service");

const Customer = require("../models/Customer");

const AppError = require("../errors/AppError");

const {
  PAYMENT_GATEWAYS,
  canTransitionPaymentStatus,
} = require("../constants/payment.constants");

const MINOR_UNIT_SCALE = 100;

const validateCustomer = async (userId) => {
  const customer = await Customer.findOne({
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

  return customer;
};

const decimalToMinorUnits = (value) => {
  const numericValue = Number(value.toString());

  if (!Number.isFinite(numericValue) || numericValue < 0) {
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

const generateReceipt = (orderNumber) => {
  const token = crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase();

  const cleanOrderNumber = String(orderNumber || "").trim();
  // Razorpay maximum receipt length is 40 characters.
  // Prefix "BB-" (3 chars) + Hyphen "-" (1 char) + token (8 chars) = 12 chars overhead.
  const maxOrderNumberLength = 40 - 12;
  const safeOrderNumber = cleanOrderNumber.slice(
    0,
    Math.max(1, maxOrderNumberLength)
  );

  return `BB-${safeOrderNumber}-${token}`;
};

const validateIdempotencyKey = (idempotencyKey) => {
  if (
    typeof idempotencyKey !== "string" ||
    idempotencyKey.trim().length < 8 ||
    idempotencyKey.trim().length > 128
  ) {
    throw new AppError(
      "A valid Idempotency-Key header is required",
      400,
      "INVALID_IDEMPOTENCY_KEY"
    );
  }

  return idempotencyKey.trim();
};

const reconcilePaidGatewayOrder = async ({
  activePayment,
  order,
  amount,
  gatewayOrderId,
}) => {
  if (activePayment.status === "captured") {
    await getOrderService().markOrderPaymentCaptured(order._id);
    return activePayment;
  }

  if (!["created", "pending"].includes(activePayment.status)) {
    throw new AppError(
      "An active payment already exists for this order",
      409,
      "ACTIVE_PAYMENT_EXISTS"
    );
  }

  const currentPayment =
    (await paymentRepository.findById(activePayment._id)) || activePayment;

  if (currentPayment.status === "captured") {
    await getOrderService().markOrderPaymentCaptured(order._id);
    return currentPayment;
  }

  if (!["created", "pending"].includes(currentPayment.status)) {
    throw new AppError(
      "An active payment already exists for this order",
      409,
      "ACTIVE_PAYMENT_EXISTS"
    );
  }

  let paymentsResponse;
  try {
    paymentsResponse =
      await razorpayProvider.fetchOrderPayments(gatewayOrderId);
  } catch (error) {
    throw new AppError(
      "An active payment already exists for this order",
      409,
      "ACTIVE_PAYMENT_EXISTS"
    );
  }

  const items = Array.isArray(paymentsResponse?.items)
    ? paymentsResponse.items
    : [];

  const localCurrency = order.currency?.toString().toUpperCase();
  const capturedPayment = items.find(
    (p) =>
      p.status === "captured" &&
      typeof p.id === "string" &&
      p.id.trim().length > 0 &&
      Number(p.amount) === amount &&
      p.currency?.toString().toUpperCase() === localCurrency
  );

  if (!capturedPayment) {
    throw new AppError(
      "An active payment already exists for this order",
      409,
      "ACTIVE_PAYMENT_EXISTS"
    );
  }

  const latestBeforeUpdate =
    (await paymentRepository.findById(activePayment._id)) || currentPayment;

  if (latestBeforeUpdate.status === "captured") {
    await getOrderService().markOrderPaymentCaptured(order._id);
    return latestBeforeUpdate;
  }

  if (!["created", "pending"].includes(latestBeforeUpdate.status)) {
    throw new AppError(
      "An active payment already exists for this order",
      409,
      "ACTIVE_PAYMENT_EXISTS"
    );
  }

  const updatedPayment = await paymentRepository.updateById(
    activePayment._id,
    {
      status: "captured",
      gatewayPaymentId: capturedPayment.id.trim(),
      method: capturedPayment.method || activePayment.method || null,
      capturedAt: capturedPayment.captured_at
        ? new Date(capturedPayment.captured_at * 1000)
        : new Date(),
      failureReason: null,
    }
  );

  await getOrderService().markOrderPaymentCaptured(order._id);

  return updatedPayment || latestBeforeUpdate;
};

const handleActivePayment = async ({
  activePayment,
  order,
  amount,
}) => {
  if (activePayment.status === "authorized") {
    throw new AppError(
      "Payment has already been authorized for this order",
      409,
      "PAYMENT_ALREADY_AUTHORIZED"
    );
  }

  let currentPayment = activePayment;

  if (!currentPayment.gatewayOrderId) {
    if (!currentPayment.receipt) {
      throw new AppError(
        "Payment creation is currently in progress for this order. Please retry in a few seconds",
        409,
        "PAYMENT_CREATION_IN_PROGRESS"
      );
    }

    const recoveryResult =
      await paymentOrphanRecoveryService.recoverOrphanedGatewayOrderByReceipt({
        payment: currentPayment,
        order,
        expectedMinorUnits: amount,
      });

    if (!recoveryResult.recovered) {
      if (recoveryResult.reason === "GATEWAY_FETCH_FAILED" && recoveryResult.error) {
        throw recoveryResult.error;
      }

      throw new AppError(
        "Payment creation is currently in progress for this order. Please retry in a few seconds",
        409,
        "PAYMENT_CREATION_IN_PROGRESS"
      );
    }

    currentPayment = recoveryResult.payment || currentPayment;
    const gatewayOrder = recoveryResult.gatewayOrder;

    if (gatewayOrder.status === "paid") {
      return await reconcilePaidGatewayOrder({
        activePayment: currentPayment,
        order,
        amount,
        gatewayOrderId: currentPayment.gatewayOrderId,
      });
    }

    if (["created", "attempted"].includes(gatewayOrder.status)) {
      return currentPayment;
    }

    throw new AppError(
      "An active payment already exists for this order",
      409,
      "ACTIVE_PAYMENT_EXISTS"
    );
  }

  let gatewayOrder;
  try {
    gatewayOrder = await razorpayProvider.fetchOrder(
      currentPayment.gatewayOrderId
    );
  } catch (error) {
    throw new AppError(
      "An active payment already exists for this order",
      409,
      "ACTIVE_PAYMENT_EXISTS"
    );
  }

  const buyboxOrderId =
    gatewayOrder?.notes?.buyboxOrderId?.toString?.().trim?.();
  if (!buyboxOrderId || buyboxOrderId !== order._id.toString()) {
    throw new AppError(
      "An active payment already exists for this order",
      409,
      "ACTIVE_PAYMENT_EXISTS"
    );
  }

  const gatewayAmount = Number(gatewayOrder?.amount);
  const gatewayCurrency =
    gatewayOrder?.currency?.toString?.().toUpperCase?.();
  const localCurrency = order.currency?.toString?.().toUpperCase?.();

  if (
    gatewayAmount !== amount ||
    gatewayCurrency !== localCurrency
  ) {
    throw new AppError(
      "An active payment already exists for this order",
      409,
      "ACTIVE_PAYMENT_EXISTS"
    );
  }

  if (gatewayOrder.status === "paid") {
    return await reconcilePaidGatewayOrder({
      activePayment: currentPayment,
      order,
      amount,
      gatewayOrderId: currentPayment.gatewayOrderId,
    });
  }

  if (["created", "attempted"].includes(gatewayOrder.status)) {
    return currentPayment;
  }

  throw new AppError(
    "An active payment already exists for this order",
    409,
    "ACTIVE_PAYMENT_EXISTS"
  );
};

const validateOrderPaymentAccess = async (order, userId, options = {}) => {
  const isGuestCaller = Boolean(
    options.isGuest ||
    (typeof userId === "string" && userId.startsWith("gst_")) ||
    (typeof userId === "object" && (userId.isGuest || userId.guestId))
  );

  if (order.isGuestOrder) {
    const callerGuestId = options.guestId || (typeof userId === "object" ? userId.guestId || userId.id : userId);
    const token = options.guestOrderAccessToken || options.token;

    const isMatchGuestId = Boolean(callerGuestId && order.guestId === callerGuestId);
    const isMatchToken = Boolean(token && order.guestOrderAccessToken === token);

    if (!isMatchGuestId && !isMatchToken) {
      throw new AppError(
        "You are not allowed to access this order",
        403,
        "ORDER_ACCESS_DENIED"
      );
    }
    return { isGuest: true, guestId: order.guestId, customer: null };
  }

  if (isGuestCaller) {
    throw new AppError(
      "You are not allowed to access this order",
      403,
      "ORDER_ACCESS_DENIED"
    );
  }

  const customer = await validateCustomer(typeof userId === "object" ? (userId.id || userId._id) : userId);
  if (!order.customerId || order.customerId.toString() !== customer._id.toString()) {
    throw new AppError(
      "You are not allowed to access this order",
      403,
      "ORDER_ACCESS_DENIED"
    );
  }
  return { isGuest: false, customer, guestId: null };
};

const createPaymentForOrder = async (
  orderId,
  userId,
  idempotencyKey,
  options = {}
) => {
  const order = await orderRepository.findById(
    orderId,
    options
  );

  if (!order) {
    throw new AppError(
      "Order not found",
      404,
      "ORDER_NOT_FOUND"
    );
  }

  const { customer } = await validateOrderPaymentAccess(order, userId, options);

  const normalizedIdempotencyKey =
    validateIdempotencyKey(idempotencyKey);

  if (order.paymentStatus === "paid") {
    throw new AppError(
      "Order has already been paid",
      409,
      "ORDER_ALREADY_PAID"
    );
  }

  if (
    ["cancelled", "completed"].includes(
      order.status
    )
  ) {
    throw new AppError(
      "Payment cannot be created for this order",
      409,
      "ORDER_NOT_PAYABLE"
    );
  }

  if (order.status !== "pending") {
    throw new AppError(
      "Payment cannot be created for this order",
      409,
      "ORDER_NOT_PAYABLE"
    );
  }

  const amount = decimalToMinorUnits(
    order.grandTotal
  );

  if (amount <= 0) {
    throw new AppError(
      "Order amount must be greater than zero",
      400,
      "INVALID_PAYMENT_AMOUNT"
    );
  }

  const existingByKey =
    await paymentRepository.findByOrderIdAndIdempotencyKey(
      order._id,
      PAYMENT_GATEWAYS.RAZORPAY,
      normalizedIdempotencyKey
    );

  if (existingByKey) {
    if (existingByKey.status === "authorized") {
      throw new AppError(
        "Payment has already been authorized for this order",
        409,
        "PAYMENT_ALREADY_AUTHORIZED"
      );
    }

    if (existingByKey.status === "captured") {
      return existingByKey;
    }

    if (
      ["created", "pending"].includes(
        existingByKey.status
      )
    ) {
      return await handleActivePayment({
        activePayment: existingByKey,
        order,
        amount,
      });
    }
  }

  const activePayment =
    await paymentRepository.findActiveByOrderId(
      order._id
    );

  if (activePayment) {
    return await handleActivePayment({
      activePayment,
      order,
      amount,
    });
  }

  const receipt = generateReceipt(
    order.orderNumber
  );

  /*
   * Atomically guard that the order is still pending before creating payment.
   * If expiration claimed/cancelled the order concurrently, transitionStatusIfCurrent
   * returns null and payment creation aborts before any Payment or gateway order is created.
   */
  const guardedOrder = await orderRepository.transitionStatusIfCurrent(
    order._id,
    "pending",
    { updatedAt: new Date() },
    options
  );

  if (!guardedOrder) {
    const freshOrder = await orderRepository.findById(order._id, options);
    if (freshOrder?.paymentStatus === "paid") {
      throw new AppError(
        "Order has already been paid",
        409,
        "ORDER_ALREADY_PAID"
      );
    }
    throw new AppError(
      "Payment cannot be created for this order",
      409,
      "ORDER_NOT_PAYABLE"
    );
  }

  let payment;

  try {
    payment = await paymentRepository.create(
      {
        orderId: order._id,
        customerId: customer ? customer._id : null,
        guestId: order.isGuestOrder ? order.guestId : null,
        gateway: PAYMENT_GATEWAYS.RAZORPAY,
        gatewayOrderId: null,
        gatewayPaymentId: null,
        amount: order.grandTotal,
        currency: order.currency,
        status: "created",
        receipt,
        idempotencyKey:
          normalizedIdempotencyKey,
        metadata: {},
      },
      options
    );
  } catch (error) {
    if (error?.code === 11000) {
      const active =
        await paymentRepository.findActiveByOrderId(
          order._id
        );

      if (active) {
        return await handleActivePayment({
          activePayment: active,
          order,
          amount,
        });
      }

      const byKey =
        await paymentRepository.findByOrderIdAndIdempotencyKey(
          order._id,
          PAYMENT_GATEWAYS.RAZORPAY,
          normalizedIdempotencyKey
        );

      if (byKey) {
        if (byKey.status === "captured") {
          return byKey;
        }

        return await handleActivePayment({
          activePayment: byKey,
          order,
          amount,
        });
      }

      throw new AppError(
        "Payment creation is currently in progress for this order. Please retry in a few seconds",
        409,
        "PAYMENT_CREATION_IN_PROGRESS"
      );
    }

    throw error;
  }

  let razorpayOrder;

  try {
    razorpayOrder =
      await razorpayProvider.createOrder({
        amount,
        currency: order.currency,
        receipt: payment.receipt || receipt,
        notes: {
          buyboxOrderId:
            order._id.toString(),
          orderNumber:
            order.orderNumber,
        },
      });
  } catch (error) {
    await paymentRepository.updateById(
      payment._id,
      {
        status: "failed",
        failureReason:
          error.message ||
          "Razorpay order creation failed",
        receipt: payment.receipt || receipt,
      }
    );

    throw error;
  }

  const updatedPayment =
    await paymentRepository.updateById(
      payment._id,
      {
        gatewayOrderId:
          razorpayOrder.id,
        receipt: payment.receipt || receipt,
        status:
          razorpayOrder.status === "created"
            ? "created"
            : "pending",
        metadata: {
          razorpayOrderStatus:
            razorpayOrder.status || "",
        },
      }
    );

  try {
    if (orderRepository && typeof orderRepository.appendPaymentAttempt === "function") {
      await orderRepository.appendPaymentAttempt(
        order._id,
        {
          attempt: {
            attemptNumber: (order.paymentAttempts?.length || 0) + 1,
            gateway: PAYMENT_GATEWAYS.RAZORPAY,
            method: payment.method || null,
            amount: order.grandTotal,
            currency: order.currency || "INR",
            status: "created",
            gatewayOrderId: razorpayOrder.id,
            createdAt: new Date(),
          },
          timelineEvent: {
            event: "payment_attempt_started",
            title: "Payment Attempt Started",
            description: `Payment attempt initiated via Razorpay (Order ID: ${razorpayOrder.id}).`,
            timestamp: new Date(),
            actor: { actorType: "customer", actorId: customer._id.toString() },
            metadata: { gatewayOrderId: razorpayOrder.id },
          },
        },
        options
      );
    }
  } catch (logErr) {
    // Non-blocking
  }

  return updatedPayment;
};

/**
 * Refund a captured Razorpay payment for an order.
 *
 * The refund amount is expressed in the order currency
 * while Razorpay receives the amount in minor units.
 *
 * refundReservedAmount protects the refundable balance
 * from concurrent refund attempts.
 */
const getLatestPaymentForOrder = async (
  orderId
) => {
  return paymentRepository.findLatestByOrderId(
    orderId
  );
};
const refundPaymentForOrder = async (
  orderId,
  userId,
  requestedAmount = null,
  customIdempotencyKey = null
) => {
  const order = await orderRepository.findById(orderId);
  if (!order) {
    throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  }

  let customer = null;
  if (userId) {
    const isDirectMatch = String(order.customerId) === String(userId);
    if (isDirectMatch) {
      customer = await Customer.findById(order.customerId);
    } else {
      customer = await Customer.findOne({
        $or: [{ userId }, { _id: userId }],
        isActive: true,
        deletedAt: null,
      });

      if (customer && customer._id.toString() !== order.customerId.toString()) {
        throw new AppError(
          "You are not allowed to access this order",
          403,
          "ORDER_ACCESS_DENIED"
        );
      }
    }
  }

  if (!customer) {
    customer = await Customer.findById(order.customerId);
  }

  const payment = await paymentRepository.findLatestByOrderId(order._id);
  if (!payment) {
    throw new AppError("Payment record not found", 404, "PAYMENT_NOT_FOUND");
  }

  if (payment.status === "refunded") {
    return payment;
  }

  if (!["captured", "partially_refunded"].includes(payment.status)) {
    throw new AppError(
      `Payment cannot be refunded from status ${payment.status}`,
      409,
      "PAYMENT_NOT_REFUNDABLE"
    );
  }

  if (!payment.gatewayPaymentId) {
    throw new AppError(
      "Captured payment is missing Razorpay payment ID",
      409,
      "PAYMENT_GATEWAY_ID_MISSING"
    );
  }

  const totalAmount = Number(payment.amount.toString());
  const refundedAmount = Number(payment.refundedAmount?.toString?.() || "0");
  const reservedAmount = Number(payment.refundReservedAmount?.toString?.() || "0");
  const refundableAmount = totalAmount - refundedAmount - reservedAmount;

  if (!Number.isFinite(refundableAmount) || refundableAmount <= 0) {
    if (refundedAmount >= totalAmount) {
      return paymentRepository.updateById(payment._id, {
        status: "refunded",
        refundReservedAmount: "0.00",
      });
    }

    throw new AppError(
      "No refundable payment amount remains",
      409,
      "NO_REFUNDABLE_AMOUNT"
    );
  }

  const amountToRefund =
    requestedAmount === null ? refundableAmount : Number(requestedAmount);

  if (
    !Number.isFinite(amountToRefund) ||
    amountToRefund <= 0 ||
    amountToRefund > refundableAmount
  ) {
    throw new AppError(
      "Invalid refund amount",
      400,
      "INVALID_REFUND_AMOUNT"
    );
  }

  const refundMinorUnits = decimalToMinorUnits(amountToRefund.toFixed(2));
  if (refundMinorUnits <= 0) {
    throw new AppError(
      "Refund amount must be greater than zero",
      400,
      "INVALID_REFUND_AMOUNT"
    );
  }

  const refundAmountString = amountToRefund.toFixed(2);
  const priorRefundedUnits = decimalToMinorUnits(
    payment.refundedAmount?.toString?.() || "0"
  );

  const refundIdempotencyKey = customIdempotencyKey
    ? String(customIdempotencyKey).trim()
    : `rfnd-${payment._id.toString().slice(-12)}-${priorRefundedUnits}-${refundMinorUnits}`;

  // 1. Idempotency Check BEFORE Calling Gateway
  const existingRefund = await refundRepository.findByIdempotencyKey(
    payment.gateway || PAYMENT_GATEWAYS.RAZORPAY,
    refundIdempotencyKey
  );

  if (existingRefund) {
    if (existingRefund.status === "processed") {
      const currentRefUnits = decimalToMinorUnits(
        payment.refundedAmount?.toString?.() || "0"
      );
      const existingRefUnits = decimalToMinorUnits(
        existingRefund.amount?.toString?.() || "0"
      );

      // If local payment record is out of sync due to prior local failure, synchronize it
      if (currentRefUnits < existingRefUnits || payment.status !== "refunded") {
        const newRefAmount = Math.min(
          totalAmount,
          Number((refundedAmount + Number(existingRefund.amount)).toFixed(2))
        );
        const isFullyRefunded = newRefAmount >= totalAmount;
        return await paymentRepository.updateById(payment._id, {
          refundedAmount: newRefAmount.toFixed(2),
          refundReservedAmount: "0.00",
          status: isFullyRefunded ? "refunded" : "partially_refunded",
          metadata: {
            ...payment.metadata,
            lastRefundId: existingRefund.gatewayRefundId || "",
            lastRefundStatus: "processed",
          },
        });
      }
      return payment;
    }

    if (
      existingRefund.status === "pending" ||
      existingRefund.status === "pending_reconciliation"
    ) {
      if (existingRefund.gatewayRefundId && payment.gateway !== "paypal") {
        try {
          const gwRefund = await razorpayProvider.fetchRefund(
            existingRefund.gatewayRefundId
          );
          if (gwRefund && gwRefund.status === "processed") {
            await refundRepository.updateById(existingRefund._id, {
              status: "processed",
              processedAt: new Date(),
              failureReason: null,
            });
            const newRefAmount = Math.min(
              totalAmount,
              Number((refundedAmount + amountToRefund).toFixed(2))
            );
            const isFullyRefunded = newRefAmount >= totalAmount;
            return await paymentRepository.updateById(payment._id, {
              refundedAmount: newRefAmount.toFixed(2),
              refundReservedAmount: "0.00",
              status: isFullyRefunded ? "refunded" : "partially_refunded",
              metadata: {
                ...payment.metadata,
                lastRefundId: existingRefund.gatewayRefundId,
                lastRefundStatus: "processed",
              },
            });
          }
        } catch {
          // If provider query is pending, continue to block duplicate
        }
      }

      throw new AppError(
        "A refund with this idempotency key is already pending reconciliation",
        409,
        "REFUND_PENDING_RECONCILIATION"
      );
    }
  }

  // 2. Atomic Reservation: Guarantees concurrent requests cannot over-refund
  const reservation = await paymentRepository.reserveRefundAmount(
    payment._id,
    refundAmountString
  );

  if (!reservation) {
    throw new AppError(
      "Refund amount is no longer available",
      409,
      "REFUND_AMOUNT_UNAVAILABLE"
    );
  }

  let gatewaySucceeded = false;
  let gatewayRefundId = null;
  let refundStatus = "processed";

  try {
    let refund;

    if (payment.gateway === "paypal") {
      refund = await paypalProvider.refundCapture(
        payment.gatewayPaymentId,
        {
          amount: refundAmountString,
          currency: order.currency,
          note: `Order cancellation refund for ${order.orderNumber}`,
        }
      );
      gatewayRefundId = refund?.id || null;
      refundStatus = refund?.status === "COMPLETED" ? "processed" : "pending";
      gatewaySucceeded = true;
    } else {
      refund = await razorpayProvider.refundPayment({
        paymentId: payment.gatewayPaymentId,
        amount: refundMinorUnits,
        notes: {
          buyboxOrderId: order._id.toString(),
          orderNumber: order.orderNumber,
        },
        idempotencyKey: refundIdempotencyKey,
      });
      gatewayRefundId = refund?.id || null;
      refundStatus = refund?.status === "processed" ? "processed" : "pending";
      gatewaySucceeded = true;
    }

    const newRefundedAmount = refundedAmount + amountToRefund;
    const isFullyRefunded = newRefundedAmount >= totalAmount;

    // 3. Persist Local Refund Document
    try {
      await refundRepository.create({
        paymentId: payment._id,
        orderId: order._id,
        customerId: order.customerId,
        gateway: payment.gateway || PAYMENT_GATEWAYS.RAZORPAY,
        gatewayRefundId,
        amount: refundAmountString,
        currency: order.currency,
        status: refundStatus,
        reason: "Order cancellation refund",
        idempotencyKey: refundIdempotencyKey,
        processedAt: refundStatus === "processed" ? new Date() : null,
      });
    } catch (createError) {
      if (createError?.code === 11000) {
        const existing = await refundRepository.findByIdempotencyKey(
          payment.gateway || PAYMENT_GATEWAYS.RAZORPAY,
          refundIdempotencyKey
        );
        if (existing) {
          await refundRepository.updateById(existing._id, {
            gatewayRefundId,
            status: refundStatus,
            processedAt:
              refundStatus === "processed" ? new Date() : existing.processedAt,
          });
        }
      } else {
        // Gateway succeeded but local refund document creation threw
        // Do NOT release reservation; rethrow so payment sync can be recovered
        throw createError;
      }
    }

    // 4. Update Payment Record
    return await paymentRepository.updateById(payment._id, {
      refundedAmount: newRefundedAmount.toFixed(2),
      refundReservedAmount: "0.00",
      status: isFullyRefunded ? "refunded" : "partially_refunded",
      metadata: {
        ...payment.metadata,
        lastRefundId: gatewayRefundId || refund?.id || "",
        lastRefundStatus: refundStatus,
      },
    });
  } catch (error) {
    if (gatewaySucceeded) {
      // Gateway succeeded but local persistence failed!
      // NEVER release the reservation. The money has already left the gateway.
      // Record error for operational recovery
      try {
        await refundRepository.create({
          paymentId: payment._id,
          orderId: order._id,
          customerId: order.customerId,
          gateway: payment.gateway || PAYMENT_GATEWAYS.RAZORPAY,
          gatewayRefundId,
          amount: refundAmountString,
          currency: order.currency,
          status: "pending_reconciliation",
          reason: "Order cancellation refund",
          idempotencyKey: refundIdempotencyKey,
          failureReason:
            "Gateway succeeded but local sync failed: " + error.message,
        });
      } catch {
        // Squelch secondary persistence error
      }

      throw new AppError(
        "Refund processed at gateway, but local payment synchronization failed. Recovery required.",
        500,
        "REFUND_LOCAL_SYNC_FAILED"
      );
    }

    // Check if error was a provider network timeout
    const isTimeout =
      error.code === "ETIMEDOUT" ||
      error.code === "ECONNRESET" ||
      error.code === "ESOCKETTIMEDOUT" ||
      error.message?.toLowerCase().includes("timeout") ||
      error.message?.toLowerCase().includes("network error");

    if (isTimeout) {
      // Unknown outcome: keep reservation and create pending reconciliation refund
      try {
        await refundRepository.create({
          paymentId: payment._id,
          orderId: order._id,
          customerId: order.customerId,
          gateway: payment.gateway || PAYMENT_GATEWAYS.RAZORPAY,
          gatewayRefundId: null,
          amount: refundAmountString,
          currency: order.currency,
          status: "pending",
          reason: "Order cancellation refund (gateway timeout)",
          idempotencyKey: refundIdempotencyKey,
          failureReason: "Gateway timeout / uncertain outcome: " + error.message,
        });
      } catch {
        // Squelch secondary error
      }

      throw new AppError(
        "Gateway refund timed out with uncertain outcome. Retain reservation for reconciliation.",
        504,
        "GATEWAY_TIMEOUT_UNCERTAIN"
      );
    }

    // Check if the gateway tells us the payment was already refunded
    const isAlreadyRefunded =
      error.message?.includes("already been refunded") ||
      error.description?.includes("already been refunded") ||
      error.error?.description?.includes("already been refunded");

    if (isAlreadyRefunded) {
      await paymentRepository.updateById(payment._id, {
        status: "refunded",
        refundedAmount: totalAmount.toFixed(2),
        refundReservedAmount: "0.00",
      });
      return await paymentRepository.findById(payment._id);
    }

    // Definite failure prior to gateway processing (e.g. invalid arguments or bad gateway response)
    await paymentRepository.releaseRefundReservation(
      payment._id,
      refundAmountString
    );

    throw error;
  }
};

const createPayPalOrderForOrder = async (orderId, userId, idempotencyKey, options = {}) => {
  const order = await orderRepository.findById(orderId);

  if (!order) {
    throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  }

  const { customer } = await validateOrderPaymentAccess(order, userId, options);

  if (order.status !== "pending") {
    throw new AppError(
      `Cannot pay for order in '${order.status}' status`,
      400,
      "INVALID_ORDER_STATUS_FOR_PAYMENT"
    );
  }

  if (order.paymentStatus === "paid") {
    throw new AppError(
      "This order has already been paid",
      409,
      "ORDER_ALREADY_PAID"
    );
  }

  if (!paypalProvider.isConfigured()) {
    throw new AppError(
      "PayPal payment provider is not configured on this server",
      503,
      "PAYPAL_NOT_CONFIGURED"
    );
  }

  // Idempotency: find active payment
  const activePayment = await paymentRepository.findActiveByOrderId(order._id);
  if (activePayment && activePayment.gateway === "paypal" && activePayment.gatewayOrderId) {
    return {
      paymentId: activePayment._id,
      gatewayOrderId: activePayment.gatewayOrderId,
      gateway: "paypal",
      amount: order.grandTotal,
      currency: order.currency || "INR",
    };
  }

  const receipt = generateReceipt(order.orderNumber);
  const amount = Number(order.grandTotal.toString());

  const paypalOrder = await paypalProvider.createOrder({
    amount,
    currency: order.currency || "INR",
    receipt,
    referenceId: order._id.toString(),
  });

  const paymentData = {
    orderId: order._id,
    customerId: customer ? customer._id : null,
    guestId: order.isGuestOrder ? order.guestId : null,
    gateway: "paypal",
    gatewayOrderId: paypalOrder.id,
    amount: order.grandTotal,
    currency: order.currency || "INR",
    status: "created",
    method: "paypal",
    receipt,
    idempotencyKey: idempotencyKey || null,
  };

  const payment = await paymentRepository.create(paymentData);

  try {
    if (orderRepository && typeof orderRepository.appendPaymentAttempt === "function") {
      await orderRepository.appendPaymentAttempt(
        order._id,
        {
          attempt: {
            attemptNumber: (order.paymentAttempts?.length || 0) + 1,
            gateway: "paypal",
            method: "paypal",
            amount: order.grandTotal,
            currency: order.currency || "INR",
            status: "created",
            gatewayOrderId: paypalOrder.id,
            createdAt: new Date(),
          },
          timelineEvent: {
            event: "payment_attempt_started",
            title: "Payment Attempt Started",
            description: `Payment attempt initiated via PayPal (Order ID: ${paypalOrder.id}).`,
            timestamp: new Date(),
            actor: { actorType: order.isGuestOrder ? "guest" : "customer", actorId: order.isGuestOrder ? order.guestId : customer._id.toString() },
            metadata: { gatewayOrderId: paypalOrder.id },
          },
        }
      );
    }
  } catch (logErr) {
    // Non-blocking
  }

  return {
    paymentId: payment._id,
    gatewayOrderId: paypalOrder.id,
    gateway: "paypal",
    links: paypalOrder.links || [],
    amount: order.grandTotal,
    currency: order.currency || "INR",
  };
};

const capturePayPalOrder = async ({ orderId, userId, paypalOrderId, ...options }) => {
  const order = await orderRepository.findById(orderId);

  if (!order) {
    throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  }

  await validateOrderPaymentAccess(order, userId, options);

  const payment = await paymentRepository.findByGatewayOrderId("paypal", paypalOrderId);
  if (!payment) {
    throw new AppError(
      "Payment record not found for this PayPal transaction",
      404,
      "PAYMENT_NOT_FOUND"
    );
  }

  if (payment.status === "captured") {
    return payment;
  }

  if (!canTransitionPaymentStatus(payment.status, "captured")) {
    throw new AppError(
      `Payment cannot be transitioned to captured from ${payment.status}`,
      409,
      "INVALID_PAYMENT_STATUS_TRANSITION"
    );
  }

  let captureResult;
  try {
    captureResult = await paypalProvider.captureOrder(paypalOrderId);
  } catch (error) {
    // If order was already captured on PayPal, attempt authoritative reconciliation
    try {
      const fetchedOrder = await paypalProvider.fetchOrder(paypalOrderId);
      if (fetchedOrder?.status === "COMPLETED") {
        captureResult = fetchedOrder;
      } else {
        throw error;
      }
    } catch (fetchErr) {
      throw error;
    }
  }

  const status = captureResult.status;
  if (status !== "COMPLETED") {
    await paymentRepository.updateById(payment._id, {
      status: "failed",
      failureReason: `PayPal capture status: ${status}`,
    });
    throw new AppError(
      `PayPal payment capture did not complete (status: ${status})`,
      400,
      "PAYPAL_CAPTURE_NOT_COMPLETED"
    );
  }

  const captureObj =
    captureResult.purchase_units?.[0]?.payments?.captures?.[0];

  const captureId =
    captureObj?.id ||
    paypalOrderId;

  // Validate amount and currency
  const capturedAmount = captureObj?.amount?.value;
  const capturedCurrency = captureObj?.amount?.currency_code;

  if (capturedAmount !== undefined && capturedAmount !== null) {
    const expectedAmount = Number(order.grandTotal.toString());
    const actualAmount = Number(capturedAmount);
    if (Math.abs(actualAmount - expectedAmount) > 0.01) {
      throw new AppError(
        "PayPal payment amount does not match order total",
        409,
        "PAYPAL_AMOUNT_MISMATCH"
      );
    }
  }

  if (capturedCurrency) {
    const expectedCurrency = String(order.currency || "INR").toUpperCase();
    const actualCurrency = String(capturedCurrency).toUpperCase();
    if (actualCurrency !== expectedCurrency) {
      throw new AppError(
        "PayPal payment currency does not match order currency",
        409,
        "PAYPAL_CURRENCY_MISMATCH"
      );
    }
  }

  const updatedPayment = await paymentRepository.updateById(payment._id, {
    status: "captured",
    gatewayPaymentId: captureId,
    capturedAt: new Date(),
    failureReason: null,
  });

  await getOrderService().markOrderPaymentCaptured(order._id);

  return updatedPayment;
};

const listPaymentTransactions = async ({ page = 1, limit = 20, status, gateway } = {}) => {
  const filter = {};
  if (status && status !== "all") {
    filter.status = status;
  }
  if (gateway && gateway !== "all") {
    filter.gateway = gateway;
  }

  const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
  const Payment = require("../models/Payment");

  const [transactions, total] = await Promise.all([
    Payment.find(filter)
      .populate("customerId", "name email phone")
      .populate("orderId", "orderNumber status grandTotal")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Math.max(1, Number(limit))),
    Payment.countDocuments(filter),
  ]);

  return {
    transactions,
    meta: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Math.max(1, Number(limit))),
    },
  };
};

/**
 * Record payment cancellation or dismissal without deleting order or cart.
 */
const recordPaymentCancellation = async ({ orderId, userId, ...options }) => {
  const Order = require("../models/Order");
  const order = await Order.findById(orderId);
  if (!order) {
    throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  }

  const { customer } = await validateOrderPaymentAccess(order, userId, options);

  // Update latest pending attempt to cancelled
  const attempts = order.paymentAttempts || [];
  if (attempts.length > 0) {
    const lastAttempt = attempts[attempts.length - 1];
    if (lastAttempt.status === "created" || lastAttempt.status === "pending") {
      lastAttempt.status = "cancelled";
      lastAttempt.completedAt = new Date();
      lastAttempt.failureReason = "Customer dismissed or cancelled payment modal";
    }
    attempts.forEach((att, idx) => {
      if (!att.attemptNumber) {
        att.attemptNumber = idx + 1;
      }
    });
  }

  order.timeline = order.timeline || [];
  order.timeline.push({
    event: "payment_cancelled",
    title: "Payment Cancelled / Dismissed",
    description: "Customer closed payment modal without completing transaction.",
    timestamp: new Date(),
    actor: { actorType: order.isGuestOrder ? "guest" : "customer", actorId: order.isGuestOrder ? order.guestId : customer._id.toString() },
    metadata: { orderId: order._id.toString() },
  });

  await order.save();

  return {
    orderId: order._id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
  };
};

module.exports = {
  createPaymentForOrder,
  getLatestPaymentForOrder,
  refundPaymentForOrder,
  decimalToMinorUnits,
  generateReceipt,
  createPayPalOrderForOrder,
  capturePayPalOrder,
  listPaymentTransactions,
  recordPaymentCancellation,
};
