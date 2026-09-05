const Refund = require("../models/Refund");

const create = async (data, options = {}) => {
  const documents = await Refund.create([data], {
    session: options.session,
  });

  return documents[0];
};

const findById = async (id, options = {}) => {
  return Refund.findById(id).session(options.session || null);
};

const findByPaymentId = async (paymentId, options = {}) => {
  return Refund.find({
    paymentId,
  })
    .session(options.session || null)
    .sort({ createdAt: -1 });
};

const findLatestByPaymentId = async (paymentId, options = {}) => {
  return Refund.findOne({
    paymentId,
  })
    .session(options.session || null)
    .sort({ createdAt: -1 });
};

const findByGatewayRefundId = async (
  gateway,
  gatewayRefundId,
  options = {}
) => {
  return Refund.findOne({
    gateway,
    gatewayRefundId,
  }).session(options.session || null);
};

const findByIdempotencyKey = async (
  gateway,
  idempotencyKey,
  options = {}
) => {
  return Refund.findOne({
    gateway,
    idempotencyKey,
  }).session(options.session || null);
};

const updateById = async (id, data, options = {}) => {
  return Refund.findByIdAndUpdate(
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
  findByPaymentId,
  findLatestByPaymentId,
  findByGatewayRefundId,
  findByIdempotencyKey,
  updateById,
};