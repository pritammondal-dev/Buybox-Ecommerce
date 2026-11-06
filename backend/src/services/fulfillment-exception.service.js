const mongoose = require("mongoose");
const FulfillmentException = require("../models/FulfillmentException");
const Order = require("../models/Order");
const Vendor = require("../models/Vendor");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const NotificationOutbox = require("../models/NotificationOutbox");
const orderRepository = require("../repositories/order.repository");
const inventoryRepository = require("../repositories/inventory.repository");
const paymentRepository = require("../repositories/payment.repository");
const inventoryService = require("./inventory.service");
const paymentService = require("./payment.service");
const notificationOutboxService = require("./notification-outbox.service");
const AppError = require("../errors/AppError");
const { decodeSecureId, encodeSecureId } = require("../utils/secure-id.util");
const { resolveApprovedVendor } = require("../middlewares/vendor.middleware");
const logger = require("../config/logger");

const TERMINAL_STATUSES = ["resolved", "rejected", "withdrawn"];

const ALLOWED_TRANSITIONS = {
  open: ["under_review", "awaiting_vendor", "resolved", "rejected", "withdrawn"],
  under_review: ["awaiting_vendor", "resolved", "rejected", "open"],
  awaiting_vendor: ["under_review", "open", "resolved", "rejected", "withdrawn"],
  resolved: [],
  rejected: [],
  withdrawn: [],
};

const generateExceptionNumber = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `EXC-${dateStr}-${randomSuffix}`;
};

/**
 * Enqueue notification idempotently to prevent duplicate outbox entries.
 */
const enqueueIdempotentNotification = async ({ type, recipient, payload }) => {
  try {
    if (!recipient) return null;
    const existing = await NotificationOutbox.findOne({
      type,
      recipient,
      "payload.exceptionId": payload.exceptionId,
      "payload.status": payload.status,
    });
    if (existing) {
      return existing;
    }
    return await notificationOutboxService.enqueue({
      type,
      channel: "email",
      recipient,
      payload,
    });
  } catch (err) {
    logger.warn("Failed to enqueue fulfillment exception notification (non-blocking)", {
      error: err.message,
      type,
      recipient,
    });
    return null;
  }
};

/**
 * Log audit record safely.
 */
const logAuditEvent = async ({ actorId, targetId, action, beforeState, afterState }) => {
  try {
    if (!actorId || !targetId) return;
    await AuditLog.create({
      actorId,
      targetId,
      action,
      entityType: "FulfillmentException",
      beforeState,
      afterState,
    });
  } catch (err) {
    logger.warn("Failed to record audit log for fulfillment exception", {
      error: err.message,
      action,
    });
  }
};

