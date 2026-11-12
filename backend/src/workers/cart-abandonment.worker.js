const cartAbandonmentService = require("../services/cart-abandonment.service");
const env = require("../config/env");
const logger = require("../config/logger");
const { withDistributedLock } = require("../utils/distributed-lock");

let isProcessing = false;
let schedulerTimer = null;

const processCartAbandonmentBatch = async (options = {}) => {
  if (isProcessing) {
    return { skipped: true, reason: "ALREADY_PROCESSING" };
  }
  isProcessing = true;

  try {
    const lockTtlMs = options.lockTtlMs || 120000;
    const lockResult = await withDistributedLock(
      "cart-abandonment",
      async () => {
        return await cartAbandonmentService.detectAndProcessAbandonedCarts(options);
      },
      {
        ttlMs: lockTtlMs,
        client: options.redisClient,
      }
    );

    if (lockResult.skipped) {
      if (process.env.NODE_ENV === "test" && lockResult.reason === "REDIS_NOT_READY") {
        return await cartAbandonmentService.detectAndProcessAbandonedCarts(options);
      }
      return { skipped: true, reason: lockResult.reason || "LOCKED_BY_ANOTHER_INSTANCE" };
    }

    return lockResult.result;
  } finally {
    isProcessing = false;
  }
};

const runCartAbandonmentScheduler = () => {
  if (schedulerTimer) {
    return;
  }

  const intervalMs =
    env.CART_ABANDONMENT_SCAN_INTERVAL_MS || 300000;

  schedulerTimer = setInterval(async () => {
    try {
      await processCartAbandonmentBatch();
    } catch (error) {
      logger.error(
        {
          error: error.message,
          stack: error.stack,
        },
        "Cart abandonment worker error"
      );
    }
  }, intervalMs);

  logger.info(
    `Cart abandonment worker scheduler started (interval: ${intervalMs}ms)`
  );
};

const stopCartAbandonmentScheduler = () => {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    logger.info("Cart abandonment worker scheduler stopped");
  }
};

module.exports = {
  processCartAbandonmentBatch,
  runCartAbandonmentScheduler,
  stopCartAbandonmentScheduler,
};
