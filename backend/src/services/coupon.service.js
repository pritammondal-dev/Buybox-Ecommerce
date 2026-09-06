const mongoose = require("mongoose");

const couponRepository = require("../repositories/coupon.repository");
const AppError = require("../errors/AppError");

const {
  COUPON_TYPES,
  COUPON_STATUSES,
  COUPON_SCOPE_TYPES,
} = require("../constants/coupon.constants");

const toDecimalString = (value) => {
  if (value === undefined || value === null) {
    return "0.00";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new AppError(
      "Invalid monetary value",
      400,
      "INVALID_MONETARY_VALUE"
    );
  }

  return number.toFixed(2);
};

const normalizeCode = (code) => {
  if (!code || typeof code !== "string") {
    throw new AppError(
      "Coupon code is required",
      400,
      "INVALID_COUPON_CODE"
    );
  }

  return code.trim().toUpperCase();
};

const generateCouponCode = (prefix = "BB") => {
  const random = Math.random()
    .toString(36)
    .substring(2, 10)
    .toUpperCase();

  return `${prefix}-${random}`;
};

const createCoupon = async (data) => {
  const code = normalizeCode(data.code);

  const existing =
    await couponRepository.findByCode(code);

  if (existing) {
    throw new AppError(
      "Coupon code already exists",
      409,
      "COUPON_CODE_EXISTS"
    );
  }

  const coupon =
    await couponRepository.create({
      ...data,
      code,
      value: toDecimalString(data.value),
      maxDiscountAmount:
        data.maxDiscountAmount !== undefined &&
        data.maxDiscountAmount !== null
          ? toDecimalString(
              data.maxDiscountAmount
            )
          : null,
      minOrderAmount: toDecimalString(
        data.minOrderAmount || 0
      ),
    });

  return coupon;
};

const getCouponById = async (couponId) => {
  if (!mongoose.isValidObjectId(couponId)) {
    throw new AppError(
      "Invalid coupon ID",
      400,
      "INVALID_COUPON_ID"
    );
  }

  const coupon =
    await couponRepository.findById(
      couponId
    );

  if (!coupon) {
    throw new AppError(
      "Coupon not found",
      404,
      "COUPON_NOT_FOUND"
    );
  }

  return coupon;
};

const getCoupons = async (filter = {}) => {
  return couponRepository.findMany(filter);
};

const updateCoupon = async (
  couponId,
  data
) => {
  if (!mongoose.isValidObjectId(couponId)) {
    throw new AppError(
      "Invalid coupon ID",
      400,
      "INVALID_COUPON_ID"
    );
  }

  const coupon =
    await couponRepository.findById(
      couponId
    );

  if (!coupon) {
    throw new AppError(
      "Coupon not found",
      404,
      "COUPON_NOT_FOUND"
    );
  }

  const update = { ...data };

  if (update.code !== undefined) {
    update.code =
      normalizeCode(update.code);

    const existing =
      await couponRepository.findByCode(
        update.code
      );

    if (
      existing &&
      existing._id.toString() !==
        coupon._id.toString()
    ) {
      throw new AppError(
        "Coupon code already exists",
        409,
        "COUPON_CODE_EXISTS"
      );
    }
  }

  if (update.value !== undefined) {
    update.value =
      toDecimalString(update.value);
  }

  if (
    update.maxDiscountAmount !== undefined
  ) {
    update.maxDiscountAmount =
      update.maxDiscountAmount === null
        ? null
        : toDecimalString(
            update.maxDiscountAmount
          );
  }

  if (
    update.minOrderAmount !== undefined
  ) {
    update.minOrderAmount =
      toDecimalString(
        update.minOrderAmount
      );
  }

  return couponRepository.updateById(
    couponId,
    update
  );
};

const deactivateCoupon = async (
  couponId
) => {
  return updateCoupon(couponId, {
    status: COUPON_STATUSES.INACTIVE,
    isActive: false,
  });
};

const activateCoupon = async (
  couponId
) => {
  return updateCoupon(couponId, {
    status: COUPON_STATUSES.ACTIVE,
    isActive: true,
  });
};

/**
 * Validate a coupon against authoritative checkout data.
 *
 * `lineTotal` is already quantity-inclusive.
 * Therefore quantity MUST NOT be multiplied again.
 */
