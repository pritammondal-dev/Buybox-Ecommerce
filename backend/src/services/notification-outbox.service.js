const NotificationOutbox = require("../models/NotificationOutbox");

class NotificationOutboxService {
  async enqueue({
    type,
    channel = "email",
    recipient,
    payload,
    availableAt = new Date(),
    session = null,
  }) {
    if (!type) {
      throw new Error("Notification type is required");
    }

    if (!recipient) {
      throw new Error("Notification recipient is required");
    }

    if (!payload || typeof payload !== "object") {
      throw new Error("Notification payload is required");
    }

    const notification = new NotificationOutbox({
      type,
      channel,
      recipient,
      payload,
      availableAt,
      status: "pending",
      attempts: 0,
    });

    await notification.save(
      session ? { session } : undefined
    );

    return notification;
  }

  async getPendingNotifications(limit = 20) {
    return NotificationOutbox.find({
      status: "pending",
      availableAt: {
        $lte: new Date(),
      },
    })
      .sort({
        availableAt: 1,
        createdAt: 1,
      })
      .limit(limit);
  }
}

module.exports = new NotificationOutboxService();
