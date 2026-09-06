const COUPON_TYPES = Object.freeze({
  PERCENTAGE: "percentage",
  FIXED: "fixed",
});

const COUPON_STATUSES = Object.freeze({
  ACTIVE: "active",
  INACTIVE: "inactive",
  EXPIRED: "expired",
});

const COUPON_SCOPE_TYPES = Object.freeze({
  ALL: "all",
  PRODUCTS: "products",
  CATEGORIES: "categories",
  VENDORS: "vendors",
});

const COUPON_DISCOUNT_LIMITS = Object.freeze({
  MIN_PERCENTAGE: 0.01,
  MAX_PERCENTAGE: 100,
});

module.exports = {
  COUPON_TYPES,
  COUPON_STATUSES,
  COUPON_SCOPE_TYPES,
  COUPON_DISCOUNT_LIMITS,
};