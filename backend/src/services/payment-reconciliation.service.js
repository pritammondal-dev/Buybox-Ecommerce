const paymentRepository = require("../repositories/payment.repository");
const orderRepository = require("../repositories/order.repository");
const orderService = require("./order.service");
const { decimalToMinorUnits } = require("./payment.service");
const razorpayProvider = require("../integrations/payments/razorpay.provider");
const env = require("../config/env");
const logger = require("../config/logger");

const PAYMENT_GATEWAY = "razorpay";

class PaymentReconciliationService {
  /**
   * Reconcile a single active payment against authoritative Razorpay state.
   *
   * Fails closed without modifying local payment status if:
   * - Razorpay API calls fail (network/502)
   * - Order identity notes do not match local order
   * - Amount or currency does not match order
   * - Gateway order status is not 'paid'
   * - No concrete captured payment with valid non-empty ID exists
   *
   * Never marks payments failed based on age alone.
   * Never sets gatewayPaymentId to null.
   * Never creates duplicate gateway orders.
   */
  async reconcilePayment(payment) {
    if (!payment || !payment._id) {
      return { reconciled: false, reason: "INVALID_PAYMENT" };
    }

    if (payment.gateway !== PAYMENT_GATEWAY) {
      return { reconciled: false, reason: "UNSUPPORTED_GATEWAY" };
    }

    if (!payment.gatewayOrderId || typeof payment.gatewayOrderId !== "string" || !payment.gatewayOrderId.trim()) {
      return { reconciled: false, reason: "MISSING_GATEWAY_ORDER_ID" };
    }

    const order = await orderRepository.findById(payment.orderId);
    if (!order) {
      logger.warn(
        {
          paymentId: payment._id,
          orderId: payment.orderId,
        },
        "Reconciliation aborted: associated order not found"
      );
      return { reconciled: false, reason: "ORDER_NOT_FOUND" };
    }

    let gatewayOrder;
    try {
      gatewayOrder = await razorpayProvider.fetchOrder(
        payment.gatewayOrderId.trim()
      );
    } catch (fetchOrderError) {
      logger.warn(
        {
          paymentId: payment._id,
          gatewayOrderId: payment.gatewayOrderId,
          error: fetchOrderError.message,
        },
        "Reconciliation fail-closed: unable to fetch gateway order"
      );
      return { reconciled: false, reason: "GATEWAY_ORDER_FETCH_FAILED" };
    }

    // Authoritative identity check
    const buyboxOrderId = gatewayOrder?.notes?.buyboxOrderId?.toString?.().trim?.();
    if (!buyboxOrderId || buyboxOrderId !== order._id.toString()) {
      logger.warn(
        {
          paymentId: payment._id,
          gatewayOrderId: payment.gatewayOrderId,
          gatewayBuyboxOrderId: buyboxOrderId || null,
          expectedOrderId: order._id.toString(),
        },
        "Reconciliation fail-closed: gateway order identity mismatch"
      );
      return { reconciled: false, reason: "IDENTITY_MISMATCH" };
    }

    const orderNumberNote = gatewayOrder?.notes?.orderNumber?.toString?.().trim?.();
    if (orderNumberNote && orderNumberNote !== order.orderNumber?.toString?.().trim?.()) {
      logger.warn(
        {
          paymentId: payment._id,
          gatewayOrderId: payment.gatewayOrderId,
          gatewayOrderNumber: orderNumberNote,
          expectedOrderNumber: order.orderNumber,
        },
        "Reconciliation fail-closed: gateway order number note mismatch"
      );
      return { reconciled: false, reason: "IDENTITY_MISMATCH" };
    }

    // Amount and currency validation
    const expectedAmount = decimalToMinorUnits(order.grandTotal);
    const gatewayAmount = Number(gatewayOrder?.amount);
    const gatewayCurrency = gatewayOrder?.currency?.toString?.().toUpperCase?.();
    const localCurrency = order.currency?.toString?.().toUpperCase?.();

    if (gatewayAmount !== expectedAmount || gatewayCurrency !== localCurrency) {
      logger.warn(
        {
          paymentId: payment._id,
          gatewayOrderId: payment.gatewayOrderId,
          gatewayAmount,
          expectedAmount,
          gatewayCurrency,
          localCurrency,
        },
        "Reconciliation fail-closed: gateway order amount or currency mismatch"
      );
      return { reconciled: false, reason: "AMOUNT_OR_CURRENCY_MISMATCH" };
    }

    // If Razorpay order is not paid, do not mark failed or alter payment
    if (gatewayOrder.status !== "paid") {
      return {
        reconciled: false,
        reason: "GATEWAY_ORDER_NOT_PAID",
        gatewayStatus: gatewayOrder.status,
      };
    }

    // Fetch authoritative list of payments under this gateway order
    let paymentsResponse;
    try {
      paymentsResponse = await razorpayProvider.fetchOrderPayments(
        payment.gatewayOrderId.trim()
      );
    } catch (fetchPaymentsError) {
      logger.warn(
        {
          paymentId: payment._id,
          gatewayOrderId: payment.gatewayOrderId,
          error: fetchPaymentsError.message,
        },
        "Reconciliation fail-closed: unable to fetch gateway order payments"
      );
      return { reconciled: false, reason: "GATEWAY_PAYMENTS_FETCH_FAILED" };
    }

    const items = Array.isArray(paymentsResponse?.items)
      ? paymentsResponse.items
      : [];

    const capturedPayment = items.find(
      (p) =>
        p.status === "captured" &&
        typeof p.id === "string" &&
        p.id.trim().length > 0 &&
        Number(p.amount) === expectedAmount &&
        p.currency?.toString().toUpperCase() === localCurrency
    );

    if (!capturedPayment) {
      logger.warn(
        {
          paymentId: payment._id,
          gatewayOrderId: payment.gatewayOrderId,
          itemCount: items.length,
        },
        "Reconciliation fail-closed: no matching captured payment found on gateway"
      );
      return { reconciled: false, reason: "NO_CAPTURED_PAYMENT_FOUND" };
    }

    // Idempotency check before update
    const freshPayment = await paymentRepository.findById(payment._id);
    if (freshPayment?.status === "captured") {
      await orderService.markOrderPaymentCaptured(order._id);
      return {
        reconciled: true,
        alreadyCaptured: true,
        paymentId: freshPayment._id,
        orderId: order._id,
      };
    }

    if (!freshPayment || !["created", "pending", "authorized"].includes(freshPayment.status)) {
      return { reconciled: false, reason: "PAYMENT_NOT_ACTIVE" };
    }

    const capturedPaymentId = capturedPayment.id.trim();
    const updateData = {
      status: "captured",
      gatewayPaymentId: capturedPaymentId,
      method: capturedPayment.method || payment.method || null,
      capturedAt: capturedPayment.captured_at
        ? new Date(capturedPayment.captured_at * 1000)
        : new Date(),
      failureReason: null,
    };

    // Atomic conditional update to prevent racing with concurrent webhook/verification
    const updatedPayment = await paymentRepository.reconcileActivePayment(
      payment._id,
      updateData
    );

    if (!updatedPayment) {
      const latestPayment = await paymentRepository.findById(payment._id);
      if (latestPayment?.status === "captured") {
        await orderService.markOrderPaymentCaptured(order._id);
        return {
          reconciled: true,
          alreadyCaptured: true,
          paymentId: latestPayment._id,
          orderId: order._id,
        };
      }
      return { reconciled: false, reason: "CONCURRENT_STATUS_CHANGE" };
    }

    // Synchronize order state idempotently
    await orderService.markOrderPaymentCaptured(order._id);

    logger.info(
      {
        paymentId: updatedPayment._id,
        orderId: order._id,
        gatewayOrderId: payment.gatewayOrderId,
        gatewayPaymentId: capturedPaymentId,
      },
      "Payment successfully reconciled to captured by reconciliation worker"
    );

    return {
      reconciled: true,
      paymentId: updatedPayment._id,
      orderId: order._id,
    };
  }

  /**
   * Scan and reconcile a bounded batch of active payments.
   */
  async reconcileActivePaymentsBatch(options = {}) {
    const batchSize =
      options.batchSize || env.PAYMENT_RECONCILIATION_BATCH_SIZE;

    const eligiblePayments =
      await paymentRepository.findEligibleForReconciliation({
        limit: batchSize,
        gateway: options.gateway || PAYMENT_GATEWAY,
      });

    let scanned = eligiblePayments.length;
    let reconciled = 0;
    let skipped = 0;
    let failed = 0;

    for (const payment of eligiblePayments) {
      try {
        const result = await this.reconcilePayment(payment);
        if (result.reconciled) {
          reconciled += 1;
        } else {
          skipped += 1;
        }
      } catch (error) {
        failed += 1;
        logger.error(
          {
            paymentId: payment._id,
            gatewayOrderId: payment.gatewayOrderId,
            error: error.message,
          },
          "Unexpected error during payment reconciliation"
        );
      }
    }

    return {
      scanned,
      reconciled,
      skipped,
      failed,
    };
  }
}

module.exports = new PaymentReconciliationService();
