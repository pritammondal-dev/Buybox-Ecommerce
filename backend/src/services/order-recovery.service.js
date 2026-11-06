const mongoose = require("mongoose");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const Refund = require("../models/Refund");
const NotificationOutbox = require("../models/NotificationOutbox");
const AuditLog = require("../models/AuditLog");

const inventoryRepository = require("../repositories/inventory.repository");
const paymentRepository = require("../repositories/payment.repository");
const refundRepository = require("../repositories/refund.repository");
const orderRepository = require("../repositories/order.repository");

const paymentService = require("./payment.service");
const razorpayProvider = require("../integrations/payments/razorpay.provider");
const logger = require("../config/logger");
const AppError = require("../errors/AppError");

class OrderRecoveryService {
  /**
   * Reconcile an incomplete cancellation for an order.
   *
   * Fixes:
   * 1. Items cancelled but whose inventory reservation was not released.
   * 2. Cancelled orders with captured payments whose refund was not executed or completed.
   * 3. Desynchronized aggregate order statuses (fulfillmentStatus, paymentStatus, status).
   */
  async recoverIncompleteCancellation(orderId, actor = {}) {
    if (!orderId) {
      throw new AppError("Order ID is required", 400, "MISSING_ORDER_ID");
    }

    const order = await Order.findById(orderId);
    if (!order) {
      throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
    }

    const report = {
      orderId: order._id,
      orderNumber: order.orderNumber,
      inventoryReleasesCompleted: 0,
      refundReconciled: false,
      statusSynchronized: false,
      actionsTaken: [],
    };

    // 1. Reconcile Incomplete Inventory Releases
    for (const item of order.items || []) {
      if (item.fulfillmentStatus === "cancelled" && item.inventoryStatus === "reserved" && item.warehouseId) {
        try {
          const inv = await inventoryRepository.findByVariantAndWarehouse(
            item.productVariantId,
            item.warehouseId
          );

          if (inv) {
            const currentReserved = Number(inv.reserved) || 0;
            const releaseQty = Math.min(item.quantity, currentReserved);
            if (releaseQty > 0) {
              await inventoryRepository.releaseReservedStock(inv._id, releaseQty);
              report.actionsTaken.push(`Released ${releaseQty} units of reserved stock for SKU ${item.sku}`);
            }
          }

          item.inventoryStatus = "released";
          item.inventoryReleasedAt = item.inventoryReleasedAt || new Date();
          report.inventoryReleasesCompleted += 1;
        } catch (invErr) {
          logger.warn("Inventory release recovery glitch", {
            error: invErr.message,
            orderId: order._id,
            sku: item.sku,
          });
        }
      }
    }

    // 2. Reconcile Missing or Incomplete Refund
    const payment = await paymentRepository.findLatestByOrderId(order._id);
    const activeItems = (order.items || []).filter((it) => it.fulfillmentStatus !== "cancelled");
    const isOrderEntirelyCancelled = activeItems.length === 0;

    if (payment && ["captured", "partially_refunded"].includes(payment.status)) {
      const totalPaid = Number(payment.amount?.toString() || "0");
      const alreadyRefunded = Number(payment.refundedAmount?.toString() || "0");
      const remainingRefundable = totalPaid - alreadyRefunded - Number(payment.refundReservedAmount?.toString() || "0");

      if (isOrderEntirelyCancelled && remainingRefundable > 0) {
        try {
          const recoveryKey = `order_cancel_recovery_${order._id.toString()}`;
          await paymentService.refundPaymentForOrder(
            order._id,
            order.customerId,
            remainingRefundable,
            recoveryKey
          );
          report.refundReconciled = true;
          report.actionsTaken.push(`Initiated remaining refund of ₹${remainingRefundable.toFixed(2)} with recovery idempotency key`);
        } catch (refErr) {
          logger.warn("Refund reconciliation recovery glitch", {
            error: refErr.message,
            orderId: order._id,
          });
          report.actionsTaken.push(`Refund attempt encountered: ${refErr.message}`);
        }
      }
    }

    // 3. Synchronize Aggregate Order Statuses
    const previousStatus = order.status;
    const previousFulfillment = order.fulfillmentStatus;
    const previousPayment = order.paymentStatus;

    if (isOrderEntirelyCancelled) {
      order.status = "cancelled";
      order.fulfillmentStatus = "cancelled";
    }

    // Recheck fresh payment record for updated payment status
    const freshPayment = await paymentRepository.findLatestByOrderId(order._id);
    if (freshPayment) {
      if (freshPayment.status === "refunded") {
        order.paymentStatus = "refunded";
      } else if (Number(freshPayment.refundedAmount?.toString() || "0") > 0) {
        order.paymentStatus = "partially_refunded";
      }
    }

    if (
      order.status !== previousStatus ||
      order.fulfillmentStatus !== previousFulfillment ||
      order.paymentStatus !== previousPayment
    ) {
      report.statusSynchronized = true;
      report.actionsTaken.push(
        `Synchronized order state: status (${previousStatus} -> ${order.status}), fulfillment (${previousFulfillment} -> ${order.fulfillmentStatus}), payment (${previousPayment} -> ${order.paymentStatus})`
      );
    }

    await order.save();

    // 4. Record Consequential Recovery in AuditLog
    try {
      await AuditLog.create({
        action: "ORDER_OPERATIONAL_RECOVERY",
        resourceType: "orders",
        resourceId: order._id.toString(),
        actorId: actor.userId ? actor.userId.toString() : "system",
        actorType: actor.role || "staff",
        metadata: {
          orderNumber: order.orderNumber,
          actionsTaken: report.actionsTaken,
          report,
        },
      });
    } catch {
      // Non-blocking audit failure
    }

    return report;
  }

