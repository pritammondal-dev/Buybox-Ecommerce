const express = require("express");
const couponController = require("../controllers/coupon.controller");

const router = express.Router();

// Public storefront active coupons
router.get("/active", couponController.getActiveCoupons);

module.exports = router;
