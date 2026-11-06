const Coupon = require("../models/Coupon");

const create = async (data, options = {}) => {
  const coupon = new Coupon(data);
  return coupon.save(options);
};

const findById = async (couponId, options = {}) => {
  return Coupon.findOne({
    _id: couponId,
    deletedAt: null,
  }).session(options.session || null);
};

const findByCode = async (code, options = {}) => {
  return Coupon.findOne({
    code: code.trim().toUpperCase(),
    deletedAt: null,
  }).session(options.session || null);
};

const findActiveByCode = async (code, options = {}) => {
  return Coupon.findOne({
    code: code.trim().toUpperCase(),
    status: "active",
    isActive: true,
    deletedAt: null,
  }).session(options.session || null);
};

const findMany = async (filter = {}, options = {}) => {
  const effectiveFilter = { deletedAt: null, ...filter };
  return Coupon.find(effectiveFilter)
    .sort({ createdAt: -1 })
    .session(options.session || null);
};

const updateById = async (couponId, update, options = {}) => {
  return Coupon.findByIdAndUpdate(
    couponId,
    update,
    {
      new: true,
      runValidators: true,
      session: options.session,
    }
  );
};

const archiveById = async (couponId, options = {}) => {
  return Coupon.findByIdAndUpdate(
    couponId,
    {
      status: "archived",
      isActive: false,
      deletedAt: new Date(),
    },
    {
      new: true,
      session: options.session,
    }
  );
};

const incrementUsage = async (couponId, options = {}) => {
  return Coupon.findOneAndUpdate(
    {
      _id: couponId,
      deletedAt: null,
      $or: [
        { usageLimit: null },
        { usageLimit: { $exists: false } },
        { $expr: { $lt: ["$usageCount", "$usageLimit"] } },
      ],
    },
    {
      $inc: {
        usageCount: 1,
      },
    },
    {
      new: true,
      session: options.session,
    }
  );
};

const decrementUsage = async (couponId, options = {}) => {
  return Coupon.findOneAndUpdate(
    {
      _id: couponId,
      usageCount: { $gt: 0 },
    },
    {
      $inc: {
        usageCount: -1,
      },
    },
    {
      new: true,
      session: options.session,
    }
  );
};

module.exports = {
  create,
  findById,
  findByCode,
  findActiveByCode,
  findMany,
  updateById,
  archiveById,
  incrementUsage,
  decrementUsage,
};