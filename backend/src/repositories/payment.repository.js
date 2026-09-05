const Payment = require("../models/Payment");

const create = async (data, options = {}) => {
  const documents = await Payment.create([data], {
    session: options.session,
  });

  return documents[0];
};

const findById = async (id, options = {}) => {
  return Payment.findById(id).session(
    options.session || null
  );
};

const findByOrderId = async (
  orderId,
  options = {}
) => {
  return Payment.find({
    orderId,
  })
    .session(options.session || null)
    .sort({
      createdAt: -1,
    });
};

const findLatestByOrderId = async (
  orderId,
  options = {}
) => {
  return Payment.findOne({
    orderId,
  })
    .session(options.session || null)
    .sort({
      createdAt: -1,
    });
};

const findByGatewayOrderId = async (
  gateway,
  gatewayOrderId,
  options = {}
) => {
  return Payment.findOne({
    gateway,
    gatewayOrderId,
  }).session(options.session || null);
};

const findByGatewayPaymentId = async (
  gateway,
  gatewayPaymentId,
  options = {}
) => {
  return Payment.findOne({
    gateway,
    gatewayPaymentId,
  }).session(options.session || null);
};

const findByIdempotencyKey = async (
  gateway,
  idempotencyKey,
  options = {}
) => {
  return Payment.findOne({
    gateway,
    idempotencyKey,
  }).session(options.session || null);
};

const updateById = async (
  id,
  data,
  options = {}
) => {
  return Payment.findByIdAndUpdate(
    id,
    data,
    {
      new: true,
      runValidators: true,
      session: options.session,
    }
  );
};

module.exports = {
  create,
  findById,
  findByOrderId,
  findLatestByOrderId,
  findByGatewayOrderId,
  findByGatewayPaymentId,
  findByIdempotencyKey,
  updateById,
};