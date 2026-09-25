const orderService = require("../services/order.service");
const analyticsService = require("../services/analytics.service");

const apiResponse = require("../utils/apiResponse");

const createOrder = async (req, res) => {
  const rawIdempotencyKey = req.get("Idempotency-Key");
  const idempotencyKey =
    rawIdempotencyKey !== undefined ? rawIdempotencyKey : null;

  const order =
    await orderService.createOrderFromCurrentCart(
      req.user.id,
      req.body.shippingAddressId,
      req.body.couponCode || null,
      idempotencyKey,
      req.body.deliveryOptionId || "standard"
    );

  const isReplay = Boolean(order?.isReplay);
  if (order && "isReplay" in order) {
    delete order.isReplay;
  }

  if (!isReplay) {
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
  const quote = await orderService.calculateCheckoutQuote({
    userId: req.user.id,
    shippingAddressId: req.body.shippingAddressId || null,
    couponCode: req.body.couponCode || null,
    deliveryOptionId: req.body.deliveryOptionId || "standard",
  });

  return apiResponse.sendSuccess(res, {
    message: "Checkout quote calculated successfully",
    data: quote,
  });
};

const getOrderActivity = async (req, res) => {
  const isAdmin = req.user?.role === "admin" || req.user?.roles?.includes?.("admin");
  const activity = await orderService.getOrderActivity(
    req.params.id,
    req.user.id,
    isAdmin
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
  const order =
    await orderService.getOrderById(
      req.params.id,
      req.user.id
    );

  return apiResponse.sendSuccess(res, {
    message: "Order retrieved successfully",
    data: order,
  });
};

const cancelOrder = async (req, res) => {
  const order =
    await orderService.cancelOrder(
      req.params.id,
      {
        userId: req.user.id,
        cancellationReason: req.body?.reason || req.body?.cancellationReason || "Customer requested cancellation",
      }
    );

  return apiResponse.sendSuccess(res, {
    message: "Order cancelled successfully",
    data: order,
  });
};

const cancelAdminOrder = async (req, res) => {
  const order = await orderService.cancelOrder(
    req.params.id,
    {
      userId: req.user.id || req.user._id,
      isAdmin: true,
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

module.exports = {
  createOrder,
  getCheckoutQuote,
  getOrderActivity,
  getMyOrders,
  getMyOrderById,
  cancelOrder,
  cancelAdminOrder,
  getMyVendorOrders,
  getMyVendorOrderById,
  transitionVendorOrderStatus,
  getAdminOrders,
  getAdminOrderById,
};