  /**
   * Reconcile a pending or stuck refund with the authoritative payment gateway.
   */
  async reconcilePendingRefund(refundId, actor = {}) {
    if (!refundId) {
      throw new AppError("Refund ID is required", 400, "MISSING_REFUND_ID");
    }

    const refund = await Refund.findById(refundId);
    if (!refund) {
      throw new AppError("Refund record not found", 404, "REFUND_NOT_FOUND");
    }

    if (refund.status === "processed") {
      return {
        reconciled: true,
        alreadyProcessed: true,
        refundId: refund._id,
        status: refund.status,
      };
    }

    const payment = await paymentRepository.findById(refund.paymentId);
    if (!payment) {
      throw new AppError("Associated payment record not found", 404, "PAYMENT_NOT_FOUND");
    }

    let gatewayRefund = null;

    if (refund.gatewayRefundId && refund.gateway === "razorpay") {
      try {
        gatewayRefund = await razorpayProvider.fetchRefund(refund.gatewayRefundId);
      } catch (err) {
        logger.warn("Gateway fetch refund failed during reconciliation", {
          error: err.message,
          gatewayRefundId: refund.gatewayRefundId,
        });
      }
    }

    if (gatewayRefund && gatewayRefund.status === "processed") {
      refund.status = "processed";
      refund.processedAt = new Date();
      refund.failureReason = null;
      await refund.save();

      // Synchronize Payment
      const currentRef = Number(payment.refundedAmount?.toString() || "0");
      const thisRef = Number(refund.amount?.toString() || "0");
      const newRef = Number((currentRef + thisRef).toFixed(2));
      const totalAmount = Number(payment.amount?.toString() || "0");
      const isFullyRefunded = newRef >= totalAmount;

      await paymentRepository.updateById(payment._id, {
        refundedAmount: newRef.toFixed(2),
        refundReservedAmount: "0.00",
        status: isFullyRefunded ? "refunded" : "partially_refunded",
        metadata: {
          ...payment.metadata,
          lastRefundId: refund.gatewayRefundId,
          lastRefundStatus: "processed",
        },
      });

      // Synchronize Order
      const order = await Order.findById(refund.orderId);
      if (order) {
        order.paymentStatus = isFullyRefunded ? "refunded" : "partially_refunded";
        await order.save();
      }

      // Record Audit
      try {
        await AuditLog.create({
          action: "REFUND_OPERATIONAL_RECONCILIATION",
          resourceType: "refunds",
          resourceId: refund._id.toString(),
          actorId: actor.userId ? actor.userId.toString() : "system",
          actorType: actor.role || "staff",
          metadata: {
            orderId: refund.orderId,
            gatewayRefundId: refund.gatewayRefundId,
            amount: refund.amount,
            status: "processed",
          },
        });
      } catch {
        // Non-blocking
      }

      return {
        reconciled: true,
        refundId: refund._id,
        status: "processed",
        message: "Refund confirmed processed by gateway and local payment state synchronized",
      };
    }

    if (gatewayRefund && gatewayRefund.status === "failed") {
      refund.status = "failed";
      refund.failureReason = gatewayRefund.error_description || "Gateway marked refund failed";
      await refund.save();

      // Release reservation on Payment
      await paymentRepository.releaseRefundReservation(
        payment._id,
        Number(refund.amount).toFixed(2)
      );

      return {
        reconciled: true,
        refundId: refund._id,
        status: "failed",
        message: "Gateway confirmed refund failed; local reservation released",
      };
    }

    return {
      reconciled: false,
      refundId: refund._id,
      status: refund.status,
      message: "Gateway refund is still pending or gateway reference is unavailable",
    };
  }

  /**
   * Reconcile stuck or pending notifications in the outbox.
   */
  async reconcilePendingOutbox(options = {}) {
    const maxAttempts = options.maxAttempts || 5;
    const thresholdMinutes = options.thresholdMinutes || 5;
    const cutoffDate = new Date(Date.now() - thresholdMinutes * 60 * 1000);

    const stuckNotifications = await NotificationOutbox.find({
      status: { $in: ["pending", "processing"] },
      attempts: { $lt: maxAttempts },
      createdAt: { $lte: cutoffDate },
    }).limit(options.limit || 50);

    let processedCount = 0;
    let failedCount = 0;

    const { processNextNotification } = require("./notification-outbox.worker");

    for (const notif of stuckNotifications) {
      try {
        notif.status = "pending";
        notif.availableAt = new Date();
        await notif.save();

        const result = await processNextNotification();
        if (result && result.status === "sent") {
          processedCount += 1;
        } else {
          failedCount += 1;
        }
      } catch {
        failedCount += 1;
      }
    }

    return {
      totalFound: stuckNotifications.length,
      processedCount,
      failedCount,
    };
  }
}

module.exports = new OrderRecoveryService();
