const paymentRepository = require("../repositories/payment.repository");
const orderRepository = require("../repositories/order.repository");
const razorpayProvider = require("../integrations/payments/razorpay.provider");
const logger = require("../config/logger");

const PAYMENT_GATEWAY = "razorpay";
const MINOR_UNIT_SCALE = 100;

const decimalToMinorUnits = (amount) => {
  const numericValue = Number(amount);
  if (Number.isNaN(numericValue) || numericValue < 0) {
    return 0;
  }
  return Math.round(numericValue * MINOR_UNIT_SCALE);
};

/**
 * Recover an orphaned local Payment (status: created, gatewayOrderId: null)
 * using a targeted Razorpay receipt lookup.
 *
 * Requirements:
 * - Fails closed if receipt is missing or invalid.
 * - Targeted lookup via GET /v1/orders?receipt=<receipt>.
 * - Exactly one matching order must be returned.
 * - Strict candidate validation (id, buyboxOrderId, orderNumber, amount, currency, receipt).
 * - Atomic gatewayOrderId linking via paymentRepository.linkOrphanGatewayOrderId.
 * - Safe race condition convergence.
 * - Never marks payment failed.
 * - Never creates a duplicate Razorpay order.
 *
 * @param {Object} params
 * @param {Object} params.payment - The local Payment document
 * @param {Object} [params.order] - The local Order document (optional, loaded if omitted)
 * @param {number} [params.expectedMinorUnits] - Precalculated expected amount in minor units
 * @returns {Promise<{ recovered: boolean, gatewayOrder?: Object, payment?: Object, reason?: string, error?: Error }>}
 */
