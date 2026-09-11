const paymentReconciliationService = require("../services/payment-reconciliation.service");
const env = require("../config/env");
const logger = require("../config/logger");

let isProcessing = false;
let schedulerTimer = null;

const processPaymentReconciliationBatch = async (options = {}) => {
  if (isProcessing) {
    return { skipped: true, reason: "ALREADY_PROCESSING" };
  }

  isProcessing = true;

  try {
    const result =
      await paymentReconciliationService.reconcileActivePaymentsBatch(options);
    return result;
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
