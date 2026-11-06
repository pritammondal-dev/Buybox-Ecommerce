/**
 * Phase E12E — Scheduled Worker Coordination & Deployment Readiness Test Suite
 *
 * Verifies:
 * 1. Multi-instance competition and atomic distributed locking.
 * 2. Token ownership, safe release, and lease renewal guardrails.
 * 3. Graceful lock skipping when a task is currently executing on another instance.
 * 4. Fail-closed behavior during Redis outages to prevent split-brain dual execution.
 * 5. Unified Worker Coordinator startup idempotency and shutdown sequence.
 * 6. Multi-instance safety across Cart Abandonment, Order Expiration, Payment Reconciliation,
 *    Promotion Lifecycle, and Notification Outbox workers.
 * 7. Outbox atomic claiming preventing duplicate queue jobs.
 * 8. Readiness probe lifecycle during normal operations and graceful termination.
 * 9. Production deployment configuration validation (localhost prevention & secret entropy).
 */

const request = require("supertest");
const mongoose = require("mongoose");
const redis = require("../src/config/redis");
const app = require("../src/app");
const NotificationOutbox = require("../src/models/NotificationOutbox");

const {
  acquireDistributedLock,
  releaseDistributedLock,
  renewDistributedLock,
  withDistributedLock,
  generateOwnerToken,
} = require("../src/utils/distributed-lock");

const {
  startAllWorkers,
  stopAllWorkers,
  getWorkerStatus,
  workerRegistry,
} = require("../src/workers/worker-coordinator");

const {
  processCartAbandonmentBatch,
} = require("../src/workers/cart-abandonment.worker");

const {
  processOrderExpirationBatch,
} = require("../src/workers/order-expiration.worker");

const {
  processPaymentReconciliationBatch,
} = require("../src/workers/payment-reconciliation.worker");

const {
  processPromotionLifecycleBatch,
} = require("../src/workers/promotion-lifecycle.worker");

const {
  dispatchPendingNotifications,
} = require("../src/workers/notification-dispatcher.worker");

const {
  validateProductionConfiguration,
} = require("../src/config/production-validator");

