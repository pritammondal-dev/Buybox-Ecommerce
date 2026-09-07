const {
  processNextNotification,
} = require("../services/notification-outbox.worker");

let workerRunning = false;

const runNotificationWorker = async () => {
  if (workerRunning) {
    return;
  }

  workerRunning = true;

  try {
    while (workerRunning) {
      const notification =
        await processNextNotification();

      if (!notification) {
        await new Promise((resolve) =>
          setTimeout(resolve, 5000)
        );
      }
    }
  } finally {
    workerRunning = false;
  }
};

const stopNotificationWorker = () => {
  workerRunning = false;
};

module.exports = {
  runNotificationWorker,
  stopNotificationWorker,
};