const mongoose = require("mongoose");
const { Schema } = mongoose;
const {
  COMMISSION_POLICY_SCOPES,
} = require("../constants/finance.constants");
const AppError = require("../errors/AppError");

const versionHistorySchema = new Schema(
  {
    version: {
      type: Number,
      required: true,
    },
    rate: {
      type: Schema.Types.Decimal128,
      required: true,
    },
    percentage: {
      type: Number,
      required: true,
    },
    effectiveFrom: {
      type: Date,
      required: true,
    },
    effectiveUntil: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: null,
      maxlength: 500,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const commissionPolicySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },
    scope: {
      type: String,
      required: true,
      enum: Object.values(COMMISSION_POLICY_SCOPES),
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      default: null,
      index: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      default: null,
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },
    rate: {
      type: Schema.Types.Decimal128,
      required: true,
      min: 0,
    },
    percentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    effectiveFrom: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    effectiveUntil: {
      type: Date,
      default: null,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    priority: {
      type: Number,
      required: true,
      default: 10,
    },
    notes: {
      type: String,
      trim: true,
      default: null,
      maxlength: 500,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
    versionHistory: [versionHistorySchema],
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

commissionPolicySchema.index(
  { scope: 1, isActive: 1, deletedAt: 1 },
  { background: true }
);

commissionPolicySchema.index(
  { scope: 1, productId: 1, isActive: 1, deletedAt: 1 },
  { background: true }
);

commissionPolicySchema.index(
  { scope: 1, vendorId: 1, isActive: 1, deletedAt: 1 },
  { background: true }
);

commissionPolicySchema.index(
  { scope: 1, categoryId: 1, isActive: 1, deletedAt: 1 },
  { background: true }
);

commissionPolicySchema.index(
  { effectiveFrom: 1, effectiveUntil: 1 },
  { background: true }
);

commissionPolicySchema.pre("validate", function validatePolicy() {
  const rateNum = Number(this.rate?.toString() || 0);

  if (!Number.isFinite(rateNum) || rateNum < 0 || rateNum > 1) {
    throw new AppError(
      "Commission rate must be between 0.00 and 1.00 (0% to 100%)",
      422,
      "INVALID_COMMISSION_RATE"
    );
  }

  if (this.percentage === undefined || this.percentage === null) {
    this.percentage = Math.round(rateNum * 10000) / 100;
  }

  if (this.scope === COMMISSION_POLICY_SCOPES.PRODUCT) {
    if (!this.productId) {
      throw new AppError(
        "Product ID is required for product-scoped commission policies",
        422,
        "PRODUCT_ID_REQUIRED"
      );
    }
    this.vendorId = null;
    this.categoryId = null;
    if (!this.priority || this.priority === 10) this.priority = 40;
  } else if (this.scope === COMMISSION_POLICY_SCOPES.VENDOR) {
    if (!this.vendorId) {
      throw new AppError(
        "Vendor ID is required for vendor-scoped commission policies",
        422,
        "VENDOR_ID_REQUIRED"
      );
    }
    this.productId = null;
    this.categoryId = null;
    if (!this.priority || this.priority === 10) this.priority = 30;
  } else if (this.scope === COMMISSION_POLICY_SCOPES.CATEGORY) {
    if (!this.categoryId) {
      throw new AppError(
        "Category ID is required for category-scoped commission policies",
        422,
        "CATEGORY_ID_REQUIRED"
      );
    }
    this.productId = null;
    this.vendorId = null;
    if (!this.priority || this.priority === 10) this.priority = 20;
  } else if (this.scope === COMMISSION_POLICY_SCOPES.GLOBAL) {
    this.productId = null;
    this.vendorId = null;
    this.categoryId = null;
    if (!this.priority) this.priority = 10;
  }

  if (this.effectiveUntil && this.effectiveFrom) {
    const fromTime = new Date(this.effectiveFrom).getTime();
    const untilTime = new Date(this.effectiveUntil).getTime();
    if (untilTime <= fromTime) {
      throw new AppError(
        "Effective-until date must be strictly after effective-from date",
        422,
        "INVALID_EFFECTIVE_DATE_RANGE"
      );
    }
  }
});

const CommissionPolicy = mongoose.model("CommissionPolicy", commissionPolicySchema);

module.exports = CommissionPolicy;
module.exports.CommissionPolicy = CommissionPolicy;
