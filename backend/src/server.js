require("dotenv").config();

const env = require("./config/env");
const logger = require("./config/logger");
const app = require("./app");
const connectDatabase = require("./config/database");

const {
  notificationWorker,
  stopNotificationQueueWorker,
} = require("./workers/notification-queue.worker");

const {
  runNotificationDispatcher,
  stopNotificationDispatcher,
} = require("./workers/notification-dispatcher.worker");

const {
  runCartAbandonmentScheduler,
  stopCartAbandonmentScheduler,
} = require("./workers/cart-abandonment.worker");

const PORT = env.PORT;

const startServer = async () => {
  await connectDatabase();

  runNotificationDispatcher();
  runCartAbandonmentScheduler();

  logger.info("Notification queue worker initialized");

  notificationWorker.on("ready", () => {
    logger.info("Notification queue worker is ready");
  });

  notificationWorker.on("error", (error) => {
    logger.error(
      {
        error: error.message,
        stack: error.stack,
      },
      "Notification queue worker error"
    );
  });

  const server = app.listen(PORT, () => {
    logger.info(`Buybox API running on port ${PORT}`);
  });

  const shutdown = async () => {
    logger.info("Shutting down server...");

    stopNotificationDispatcher();
    stopCartAbandonmentScheduler();

    try {
      await stopNotificationQueueWorker();
    } catch (error) {
      logger.error(
        {
          error: error.message,
          stack: error.stack,
        },
        "Failed to stop notification queue worker"
      );
    }

    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
};

startServer();