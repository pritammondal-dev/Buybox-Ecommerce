const orderRepository = require("../repositories/order.repository");
const paymentRepository = require("../repositories/payment.repository");
const orderService = require("./order.service");
const paymentReconciliationService = require("./payment-reconciliation.service");
const env = require("../config/env");
const logger = require("../config/logger");

class OrderExpirationService {
  /**
   * Scan and expire abandoned pending orders that have exceeded the timeout window.
   *
   * Safety Invariants:
   * 1. Hard Rule: Orders with an 'authorized' payment are NEVER expired.
   * 2. Captured payment safety: Verifies amount, currency, and order association.
   *    If valid, confirms order and skips expiration. If inconsistent, fails closed.
   * 3. Active 'created' / 'pending' payments: Never expired on age alone.
   *    Reconciled against Razorpay first. Gateway uncertainty fails closed.
   * 4. Failed / cancelled-only or zero payments: Eligible once age exceeds cutoff.
   * 5. Atomicity & Concurrency: Calls orderService.expirePendingOrder inside transaction.
   * 6. Per-order fault isolation: One order failure does not abort the batch.
   */
  async reconcileAndExpirePendingOrders(options = {}) {
    const timeoutMinutes =
      options.timeoutMinutes || env.ORDER_EXPIRATION_TIMEOUT_MINUTES || 30;
    const batchSize =
      options.batchSize || env.ORDER_EXPIRATION_BATCH_SIZE || 50;

    const cutoffDate = new Date(
      Date.now() - timeoutMinutes * 60 * 1000
    );

    const eligibleOrders =
      await orderRepository.findEligibleForExpiration(
        { cutoffDate, limit: batchSize },
        options
      );

    let scanned = eligibleOrders.length;
    let expired = 0;
    let reconciled = 0;
    let skipped = 0;
    let failed = 0;

    for (const order of eligibleOrders) {
      try {
        const result = await this.processSingleOrderExpiration(order, options);
        if (result.expired) {
          expired += 1;
        } else if (result.reconciled) {
          reconciled += 1;
        } else {
          skipped += 1;
        }
      } catch (error) {
        failed += 1;
        logger.error(
          {
            orderId: order._id,
            orderNumber: order.orderNumber,
            error: error.message,
          },
          "Unexpected error during order expiration"
        );
      }
    }

    return {
      scanned,
      expired,
      reconciled,
      skipped,
      failed,
    };
  }

