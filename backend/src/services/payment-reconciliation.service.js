const paymentRepository = require("../repositories/payment.repository");
const orderRepository = require("../repositories/order.repository");
const orderService = require("./order.service");
const {
  decimalToMinorUnits,
  recoverOrphanedGatewayOrderByReceipt,
} = require("./payment-orphan-recovery.service");
const razorpayProvider = require("../integrations/payments/razorpay.provider");
const paypalProvider = require("../integrations/payments/paypal.provider");
const env = require("../config/env");
const logger = require("../config/logger");

const PAYMENT_GATEWAY = "razorpay";

class PaymentReconciliationService {
  /**
   * Reconcile a single active payment against authoritative gateway state (Razorpay or PayPal).
   *
   * Fails closed without modifying local payment status if:
   * - Gateway API calls fail (network/502)
   * - Order identity notes do not match local order
   * - Amount or currency does not match order
   * - Gateway order status is not 'paid' / 'COMPLETED'
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

    if (payment.gateway === "paypal") {
      return this.reconcilePayPalPayment(payment);
    }

    if (payment.gateway !== PAYMENT_GATEWAY) {
      return { reconciled: false, reason: "UNSUPPORTED_GATEWAY" };
    }

    let currentPayment = payment;

    if (
      !currentPayment.gatewayOrderId ||
      typeof currentPayment.gatewayOrderId !== "string" ||
      !currentPayment.gatewayOrderId.trim()
    ) {
      if (!currentPayment.receipt) {
        return { reconciled: false, reason: "MISSING_GATEWAY_ORDER_ID" };
      }

      const recoveryResult =
        await recoverOrphanedGatewayOrderByReceipt({
          payment: currentPayment,
        });

      if (!recoveryResult.recovered) {
        return {
          reconciled: false,
          reason: recoveryResult.reason || "GATEWAY_ORDER_NOT_FOUND",
        };
      }

      currentPayment = recoveryResult.payment || currentPayment;
    }

    const order = await orderRepository.findById(currentPayment.orderId);
    if (!order) {
      logger.warn(
        {
          paymentId: currentPayment._id,
          orderId: currentPayment.orderId,
        },
        "Reconciliation aborted: associated order not found"
      );
      return { reconciled: false, reason: "ORDER_NOT_FOUND" };
    }

    let gatewayOrder;
    try {
      gatewayOrder = await razorpayProvider.fetchOrder(
        currentPayment.gatewayOrderId.trim()
      );
    } catch (fetchOrderError) {
      logger.warn(
        {
          paymentId: currentPayment._id,
          gatewayOrderId: currentPayment.gatewayOrderId,
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
          paymentId: currentPayment._id,
          gatewayOrderId: currentPayment.gatewayOrderId,
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
          paymentId: currentPayment._id,
          gatewayOrderId: currentPayment.gatewayOrderId,
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
          paymentId: currentPayment._id,
          gatewayOrderId: currentPayment.gatewayOrderId,
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
        currentPayment.gatewayOrderId.trim()
      );
    } catch (fetchPaymentsError) {
      logger.warn(
        {
          paymentId: currentPayment._id,
          gatewayOrderId: currentPayment.gatewayOrderId,
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
          paymentId: currentPayment._id,
          gatewayOrderId: currentPayment.gatewayOrderId,
          itemCount: items.length,
        },
        "Reconciliation fail-closed: no matching captured payment found on gateway"
      );
      return { reconciled: false, reason: "NO_CAPTURED_PAYMENT_FOUND" };
    }

    // Idempotency check before update
    const freshPayment = await paymentRepository.findById(currentPayment._id);
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
      method: capturedPayment.method || currentPayment.method || null,
      capturedAt: capturedPayment.captured_at
        ? new Date(capturedPayment.captured_at * 1000)
        : new Date(),
      failureReason: null,
    };

    // Atomic conditional update to prevent racing with concurrent webhook/verification
    const updatedPayment = await paymentRepository.reconcileActivePayment(
      currentPayment._id,
      updateData
    );

    if (!updatedPayment) {
      const latestPayment = await paymentRepository.findById(currentPayment._id);
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
        gatewayOrderId: currentPayment.gatewayOrderId,
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
   * Reconcile a single active PayPal payment against authoritative PayPal order state.
   */
  async reconcilePayPalPayment(payment) {
    if (!payment.gatewayOrderId || typeof payment.gatewayOrderId !== "string" || !payment.gatewayOrderId.trim()) {
      return { reconciled: false, reason: "MISSING_GATEWAY_ORDER_ID" };
    }

    const order = await orderRepository.findById(payment.orderId);
    if (!order) {
      logger.warn(
        { paymentId: payment._id, orderId: payment.orderId },
        "PayPal reconciliation aborted: associated order not found"
      );
      return { reconciled: false, reason: "ORDER_NOT_FOUND" };
    }

    let paypalOrder;
    try {
      paypalOrder = await paypalProvider.fetchOrder(payment.gatewayOrderId.trim());
    } catch (err) {
      logger.warn(
        { paymentId: payment._id, gatewayOrderId: payment.gatewayOrderId, error: err.message },
        "PayPal reconciliation fail-closed: unable to fetch PayPal order"
      );
      return { reconciled: false, reason: "GATEWAY_ORDER_FETCH_FAILED" };
    }

    if (paypalOrder.status === "VOIDED") {
      const freshPayment = await paymentRepository.findById(payment._id);
      if (freshPayment && ["created", "pending", "authorized"].includes(freshPayment.status)) {
        await paymentRepository.updateById(payment._id, {
          status: "failed",
          failureReason: "PayPal order was voided",
        });
        return { reconciled: true, status: "failed", paymentId: payment._id };
      }
    }

    if (paypalOrder.status !== "COMPLETED") {
      return {
        reconciled: false,
        reason: "GATEWAY_ORDER_NOT_PAID",
        gatewayStatus: paypalOrder.status,
      };
    }

    const capture = paypalOrder.purchase_units?.[0]?.payments?.captures?.[0];
    if (!capture || capture.status !== "COMPLETED") {
      return { reconciled: false, reason: "NO_CAPTURED_PAYMENT_FOUND" };
    }

    // Amount & currency validation
    const expectedAmount = Number(order.grandTotal.toString());
    const actualAmount = Number(capture.amount?.value);
    const expectedCurrency = String(order.currency || "INR").toUpperCase();
    const actualCurrency = String(capture.amount?.currency_code).toUpperCase();

    if (Math.abs(actualAmount - expectedAmount) > 0.01 || actualCurrency !== expectedCurrency) {
      logger.warn(
        {
          paymentId: payment._id,
          gatewayOrderId: payment.gatewayOrderId,
          actualAmount,
          expectedAmount,
          actualCurrency,
          expectedCurrency,
        },
        "PayPal reconciliation fail-closed: amount or currency mismatch"
      );
      return { reconciled: false, reason: "AMOUNT_OR_CURRENCY_MISMATCH" };
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

    const captureId = capture.id || payment.gatewayOrderId;
    const updateData = {
      status: "captured",
      gatewayPaymentId: captureId,
      method: "paypal",
      capturedAt: capture.create_time ? new Date(capture.create_time) : new Date(),
      failureReason: null,
    };

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

    await orderService.markOrderPaymentCaptured(order._id);

    return {
      reconciled: true,
      paymentId: updatedPayment._id,
      orderId: order._id,
      gatewayPaymentId: captureId,
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
        gateway: options.gateway,
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

  /**
   * Distributed Transaction Reconciliation:
   * Scans and reconciles pending refunds, gateway timeouts, and interrupted order cancellations.
   * Discovers and repairs state drift between Razorpay gateway and local MongoDB state.
   */
  async reconcilePendingRefundsAndCancellations(options = {}) {
    const Refund = require("../models/Refund");
    const financialLedgerService = require("./financial-ledger.service");
    const shipmentRepository = require("../repositories/shipment.repository");
    const inventoryRepository = require("../repositories/inventory.repository");
    const inventoryService = require("./inventory.service");

    const batchSize = options.batchSize || 25;
    const query = Refund.find({
      status: { $in: ["pending", "pending_reconciliation"] },
    });
    const pendingRefunds = (typeof query?.limit === "function" ? await query.limit(batchSize) : await query) || [];

    let scanned = pendingRefunds.length;
    let autoRecovered = 0;
    let gatewayConfirmedFailed = 0;
    let pendingReview = 0;

    for (const refund of pendingRefunds) {
      try {
        const payment = await paymentRepository.findById(refund.paymentId);
        const order = await orderRepository.findById(refund.orderId);

        if (!payment || !order) {
          pendingReview += 1;
          continue;
        }

        let isGatewayProcessed = false;
        let isGatewayFailed = false;

        if (payment.gateway === "razorpay" || !payment.gateway) {
          if (refund.gatewayRefundId) {
            try {
              const gwRefund = await razorpayProvider.fetchRefund(refund.gatewayRefundId);
              if (gwRefund?.status === "processed") isGatewayProcessed = true;
              else if (gwRefund?.status === "failed") isGatewayFailed = true;
            } catch (fetchErr) {
              logger.warn({ refundId: refund._id, error: fetchErr.message }, "Reconciliation: failed to fetch Razorpay refund");
            }
          }
        }

        if (isGatewayProcessed) {
          // 1. Mark Refund document as processed
          await Refund.findByIdAndUpdate(refund._id, {
            status: "processed",
            processedAt: new Date(),
            failureReason: null,
          });

          // 2. Synchronize Payment document
          const totalAmount = Number(payment.amount.toString());
          const currentRefunded = Number(payment.refundedAmount?.toString() || "0");
          const addAmount = Number(refund.amount.toString());
          const newRefunded = Math.min(totalAmount, Number((currentRefunded + addAmount).toFixed(2)));
          const isFullyRefunded = newRefunded >= totalAmount;

          await paymentRepository.updateById(payment._id, {
            refundedAmount: newRefunded.toFixed(2),
            refundReservedAmount: "0.00",
            status: isFullyRefunded ? "refunded" : "partially_refunded",
          });

          // 3. Finalize order cancellation if stuck in pending
          if (order.cancellationStatus === "pending" || order.status !== "cancelled") {
            const shipments = await shipmentRepository.findByOrderId(order._id);
            for (const s of shipments || []) {
              if (["created", "ready_to_ship", "cancellation_pending"].includes(s.status)) {
                await shipmentRepository.updateById(s._id, {
                  status: "cancelled",
                  cancelledAt: new Date(),
                  inventoryStatus: "released",
                  inventoryReleasedAt: new Date(),
                  dispatchBlocked: true,
                });
              }
            }

            // Release inventory for items
            for (const it of order.items || []) {
              if (it.inventoryStatus === "reserved" && it.warehouseId) {
                const inv = await inventoryRepository.findByVariantAndWarehouse(it.productVariantId, it.warehouseId);
                if (inv) {
                  await inventoryService.adjustStock(inv._id, it.quantity, {
                    reason: "cancellation_release",
                    referenceType: "order",
                    referenceId: order.orderNumber,
                    idempotencyKey: `recon-cancel-release-${order._id}-${it.productVariantId}-${it.warehouseId}`,
                    notes: "Inventory released via distributed transaction reconciliation",
                  });
                }
                it.inventoryStatus = "released";
              }
              it.fulfillmentStatus = "cancelled";
            }

            await orderRepository.updateById(order._id, {
              status: "cancelled",
              paymentStatus: isFullyRefunded ? "refunded" : "partially_refunded",
              cancellationStatus: "completed",
              items: order.items,
            });
          }

          // 4. Post double-entry ledger reversal if missing
          try {
            await financialLedgerService.postRefundReversalJournal(refund, { orderDoc: order });
          } catch (ledgerErr) {
            logger.warn({ refundId: refund._id, error: ledgerErr.message }, "Non-fatal ledger post during reconciliation");
          }

          autoRecovered += 1;
        } else if (isGatewayFailed) {
          await Refund.findByIdAndUpdate(refund._id, {
            status: "failed",
            failureReason: "Gateway confirmed refund failed",
          });
          await paymentRepository.updateById(payment._id, {
            refundReservedAmount: "0.00",
          });
          gatewayConfirmedFailed += 1;
        } else {
          pendingReview += 1;
        }
      } catch (err) {
        pendingReview += 1;
        logger.error({ refundId: refund._id, error: err.message }, "Error during refund reconciliation");
      }
    }

    return {
      scanned,
      autoRecovered,
      gatewayConfirmedFailed,
      pendingReview,
    };
  }
}

module.exports = new PaymentReconciliationService();
