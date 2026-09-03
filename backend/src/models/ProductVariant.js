const mongoose = require("mongoose");

const productVariantSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    sku: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    name: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },

    attributes: {
      type: Map,
      of: String,
      default: {},
    },

    price: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      min: 0,
    },

    compareAtPrice: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
      min: 0,
    },

    costPrice: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
      min: 0,
    },

    currency: {
      type: String,
      default: "INR",
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },

    stockQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    stockStatus: {
      type: String,
      enum: [
        "in_stock",
        "out_of_stock",
        "preorder",
      ],
      default: "out_of_stock",
      index: true,
    },

    image: {
      url: {
        type: String,
        default: null,
      },

      publicId: {
        type: String,
        default: null,
      },

      altText: {
        type: String,
        default: "",
        maxlength: 200,
      },
    },

    weight: {
      value: {
        type: Number,
        default: null,
        min: 0,
      },

      unit: {
        type: String,
        enum: ["g", "kg", "lb", "oz"],
        default: "g",
      },
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

productVariantSchema.index({
  productId: 1,
  isActive: 1,
  deletedAt: 1,
});

productVariantSchema.index({
  productId: 1,
  stockStatus: 1,
});

module.exports = mongoose.model(
  "ProductVariant",
  productVariantSchema
);
