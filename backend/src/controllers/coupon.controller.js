const couponService = require("../services/coupon.service");
const Customer = require("../models/Customer");
const Coupon = require("../models/Coupon");
const AppError = require("../errors/AppError");
const apiResponse = require("../utils/apiResponse");
const { isFeatureEnabled } = require("../services/storefront-settings.service");

const createCoupon = async (req, res, next) => {
  try {
    const coupon = await couponService.createCoupon({
      ...req.body,
      actorId: req.user?.id,
    });

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
      {
        ...req.body,
        actorId: req.user?.id,
      }
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
      req.params.couponId,
      req.user?.id
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
      req.params.couponId,
      req.user?.id
    );

    return apiResponse.sendSuccess(res, {
      message: "Coupon deactivated successfully",
      data: coupon,
    });
  } catch (error) {
    return next(error);
  }
};

const deleteCoupon = async (req, res, next) => {
  try {
    const coupon = await couponService.deleteCoupon(
      req.params.couponId,
      req.user?.id
    );

    return apiResponse.sendSuccess(res, {
      message: "Coupon archived successfully",
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

const getActiveCoupons = async (req, res, next) => {
  try {
    const couponsEnabled = await isFeatureEnabled("coupons");
    if (!couponsEnabled) {
      return apiResponse.sendSuccess(res, {
        message: "Coupons feature currently disabled",
        data: [],
      });
    }

    const now = new Date();
    const coupons = await Coupon.find({
      status: "active",
      isActive: true,
      deletedAt: null,
      startsAt: { $lte: now },
      expiresAt: { $gte: now },
    })
      .select("code description type value minOrderAmount maxDiscountAmount scope startsAt expiresAt usageLimit usageCount perCustomerLimit")
      .sort({ createdAt: -1 })
      .lean();

    const formatted = coupons.map((c) => {
      const valStr = c.value?.toString() || "0";
      const minStr = c.minOrderAmount?.toString() || "0";
      const maxStr = c.maxDiscountAmount?.toString() || null;

      return {
        ...c,
        value: valStr,
        discountValue: Number(valStr),
        discountAmount: valStr,
        discountType: c.type,
        minOrderAmount: Number(minStr),
        maxDiscount: maxStr ? Number(maxStr) : null,
        maxDiscountAmount: maxStr,
        validUntil: c.expiresAt,
        title: c.code,
      };
    });

    return apiResponse.sendSuccess(res, {
      message: "Active coupons retrieved successfully",
      data: formatted,
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
  deleteCoupon,
  validateCoupon,
  getActiveCoupons,
};