const mongoose = require("mongoose");

const rewardTransactionSchema = new mongoose.Schema(
  {
    rewardAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RewardAccount",
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["earned", "redeemed", "expired", "adjusted"],
      required: true,
    },
    points: {
      type: Number,
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

rewardTransactionSchema.index({
  customerId: 1,
  createdAt: -1,
});

module.exports = mongoose.model("RewardTransaction", rewardTransactionSchema);
