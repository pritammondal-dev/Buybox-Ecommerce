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

const convertActiveCart = async (
  id,
  options = {}
) => {
  return Cart.findOneAndUpdate(
    {
      _id: id,
      status: "active",
    },
    {
      $set: {
        status: "converted",
        lastActivityAt: new Date(),
      },
    },
    {
      new: true,
      runValidators: true,
      session: options.session,
    }
  );
};

const deleteById = async (id, options = {}) => {
  return Cart.findByIdAndDelete(id, {
    session: options.session,
  });
};

const findLatestAbandonedByCustomer = async (
  customerId,
  storeId = null,
  options = {}
) => {
  const filter = {
    customerId,
    status: "abandoned",
    storeId,
  };

  return Cart.findOne(filter)
    .sort({ abandonedAt: -1, lastActivityAt: -1 })
    .session(options.session || null);
};

const findEligibleForAbandonment = async (
  cutoffDate,
  limit = 50,
  options = {}
) => {
  const filter = {
    status: "active",
    abandonedAt: null,
    lastActivityAt: { $lte: cutoffDate },
    "items.0": { $exists: true },
  };

  return Cart.find(filter)
    .sort({ lastActivityAt: 1 })
    .limit(limit)
    .session(options.session || null);
};

const markCartAbandoned = async (
  id,
  expectedLastActivityAt = null,
  options = {}
) => {
  const filter = {
    _id: id,
    status: "active",
  };

  if (expectedLastActivityAt instanceof Date) {
    filter.lastActivityAt = expectedLastActivityAt;
  }

  return Cart.findOneAndUpdate(
    filter,
    {
      $set: {
        status: "abandoned",
        abandonedAt: new Date(),
      },
    },
    {
      new: true,
      returnDocument: "after",
      runValidators: true,
      session: options.session,
    }
  );
};

const recoverAbandonedCart = async (
  id,
  updateData = {},
  options = {}
) => {
  return Cart.findOneAndUpdate(
    {
      _id: id,
      status: "abandoned",
    },
    {
      $set: {
        status: "active",
        recoveredAt: new Date(),
        lastActivityAt: new Date(),
        ...updateData,
      },
    },
    {
      new: true,
      returnDocument: "after",
      runValidators: true,
      session: options.session,
    }
  );
};

module.exports = {
  create,
  findById,
  findActiveByCustomer,
  findByCustomer,
  updateById,
  convertActiveCart,
  deleteById,
  findLatestAbandonedByCustomer,
  findEligibleForAbandonment,
  markCartAbandoned,
  recoverAbandonedCart,
};