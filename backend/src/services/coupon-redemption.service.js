const mongoose = require("mongoose");

const couponRepository = require("../repositories/coupon.repository");
const couponRedemptionRepository = require("../repositories/coupon-redemption.repository");
const AppError = require("../errors/AppError");

const redeemCoupon = async ({
  couponId,
  customerId,
  orderId,
  session = null,
}) => {
  if (!mongoose.isValidObjectId(couponId)) {
    throw new AppError(
      "Invalid coupon ID",
      400,
      "INVALID_COUPON_ID"
    );
  }

  if (!mongoose.isValidObjectId(customerId)) {
    throw new AppError(
      "Invalid customer ID",
      400,
      "INVALID_CUSTOMER_ID"
    );
  }

  if (!mongoose.isValidObjectId(orderId)) {
    throw new AppError(
      "Invalid order ID",
      400,
      "INVALID_ORDER_ID"
    );
  }

  const coupon =
    await couponRepository.findById(
      couponId,
      { session }
    );

  if (!coupon) {
    throw new AppError(
      "Coupon not found",
      404,
      "COUPON_NOT_FOUND"
    );
  }

  if (
    !coupon.isActive ||
    coupon.status !== "active"
  ) {
    throw new AppError(
      "Coupon is inactive",
      400,
      "COUPON_INACTIVE"
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

  /*
   * An order can only have one coupon redemption.
   */
  const existingOrderRedemption =
    await couponRedemptionRepository.findByOrderId(
      orderId,
      { session }
    );

  if (existingOrderRedemption) {
    if (
      existingOrderRedemption.couponId.toString() ===
      couponId.toString()
    ) {
      return existingOrderRedemption;
    }

    throw new AppError(
      "Order already has a coupon redemption",
      409,
      "ORDER_COUPON_ALREADY_REDEEMED"
    );
  }

  /*
   * Check this customer's previous usage.
   */
  const currentCount =
    await couponRedemptionRepository.countByCouponAndCustomer(
      couponId,
      customerId,
      { session }
    );

  if (
    coupon.perCustomerLimit !== null &&
    coupon.perCustomerLimit !== undefined &&
    currentCount >= coupon.perCustomerLimit
  ) {
    throw new AppError(
      "Customer coupon usage limit has been reached",
      409,
      "CUSTOMER_COUPON_LIMIT_REACHED"
    );
  }

  /*
   * Atomically consume one global coupon usage.
   *
   * If the limit is reached, the repository returns null.
   * Because this runs inside the checkout transaction,
   * any redemption changes are rolled back as well.
   */
  const updatedCoupon =
    await couponRepository.incrementUsage(
      couponId,
      { session }
    );

  if (!updatedCoupon) {
    throw new AppError(
      "Coupon usage limit has been reached",
      409,
      "COUPON_USAGE_LIMIT_REACHED"
    );
  }

  /*
   * Record the redemption linked specifically to this order.
   */
  try {
    const redemption =
      await couponRedemptionRepository.create(
        {
          couponId,
          customerId,
          orderId,
          redemptionCount: 1,
        },
        { session }
      );

    return redemption;
  } catch (error) {
    /*
     * Duplicate key on orderId means this order already redeemed.
     */
    if (error?.code === 11000) {
      throw new AppError(
        "Order already has a coupon redemption",
        409,
        "ORDER_COUPON_ALREADY_REDEEMED"
      );
    }

    throw error;
  }
};

const getCustomerRedemptions = async (
  customerId
) => {
  if (!mongoose.isValidObjectId(customerId)) {
    throw new AppError(
      "Invalid customer ID",
      400,
      "INVALID_CUSTOMER_ID"
    );
  }

  return couponRedemptionRepository.findByCustomerId(
    customerId
  );
};

const getCouponRedemptions = async (
  couponId
) => {
  if (!mongoose.isValidObjectId(couponId)) {
    throw new AppError(
      "Invalid coupon ID",
      400,
      "INVALID_COUPON_ID"
    );
  }

  return couponRedemptionRepository.findByCouponId(
    couponId
  );
};

module.exports = {
  redeemCoupon,
  getCustomerRedemptions,
  getCouponRedemptions,
};
