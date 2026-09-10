const mongoose = require("mongoose");

const analyticsEventSchema = new mongoose.Schema(
  {
    eventName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    eventType: {
      type: String,
      enum: [
        "user",
        "product",
        "cart",
        "order",
        "payment",
        "refund",
        "inventory",
        "shipment",
        "marketing",
        "system",
      ],
      required: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
      index: true,
    },

    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      default: null,
      index: true,
    },

    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    entityType: {
      type: String,
      trim: true,
      default: null,
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    properties: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    occurredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

analyticsEventSchema.index({
  eventName: 1,
  occurredAt: -1,
});

analyticsEventSchema.index({
  eventType: 1,
  occurredAt: -1,
});

analyticsEventSchema.index({
  customerId: 1,
  occurredAt: -1,
});

analyticsEventSchema.index({
  vendorId: 1,
  occurredAt: -1,
});

module.exports = mongoose.model(
  "AnalyticsEvent",
  analyticsEventSchema
);