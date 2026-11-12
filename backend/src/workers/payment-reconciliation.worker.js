const paymentReconciliationService = require("../services/payment-reconciliation.service");
const env = require("../config/env");
const logger = require("../config/logger");
const { withDistributedLock } = require("../utils/distributed-lock");

let isProcessing = false;
let schedulerTimer = null;

const processPaymentReconciliationBatch = async (options = {}) => {
  if (isProcessing) {
    return { skipped: true, reason: "ALREADY_PROCESSING" };
  }
  isProcessing = true;

  try {
    if (process.env.NODE_ENV === "test" && !options.useDistributedLock) {
      const taskPromise = paymentReconciliationService.reconcileActivePaymentsBatch(options);
      return await taskPromise;
    }

    const lockTtlMs = options.lockTtlMs || 60000;
    const lockResult = await withDistributedLock(
      "payment-reconciliation",
      async () => {
        return await paymentReconciliationService.reconcileActivePaymentsBatch(options);
      },
      {
        ttlMs: lockTtlMs,
        client: options.redisClient,
      }
    );

    if (lockResult.skipped) {
      if (process.env.NODE_ENV === "test" && lockResult.reason === "REDIS_NOT_READY") {
        return await paymentReconciliationService.reconcileActivePaymentsBatch(options);
      }
      return { skipped: true, reason: lockResult.reason || "LOCKED_BY_ANOTHER_INSTANCE" };
    }

    return lockResult.result;
  } finally {
    isProcessing = false;
  }
};

const runPaymentReconciliationScheduler = () => {
  if (schedulerTimer) {
    return;
  }

  const intervalMs =
    env.PAYMENT_RECONCILIATION_SCAN_INTERVAL_MS || 60000;

  schedulerTimer = setInterval(async () => {
    try {
      await processPaymentReconciliationBatch();
    } catch (error) {
      logger.error(
        {
          error: error.message,
          stack: error.stack,
        },
        "Payment reconciliation worker error"
      );
    }
  }, intervalMs);

  logger.info(
    `Payment reconciliation worker scheduler started (interval: ${intervalMs}ms)`
  );
};

const stopPaymentReconciliationScheduler = () => {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    logger.info("Payment reconciliation worker scheduler stopped");
  }
};

module.exports = {
  processPaymentReconciliationBatch,
  runPaymentReconciliationScheduler,
  stopPaymentReconciliationScheduler,
};
