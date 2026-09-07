require("dotenv").config();

const env = require("./config/env");
const logger = require("./config/logger");
const app = require("./app");
const connectDatabase = require("./config/database");

const {
  runNotificationWorker,
  stopNotificationWorker,
} = require("./workers/notification.worker");

const PORT = env.PORT;

const startServer = async () => {
  await connectDatabase();

  runNotificationWorker().catch((error) => {
    logger.error(
      {
        error: error.message,
        stack: error.stack,
      },
      "Notification worker stopped unexpectedly"
    );
  });

  const server = app.listen(PORT, () => {
    logger.info(`Buybox API running on port ${PORT}`);
  });

  const shutdown = () => {
    logger.info("Shutting down server...");

    stopNotificationWorker();

    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
};

startServer();