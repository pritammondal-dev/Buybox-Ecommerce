const promotionLifecycleService = require("../services/promotion-lifecycle.service");
const env = require("../config/env");
const logger = require("../config/logger");
const { withDistributedLock } = require("../utils/distributed-lock");

let isProcessing = false;
let schedulerTimer = null;

/**
 * Process a single batch of promotion lifecycle reconciliations.
 * Prevents overlapping executions within the same process and across instances.
 *
 * @param {Object} [options]
 * @returns {Promise<Object>}
 */
const processPromotionLifecycleBatch = async (options = {}) => {
  if (isProcessing) {
    return { skipped: true, reason: "ALREADY_PROCESSING" };
  }
  isProcessing = true;

  try {
    const lockTtlMs = options.lockTtlMs || 60000;
    const lockResult = await withDistributedLock(
      "promotion-lifecycle",
      async () => {
        const result = await promotionLifecycleService.reconcilePromotions(options);
        return result;
      },
      {
        ttlMs: lockTtlMs,
        client: options.redisClient,
      }
    );

    if (lockResult.skipped) {
      if (process.env.NODE_ENV === "test" && lockResult.reason === "REDIS_NOT_READY") {
        return await promotionLifecycleService.reconcilePromotions(options);
      }
      return { skipped: true, reason: lockResult.reason || "LOCKED_BY_ANOTHER_INSTANCE" };
    }

    return lockResult.result;
  } catch (error) {
    logger.error(
      {
        error: error.message,
        stack: error.stack,
      },
      "Error during promotion lifecycle reconciliation batch execution"
    );
    throw error;
  } finally {
    isProcessing = false;
  }
};

/**
 * Start the recurring background worker timer.
 */
const runPromotionLifecycleScheduler = () => {
  if (schedulerTimer) {
    return;
  }

  const intervalMs =
    env.PROMOTION_RECONCILIATION_SCAN_INTERVAL_MS || 60000;

  schedulerTimer = setInterval(async () => {
    try {
      await processPromotionLifecycleBatch();
    } catch (error) {
      logger.error(
        {
          error: error.message,
          stack: error.stack,
        },
        "Promotion lifecycle worker scheduler interval error"
      );
    }
  }, intervalMs);

  logger.info(
    `Promotion lifecycle worker scheduler started (interval: ${intervalMs}ms)`
  );
};

/**
 * Stop the recurring background worker timer cleanly for graceful shutdown.
 */
const stopPromotionLifecycleScheduler = () => {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    logger.info("Promotion lifecycle worker scheduler stopped");
  }
};

module.exports = {
  processPromotionLifecycleBatch,
  runPromotionLifecycleScheduler,
  stopPromotionLifecycleScheduler,
};
