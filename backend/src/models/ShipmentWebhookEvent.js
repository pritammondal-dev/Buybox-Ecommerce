const mongoose = require("mongoose");

const shipmentWebhookEventSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: true,
      enum: ["delhivery", "shiprocket", "manual", "generic"],
      index: true,
    },

    eventId: {
      type: String,
      required: true,
      index: true,
    },

    eventType: {
      type: String,
      required: true,
    },

    trackingNumber: {
      type: String,
      required: true,
      index: true,
    },

    status: {
      type: String,
      required: true,
    },

    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    processedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

shipmentWebhookEventSchema.index(
  { provider: 1, eventId: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "ShipmentWebhookEvent",
  shipmentWebhookEventSchema
);
