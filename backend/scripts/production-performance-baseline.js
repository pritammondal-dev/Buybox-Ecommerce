/**
 * Buybox Part 5 — Production Performance Baseline & Latency Profiling
 * 
 * Accurately measures:
 * 1. Redis round-trip ping latency
 * 2. MongoDB round-trip command & query latency
 * 3. Representative marketplace endpoint throughput & percentiles (p50, p90, p95, p99, min, max, avg)
 * 4. Error rate & status distribution
 * 5. Process CPU and Memory utilization
 */

require("dotenv").config();
const http = require("http");
const mongoose = require("mongoose");
const Redis = require("ioredis");
const env = require("../src/config/env");
require("../src/models/Product");

const BASE_URL = `http://127.0.0.1:${env.PORT || 5000}`;

const calculatePercentiles = (latencies) => {
  if (latencies.length === 0) return { p50: 0, p90: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const getP = (p) => sorted[Math.min(Math.floor((p / 100) * sorted.length), sorted.length - 1)];
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  return {
    min: Math.round(sorted[0] * 100) / 100,
    p50: Math.round(getP(50) * 100) / 100,
    p90: Math.round(getP(90) * 100) / 100,
    p95: Math.round(getP(95) * 100) / 100,
    p99: Math.round(getP(99) * 100) / 100,
    max: Math.round(sorted[sorted.length - 1] * 100) / 100,
    avg: Math.round((sum / sorted.length) * 100) / 100,
  };
};

const makeHttpRequest = (urlPath, options = {}) => {
  return new Promise((resolve) => {
    const start = performance.now();
    const url = new URL(urlPath, BASE_URL);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port || 5000,
      path: url.pathname + url.search,
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    };

    const req = http.request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        const duration = performance.now() - start;
        resolve({
          statusCode: res.statusCode,
          duration,
          success: res.statusCode >= 200 && res.statusCode < 400,
          data,
        });
      });
    });

    req.on("error", (err) => {
      const duration = performance.now() - start;
      resolve({
        statusCode: 0,
        duration,
        success: false,
        error: err.message,
      });
    });

    if (options.body) {
      req.write(typeof options.body === "string" ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
};

async function runConcurrentBatch(urlPath, totalRequests, concurrency, headers = {}) {
  const latencies = [];
  let successful = 0;
  let failed = 0;
  let completed = 0;

  const startTime = performance.now();

  const worker = async () => {
    while (completed < totalRequests) {
      completed++;
      const res = await makeHttpRequest(urlPath, { headers });
      latencies.push(res.duration);
      if (res.success) {
        successful++;
      } else {
        failed++;
      }
    }
  };

  const pool = Array.from({ length: concurrency }, () => worker());
  await Promise.all(pool);

  const totalTimeSec = (performance.now() - startTime) / 1000;
  const throughput = Math.round((totalRequests / totalTimeSec) * 100) / 100;
  const stats = calculatePercentiles(latencies);

  return {
    urlPath,
    totalRequests,
    concurrency,
    durationSec: Math.round(totalTimeSec * 100) / 100,
    throughputRps: throughput,
    successful,
    failed,
    errorRate: `${((failed / totalRequests) * 100).toFixed(2)}%`,
    ...stats,
  };
}

async function runProductionPerformanceBaseline() {
  console.log("==================================================");
  console.log("BUYBOX PRODUCTION PERFORMANCE BASELINE PROFILER");
  console.log("==================================================");
  const memStart = process.memoryUsage();
  const cpuStart = process.cpuUsage();

  // 1. Measure Redis Ping Latency
  console.log("\n[1] Measuring Redis Infrastructure Latency...");
  const redis = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379");
  const redisLatencies = [];
  for (let i = 0; i < 20; i++) {
    const t0 = performance.now();
    await redis.ping();
    redisLatencies.push(performance.now() - t0);
  }
  const redisStats = calculatePercentiles(redisLatencies);
  console.log(`- Redis Latency (20 samples): avg=${redisStats.avg}ms, p50=${redisStats.p50}ms, p95=${redisStats.p95}ms, p99=${redisStats.p99}ms`);
  await redis.quit();

  // 2. Measure MongoDB Latency
  console.log("\n[2] Measuring MongoDB Infrastructure Latency...");
  await mongoose.connect(env.MONGODB_URI);
  const db = mongoose.connection.db;
  const mongoPingLatencies = [];
  for (let i = 0; i < 20; i++) {
    const t0 = performance.now();
    await db.command({ ping: 1 });
    mongoPingLatencies.push(performance.now() - t0);
  }
  const mongoStats = calculatePercentiles(mongoPingLatencies);
  console.log(`- MongoDB Command Ping (20 samples): avg=${mongoStats.avg}ms, p50=${mongoStats.p50}ms, p95=${mongoStats.p95}ms, p99=${mongoStats.p99}ms`);

  // Query latency on indexed collection
  const mongoQueryLatencies = [];
  const Product = mongoose.model("Product");
  for (let i = 0; i < 20; i++) {
    const t0 = performance.now();
    await Product.find({ status: "active" }).limit(10).lean();
    mongoQueryLatencies.push(performance.now() - t0);
  }
  const mongoQueryStats = calculatePercentiles(mongoQueryLatencies);
  console.log(`- MongoDB Indexed Query (20 samples): avg=${mongoQueryStats.avg}ms, p50=${mongoQueryStats.p50}ms, p95=${mongoQueryStats.p95}ms, p99=${mongoQueryStats.p99}ms`);

  // 3. Representative Endpoint Benchmarks
  console.log("\n[3] Executing Concurrent HTTP Benchmarks against Active Services...");

  const endpointsToTest = [
    { name: "Liveness Check", path: "/liveness", requests: 300, concurrency: 20 },
    { name: "Readiness Check", path: "/readiness", requests: 300, concurrency: 20 },
    { name: "Product Catalog Listing", path: "/api/v1/products?limit=12", requests: 250, concurrency: 15 },
    { name: "Catalog Search Query", path: "/api/v1/products?search=phone&limit=12", requests: 250, concurrency: 15 },
    { name: "Categories Listing", path: "/api/v1/categories", requests: 250, concurrency: 15 },
    { name: "Brands Listing", path: "/api/v1/brands", requests: 250, concurrency: 15 },
    { name: "Available Payment Methods", path: "/api/v1/payments/methods/available", requests: 250, concurrency: 15 },
  ];

  const benchmarkResults = [];

  for (const ep of endpointsToTest) {
    process.stdout.write(`   Running benchmark: ${ep.name} (${ep.requests} reqs @ concurrency ${ep.concurrency})... `);
    const res = await runConcurrentBatch(ep.path, ep.requests, ep.concurrency);
    benchmarkResults.push({ name: ep.name, ...res });
    console.log(`DONE -> ${res.throughputRps} RPS | avg: ${res.avg}ms | p95: ${res.p95}ms | p99: ${res.p99}ms | error: ${res.errorRate}`);
  }

  // 4. Memory & CPU Delta
  const memEnd = process.memoryUsage();
  const cpuEnd = process.cpuUsage(cpuStart);
  const memRssDeltaMb = Math.round(((memEnd.rss - memStart.rss) / (1024 * 1024)) * 100) / 100;
  const memHeapDeltaMb = Math.round(((memEnd.heapUsed - memStart.heapUsed) / (1024 * 1024)) * 100) / 100;
  const cpuUserMs = Math.round(cpuEnd.user / 1000);
  const cpuSystemMs = Math.round(cpuEnd.system / 1000);

  console.log("\n[4] Resource Utilization Profile:");
  console.log(`- Process RSS Memory: ${(memEnd.rss / (1024 * 1024)).toFixed(2)} MB (Delta: ${memRssDeltaMb >= 0 ? "+" : ""}${memRssDeltaMb} MB)`);
  console.log(`- Process Heap Used: ${(memEnd.heapUsed / (1024 * 1024)).toFixed(2)} MB (Delta: ${memHeapDeltaMb >= 0 ? "+" : ""}${memHeapDeltaMb} MB)`);
  console.log(`- CPU User Time: ${cpuUserMs} ms | CPU System Time: ${cpuSystemMs} ms`);

  console.log("\n==================================================");
  console.log("PRODUCTION PERFORMANCE BASELINE SUMMARY TABLE");
  console.log("==================================================");
  console.table(
    benchmarkResults.map((r) => ({
      Endpoint: r.name,
      Requests: r.totalRequests,
      Concurrency: r.concurrency,
      RPS: r.throughputRps,
      "Avg (ms)": r.avg,
      "p50 (ms)": r.p50,
      "p95 (ms)": r.p95,
      "p99 (ms)": r.p99,
      "Error Rate": r.errorRate,
    }))
  );

  await mongoose.disconnect();
}

runProductionPerformanceBaseline().catch((err) => {
  console.error("Baseline profiler failed:", err);
  process.exit(1);
});
