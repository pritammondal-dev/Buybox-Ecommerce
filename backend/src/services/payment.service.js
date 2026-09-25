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

const createPaymentForOrder = async (
  orderId,
  userId,
  idempotencyKey,
  options = {}
) => {
  const customer = await validateCustomer(userId);

  const normalizedIdempotencyKey =
    validateIdempotencyKey(idempotencyKey);

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

  if (
    order.customerId.toString() !==
    customer._id.toString()
  ) {
    throw new AppError(
      "You are not allowed to access this order",
      403,
      "ORDER_ACCESS_DENIED"
    );
  }

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
        customerId: customer._id,
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
  requestedAmount = null
) => {
  const customer = await validateCustomer(userId);

  const order =
    await orderRepository.findById(orderId);

  if (!order) {
    throw new AppError(
      "Order not found",
      404,
      "ORDER_NOT_FOUND"
    );
  }

  if (
    order.customerId.toString() !==
    customer._id.toString()
  ) {
    throw new AppError(
      "You are not allowed to access this order",
      403,
      "ORDER_ACCESS_DENIED"
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

  const totalAmount =
    Number(payment.amount.toString());

  const refundedAmount =
    Number(
      payment.refundedAmount?.toString?.() || "0"
    );

  const reservedAmount =
    Number(
      payment.refundReservedAmount?.toString?.() ||
        "0"
    );

  const refundableAmount =
    totalAmount -
    refundedAmount -
    reservedAmount;

  if (
    !Number.isFinite(refundableAmount) ||
    refundableAmount <= 0
  ) {
    if (refundedAmount >= totalAmount) {
      return paymentRepository.updateById(
        payment._id,
        {
          status: "refunded",
        }
      );
    }

    throw new AppError(
      "No refundable payment amount remains",
      409,
      "NO_REFUNDABLE_AMOUNT"
    );
  }

  const amountToRefund =
    requestedAmount === null
      ? refundableAmount
      : Number(requestedAmount);

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

  const refundMinorUnits =
    decimalToMinorUnits(
      amountToRefund.toFixed(2)
    );

  if (refundMinorUnits <= 0) {
    throw new AppError(
      "Refund amount must be greater than zero",
      400,
      "INVALID_REFUND_AMOUNT"
    );
  }

  const refundAmountString =
    amountToRefund.toFixed(2);

  const priorRefundedUnits = decimalToMinorUnits(
    payment.refundedAmount?.toString?.() || "0"
  );

  const refundIdempotencyKey = `rfnd-${payment._id.toString().slice(-12)}-${priorRefundedUnits}-${refundMinorUnits}`;

  const reservation =
    await paymentRepository.reserveRefundAmount(
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

  try {
    let refund;
    let gatewayRefundId = null;
    let refundStatus = "processed";

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
      refundStatus =
        refund?.status === "COMPLETED"
          ? "processed"
          : "pending";
    } else {
      refund =
        await razorpayProvider.refundPayment({
          paymentId:
            payment.gatewayPaymentId,
          amount:
            refundMinorUnits,
          notes: {
            buyboxOrderId:
              order._id.toString(),
            orderNumber:
              order.orderNumber,
          },
          idempotencyKey:
            refundIdempotencyKey,
        });
      gatewayRefundId = refund?.id || null;
      refundStatus =
        refund?.status === "processed"
          ? "processed"
          : "pending";
    }

    const newRefundedAmount =
      refundedAmount + amountToRefund;

    const isFullyRefunded =
      newRefundedAmount >= totalAmount;

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
        processedAt:
          refundStatus === "processed"
            ? new Date()
            : null,
      });
    } catch (createError) {
      if (createError?.code === 11000) {
        const existingRefund =
          (await refundRepository.findByIdempotencyKey(
            payment.gateway || PAYMENT_GATEWAYS.RAZORPAY,
            refundIdempotencyKey
          )) ||
          (gatewayRefundId
            ? await refundRepository.findByGatewayRefundId(
                payment.gateway || PAYMENT_GATEWAYS.RAZORPAY,
                gatewayRefundId
              )
            : null);

        if (
          !existingRefund ||
          existingRefund.paymentId.toString() !== payment._id.toString() ||
          existingRefund.orderId.toString() !== order._id.toString()
        ) {
          throw createError;
        }
      } else {
        throw createError;
      }
    }

    return await paymentRepository.updateById(
      payment._id,
      {
        refundedAmount:
          newRefundedAmount.toFixed(2),
        refundReservedAmount: "0.00",
        status:
          isFullyRefunded
            ? "refunded"
            : "partially_refunded",
        metadata: {
          lastRefundId:
            refund?.id || "",
          lastRefundStatus:
            refund?.status || "",
        },
      }
    );
  } catch (error) {
    await paymentRepository.releaseRefundReservation(
      payment._id,
      refundAmountString
    );

    throw error;
  }
};

const createPayPalOrderForOrder = async (orderId, userId, idempotencyKey) => {
  const customer = await validateCustomer(userId);
  const order = await orderRepository.findById(orderId);

  if (!order) {
    throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  }

  if (order.customerId.toString() !== customer._id.toString()) {
    throw new AppError(
      "You are not allowed to create payments for this order",
      403,
      "ORDER_ACCESS_DENIED"
    );
  }

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
    customerId: customer._id,
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
            actor: { actorType: "customer", actorId: customer._id.toString() },
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

const capturePayPalOrder = async ({ orderId, userId, paypalOrderId }) => {
  const customer = await validateCustomer(userId);
  const order = await orderRepository.findById(orderId);

  if (!order) {
    throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  }

  if (order.customerId.toString() !== customer._id.toString()) {
    throw new AppError(
      "You are not allowed to verify payments for this order",
      403,
      "ORDER_ACCESS_DENIED"
    );
  }

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

  const captureResult = await paypalProvider.captureOrder(paypalOrderId);

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

  const captureId =
    captureResult.purchase_units?.[0]?.payments?.captures?.[0]?.id || paypalOrderId;

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
const recordPaymentCancellation = async ({ orderId, userId }) => {
  const customer = await validateCustomer(userId);
  const Order = require("../models/Order");
  const order = await Order.findOne({ _id: orderId, customerId: customer._id });
  if (!order) {
    throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  }

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
    actor: { actorType: "customer", actorId: customer._id.toString() },
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
