const Coupon = require("../models/Coupon");

const create = async (data, options = {}) => {
  const coupon = new Coupon(data);
  return coupon.save(options);
};

const findById = async (couponId, options = {}) => {
  return Coupon.findById(couponId).session(options.session || null);
};

const findByCode = async (code, options = {}) => {
  return Coupon.findOne({
    code: code.trim().toUpperCase(),
  }).session(options.session || null);
};

const findActiveByCode = async (code, options = {}) => {
  return Coupon.findOne({
    code: code.trim().toUpperCase(),
    status: "active",
    isActive: true,
  }).session(options.session || null);
};

const findMany = async (filter = {}, options = {}) => {
  return Coupon.find(filter)
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

const incrementUsage = async (couponId, options = {}) => {
  return Coupon.findOneAndUpdate(
    {
      _id: couponId,
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

module.exports = {
  create,
  findById,
  findByCode,
  findActiveByCode,
  findMany,
  updateById,
  incrementUsage,
};