describe("PHASE E12E — Scheduled Worker Coordination & Deployment Readiness Test Suite", () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/buybox_test?replicaSet=rs0");
    }
    if (redis.status !== "ready" && redis.status !== "connect") {
      await redis.connect().catch(() => {});
    }
  });

  afterAll(async () => {
    // Ensure all test workers are stopped
    await stopAllWorkers(2000).catch(() => {});

    // Clean up any test lock keys
    const testLocks = await redis.keys("lock:worker:test-*");
    if (testLocks.length > 0) {
      await redis.del(...testLocks);
    }

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  // ============================================================================
  // 1. Multi-Instance Competition & Atomic Distributed Lock
  // ============================================================================
  describe("1. Distributed Lock Multi-Instance Competition", () => {
    const resource = "test-competing-resource";

    afterEach(async () => {
      await redis.del(`lock:worker:${resource}`);
    });

    test("two competing instances: first wins, second is rejected atomically", async () => {
      const tokenInstanceA = generateOwnerToken();
      const tokenInstanceB = generateOwnerToken();

      // Instance A acquires lock
      const resultA = await acquireDistributedLock(resource, {
        ownerToken: tokenInstanceA,
        ttlMs: 10000,
      });

      expect(resultA.acquired).toBe(true);
      expect(resultA.token).toBe(tokenInstanceA);

      // Instance B attempts to acquire the exact same lock concurrently
      const resultB = await acquireDistributedLock(resource, {
        ownerToken: tokenInstanceB,
        ttlMs: 10000,
      });

      expect(resultB.acquired).toBe(false);
      expect(resultB.reason).toBe("ALREADY_LOCKED");

      // Instance A releases the lock
      const releaseA = await releaseDistributedLock(resource, tokenInstanceA);
      expect(releaseA.released).toBe(true);

      // Instance B can now acquire the lock
      const secondAttemptB = await acquireDistributedLock(resource, {
        ownerToken: tokenInstanceB,
        ttlMs: 10000,
      });

      expect(secondAttemptB.acquired).toBe(true);
      await releaseDistributedLock(resource, tokenInstanceB);
    });
  });

  // ============================================================================
  // 2. Lock Ownership, Expiry, and Safe Release Guardrails
  // ============================================================================
  describe("2. Lock Ownership & Safe Release Guardrails", () => {
    const resource = "test-ownership-resource";

    afterEach(async () => {
      await redis.del(`lock:worker:${resource}`);
    });

    test("a stale worker cannot release another worker's lock (Token Mismatch)", async () => {
      const tokenA = generateOwnerToken();
      const tokenB = generateOwnerToken();

      await acquireDistributedLock(resource, { ownerToken: tokenA, ttlMs: 10000 });

      // Stale Worker B tries to release Worker A's lock
      const maliciousOrStaleRelease = await releaseDistributedLock(resource, tokenB);
      expect(maliciousOrStaleRelease.released).toBe(false);
      expect(maliciousOrStaleRelease.reason).toBe("TOKEN_MISMATCH_OR_EXPIRED");

      // Verify Worker A's lock is still intact in Redis
      const currentVal = await redis.get(`lock:worker:${resource}`);
      expect(currentVal).toBe(tokenA);

      // Worker A successfully releases
      const legitimateRelease = await releaseDistributedLock(resource, tokenA);
      expect(legitimateRelease.released).toBe(true);
    });

    test("renewDistributedLock extends active lease if token matches", async () => {
      const token = generateOwnerToken();
      await acquireDistributedLock(resource, { ownerToken: token, ttlMs: 5000 });

      const renewResult = await renewDistributedLock(resource, token, 15000);
      expect(renewResult.renewed).toBe(true);

      const ttl = await redis.pttl(`lock:worker:${resource}`);
      expect(ttl).toBeGreaterThan(5000);

      await releaseDistributedLock(resource, token);
    });

    test("lock expires naturally after TTL window", async () => {
      const token = generateOwnerToken();
      // Short 100ms TTL
      await acquireDistributedLock(resource, { ownerToken: token, ttlMs: 100 });

      await new Promise((resolve) => setTimeout(resolve, 150));

      const exists = await redis.exists(`lock:worker:${resource}`);
      expect(exists).toBe(0);
    });
  });

  // ============================================================================
  // 3. withDistributedLock Higher-Order Wrapper
  // ============================================================================
  describe("3. withDistributedLock Higher-Order Wrapper", () => {
    test("executes task when lock is available and cleans up on completion", async () => {
      let executed = false;

      const result = await withDistributedLock("test-wrapper-task", async () => {
        executed = true;
        return { count: 42 };
      });

      expect(result.executed).toBe(true);
      expect(result.skipped).toBe(false);
      expect(result.result).toEqual({ count: 42 });
      expect(executed).toBe(true);

      // Lock should be released immediately
      const exists = await redis.exists("lock:worker:test-wrapper-task");
      expect(exists).toBe(0);
    });

    test("skips task execution gracefully when lock is already held", async () => {
      // Hold lock externally
      const holdToken = generateOwnerToken();
      await acquireDistributedLock("test-wrapper-locked", { ownerToken: holdToken });

      let attemptedTask = false;
      const result = await withDistributedLock("test-wrapper-locked", async () => {
        attemptedTask = true;
      });

      expect(result.executed).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe("ALREADY_LOCKED");
      expect(attemptedTask).toBe(false);

      await releaseDistributedLock("test-wrapper-locked", holdToken);
    });

    test("fails closed safely when Redis client is unavailable", async () => {
      const mockDisconnectedRedis = {
        status: "close",
        set: jest.fn(),
      };

      const result = await withDistributedLock(
        "test-wrapper-outage",
        async () => "SHOULD_NOT_RUN",
        { client: mockDisconnectedRedis }
      );

      expect(result.executed).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe("REDIS_NOT_READY");
    });
  });

  // ============================================================================
  // 4. Unified Worker Coordinator Lifecycle & Idempotency
  // ============================================================================
  describe("4. Unified Worker Coordinator Lifecycle", () => {
    test("startAllWorkers initializes all schedulers and prevents duplicate startup", () => {
      const firstStart = startAllWorkers();
      expect(firstStart).toBe(true);

      // Second start attempt within the same process must be rejected
      const secondStart = startAllWorkers();
      expect(secondStart).toBe(false);

      const status = getWorkerStatus();
      expect(status.isStarted).toBe(true);
      expect(status.workers.length).toBe(7);
    });

    test("stopAllWorkers halts all timers cleanly", async () => {
      await stopAllWorkers(2000);
      const status = getWorkerStatus();
      expect(status.isStarted).toBe(false);
    });
  });

  // ============================================================================
  // 5. Worker Multi-Instance Distributed Lock Protection
  // ============================================================================
  describe("5. Individual Worker Multi-Instance Lock Enforcement", () => {
    test("processCartAbandonmentBatch skips if another instance holds lock", async () => {
      const token = generateOwnerToken();
      await acquireDistributedLock("cart-abandonment", { ownerToken: token });

      const result = await processCartAbandonmentBatch();
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe("ALREADY_LOCKED");

      await releaseDistributedLock("cart-abandonment", token);
    });

    test("processOrderExpirationBatch skips if another instance holds lock", async () => {
      const token = generateOwnerToken();
      await acquireDistributedLock("order-expiration", { ownerToken: token });

      const result = await processOrderExpirationBatch();
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe("ALREADY_LOCKED");

      await releaseDistributedLock("order-expiration", token);
    });

    test("processPaymentReconciliationBatch skips if another instance holds lock", async () => {
      const token = generateOwnerToken();
      await acquireDistributedLock("payment-reconciliation", { ownerToken: token });

      const result = await processPaymentReconciliationBatch();
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe("ALREADY_LOCKED");

      await releaseDistributedLock("payment-reconciliation", token);
    });

    test("processPromotionLifecycleBatch skips if another instance holds lock", async () => {
      const token = generateOwnerToken();
      await acquireDistributedLock("promotion-lifecycle", { ownerToken: token });

      const result = await processPromotionLifecycleBatch();
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe("ALREADY_LOCKED");

      await releaseDistributedLock("promotion-lifecycle", token);
    });

    test("dispatchPendingNotifications skips if another instance holds lock", async () => {
      const token = generateOwnerToken();
      await acquireDistributedLock("notification-dispatcher", { ownerToken: token });

      const result = await dispatchPendingNotifications();
      expect(result).toBe(0);

      await releaseDistributedLock("notification-dispatcher", token);
    });
  });

  // ============================================================================
  // 6. Outbox Pattern Atomic Claiming
  // ============================================================================
  describe("6. Notification Outbox Atomic Claiming Guardrails", () => {
    test("competing dispatchers cannot claim the same pending outbox notification", async () => {
      // Create a test pending notification
      const testNotification = await NotificationOutbox.create({
        type: "order_confirmation",
        channel: "email",
        recipient: "customer-test@example.com",
        payload: { orderNumber: "ORD-TEST-CLAIM-1" },
        status: "pending",
        availableAt: new Date(Date.now() - 1000),
      });

      // Simulated Dispatcher 1 attempts atomic claim
      const claim1 = await NotificationOutbox.findOneAndUpdate(
        { _id: testNotification._id, status: "pending" },
        { $set: { status: "queued", queuedAt: new Date() } },
        { new: true }
      );

      // Simulated Dispatcher 2 attempts atomic claim on the exact same record
      const claim2 = await NotificationOutbox.findOneAndUpdate(
        { _id: testNotification._id, status: "pending" },
        { $set: { status: "queued", queuedAt: new Date() } },
        { new: true }
      );

      expect(claim1).not.toBeNull();
      expect(claim1.status).toBe("queued");
      expect(claim2).toBeNull(); // Dispatcher 2 is rejected because status is no longer 'pending'

      // Clean up test document
      await NotificationOutbox.deleteOne({ _id: testNotification._id });
    });
  });

  // ============================================================================
  // 7. Health & Readiness Probe Lifecycle
  // ============================================================================
  describe("7. Health & Readiness Probes Under Lifecycle Transitions", () => {
    test("GET /health returns 200 OK", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("ok");
    });

    test("GET /liveness returns 200 OK", async () => {
      const res = await request(app).get("/liveness");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("alive");
    });

    test("GET /readiness returns 200 OK during normal healthy operations", async () => {
      app.locals.isShuttingDown = false;
      const res = await request(app).get("/readiness");
      expect(res.status).toBe(200);
      expect(res.body.ready).toBe(true);
      expect(res.body.status).toBe("ready");
    });

    test("GET /readiness returns 503 terminating when isShuttingDown is true", async () => {
      app.locals.isShuttingDown = true;
      const res = await request(app).get("/readiness");
      expect(res.status).toBe(503);
      expect(res.body.ready).toBe(false);
      expect(res.body.status).toBe("terminating");
      app.locals.isShuttingDown = false;
    });
  });

  // ============================================================================
  // 8. Production Deployment Configuration Validation
  // ============================================================================
  describe("8. Production Deployment Configuration Validation", () => {
    test("passes cleanly in development/test environment without restrictions", () => {
      const devConfig = {
        BACKEND_URL: "http://localhost:5000",
        FRONTEND_URL: "http://localhost:3000",
      };
      const result = validateProductionConfiguration(devConfig, "development");
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    test("rejects localhost URLs in production mode", () => {
      const badProdConfig = {
        BACKEND_URL: "http://localhost:5000",
        FRONTEND_URL: "http://localhost:3000",
        EMAIL_VERIFICATION_BASE_URL: "http://localhost:5000/api/v1/auth/verify-email",
        PASSWORD_RESET_BASE_URL: "http://localhost:5000/api/v1/auth/reset-password",
        JWT_ACCESS_SECRET: "short",
        JWT_REFRESH_SECRET: "short",
        CREDENTIAL_ENCRYPTION_KEY: "short",
      };

      const result = validateProductionConfiguration(badProdConfig, "production");
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("BACKEND_URL"))).toBe(true);
      expect(result.errors.some((e) => e.includes("FRONTEND_URL"))).toBe(true);
      expect(result.errors.some((e) => e.includes("JWT_ACCESS_SECRET"))).toBe(true);
      expect(result.errors.some((e) => e.includes("CREDENTIAL_ENCRYPTION_KEY"))).toBe(true);
    });

    test("approves valid production configuration with public domains and high entropy", () => {
      const validProdConfig = {
        BACKEND_URL: "https://api.buybox.com",
        FRONTEND_URL: "https://buybox.com",
        EMAIL_VERIFICATION_BASE_URL: "https://api.buybox.com/api/v1/auth/verify-email",
        PASSWORD_RESET_BASE_URL: "https://api.buybox.com/api/v1/auth/reset-password",
        JWT_ACCESS_SECRET: "a-very-long-random-access-secret-32-chars-minimum!!",
        JWT_REFRESH_SECRET: "a-very-long-random-refresh-secret-32-chars-minimum!!",
        CREDENTIAL_ENCRYPTION_KEY: "encryption-key-for-credentials-32-chars-minimum!",
        MEDIA_STORAGE_PROVIDER: "s3",
        S3_BUCKET: "buybox-production-media",
        S3_ACCESS_KEY_ID: "AKIA_VALID_KEY_EXAMPLE",
        S3_SECRET_ACCESS_KEY: "VALID_SECRET_ACCESS_KEY_EXAMPLE",
        TRUST_PROXY: "1",
        MONGODB_URI: "mongodb+srv://user:pass@cluster.mongodb.net/buybox?retryWrites=true",
      };

      const result = validateProductionConfiguration(validProdConfig, "production");
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });
  });
});
