const orderService = require("../services/order.service");
const analyticsService = require("../services/analytics.service");

const apiResponse = require("../utils/apiResponse");

const createOrder = async (req, res) => {
  const rawIdempotencyKey = req.get("Idempotency-Key");
  const idempotencyKey =
    rawIdempotencyKey !== undefined ? rawIdempotencyKey : null;

  const isGuest = Boolean(req.isGuest || req.user?.isGuest);
  const guestId = req.guestId || req.user?.guestId;

  const order =
    await orderService.createOrderFromCurrentCart(
      req.user.id,
      req.body.shippingAddressId,
      req.body.couponCode || null,
      idempotencyKey,
      req.body.deliveryOptionId || "standard",
      req.body.quoteReference || null,
      {
        isGuest,
        guestId,
        guestEmail: req.body.guestEmail,
        guestShippingAddress: req.body.guestShippingAddress,
      }
    );

  const isReplay = Boolean(order?.isReplay);
  if (order && "isReplay" in order) {
    delete order.isReplay;
  }

  if (!isReplay && !isGuest) {
    await analyticsService.track({
      eventName: "order_created",
      eventType: "order",
      userId: req.user.id,
      customerId: order.customerId,
      entityType: "order",
      entityId: order._id,
      properties: {
        orderNumber: order.orderNumber,
        currency: order.currency,
        grandTotal: order.grandTotal.toString(),
        itemCount: order.items.length,
      },
      metadata: {
        source: "api",
      },
    });
  }

  return apiResponse.sendSuccess(res, {
    statusCode: 201,
    message: "Order created successfully",
    data: order,
  });
};

const getCheckoutQuote = async (req, res) => {
  const isGuest = Boolean(req.isGuest || req.user?.isGuest);
  const guestId = req.guestId || req.user?.guestId;

  const quote = await orderService.calculateCheckoutQuote({
    userId: req.user.id,
    shippingAddressId: req.body.shippingAddressId || null,
    guestShippingAddress: req.body.guestShippingAddress || null,
    couponCode: req.body.couponCode || null,
    deliveryOptionId: req.body.deliveryOptionId || "standard",
    isGuest,
    guestId,
  });

  return apiResponse.sendSuccess(res, {
    message: "Checkout quote calculated successfully",
    data: quote,
  });
};

const getOrderActivity = async (req, res) => {
  const isAdmin = req.user?.role === "admin" || req.user?.roles?.includes?.("admin");
  const isGuest = Boolean(req.isGuest || req.user?.isGuest);
  const guestId = req.guestId || req.user?.guestId;
  const token = req.get("X-Order-Token") || req.query.token;

  const activity = await orderService.getOrderActivity(
    req.params.id,
    req.user.id,
    isAdmin,
    {
      isGuest,
      guestId,
      guestOrderAccessToken: token,
      token,
    }
  );

  return apiResponse.sendSuccess(res, {
    message: "Order activity retrieved successfully",
    data: activity,
  });
};

const getMyOrders = async (req, res) => {
  const orders =
    await orderService.getCustomerOrders(
      req.user.id
    );

  return apiResponse.sendSuccess(res, {
    message: "Orders retrieved successfully",
    data: orders,
  });
};

const getMyOrderById = async (req, res) => {
  const isGuest = Boolean(req.isGuest || req.user?.isGuest);
  const guestId = req.guestId || req.user?.guestId;
  const token = req.get("X-Order-Token") || req.query.token;

  const order =
    await orderService.getOrderById(
      req.params.id,
      req.user.id,
      {
        isGuest,
        guestId,
        guestOrderAccessToken: token,
        token,
      }
    );

  return apiResponse.sendSuccess(res, {
    message: "Order retrieved successfully",
    data: order,
  });
};

const cancelOrder = async (req, res) => {
  const isGuest = Boolean(req.isGuest || req.user?.isGuest);
  const guestId = req.guestId || req.user?.guestId;
  const token = req.get("X-Order-Token") || req.query.token;

  const order =
    await orderService.cancelOrder(
      req.params.id,
      {
        userId: req.user.id,
        isGuest,
        guestId,
        guestOrderAccessToken: token,
        token,
        itemIds: req.body?.itemIds || (req.body?.orderItemId ? [req.body.orderItemId] : undefined),
        cancellationReason: req.body?.reason || req.body?.cancellationReason || "Customer requested cancellation",
      }
    );

  return apiResponse.sendSuccess(res, {
    message: "Order cancelled successfully",
    data: order,
  });
};

