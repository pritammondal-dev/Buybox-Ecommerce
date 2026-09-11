const mongoose = require("mongoose");
const {
  ALLOWED_TAX_CATEGORIES,
  DEFAULT_TAX_CATEGORY,
} = require("../constants/tax.constants");

const taxRuleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    country: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 2,
      maxlength: 2,
    },

    state: {
      type: String,
      default: null,
      uppercase: true,
      trim: true,
      maxlength: 100,
    },

    taxCategory: {
      type: String,
      required: true,
      enum: ALLOWED_TAX_CATEGORIES,
      default: DEFAULT_TAX_CATEGORY,
    },

    rate: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      min: 0,
      max: 100,
    },

    isShippingTaxable: {
      type: Boolean,
      default: false,
    },

    priority: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Priority must be an integer",
      },
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    startsAt: {
      type: Date,
      default: null,
    },

    expiresAt: {
      type: Date,
      default: null,
    },

    description: {
      type: String,
      default: null,
      maxlength: 500,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Tier 1 resolution: State-specific match
taxRuleSchema.index({
  country: 1,
  state: 1,
  taxCategory: 1,
  isActive: 1,
  priority: -1,
});

// Tier 2 resolution: Country-wide fallback
taxRuleSchema.index({
  country: 1,
  taxCategory: 1,
  isActive: 1,
  priority: -1,
});

module.exports = mongoose.model("TaxRule", taxRuleSchema);
