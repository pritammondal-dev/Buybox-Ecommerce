const express = require("express");

const couponRedemptionController = require("../controllers/coupon-redemption.controller");
const authenticate = require("../middlewares/authentication.middleware");
const { requirePermissions } = require("../middlewares/authorization.middleware");
const { PERMISSIONS } = require("../constants/permissions.constants");

const {
  redeemCouponSchema,
  getCustomerRedemptionsSchema,
} = require("../validators/marketing/coupon-redemption.validator");

const validate = require("../middlewares/validate.middleware");

const router = express.Router();

router.use(authenticate);

router.post(
  "/",
  requirePermissions(PERMISSIONS.COUPONS_MANAGE),
  validate(redeemCouponSchema),
  couponRedemptionController.redeemCoupon
);

router.get(
  "/customer/:customerId",
  requirePermissions(PERMISSIONS.COUPONS_READ),
  validate(getCustomerRedemptionsSchema, "params"),
  couponRedemptionController.getCustomerRedemptions
);

router.get(
  "/coupon/:couponId",
  requirePermissions(PERMISSIONS.COUPONS_READ),
  couponRedemptionController.getCouponRedemptions
);

module.exports = router;