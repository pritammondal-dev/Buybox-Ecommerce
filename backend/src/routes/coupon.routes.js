const express = require("express");

const couponController = require("../controllers/coupon.controller");
const authenticate = require("../middlewares/authentication.middleware");
const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");
const { PERMISSIONS } = require("../constants/permissions.constants");

const {
  createCouponSchema,
  updateCouponSchema,
  validateCouponSchema,
} = require("../validators/marketing/coupon.validator");

const validate = require("../middlewares/validate.middleware");

const router = express.Router();

router.use(authenticate);

// Read coupon data
router.get(
  "/",
  requirePermissions(PERMISSIONS.COUPONS_READ),
  couponController.getCoupons
);

router.get(
  "/:couponId",
  requirePermissions(PERMISSIONS.COUPONS_READ),
  couponController.getCouponById
);

// Create coupon
router.post(
  "/",
  requirePermissions(PERMISSIONS.COUPONS_MANAGE),
  validate(createCouponSchema),
  couponController.createCoupon
);

// Update coupon
router.patch(
  "/:couponId",
  requirePermissions(PERMISSIONS.COUPONS_MANAGE),
  validate(updateCouponSchema),
  couponController.updateCoupon
);

// Activate coupon
router.patch(
  "/:couponId/activate",
  requirePermissions(PERMISSIONS.COUPONS_MANAGE),
  couponController.activateCoupon
);

// Deactivate coupon
router.patch(
  "/:couponId/deactivate",
  requirePermissions(PERMISSIONS.COUPONS_MANAGE),
  couponController.deactivateCoupon
);

// Customer-facing coupon validation
router.post(
  "/validate",
  validate(validateCouponSchema),
  couponController.validateCoupon
);

module.exports = router;
