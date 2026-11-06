const NotificationOutbox = require("../models/NotificationOutbox");
const notificationQueue = require("../queues/notification.queue");
const { withDistributedLock } = require("../utils/distributed-lock");

let dispatcherRunning = false;
let dispatcherTimer = null;

const dispatchPendingNotifications = async (options = {}) => {
  if (dispatcherRunning) {
    return 0;
  }

  const lockTtlMs = options.lockTtlMs || 15000;
  const lockResult = await withDistributedLock(
    "notification-dispatcher",
    async () => {
      dispatcherRunning = true;

      try {
        const notifications = await NotificationOutbox.find({
          status: "pending",
          availableAt: {
            $lte: new Date(),
          },
        })
          .sort({
            availableAt: 1,
            createdAt: 1,
          })
          .limit(options.limit || 20);

        let dispatched = 0;

        for (const notification of notifications) {
          // Atomically claim notification so concurrent processes never re-enqueue
          const claimed = await NotificationOutbox.findOneAndUpdate(
            { _id: notification._id, status: "pending" },
            { $set: { status: "queued", queuedAt: new Date() } },
            { new: true }
          );

          if (!claimed) {
            continue;
          }

          try {
            await notificationQueue.add(
              claimed.type,
              {
                notificationId: claimed._id.toString(),
              },
              {
                jobId: `notification-${claimed._id}`,
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
          } catch (queueErr) {
            // Revert to pending so it can be picked up on next interval
            await NotificationOutbox.updateOne(
              { _id: claimed._id, status: "queued" },
              { $set: { status: "pending", lastError: queueErr.message } }
            ).catch(() => {});
          }
        }

        return dispatched;
      } finally {
        dispatcherRunning = false;
      }
    },
    {
      ttlMs: lockTtlMs,
      client: options.redisClient,
    }
  );

  if (lockResult.skipped) {
    return 0;
  }

  return lockResult.result || 0;
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
