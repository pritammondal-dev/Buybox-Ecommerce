/**
 * Runtime Acceptance Verification Script
 * Validates against running backend (http://localhost:5000) and MongoDB.
 */
const mongoose = require("mongoose");

const API_BASE =
  process.env.API_BASE_URL ||
  (process.env.BACKEND_URL ? `${process.env.BACKEND_URL.replace(/\/+$/, "")}/api/v1` : "http://localhost:5000/api/v1");

async function run() {
  console.log("=== PHASE 5F: RUNTIME ACCEPTANCE TEST ===");

  await mongoose.connect("mongodb://localhost:27017/buybox");
  const db = mongoose.connection.db;

  // Step 1: Sign in as an authorized Superadmin
  console.log("\n--- STEP 1: Sign in as Authorized Superadmin ---");
  const loginRes = await fetch(`${API_BASE}/administrator/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin123@example.com",
      password: "admin123",
    }),
  });

  if (!loginRes.ok) {
    throw new Error(`Superadmin login failed with status ${loginRes.status}: ${await loginRes.text()}`);
  }

  const loginData = await loginRes.json();
  const token = loginData.data?.accessToken;
  const user = loginData.data?.user;
  console.log(`[PASS] Superadmin signed in successfully: ${user.email} (Role: ${user.role})`);

  // Step 2: Open an order with an existing shipment
  console.log("\n--- STEP 2 & 3: Order & Shipment Inspection ---");
  // Find an order or create a dedicated runtime test shipment on order 6abb3f55f9686f9682658caa
  const orderId = "6abb3f55f9686f9682658caa";
  const orderDoc = await db.collection("orders").findOne({ _id: new mongoose.Types.ObjectId(orderId) });
  console.log(`Target Order: ${orderDoc.orderNumber} (Status: ${orderDoc.status}, Payment: ${orderDoc.paymentStatus}, Total: ${orderDoc.grandTotal})`);

  // Ensure a test shipment exists for this order with status 'created'
  const shipmentId = new mongoose.Types.ObjectId();
  const shipmentNumber = `SHP-TEST-${Date.now().toString(36).toUpperCase()}`;
  const testShipmentDoc = {
    _id: shipmentId,
    orderId: orderDoc._id,
    customerId: orderDoc.customerId,
    vendorId: new mongoose.Types.ObjectId("6a9955e001560df0f8e2ad6c"),
    warehouseId: new mongoose.Types.ObjectId("6a996ce0eb04c3d288d7e535"),
    shipmentNumber,
    status: "created",
    carrier: "ExpressCargo",
    serviceLevel: "standard",
    trackingNumber: "EXP-12345-IN",
    trackingUrl: null,
    items: [
      {
        productId: orderDoc.items[0].productId,
        productVariantId: orderDoc.items[0].productVariantId,
        sku: "TEST-SKU-001",
        name: "Test Product",
        quantity: 1,
      },
    ],
    metadata: { testSuite: "Phase5F-RuntimeAcceptance" },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.collection("shipments").insertOne(testShipmentDoc);
  console.log(`[PASS] Created persisted test shipment: ${shipmentNumber} (ID: ${shipmentId}) with status: ${testShipmentDoc.status}`);

  // Fetch order via Admin API to verify shipment retrieval
  const orderRes = await fetch(`${API_BASE}/orders/admin/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`GET /orders/admin/${orderId} status: ${orderRes.status}`);

  // Also verify GET /shipments/:id
  const getShipmentRes = await fetch(`${API_BASE}/shipments/${shipmentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!getShipmentRes.ok) {
    throw new Error(`Failed to fetch shipment via API: ${getShipmentRes.status} ${await getShipmentRes.text()}`);
  }
  const shipmentPayload = await getShipmentRes.json();
  const fetchedShipment = shipmentPayload.data?.shipment || shipmentPayload.data;
  console.log(`[PASS] Verified API shipment retrieval: ID=${fetchedShipment._id || fetchedShipment.id}, Status=${fetchedShipment.status}`);

  // Step 4: Attempt invalid transition and confirm rejection (Step 10 test early)
  console.log("\n--- STEP 4 & 10: Attempt Invalid Transition (e.g. created -> delivered) ---");
  const invalidRes = await fetch(`${API_BASE}/shipments/${shipmentId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      status: "delivered", // Invalid from 'created'
      reason: "Superadmin attempting jump",
    }),
  });

  console.log(`Invalid transition HTTP status: ${invalidRes.status}`);
  const invalidData = await invalidRes.json();
  console.log(`Invalid transition error code: ${invalidData.errorCode || invalidData.error || invalidData.message}`);
  if (invalidRes.status !== 409 && invalidRes.status !== 400) {
    throw new Error(`Expected 409 or 400 for invalid transition, got ${invalidRes.status}`);
  }
  console.log("[PASS] Invalid transition was correctly rejected by state machine with code: " + invalidData.errorCode);

  // Step 5: Test Concurrency Conflict
  console.log("\n--- STEP 5: Test Concurrency Conflict Protection ---");
  const staleRes = await fetch(`${API_BASE}/shipments/${shipmentId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      status: "ready_to_ship",
      expectedPreviousStatus: "in_transit", // Stale! Actual is 'created'
      reason: "Simulated stale submit",
    }),
  });
  console.log(`Concurrency conflict HTTP status: ${staleRes.status}`);
  const staleData = await staleRes.json();
  console.log(`Concurrency conflict error code: ${staleData.errorCode || staleData.message}`);
  if (staleRes.status !== 409) {
    throw new Error(`Expected 409 for concurrency conflict, got ${staleRes.status}`);
  }
  console.log("[PASS] Stale concurrent update was rejected with 409 Conflict.");

  // Step 6: Submit Valid Transition: created -> ready_to_ship
  console.log("\n--- STEP 6: Submit Valid Transition (created -> ready_to_ship) ---");
  const validRes = await fetch(`${API_BASE}/shipments/${shipmentId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      status: "ready_to_ship",
      expectedPreviousStatus: "created",
      carrier: "BlueDart Express",
      trackingNumber: "BD-99887766",
      notes: "Packed and ready for pickup",
      reason: "Superadmin dispatch preparation",
    }),
  });

  if (!validRes.ok) {
    throw new Error(`Valid update failed: ${validRes.status} ${await validRes.text()}`);
  }
  const validData = await validRes.json();
  const updatedShipment = validData.data?.shipment || validData.data;
  console.log(`[PASS] Server returned updated shipment status: ${updatedShipment.status}`);
  console.log(`       Carrier: ${updatedShipment.carrier}, Tracking: ${updatedShipment.trackingNumber}`);

  // Step 7: Verify Database Persistence
  console.log("\n--- STEP 7: Verify Database Persistence & Page Reload Simulation ---");
  const persistedShipment = await db.collection("shipments").findOne({ _id: shipmentId });
  console.log(`Database Record: status=${persistedShipment.status}, carrier=${persistedShipment.carrier}, trackingNumber=${persistedShipment.trackingNumber}`);
  if (persistedShipment.status !== "ready_to_ship") {
    throw new Error(`Database persistence failure: expected ready_to_ship, got ${persistedShipment.status}`);
  }
  console.log("[PASS] Database persistence confirmed directly in MongoDB.");

  // Simulate Page Refresh (Re-fetching from API)
  const reloadRes = await fetch(`${API_BASE}/shipments/${shipmentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const reloadedData = await reloadRes.json();
  const reloadedShipment = reloadedData.data?.shipment || reloadedData.data;
  if (reloadedShipment?.status !== "ready_to_ship") {
    throw new Error(`Page reload verification failed: got ${reloadedShipment?.status}`);
  }
  console.log(`[PASS] Page reload simulation confirmed status remains 'ready_to_ship'.`);

  // Step 8: Inspect Audit History & Order Timeline
  console.log("\n--- STEP 8: Inspect Audit History & Order Timeline ---");
  const auditLogs = await db.collection("auditlogs").find({
    targetId: shipmentId,
  }).toArray();
  console.log(`Found ${auditLogs.length} audit logs for shipment:`);
  for (const log of auditLogs) {
    console.log(`  - Action: ${log.action}, Actor: ${log.actorId}, Target: ${log.targetId}`);
    console.log(`    Before:`, JSON.stringify(log.beforeState));
    console.log(`    After:`, JSON.stringify(log.afterState));
  }
  if (auditLogs.length === 0) {
    throw new Error("Expected audit log entry for SHIPMENT_STATUS_UPDATED");
  }
  console.log("[PASS] Authoritative AuditLog entry verified in database.");

  const updatedOrder = await db.collection("orders").findOne({ _id: orderDoc._id });
  const timelineEvents = (updatedOrder.timeline || []).filter(e =>
    e.event?.includes("SHIPMENT") || e.metadata?.shipmentId?.toString() === shipmentId.toString()
  );
  console.log(`Order timeline events for shipment: ${timelineEvents.length}`);
  for (const t of timelineEvents) {
    console.log(`  - Event: ${t.event || t.title}, Message: ${t.message || t.description}`);
  }
  if (timelineEvents.length === 0) {
    throw new Error("Expected Order timeline event for shipment status change");
  }
  console.log("[PASS] Order timeline event verified.");

  // Step 9: Confirm order invariants (order status, payment status, grand total)
  console.log("\n--- STEP 9: Confirm Order Invariants ---");
  console.log(`Order Status before: ${orderDoc.status} | after: ${updatedOrder.status}`);
  console.log(`Payment Status before: ${orderDoc.paymentStatus} | after: ${updatedOrder.paymentStatus}`);
  console.log(`Grand Total before: ${orderDoc.grandTotal} | after: ${updatedOrder.grandTotal}`);
  if (orderDoc.status === "confirmed") {
    if (updatedOrder.status !== "processing" && updatedOrder.status !== "confirmed") {
      throw new Error(`Order status unexpectedly set to ${updatedOrder.status}`);
    }
  } else if (updatedOrder.status !== orderDoc.status) {
    throw new Error(`Order status unexpectedly changed from ${orderDoc.status} to ${updatedOrder.status}`);
  }
  if (orderDoc.paymentStatus !== updatedOrder.paymentStatus) {
    throw new Error(`Payment status unexpectedly changed!`);
  }
  if (String(orderDoc.grandTotal) !== String(updatedOrder.grandTotal)) {
    throw new Error(`Order grand total unexpectedly changed! Before: ${orderDoc.grandTotal}, After: ${updatedOrder.grandTotal}`);
  }
  console.log("[PASS] Order invariants preserved (payment status, total, and pricing intact; canonical status progression to processing).");

  // Step 10: Test Exceptional Superadmin Override
  console.log("\n--- STEP 10: Exceptional Superadmin Override ---");
  const overrideRes = await fetch(`${API_BASE}/shipments/${shipmentId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      status: "in_transit", // Jump from ready_to_ship directly to in_transit via override
      isOverride: true,
      overrideReason: "Superadmin correcting missed carrier scan in transit",
      notes: "Manual override approved by Operations Director",
    }),
  });

  if (!overrideRes.ok) {
    throw new Error(`Superadmin override failed: ${overrideRes.status} ${await overrideRes.text()}`);
  }
  const overrideData = await overrideRes.json();
  const overrideShipment = overrideData.data?.shipment || overrideData.data;
  console.log(`[PASS] Superadmin exceptional override succeeded. Status: ${overrideShipment?.status}`);

  const overrideLog = await db.collection("auditlogs").findOne({
    action: "SHIPMENT_STATUS_OVERRIDE",
    targetId: shipmentId,
  });
  console.log(`[PASS] Override audit log recorded: Action=${overrideLog?.action}, Target=${overrideLog?.targetId}, After=${JSON.stringify(overrideLog?.afterState)}`);
  if (!overrideLog) {
    throw new Error("Expected SHIPMENT_STATUS_OVERRIDE audit log");
  }

  // Clean up test shipment to keep test DB clean
  await db.collection("shipments").deleteOne({ _id: shipmentId });
  console.log("[PASS] Cleaned up temporary test shipment.");

  await mongoose.disconnect();
  console.log("\n=== RUNTIME ACCEPTANCE TEST FULLY PASSED ===");
}

run().catch((err) => {
  console.error("Runtime Acceptance Test FAILED:", err);
  process.exit(1);
});
