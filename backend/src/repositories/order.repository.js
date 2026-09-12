const Order = require("../models/Order");

const create = async (data, options = {}) => {
  const documents = await Order.create([data], {
    session: options.session,
  });

  return documents[0];
};

const findById = async (id, options = {}) => {
  return Order.findById(id).session(options.session || null);
};

const findByOrderNumber = async (orderNumber, options = {}) => {
  return Order.findOne({ orderNumber }).session(
    options.session || null
  );
};

const findByCustomer = async (customerId, options = {}) => {
  return Order.find({
    customerId,
  })
    .session(options.session || null)
    .sort({ createdAt: -1 });
};

const updateById = async (id, data, options = {}) => {
  return Order.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
    session: options.session,
  });
};

const findByCustomerIdAndIdempotencyKey = async (
  customerId,
  idempotencyKey,
  options = {}
) => {
  if (!idempotencyKey) {
    return null;
  }

  return Order.findOne({
    customerId,
    idempotencyKey,
  }).session(options.session || null);
};

const findEligibleForExpiration = async (
  { cutoffDate, limit = 50 } = {},
  options = {}
) => {
  return Order.find({
    status: "pending",
    inventoryStatus: {
      $in: ["reserved", "partially_released"],
    },
    createdAt: {
      $lte: cutoffDate,
    },
  })
    .session(options.session || null)
    .sort({ createdAt: 1 })
    .limit(limit);
};

const transitionStatusIfCurrent = async (
  orderId,
  expectedStatus,
  updateData,
  options = {}
) => {
  return Order.findOneAndUpdate(
    {
      _id: orderId,
      status: expectedStatus,
    },
    {
      $set: updateData,
    },
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
  findByOrderNumber,
  findByCustomer,
  findByCustomerIdAndIdempotencyKey,
  findEligibleForExpiration,
  transitionStatusIfCurrent,
  updateById,
};