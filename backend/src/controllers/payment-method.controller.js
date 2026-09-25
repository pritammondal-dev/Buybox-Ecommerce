const paymentMethodService = require("../services/payment-method.service");
const apiResponse = require("../utils/apiResponse");

const getAvailablePaymentMethods = async (req, res) => {
  const methods = await paymentMethodService.getAvailablePaymentMethods({
    country: req.query.country,
    currency: req.query.currency,
    orderAmount: req.query.orderAmount,
    orderId: req.query.orderId,
  });

  return apiResponse.sendSuccess(res, {
    message: "Available payment methods retrieved successfully",
    data: methods,
  });
};

const listAllPaymentMethods = async (req, res) => {
  const methods = await paymentMethodService.listAllPaymentMethods({
    search: req.query.search,
    status: req.query.status,
    gateway: req.query.gateway,
  });

  return apiResponse.sendSuccess(res, {
    message: "Payment methods retrieved successfully",
    data: methods,
  });
};

const getPaymentMethodById = async (req, res) => {
  const method = await paymentMethodService.getPaymentMethodById(req.params.id);

  return apiResponse.sendSuccess(res, {
    message: "Payment method retrieved successfully",
    data: method,
  });
};

const createPaymentMethod = async (req, res) => {
  const method = await paymentMethodService.createPaymentMethod(
    req.body,
    req.user?.id
  );

  return apiResponse.sendSuccess(res, {
    statusCode: 201,
    message: "Payment method created successfully",
    data: method,
  });
};

const updatePaymentMethod = async (req, res) => {
  const method = await paymentMethodService.updatePaymentMethod(
    req.params.id,
    req.body,
    req.user?.id
  );

  return apiResponse.sendSuccess(res, {
    message: "Payment method updated successfully",
    data: method,
  });
};

const togglePaymentMethod = async (req, res) => {
  const method = await paymentMethodService.togglePaymentMethodStatus(
    req.params.id,
    req.user?.id
  );

  return apiResponse.sendSuccess(res, {
    message: `Payment method ${method.enabled ? "activated" : "deactivated"} successfully`,
    data: method,
  });
};

const deletePaymentMethod = async (req, res) => {
  const result = await paymentMethodService.deletePaymentMethod(
    req.params.id,
    req.user?.id
  );

  return apiResponse.sendSuccess(res, {
    message: result.message,
    data: result,
  });
};

const reorderPaymentMethods = async (req, res) => {
  const methods = await paymentMethodService.reorderPaymentMethods(
    req.body.orderedIds,
    req.user?.id
  );

  return apiResponse.sendSuccess(res, {
    message: "Payment methods reordered successfully",
    data: methods,
  });
};

const getMyPaymentMethods = async (req, res) => {
  const methods = await paymentMethodService.getMyPaymentMethods(req.user.id);
  return apiResponse.sendSuccess(res, {
    message: "Customer payment methods retrieved successfully",
    data: methods,
  });
};

const saveCustomerPaymentMethod = async (req, res) => {
  const method = await paymentMethodService.saveCustomerPaymentMethod(
    req.user.id,
    req.body
  );
  return apiResponse.sendSuccess(res, {
    statusCode: 201,
    message: "Payment method saved successfully",
    data: method,
  });
};

const setDefaultPaymentMethod = async (req, res) => {
  const result = await paymentMethodService.setDefaultPaymentMethod(
    req.user.id,
    req.params.id
  );
  return apiResponse.sendSuccess(res, {
    message: result.message,
    data: result,
  });
};

const deleteCustomerPaymentMethod = async (req, res) => {
  const result = await paymentMethodService.deleteCustomerPaymentMethod(
    req.user.id,
    req.params.id
  );
  return apiResponse.sendSuccess(res, {
    message: result.message,
    data: result,
  });
};

module.exports = {
  getAvailablePaymentMethods,
  listAllPaymentMethods,
  getPaymentMethodById,
  createPaymentMethod,
  updatePaymentMethod,
  togglePaymentMethod,
  deletePaymentMethod,
  reorderPaymentMethods,
  getMyPaymentMethods,
  saveCustomerPaymentMethod,
  setDefaultPaymentMethod,
  deleteCustomerPaymentMethod,
};
