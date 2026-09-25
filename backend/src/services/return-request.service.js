const crypto = require("crypto");
const mongoose = require("mongoose");
const ReturnRequest = require("../models/ReturnRequest");
const Order = require("../models/Order");
const Customer = require("../models/Customer");
const AppError = require("../errors/AppError");
const { createCustomerNotification } = require("./customer-notification.service");

const RETURN_WINDOW_DAYS = 7;

const generateReturnNumber = () => {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `RET-${stamp}-${rand}`;
};

const createReturnRequest = async ({
  userId,
  orderId,
  type = "return",
  items,
  customerNotes = null,
  replacementVariantId = null,
}) => {
  const customer = await Customer.findOne({ userId });
  if (!customer) {
    throw new AppError("Customer profile not found", 404, "CUSTOMER_NOT_FOUND");
  }

  const { decodeSecureId } = require("../utils/secure-id.util");
  const resolvedOrderId = decodeSecureId(orderId, "order", { strict: false });
  const order = await Order.findById(resolvedOrderId);
  if (!order) {
    throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  }

  // Ownership verification
  if (order.customerId.toString() !== customer._id.toString()) {
    throw new AppError("You do not have permission to access this order", 403, "FORBIDDEN");
  }

  // Delivered status verification
  if (order.status !== "delivered" && order.status !== "completed") {
    throw new AppError(
      `Returns can only be requested for delivered orders. Current status: ${order.status}`,
      400,
      "ORDER_NOT_DELIVERED"
    );
  }

  // Return window verification (7 days)
  const deliveryDate = order.deliveredAt || order.updatedAt || order.createdAt;
  const daysSinceDelivery = (Date.now() - new Date(deliveryDate).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceDelivery > RETURN_WINDOW_DAYS) {
    throw new AppError(
      `The return window of ${RETURN_WINDOW_DAYS} days has expired for this order.`,
      400,
      "RETURN_WINDOW_EXPIRED"
    );
  }

  // Duplicate active return prevention
  const existingActive = await ReturnRequest.findOne({
    orderId: order._id,
    status: {
      $in: [
        "requested",
        "approved",
        "pickup_scheduled",
        "received",
        "refund_pending",
      ],
    },
  });

  if (existingActive) {
    throw new AppError(
      `An active return request (${existingActive.returnNumber}) already exists for this order.`,
      409,
      "DUPLICATE_RETURN_REQUEST"
    );
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError("At least one eligible item must be selected for return", 400, "NO_ITEMS_SELECTED");
  }

  // Validate items against order items
  const validatedItems = [];
  let calculatedRefundMinor = 0;

  for (const item of items) {
    const orderItem = order.items.find(
      (oi) =>
        oi.productId.toString() === item.productId.toString() &&
        (!item.productVariantId || (oi.productVariantId && oi.productVariantId.toString() === item.productVariantId.toString()))
    );

    if (!orderItem) {
      throw new AppError(`Item ${item.productId} was not part of this order`, 400, "INVALID_RETURN_ITEM");
    }

    const returnQty = Math.max(1, parseInt(item.quantity, 10) || 1);
    if (returnQty > orderItem.quantity) {
      throw new AppError(
        `Return quantity (${returnQty}) cannot exceed ordered quantity (${orderItem.quantity}) for ${orderItem.productName}`,
        400,
        "QUANTITY_EXCEEDED"
      );
    }

    const unitPriceNum = Number(orderItem.unitPrice?.toString() || orderItem.unitPrice || 0);
    calculatedRefundMinor += Math.round(unitPriceNum * returnQty * 100);

    validatedItems.push({
      productId: orderItem.productId,
      productVariantId: orderItem.productVariantId || null,
      vendorId: orderItem.vendorId || null,
      sku: orderItem.sku,
      name: orderItem.productName,
      quantity: returnQty,
      itemPrice: mongoose.Types.Decimal128.fromString(unitPriceNum.toFixed(2)),
      reason: item.reason || "defective",
      condition: item.condition || "unopened",
    });
  }

  const refundAmountStr = (calculatedRefundMinor / 100).toFixed(2);
  const returnNumber = generateReturnNumber();
  const vendorIds = [...new Set(validatedItems.map((i) => i.vendorId?.toString()).filter(Boolean))];

  const newReturn = await ReturnRequest.create({
    returnNumber,
    orderId: order._id,
    customerId: customer._id,
    type: type === "exchange" ? "exchange" : "return",
    status: "requested",
    items: validatedItems,
    vendorIds,
    replacementVariantId: replacementVariantId || null,
    customerNotes: customerNotes ? customerNotes.trim() : null,
    refundAmount: mongoose.Types.Decimal128.fromString(refundAmountStr),
    timeline: [
      {
        status: "requested",
        notes: `Return request submitted by customer for ${validatedItems.length} item(s).`,
        timestamp: new Date(),
      },
    ],
  });

  // Append event to order timeline
  order.timeline = order.timeline || [];
  order.timeline.push({
    event: "return_requested",
    title: `Return Requested (#${returnNumber})`,
    description: `Customer requested a ${type} for ${validatedItems.length} item(s). Reason: ${validatedItems[0]?.reason}`,
    timestamp: new Date(),
    actor: { actorType: "customer", actorId: customer._id },
  });
  await order.save();

  // Create in-app customer notification
  await createCustomerNotification({
    customerId: customer._id,
    userId,
    title: `Return Request Submitted (#${returnNumber})`,
    message: `Your return request for Order #${order.orderNumber} has been received and is being verified.`,
    type: "return",
    link: `/orders/${order._id}`,
  });

  return newReturn;
};

