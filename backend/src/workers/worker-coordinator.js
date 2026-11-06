/**
 * Phase E12E — Unified Background Worker Coordinator
 *
 * Coordinates lifecycle, health, concurrency, and graceful shutdown across all
 * Buybox background tasks:
 * 1. Cart Abandonment Scheduler (Distributed Lock)
 * 2. Order Expiration Scheduler (Distributed Lock)
 * 3. Payment Reconciliation Scheduler (Distributed Lock)
 * 4. Promotion Lifecycle Scheduler (Distributed Lock)
 * 5. Notification Dispatcher (Distributed Lock + Outbox Claiming)
 * 6. BullMQ Notification Queue Worker (Native Redis Job Distribution)
 */

const logger = require("../config/logger");
const redis = require("../config/redis");

const {
  processCartAbandonmentBatch,
  runCartAbandonmentScheduler,
  stopCartAbandonmentScheduler,
} = require("./cart-abandonment.worker");

const {
  processOrderExpirationBatch,
  runOrderExpirationScheduler,
  stopOrderExpirationScheduler,
} = require("./order-expiration.worker");

const {
  processPaymentReconciliationBatch,
  runPaymentReconciliationScheduler,
  stopPaymentReconciliationScheduler,
} = require("./payment-reconciliation.worker");

const {
  processPromotionLifecycleBatch,
  runPromotionLifecycleScheduler,
  stopPromotionLifecycleScheduler,
} = require("./promotion-lifecycle.worker");

const {
  dispatchPendingNotifications,
  runNotificationDispatcher,
  stopNotificationDispatcher,
} = require("./notification-dispatcher.worker");

const {
  notificationWorker,
  stopNotificationQueueWorker,
} = require("./notification-queue.worker");

const {
  processVendorSettlementBatch,
  runVendorSettlementScheduler,
  stopVendorSettlementScheduler,
} = require("./vendor-settlement.worker");

let isStarted = false;
let isStopping = false;

const workerRegistry = {
  cartAbandonment: {
    name: "cart-abandonment",
    type: "scheduled",
    start: runCartAbandonmentScheduler,
    stop: stopCartAbandonmentScheduler,
    run: processCartAbandonmentBatch,
  },
  orderExpiration: {
    name: "order-expiration",
    type: "scheduled",
    start: runOrderExpirationScheduler,
    stop: stopOrderExpirationScheduler,
    run: processOrderExpirationBatch,
  },
  paymentReconciliation: {
    name: "payment-reconciliation",
    type: "scheduled",
    start: runPaymentReconciliationScheduler,
    stop: stopPaymentReconciliationScheduler,
    run: processPaymentReconciliationBatch,
  },
  promotionLifecycle: {
    name: "promotion-lifecycle",
    type: "scheduled",
    start: runPromotionLifecycleScheduler,
    stop: stopPromotionLifecycleScheduler,
    run: processPromotionLifecycleBatch,
  },
  notificationDispatcher: {
    name: "notification-dispatcher",
    type: "scheduled",
    start: runNotificationDispatcher,
    stop: stopNotificationDispatcher,
    run: dispatchPendingNotifications,
  },
  vendorSettlement: {
    name: "vendor-settlement",
    type: "scheduled",
    start: runVendorSettlementScheduler,
    stop: stopVendorSettlementScheduler,
    run: processVendorSettlementBatch,
  },
  notificationQueueWorker: {
    name: "notification-queue-worker",
    type: "queue-consumer",
    worker: notificationWorker,
    stop: stopNotificationQueueWorker,
  },
};

/**
 * Starts all background workers and schedulers in a controlled manner.
 * Idempotent: Guards against duplicate initialization within the same process.
 */
function startAllWorkers() {
  if (isStarted) {
    logger.warn("Worker coordinator: startAllWorkers called but workers are already running.");
    return false;
  }

  isStarted = true;
  isStopping = false;
  logger.info("Initializing Buybox background worker coordinator...");

  // Start schedulers
  workerRegistry.notificationDispatcher.start();
  workerRegistry.cartAbandonment.start();
  workerRegistry.paymentReconciliation.start();
  workerRegistry.orderExpiration.start();
  workerRegistry.promotionLifecycle.start();
  workerRegistry.vendorSettlement.start();

  // BullMQ Worker setup
  logger.info("Notification queue worker initialized");

  if (notificationWorker) {
    notificationWorker.on("ready", () => {
      logger.info("Notification queue worker is ready");
    });

    notificationWorker.on("error", (error) => {
      logger.error(
        {
          error: error.message,
          stack: error.stack,
        },
        "Notification queue worker error"
      );
    });
  }

  logger.info("All background schedulers and queue workers initialized successfully.");
  return true;
}

/**
 * Gracefully stops all background workers and allows active jobs to finish within a bounded timeout.
 *
 * @param {number} [timeoutMs=10000] Maximum milliseconds to wait for queue closure
 */
async function stopAllWorkers(timeoutMs = 10000) {
  if (!isStarted && !isStopping) {
    return;
  }

  isStopping = true;
  logger.info("Gracefully stopping all background worker schedulers...");

  // 1. Immediately halt all recurring scheduler timers so no new intervals trigger
  workerRegistry.notificationDispatcher.stop();
  workerRegistry.cartAbandonment.stop();
  workerRegistry.paymentReconciliation.stop();
  workerRegistry.orderExpiration.stop();
  workerRegistry.promotionLifecycle.stop();
  workerRegistry.vendorSettlement.stop();

  // 2. Stop BullMQ queue worker and allow in-flight job completion
  try {
    const closePromise = stopNotificationQueueWorker();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Worker shutdown timed out")), timeoutMs)
    );

    await Promise.race([closePromise, timeoutPromise]);
    logger.info("Notification queue worker closed gracefully.");
  } catch (error) {
    logger.error(
      {
        error: error.message,
      },
      "Failed or timed out closing notification queue worker"
    );
  }

  isStarted = false;
  isStopping = false;
  logger.info("All background workers stopped.");
}

/**
 * Returns diagnostic observability status for all registered workers
 */
function getWorkerStatus() {
  return {
    isStarted,
    isStopping,
    redisStatus: redis ? redis.status : "unknown",
    workers: Object.keys(workerRegistry).map((key) => {
      const w = workerRegistry[key];
      return {
        id: key,
        name: w.name,
        type: w.type,
      };
    }),
  };
}

module.exports = {
  startAllWorkers,
  stopAllWorkers,
  getWorkerStatus,
  workerRegistry,
};
