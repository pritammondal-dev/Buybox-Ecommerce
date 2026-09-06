const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    productVariantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      default: null,
      index: true,
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    title: {
      type: String,
      trim: true,
      maxlength: 150,
      default: null,
    },

    comment: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: null,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "rejected",
        "hidden",
      ],
      default: "pending",
      index: true,
    },

    isVerifiedPurchase: {
      type: Boolean,
      default: true,
      index: true,
    },

    vendorResponse: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: null,
    },

    vendorRespondedAt: {
      type: Date,
      default: null,
    },

    moderatedAt: {
      type: Date,
      default: null,
    },

    moderationReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },

    helpfulCount: {
      type: Number,
      default: 0,
      min: 0,
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

reviewSchema.index(
  {
    productId: 1,
    customerId: 1,
    orderId: 1,
  },
  {
    unique: true,
  }
);

reviewSchema.index({
  productId: 1,
  status: 1,
  createdAt: -1,
});

reviewSchema.pre("validate", function () {
  if (this.status === "rejected" && !this.moderationReason) {
    throw new Error(
      "Moderation reason is required when rejecting a review"
    );
  }

  if (
    this.vendorResponse &&
    !this.vendorRespondedAt
  ) {
    this.vendorRespondedAt = new Date();
  }
});

const Review = mongoose.model("Review", reviewSchema);

module.exports = Review;