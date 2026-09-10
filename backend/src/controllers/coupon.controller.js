const couponService = require("../services/coupon.service");
const Customer = require("../models/Customer");
const AppError = require("../errors/AppError");
const apiResponse = require("../utils/apiResponse");

const createCoupon = async (req, res, next) => {
  try {
    const coupon = await couponService.createCoupon(req.body);

    return apiResponse.sendSuccess(res, {
      statusCode: 201,
      message: "Coupon created successfully",
      data: coupon,
    });
  } catch (error) {
    return next(error);
  }
};

const getCouponById = async (req, res, next) => {
  try {
    const coupon = await couponService.getCouponById(
      req.params.couponId
    );

    return apiResponse.sendSuccess(res, {
      message: "Coupon retrieved successfully",
      data: coupon,
    });
  } catch (error) {
    return next(error);
  }
};

const getCoupons = async (req, res, next) => {
  try {
    const coupons = await couponService.getCoupons(req.query);

    return apiResponse.sendSuccess(res, {
      message: "Coupons retrieved successfully",
      data: coupons,
    });
  } catch (error) {
    return next(error);
  }
};

const updateCoupon = async (req, res, next) => {
  try {
    const coupon = await couponService.updateCoupon(
      req.params.couponId,
      req.body
    );

    return apiResponse.sendSuccess(res, {
      message: "Coupon updated successfully",
      data: coupon,
    });
  } catch (error) {
    return next(error);
  }
};

const activateCoupon = async (req, res, next) => {
  try {
    const coupon = await couponService.activateCoupon(
      req.params.couponId
    );

    return apiResponse.sendSuccess(res, {
      message: "Coupon activated successfully",
      data: coupon,
    });
  } catch (error) {
    return next(error);
  }
};

const deactivateCoupon = async (req, res, next) => {
  try {
    const coupon = await couponService.deactivateCoupon(
      req.params.couponId
    );

    return apiResponse.sendSuccess(res, {
      message: "Coupon deactivated successfully",
      data: coupon,
    });
  } catch (error) {
    return next(error);
  }
};

const validateCoupon = async (req, res, next) => {
  try {
    let customerId = req.body.customerId;

    if (req.user) {
      const customer = await Customer.findOne({
        userId: req.user.id,
        isActive: true,
        deletedAt: null,
      });

      if (customer) {
        if (customerId && customerId.toString() !== customer._id.toString()) {
          throw new AppError(
            "You can only validate coupons for your own account",
            403,
            "COUPON_ACCESS_DENIED"
          );
        }
        customerId = customer._id;
      }
    }

    const result = await couponService.validateCoupon({
      ...req.body,
      customerId,
    });

    return apiResponse.sendSuccess(res, {
      message: "Coupon validated successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createCoupon,
  getCouponById,
  getCoupons,
  updateCoupon,
  activateCoupon,
  deactivateCoupon,
  validateCoupon,
};