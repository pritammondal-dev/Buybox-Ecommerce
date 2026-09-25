const mongoose = require("mongoose");
const {
  PAYMENT_GATEWAYS,
} = require("../constants/payment.constants");

const paymentMethodSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 50,
      index: true,
    },

    gateway: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    type: {
      type: String,
      required: true,
      enum: [
        "upi",
        "card",
        "netbanking",
        "wallet",
        "international_card",
        "paypal",
        "cod",
        "emi",
        "other",
      ],
      default: "other",
      index: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    icon: {
      type: String,
      default: "CreditCard",
      trim: true,
    },

    enabled: {
      type: Boolean,
      default: false,
      index: true,
    },

    displayOrder: {
      type: Number,
      default: 0,
      index: true,
    },

    supportedCountries: {
      type: [String],
      default: ["IN"],
    },

    supportedCurrencies: {
      type: [String],
      default: ["INR"],
    },

    minimumOrderAmount: {
      type: mongoose.Schema.Types.Decimal128,
      default: "0.00",
      min: 0,
    },

    maximumOrderAmount: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
    },

    customerEligibilityRules: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    configuration: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
      index: true,
    },

    isDefault: {
      type: Boolean,
      default: false,
    },

    token: {
      type: String,
      default: null,
      trim: true,
    },

    last4: {
      type: String,
      default: null,
      trim: true,
      maxlength: 4,
    },

    cardBrand: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
    },

    expiryMonth: {
      type: Number,
      default: null,
      min: 1,
      max: 12,
    },

    expiryYear: {
      type: Number,
      default: null,
      min: 2024,
      max: 2099,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
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

paymentMethodSchema.index({
  enabled: 1,
  isDeleted: 1,
  displayOrder: 1,
});

paymentMethodSchema.index({
  customerId: 1,
  isDeleted: 1,
  isDefault: 1,
});

paymentMethodSchema.pre("validate", function () {
  // Disallow storing raw PAN numbers (13 to 19 digits) anywhere
  const obj = this.toObject ? this.toObject() : this;
  const stringified = JSON.stringify(obj);
  if (/\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/.test(stringified)) {
    throw new Error("Raw credit/debit card numbers (PAN) are strictly forbidden from database storage.");
  }
  if (this.configuration && (this.configuration.cvv || this.configuration.cvc || this.configuration.securityCode)) {
    throw new Error("CVV/CVC codes must NEVER be stored.");
  }
});

module.exports = mongoose.model("PaymentMethod", paymentMethodSchema);
