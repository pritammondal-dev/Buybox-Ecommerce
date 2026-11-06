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

const findByGuestIdAndIdempotencyKey = async (
  guestId,
  idempotencyKey,
  options = {}
) => {
  if (!idempotencyKey || !guestId) {
    return null;
  }

  return Order.findOne({
    guestId,
    idempotencyKey,
  }).session(options.session || null);
};

const findByGuest = async (guestId, options = {}) => {
  if (!guestId) return [];
  return Order.find({
    guestId,
  })
    .session(options.session || null)
    .sort({ createdAt: -1 });
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
  const query = { _id: orderId };
  if (expectedStatus !== undefined && expectedStatus !== null) {
    if (Array.isArray(expectedStatus)) {
      query.status = { $in: expectedStatus };
    } else {
      query.status = expectedStatus;
    }
  }

  if (typeof options.expectedVersion === "number") {
    if (options.expectedVersion === 1) {
      // Legacy unversioned orders lack the 'version' field in BSON or have null/1
      query.$or = [{ version: 1 }, { version: { $exists: false } }, { version: null }];
    } else {
      query.version = options.expectedVersion;
    }
  }

  const setOps = { ...updateData };
  const pushOps = setOps.$push;
  const incOps = { ...(setOps.$inc || {}) };
  delete setOps.$push;
  delete setOps.$inc;

  if (typeof options.expectedVersion === "number") {
    // Explicitly set next version to ensure atomic bump even on unversioned documents
    setOps.version = options.expectedVersion + 1;
    delete incOps.version;
  }

  const updateOp = {
    $set: setOps,
  };

  if (Object.keys(incOps).length > 0) {
    updateOp.$inc = incOps;
  }

  if (pushOps) {
    updateOp.$push = pushOps;
  }

  return Order.findOneAndUpdate(
    query,
    updateOp,
    {
      new: true,
      runValidators: true,
      session: options.session,
    }
  );
};

const transitionOrderAtomic = async ({
  orderId,
  expectedStatus,
  expectedVersion,
  updateData = {},
  session = null,
} = {}) => {
  return transitionStatusIfCurrent(orderId, expectedStatus, updateData, {
    expectedVersion,
    session,
  });
};

const appendPaymentAttempt = async (
  orderId,
  { attempt, timelineEvent } = {},
  options = {}
) => {
  const update = {};
  if (attempt || timelineEvent) {
    update.$push = {};
    if (attempt) {
      if (!attempt.attemptNumber) {
        const existing = await Order.findById(orderId).select("paymentAttempts").lean();
        attempt.attemptNumber = (existing?.paymentAttempts?.length || 0) + 1;
      }
      update.$push.paymentAttempts = attempt;
    }
    if (timelineEvent) update.$push.timeline = timelineEvent;
  }
  return Order.findByIdAndUpdate(orderId, update, {
    new: true,
    session: options.session,
  });
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

const findAll = async ({
  filter = {},
  skip = 0,
  limit = 20,
  sort = { createdAt: -1 },
  options = {},
} = {}) => {
  const [items, total] = await Promise.all([
    Order.find(filter)
      .session(options.session || null)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("customerId", "userId firstName lastName email phone")
      .lean(),
    Order.countDocuments(filter).session(options.session || null),
  ]);

  return { items, total };
};

module.exports = {
  create,
  findById,
  findByOrderNumber,
  findByCustomer,
  findByGuest,
  findByVendor,
  findByIdAndVendor,
  findAll,
  findByCustomerIdAndIdempotencyKey,
  findByGuestIdAndIdempotencyKey,
  findEligibleForExpiration,
  transitionStatusIfCurrent,
  transitionOrderAtomic,
  updateById,
  appendPaymentAttempt,
};