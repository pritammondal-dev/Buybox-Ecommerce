const crypto = require("crypto");

const orderRepository = require("../repositories/order.repository");
const paymentRepository = require("../repositories/payment.repository");
const refundRepository = require("../repositories/refund.repository");

const razorpayProvider = require("../integrations/payments/razorpay.provider");

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
  const suffix = crypto
    .randomBytes(6)
    .toString("hex")
    .toUpperCase();

  return `BB-${orderNumber}-${suffix}`.slice(
    0,
    100
  );
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

const createPaymentForOrder = async (
  orderId,
  userId,
  idempotencyKey
) => {
  const customer = await validateCustomer(userId);

  const normalizedIdempotencyKey =
    validateIdempotencyKey(idempotencyKey);

  const order = await orderRepository.findById(
    orderId
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

    if (
      ["created", "pending", "captured"].includes(
        existingByKey.status
      )
    ) {
      if (existingByKey.gatewayOrderId) {
        return existingByKey;
      }

      throw new AppError(
        "Payment creation is currently in progress for this order. Please retry in a few seconds",
        409,
        "PAYMENT_CREATION_IN_PROGRESS"
      );
    }
  }

  const activePayment =
    await paymentRepository.findActiveByOrderId(
      order._id
    );

  if (activePayment) {
    if (activePayment.status === "authorized") {
      throw new AppError(
        "Payment has already been authorized for this order",
        409,
        "PAYMENT_ALREADY_AUTHORIZED"
      );
    }

    if (activePayment.gatewayOrderId) {
      if (
        activePayment.idempotencyKey ===
        normalizedIdempotencyKey
      ) {
        return activePayment;
      }

      throw new AppError(
        "An active payment already exists for this order",
        409,
        "ACTIVE_PAYMENT_EXISTS"
      );
    }

    throw new AppError(
      "Payment creation is currently in progress for this order. Please retry in a few seconds",
      409,
      "PAYMENT_CREATION_IN_PROGRESS"
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

  let payment;

  try {
    payment = await paymentRepository.create({
      orderId: order._id,
      customerId: customer._id,
      gateway: PAYMENT_GATEWAYS.RAZORPAY,
      gatewayOrderId: null,
      gatewayPaymentId: null,
      amount: order.grandTotal,
      currency: order.currency,
      status: "created",
      receipt: null,
      idempotencyKey:
        normalizedIdempotencyKey,
      metadata: {},
    });
  } catch (error) {
    if (error?.code === 11000) {
      const active =
        await paymentRepository.findActiveByOrderId(
          order._id
        );

      if (active) {
        if (active.status === "authorized") {
          throw new AppError(
            "Payment has already been authorized for this order",
            409,
            "PAYMENT_ALREADY_AUTHORIZED"
          );
        }

        if (active.gatewayOrderId) {
          if (
            active.idempotencyKey ===
            normalizedIdempotencyKey
          ) {
            return active;
          }

          throw new AppError(
            "An active payment already exists for this order",
            409,
            "ACTIVE_PAYMENT_EXISTS"
          );
        }

        throw new AppError(
          "Payment creation is currently in progress for this order. Please retry in a few seconds",
          409,
          "PAYMENT_CREATION_IN_PROGRESS"
        );
      }

      const byKey =
        await paymentRepository.findByOrderIdAndIdempotencyKey(
          order._id,
          PAYMENT_GATEWAYS.RAZORPAY,
          normalizedIdempotencyKey
        );

      if (byKey && byKey.gatewayOrderId) {
        return byKey;
      }

      throw new AppError(
        "Payment creation is currently in progress for this order. Please retry in a few seconds",
        409,
        "PAYMENT_CREATION_IN_PROGRESS"
      );
    }

    throw error;
  }

  const receipt = generateReceipt(
    order.orderNumber
  );

  let razorpayOrder;

  try {
    razorpayOrder =
      await razorpayProvider.createOrder({
        amount,
        currency: order.currency,
        receipt,
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
        receipt,
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
        receipt,
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
    const refund =
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

    const newRefundedAmount =
      refundedAmount + amountToRefund;

    const isFullyRefunded =
      newRefundedAmount >= totalAmount;

    try {
      await refundRepository.create({
        paymentId: payment._id,
        orderId: order._id,
        customerId: order.customerId,
        gateway: PAYMENT_GATEWAYS.RAZORPAY,
        gatewayRefundId: refund?.id || null,
        amount: refundAmountString,
        currency: order.currency,
        status: refund?.status === "processed" ? "processed" : "pending",
        reason: "Order cancellation refund",
        idempotencyKey: refundIdempotencyKey,
        processedAt: refund?.status === "processed" ? new Date() : null,
      });
    } catch (createError) {
      if (createError?.code === 11000) {
        const existingRefund =
          (await refundRepository.findByIdempotencyKey(
            PAYMENT_GATEWAYS.RAZORPAY,
            refundIdempotencyKey
          )) ||
          (refund?.id
            ? await refundRepository.findByGatewayRefundId(
                PAYMENT_GATEWAYS.RAZORPAY,
                refund.id
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

module.exports = {
  createPaymentForOrder,
  getLatestPaymentForOrder,
  refundPaymentForOrder,
  decimalToMinorUnits,
};




