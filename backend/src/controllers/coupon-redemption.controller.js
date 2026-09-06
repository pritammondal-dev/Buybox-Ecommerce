const couponRedemptionService = require("../services/coupon-redemption.service");
const apiResponse = require("../utils/apiResponse");

const redeemCoupon = async (req, res, next) => {
  try {
    const redemption =
      await couponRedemptionService.redeemCoupon(req.body);

    return apiResponse.sendSuccess(res, {
      statusCode: 201,
      message: "Coupon redeemed successfully",
      data: redemption,
    });
  } catch (error) {
    return next(error);
  }
};

const getCustomerRedemptions = async (req, res, next) => {
  try {
    const redemptions =
      await couponRedemptionService.getCustomerRedemptions(
        req.params.customerId
      );

    return apiResponse.sendSuccess(res, {
      message: "Customer coupon redemptions retrieved successfully",
      data: redemptions,
    });
  } catch (error) {
    return next(error);
  }
};

const getCouponRedemptions = async (req, res, next) => {
  try {
    const redemptions =
      await couponRedemptionService.getCouponRedemptions(
        req.params.couponId
      );

    return apiResponse.sendSuccess(res, {
      message: "Coupon redemptions retrieved successfully",
      data: redemptions,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  redeemCoupon,
  getCustomerRedemptions,
  getCouponRedemptions,
};