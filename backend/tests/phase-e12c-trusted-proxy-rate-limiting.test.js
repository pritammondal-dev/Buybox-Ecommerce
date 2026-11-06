const express = require("express");
const request = require("supertest");
const {
  parseTrustProxySetting,
  configureTrustProxy,
} = require("../src/config/proxy");
const RedisRateLimitStore = require("../src/middlewares/rate-limit-redis-store");
const {
  createRateLimiter,
  resolveClientKey,
  authLoginLimiter,
  authRegistrationLimiter,
  tokenRefreshLimiter,
  otpRequestLimiter,
  otpVerificationLimiter,
  otpResendLimiter,
  accountSecurityLimiter,
  checkoutLimiter,
  paymentLimiter,
  webhookLimiter,
  digitalDownloadLimiter,
  uploadLimiter,
  adminSensitiveOpLimiter,
  globalApiLimiter,
} = require("../src/middlewares/rate-limiter.middleware");
const mongoose = require("mongoose");
const redis = require("../src/config/redis");
const app = require("../src/app");

describe("PHASE E12C — Trusted Proxy Configuration & Distributed Rate Limiting Test Suite", () => {
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    // Ensure Mongoose connection is active for readiness check
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/buybox_test?replicaSet=rs0");
    }
    // Ensure Redis connection is active
    if (redis.status !== "ready" && redis.status !== "connect") {
      await redis.connect().catch(() => {});
    }
  });

  afterAll(async () => {
    // Cleanup any test keys
    const testKeys = await redis.keys("rl:test:*");
    if (testKeys.length > 0) {
      await redis.del(...testKeys);
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.env = { ...originalEnv };
  });

  // ============================================================================
  // 1. Trusted Proxy Configuration & Parsing
  // ============================================================================
  describe("1. Trusted-Proxy Parsing and Client-IP Correctness", () => {
    test("parseTrustProxySetting defaults to false when omitted or disabled", () => {
      expect(parseTrustProxySetting(undefined)).toBe(false);
      expect(parseTrustProxySetting(null)).toBe(false);
      expect(parseTrustProxySetting("")).toBe(false);
      expect(parseTrustProxySetting("false")).toBe(false);
      expect(parseTrustProxySetting(false)).toBe(false);
    });

    test("parseTrustProxySetting parses integer hop counts", () => {
      expect(parseTrustProxySetting("1")).toBe(1);
      expect(parseTrustProxySetting(1)).toBe(1);
      expect(parseTrustProxySetting("2")).toBe(2);
      expect(parseTrustProxySetting(2)).toBe(2);
    });

    test("parseTrustProxySetting throws error on negative hop counts", () => {
      expect(() => parseTrustProxySetting("-1")).toThrow(/Invalid TRUST_PROXY hop count/);
    });

    test("parseTrustProxySetting parses CIDR subnets and built-in names", () => {
      expect(parseTrustProxySetting("loopback")).toBe("loopback");
      expect(parseTrustProxySetting("loopback, 10.0.0.0/8, 172.16.0.0/12")).toEqual([
        "loopback",
        "10.0.0.0/8",
        "172.16.0.0/12",
      ]);
    });

    test("parseTrustProxySetting handles true with warning in production", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      expect(parseTrustProxySetting("true", "production")).toBe(true);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("TRUST_PROXY is set to 'true'"));
      warnSpy.mockRestore();
    });
  });

  // ============================================================================
  // 2. Client-IP Derivation & Spoofing Protection
  // ============================================================================
  describe("2. Client-IP Derivation and Spoofing Protection", () => {
    test("when trust proxy is disabled, X-Forwarded-For is strictly ignored", async () => {
      const testApp = express();
      configureTrustProxy(testApp, false);
      testApp.get("/ip-test", (req, res) => res.json({ ip: req.ip }));

      const res = await request(testApp)
        .get("/ip-test")
        .set("X-Forwarded-For", "203.0.113.195");

      // req.ip should be loopback/socket address, NOT the spoofed header
      expect(res.body.ip).not.toBe("203.0.113.195");
    });

    test("when trust proxy is 1 (single hop), derives real client IP and rejects spoofed prefix", async () => {
      const testApp = express();
      configureTrustProxy(testApp, 1);
      testApp.get("/ip-test", (req, res) => res.json({ ip: req.ip }));

      // Attacker tries to inject spoofed IP 1.1.1.1 in front of real client 203.0.113.195
      const res = await request(testApp)
        .get("/ip-test")
        .set("X-Forwarded-For", "1.1.1.1, 203.0.113.195");

      // With hop count 1, Express trusts 1 hop from the right, taking 203.0.113.195 and rejecting 1.1.1.1
      expect(res.body.ip).toBe("203.0.113.195");
    });

    test("when trust proxy is loopback, trusts loopback peer and extracts forwarded IP", async () => {
      const testApp = express();
      configureTrustProxy(testApp, "loopback");
      testApp.get("/ip-test", (req, res) => res.json({ ip: req.ip }));

      const res = await request(testApp)
        .get("/ip-test")
        .set("X-Forwarded-For", "198.51.100.42");

      expect(res.body.ip).toBe("198.51.100.42");
    });
  });

  // ============================================================================
  // 3. Client Key Resolution
  // ============================================================================
  describe("3. Stable Client Identity Key Resolution", () => {
    test("keys authenticated customer by user ID to prevent collective IP lockout", () => {
      const req = {
        user: { id: "customer_abc_123" },
        ip: "203.0.113.1",
      };
      expect(resolveClientKey(req)).toBe("user:customer_abc_123");
    });

    test("keys authenticated administrator by admin ID", () => {
      const req = {
        administrator: { id: "admin_xyz_789" },
        ip: "203.0.113.1",
      };
      expect(resolveClientKey(req)).toBe("user:admin_xyz_789");
    });

    test("keys unauthenticated guest by validated client IP", () => {
      const req = {
        ip: "198.51.100.25",
      };
      expect(resolveClientKey(req)).toBe("198.51.100.25");
    });
  });

  // ============================================================================
  // 4. Redis Rate Limit Store (Atomic Execution & Distributed State)
  // ============================================================================
  describe("4. Distributed RedisRateLimitStore Execution", () => {
    const testKey = `test_client_${Date.now()}`;
    let store;

    beforeEach(() => {
      store = new RedisRateLimitStore({
        client: redis,
        prefix: "rl:test:",
        failPolicy: "fallback-memory",
      });
      store.init({ windowMs: 60 * 1000 });
    });

    afterEach(async () => {
      await store.resetKey(testKey);
    });

    test("increments count atomically and sets expiration time", async () => {
      const first = await store.increment(testKey);
      expect(first.totalHits).toBe(1);
      expect(first.resetTime).toBeInstanceOf(Date);
      expect(first.resetTime.getTime()).toBeGreaterThan(Date.now());

      const second = await store.increment(testKey);
      expect(second.totalHits).toBe(2);

      const third = await store.increment(testKey);
      expect(third.totalHits).toBe(3);
    });

    test("decrements count correctly", async () => {
      await store.increment(testKey);
      await store.increment(testKey);
      await store.decrement(testKey);

      // Verify the count in Redis was decremented to 1
      const val = await redis.get(`rl:test:${testKey}`);
      expect(Number(val)).toBe(1);
    });

    test("resets key cleanly", async () => {
      await store.increment(testKey);
      await store.resetKey(testKey);
      const val = await redis.get(`rl:test:${testKey}`);
      expect(val).toBeNull();
    });

    test("shares state across independently initialized store instances (Horizontal Scaling)", async () => {
      const storeInstance1 = new RedisRateLimitStore({
        client: redis,
        prefix: "rl:test:shared:",
      });
      storeInstance1.init({ windowMs: 60 * 1000 });

      const storeInstance2 = new RedisRateLimitStore({
        client: redis,
        prefix: "rl:test:shared:",
      });
      storeInstance2.init({ windowMs: 60 * 1000 });

      const sharedKey = `shared_${Date.now()}`;

      // Instance 1 increments
      const res1 = await storeInstance1.increment(sharedKey);
      expect(res1.totalHits).toBe(1);

      // Instance 2 increments same key -> count should be 2
      const res2 = await storeInstance2.increment(sharedKey);
      expect(res2.totalHits).toBe(2);

      // Instance 1 increments again -> count should be 3
      const res3 = await storeInstance1.increment(sharedKey);
      expect(res3.totalHits).toBe(3);

      await storeInstance1.resetKey(sharedKey);
    });
  });

  // ============================================================================
  // 5. Redis Outage Policies (Fail-Closed vs Fallback-Memory)
  // ============================================================================
  describe("5. Redis Outage Handling & Degradation Policies", () => {
    test("fail-closed policy returns infinity on Redis outage to block brute-force attacks", async () => {
      // Mock disconnected client
      const mockDisconnectedRedis = {
        status: "close",
        eval: jest.fn().mockRejectedValue(new Error("Connection lost")),
      };

      const failClosedStore = new RedisRateLimitStore({
        client: mockDisconnectedRedis,
        prefix: "rl:sensitive:",
        failPolicy: "fail-closed",
      });
      failClosedStore.init({ windowMs: 15 * 60 * 1000 });

      const result = await failClosedStore.increment("attacker_ip");
      expect(result.totalHits).toBe(Number.MAX_SAFE_INTEGER);
      expect(result.resetTime.getTime()).toBeGreaterThan(Date.now());
    });

    test("fallback-memory policy enforces local in-memory caps during Redis outage", async () => {
      const mockDisconnectedRedis = {
        status: "close",
        eval: jest.fn().mockRejectedValue(new Error("Connection lost")),
      };

      const memoryStore = new RedisRateLimitStore({
        client: mockDisconnectedRedis,
        prefix: "rl:checkout:",
        failPolicy: "fallback-memory",
      });
      memoryStore.init({ windowMs: 15 * 60 * 1000 });

      const hit1 = await memoryStore.increment("client_1");
      expect(hit1.totalHits).toBe(1);

      const hit2 = await memoryStore.increment("client_1");
      expect(hit2.totalHits).toBe(2);

      const hitOther = await memoryStore.increment("client_2");
      expect(hitOther.totalHits).toBe(1);
    });
  });

  // ============================================================================
  // 6. HTTP 429 Response Format and Retry Metadata
  // ============================================================================
  describe("6. HTTP 429 Response Format and Retry-After Header", () => {
    test("emits HTTP 429 with Retry-After header and structured error body", async () => {
      const testApp = express();
      configureTrustProxy(testApp, "loopback");

      const strictLimiter = createRateLimiter({
        windowMs: 60 * 1000,
        max: 2,
        prefix: "strict-test",
        failPolicy: "fallback-memory",
        message: "Too many attempts on strict endpoint.",
        code: "STRICT_RATE_LIMIT_EXCEEDED",
      });

      testApp.get(
        "/strict-resource",
        (req, res, next) => {
          // Force limiter execution by passing header
          req.headers["x-test-enforce-rate-limit"] = "true";
          next();
        },
        strictLimiter,
        (req, res) => res.json({ success: true })
      );

      // Hit 1 -> 200
      const res1 = await request(testApp).get("/strict-resource").set("X-Forwarded-For", "203.0.113.99");
      expect(res1.status).toBe(200);

      // Hit 2 -> 200
      const res2 = await request(testApp).get("/strict-resource").set("X-Forwarded-For", "203.0.113.99");
      expect(res2.status).toBe(200);

      // Hit 3 -> 429 Exceeded
      const res3 = await request(testApp).get("/strict-resource").set("X-Forwarded-For", "203.0.113.99");
      expect(res3.status).toBe(429);
      expect(res3.headers["retry-after"]).toBeDefined();
      expect(res3.body).toMatchObject({
        success: false,
        statusCode: 429,
        code: "STRICT_RATE_LIMIT_EXCEEDED",
        message: "Too many attempts on strict endpoint.",
      });
      expect(res3.body.retryAfter).toBeGreaterThan(0);
      expect(res3.body.timestamp).toBeDefined();

      // Clean up key
      await redis.del("rl:strict-test:203.0.113.99");
    });
  });

  // ============================================================================
  // 7. Route-to-Limiter Policy Inventory
  // ============================================================================
  describe("7. Endpoint-Specific Rate-Limiter Inventory", () => {
    test("exports all required endpoint rate limiters with expected configurations", () => {
      expect(typeof authRegistrationLimiter).toBe("function");
      expect(typeof authLoginLimiter).toBe("function");
      expect(typeof tokenRefreshLimiter).toBe("function");
      expect(typeof otpRequestLimiter).toBe("function");
      expect(typeof otpVerificationLimiter).toBe("function");
      expect(typeof otpResendLimiter).toBe("function");
      expect(typeof accountSecurityLimiter).toBe("function");
      expect(typeof checkoutLimiter).toBe("function");
      expect(typeof paymentLimiter).toBe("function");
      expect(typeof webhookLimiter).toBe("function");
      expect(typeof digitalDownloadLimiter).toBe("function");
      expect(typeof uploadLimiter).toBe("function");
      expect(typeof adminSensitiveOpLimiter).toBe("function");
      expect(typeof globalApiLimiter).toBe("function");
    });
  });

  // ============================================================================
  // 8. Application Ingress & Security Headers Regression
  // ============================================================================
  describe("8. Security Headers, CORS, and Express Integration", () => {
    test("Express app includes Helmet security headers and CORS", async () => {
      const res = await request(app).get("/health");

      expect(res.status).toBe(200);
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["cross-origin-opener-policy"]).toBe("same-origin-allow-popups");
    });

    test("readiness probe verifies Redis readiness", async () => {
      const res = await request(app).get("/readiness");
      expect(res.status).toBe(200);
      expect(res.body.ready).toBe(true);
      expect(res.body.status).toBe("ready");
    });
  });
});
