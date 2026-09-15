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

const findByVendor = async ({
  vendorId,
  filter = {},
  skip = 0,
  limit = 20,
  sort = { createdAt: -1 },
  options = {},
} = {}) => {
  const query = {
    "items.vendorId": vendorId,
    ...filter,
  };

  const [items, total] = await Promise.all([
    Order.find(query)
      .session(options.session || null)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Order.countDocuments(query).session(options.session || null),
  ]);

  return { items, total };
};

const findByIdAndVendor = async (orderId, vendorId, options = {}) => {
  return Order.findOne({
    _id: orderId,
    "items.vendorId": vendorId,
  })
    .session(options.session || null)
    .lean();
};

module.exports = {
  create,
  findById,
  findByOrderNumber,
  findByCustomer,
  findByVendor,
  findByIdAndVendor,
  findByCustomerIdAndIdempotencyKey,
  findEligibleForExpiration,
  transitionStatusIfCurrent,
  updateById,
};