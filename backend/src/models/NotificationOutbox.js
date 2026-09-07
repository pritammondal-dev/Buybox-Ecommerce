const mongoose = require("mongoose");

const notificationOutboxSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    channel: {
      type: String,
      enum: ["email", "sms", "push"],
      required: true,
      index: true,
    },

    recipient: {
      type: String,
      required: true,
      trim: true,
    },

    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "processing", "sent", "failed"],
      default: "pending",
      index: true,
    },

    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    availableAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    processedAt: {
      type: Date,
      default: null,
    },

    lastError: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

notificationOutboxSchema.index({
  status: 1,
  availableAt: 1,
});

module.exports = mongoose.model(
  "NotificationOutbox",
  notificationOutboxSchema
);