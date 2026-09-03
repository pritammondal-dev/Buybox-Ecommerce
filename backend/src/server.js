require("dotenv").config();

const env = require("./config/env");
const logger = require("./config/logger");
const app = require("./app");
const connectDatabase = require("./config/database");

const PORT = env.PORT;

const startServer = async () => {
  await connectDatabase();

  const server = app.listen(PORT, () => {
    logger.info(`Buybox API running on port ${PORT}`);
  });

  const shutdown = () => {
    logger.info("Shutting down server...");

    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
};

startServer();