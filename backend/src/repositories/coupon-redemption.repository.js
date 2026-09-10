const CouponRedemption = require("../models/CouponRedemption");

const create = async (data, options = {}) => {
  const redemption = new CouponRedemption(data);
  return redemption.save(options);
};

const findByCouponAndCustomer = async (
  couponId,
  customerId,
  options = {}
) => {
  return CouponRedemption.findOne({
    couponId,
    customerId,
  }).session(options.session || null);
};

const findByOrderId = async (orderId, options = {}) => {
  return CouponRedemption.findOne({
    orderId,
  }).session(options.session || null);
};

const findByCouponId = async (couponId, options = {}) => {
  return CouponRedemption.find({
    couponId,
  })
    .sort({ redeemedAt: -1 })
    .session(options.session || null);
};

const findByCustomerId = async (customerId, options = {}) => {
  return CouponRedemption.find({
    customerId,
  })
    .sort({ redeemedAt: -1 })
    .session(options.session || null);
};

const incrementRedemptionCount = async (
  couponId,
  customerId,
  options = {}
) => {
  return CouponRedemption.findOneAndUpdate(
    {
      couponId,
      customerId,
    },
    {
      $inc: {
        redemptionCount: 1,
      },
    },
    {
      new: true,
      session: options.session,
    }
  );
};

const countByCouponAndCustomer = async (
  couponId,
  customerId,
  options = {}
) => {
  return CouponRedemption.countDocuments({
    couponId,
    customerId,
  }).session(options.session || null);
};

const deleteByOrderId = async (orderId, options = {}) => {
  return CouponRedemption.findOneAndDelete({
    orderId,
  }).session(options.session || null);
};

module.exports = {
  create,
  findByCouponAndCustomer,
  findByOrderId,
  findByCouponId,
  findByCustomerId,
  incrementRedemptionCount,
  countByCouponAndCustomer,
  deleteByOrderId,
};