/**
 * Buybox Production Hardening — Launch Readiness Concurrency & Load Benchmark
 *
 * Measures:
 * 1. Last-unit inventory race condition (onHand=1, reserved=0, 10 concurrent atomic reservations)
 * 2. Concurrent stock release and adjustment consistency
 * 3. Multi-endpoint HTTP Load Testing (500 requests, concurrency=20)
 *    - Throughput (Requests/sec)
 *    - Latency distribution (min, p50, p90, p95, p99, max, avg)
 *    - Success / error rate
 *    - Process memory and CPU delta
 */

const mongoose = require("mongoose");
const http = require("http");
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const User = require("../src/models/User");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Warehouse = require("../src/models/Warehouse");
const Inventory = require("../src/models/Inventory");
const inventoryRepository = require("../src/repositories/inventory.repository");
const { ROLES } = require("../src/constants/auth.constants");

const BASE_URL = "http://127.0.0.1:5000";

const calculatePercentiles = (latencies) => {
  if (latencies.length === 0) return { p50: 0, p90: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const getP = (p) => sorted[Math.min(Math.floor((p / 100) * sorted.length), sorted.length - 1)];
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  return {
    min: sorted[0],
    p50: getP(50),
    p90: getP(90),
    p95: getP(95),
    p99: getP(99),
    max: sorted[sorted.length - 1],
    avg: Math.round((sum / sorted.length) * 100) / 100,
  };
};

const makeHttpRequest = (url, options = {}) => {
  return new Promise((resolve) => {
    const start = performance.now();
    const parsed = new URL(url);
    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port || 5000,
      path: parsed.pathname + parsed.search,
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    };

    const req = http.request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        const duration = Math.round((performance.now() - start) * 100) / 100;
        let parsedBody = null;
        try {
          parsedBody = JSON.parse(data);
        } catch {
          parsedBody = data;
        }
        resolve({
          statusCode: res.statusCode,
          duration,
          body: parsedBody,
        });
      });
    });

    req.on("error", (err) => {
      const duration = Math.round((performance.now() - start) * 100) / 100;
      resolve({
        statusCode: 0,
        duration,
        error: err.message,
      });
    });

    if (options.body) {
      req.write(typeof options.body === "string" ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
};

async function runBenchmark() {
  console.log("================================================================================");
  console.log("BUYBOX E-COMMERCE: PART 4 PRODUCTION HARDENING & LOAD BENCHMARK");
  console.log("================================================================================\n");

  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/buybox?replicaSet=rs0";
  await mongoose.connect(mongoUri);
  console.log("✓ Connected to MongoDB for live state verification:", mongoUri);

  const startCpu = process.cpuUsage();
  const startMem = process.memoryUsage();

  // ---------------------------------------------------------------------------
  // PART 1: INVENTORY CONCURRENCY & RACE CONDITION TEST (Last Unit Purchase)
  // ---------------------------------------------------------------------------
  console.log("\n[TEST 1] Inventory Concurrency & Race Condition (1 Unit, 10 Simultaneous Buyers)...");

  const Category = require("../src/models/Category");
  const Vendor = require("../src/models/Vendor");

  let testCat = await Category.findOne({ isActive: true });
  if (!testCat) {
    testCat = await Category.create({
      name: `Benchmark Category ${Date.now()}`,
      slug: `bench-cat-${Date.now()}`,
      isActive: true,
    });
  }

  let testVendor = await Vendor.findOne({ isActive: true });
  if (!testVendor) {
    testVendor = await Vendor.create({
      storeName: "Benchmark Store",
      slug: `bench-store-${Date.now()}`,
      isActive: true,
      onboardingStatus: "approved",
    });
  }

  // Create test product and variant
  const testProduct = await Product.create({
    name: `Race Condition Product ${Date.now()}`,
    slug: `race-product-${Date.now()}`,
    sku: `PROD-SKU-${Date.now().toString().slice(-6)}`,
    categoryId: testCat._id,
    vendorId: testVendor._id,
    status: "active",
    price: 999,
  });

  const testVariant = await ProductVariant.create({
    productId: testProduct._id,
    sku: `SKU-RACE-${Date.now().toString().slice(-6)}`,
    price: 999,
    isActive: true,
  });

  const testWarehouse = await Warehouse.create({
    name: `Bench WH ${Date.now()}`,
    code: `WHB_${Date.now().toString().slice(-6)}`,
    isActive: true,
    address: {
      addressLine1: "123 Bench Road",
      city: "Bangalore",
      state: "KA",
      postalCode: "560001",
      country: "IN",
    },
  });

  // Exactly 1 onHand in stock
  const inventoryDoc = await Inventory.create({
    productVariantId: testVariant._id,
    warehouseId: testWarehouse._id,
    onHand: 1,
    reserved: 0,
  });

  console.log(`  Initial Inventory State: onHand=${inventoryDoc.onHand}, reserved=${inventoryDoc.reserved}, available=${inventoryDoc.onHand - inventoryDoc.reserved}`);

  // Execute 10 simultaneous atomic reservation attempts using Promise.all
  console.log("  Firing 10 simultaneous atomic reservation attempts for the last 1 item...");
  const reservationPromises = [];
  for (let i = 0; i < 10; i++) {
    reservationPromises.push(
      inventoryRepository.reserveAvailableStock(inventoryDoc._id, 1).catch((err) => ({ error: err.message }))
    );
  }

  const results = await Promise.all(reservationPromises);

  const successfulReservations = results.filter((r) => r && r._id && !r.error);
  const failedReservations = results.filter((r) => r === null || r.error);

  console.log(`  Results: ${successfulReservations.length} succeeded, ${failedReservations.length} rejected safely.`);

  // Verify DB state
  const updatedInv = await Inventory.findById(inventoryDoc._id);
  const finalAvailable = updatedInv.onHand - updatedInv.reserved;
  console.log(`  Final Inventory in DB: onHand=${updatedInv.onHand}, reserved=${updatedInv.reserved}, available=${finalAvailable}`);

  const invariantNoOversell = successfulReservations.length === 1 && failedReservations.length === 9;
  const invariantNoNegativeStock = updatedInv.onHand >= 0 && updatedInv.reserved <= updatedInv.onHand && finalAvailable >= 0;

  console.log(`  ✓ Invariant: Exactly 1 Success (No Overselling): ${invariantNoOversell ? "PASSED" : "FAILED"}`);
  console.log(`  ✓ Invariant: No Negative Stock (onHand >= reserved): ${invariantNoNegativeStock ? "PASSED" : "FAILED"}`);

  // Test Inventory Release
  console.log("  Testing Reservation Release (simulating order cancellation or payment failure)...");
  const releasedInv = await inventoryRepository.releaseReservedStock(inventoryDoc._id, 1);
  console.log(`  Inventory after cancellation: onHand=${releasedInv.onHand}, reserved=${releasedInv.reserved}, available=${releasedInv.onHand - releasedInv.reserved}`);
  console.log(`  ✓ Invariant: Inventory correctly restored: ${releasedInv.reserved === 0 ? "PASSED" : "FAILED"}`);

  // Test Concurrent Double-Release Prevention
  console.log("  Testing Double-Release Prevention (5 concurrent release calls for 1 reserved unit)...");
  // Reserve 1 first
  await inventoryRepository.reserveAvailableStock(inventoryDoc._id, 1);
  const releasePromises = [];
  for (let i = 0; i < 5; i++) {
    releasePromises.push(inventoryRepository.releaseReservedStock(inventoryDoc._id, 1));
  }
  const releaseResults = await Promise.all(releasePromises);
  const successfulReleases = releaseResults.filter(Boolean);
  const invAfterReleases = await Inventory.findById(inventoryDoc._id);
  console.log(`  Double-Release Results: ${successfulReleases.length} release succeeded, ${releaseResults.length - successfulReleases.length} rejected safely.`);
  console.log(`  Inventory reserved count: ${invAfterReleases.reserved} (must be exactly 0, never negative)`);
  console.log(`  ✓ Invariant: Double-Release prevented without negative reserved: ${invAfterReleases.reserved === 0 && successfulReleases.length === 1 ? "PASSED" : "FAILED"}`);

  // ---------------------------------------------------------------------------
  // PART 2: REAL HTTP LOAD TEST (500 Requests, Concurrency = 20)
  // ---------------------------------------------------------------------------
  console.log("\n[TEST 2] High-Concurrency HTTP Load Benchmark (500 Requests, Concurrency = 20)...");

  const endpoints = [
    { name: "Health Check", url: `${BASE_URL}/health` },
    { name: "Public Products", url: `${BASE_URL}/api/v1/products?limit=10` },
    { name: "Categories", url: `${BASE_URL}/api/v1/categories` },
    { name: "Brands", url: `${BASE_URL}/api/v1/brands` },
  ];

  const totalRequests = 500;
  const concurrency = 20;
  const allLatencies = [];
  let successCount = 0;
  let failureCount = 0;

  const loadStartTime = performance.now();
  let completed = 0;

  async function worker() {
    while (completed < totalRequests) {
      const reqIndex = completed++;
      if (reqIndex >= totalRequests) break;
      const target = endpoints[reqIndex % endpoints.length];
      const res = await makeHttpRequest(target.url);
      allLatencies.push(res.duration);
      if (res.statusCode >= 200 && res.statusCode < 400) {
        successCount++;
      } else {
        failureCount++;
      }
    }
  }

  const workers = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  const loadDuration = (performance.now() - loadStartTime) / 1000;
  const rps = Math.round((totalRequests / loadDuration) * 100) / 100;
  const stats = calculatePercentiles(allLatencies);

  const endCpu = process.cpuUsage(startCpu);
  const endMem = process.memoryUsage();
  const cpuUserMs = Math.round(endCpu.user / 1000);
  const cpuSystemMs = Math.round(endCpu.system / 1000);
  const heapUsedMb = Math.round((endMem.heapUsed / (1024 * 1024)) * 100) / 100;
  const rssMb = Math.round((endMem.rss / (1024 * 1024)) * 100) / 100;

  console.log("\n================================================================================");
  console.log("LOAD TESTING RESULTS & METRICS");
  console.log("================================================================================");
  console.log(`Environment:           Node.js ${process.version}, Windows x64`);
  console.log(`Target Host:           ${BASE_URL}`);
  console.log(`Total Requests:        ${totalRequests}`);
  console.log(`Concurrency Level:     ${concurrency}`);
  console.log(`Duration:              ${loadDuration.toFixed(2)} seconds`);
  console.log(`Throughput:            ${rps} Requests/second`);
  console.log(`Successful Requests:   ${successCount} (${((successCount / totalRequests) * 100).toFixed(1)}%)`);
  console.log(`Failed Requests:       ${failureCount} (${((failureCount / totalRequests) * 100).toFixed(1)}%)`);
  console.log(`Latency min:           ${stats.min} ms`);
  console.log(`Latency p50 (median):  ${stats.p50} ms`);
  console.log(`Latency p90:           ${stats.p90} ms`);
  console.log(`Latency p95:           ${stats.p95} ms`);
  console.log(`Latency p99:           ${stats.p99} ms`);
  console.log(`Latency max:           ${stats.max} ms`);
  console.log(`Average Latency:       ${stats.avg} ms`);
  console.log(`CPU User Time:         ${cpuUserMs} ms`);
  console.log(`CPU System Time:       ${cpuSystemMs} ms`);
  console.log(`Memory Heap Used:      ${heapUsedMb} MB`);
  console.log(`Process RSS:           ${rssMb} MB`);
  console.log("================================================================================\n");

  // Cleanup benchmark test data
  console.log("Cleaning up benchmark records...");
  await Product.deleteOne({ _id: testProduct._id });
  await ProductVariant.deleteOne({ _id: testVariant._id });
  await Warehouse.deleteOne({ _id: testWarehouse._id });
  await Inventory.deleteOne({ _id: inventoryDoc._id });

  await mongoose.disconnect();
  console.log("✓ Benchmark test suite completed safely.");
}

runBenchmark().catch((err) => {
  console.error("Benchmark error:", err);
  process.exit(1);
});
