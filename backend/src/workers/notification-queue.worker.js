const { Worker } = require("bullmq");

const redis = require("../config/redis");
const NotificationOutbox = require("../models/NotificationOutbox");

const {
  processNotification,
} = require("../services/notification-outbox.worker");

const notificationWorker = new Worker(
  "notifications",
  async (job) => {
    const { notificationId } = job.data;

    if (!notificationId) {
      throw new Error(
        "Notification ID is required"
      );
    }

    const notification =
      await NotificationOutbox.findById(
        notificationId
      );

    if (!notification) {
      throw new Error(
        `Notification not found: ${notificationId}`
      );
    }

    if (notification.status === "sent") {
      return {
        notificationId,
        status: "already_sent",
      };
    }

    notification.status = "processing";
    notification.attempts += 1;
    notification.lastError = null;

    await notification.save();

    try {
      await processNotification(notification);

      notification.status = "sent";
      notification.processedAt = new Date();
      notification.lastError = null;

      await notification.save();

      return {
        notificationId,
        status: "sent",
      };
    } catch (error) {
      notification.status = "failed";
      notification.lastError = error.message;

      await notification.save();

      throw error;
    }
  },
  {
    connection: redis,
  }
);

notificationWorker.on("completed", (job) => {
  console.log(
    `Notification job completed: ${job.id}`
  );
});

notificationWorker.on("failed", (job, error) => {
  console.error(
    `Notification job failed: ${job?.id}:`,
    error.message
  );
});

notificationWorker.on("error", (error) => {
  console.error(
    "Notification worker error:",
    error.message
  );
});

const stopNotificationQueueWorker =
  async () => {
    await notificationWorker.close();
  };

module.exports = {
  notificationWorker,
  stopNotificationQueueWorker,
};