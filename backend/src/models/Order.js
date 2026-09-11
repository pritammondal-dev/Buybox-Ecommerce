const mongoose = require("mongoose");
const {
  ALLOWED_TAX_CATEGORIES,
  DEFAULT_TAX_CATEGORY,
  ALLOWED_TAX_PRICING_MODES,
  DEFAULT_TAX_PRICING_MODE,
} = require("../constants/tax.constants");

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    productVariantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
    },

    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    },

    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },

    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    productName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    variantName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Quantity must be an integer",
      },
    },

    unitPrice: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      min: 0,
    },

    discountTotal: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      min: 0,
      default: 0,
    },

    taxTotal: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      min: 0,
      default: 0,
    },

    lineTotal: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      min: 0,
    },

    taxDetails: {
      taxRuleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "TaxRule",
        default: null,
      },
      ruleName: {
        type: String,
        default: null,
        trim: true,
      },
      jurisdictionCountry: {
        type: String,
        uppercase: true,
        trim: true,
        default: null,
      },
      jurisdictionState: {
        type: String,
        uppercase: true,
        trim: true,
        default: null,
      },
      taxCategory: {
        type: String,
        enum: ALLOWED_TAX_CATEGORIES,
        default: DEFAULT_TAX_CATEGORY,
      },
      isTaxable: {
        type: Boolean,
        default: true,
      },
      pricingMode: {
        type: String,
        enum: ALLOWED_TAX_PRICING_MODES,
        default: DEFAULT_TAX_PRICING_MODE,
      },
      taxRate: {
        type: mongoose.Schema.Types.Decimal128,
        default: 0,
      },
      taxableBase: {
        type: mongoose.Schema.Types.Decimal128,
        default: 0,
      },
      taxAmount: {
        type: mongoose.Schema.Types.Decimal128,
        default: 0,
      },
    },

    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },
  },
  {
    _id: true,
    versionKey: false,
  }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      uppercase: true,
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },

    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    /*
     * Coupon snapshot.
     *
     * Keeping the coupon ID and code on the order preserves
     * which promotion was actually applied even if the coupon
     * is later edited or deactivated.
     */
    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      default: null,
      index: true,
    },

    couponCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
        "completed",
      ],
      default: "pending",
      required: true,
      index: true,
    },

    /*
     * Cancellation workflow state.
     *
     * This is separate from the final order status so the
     * cancellation process can survive failures between the
     * payment gateway and MongoDB transaction.
     */
    cancellationStatus: {
      type: String,
      enum: [
        "none",
        "pending",
        "completed",
        "failed",
      ],
      default: "none",
      required: true,
      index: true,
    },

    paymentStatus: {
      type: String,
      enum: [
        "pending",
        "authorized",
        "paid",
        "failed",
        "refunded",
        "partially_refunded",
      ],
      default: "pending",
      required: true,
      index: true,
    },

    fulfillmentStatus: {
      type: String,
      enum: [
        "unfulfilled",
        "partially_fulfilled",
        "fulfilled",
        "cancelled",
      ],
      default: "unfulfilled",
      required: true,
      index: true,
    },

    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
      default: "INR",
    },

    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items) => items.length > 0,
        message: "Order must contain at least one item",
      },
    },

    subtotal: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      min: 0,
      default: 0,
    },

    discountTotal: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      min: 0,
      default: 0,
    },

    taxTotal: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      min: 0,
      default: 0,
    },

    pricingMode: {
      type: String,
      enum: ALLOWED_TAX_PRICING_MODES,
      default: DEFAULT_TAX_PRICING_MODE,
    },

    taxSnapshot: {
      jurisdictionCountry: {
        type: String,
        uppercase: true,
        trim: true,
        default: null,
      },
      jurisdictionState: {
        type: String,
        uppercase: true,
        trim: true,
        default: null,
      },
      calculatedAt: {
        type: Date,
        default: Date.now,
      },
      itemsTaxTotal: {
        type: mongoose.Schema.Types.Decimal128,
        default: 0,
      },
      shippingTaxTotal: {
        type: mongoose.Schema.Types.Decimal128,
        default: 0,
      },
      totalTax: {
        type: mongoose.Schema.Types.Decimal128,
        default: 0,
      },
      pricingMode: {
        type: String,
        enum: ALLOWED_TAX_PRICING_MODES,
        default: DEFAULT_TAX_PRICING_MODE,
      },
    },

    shippingTotal: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      min: 0,
      default: 0,
    },

    grandTotal: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      min: 0,
      default: 0,
    },

    shippingAddress: {
      fullName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 150,
      },

      phone: {
        type: String,
        required: true,
        trim: true,
        maxlength: 20,
      },

      addressLine1: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
      },

      addressLine2: {
        type: String,
        default: "",
        trim: true,
        maxlength: 200,
      },

      city: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
      },

      state: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
      },

      postalCode: {
        type: String,
        required: true,
        trim: true,
        maxlength: 20,
      },

      country: {
        type: String,
        required: true,
        uppercase: true,
        trim: true,
        maxlength: 2,
        default: "IN",
      },
    },

    placedAt: {
      type: Date,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

orderSchema.index({
  customerId: 1,
  createdAt: -1,
});

orderSchema.index({
  customerId: 1,
  status: 1,
});

orderSchema.index({
  status: 1,
  paymentStatus: 1,
});

orderSchema.index({
  "items.vendorId": 1,
  status: 1,
});

orderSchema.index({
  cancellationStatus: 1,
  status: 1,
});

module.exports = mongoose.model("Order", orderSchema);