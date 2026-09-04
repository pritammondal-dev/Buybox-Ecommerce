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
      required: true,
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
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

cartSchema.index(
  { customerId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: "active",
    },
  }
);

module.exports = mongoose.model("Cart", cartSchema);