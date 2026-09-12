const orderExpirationService = require("../services/order-expiration.service");
const env = require("../config/env");
const logger = require("../config/logger");

let isProcessing = false;
let schedulerTimer = null;

const processOrderExpirationBatch = async (options = {}) => {
  if (isProcessing) {
    return { skipped: true, reason: "ALREADY_PROCESSING" };
  }

  isProcessing = true;

  try {
    const result =
      await orderExpirationService.reconcileAndExpirePendingOrders(options);
    return result;
  } finally {
    isProcessing = false;
  }
};

const runOrderExpirationScheduler = () => {
  if (schedulerTimer) {
    return;
  }

  const intervalMs =
    env.ORDER_EXPIRATION_SCAN_INTERVAL_MS || 60000;

  schedulerTimer = setInterval(async () => {
    try {
      await processOrderExpirationBatch();
    } catch (error) {
      logger.error(
        {
          error: error.message,
          stack: error.stack,
        },
        "Order expiration worker scheduler error"
      );
    }
  }, intervalMs);

  logger.info(
    `Order expiration worker scheduler started (interval: ${intervalMs}ms)`
  );
};

const stopOrderExpirationScheduler = () => {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    logger.info("Order expiration worker scheduler stopped");
  }
};

module.exports = {
  processOrderExpirationBatch,
  runOrderExpirationScheduler,
  stopOrderExpirationScheduler,
};
