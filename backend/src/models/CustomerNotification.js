const mongoose = require("mongoose");

const customerNotificationSchema = new mongoose.Schema(
  {
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
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    type: {
      type: String,
      enum: [
        "order",
        "payment",
        "shipment",
        "delivery",
        "cancellation",
        "return",
        "refund",
        "support",
        "promotion",
        "system",
      ],
      default: "system",
      index: true,
    },
    link: {
      type: String,
      trim: true,
      default: null,
      maxlength: 500,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
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

customerNotificationSchema.index({
  userId: 1,
  isRead: 1,
  createdAt: -1,
});

module.exports = mongoose.model("CustomerNotification", customerNotificationSchema);
