const mongoose = require("mongoose");

const answerSubSchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    authorName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    authorRole: {
      type: String,
      enum: ["customer", "vendor", "admin"],
      default: "customer",
    },
    answer: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    helpfulCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    helpfulVoters: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const productQuestionSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    question: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    answers: [answerSubSchema],
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "hidden"],
      default: "approved",
      index: true,
    },
    helpfulCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    helpfulVoters: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

productQuestionSchema.index({
  productId: 1,
  status: 1,
  createdAt: -1,
});

module.exports = mongoose.model("ProductQuestion", productQuestionSchema);
