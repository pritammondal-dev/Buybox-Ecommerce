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
      idempotencyKey
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
      }
    );

  return apiResponse.sendSuccess(res, {
    message: "Order cancelled successfully",
    data: order,
  });
};

module.exports = {
  createOrder,
  getMyOrders,
  getMyOrderById,
  cancelOrder,
};
