const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema(
  {
    productVariantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
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

    priceSnapshot: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      min: 0,
    },

    regularPrice: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
    },

    effectivePrice: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
    },

    isPromotional: {
      type: Boolean,
      default: false,
    },

    promotionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductDiscount",
      default: null,
    },

    promotionName: {
      type: String,
      default: null,
      trim: true,
    },

    promotionalDiscountAmount: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },

    promotionalSavings: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },

    allowCoupons: {
      type: Boolean,
      default: true,
    },

    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },

    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: true,
    versionKey: false,
  }
);

const cartSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: false,
      default: null,
      index: true,
    },

    guestId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },

    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    status: {
      type: String,
      enum: ["active", "converted", "abandoned"],
      default: "active",
      required: true,
      index: true,
    },

    items: {
      type: [cartItemSchema],
      default: [],
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

    productDiscountTotal: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },

    taxTotal: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      min: 0,
      default: 0,
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

    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },

    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    abandonedAt: {
      type: Date,
      default: null,
    },

    recoveredAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

cartSchema.pre("validate", function () {
  if (!this.customerId && !this.guestId) {
    throw new Error("Cart must be bound to either a customerId or a guestId");
  }
});

cartSchema.index(
  { customerId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: "active",
      customerId: { $type: "objectId" },
    },
  }
);

cartSchema.index(
  { guestId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: "active",
      guestId: { $type: "string" },
    },
  }
);

cartSchema.index({ status: 1, lastActivityAt: 1 });

module.exports = mongoose.model("Cart", cartSchema);