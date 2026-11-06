/**
 * BUYBOX E-COMMERCE — DISTRIBUTED REDIS RATE LIMIT STORE
 *
 * Implements the express-rate-limit v8 Store interface backed by ioredis.
 *
 * Core Features:
 * 1. Atomic Lua execution for INCR + PEXPIRE + PTTL (zero race conditions).
 * 2. Cross-instance distributed rate limiting across horizontal container replicas.
 * 3. Namespaced prefixing (e.g. rl:login:) preventing key collisions with BullMQ queues.
 * 4. Deliberate, configurable Redis outage policies:
 *    - "fail-closed": Strictly blocks requests on sensitive abuse-prone endpoints (login, registration, OTP).
 *    - "fallback-memory": Preserves availability under local in-memory caps for business transactions (checkout, payment).
 *    Never leaves any request path unbounded.
 */

const LUA_INCR = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { current, ttl }
`;

const LUA_DECR = `
local current = redis.call('DECR', KEYS[1])
if current <= 0 then
  redis.call('DEL', KEYS[1])
end
return current
`;

class RedisRateLimitStore {
  /**
   * @param {Object} options
   * @param {import("ioredis")} options.client - ioredis client instance
   * @param {string} [options.prefix="rl:"] - Redis key prefix
   * @param {"fail-closed"|"fallback-memory"} [options.failPolicy="fallback-memory"] - Outage behavior
   */
  constructor(options = {}) {
    if (!options.client) {
      throw new Error("[RedisRateLimitStore] An active ioredis client must be provided.");
    }

    this.client = options.client;
    this.prefix = options.prefix || "rl:";
    this.failPolicy = options.failPolicy || "fallback-memory";
    this.windowMs = 60 * 1000; // Default window, updated via init()
    this.localKeys = false; // Distributed store flag

    // In-memory fallback tracking for graceful degradation
    this.fallbackMemory = new Map();
    this.lastOutageLog = 0;
  }

  /**
   * Initialize store with express-rate-limit middleware options.
   * @param {Object} options
   */
  init(options) {
    if (options && options.windowMs) {
      this.windowMs = options.windowMs;
    }
  }

  /**
   * Check if Redis client is currently in a connected and usable state.
   * @returns {boolean}
   */
  isRedisReady() {
    return this.client.status === "ready" || this.client.status === "connect";
  }

  /**
   * Log outage alerts with rate-limiting on log spam (once every 10 seconds).
   * @param {string} message
   */
  logOutage(message) {
    const now = Date.now();
    if (now - this.lastOutageLog > 10000) {
      console.warn(`[RedisRateLimitStore] ${message}`);
      this.lastOutageLog = now;
    }
  }

  /**
   * Increment request hit counter for key.
   * @param {string} key
   * @returns {Promise<{ totalHits: number, resetTime: Date }>}
   */
  async increment(key) {
    const fullKey = `${this.prefix}${key}`;

    if (!this.isRedisReady()) {
      return this.handleOutage(key);
    }

    try {
      const results = await this.client.eval(
        LUA_INCR,
        1,
        fullKey,
        String(this.windowMs)
      );

      const totalHits = Number(results[0]);
      const ttl = Number(results[1]);
      const resetTime = new Date(Date.now() + Math.max(0, ttl));

      return { totalHits, resetTime };
    } catch (err) {
      this.logOutage(`Redis increment failed for '${fullKey}': ${err.message}. Invoking ${this.failPolicy} policy.`);
      return this.handleOutage(key);
    }
  }

  /**
   * Decrement request hit counter for key.
   * @param {string} key
   * @returns {Promise<void>}
   */
  async decrement(key) {
    const fullKey = `${this.prefix}${key}`;

    if (!this.isRedisReady()) {
      const mem = this.fallbackMemory.get(key);
      if (mem && mem.totalHits > 0) {
        mem.totalHits -= 1;
      }
      return;
    }

    try {
      await this.client.eval(LUA_DECR, 1, fullKey);
    } catch (err) {
      this.logOutage(`Redis decrement failed for '${fullKey}': ${err.message}`);
    }
  }

  /**
   * Reset request counter for specific key.
   * @param {string} key
   * @returns {Promise<void>}
   */
  async resetKey(key) {
    const fullKey = `${this.prefix}${key}`;
    this.fallbackMemory.delete(key);

    if (!this.isRedisReady()) return;

    try {
      await this.client.del(fullKey);
    } catch (err) {
      this.logOutage(`Redis resetKey failed for '${fullKey}': ${err.message}`);
    }
  }

  /**
   * Handle Redis unavailability according to configured policy.
   * @param {string} key
   * @returns {{ totalHits: number, resetTime: Date }}
   */
  handleOutage(key) {
    const now = Date.now();

    // 1. Strict Fail-Closed Policy for sensitive routes
    if (this.failPolicy === "fail-closed") {
      this.logOutage(`Security enforcement: blocking sensitive request for key '${key}' due to Redis outage.`);
      // Return infinity to immediately trigger rate limit handler
      return {
        totalHits: Number.MAX_SAFE_INTEGER,
        resetTime: new Date(now + this.windowMs),
      };
    }

    // 2. Fallback In-Memory Policy for transactional routes
    let record = this.fallbackMemory.get(key);
    if (!record || record.resetTime <= now) {
      record = {
        totalHits: 1,
        resetTime: now + this.windowMs,
      };
    } else {
      record.totalHits += 1;
    }

    this.fallbackMemory.set(key, record);

    return {
      totalHits: record.totalHits,
      resetTime: new Date(record.resetTime),
    };
  }

  /**
   * Clean up in-memory records and shutdown.
   */
  shutdown() {
    this.fallbackMemory.clear();
  }
}

module.exports = RedisRateLimitStore;