  /**
   * Process expiration checks for a single pending order.
   */
  async processSingleOrderExpiration(order, options = {}) {
    if (!order || !order._id) {
      return { expired: false, reason: "INVALID_ORDER" };
    }

    // Fast check: verify order is still pending
    if (order.status !== "pending") {
      return { expired: false, reason: "ORDER_NOT_PENDING" };
    }

    const payments = await paymentRepository.findByOrderId(order._id);

    // 1. Captured Payment Safety Check
    const capturedPayment = payments.find(
      (p) => p.status === "captured" || p.status === "paid"
    );

    if (capturedPayment) {
      const isConsistent = this.validateCapturedPaymentSafety(order, capturedPayment);

      if (!isConsistent) {
        logger.warn(
          {
            orderId: order._id,
            paymentId: capturedPayment._id,
          },
          "Order expiration failed-closed: inconsistent captured payment data"
        );
        return { expired: false, reason: "INCONSISTENT_CAPTURED_PAYMENT" };
      }

      // Synchronize order if not already confirmed
      if (order.status !== "confirmed" || order.paymentStatus !== "paid") {
        await orderService.markOrderPaymentCaptured(order._id);
        return { expired: false, reconciled: true, reason: "SYNCHRONIZED_CAPTURED_ORDER" };
      }

      return { expired: false, reason: "ORDER_ALREADY_CAPTURED" };
    }

    // 2. Authorized Payment Safety Check (HARD RULE)
    const hasAuthorized = payments.some((p) => p.status === "authorized");
    if (hasAuthorized) {
      logger.info(
        {
          orderId: order._id,
        },
        "Order expiration skipped: payment is authorized (awaiting capture)"
      );
      return { expired: false, reason: "PAYMENT_AUTHORIZED" };
    }

    // 3. Active 'created' / 'pending' Payment Check (Reconcile with gateway)
    const activePayment = payments.find((p) =>
      ["created", "pending"].includes(p.status)
    );

    if (activePayment) {
      let reconResult;
      try {
        reconResult = await paymentReconciliationService.reconcilePayment(activePayment);
      } catch (reconError) {
        logger.warn(
          {
            orderId: order._id,
            paymentId: activePayment._id,
            error: reconError.message,
          },
          "Order expiration failed-closed: gateway reconciliation error"
        );
        return { expired: false, reason: "GATEWAY_RECONCILIATION_FAILED" };
      }

      // If Razorpay reports payment captured, order is confirmed, skip expiration
      if (reconResult?.reconciled) {
        return { expired: false, reconciled: true, reason: "PAYMENT_RECONCILED_CAPTURED" };
      }

      // If gateway check failed or returned uncertainty, fail closed
      const failClosedReasons = [
        "GATEWAY_ORDER_FETCH_FAILED",
        "GATEWAY_PAYMENTS_FETCH_FAILED",
        "GATEWAY_ORDER_NOT_FOUND",
        "IDENTITY_MISMATCH",
        "AMOUNT_OR_CURRENCY_MISMATCH",
        "UNSUPPORTED_GATEWAY",
      ];

      if (failClosedReasons.includes(reconResult?.reason)) {
        logger.warn(
          {
            orderId: order._id,
            paymentId: activePayment._id,
            reason: reconResult.reason,
          },
          "Order expiration failed-closed: gateway returned uncertainty"
        );
        return { expired: false, reason: `GATEWAY_UNCERTAIN_${reconResult.reason}` };
      }

      // If Razorpay definitively confirmed order is unpaid
      const definitiveUnpaidReasons = [
        "GATEWAY_ORDER_NOT_PAID",
        "NO_CAPTURED_PAYMENT_FOUND",
      ];

      if (!definitiveUnpaidReasons.includes(reconResult?.reason)) {
        // Unknown response from gateway -> fail closed
        logger.warn(
          {
            orderId: order._id,
            paymentId: activePayment._id,
            reason: reconResult?.reason,
          },
          "Order expiration failed-closed: unconfirmed gateway response"
        );
        return { expired: false, reason: "GATEWAY_UNCERTAIN_UNKNOWN_REASON" };
      }
    }

    // 4. Order is eligible for expiration:
    // Either zero payments exist, or all payments are failed/cancelled,
    // or active payment was authoritatively verified as unpaid on Razorpay.
    const expiredOrder = await orderService.expirePendingOrder(order._id, options);

    logger.info(
      {
        orderId: expiredOrder._id,
        orderNumber: expiredOrder.orderNumber,
      },
      "Pending order expired and inventory released successfully"
    );

    return {
      expired: true,
      orderId: expiredOrder._id,
    };
  }

  /**
   * Validate that a captured payment strictly belongs to this order
   * with matching amounts, currencies, and identifiers.
   */
  validateCapturedPaymentSafety(order, payment) {
    if (!payment || !order) {
      return false;
    }

    if (payment.orderId.toString() !== order._id.toString()) {
      return false;
    }

    try {
      const orderMinorUnits = orderService.decimalToMinorUnits(order.grandTotal);
      const paymentMinorUnits = orderService.decimalToMinorUnits(payment.amount);

      if (orderMinorUnits !== paymentMinorUnits) {
        return false;
      }
    } catch {
      return false;
    }

    const orderCurrency = (order.currency || "").toString().toUpperCase();
    const paymentCurrency = (payment.currency || "").toString().toUpperCase();

    if (orderCurrency !== paymentCurrency) {
      return false;
    }

    return true;
  }
}

module.exports = new OrderExpirationService();
