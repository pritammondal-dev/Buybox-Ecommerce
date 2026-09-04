const orderService = require("../services/order.service");
const apiResponse = require("../utils/apiResponse");

const createOrder = async (req, res) => {
  const order = await orderService.createOrderFromCurrentCart(
    req.user.id,
    req.body.shippingAddressId
  );

  return apiResponse.sendSuccess(res, {
    statusCode: 201,
    message: "Order created successfully",
    data: order,
  });
};

const getMyOrders = async (req, res) => {
  const orders = await orderService.getCustomerOrders(
    req.user.id
  );

  return apiResponse.sendSuccess(res, {
    message: "Orders retrieved successfully",
    data: orders,
  });
};

const getMyOrderById = async (req, res) => {
  const order = await orderService.getOrderById(
    req.params.id,
    req.user.id
  );

  return apiResponse.sendSuccess(res, {
    message: "Order retrieved successfully",
    data: order,
  });
};

module.exports = {
  createOrder,
  getMyOrders,
  getMyOrderById,
};