const Cart = require("../models/Cart");

const create = async (data, options = {}) => {
  const documents = await Cart.create([data], {
    session: options.session,
  });

  return documents[0];
};

const findById = async (id, options = {}) => {
  return Cart.findById(id).session(options.session || null);
};

const findActiveByCustomer = async (customerId, storeId = null, options = {}) => {
  const filter = {
    customerId,
    status: "active",
    storeId,
  };

  return Cart.findOne(filter).session(options.session || null);
};

const findByCustomer = async (customerId, options = {}) => {
  return Cart.find({
    customerId,
  })
    .session(options.session || null)
    .sort({ createdAt: -1 });
};

const updateById = async (id, data, options = {}) => {
  return Cart.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
    session: options.session,
  });
};

const deleteById = async (id, options = {}) => {
  return Cart.findByIdAndDelete(id, {
    session: options.session,
  });
};

module.exports = {
  create,
  findById,
  findActiveByCustomer,
  findByCustomer,
  updateById,
  deleteById,
};