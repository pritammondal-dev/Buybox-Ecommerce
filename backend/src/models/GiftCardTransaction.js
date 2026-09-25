const mongoose = require("mongoose");

const giftCardTransactionSchema = new mongoose.Schema(
  {
    giftCardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GiftCard",
      required: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    amount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    type: {
      type: String,
      enum: ["issue", "claim", "redemption", "refund"],
      required: true,
    },
    notes: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

giftCardTransactionSchema.index({
  customerId: 1,
  createdAt: -1,
});

module.exports = mongoose.model("GiftCardTransaction", giftCardTransactionSchema);
