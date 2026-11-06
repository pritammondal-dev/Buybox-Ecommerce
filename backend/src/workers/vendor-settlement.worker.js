/**
 * Phase VENDOR-WALLET-B — Automated Vendor Settlement Worker
 *
 * Implements scheduled, autonomous settlement maturation for vendor earnings:
 * 1. Evaluates delivered orders past their authoritative return-window policy.
 * 2. Enforces active return/refund, dispute, chargeback, compliance, and account holds.
 * 3. Utilizes Redis distributed locking to prevent multi-instance concurrency collisions.
 * 4. Posts balanced double-entry ledger journals transferring pending earnings to available balance.
 * 5. Synchronizes wallet projections with atomic transactional recovery.
 */

const crypto = require("crypto");
const vendorSettlementService = require("../services/vendor-settlement.service");
const env = require("../config/env");
const logger = require("../config/logger");
const { withDistributedLock } = require("../utils/distributed-lock");

let isProcessing = false;
let schedulerTimer = null;

/**
 * Generates an auditable, opaque execution ID
 */
const generateExecutionId = () => {
  const random = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(8).toString("hex");
  return `exec-settlement-${Date.now()}-${random}`;
};

/**
 * Executes a single bounded batch of eligible vendor settlements under distributed lock
 *
 * @param {Object} [options]
 * @param {number} [options.batchSize] Maximum vendors to evaluate in this batch
 * @param {number} [options.lockTtlMs=120000] Distributed lock lease duration
 * @param {string} [options.vendorId] Optional targeted vendor ID
 * @param {Object} [options.redisClient] Custom Redis client for tests
 * @returns {Promise<Object>} Execution summary
 */
const processVendorSettlementBatch = async (options = {}) => {
  if (isProcessing) {
    logger.warn("Vendor settlement worker: batch already in progress within this process, skipping.");
    return { skipped: true, reason: "ALREADY_PROCESSING" };
  }

  const executionId = generateExecutionId();
  const lockTtlMs = options.lockTtlMs || 120000;
  const batchSize = options.batchSize || env.VENDOR_SETTLEMENT_BATCH_SIZE || 50;

  const lockResult = await withDistributedLock(
    "vendor-settlement",
    async () => {
      isProcessing = true;
      const startTime = Date.now();
      logger.info(
        {
          executionId,
          batchSize,
          vendorId: options.vendorId || "ALL_ELIGIBLE",
        },
        "Vendor settlement worker batch started"
      );

      try {
        const settlements = await vendorSettlementService.generateEligibleSettlements({
          vendorId: options.vendorId || null,
          batchSize,
          idempotencyKey: executionId,
        });

        const durationMs = Date.now() - startTime;
        const totalMaturedAmount = settlements.reduce(
          (sum, s) => sum + Number(s.netPayable?.toString() || 0),
          0
        );

        const summary = {
          executionId,
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          durationMs,
          settlementsGenerated: settlements.length,
          totalMaturedAmount: totalMaturedAmount.toFixed(2),
          failures: settlements.failures || [],
          failureCount: (settlements.failures || []).length,
        };

        logger.info(
          {
            executionId,
            durationMs,
            settlementsGenerated: summary.settlementsGenerated,
            totalMaturedAmount: summary.totalMaturedAmount,
            failureCount: summary.failureCount,
          },
          "Vendor settlement worker batch completed successfully"
        );

        return summary;
      } catch (error) {
        const durationMs = Date.now() - startTime;
        logger.error(
          {
            executionId,
            durationMs,
            error: error.message,
            stack: error.stack,
          },
          "Vendor settlement worker batch failed with unhandled error"
        );
        throw error;
      } finally {
        isProcessing = false;
      }
    },
    {
      ttlMs: lockTtlMs,
      client: options.redisClient,
    }
  );

  if (lockResult.skipped) {
    logger.debug(
      { reason: lockResult.reason },
      "Vendor settlement worker batch skipped due to lock contention or Redis unavailability"
    );
    return {
      skipped: true,
      reason: lockResult.reason || "LOCKED_BY_ANOTHER_INSTANCE",
    };
  }

  return lockResult.result;
};

/**
 * Starts the recurring settlement scheduler
 */
const runVendorSettlementScheduler = () => {
  if (schedulerTimer) {
    logger.warn("Vendor settlement scheduler is already running.");
    return;
  }

  const intervalMs = env.VENDOR_SETTLEMENT_SCAN_INTERVAL_MS || 3600000;

  schedulerTimer = setInterval(async () => {
    try {
      await processVendorSettlementBatch();
    } catch (error) {
      logger.error(
        {
          error: error.message,
          stack: error.stack,
        },
        "Vendor settlement worker interval trigger failed"
      );
    }
  }, intervalMs);

  logger.info(
    `Vendor settlement worker scheduler started (interval: ${intervalMs}ms)`
  );
};

/**
 * Halts the recurring settlement scheduler cleanly
 */
const stopVendorSettlementScheduler = () => {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    logger.info("Vendor settlement worker scheduler stopped");
  }
};

module.exports = {
  processVendorSettlementBatch,
  runVendorSettlementScheduler,
  stopVendorSettlementScheduler,
};

