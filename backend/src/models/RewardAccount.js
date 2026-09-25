const mongoose = require("mongoose");

const rewardAccountSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    pointsBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    pointsEarnedTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    pointsRedeemedTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    tier: {
      type: String,
      enum: ["bronze", "silver", "gold", "platinum"],
      default: "bronze",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("RewardAccount", rewardAccountSchema);
