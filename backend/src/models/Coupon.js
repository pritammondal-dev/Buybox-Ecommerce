const mongoose = require("mongoose");

const {
  COUPON_TYPES,
  COUPON_STATUSES,
  COUPON_SCOPE_TYPES,
} = require("../constants/coupon.constants");

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      minlength: 3,
      maxlength: 50,
      index: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },

    type: {
      type: String,
      required: true,
      enum: Object.values(COUPON_TYPES),
    },

    value: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },

    maxDiscountAmount: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
    },

    minOrderAmount: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },

    status: {
      type: String,
      required: true,
      enum: Object.values(COUPON_STATUSES),
      default: COUPON_STATUSES.ACTIVE,
      index: true,
    },

    startsAt: {
      type: Date,
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    scope: {
      type: String,
      required: true,
      enum: Object.values(COUPON_SCOPE_TYPES),
      default: COUPON_SCOPE_TYPES.ALL,
    },

    productIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],

    categoryIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],

    vendorIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Vendor",
      },
    ],

    usageLimit: {
      type: Number,
      min: 1,
      default: null,
    },

    usageCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    perCustomerLimit: {
      type: Number,
      min: 1,
      default: 1,
    },

    firstOrderOnly: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    metadata: {
      type: Map,
      of: String,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

couponSchema.index({
  status: 1,
  isActive: 1,
  startsAt: 1,
  expiresAt: 1,
});

couponSchema.pre("validate", function validateCoupon() {
  if (this.expiresAt <= this.startsAt) {
    throw new Error("Coupon expiry must be after start date");
  }

  const value = Number(this.value?.toString());

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Coupon value must be greater than zero");
  }

  const minOrderAmount = Number(this.minOrderAmount?.toString() || 0);

  if (!Number.isFinite(minOrderAmount) || minOrderAmount < 0) {
    throw new Error("Minimum order amount cannot be negative");
  }

  if (
    this.type === COUPON_TYPES.PERCENTAGE &&
    (value <= 0 || value > 100)
  ) {
    throw new Error("Percentage coupon value must be between 0 and 100");
  }

  if (
    this.scope === COUPON_SCOPE_TYPES.PRODUCTS &&
    this.productIds.length === 0
  ) {
    throw new Error("Product coupon must contain at least one product");
  }

  if (
    this.scope === COUPON_SCOPE_TYPES.CATEGORIES &&
    this.categoryIds.length === 0
  ) {
    throw new Error("Category coupon must contain at least one category");
  }

  if (
    this.scope === COUPON_SCOPE_TYPES.VENDORS &&
    this.vendorIds.length === 0
  ) {
    throw new Error("Vendor coupon must contain at least one vendor");
  }

  if (
    this.usageLimit !== null &&
    this.usageLimit !== undefined &&
    this.usageCount > this.usageLimit
  ) {
    throw new Error("Coupon usage count cannot exceed usage limit");
  }
});

const Coupon = mongoose.model("Coupon", couponSchema);

module.exports = Coupon;
module.exports.Coupon = Coupon;