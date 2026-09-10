const AnalyticsEvent = require("../models/AnalyticsEvent");

class AnalyticsService {
  async track({
    eventName,
    eventType,
    userId = null,
    customerId = null,
    vendorId = null,
    storeId = null,
    entityType = null,
    entityId = null,
    properties = {},
    metadata = {},
    occurredAt = new Date(),
  }) {
    if (!eventName) {
      throw new Error("Analytics event name is required");
    }

    if (!eventType) {
      throw new Error("Analytics event type is required");
    }

    const event = new AnalyticsEvent({
      eventName,
      eventType,
      userId,
      customerId,
      vendorId,
      storeId,
      entityType,
      entityId,
      properties,
      metadata,
      occurredAt,
    });

    return event.save();
  }

  async getEvents({
    eventName,
    eventType,
    customerId,
    vendorId,
    startDate,
    endDate,
    limit = 100,
  } = {}) {
    const filter = {};

    if (eventName) {
      filter.eventName = eventName;
    }

    if (eventType) {
      filter.eventType = eventType;
    }

    if (customerId) {
      filter.customerId = customerId;
    }

    if (vendorId) {
      filter.vendorId = vendorId;
    }

    if (startDate || endDate) {
      filter.occurredAt = {};

      if (startDate) {
        filter.occurredAt.$gte = new Date(startDate);
      }

      if (endDate) {
        filter.occurredAt.$lte = new Date(endDate);
      }
    }

    return AnalyticsEvent.find(filter)
      .sort({ occurredAt: -1 })
      .limit(Math.min(Number(limit) || 100, 500));
  }
}

module.exports = new AnalyticsService();