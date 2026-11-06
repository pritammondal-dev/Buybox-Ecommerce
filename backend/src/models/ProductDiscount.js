const mongoose = require("mongoose");
const {
  DISCOUNT_TYPES,
  DISCOUNT_STATUSES,
  DISCOUNT_SCOPES,
  FUNDING_SOURCES,
} = require("../constants/promotion.constants");

const productDiscountSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      index: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },

    discountType: {
      type: String,
      required: true,
      enum: Object.values(DISCOUNT_TYPES),
    },

    value: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },

    scope: {
      type: String,
      required: true,
      enum: Object.values(DISCOUNT_SCOPES),
      default: DISCOUNT_SCOPES.ALL,
      index: true,
    },

    productIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],

    variantIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ProductVariant",
      },
    ],

    categoryIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],

    brandIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Brand",
      },
    ],

    startsAt: {
      type: Date,
      required: true,
      index: true,
    },

    endsAt: {
      type: Date,
      required: true,
      index: true,
    },

    status: {
      type: String,
      required: true,
      enum: Object.values(DISCOUNT_STATUSES),
      default: DISCOUNT_STATUSES.ACTIVE,
      index: true,
    },

    priority: {
      type: Number,
      default: 0,
      index: true,
    },

    maxDiscountAmount: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
    },

    minSellingPrice: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
    },

    fundingSource: {
      type: String,
      required: true,
      enum: Object.values(FUNDING_SOURCES),
      default: FUNDING_SOURCES.PLATFORM,
    },

    allowCoupons: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },

    lastTransitionAt: {
      type: Date,
      default: null,
      index: true,
    },

    lastReconciledAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Compound indexes for high-throughput promotional lookups
productDiscountSchema.index({
  status: 1,
  startsAt: 1,
  endsAt: 1,
  priority: -1,
  deletedAt: 1,
});
productDiscountSchema.index({ scope: 1, productIds: 1 });
productDiscountSchema.index({ scope: 1, variantIds: 1 });
productDiscountSchema.index({ scope: 1, categoryIds: 1 });
productDiscountSchema.index({ scope: 1, brandIds: 1 });

productDiscountSchema.pre("validate", function () {
  if (this.startsAt && this.endsAt && this.startsAt >= this.endsAt) {
    throw new Error("Promotion endsAt must be strictly after startsAt");
  }

  if (this.value !== undefined && this.value !== null) {
    const numericValue = Number(this.value.toString());
    if (isNaN(numericValue) || numericValue <= 0) {
      throw new Error("Promotion discount value must be a positive number");
    }

    if (this.discountType === DISCOUNT_TYPES.PERCENTAGE && numericValue > 100) {
      throw new Error("Percentage discount value cannot exceed 100");
    }
  }

  if (this.maxDiscountAmount !== undefined && this.maxDiscountAmount !== null) {
    const numericMax = Number(this.maxDiscountAmount.toString());
    if (isNaN(numericMax) || numericMax < 0) {
      throw new Error("Maximum discount amount cannot be negative");
    }
  }

  if (this.minSellingPrice !== undefined && this.minSellingPrice !== null) {
    const numericFloor = Number(this.minSellingPrice.toString());
    if (isNaN(numericFloor) || numericFloor < 0) {
      throw new Error("Minimum selling price floor cannot be negative");
    }
  }
});

const ProductDiscount = mongoose.model("ProductDiscount", productDiscountSchema);

module.exports = ProductDiscount;
module.exports.ProductDiscount = ProductDiscount;
