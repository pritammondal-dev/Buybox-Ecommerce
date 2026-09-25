require("dotenv").config();
const mongoose = require("mongoose");
const env = require("../src/config/env");

// Require all models to ensure schemas and indexes are registered
require("../src/models/User");
require("../src/models/Employee");
require("../src/models/JobRole");
require("../src/models/Product");
require("../src/models/ProductVariant");
require("../src/models/Inventory");
require("../src/models/Order");
require("../src/models/Payment");
require("../src/models/FinancialLedgerEntry");
require("../src/models/Vendor");
require("../src/models/AuditLog");

async function verifyDatabase() {
  console.log("=== MONGODB REPLICA SET & INDEX VERIFICATION ===");
  console.log("Connecting to:", env.MONGODB_URI.replace(/\/\/.*@/, "//***:***@"));

  const connection = await mongoose.connect(env.MONGODB_URI);
  const db = connection.connection.db;

  // 1. Check Server Status & Replica Set
  try {
    const adminDb = connection.connection.db.admin();
    const serverStatus = await adminDb.serverStatus();
    console.log("\n[1] Server Info:");
    console.log(`- Version: ${serverStatus.version}`);
    console.log(`- Uptime: ${serverStatus.uptime}s`);
    console.log(`- Storage Engine: ${serverStatus.storageEngine?.name}`);
    console.log(`- Connections: current=${serverStatus.connections?.current}, available=${serverStatus.connections?.available}`);

    const isMaster = await adminDb.command({ isMaster: 1 });
    console.log("\n[2] Replica Set Topology:");
    console.log(`- Is Master/Primary: ${isMaster.ismaster}`);
    console.log(`- Set Name: ${isMaster.setName || "N/A"}`);
    console.log(`- Hosts: ${JSON.stringify(isMaster.hosts || [isMaster.primary || "standalone"])}`);
    console.log(`- Read-Only: ${Boolean(isMaster.readOnly)}`);
  } catch (err) {
    console.log("Server status query warning:", err.message);
  }

  // 2. Critical Collections & Index Verification
  const criticalModels = [
    "User",
    "Employee",
    "JobRole",
    "Product",
    "Inventory",
    "Order",
    "Payment",
    "FinancialLedgerEntry",
    "Vendor",
    "AuditLog",
  ];

  console.log("\n[3] Critical Collection Indexes & Counts:");
  const results = {};

  for (const modelName of criticalModels) {
    const Model = mongoose.model(modelName);
    const count = await Model.countDocuments();
    const collection = Model.collection;
    const rawIndexes = await collection.indexes();
    const indexSummary = rawIndexes.map((idx) => {
      const keys = Object.entries(idx.key)
        .map(([k, v]) => `${k}:${v}`)
        .join(", ");
      return `${idx.name} (${keys})${idx.unique ? " [UNIQUE]" : ""}${idx.sparse ? " [SPARSE]" : ""}`;
    });

    results[modelName] = {
      count,
      indexes: indexSummary,
    };

    console.log(`\nModel: ${modelName} (Documents: ${count})`);
    indexSummary.forEach((idx) => console.log(`  - ${idx}`));
  }

  // 3. Invariant Checks (Section 34)
  console.log("\n[4] Data Integrity & Invariants Check (Section 34):");

  // Invariant A: Single Active Superadmin
  const User = mongoose.model("User");
  const superadmins = await User.find({ role: "super_admin", isActive: true });
  console.log(`- Active Superadmins: ${superadmins.length} (Expected: exactly 1)`);
  if (superadmins.length > 1) {
    console.error("  CRITICAL FAIL: Multiple active superadmins detected!");
  } else if (superadmins.length === 1) {
    console.log(`  PASSED: Single active Superadmin invariant preserved (${superadmins[0].email})`);
  } else {
    console.warn("  WARNING: No active superadmin found.");
  }

  // Invariant B: Inventory Integrity (available = onHand - reserved, no negative values)
  const Inventory = mongoose.model("Inventory");
  const allInventories = await Inventory.find({});
  let inventoryAnomalies = 0;
  for (const inv of allInventories) {
    const calculatedAvailable = inv.onHand - inv.reserved;
    if (inv.available !== calculatedAvailable || inv.available < 0 || inv.onHand < 0 || inv.reserved < 0) {
      inventoryAnomalies++;
      console.error(`  ANOMALY: Inventory ${inv._id}: onHand=${inv.onHand}, reserved=${inv.reserved}, available=${inv.available}`);
    }
  }
  if (inventoryAnomalies === 0) {
    console.log(`  PASSED: All ${allInventories.length} inventory records strictly satisfy available == onHand - reserved (no negatives).`);
  } else {
    console.error(`  FAILED: ${inventoryAnomalies} inventory anomalies found!`);
  }

  // Invariant C: Financial Ledger Idempotency & Balance
  const Ledger = mongoose.model("FinancialLedgerEntry");
  const duplicateLedgerKeys = await Ledger.aggregate([
    { $match: { idempotencyKey: { $exists: true, $ne: null } } },
    { $group: { _id: "$idempotencyKey", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);
  if (duplicateLedgerKeys.length === 0) {
    console.log(`  PASSED: 0 duplicate ledger idempotency keys found.`);
  } else {
    console.error(`  FAILED: ${duplicateLedgerKeys.length} duplicate ledger idempotency keys found!`);
  }

  // Invariant D: Order & Payment Reconciliation
  const Order = mongoose.model("Order");
  const Payment = mongoose.model("Payment");
  const paidOrders = await Order.find({ paymentStatus: "paid" });
  let paymentMismatches = 0;
  for (const ord of paidOrders) {
    const payment = await Payment.findOne({ orderId: ord._id, status: "captured" });
    if (!payment) {
      paymentMismatches++;
      console.warn(`  WARNING: Paid order ${ord.orderNumber} has no matching captured payment record.`);
    }
  }
  console.log(`  Paid Orders verified: ${paidOrders.length}, Mismatches: ${paymentMismatches}`);

  await mongoose.disconnect();
  console.log("\nDatabase verification completed successfully.");
}

verifyDatabase().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