const getCustomerReturns = async (userId) => {
  const customer = await Customer.findOne({ userId });
  if (!customer) return [];

  return ReturnRequest.find({ customerId: customer._id })
    .populate("orderId", "orderNumber status placedAt deliveryOption")
    .sort({ createdAt: -1 })
    .lean();
};

const getReturnByOrderId = async (orderId, userId) => {
  const customer = await Customer.findOne({ userId });
  if (!customer) {
    throw new AppError("Customer profile not found", 404, "CUSTOMER_NOT_FOUND");
  }

  const order = await Order.findById(orderId);
  if (!order || order.customerId.toString() !== customer._id.toString()) {
    throw new AppError("Order not found or unauthorized", 404, "ORDER_NOT_FOUND");
  }

  return ReturnRequest.find({ orderId: order._id, customerId: customer._id })
    .sort({ createdAt: -1 })
    .lean();
};

const Product = require("../models/Product");
const { resolveApprovedVendor } = require("../middlewares/vendor.middleware");
const { encodeSecureId, decodeSecureId } = require("../utils/secure-id.util");

const getMyVendorReturns = async ({ userId, query = {} }) => {
  const vendor = await resolveApprovedVendor(userId);

  const vendorProducts = await Product.find({
    vendorId: vendor._id,
    deletedAt: null,
  }).select("_id title").lean();
  const productIds = vendorProducts.map((p) => p._id);
  const productIdSet = new Set(productIds.map((id) => id.toString()));

  if (productIds.length === 0) {
    return { items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } };
  }

  const filter = { "items.productId": { $in: productIds } };
  if (query.status) {
    filter.status = query.status;
  }

  const safePage = Math.max(Number(query.page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const skip = (safePage - 1) * safeLimit;

  const total = await ReturnRequest.countDocuments(filter);
  const returns = await ReturnRequest.find(filter)
    .populate("orderId", "orderNumber status placedAt")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(safeLimit)
    .lean();

  const items = returns.map((ret) => {
    const vendorItems = (ret.items || []).filter((item) =>
      productIdSet.has(item.productId?.toString())
    );

    return {
      _id: ret._id,
      secureId: encodeSecureId("return", ret._id),
      returnNumber: ret.returnNumber,
      orderNumber: ret.orderId?.orderNumber || "N/A",
      type: ret.type,
      status: ret.status,
      items: vendorItems,
      customerNotes: ret.customerNotes,
      timeline: ret.timeline,
      createdAt: ret.createdAt,
      updatedAt: ret.updatedAt,
    };
  });

  return {
    items,
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
};

const getMyVendorReturnById = async ({ userId, returnId }) => {
  const vendor = await resolveApprovedVendor(userId);
  const resolvedReturnId = decodeSecureId(returnId, "return");

  const ret = await ReturnRequest.findById(resolvedReturnId)
    .populate("orderId", "orderNumber status placedAt")
    .lean();

  if (!ret) {
    throw new AppError("Return request not found", 404, "RETURN_NOT_FOUND");
  }

  const vendorProducts = await Product.find({
    vendorId: vendor._id,
    deletedAt: null,
  }).select("_id").lean();
  const productIdSet = new Set(vendorProducts.map((p) => p._id.toString()));

  const vendorItems = (ret.items || []).filter((item) =>
    productIdSet.has(item.productId?.toString())
  );

  if (vendorItems.length === 0) {
    throw new AppError("You do not have permission to view this return request", 403, "FORBIDDEN");
  }

  return {
    _id: ret._id,
    secureId: encodeSecureId("return", ret._id),
    returnNumber: ret.returnNumber,
    orderNumber: ret.orderId?.orderNumber || "N/A",
    type: ret.type,
    status: ret.status,
    items: vendorItems,
    customerNotes: ret.customerNotes,
    resolutionNotes: ret.resolutionNotes,
    timeline: ret.timeline,
    createdAt: ret.createdAt,
    updatedAt: ret.updatedAt,
  };
};

const approveReturnRequest = async ({
  userId,
  returnId,
  notes = null,
  strict = false,
  ipAddress = null,
  userAgent = null,
  isAdmin = false,
}) => {
  const resolvedReturnId = decodeSecureId(returnId, "return", { strict });
  const ret = await ReturnRequest.findById(resolvedReturnId);
  if (!ret) {
    throw new AppError("Return request not found", 404, "RETURN_NOT_FOUND");
  }

  let vendor = null;
  if (!isAdmin) {
    vendor = await resolveApprovedVendor(userId);
    const hasVendorItems = (ret.items || []).some(
      (item) => item.vendorId && item.vendorId.toString() === vendor._id.toString()
    ) || (ret.vendorIds || []).some((vId) => vId.toString() === vendor._id.toString());

    if (!hasVendorItems) {
      throw new AppError("You do not have permission to manage this return request", 403, "FORBIDDEN");
    }
  }

  if (ret.status !== "requested") {
    throw new AppError(`Cannot approve return request in status '${ret.status}'`, 409, "INVALID_STATUS_TRANSITION");
  }

  const beforeStatus = ret.status;
  ret.status = "approved";
  if (notes) {
    ret.resolutionNotes = notes.trim();
  }

  ret.timeline = ret.timeline || [];
  ret.timeline.push({
    status: "approved",
    notes: notes || "Return request approved by merchant.",
    timestamp: new Date(),
  });

  await ret.save();

  const AuditLog = require("../models/AuditLog");
  await AuditLog.create({
    actorId: userId,
    targetId: ret._id,
    action: "RETURN_APPROVED",
    entityType: "return_request",
    beforeState: { status: beforeStatus },
    afterState: { status: ret.status },
    ipAddress,
    userAgent,
  }).catch(() => {});

  await createCustomerNotification({
    customerId: ret.customerId,
    title: `Return Request Approved (#${ret.returnNumber})`,
    message: `Your return request for Return #${ret.returnNumber} has been approved.`,
    type: "return",
    link: `/orders/${ret.orderId}`,
  }).catch(() => {});

  if (isAdmin) {
    return ret;
  }

  return getMyVendorReturnById({ userId, returnId: ret._id });
};

const rejectReturnRequest = async ({
  userId,
  returnId,
  reason,
  strict = false,
  ipAddress = null,
  userAgent = null,
  isAdmin = false,
}) => {
  if (!reason || !reason.trim()) {
    throw new AppError("Rejection reason is required", 400, "REJECTION_REASON_REQUIRED");
  }

  const resolvedReturnId = decodeSecureId(returnId, "return", { strict });
  const ret = await ReturnRequest.findById(resolvedReturnId);
  if (!ret) {
    throw new AppError("Return request not found", 404, "RETURN_NOT_FOUND");
  }

  let vendor = null;
  if (!isAdmin) {
    vendor = await resolveApprovedVendor(userId);
    const hasVendorItems = (ret.items || []).some(
      (item) => item.vendorId && item.vendorId.toString() === vendor._id.toString()
    ) || (ret.vendorIds || []).some((vId) => vId.toString() === vendor._id.toString());

    if (!hasVendorItems) {
      throw new AppError("You do not have permission to manage this return request", 403, "FORBIDDEN");
    }
  }

  if (ret.status !== "requested") {
    throw new AppError(`Cannot reject return request in status '${ret.status}'`, 409, "INVALID_STATUS_TRANSITION");
  }

  const beforeStatus = ret.status;
  ret.status = "rejected";
  ret.resolutionNotes = reason.trim();

  ret.timeline = ret.timeline || [];
  ret.timeline.push({
    status: "rejected",
    notes: `Return request rejected: ${reason.trim()}`,
    timestamp: new Date(),
  });

  await ret.save();

  const AuditLog = require("../models/AuditLog");
  await AuditLog.create({
    actorId: userId,
    targetId: ret._id,
    action: "RETURN_REJECTED",
    entityType: "return_request",
    beforeState: { status: beforeStatus },
    afterState: { status: ret.status, resolutionNotes: ret.resolutionNotes },
    ipAddress,
    userAgent,
  }).catch(() => {});

  await createCustomerNotification({
    customerId: ret.customerId,
    title: `Return Request Rejected (#${ret.returnNumber})`,
    message: `Your return request for Return #${ret.returnNumber} was not approved: ${reason.trim()}`,
    type: "return",
    link: `/orders/${ret.orderId}`,
  }).catch(() => {});

  if (isAdmin) {
    return ret;
  }

  return getMyVendorReturnById({ userId, returnId: ret._id });
};

const receiveReturnAndRestock = async ({
  userId,
  returnId,
  warehouseId = null,
  notes = null,
  strict = false,
  ipAddress = null,
  userAgent = null,
  isAdmin = false,
}) => {
  const resolvedReturnId = decodeSecureId(returnId, "return", { strict });
  const ret = await ReturnRequest.findById(resolvedReturnId);
  if (!ret) {
    throw new AppError("Return request not found", 404, "RETURN_NOT_FOUND");
  }

  let vendor = null;
  if (!isAdmin) {
    vendor = await resolveApprovedVendor(userId);
    const hasVendorItems = (ret.items || []).some(
      (item) => item.vendorId && item.vendorId.toString() === vendor._id.toString()
    ) || (ret.vendorIds || []).some((vId) => vId.toString() === vendor._id.toString());

    if (!hasVendorItems) {
      throw new AppError("You do not have permission to manage this return request", 403, "FORBIDDEN");
    }
  }

  if (!["approved", "pickup_scheduled"].includes(ret.status)) {
    throw new AppError(
      `Cannot receive return in status '${ret.status}'. Must be approved or pickup_scheduled.`,
      409,
      "INVALID_STATUS_TRANSITION"
    );
  }

  const order = await Order.findById(ret.orderId);
  if (!order) {
    throw new AppError("Order associated with return request not found", 404, "ORDER_NOT_FOUND");
  }

  const Inventory = require("../models/Inventory");
  const inventoryService = require("./inventory.service");
  const { decodeSecureId: decodeId } = require("../utils/secure-id.util");

  let targetWarehouseId = warehouseId ? decodeId(warehouseId, "warehouse", { strict: false }) : null;

  if (!targetWarehouseId) {
    const matchingOrderItem = order.items.find((oi) =>
      (!vendor || oi.vendorId?.toString() === vendor._id.toString()) && oi.warehouseId
    );
    targetWarehouseId = matchingOrderItem?.warehouseId;
  }

  if (!targetWarehouseId) {
    const Warehouse = require("../models/Warehouse");
    const defaultWarehouse = await Warehouse.findOne({ isActive: true }).select("_id").lean();
    targetWarehouseId = defaultWarehouse?._id;
  }

  if (!targetWarehouseId) {
    throw new AppError("No active warehouse found to restock returned items", 400, "WAREHOUSE_NOT_FOUND");
  }

  const itemsToRestock = (ret.items || []).filter(
    (item) => !vendor || (item.vendorId && item.vendorId.toString() === vendor._id.toString())
  );

  for (const item of itemsToRestock) {
    const query = { warehouseId: targetWarehouseId };
    if (item.productVariantId) {
      query.productVariantId = item.productVariantId;
    } else {
      query.productId = item.productId;
    }

    let inventory = await Inventory.findOne(query);
    if (!inventory) {
      inventory = await Inventory.create({
        warehouseId: targetWarehouseId,
        productId: item.productId,
        productVariantId: item.productVariantId || null,
        sku: item.sku || `SKU-${item.productId}`,
        onHand: 0,
        reserved: 0,
      });
    }

    await inventoryService.adjustStock(
      inventory._id,
      item.quantity,
      {
        referenceType: "return",
        referenceId: ret._id.toString(),
        notes: notes || `Restocked from return request ${ret.returnNumber}`,
      }
    );
  }

  const beforeStatus = ret.status;
  ret.status = "received";
  ret.restockedAt = new Date();
  ret.restockedWarehouseId = targetWarehouseId;

  ret.timeline = ret.timeline || [];
  ret.timeline.push({
    status: "received",
    notes: notes || `Items inspected, received, and restocked to warehouse.`,
    timestamp: new Date(),
  });

  await ret.save();

  const AuditLog = require("../models/AuditLog");
  await AuditLog.create({
    actorId: userId,
    targetId: ret._id,
    action: "RETURN_RESTOCKED",
    entityType: "return_request",
    beforeState: { status: beforeStatus },
    afterState: { status: ret.status, restockedAt: ret.restockedAt, warehouseId: targetWarehouseId },
    ipAddress,
    userAgent,
  }).catch(() => {});

  return getMyVendorReturnById({ userId, returnId: ret._id });
};

const processReturnRefund = async ({
  userId,
  returnId,
  notes = null,
  strict = false,
  ipAddress = null,
  userAgent = null,
  isAdmin = false,
}) => {
  const resolvedReturnId = decodeSecureId(returnId, "return", { strict });
  const ret = await ReturnRequest.findById(resolvedReturnId);
  if (!ret) {
    throw new AppError("Return request not found", 404, "RETURN_NOT_FOUND");
  }

  let vendor = null;
  if (!isAdmin) {
    vendor = await resolveApprovedVendor(userId);
    const hasVendorItems = (ret.items || []).some(
      (item) => item.vendorId && item.vendorId.toString() === vendor._id.toString()
    ) || (ret.vendorIds || []).some((vId) => vId.toString() === vendor._id.toString());

    if (!hasVendorItems) {
      throw new AppError("You do not have permission to manage this return request", 403, "FORBIDDEN");
    }
  }

  if (!["received", "approved"].includes(ret.status)) {
    throw new AppError(
      `Cannot refund return in status '${ret.status}'. Must be received or approved.`,
      409,
      "INVALID_STATUS_TRANSITION"
    );
  }

  const order = await Order.findById(ret.orderId);
  if (!order) {
    throw new AppError("Associated order not found", 404, "ORDER_NOT_FOUND");
  }

  if (order.paymentStatus !== "paid" && order.paymentStatus !== "partially_refunded") {
    throw new AppError(`Cannot refund an order with paymentStatus '${order.paymentStatus}'`, 409, "ORDER_NOT_PAID");
  }

  const refundService = require("./refund.service");
  const refundAmountStr = ret.refundAmount?.toString?.() || "0.00";

  let refund = null;
  try {
    const payment = await require("../repositories/payment.repository").findLatestByOrderId(ret.orderId);
    if (payment && payment.gatewayPaymentId) {
      refund = await refundService.createRefund({
        orderId: ret.orderId,
        amount: refundAmountStr,
        reason: notes || `Refund for return request ${ret.returnNumber}`,
        idempotencyKey: `ret_refund_${ret._id.toString()}`,
        userId,
        role: isAdmin ? "admin" : "vendor",
      });
    } else {
      order.paymentStatus = "partially_refunded";
      await order.save();
    }
  } catch (err) {
    if (err.code === "PAYMENT_NOT_FOUND" || err.code === "PAYMENT_GATEWAY_ID_MISSING") {
      order.paymentStatus = "partially_refunded";
      await order.save();
    } else if (err.message && err.message.includes("exceeds")) {
      throw err;
    } else {
      throw err;
    }
  }

  const beforeStatus = ret.status;
  ret.status = "refunded";
  ret.resolutionNotes = notes || "Return refund processed successfully";

  ret.timeline = ret.timeline || [];
  ret.timeline.push({
    status: "refunded",
    notes: `Refund of ${order.currency || "INR"} ${refundAmountStr} processed. Refund ID: ${refund?._id || "N/A"}`,
    timestamp: new Date(),
  });

  await ret.save();

  const AuditLog = require("../models/AuditLog");
  await AuditLog.create({
    actorId: userId,
    targetId: ret._id,
    action: "RETURN_REFUNDED",
    entityType: "return_request",
    beforeState: { status: beforeStatus },
    afterState: { status: ret.status, refundId: refund?._id, amount: refundAmountStr },
    ipAddress,
    userAgent,
  }).catch(() => {});

  order.timeline = order.timeline || [];
  order.timeline.push({
    event: "return_refunded",
    title: `Return Refund Processed (#${ret.returnNumber})`,
    description: `Refund of ${order.currency || "INR"} ${refundAmountStr} issued for return #${ret.returnNumber}.`,
    timestamp: new Date(),
    actor: { actorType: isAdmin ? "admin" : "vendor", actorId: userId },
  });
  await order.save().catch(() => {});

  await createCustomerNotification({
    customerId: ret.customerId,
    title: `Refund Processed (#${ret.returnNumber})`,
    message: `Your refund of ${order.currency || "INR"} ${refundAmountStr} for Order #${order.orderNumber} has been initiated.`,
    type: "refund",
    link: `/orders/${ret.orderId}`,
  }).catch(() => {});

  return getMyVendorReturnById({ userId, returnId: ret._id });
};

const getAdminReturns = async ({ query = {} }) => {
  const safePage = Math.max(Number(query.page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const skip = (safePage - 1) * safeLimit;

  const filter = {};
  if (query.status && query.status !== "all") {
    filter.status = query.status;
  }
  if (query.search) {
    filter.$or = [
      { returnNumber: { $regex: query.search.trim(), $options: "i" } },
    ];
  }

  const total = await ReturnRequest.countDocuments(filter);
  const returns = await ReturnRequest.find(filter)
    .populate("orderId", "orderNumber status placedAt grandTotal currency")
    .populate("customerId", "firstName lastName email phone")
    .populate("items.vendorId", "storeName businessName")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(safeLimit)
    .lean();

  const items = returns.map((ret) => ({
    _id: ret._id,
    secureId: encodeSecureId("return", ret._id),
    returnNumber: ret.returnNumber,
    orderNumber: ret.orderId?.orderNumber || "N/A",
    orderStatus: ret.orderId?.status,
    customer: ret.customerId
      ? {
          name: `${ret.customerId.firstName || ""} ${ret.customerId.lastName || ""}`.trim(),
          email: ret.customerId.email,
        }
      : null,
    type: ret.type,
    status: ret.status,
    items: ret.items,
    refundAmount: ret.refundAmount?.toString?.() || "0.00",
    customerNotes: ret.customerNotes,
    resolutionNotes: ret.resolutionNotes,
    createdAt: ret.createdAt,
    updatedAt: ret.updatedAt,
  }));

  return {
    items,
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
};

const getAdminReturnById = async (returnId) => {
  const resolvedReturnId = decodeSecureId(returnId, "return", { strict: false });
  const ret = await ReturnRequest.findById(resolvedReturnId)
    .populate("orderId", "orderNumber status placedAt grandTotal currency shippingAddress")
    .populate("customerId", "firstName lastName email phone")
    .populate("items.vendorId", "storeName businessName email")
    .lean();

  if (!ret) {
    throw new AppError("Return request not found", 404, "RETURN_NOT_FOUND");
  }

  return {
    ...ret,
    secureId: encodeSecureId("return", ret._id),
    refundAmount: ret.refundAmount?.toString?.() || "0.00",
  };
};

module.exports = {
  createReturnRequest,
  getCustomerReturns,
  getReturnByOrderId,
  getMyVendorReturns,
  getMyVendorReturnById,
  approveReturnRequest,
  rejectReturnRequest,
  receiveReturnAndRestock,
  processReturnRefund,
  getAdminReturns,
  getAdminReturnById,
};

