const crypto = require("crypto");

const orderRepository = require("../repositories/order.repository");
const paymentRepository = require("../repositories/payment.repository");

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
    await paymentRepository.findByIdempotencyKey(
      PAYMENT_GATEWAYS.RAZORPAY,
      normalizedIdempotencyKey
    );

  if (existingByKey) {
    if (
      existingByKey.orderId.toString() !==
      order._id.toString()
    ) {
      throw new AppError(
        "Idempotency key is already associated with another order",
        409,
        "IDEMPOTENCY_KEY_CONFLICT"
      );
    }

    return existingByKey;
  }

  const existingPayment =
    await paymentRepository.findLatestByOrderId(
      order._id
    );

  if (
    existingPayment &&
    existingPayment.gatewayOrderId &&
    ["created", "pending"].includes(
      existingPayment.status
    )
  ) {
    return existingPayment;
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

  /*
   * Claim the idempotency key before calling Razorpay.
   *
   * The unique database index protects us if two requests
   * arrive concurrently with the same key.
   */
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
      const existing =
        await paymentRepository.findByIdempotencyKey(
          PAYMENT_GATEWAYS.RAZORPAY,
          normalizedIdempotencyKey
        );

      if (existing) {
        return existing;
      }
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

module.exports = {
  createPaymentForOrder,
  decimalToMinorUnits,
};