const mongoose = require("mongoose");
const env = require("./env");
const logger = require("./logger");

/**
 * Configure and establish MongoDB connection with tuned connection pooling and timeout guardrails.
 *
 * Connection Pool Sizing Rationale:
 * - In production, maxPoolSize defaults to 50 connections per replica. Across 2-4 container replicas,
 *   this yields 100-200 concurrent connections, well within MongoDB Atlas M10+ and standard replica limits.
 * - minPoolSize defaults to 10 in production (2 in development) to maintain warm TCP sockets and eliminate
 *   connection handshake latency on traffic spikes.
 * - autoIndex is strictly disabled in production/staging to avoid blocking index builds on startup.
 */
const getDatabaseConnectionOptions = (targetEnv = env.NODE_ENV) => {
  const isProd = targetEnv === "production";
  const autoIndex = targetEnv === "development" || targetEnv === "test";

  return {
    autoIndex,
    maxPoolSize: process.env.MONGODB_MAX_POOL_SIZE
      ? Number(process.env.MONGODB_MAX_POOL_SIZE)
      : isProd
      ? 50
      : 20,
    minPoolSize: process.env.MONGODB_MIN_POOL_SIZE
      ? Number(process.env.MONGODB_MIN_POOL_SIZE)
      : isProd
      ? 10
      : 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  };
};

const connectDatabase = async () => {
  try {
    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected");
    });

    mongoose.connection.on("reconnected", () => {
      logger.info("MongoDB reconnected");
    });

    mongoose.connection.on("error", (err) => {
      logger.error({ err }, "MongoDB runtime error");
    });

    const options = getDatabaseConnectionOptions();
    const connection = await mongoose.connect(env.MONGODB_URI, options);

    logger.info(
      {
        host: connection.connection.host,
        database: connection.connection.name,
        maxPoolSize: options.maxPoolSize,
        minPoolSize: options.minPoolSize,
        autoIndex: options.autoIndex,
      },
      "MongoDB connected successfully"
    );

    return connection;
  } catch (error) {
    logger.error(
      {
        err: error.message,
        uri: env.MONGODB_URI.replace(/\/\/.*@/, "//***:***@"),
        hint: "Ensure MongoDB is running (e.g. mongod --dbpath .mongodb_data --replSet rs0 --port 27017)",
      },
      "MongoDB connection failed"
    );
    process.exit(1);
  }
};

/**
 * Gracefully close MongoDB connections during process termination.
 * Allows in-flight queries and transactions to complete.
 *
 * @param {boolean} [force=false]
 * @returns {Promise<void>}
 */
const disconnectDatabase = async (force = false) => {
  if (mongoose.connection.readyState !== 0) {
    logger.info("Closing MongoDB connection pool gracefully...");
    await mongoose.connection.close(force);
    logger.info("MongoDB connection pool closed");
  }
};

module.exports = connectDatabase;
module.exports.connectDatabase = connectDatabase;
module.exports.disconnectDatabase = disconnectDatabase;
module.exports.getDatabaseConnectionOptions = getDatabaseConnectionOptions;