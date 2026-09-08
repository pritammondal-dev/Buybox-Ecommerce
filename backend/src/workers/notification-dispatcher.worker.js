const NotificationOutbox = require("../models/NotificationOutbox");
const notificationQueue = require("../queues/notification.queue");

let dispatcherRunning = false;
let dispatcherTimer = null;

const dispatchPendingNotifications = async () => {
  if (dispatcherRunning) {
    return 0;
  }

  dispatcherRunning = true;

  try {
    const notifications =
      await NotificationOutbox.find({
        status: "pending",
        availableAt: {
          $lte: new Date(),
        },
      })
        .sort({
          availableAt: 1,
          createdAt: 1,
        })
        .limit(20);

    let dispatched = 0;

    for (const notification of notifications) {
      await notificationQueue.add(
  notification.type,
  {
    notificationId: notification._id.toString(),
  },
  {
    jobId: `notification-${notification._id}`,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  }
);

      dispatched += 1;
    }

    return dispatched;
  } finally {
    dispatcherRunning = false;
  }
};

const runNotificationDispatcher = () => {
  if (dispatcherTimer) {
    return;
  }

  dispatcherTimer = setInterval(async () => {
    try {
      await dispatchPendingNotifications();
    } catch (error) {
      console.error(
        "Notification dispatcher error:",
        error.message
      );
    }
  }, 5000);
};

const stopNotificationDispatcher = () => {
  if (dispatcherTimer) {
    clearInterval(dispatcherTimer);
    dispatcherTimer = null;
  }
};

module.exports = {
  dispatchPendingNotifications,
  runNotificationDispatcher,
  stopNotificationDispatcher,
};