const recoverOrphanedGatewayOrderByReceipt = async ({
  payment,
  order: providedOrder,
  expectedMinorUnits,
}) => {
  if (!payment || !payment._id) {
    return { recovered: false, reason: "INVALID_PAYMENT" };
  }

  if (payment.gateway !== PAYMENT_GATEWAY) {
    return { recovered: false, reason: "UNSUPPORTED_GATEWAY" };
  }

  if (payment.gatewayOrderId) {
    return { recovered: false, reason: "ALREADY_LINKED" };
  }

  if (payment.status !== "created") {
    return { recovered: false, reason: "INVALID_STATUS_FOR_RECOVERY" };
  }

  const receipt = payment.receipt?.toString?.().trim?.();
  if (!receipt) {
    return { recovered: false, reason: "NO_PERSISTED_RECEIPT" };
  }

  let order = providedOrder;
  if (!order) {
    order = await orderRepository.findById(payment.orderId);
  }

  if (!order) {
    logger.warn(
      {
        paymentId: payment._id,
        orderId: payment.orderId,
      },
      "Orphan recovery aborted: associated order not found"
    );
    return { recovered: false, reason: "ORDER_NOT_FOUND" };
  }

  let response;
  try {
    response = await razorpayProvider.fetchOrdersByReceipt(receipt);
  } catch (error) {
    logger.warn(
      {
        paymentId: payment._id,
        receipt,
        error: error.message,
      },
      "Failed to fetch Razorpay orders by receipt during orphan recovery"
    );
    return {
      recovered: false,
      reason: "GATEWAY_FETCH_FAILED",
      error,
    };
  }

  const items = Array.isArray(response?.items) ? response.items : [];

  if (items.length === 0) {
    return { recovered: false, reason: "ZERO_ORDERS_FOUND" };
  }

  if (items.length > 1) {
    logger.warn(
      {
        receipt,
        count: items.length,
        paymentId: payment._id,
        orderId: order._id,
      },
      "Multiple Razorpay orders found for single receipt; data anomaly, failing closed"
    );
    return { recovered: false, reason: "MULTIPLE_ORDERS_FOUND" };
  }

  const candidate = items[0];

  if (
    !candidate ||
    typeof candidate.id !== "string" ||
    !candidate.id.trim()
  ) {
    logger.warn(
      {
        paymentId: payment._id,
        receipt,
      },
      "Candidate gateway order has missing or invalid id"
    );
    return { recovered: false, reason: "INVALID_CANDIDATE_ORDER" };
  }

  // Identity check
  const candidateBuyboxOrderId =
    candidate.notes?.buyboxOrderId?.toString?.().trim?.();
  if (
    !candidateBuyboxOrderId ||
    candidateBuyboxOrderId !== order._id.toString()
  ) {
    logger.warn(
      {
        paymentId: payment._id,
        candidateGatewayOrderId: candidate.id,
        candidateBuyboxOrderId,
        expectedOrderId: order._id.toString(),
      },
      "Orphan recovery failed: buyboxOrderId mismatch"
    );
    return { recovered: false, reason: "IDENTITY_MISMATCH" };
  }

  // OrderNumber check if present in notes
  const candidateOrderNumber =
    candidate.notes?.orderNumber?.toString?.().trim?.();
  if (
    candidateOrderNumber &&
    candidateOrderNumber !== order.orderNumber?.toString?.().trim?.()
  ) {
    logger.warn(
      {
        paymentId: payment._id,
        candidateGatewayOrderId: candidate.id,
        candidateOrderNumber,
        expectedOrderNumber: order.orderNumber,
      },
      "Orphan recovery failed: orderNumber mismatch"
    );
    return { recovered: false, reason: "ORDER_NUMBER_MISMATCH" };
  }

  // Amount check
  const expectedAmount =
    expectedMinorUnits !== undefined
      ? expectedMinorUnits
      : decimalToMinorUnits(order.grandTotal);
  if (Number(candidate.amount) !== expectedAmount) {
    logger.warn(
      {
        paymentId: payment._id,
        candidateGatewayOrderId: candidate.id,
        gatewayAmount: candidate.amount,
        expectedAmount,
      },
      "Orphan recovery failed: amount mismatch"
    );
    return { recovered: false, reason: "AMOUNT_MISMATCH" };
  }

  // Currency check
  const expectedCurrency = order.currency?.toString?.().toUpperCase?.();
  const gatewayCurrency = candidate.currency?.toString?.().toUpperCase?.();
  if (gatewayCurrency !== expectedCurrency) {
    logger.warn(
      {
        paymentId: payment._id,
        candidateGatewayOrderId: candidate.id,
        gatewayCurrency,
        expectedCurrency,
      },
      "Orphan recovery failed: currency mismatch"
    );
    return { recovered: false, reason: "CURRENCY_MISMATCH" };
  }

  // Receipt match
  const candidateReceipt = candidate.receipt?.toString?.().trim?.();
  if (candidateReceipt !== receipt) {
    logger.warn(
      {
        paymentId: payment._id,
        candidateGatewayOrderId: candidate.id,
        candidateReceipt,
        expectedReceipt: receipt,
      },
      "Orphan recovery failed: receipt mismatch"
    );
    return { recovered: false, reason: "RECEIPT_MISMATCH" };
  }

  // Atomic link
  const linkedPayment = await paymentRepository.linkOrphanGatewayOrderId(
    payment._id,
    candidate.id.trim()
  );

  if (linkedPayment) {
    logger.info(
      {
        paymentId: linkedPayment._id,
        orderId: order._id,
        gatewayOrderId: candidate.id.trim(),
        receipt,
      },
      "Orphan payment successfully linked to gateway order via receipt"
    );
    return {
      recovered: true,
      gatewayOrder: candidate,
      payment: linkedPayment,
    };
  }

  // Race condition: check if concurrently linked
  const freshPayment = await paymentRepository.findById(payment._id);
  if (freshPayment?.gatewayOrderId === candidate.id.trim()) {
    logger.info(
      {
        paymentId: freshPayment._id,
        orderId: order._id,
        gatewayOrderId: candidate.id.trim(),
        receipt,
      },
      "Orphan payment was concurrently linked with matching gateway order"
    );
    return {
      recovered: true,
      gatewayOrder: candidate,
      payment: freshPayment,
    };
  }

  if (
    freshPayment?.gatewayOrderId &&
    freshPayment.gatewayOrderId !== candidate.id.trim()
  ) {
    logger.warn(
      {
        paymentId: payment._id,
        freshGatewayOrderId: freshPayment.gatewayOrderId,
        candidateGatewayOrderId: candidate.id.trim(),
      },
      "Orphan payment linking lost race to different gatewayOrderId"
    );
    return {
      recovered: false,
      reason: "CONCURRENT_LINK_CONFLICT",
      payment: freshPayment,
    };
  }

  return {
    recovered: false,
    reason: "LINK_FAILED",
  };
};

module.exports = {
  recoverOrphanedGatewayOrderByReceipt,
  decimalToMinorUnits,
};
