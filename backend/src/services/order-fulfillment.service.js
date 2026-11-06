const mongoose = require("mongoose");
const Order = require("../models/Order");
const Vendor = require("../models/Vendor");
const AuditLog = require("../models/AuditLog");
const AppError = require("../errors/AppError");
const logger = require("../config/logger");
const {
  SUPPORTED_SHIPMENT_PARTNERS,
  isValidShipmentPartner,
  getShipmentPartnerById,
  VENDOR_ACCEPTANCE_STATUSES,
} = require("../constants/shipping.constants");
const { decodeSecureId } = require("../utils/secure-id.util");

/**
 * Resolve the authenticated vendor profile ID from userId.
 */
const resolveVendorId = async (userId) => {
  const { resolveApprovedVendor } = require("../middlewares/vendor.middleware");
  const vendor = await resolveApprovedVendor(userId);
  return vendor._id;
};

/**
 * Helper to parse and validate expected delivery date.
 * Enforces that delivery date must be:
 * 1. A valid ISO or parsable Date.
 * 2. In the future (>= today).
 * 3. Within maximum delivery horizon (default 60 days).
 */
const validateAndParseExpectedDeliveryDate = (dateInput) => {
  if (!dateInput) {
    throw new AppError(
      "Expected delivery date is required",
      400,
      "MISSING_EXPECTED_DELIVERY_DATE"
    );
  }

  const parsed = new Date(dateInput);
  if (isNaN(parsed.getTime())) {
    throw new AppError(
      "Expected delivery date must be a valid date format",
      400,
      "INVALID_EXPECTED_DELIVERY_DATE_FORMAT"
    );
  }

  const now = new Date();
  // Allow today (strip hours for start-of-day comparison)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (parsed < todayStart) {
    throw new AppError(
      "Expected delivery date must be today or in the future",
      400,
      "DELIVERY_DATE_IN_PAST"
    );
  }

  const maxHorizonDays = 60;
  const maxDate = new Date(todayStart);
  maxDate.setDate(maxDate.getDate() + maxHorizonDays);

  if (parsed > maxDate) {
    throw new AppError(
      `Expected delivery date cannot exceed ${maxHorizonDays} days into the future`,
      400,
      "DELIVERY_DATE_EXCEEDS_HORIZON"
    );
  }

  return parsed;
};

/**
 * Central Confirmation Guard:
 * Fulfillment confirmation is strictly blocked unless ALL of the following prerequisites are met:
 * (a) Vendor has explicitly accepted assigned items (vendorAcceptance.status === 'accepted').
 * (b) Valid shipment partner is assigned (assignedShipmentPartner.partnerId is supported).
 * (c) Valid expected delivery date is persisted (expectedDeliveryDate is valid and >= today).
 * (d) Eligible payment state (order.paymentStatus === 'paid' or eligible COD).
 * (e) Scope is not cancelled or rejected.
 * (f) Authorized actor (vendor owning the items or authorized Superadmin override).
 *
 * All code paths (APIs, webhooks, background jobs, admin status transitions) must adhere to this guard.
 */
