/**
 * Phase E12E — Enterprise Redis Distributed Lock
 *
 * Implements atomic distributed locking for multi-instance background workers using:
 * - Atomic acquisition: SET <key> <token> NX PX <ttlMs>
 * - Atomic release: Lua script ensuring only the token owner can release the lock
 * - Atomic renewal: Lua script allowing lease extension for active batches
 * - Fail-closed outage behavior: Skips execution on Redis outage to prevent multi-instance split-brain runs
 */

const crypto = require("crypto");
const defaultRedis = require("../config/redis");
const defaultLogger = require("../config/logger");

const RELEASE_LOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

const RENEW_LOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("pexpire", KEYS[1], ARGV[2])
else
  return 0
end
`;

/**
 * Generates an opaque, unique owner token
 */
function generateOwnerToken() {
  const random = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
  return `worker-${process.pid}-${Date.now()}-${random}`;
}

/**
 * Attempts to acquire an atomic distributed lock in Redis.
 *
 * @param {string} resource Name of the resource/worker (e.g. 'cart-abandonment')
 * @param {Object} [options]
 * @param {number} [options.ttlMs=60000] Lease duration in milliseconds
 * @param {string} [options.ownerToken] Explicit token identifier
 * @param {string} [options.prefix='lock:worker:'] Redis key prefix
 * @param {Object} [options.client] Alternative Redis client
 * @returns {Promise<{ acquired: boolean, token?: string, lockKey: string, reason?: string }>}
 */
async function acquireDistributedLock(resource, options = {}) {
  const {
    ttlMs = 60000,
    ownerToken = generateOwnerToken(),
    prefix = "lock:worker:",
    client = defaultRedis,
  } = options;

  const lockKey = `${prefix}${resource}`;

  try {
    if (!client || (client.status && client.status !== "ready" && client.status !== "connect")) {
      return {
        acquired: false,
        lockKey,
        reason: "REDIS_NOT_READY",
      };
    }

    const result = await client.set(lockKey, ownerToken, "PX", ttlMs, "NX");
    if (result === "OK") {
      return {
        acquired: true,
        token: ownerToken,
        lockKey,
        ttlMs,
      };
    }

    return {
      acquired: false,
      lockKey,
      reason: "ALREADY_LOCKED",
    };
  } catch (error) {
    defaultLogger.warn(
      { resource, lockKey, error: error.message },
      "Distributed lock acquisition failed due to Redis error (fail-closed)"
    );
    return {
      acquired: false,
      lockKey,
      reason: "REDIS_ERROR",
      error: error.message,
    };
  }
}

/**
 * Atomically releases a distributed lock if and only if the owner token matches.
 *
 * @param {string} resource Name of the resource/worker
 * @param {string} ownerToken Token used when acquiring the lock
 * @param {Object} [options]
 * @returns {Promise<{ released: boolean, lockKey: string, reason?: string }>}
 */
async function releaseDistributedLock(resource, ownerToken, options = {}) {
  const {
    prefix = "lock:worker:",
    client = defaultRedis,
  } = options;

  const lockKey = `${prefix}${resource}`;

  if (!ownerToken) {
    return { released: false, lockKey, reason: "MISSING_OWNER_TOKEN" };
  }

  try {
    if (!client || (client.status && client.status !== "ready" && client.status !== "connect")) {
      return { released: false, lockKey, reason: "REDIS_NOT_READY" };
    }

    const result = await client.eval(RELEASE_LOCK_LUA, 1, lockKey, ownerToken);
    return {
      released: result === 1,
      lockKey,
      reason: result === 1 ? undefined : "TOKEN_MISMATCH_OR_EXPIRED",
    };
  } catch (error) {
    defaultLogger.warn(
      { resource, lockKey, error: error.message },
      "Distributed lock release failed due to Redis error"
    );
    return {
      released: false,
      lockKey,
      reason: "REDIS_ERROR",
      error: error.message,
    };
  }
}

/**
 * Atomically renews the lease on an active distributed lock.
 *
 * @param {string} resource Name of the resource
 * @param {string} ownerToken Token used when acquiring the lock
 * @param {number} extensionTtlMs Additional milliseconds to extend the lease
 * @param {Object} [options]
 * @returns {Promise<{ renewed: boolean, lockKey: string, reason?: string }>}
 */
async function renewDistributedLock(resource, ownerToken, extensionTtlMs = 60000, options = {}) {
  const {
    prefix = "lock:worker:",
    client = defaultRedis,
  } = options;

  const lockKey = `${prefix}${resource}`;

  if (!ownerToken) {
    return { renewed: false, lockKey, reason: "MISSING_OWNER_TOKEN" };
  }

  try {
    if (!client || (client.status && client.status !== "ready" && client.status !== "connect")) {
      return { renewed: false, lockKey, reason: "REDIS_NOT_READY" };
    }

    const result = await client.eval(RENEW_LOCK_LUA, 1, lockKey, ownerToken, extensionTtlMs);
    return {
      renewed: result === 1,
      lockKey,
      reason: result === 1 ? undefined : "TOKEN_MISMATCH_OR_EXPIRED",
    };
  } catch (error) {
    defaultLogger.warn(
      { resource, lockKey, error: error.message },
      "Distributed lock renewal failed due to Redis error"
    );
    return {
      renewed: false,
      lockKey,
      reason: "REDIS_ERROR",
      error: error.message,
    };
  }
}

/**
 * Higher-order wrapper that executes a task exclusively across backend instances.
 * If the lock cannot be acquired, execution is safely skipped.
 *
 * @param {string} resource Worker/task identifier
 * @param {Function} taskFn Async task function
 * @param {Object} [options]
 * @param {number} [options.ttlMs=60000]
 * @returns {Promise<{ executed: boolean, skipped?: boolean, reason?: string, result?: any }>}
 */
async function withDistributedLock(resource, taskFn, options = {}) {
  const lock = await acquireDistributedLock(resource, options);

  if (!lock.acquired) {
    return {
      executed: false,
      skipped: true,
      reason: lock.reason || "LOCK_NOT_ACQUIRED",
      lockKey: lock.lockKey,
    };
  }

  try {
    const result = await taskFn({
      token: lock.token,
      renew: (ttl) => renewDistributedLock(resource, lock.token, ttl, options),
    });

    return {
      executed: true,
      skipped: false,
      result,
    };
  } finally {
    await releaseDistributedLock(resource, lock.token, options);
  }
}

module.exports = {
  acquireDistributedLock,
  releaseDistributedLock,
  renewDistributedLock,
  withDistributedLock,
  generateOwnerToken,
  RELEASE_LOCK_LUA,
  RENEW_LOCK_LUA,
};