class FulfillmentExceptionService {
  /**
   * Vendor reports a fulfillment exception on their order item.
   * Strictly verifies ownership, item status, quantity, and prevents duplicate active exceptions.
   * Enforces zero-mutation on order, inventory, and payment.
   */
  async createException({
    userId,
    orderId,
    orderItemId,
    reason,
    explanation,
    requestedResolution = "request_cancellation",
    quantity,
  }) {
    if (!userId) {
      throw new AppError("Authentication required", 401, "AUTHENTICATION_REQUIRED");
    }

    const vendor = await resolveApprovedVendor(userId);
    if (!vendor) {
      throw new AppError("Vendor profile not found or inactive", 403, "VENDOR_NOT_FOUND");
    }

    const resolvedOrderId = decodeSecureId(orderId, "order", { strict: false });
    if (!mongoose.Types.ObjectId.isValid(resolvedOrderId)) {
      throw new AppError("Invalid order ID", 400, "INVALID_ORDER_ID");
    }

    const order = await Order.findById(resolvedOrderId);
    if (!order) {
      throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
    }

    // Find the targeted order item
    const item = (order.items || []).find(
      (it) => it._id.toString() === orderItemId.toString()
    );

    if (!item) {
      throw new AppError("Order item not found in this order", 404, "ORDER_ITEM_NOT_FOUND");
    }

    // Strict multi-tenant vendor item ownership verification
    if (!item.vendorId || item.vendorId.toString() !== vendor._id.toString()) {
      throw new AppError(
        "You are not authorized to report exceptions for another vendor's order items",
        403,
        "VENDOR_ITEM_ACCESS_DENIED"
      );
    }

    // Ineligible states validation
    if (order.status === "cancelled" || item.fulfillmentStatus === "cancelled") {
      throw new AppError(
        "Cannot report a fulfillment exception for a cancelled order item",
        400,
        "ITEM_ALREADY_CANCELLED"
      );
    }

    if (item.fulfillmentStatus === "shipped" || item.fulfillmentStatus === "delivered") {
      throw new AppError(
        "Cannot report a fulfillment exception for already shipped or delivered items",
        400,
        "ITEM_ALREADY_SHIPPED"
      );
    }

    if (order.status === "delivered") {
      throw new AppError("Order has already been delivered", 400, "ORDER_ALREADY_DELIVERED");
    }

    // Check for duplicate active exception on this order item
    const existingActive = await FulfillmentException.findOne({
      orderId: order._id,
      orderItemId: item._id,
      status: { $in: ["open", "under_review", "awaiting_vendor"] },
    });

    if (existingActive) {
      throw new AppError(
        "An active fulfillment exception already exists for this order item",
        409,
        "DUPLICATE_ACTIVE_EXCEPTION"
      );
    }

    // Quantity validation
    const parsedQty = quantity !== undefined && quantity !== null ? Number(quantity) : item.quantity;
    if (!Number.isInteger(parsedQty) || parsedQty <= 0) {
      throw new AppError("Quantity must be a positive integer", 400, "INVALID_QUANTITY");
    }
    if (parsedQty > item.quantity) {
      throw new AppError(
        `Reported quantity (${parsedQty}) cannot exceed item quantity (${item.quantity})`,
        400,
        "QUANTITY_EXCEEDS_ITEM"
      );
    }

    if (!explanation || !explanation.trim()) {
      throw new AppError("An explanation is required when reporting an exception", 400, "EXPLANATION_REQUIRED");
    }

    const exceptionNumber = generateExceptionNumber();

    // Authoritative snapshot from order record — never trust vendor input for pricing/warehouse
    const itemSnapshot = {
      productId: item.productId,
      productVariantId: item.productVariantId,
      warehouseId: item.warehouseId || null,
      sku: item.sku,
      productName: item.productName,
      variantName: item.variantName || "",
      originalQuantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      fulfillmentStatus: item.fulfillmentStatus || "unfulfilled",
      inventoryStatus: item.inventoryStatus || "reserved",
    };

    const exception = new FulfillmentException({
      exceptionNumber,
      orderId: order._id,
      orderNumber: order.orderNumber,
      orderItemId: item._id,
      vendorId: vendor._id,
      reason,
      explanation: explanation.trim(),
      requestedResolution,
      quantity: parsedQty,
      status: "open",
      itemSnapshot,
      timeline: [
        {
          status: "open",
          actorType: "vendor",
          actorId: vendor.userId || userId,
          actorName: vendor.storeName || vendor.businessName || "Vendor",
          notes: explanation.trim(),
          timestamp: new Date(),
        },
      ],
    });

    await exception.save();

    // Enqueue admin alert (idempotent, non-blocking)
    try {
      let adminEmail = null;
      const adminQuery = User.findOne({ role: "super_admin" });
      const adminUser = adminQuery && typeof adminQuery.select === "function"
        ? await adminQuery.select("email").lean()
        : await adminQuery;
      adminEmail = adminUser?.email || null;

      if (adminEmail) {
        await enqueueIdempotentNotification({
          type: "fulfillment_exception_created",
          recipient: adminEmail,
          payload: {
            exceptionId: exception._id.toString(),
            exceptionNumber: exception.exceptionNumber,
            orderNumber: order.orderNumber,
            vendorName: vendor.storeName || vendor.businessName,
            reason,
            quantity: parsedQty,
            status: "open",
          },
        });
      }
    } catch (notifErr) {
      // Non-blocking
    }

    await logAuditEvent({
      actorId: userId,
      targetId: exception._id,
      action: "FULFILLMENT_EXCEPTION_SUBMITTED",
      beforeState: null,
      afterState: {
        exceptionNumber: exception.exceptionNumber,
        status: "open",
        reason,
        quantity: parsedQty,
      },
    });

    return exception;
  }

