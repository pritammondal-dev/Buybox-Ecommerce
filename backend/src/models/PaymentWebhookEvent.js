const mongoose = require("mongoose");

const paymentWebhookEventSchema =
  new mongoose.Schema(
    {
      eventId: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true,
      },

      eventType: {
        type: String,
        required: true,
        trim: true,
        index: true,
      },

      gateway: {
        type: String,
        required: true,
        enum: ["razorpay"],
        default: "razorpay",
        index: true,
      },

      status: {
        type: String,
        required: true,
        enum: [
          "received",
          "processing",
          "processed",
          "failed",
        ],
        default: "received",
        index: true,
      },

      attempts: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
      },

      payload: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
      },

      errorMessage: {
        type: String,
        default: null,
        trim: true,
      },

      receivedAt: {
        type: Date,
        required: true,
        default: Date.now,
      },

      processedAt: {
        type: Date,
        default: null,
      },

      lastAttemptAt: {
        type: Date,
        default: null,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    }
  );

paymentWebhookEventSchema.index({
  eventType: 1,
  status: 1,
  createdAt: -1,
});

module.exports =
  mongoose.model(
    "PaymentWebhookEvent",
    paymentWebhookEventSchema
  );