const validateCoupon = async ({
  code,
  customerId,
  orderAmount,
  items = [],
  isFirstOrder = false,
}) => {
  const normalizedCode =
    normalizeCode(code);

  const coupon =
    await couponRepository.findActiveByCode(
      normalizedCode
    );

  if (!coupon) {
    throw new AppError(
      "Coupon is invalid or inactive",
      400,
      "INVALID_COUPON"
    );
  }

  const now = new Date();

  if (now < coupon.startsAt) {
    throw new AppError(
      "Coupon is not active yet",
      400,
      "COUPON_NOT_STARTED"
    );
  }

  if (now > coupon.expiresAt) {
    throw new AppError(
      "Coupon has expired",
      400,
      "COUPON_EXPIRED"
    );
  }

  const amount = Number(orderAmount);

  if (
    !Number.isFinite(amount) ||
    amount < 0
  ) {
    throw new AppError(
      "Invalid order amount",
      400,
      "INVALID_ORDER_AMOUNT"
    );
  }

  const minimum =
    Number(
      coupon.minOrderAmount.toString()
    );

  if (amount < minimum) {
    throw new AppError(
      `Minimum order amount for this coupon is ${minimum.toFixed(
        2
      )}`,
      400,
      "MIN_ORDER_AMOUNT_NOT_MET"
    );
  }

  if (
    coupon.usageLimit !== null &&
    coupon.usageLimit !== undefined &&
    coupon.usageCount >=
      coupon.usageLimit
  ) {
    throw new AppError(
      "Coupon usage limit has been reached",
      400,
      "COUPON_USAGE_LIMIT_REACHED"
    );
  }

  if (
    coupon.firstOrderOnly &&
    !isFirstOrder
  ) {
    throw new AppError(
      "Coupon is valid only for first orders",
      400,
      "FIRST_ORDER_ONLY"
    );
  }

  if (
    !mongoose.isValidObjectId(
      customerId
    )
  ) {
    throw new AppError(
      "Invalid customer ID",
      400,
      "INVALID_CUSTOMER_ID"
    );
  }

  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    throw new AppError(
      "Order items are required",
      400,
      "ORDER_ITEMS_REQUIRED"
    );
  }

  const eligibleItems =
    items.filter((item) => {
      if (
        coupon.scope ===
        COUPON_SCOPE_TYPES.ALL
      ) {
        return true;
      }

      if (
        coupon.scope ===
        COUPON_SCOPE_TYPES.PRODUCTS
      ) {
        return coupon.productIds.some(
          (id) =>
            id.toString() ===
            String(item.productId)
        );
      }

      if (
        coupon.scope ===
        COUPON_SCOPE_TYPES.CATEGORIES
      ) {
        return coupon.categoryIds.some(
          (id) =>
            id.toString() ===
            String(item.categoryId)
        );
      }

      if (
        coupon.scope ===
        COUPON_SCOPE_TYPES.VENDORS
      ) {
        return coupon.vendorIds.some(
          (id) =>
            id.toString() ===
            String(item.vendorId)
        );
      }

      return false;
    });

  if (
    eligibleItems.length === 0
  ) {
    throw new AppError(
      "Coupon does not apply to the selected items",
      400,
      "COUPON_SCOPE_MISMATCH"
    );
  }

  /*
   * IMPORTANT:
   * orderItem.lineTotal already contains:
   *
   * unitPrice × quantity
   *
   * Do NOT multiply by quantity again.
   */
  let eligibleAmount =
    eligibleItems.reduce(
      (total, item) => {
        const lineTotal =
          Number(
            item.lineTotal ??
              item.price ??
              0
          );

        if (
          !Number.isFinite(lineTotal) ||
          lineTotal < 0
        ) {
          throw new AppError(
            "Invalid eligible item amount",
            400,
            "INVALID_ELIGIBLE_ITEM_AMOUNT"
          );
        }

        return total + lineTotal;
      },
      0
    );

  if (
    !Number.isFinite(
      eligibleAmount
    ) ||
    eligibleAmount <= 0
  ) {
    throw new AppError(
      "No eligible order value found",
      400,
      "NO_ELIGIBLE_AMOUNT"
    );
  }

  let discount;

  if (
    coupon.type ===
    COUPON_TYPES.PERCENTAGE
  ) {
    discount =
      (eligibleAmount *
        Number(
          coupon.value.toString()
        )) /
      100;
  } else {
    discount =
      Number(
        coupon.value.toString()
      );
  }

  if (
    coupon.maxDiscountAmount !==
      null &&
    coupon.maxDiscountAmount !==
      undefined
  ) {
    discount = Math.min(
      discount,
      Number(
        coupon.maxDiscountAmount.toString()
      )
    );
  }

  discount = Math.min(
    discount,
    eligibleAmount
  );

  return {
    coupon,
    eligibleAmount:
      eligibleAmount.toFixed(2),
    discountAmount:
      discount.toFixed(2),
    finalOrderAmount:
      Math.max(
        0,
        amount - discount
      ).toFixed(2),
  };
};

const redeemCoupon = async (
  couponId,
  options = {}
) => {
  if (!mongoose.isValidObjectId(couponId)) {
    throw new AppError(
      "Invalid coupon ID",
      400,
      "INVALID_COUPON_ID"
    );
  }

  const coupon =
    await couponRepository.incrementUsage(
      couponId,
      options
    );

  if (!coupon) {
    throw new AppError(
      "Coupon usage limit has been reached",
      409,
      "COUPON_USAGE_LIMIT_REACHED"
    );
  }

  return coupon;
};

module.exports = {
  createCoupon,
  getCouponById,
  getCoupons,
  updateCoupon,
  activateCoupon,
  deactivateCoupon,
  validateCoupon,
  redeemCoupon,
  generateCouponCode,
};