const validateConfirmationPrerequisites = (order, vendorId, options = {}) => {
  if (!order) {
    throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  }

  const vendorIdStr = vendorId.toString();

  // (e) Scope not cancelled
  if (order.status === "cancelled" || (order.cancellationStatus && order.cancellationStatus !== "none")) {
    throw new AppError(
      "Cannot confirm fulfillment for a cancelled order",
      409,
      "CONFIRMATION_BLOCKED_ORDER_CANCELLED"
    );
  }

  // Filter items belonging to target vendor
  const vendorItems = (order.items || []).filter(
    (item) => item.vendorId && item.vendorId.toString() === vendorIdStr
  );

  if (vendorItems.length === 0) {
    throw new AppError(
      "No items found for this vendor in this order",
      404,
      "NO_VENDOR_ITEMS_FOUND"
    );
  }

  // Find corresponding vendorFulfillment package if present
  const vf = (order.vendorFulfillments || []).find(
    (v) => v.vendorId && v.vendorId.toString() === vendorIdStr
  );

  // (a) Vendor Acceptance Check: Active items must not be pending or rejected
  for (const item of vendorItems) {
    if (item.fulfillmentStatus === "cancelled") continue;

    const acceptance = item.vendorAcceptance?.status || vf?.acceptanceStatus || "pending";

    if (acceptance === "rejected") {
      throw new AppError(
        "Fulfillment confirmation is blocked: Vendor items are marked as rejected",
        400,
        "CONFIRMATION_BLOCKED_REJECTED"
      );
    }

    if (acceptance !== "accepted") {
      throw new AppError(
        "Fulfillment confirmation is blocked: Vendor must explicitly accept assigned items first",
        400,
        "CONFIRMATION_BLOCKED_UNACCEPTED"
      );
    }
  }

  // (b) Shipment Partner Assignment Check
  const partnerId =
    vendorItems[0]?.assignedShipmentPartner?.partnerId ||
    vf?.assignedShipmentPartner?.partnerId;

  if (!partnerId || !isValidShipmentPartner(partnerId)) {
    throw new AppError(
      "Fulfillment confirmation is blocked: A valid shipment partner must be assigned",
      400,
      "CONFIRMATION_BLOCKED_NO_PARTNER"
    );
  }

  // (c) Expected Delivery Date Check
  const deliveryDateRaw =
    vendorItems[0]?.expectedDeliveryDate || vf?.expectedDeliveryDate;

  if (!deliveryDateRaw) {
    throw new AppError(
      "Fulfillment confirmation is blocked: Expected delivery date must be set and persisted",
      400,
      "CONFIRMATION_BLOCKED_NO_DELIVERY_DATE"
    );
  }

  const deliveryDate = new Date(deliveryDateRaw);
  if (isNaN(deliveryDate.getTime())) {
    throw new AppError(
      "Fulfillment confirmation is blocked: Persisted delivery date is invalid",
      400,
      "CONFIRMATION_BLOCKED_INVALID_DELIVERY_DATE"
    );
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (deliveryDate < todayStart) {
    throw new AppError(
      "Fulfillment confirmation is blocked: Expected delivery date cannot be in the past",
      400,
      "CONFIRMATION_BLOCKED_PAST_DELIVERY_DATE"
    );
  }

  // (d) Payment State Check
  const isPaid = order.paymentStatus === "paid";
  const isCodAuthorized =
    order.paymentMethod === "cod" &&
    ["pending", "authorized", "paid"].includes(order.paymentStatus);

  if (!isPaid && !isCodAuthorized) {
    throw new AppError(
      `Fulfillment confirmation is blocked: Order payment status '${order.paymentStatus}' is not eligible for fulfillment`,
      400,
      "CONFIRMATION_BLOCKED_PAYMENT_INELIGIBLE"
    );
  }

  return {
    eligible: true,
    vendorItems,
    partnerId,
    deliveryDate,
    vendorFulfillment: vf,
  };
};

/**
 * Vendor Acceptance Workflow:
 * Vendor explicitly accepts order items assigned to them.
 */
const acceptVendorOrderItems = async ({
  userId,
  orderId,
  notes = null,
  expectedVersion = null,
  ipAddress = null,
  userAgent = null,
}) => {
  const resolvedOrderId = decodeSecureId(orderId, "order", { strict: false });
  if (!mongoose.Types.ObjectId.isValid(resolvedOrderId)) {
    throw new AppError("Invalid order ID", 400, "INVALID_ORDER_ID");
  }

  const vendorId = await resolveVendorId(userId);

  const order = await Order.findOne({
    _id: resolvedOrderId,
    "items.vendorId": vendorId,
  });

  if (!order) {
    throw new AppError("Order not found or no items belong to this vendor", 404, "ORDER_NOT_FOUND");
  }

  if (["cancelled", "completed"].includes(order.status)) {
    throw new AppError(
      `Cannot accept items for an order in terminal status '${order.status}'`,
      409,
      "ORDER_TERMINAL_STATE"
    );
  }

  // Optimistic concurrency check
  if (expectedVersion !== null && expectedVersion !== undefined) {
    const currentVersion = order.fulfillmentVersion || 1;
    if (Number(expectedVersion) !== currentVersion) {
      throw new AppError(
        `Order fulfillment conflict: expected version ${expectedVersion} but current is ${currentVersion}. Please refresh.`,
        409,
        "CONCURRENT_MODIFICATION_CONFLICT"
      );
    }
  }

  const beforeItems = JSON.parse(JSON.stringify(order.items));
  const now = new Date();

  // Update line-item acceptance
  let acceptedCount = 0;
  for (const item of order.items) {
    if (item.vendorId && item.vendorId.toString() === vendorId.toString()) {
      if (item.fulfillmentStatus !== "cancelled") {
        item.vendorAcceptance = item.vendorAcceptance || {};
        item.vendorAcceptance.status = "accepted";
        item.vendorAcceptance.acceptedAt = now;
        item.vendorAcceptance.rejectedAt = null;
        item.vendorAcceptance.rejectionReason = null;
        item.vendorAcceptance.rejectedBy = null;
        if (notes) item.vendorAcceptance.notes = notes.trim();
        acceptedCount++;
      }
    }
  }

  if (acceptedCount === 0) {
    throw new AppError("No active items eligible for acceptance", 409, "NO_ELIGIBLE_ITEMS");
  }

  // Update or insert vendorFulfillments entry
  order.vendorFulfillments = order.vendorFulfillments || [];
  let vf = order.vendorFulfillments.find(
    (v) => v.vendorId && v.vendorId.toString() === vendorId.toString()
  );

  if (!vf) {
    order.vendorFulfillments.push({
      vendorId,
      acceptanceStatus: "accepted",
      rejectionReason: null,
      rejectedAt: null,
      notes: notes || null,
      version: 1,
    });
  } else {
    vf.acceptanceStatus = "accepted";
    vf.rejectionReason = null;
    vf.rejectedAt = null;
    if (notes) vf.notes = notes.trim();
    vf.version = (vf.version || 1) + 1;
  }

  order.fulfillmentVersion = (order.fulfillmentVersion || 1) + 1;

  order.timeline = order.timeline || [];
  order.timeline.push({
    event: "vendor_order_accepted",
    title: "Order Items Accepted by Merchant",
    description: notes || "Vendor has reviewed and accepted assigned order items.",
    timestamp: now,
    actor: {
      actorType: "vendor",
      actorId: vendorId.toString(),
    },
    metadata: {
      acceptedItemCount: acceptedCount,
      fulfillmentVersion: order.fulfillmentVersion,
    },
  });

  const updatedOrder = await order.save();

  // Consequential audit log
  await AuditLog.create({
    actorId: userId,
    targetId: order._id,
    action: "VENDOR_ORDER_ACCEPTED",
    entityType: "order",
    beforeState: { items: beforeItems },
    afterState: { fulfillmentVersion: updatedOrder.fulfillmentVersion },
    ipAddress,
    userAgent,
  }).catch(() => {});

  const { projectVendorOrder } = require("./order.service");
  const Shipment = require("../models/Shipment");
  const vendorShipments = await Shipment.find({
    orderId: updatedOrder._id,
    vendorId,
  }).lean();

  return projectVendorOrder(updatedOrder, vendorId, vendorShipments);
};

/**
 * Vendor Rejection Workflow:
 * Vendor rejects assigned items with required reason.
 * Crucial Invariant: Does NOT automatically cancel the parent order.
 * Rejection is recorded authoritatively and flagged for Superadmin review.
 */
const rejectVendorOrderItems = async ({
  userId,
  orderId,
  rejectionReason,
  notes = null,
  expectedVersion = null,
  ipAddress = null,
  userAgent = null,
}) => {
  if (!rejectionReason || typeof rejectionReason !== "string" || rejectionReason.trim().length < 5) {
    throw new AppError(
      "A specific rejection reason (minimum 5 characters) is required",
      400,
      "REJECTION_REASON_REQUIRED"
    );
  }

  const resolvedOrderId = decodeSecureId(orderId, "order", { strict: false });
  if (!mongoose.Types.ObjectId.isValid(resolvedOrderId)) {
    throw new AppError("Invalid order ID", 400, "INVALID_ORDER_ID");
  }

  const vendorId = await resolveVendorId(userId);

  const order = await Order.findOne({
    _id: resolvedOrderId,
    "items.vendorId": vendorId,
  });

  if (!order) {
    throw new AppError("Order not found or no items belong to this vendor", 404, "ORDER_NOT_FOUND");
  }

  if (["shipped", "delivered", "completed", "cancelled"].includes(order.status)) {
    throw new AppError(
      `Cannot reject items for an order in status '${order.status}'`,
      409,
      "INVALID_ORDER_STATUS"
    );
  }

  // Optimistic concurrency check
  if (expectedVersion !== null && expectedVersion !== undefined) {
    const currentVersion = order.fulfillmentVersion || 1;
    if (Number(expectedVersion) !== currentVersion) {
      throw new AppError(
        `Order fulfillment conflict: expected version ${expectedVersion} but current is ${currentVersion}. Please refresh.`,
        409,
        "CONCURRENT_MODIFICATION_CONFLICT"
      );
    }
  }

  const beforeItems = JSON.parse(JSON.stringify(order.items));
  const now = new Date();
  const trimmedReason = rejectionReason.trim();

  let rejectedCount = 0;
  for (const item of order.items) {
    if (item.vendorId && item.vendorId.toString() === vendorId.toString()) {
      if (item.fulfillmentStatus !== "cancelled") {
        item.vendorAcceptance = item.vendorAcceptance || {};
        item.vendorAcceptance.status = "rejected";
        item.vendorAcceptance.rejectedAt = now;
        item.vendorAcceptance.rejectionReason = trimmedReason;
        item.vendorAcceptance.rejectedBy = vendorId;
        if (notes) item.vendorAcceptance.notes = notes.trim();
        item.isFulfillmentConfirmed = false;
        rejectedCount++;
      }
    }
  }

  if (rejectedCount === 0) {
    throw new AppError("No active items eligible for rejection", 409, "NO_ELIGIBLE_ITEMS");
  }

  // Update or insert vendorFulfillments entry
  order.vendorFulfillments = order.vendorFulfillments || [];
  let vf = order.vendorFulfillments.find(
    (v) => v.vendorId && v.vendorId.toString() === vendorId.toString()
  );

  if (!vf) {
    order.vendorFulfillments.push({
      vendorId,
      acceptanceStatus: "rejected",
      rejectionReason: trimmedReason,
      rejectedAt: now,
      isFulfillmentConfirmed: false,
      notes: notes || null,
      version: 1,
    });
  } else {
    vf.acceptanceStatus = "rejected";
    vf.rejectionReason = trimmedReason;
    vf.rejectedAt = now;
    vf.isFulfillmentConfirmed = false;
    if (notes) vf.notes = notes.trim();
    vf.version = (vf.version || 1) + 1;
  }

  order.fulfillmentVersion = (order.fulfillmentVersion || 1) + 1;

  // Append timeline event for transparency
  order.timeline = order.timeline || [];
  order.timeline.push({
    event: "vendor_order_rejected",
    title: "Vendor Rejected Assigned Items",
    description: `Merchant rejected order items. Reason: ${trimmedReason}. Flagged for administrative review.`,
    timestamp: now,
    actor: {
      actorType: "vendor",
      actorId: vendorId.toString(),
    },
    metadata: {
      rejectionReason: trimmedReason,
      rejectedItemCount: rejectedCount,
      fulfillmentVersion: order.fulfillmentVersion,
    },
  });

  const updatedOrder = await order.save();

  // Consequential audit log
  await AuditLog.create({
    actorId: userId,
    targetId: order._id,
    action: "VENDOR_ORDER_REJECTED",
    entityType: "order",
    beforeState: { items: beforeItems },
    afterState: {
      fulfillmentVersion: updatedOrder.fulfillmentVersion,
      rejectionReason: trimmedReason,
    },
    ipAddress,
    userAgent,
  }).catch(() => {});

  const { projectVendorOrder } = require("./order.service");
  const Shipment = require("../models/Shipment");
  const vendorShipments = await Shipment.find({
    orderId: updatedOrder._id,
    vendorId,
  }).lean();

  return projectVendorOrder(updatedOrder, vendorId, vendorShipments);
};

/**
 * Update Vendor Fulfillment Details:
 * Assigns shipment partner and sets expected delivery date for the vendor's package.
 */
const updateVendorFulfillmentDetails = async ({
  userId,
  orderId,
  partnerId,
  partnerName = null,
  serviceCode = "standard",
  expectedDeliveryDate,
  expectedVersion = null,
  ipAddress = null,
  userAgent = null,
}) => {
  if (!partnerId || !isValidShipmentPartner(partnerId)) {
    throw new AppError(
      `Unsupported shipment partner: ${partnerId}. Must be one of: ${SUPPORTED_SHIPMENT_PARTNERS.map((p) => p.id).join(", ")}`,
      400,
      "INVALID_SHIPMENT_PARTNER"
    );
  }

  const parsedDeliveryDate = validateAndParseExpectedDeliveryDate(expectedDeliveryDate);
  const resolvedPartner = getShipmentPartnerById(partnerId);
  const finalPartnerName = partnerName?.trim() || resolvedPartner?.name || partnerId;

  const resolvedOrderId = decodeSecureId(orderId, "order", { strict: false });
  if (!mongoose.Types.ObjectId.isValid(resolvedOrderId)) {
    throw new AppError("Invalid order ID", 400, "INVALID_ORDER_ID");
  }

  const vendorId = await resolveVendorId(userId);

  const order = await Order.findOne({
    _id: resolvedOrderId,
    "items.vendorId": vendorId,
  });

  if (!order) {
    throw new AppError("Order not found or no items belong to this vendor", 404, "ORDER_NOT_FOUND");
  }

  if (["cancelled", "completed"].includes(order.status)) {
    throw new AppError(
      `Cannot update fulfillment details for an order in status '${order.status}'`,
      409,
      "INVALID_ORDER_STATUS"
    );
  }

  // Optimistic concurrency check
  if (expectedVersion !== null && expectedVersion !== undefined) {
    const currentVersion = order.fulfillmentVersion || 1;
    if (Number(expectedVersion) !== currentVersion) {
      throw new AppError(
        `Order fulfillment conflict: expected version ${expectedVersion} but current is ${currentVersion}. Please refresh.`,
        409,
        "CONCURRENT_MODIFICATION_CONFLICT"
      );
    }
  }

  const now = new Date();

  // Apply partner and delivery date to all of vendor's items
  for (const item of order.items) {
    if (item.vendorId && item.vendorId.toString() === vendorId.toString()) {
      item.assignedShipmentPartner = {
        partnerId: resolvedPartner?.id || partnerId.toLowerCase(),
        partnerName: finalPartnerName,
        serviceCode: serviceCode || "standard",
        assignedAt: now,
        assignedBy: vendorId,
      };
      item.expectedDeliveryDate = parsedDeliveryDate;
    }
  }

  // Update or insert vendorFulfillments entry
  order.vendorFulfillments = order.vendorFulfillments || [];
  let vf = order.vendorFulfillments.find(
    (v) => v.vendorId && v.vendorId.toString() === vendorId.toString()
  );

  if (!vf) {
    order.vendorFulfillments.push({
      vendorId,
      assignedShipmentPartner: {
        partnerId: resolvedPartner?.id || partnerId.toLowerCase(),
        partnerName: finalPartnerName,
        serviceCode: serviceCode || "standard",
        assignedAt: now,
      },
      expectedDeliveryDate: parsedDeliveryDate,
      version: 1,
    });
  } else {
    vf.assignedShipmentPartner = {
      partnerId: resolvedPartner?.id || partnerId.toLowerCase(),
      partnerName: finalPartnerName,
      serviceCode: serviceCode || "standard",
      assignedAt: now,
    };
    vf.expectedDeliveryDate = parsedDeliveryDate;
    vf.version = (vf.version || 1) + 1;
  }

  order.fulfillmentVersion = (order.fulfillmentVersion || 1) + 1;

  order.timeline = order.timeline || [];
  order.timeline.push({
    event: "fulfillment_details_updated",
    title: "Shipment Partner & Expected Delivery Set",
    description: `Partner: ${finalPartnerName}. Expected Delivery: ${parsedDeliveryDate.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}.`,
    timestamp: now,
    actor: {
      actorType: "vendor",
      actorId: vendorId.toString(),
    },
    metadata: {
      partnerId,
      partnerName: finalPartnerName,
      expectedDeliveryDate: parsedDeliveryDate,
      fulfillmentVersion: order.fulfillmentVersion,
    },
  });

  const updatedOrder = await order.save();

  await AuditLog.create({
    actorId: userId,
    targetId: order._id,
    action: "VENDOR_FULFILLMENT_DETAILS_UPDATED",
    entityType: "order",
    afterState: {
      partnerId,
      expectedDeliveryDate: parsedDeliveryDate,
      fulfillmentVersion: updatedOrder.fulfillmentVersion,
    },
    ipAddress,
    userAgent,
  }).catch(() => {});

  const { projectVendorOrder } = require("./order.service");
  const Shipment = require("../models/Shipment");
  const vendorShipments = await Shipment.find({
    orderId: updatedOrder._id,
    vendorId,
  }).lean();

  return projectVendorOrder(updatedOrder, vendorId, vendorShipments);
};

/**
 * Confirm Vendor Fulfillment:
 * Strictly evaluated through Central Confirmation Guard.
 * Marks items as confirmed and moves status to processing.
 */
const confirmVendorFulfillment = async ({
  userId,
  orderId,
  notes = null,
  expectedVersion = null,
  ipAddress = null,
  userAgent = null,
}) => {
  const resolvedOrderId = decodeSecureId(orderId, "order", { strict: false });
  if (!mongoose.Types.ObjectId.isValid(resolvedOrderId)) {
    throw new AppError("Invalid order ID", 400, "INVALID_ORDER_ID");
  }

  const vendorId = await resolveVendorId(userId);

  const order = await Order.findOne({
    _id: resolvedOrderId,
    "items.vendorId": vendorId,
  });

  if (!order) {
    throw new AppError("Order not found or no items belong to this vendor", 404, "ORDER_NOT_FOUND");
  }

  // Optimistic concurrency check
  if (expectedVersion !== null && expectedVersion !== undefined) {
    const currentVersion = order.fulfillmentVersion || 1;
    if (Number(expectedVersion) !== currentVersion) {
      throw new AppError(
        `Order fulfillment conflict: expected version ${expectedVersion} but current is ${currentVersion}. Please refresh.`,
        409,
        "CONCURRENT_MODIFICATION_CONFLICT"
      );
    }
  }

  // Strictly enforce Central Confirmation Guard!
  const guard = validateConfirmationPrerequisites(order, vendorId);

  const now = new Date();

  // Mark all active vendor items as confirmed and processing
  for (const item of order.items) {
    if (item.vendorId && item.vendorId.toString() === vendorId.toString()) {
      if (item.fulfillmentStatus !== "cancelled") {
        item.isFulfillmentConfirmed = true;
        item.fulfillmentConfirmedAt = now;
        item.fulfillmentConfirmedBy = vendorId;
        if (item.fulfillmentStatus === "unfulfilled") {
          item.fulfillmentStatus = "processing";
        }
      }
    }
  }

  // Update vendorFulfillments entry
  order.vendorFulfillments = order.vendorFulfillments || [];
  let vf = order.vendorFulfillments.find(
    (v) => v.vendorId && v.vendorId.toString() === vendorId.toString()
  );

  if (!vf) {
    order.vendorFulfillments.push({
      vendorId,
      isFulfillmentConfirmed: true,
      fulfillmentConfirmedAt: now,
      fulfillmentStatus: "processing",
      version: 1,
    });
  } else {
    vf.isFulfillmentConfirmed = true;
    vf.fulfillmentConfirmedAt = now;
    if (vf.fulfillmentStatus === "unfulfilled") {
      vf.fulfillmentStatus = "processing";
    }
    vf.version = (vf.version || 1) + 1;
  }

  // If parent order is currently confirmed, move to processing
  if (order.status === "confirmed") {
    order.status = "processing";
  }

  order.fulfillmentVersion = (order.fulfillmentVersion || 1) + 1;

  order.timeline = order.timeline || [];
  order.timeline.push({
    event: "vendor_fulfillment_confirmed",
    title: "Fulfillment Confirmed by Merchant",
    description: notes || "Vendor has fulfilled all confirmation prerequisites and begun order processing.",
    timestamp: now,
    actor: {
      actorType: "vendor",
      actorId: vendorId.toString(),
    },
    metadata: {
      fulfillmentVersion: order.fulfillmentVersion,
      assignedPartner: guard.partnerId,
      expectedDeliveryDate: guard.deliveryDate,
    },
  });

  const updatedOrder = await order.save();

  await AuditLog.create({
    actorId: userId,
    targetId: order._id,
    action: "VENDOR_FULFILLMENT_CONFIRMED",
    entityType: "order",
    afterState: {
      fulfillmentVersion: updatedOrder.fulfillmentVersion,
      status: updatedOrder.status,
    },
    ipAddress,
    userAgent,
  }).catch(() => {});

  const { projectVendorOrder } = require("./order.service");
  const Shipment = require("../models/Shipment");
  const vendorShipments = await Shipment.find({
    orderId: updatedOrder._id,
    vendorId,
  }).lean();

  return projectVendorOrder(updatedOrder, vendorId, vendorShipments);
};

/**
 * Superadmin Override & Rejection Resolution:
 * Enables marketplace administrators to review vendor rejections,
 * resolve exceptions, update expected delivery dates, or perform controlled overrides.
 */
const adminOverrideFulfillment = async ({
  adminUser,
  orderId,
  vendorId,
  action,
  partnerId = null,
  partnerName = null,
  serviceCode = "standard",
  expectedDeliveryDate = null,
  expectedVersion = null,
  overrideReason,
  notes = null,
  ipAddress = null,
  userAgent = null,
}) => {
  if (!overrideReason || typeof overrideReason !== "string" || overrideReason.trim().length < 5) {
    throw new AppError(
      "A detailed override reason (min 5 characters) is required for Superadmin action",
      400,
      "OVERRIDE_REASON_REQUIRED"
    );
  }

  const resolvedOrderId = decodeSecureId(orderId, "order", { strict: false });
  if (!mongoose.Types.ObjectId.isValid(resolvedOrderId)) {
    throw new AppError("Invalid order ID", 400, "INVALID_ORDER_ID");
  }

  const order = await Order.findById(resolvedOrderId);
  if (!order) {
    throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  }

  // Optimistic concurrency check
  if (expectedVersion !== null && expectedVersion !== undefined) {
    const currentVersion = order.fulfillmentVersion || 1;
    if (Number(expectedVersion) !== currentVersion) {
      throw new AppError(
        `Order fulfillment conflict: expected version ${expectedVersion} but current is ${currentVersion}. Please refresh.`,
        409,
        "CONCURRENT_MODIFICATION_CONFLICT"
      );
    }
  }

  const now = new Date();
  const trimmedReason = overrideReason.trim();

  const targetVendorIdStr = vendorId ? vendorId.toString() : null;
  let previousPartnerInfo = null;

  if (action === "resolve_rejection") {
    // Admin resets rejected items back to accepted or pending
    for (const item of order.items) {
      if (!targetVendorIdStr || (item.vendorId && item.vendorId.toString() === targetVendorIdStr)) {
        if (item.vendorAcceptance?.status === "rejected") {
          item.vendorAcceptance.status = "accepted";
          item.vendorAcceptance.acceptedAt = now;
          item.vendorAcceptance.notes = `Rejection resolved administratively: ${trimmedReason}`;
        }
      }
    }

    order.vendorFulfillments = order.vendorFulfillments || [];
    for (const vf of order.vendorFulfillments) {
      if (!targetVendorIdStr || (vf.vendorId && vf.vendorId.toString() === targetVendorIdStr)) {
        if (vf.acceptanceStatus === "rejected") {
          vf.acceptanceStatus = "accepted";
          vf.notes = `Rejection resolved administratively: ${trimmedReason}`;
          vf.version = (vf.version || 1) + 1;
        }
      }
    }
  } else if (action === "update_delivery_date") {
    const parsedDate = validateAndParseExpectedDeliveryDate(expectedDeliveryDate);
    for (const item of order.items) {
      if (!targetVendorIdStr || (item.vendorId && item.vendorId.toString() === targetVendorIdStr)) {
        item.expectedDeliveryDate = parsedDate;
      }
    }
    order.vendorFulfillments = order.vendorFulfillments || [];
    for (const vf of order.vendorFulfillments) {
      if (!targetVendorIdStr || (vf.vendorId && vf.vendorId.toString() === targetVendorIdStr)) {
        vf.expectedDeliveryDate = parsedDate;
        vf.version = (vf.version || 1) + 1;
      }
    }
  } else if (action === "assign_courier") {
    if (!partnerId || !isValidShipmentPartner(partnerId)) {
      throw new AppError(
        `Unsupported shipment partner: ${partnerId}. Must be one of: ${SUPPORTED_SHIPMENT_PARTNERS.map((p) => p.id).join(", ")}`,
        400,
        "INVALID_SHIPMENT_PARTNER"
      );
    }

    if (["cancelled", "completed"].includes(order.status)) {
      throw new AppError(
        `Cannot assign courier for an order in status '${order.status}'`,
        409,
        "INVALID_ORDER_STATUS"
      );
    }

    const resolvedPartner = getShipmentPartnerById(partnerId);
    const finalPartnerName = partnerName?.trim() || resolvedPartner?.name || partnerId;
    const parsedDate = expectedDeliveryDate ? validateAndParseExpectedDeliveryDate(expectedDeliveryDate) : null;

    if (targetVendorIdStr) {
      const vendorItems = (order.items || []).filter(
        (it) => it.vendorId && it.vendorId.toString() === targetVendorIdStr
      );
      if (vendorItems.length === 0) {
        throw new AppError(
          "No items found for this vendor in this order",
          404,
          "NO_VENDOR_ITEMS_FOUND"
        );
      }
    }

    const existingWithPartner = (order.items || []).find(
      (it) => (!targetVendorIdStr || (it.vendorId && it.vendorId.toString() === targetVendorIdStr)) && it.assignedShipmentPartner
    );
    previousPartnerInfo = existingWithPartner?.assignedShipmentPartner?.partnerId || null;

    for (const item of order.items) {
      if (!targetVendorIdStr || (item.vendorId && item.vendorId.toString() === targetVendorIdStr)) {
        item.assignedShipmentPartner = {
          partnerId: resolvedPartner?.id || partnerId.toLowerCase(),
          partnerName: finalPartnerName,
          serviceCode: serviceCode || "standard",
          assignedAt: now,
          assignedBy: adminUser.id || adminUser._id,
        };
        if (parsedDate) {
          item.expectedDeliveryDate = parsedDate;
        }
      }
    }

    order.vendorFulfillments = order.vendorFulfillments || [];
    let vf = order.vendorFulfillments.find(
      (v) => !targetVendorIdStr || (v.vendorId && v.vendorId.toString() === targetVendorIdStr)
    );
    if (!vf && targetVendorIdStr) {
      order.vendorFulfillments.push({
        vendorId: targetVendorIdStr,
        assignedShipmentPartner: {
          partnerId: resolvedPartner?.id || partnerId.toLowerCase(),
          partnerName: finalPartnerName,
          serviceCode: serviceCode || "standard",
          assignedAt: now,
        },
        expectedDeliveryDate: parsedDate || undefined,
        version: 1,
      });
    } else if (vf) {
      vf.assignedShipmentPartner = {
        partnerId: resolvedPartner?.id || partnerId.toLowerCase(),
        partnerName: finalPartnerName,
        serviceCode: serviceCode || "standard",
        assignedAt: now,
      };
      if (parsedDate) {
        vf.expectedDeliveryDate = parsedDate;
      }
      vf.version = (vf.version || 1) + 1;
    }
  } else if (action === "force_confirm") {
    // Admin forces fulfillment confirmation with logged reason
    for (const item of order.items) {
      if (!targetVendorIdStr || (item.vendorId && item.vendorId.toString() === targetVendorIdStr)) {
        item.isFulfillmentConfirmed = true;
        item.fulfillmentConfirmedAt = now;
        item.fulfillmentConfirmedBy = adminUser.id || adminUser._id;
        if (item.fulfillmentStatus === "unfulfilled") {
          item.fulfillmentStatus = "processing";
        }
      }
    }
    order.vendorFulfillments = order.vendorFulfillments || [];
    for (const vf of order.vendorFulfillments) {
      if (!targetVendorIdStr || (vf.vendorId && vf.vendorId.toString() === targetVendorIdStr)) {
        vf.isFulfillmentConfirmed = true;
        vf.fulfillmentConfirmedAt = now;
        vf.fulfillmentStatus = "processing";
        vf.version = (vf.version || 1) + 1;
      }
    }
    if (order.status === "confirmed") {
      order.status = "processing";
    }
  } else {
    throw new AppError(`Unsupported admin override action: ${action}`, 400, "INVALID_ACTION");
  }

  order.fulfillmentVersion = (order.fulfillmentVersion || 1) + 1;

  order.timeline = order.timeline || [];
  order.timeline.push({
    event: `admin_fulfillment_override_${action}`,
    title: action === "assign_courier"
      ? "Courier Partner Assigned by Administrator"
      : `Fulfillment Overridden by Administrator (${action})`,
    description: action === "assign_courier"
      ? `Assigned Partner: ${partnerId}. Reason: ${trimmedReason}. Previous: ${previousPartnerInfo || "none"}`
      : `Action: ${action}. Reason: ${trimmedReason}. Notes: ${notes || "None"}`,
    timestamp: now,
    actor: {
      actorType: "admin",
      actorId: (adminUser.id || adminUser._id).toString(),
    },
    metadata: {
      action,
      partnerId,
      partnerName,
      previousPartner: previousPartnerInfo,
      overrideReason: trimmedReason,
      vendorId: targetVendorIdStr,
      fulfillmentVersion: order.fulfillmentVersion,
    },
  });

  await order.save();

  await AuditLog.create({
    actorId: adminUser.id || adminUser._id,
    targetId: order._id,
    action: "ORDER_FULFILLMENT_ADMIN_OVERRIDE",
    entityType: "order",
    afterState: {
      action,
      partnerId,
      previousPartner: previousPartnerInfo,
      overrideReason: trimmedReason,
      fulfillmentVersion: order.fulfillmentVersion,
    },
    ipAddress,
    userAgent,
  }).catch(() => {});

  const { getAdminOrderById } = require("./order.service");
  return getAdminOrderById(order._id);
};

module.exports = {
  SUPPORTED_SHIPMENT_PARTNERS,
  validateConfirmationPrerequisites,
  validateAndParseExpectedDeliveryDate,
  acceptVendorOrderItems,
  rejectVendorOrderItems,
  updateVendorFulfillmentDetails,
  confirmVendorFulfillment,
  adminOverrideFulfillment,
  getShipmentPartners: () => SUPPORTED_SHIPMENT_PARTNERS,
};