const linkGuestOrder = async (req, res) => {
  const order = await orderService.linkGuestOrderToCustomer({
    customerUserId: req.user.id,
    orderId: req.body.orderId || req.params.id,
    orderAccessToken:
      req.body.orderAccessToken ||
      req.body.guestOrderAccessToken ||
      req.get("X-Order-Token"),
    guestSessionToken:
      req.body.guestSessionToken ||
      req.body.guestToken ||
      req.get("X-Guest-Session"),
  });

  return apiResponse.sendSuccess(res, {
    message: "Guest order linked to customer successfully",
    data: order,
  });
};

const cancelAdminOrder = async (req, res) => {
  const order = await orderService.cancelOrder(
    req.params.id,
    {
      userId: req.user.id || req.user._id,
      isAdmin: true,
      itemIds: req.body?.itemIds || (req.body?.orderItemId ? [req.body.orderItemId] : undefined),
      cancellationReason: req.body?.reason || req.body?.cancellationReason || "Administratively cancelled",
    }
  );

  return apiResponse.sendSuccess(res, {
    message: "Order cancelled administratively",
    data: order,
  });
};

const getMyVendorOrders = async (req, res) => {
  const result = await orderService.getVendorOrders({
    userId: req.user.id,
    query: req.query,
  });

  return apiResponse.sendSuccess(res, {
    message: "Vendor orders retrieved successfully",
    data: result.items,
    meta: result.meta,
  });
};

const getMyVendorOrderById = async (req, res) => {
  const isStrictVendorRoute = (req.originalUrl || "").includes("/vendors/me");
  const order = await orderService.getVendorOrderById({
    orderId: req.params.orderId,
    userId: req.user.id,
    strict: isStrictVendorRoute,
  });

  return apiResponse.sendSuccess(res, {
    message: "Vendor order retrieved successfully",
    data: order,
  });
};

const transitionVendorOrderStatus = async (req, res) => {
  const isStrictVendorRoute = (req.originalUrl || "").includes("/vendors/me");
  const order = await orderService.transitionVendorOrderItemStatus({
    userId: req.user.id,
    orderId: req.params.orderId,
    action: req.body.action,
    notes: req.body.notes,
    strict: isStrictVendorRoute,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return apiResponse.sendSuccess(res, {
    message: `Order marked as ${req.body.action} successfully`,
    data: order,
  });
};

const getAdminOrders = async (req, res) => {
  const result = await orderService.getAdminOrders({
    query: req.query,
  });

  return apiResponse.sendSuccess(res, {
    message: "Orders retrieved successfully",
    data: result.items,
    meta: result.meta,
  });
};

const getAdminOrderById = async (req, res) => {
  const order = await orderService.getAdminOrderById(req.params.id);

  return apiResponse.sendSuccess(res, {
    message: "Order details retrieved successfully",
    data: order,
  });
};

const updateAdminOrderStatus = async (req, res) => {
  const order = await orderService.updateAdminOrderStatus({
    orderId: req.params.id,
    status: req.body.status,
    reason: req.body.reason || "",
    notes: req.body.notes || "",
    expectedPreviousStatus: req.body.expectedPreviousStatus || null,
    expectedVersion: req.body.expectedVersion !== undefined ? req.body.expectedVersion : null,
    isOverride: Boolean(req.body.isOverride),
    overrideReason: req.body.overrideReason || "",
    actor: {
      userId: req.user.id || req.user._id,
      role: req.user.role || (req.user.roles && req.user.roles[0]) || "admin",
      roles: req.user.roles || [req.user.role],
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    },
  });

  return apiResponse.sendSuccess(res, {
    message: `Order status updated to ${req.body.status} successfully`,
    data: order,
  });
};

module.exports = {
  createOrder,
  getCheckoutQuote,
  getOrderActivity,
  getMyOrders,
  getMyOrderById,
  cancelOrder,
  cancelAdminOrder,
  linkGuestOrder,
  getMyVendorOrders,
  getMyVendorOrderById,
  transitionVendorOrderStatus,
  getAdminOrders,
  getAdminOrderById,
  updateAdminOrderStatus,
};


