const env = require("./config/env");
const logger = require("./config/logger");
const app = require("./app");
const redis = require("./config/redis");
const { connectDatabase, disconnectDatabase } = require("./config/database");
const { startAllWorkers, stopAllWorkers } = require("./workers/worker-coordinator");
const { validateProductionConfiguration } = require("./config/production-validator");
const { bootstrapSuperadmin } = require("./services/bootstrap.service");

const PORT = env.PORT;
let isShuttingDown = false;

// Process-level unhandled rejection & uncaught exception handlers
process.on("unhandledRejection", (reason) => {
  logger.error(
    {
      reason: reason instanceof Error ? reason.message : reason,
      stack: reason instanceof Error ? reason.stack : undefined,
    },
    "Unhandled Promise Rejection detected"
  );
});

process.on("uncaughtException", (error) => {
  logger.fatal(
    {
      error: error.message,
      stack: error.stack,
    },
    "Uncaught Exception fatal crash"
  );
  process.exit(1);
});

const startServer = async () => {
  // Validate production configuration safety before startup
  const configValidation = validateProductionConfiguration(env);
  if (!configValidation.valid) {
    logger.fatal(
      { errors: configValidation.errors },
      "Production deployment configuration check failed. Server startup aborted."
    );
    process.exit(1);
  }
  if (configValidation.warnings.length > 0) {
    logger.warn(
      { warnings: configValidation.warnings },
      "Production deployment configuration warnings detected."
    );
  }

  await connectDatabase();
  await bootstrapSuperadmin();
  const { seedDefaultPartnerBanks } = require("./services/partner-bank.service");
  await seedDefaultPartnerBanks().catch((err) => logger.warn(`Partner bank auto-seed skipped: ${err.message}`));

  // Initialize and start all background schedulers and BullMQ queue workers
  startAllWorkers();

  const server = app.listen(PORT, () => {
    logger.info(`Buybox API running on port ${PORT}`);
  });

  const shutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    app.locals.isShuttingDown = true;

    logger.info(`Received ${signal}. Initiating graceful shutdown sequence...`);

    // Force exit timer to prevent hung process on stuck sockets
    const forceExitTimer = setTimeout(() => {
      logger.error("Graceful shutdown exceeded 15s timeout window. Forcing process exit.");
      process.exit(1);
    }, 15000);
    forceExitTimer.unref();

    // 1. Stop accepting new incoming HTTP connections
    server.close(async () => {
      logger.info("HTTP server stopped listening for new connections.");

      // 2. Stop background worker schedulers & await active queue job completions
      try {
        await stopAllWorkers(8000);
      } catch (workerErr) {
        logger.error({ error: workerErr.message }, "Error during worker coordinator shutdown");
      }

      // 3. Disconnect MongoDB connection pool
      try {
        await disconnectDatabase();
      } catch (dbErr) {
        logger.error({ error: dbErr.message }, "Error closing MongoDB connection pool cleanly");
      }

      // 4. Close Redis connection
      try {
        if (redis && (redis.status === "ready" || redis.status === "connect")) {
          await redis.quit();
          logger.info("Redis connection closed cleanly.");
        }
      } catch (redisErr) {
        logger.error({ error: redisErr.message }, "Error closing Redis connection cleanly");
      }

      clearTimeout(forceExitTimer);
      logger.info("Buybox server graceful shutdown completed.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

startServer();