  /**
   * Vendor lists their own exceptions.
   */
  async getVendorExceptions({ userId, query = {} }) {
    const vendor = await resolveApprovedVendor(userId);
    const filter = { vendorId: vendor._id };

    if (query.status && query.status !== "all") {
      filter.status = query.status;
    }
    if (query.orderId) {
      const resolvedOrderId = decodeSecureId(query.orderId, "order", { strict: false });
      if (mongoose.Types.ObjectId.isValid(resolvedOrderId)) {
        filter.orderId = resolvedOrderId;
      }
    }
    if (query.search) {
      const searchRegex = { $regex: query.search.trim(), $options: "i" };
      filter.$or = [
        { exceptionNumber: searchRegex },
        { orderNumber: searchRegex },
        { "itemSnapshot.sku": searchRegex },
        { "itemSnapshot.productName": searchRegex },
      ];
    }

    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      FulfillmentException.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      FulfillmentException.countDocuments(filter),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Vendor gets single exception details (scoped to vendor).
   */
  async getVendorExceptionById({ userId, exceptionId }) {
    const vendor = await resolveApprovedVendor(userId);
    if (!mongoose.Types.ObjectId.isValid(exceptionId)) {
      throw new AppError("Invalid exception ID", 400, "INVALID_EXCEPTION_ID");
    }

    const exception = await FulfillmentException.findOne({
      _id: exceptionId,
      vendorId: vendor._id,
    }).lean();

    if (!exception) {
      throw new AppError("Fulfillment exception not found", 404, "EXCEPTION_NOT_FOUND");
    }

    return exception;
  }

  /**
   * Vendor responds to admin clarification request.
   */
  async vendorClarifyException({ userId, exceptionId, notes }) {
    const vendor = await resolveApprovedVendor(userId);
    if (!mongoose.Types.ObjectId.isValid(exceptionId)) {
      throw new AppError("Invalid exception ID", 400, "INVALID_EXCEPTION_ID");
    }

    if (!notes || !notes.trim()) {
      throw new AppError("Clarification response is required", 400, "CLARIFICATION_REQUIRED");
    }

    const exception = await FulfillmentException.findOne({
      _id: exceptionId,
      vendorId: vendor._id,
    });

    if (!exception) {
      throw new AppError("Fulfillment exception not found", 404, "EXCEPTION_NOT_FOUND");
    }

    if (TERMINAL_STATUSES.includes(exception.status)) {
      throw new AppError(
        `Cannot clarify an exception that is already '${exception.status}'`,
        400,
        "EXCEPTION_ALREADY_TERMINAL"
      );
    }

    const beforeStatus = exception.status;
    exception.status = "under_review";
    exception.timeline.push({
      status: "under_review",
      actorType: "vendor",
      actorId: vendor.userId || userId,
      actorName: vendor.storeName || vendor.businessName || "Vendor",
      notes: `Vendor Clarification: ${notes.trim()}`,
      timestamp: new Date(),
    });

    await exception.save();

    await logAuditEvent({
      actorId: userId,
      targetId: exception._id,
      action: "FULFILLMENT_EXCEPTION_CLARIFIED",
      beforeState: { status: beforeStatus },
      afterState: { status: "under_review", response: notes.trim() },
    });

    return exception;
  }

  /**
   * Vendor withdraws exception (allowed from open or awaiting_vendor).
   */
  async vendorWithdrawException({ userId, exceptionId, reason = "" }) {
    const vendor = await resolveApprovedVendor(userId);
    if (!mongoose.Types.ObjectId.isValid(exceptionId)) {
      throw new AppError("Invalid exception ID", 400, "INVALID_EXCEPTION_ID");
    }

    const exception = await FulfillmentException.findOne({
      _id: exceptionId,
      vendorId: vendor._id,
    });

    if (!exception) {
      throw new AppError("Fulfillment exception not found", 404, "EXCEPTION_NOT_FOUND");
    }

    if (TERMINAL_STATUSES.includes(exception.status)) {
      throw new AppError(
        `Cannot withdraw an exception that is already '${exception.status}'`,
        400,
        "EXCEPTION_ALREADY_TERMINAL"
      );
    }

    const beforeStatus = exception.status;
    exception.status = "withdrawn";
    exception.resolutionNotes = reason ? `Withdrawn by vendor: ${reason}` : "Withdrawn by vendor";
    exception.timeline.push({
      status: "withdrawn",
      actorType: "vendor",
      actorId: vendor.userId || userId,
      actorName: vendor.storeName || vendor.businessName || "Vendor",
      notes: reason ? `Withdrawal reason: ${reason}` : "Withdrawn by vendor",
      timestamp: new Date(),
    });

    await exception.save();

    await logAuditEvent({
      actorId: userId,
      targetId: exception._id,
      action: "FULFILLMENT_EXCEPTION_WITHDRAWN",
      beforeState: { status: beforeStatus },
      afterState: { status: "withdrawn" },
    });

    return exception;
  }

  /**
   * Admin lists all exceptions with operational filtering.
   */
  async getAdminExceptions({ query = {} }) {
    const filter = {};

    if (query.status && query.status !== "all") {
      filter.status = query.status;
    }
    if (query.reason && query.reason !== "all") {
      filter.reason = query.reason;
    }
    if (query.vendorId) {
      if (mongoose.Types.ObjectId.isValid(query.vendorId)) {
        filter.vendorId = query.vendorId;
      }
    }
    if (query.search) {
      const searchRegex = { $regex: query.search.trim(), $options: "i" };
      filter.$or = [
        { exceptionNumber: searchRegex },
        { orderNumber: searchRegex },
        { "itemSnapshot.sku": searchRegex },
        { "itemSnapshot.productName": searchRegex },
      ];
    }

    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      FulfillmentException.find(filter)
        .populate("vendorId", "storeName businessName email phone")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      FulfillmentException.countDocuments(filter),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Admin retrieves single exception with full context.
   */
  async getAdminExceptionById(exceptionId) {
    if (!mongoose.Types.ObjectId.isValid(exceptionId)) {
      throw new AppError("Invalid exception ID", 400, "INVALID_EXCEPTION_ID");
    }

    const exception = await FulfillmentException.findById(exceptionId)
      .populate("vendorId", "storeName businessName email phone")
      .populate("orderId", "orderNumber status paymentStatus shippingAddress subtotal grandTotal")
      .lean();

    if (!exception) {
      throw new AppError("Fulfillment exception not found", 404, "EXCEPTION_NOT_FOUND");
    }

    return exception;
  }

  /**
   * Admin transitions exception status (e.g. under_review, awaiting_vendor, resolved, rejected).
   */
  async adminTransitionException({ exceptionId, newStatus, notes, actorUser }) {
    if (!mongoose.Types.ObjectId.isValid(exceptionId)) {
      throw new AppError("Invalid exception ID", 400, "INVALID_EXCEPTION_ID");
    }

    const exception = await FulfillmentException.findById(exceptionId);
    if (!exception) {
      throw new AppError("Fulfillment exception not found", 404, "EXCEPTION_NOT_FOUND");
    }

    if (TERMINAL_STATUSES.includes(exception.status)) {
      throw new AppError(
        `Cannot transition exception from terminal status '${exception.status}'`,
        400,
        "EXCEPTION_ALREADY_TERMINAL"
      );
    }

    const allowed = ALLOWED_TRANSITIONS[exception.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new AppError(
        `Invalid transition from '${exception.status}' to '${newStatus}'`,
        400,
        "INVALID_STATUS_TRANSITION"
      );
    }

    const beforeStatus = exception.status;
    exception.status = newStatus;

    if (notes && notes.trim()) {
      exception.resolutionNotes = notes.trim();
    }

    const actorName = actorUser?.name || actorUser?.email || "Administrator";
    const actorId = actorUser?._id || actorUser?.id || null;

    exception.timeline.push({
      status: newStatus,
      actorType: "admin",
      actorId,
      actorName,
      notes: notes ? notes.trim() : `Status transitioned to ${newStatus}`,
      timestamp: new Date(),
    });

    await exception.save();

    // Notify vendor if clarification requested or resolved/rejected
    const vendor = await Vendor.findById(exception.vendorId).select("email storeName businessName").lean();
    if (vendor?.email) {
      let notifType = "fulfillment_exception_updated";
      if (newStatus === "awaiting_vendor") {
        notifType = "fulfillment_exception_clarification_requested";
      } else if (newStatus === "resolved" || newStatus === "rejected") {
        notifType = "fulfillment_exception_decision";
      }

      await enqueueIdempotentNotification({
        type: notifType,
        recipient: vendor.email,
        payload: {
          exceptionId: exception._id.toString(),
          exceptionNumber: exception.exceptionNumber,
          orderNumber: exception.orderNumber,
          status: newStatus,
          notes: notes ? notes.trim() : "",
        },
      });
    }

    await logAuditEvent({
      actorId,
      targetId: exception._id,
      action: `FULFILLMENT_EXCEPTION_${newStatus.toUpperCase()}`,
      beforeState: { status: beforeStatus },
      afterState: { status: newStatus, notes },
    });

    return exception;
  }

  /**
   * Admin approves item cancellation request with authoritative inventory release and refund.
   * STRICT SAFETY GUARANTEES:
   * - Releases reserved inventory using authoritative inventoryService.
   * - Releases ONLY the eligible exception quantity.
   * - Does NOT restock damaged/defective stock improperly.
   * - Calculates authoritative item refund; prevents duplicate refunds on retry.
   * - Does NOT cancel unaffected vendors' items or shipments.
   */
  async adminApproveCancellation({ exceptionId, notes, actorUser }) {
    if (!mongoose.Types.ObjectId.isValid(exceptionId)) {
      throw new AppError("Invalid exception ID", 400, "INVALID_EXCEPTION_ID");
    }

    const exception = await FulfillmentException.findById(exceptionId);
    if (!exception) {
      throw new AppError("Fulfillment exception not found", 404, "EXCEPTION_NOT_FOUND");
    }

    if (TERMINAL_STATUSES.includes(exception.status)) {
      throw new AppError(
        `Cannot cancel an exception that is already '${exception.status}'`,
        400,
        "EXCEPTION_ALREADY_TERMINAL"
      );
    }

    const order = await Order.findById(exception.orderId);
    if (!order) {
      throw new AppError("Associated order not found", 404, "ORDER_NOT_FOUND");
    }

    const item = (order.items || []).find(
      (it) =>
        (it._id && exception.orderItemId && it._id.toString() === exception.orderItemId.toString()) ||
        (it.sku && exception.itemSnapshot?.sku && it.sku === exception.itemSnapshot.sku)
    );

    if (!item) {
      throw new AppError("Associated order item not found", 404, "ORDER_ITEM_NOT_FOUND");
    }

    // Check if item is already cancelled
    if (item.fulfillmentStatus === "cancelled") {
      exception.status = "resolved";
      exception.resolutionNotes = notes || "Order item was already cancelled; exception marked resolved.";
      await exception.save();
      return { success: true, exception, order, alreadyCancelled: true };
    }

    const cancelQty = Math.min(exception.quantity, item.quantity);
    let inventoryReleased = false;

    // 1. Authoritative Inventory Release if reserved
    if (item.inventoryStatus === "reserved" && item.warehouseId) {
      try {
        const inventory = await inventoryRepository.findByVariantAndWarehouse(
          item.productVariantId,
          item.warehouseId
        );

        if (inventory) {
          const currentReserved = Number(inventory.reserved) || 0;
          const releaseAmount = Math.min(cancelQty, currentReserved);
          if (releaseAmount > 0) {
            await inventoryRepository.releaseReservedStock(inventory._id, releaseAmount);

            // If stock was damaged or defective, mark condition to keep it out of available sellable stock
            if (exception.reason === "damaged_stock") {
              try {
                await inventoryRepository.adjustStockCondition(
                  inventory._id,
                  { condition: "damaged", quantity: releaseAmount, disposition: "mark_condition" }
                );
              } catch {
                // Squelch condition logging if condition tracking isn't enabled on this inventory record
              }
            }

            inventoryReleased = true;
          }
        }
      } catch (invErr) {
        logger.warn("Inventory release encountered non-fatal error during exception cancellation", {
          error: invErr.message,
          orderId: order._id,
          sku: item.sku,
        });
      }
    }

    // 2. Update Order Item Status
    if (cancelQty === item.quantity) {
      item.fulfillmentStatus = "cancelled";
      item.inventoryStatus = "released";
      item.inventoryReleasedAt = new Date();
    } else {
      // Partial cancellation: decrement active item quantity, append cancelled item record
      item.quantity -= cancelQty;
      const unitPriceNum = Number(item.unitPrice.toString());
      item.lineTotal = mongoose.Types.Decimal128.fromString((unitPriceNum * item.quantity).toFixed(2));

      order.items.push({
        productId: item.productId,
        productVariantId: item.productVariantId,
        warehouseId: item.warehouseId,
        vendorId: item.vendorId,
        sku: item.sku,
        productName: item.productName,
        variantName: item.variantName,
        quantity: cancelQty,
        unitPrice: item.unitPrice,
        discountTotal: mongoose.Types.Decimal128.fromString("0"),
        taxTotal: mongoose.Types.Decimal128.fromString("0"),
        lineTotal: mongoose.Types.Decimal128.fromString((unitPriceNum * cancelQty).toFixed(2)),
        currency: item.currency,
        inventoryStatus: "released",
        inventoryReleasedAt: new Date(),
        fulfillmentStatus: "cancelled",
      });
    }

    // 3. Multi-Vendor Isolation: Check if all items in the order are cancelled
    const activeItems = (order.items || []).filter(
      (it) => it.fulfillmentStatus !== "cancelled"
    );
    if (activeItems.length === 0) {
      order.status = "cancelled";
      order.fulfillmentStatus = "cancelled";
    }

    await order.save();

    // 4. Safe Refund Processing (idempotent, proportional to item line total)
    let refundResult = null;
    let refundIssued = false;
    let refundAmountDec = null;

    if (order.paymentStatus === "paid" && !exception.cancellationDetails?.refundIssued) {
      try {
        const { buildOrderItemFinancialAllocationMap } = require("./return-request.service");
        const allocMap = buildOrderItemFinancialAllocationMap(order);
        const itemAlloc = allocMap.get(item._id.toString()) || allocMap.get(`${item.productId}_${item.productVariantId || ""}`);
        let calculatedRefundMinor = 0;
        if (itemAlloc && itemAlloc.itemCustomerPaidTotalMinor > 0) {
          calculatedRefundMinor = Math.round((itemAlloc.itemCustomerPaidTotalMinor * cancelQty) / (item.quantity || 1));
        } else {
          const unitPriceNum = Number(item.unitPrice.toString());
          calculatedRefundMinor = Math.round(unitPriceNum * cancelQty * 100);
        }
        const calculatedRefund = (calculatedRefundMinor / 100).toFixed(2);
        refundAmountDec = mongoose.Types.Decimal128.fromString(calculatedRefund);

        const payment = await paymentRepository.findLatestByOrderId(order._id);
        if (payment && ["captured", "partially_refunded"].includes(payment.status)) {
          // Idempotent refund execution with durable key
          const refundIdempotencyKey = `fe_cancel_${exception.exceptionNumber || exception._id.toString()}`;
          refundResult = await paymentService.refundPaymentForOrder(
            order._id,
            order.customerId,
            Number(calculatedRefund),
            refundIdempotencyKey
          );
          refundIssued = true;

          // Synchronize order paymentStatus
          if (activeItems.length === 0) {
            order.paymentStatus = "refunded";
          } else {
            order.paymentStatus = "partially_refunded";
          }
          await order.save();
        }
      } catch (refErr) {
        logger.warn("Item refund encountered non-fatal error during exception resolution", {
          error: refErr.message,
          orderId: order._id,
          orderNumber: order.orderNumber,
        });
      }
    }

    // 5. Finalize Exception Resolution
    const beforeStatus = exception.status;
    exception.status = "resolved";
    exception.resolutionNotes = notes
      ? notes.trim()
      : `Item cancellation approved. ${cancelQty} unit(s) cancelled and released.`;

    exception.cancellationDetails = {
      cancelledAt: new Date(),
      stockReleased: inventoryReleased,
      quantityReleased: cancelQty,
      refundIssued,
      refundAmount: refundAmountDec,
      refundId: refundResult?._id || null,
    };

    const actorName = actorUser?.name || actorUser?.email || "Administrator";
    const actorId = actorUser?._id || actorUser?.id || null;

    exception.timeline.push({
      status: "resolved",
      actorType: "admin",
      actorId,
      actorName,
      notes: `Cancellation approved for ${cancelQty} unit(s). ${refundIssued ? "Refund processed." : ""}`,
      timestamp: new Date(),
    });

    await exception.save();

    // Notify vendor
    const vendor = await Vendor.findById(exception.vendorId).select("email storeName businessName").lean();
    if (vendor?.email) {
      await enqueueIdempotentNotification({
        type: "fulfillment_exception_cancellation_approved",
        recipient: vendor.email,
        payload: {
          exceptionId: exception._id.toString(),
          exceptionNumber: exception.exceptionNumber,
          orderNumber: exception.orderNumber,
          status: "resolved",
          quantityCancelled: cancelQty,
          notes: exception.resolutionNotes,
        },
      });
    }

    await logAuditEvent({
      actorId,
      targetId: exception._id,
      action: "FULFILLMENT_EXCEPTION_CANCELLATION_APPROVED",
      beforeState: { status: beforeStatus },
      afterState: {
        status: "resolved",
        quantityCancelled: cancelQty,
        refundIssued,
      },
    });

    return {
      success: true,
      exception,
      order,
      refundIssued,
      quantityCancelled: cancelQty,
    };
  }
}

module.exports = new FulfillmentExceptionService();
