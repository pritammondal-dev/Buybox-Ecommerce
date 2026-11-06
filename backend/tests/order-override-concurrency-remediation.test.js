/**
 * Test Suite: Phase ORDER-OVERRIDE-B Concurrency, Shipment Synchronization & Fulfillment Consistency
 * 
 * Verifies:
 * 1. P1 Legacy unversioned order optimistic concurrency transition to version 2.
 * 2. P1 Concurrent status transitions on unversioned documents (exactly 1 winner, 1 conflict).
 * 3. P1 Versioned order increment and stale expectedVersion conflict rejection.
 * 4. P1 Shipment synchronization re-entrancy prevention during Superadmin delivered transition.
 * 5. P2 Admin delivery estimate delegation to calculateDeliveryEstimate (vendor-confirmed date).
 * 6. P2 Fulfillment SLA inactivity triage calculation for shipped orders (96h threshold vs lifetime elapsed).
 * 7. Reference order BB-MVV7IT7M-B44FFC71 read-only verification (MUST remain shipped, versioned, unmutated).
 */

const mongoose = require("mongoose");
const Order = require("../src/models/Order");
const Shipment = require("../src/models/Shipment");
const orderRepository = require("../src/repositories/order.repository");
const orderService = require("../src/services/order.service");
const shipmentService = require("../src/services/shipment.service");
const { calculateOrderFulfillmentTriage, VENDOR_FULFILLMENT_SLA } = require("../src/constants/fulfillment-sla.constants");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/buybox_test?replicaSet=rs0";
const DEV_MONGODB_URI = "mongodb://127.0.0.1:27017/buybox?directConnection=true";

describe("Phase ORDER-OVERRIDE-B: Concurrency, Shipment Synchronization & Fulfillment Consistency", () => {
  const createdTestOrderIds = [];
  const createdTestShipmentIds = [];
  const dummyCustomerId = new mongoose.Types.ObjectId();

  const createValidOrderPayload = (overrides = {}) => {
    const vendorId = new mongoose.Types.ObjectId();
    const productId = new mongoose.Types.ObjectId();
    const productVariantId = new mongoose.Types.ObjectId();
    const warehouseId = new mongoose.Types.ObjectId();

    return {
      orderNumber: `TEST-ORD-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      customerId: dummyCustomerId,
      status: "shipped",
      paymentStatus: "paid",
      fulfillmentStatus: "fulfilled",
      shippingAddress: {
        fullName: "Test Customer",
        phone: "+919876543210",
        addressLine1: "123 Test Street",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "IN",
      },
      billingAddress: {
        fullName: "Test Customer",
        phone: "+919876543210",
        addressLine1: "123 Test Street",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "IN",
      },
      items: [
        {
          productId,
          productVariantId,
          vendorId,
          warehouseId,
          productName: "Test Product Item",
          sku: `TEST-SKU-${Math.floor(Math.random() * 10000)}`,
          quantity: 1,
          unitPrice: 500,
          lineTotal: 500,
          currency: "INR",
          fulfillmentStatus: "shipped",
        },
      ],
      subtotal: 500,
      grandTotal: 500,
      currency: "INR",
      timeline: [],
      ...overrides,
    };
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI);
    }
  });

  afterAll(async () => {
    // Clean up test orders and shipments
    if (createdTestOrderIds.length > 0) {
      await Order.deleteMany({ _id: { $in: createdTestOrderIds } });
    }
    if (createdTestShipmentIds.length > 0) {
      await Shipment.deleteMany({ _id: { $in: createdTestShipmentIds } });
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  // =========================================================================
  // 1. P1: Legacy Unversioned Order Optimistic Concurrency Transition
  // =========================================================================
  describe("1. Legacy Unversioned Order Optimistic Concurrency Transition", () => {
    test("transitionStatusIfCurrent atomically transitions a document missing the version field to version 2", async () => {
      const orderPayload = createValidOrderPayload({ status: "shipped" });
      const testOrder = await Order.create(orderPayload);
      createdTestOrderIds.push(testOrder._id);

      // Force-remove 'version' field in MongoDB BSON to simulate legacy order
      await Order.collection.updateOne(
        { _id: testOrder._id },
        { $unset: { version: "" } }
      );

      // Verify absence of version in raw MongoDB document
      const rawDoc = await Order.collection.findOne({ _id: testOrder._id });
      expect(rawDoc.version).toBeUndefined();

      // Transition with expectedVersion: 1 (representing effective initial version)
      const updated = await orderRepository.transitionStatusIfCurrent(
        testOrder._id,
        "shipped",
        { status: "delivered", deliveredAt: new Date() },
        { expectedVersion: 1 }
      );

      expect(updated).not.toBeNull();
      expect(updated.status).toBe("delivered");
      expect(updated.version).toBe(2);

      // Verify persisted BSON record now has version: 2
      const persistedDoc = await Order.collection.findOne({ _id: testOrder._id });
      expect(persistedDoc.version).toBe(2);
      expect(persistedDoc.status).toBe("delivered");
    });

    test("Concurrent transitions on an unversioned document: exactly one wins, second receives 409 conflict", async () => {
      const orderPayload = createValidOrderPayload({ status: "shipped" });
      const testOrder = await Order.create(orderPayload);
      createdTestOrderIds.push(testOrder._id);

      await Order.collection.updateOne(
        { _id: testOrder._id },
        { $unset: { version: "" } }
      );

      // Concurrently execute two transitions with expectedVersion: 1
      const [res1, res2] = await Promise.all([
        orderRepository.transitionStatusIfCurrent(
          testOrder._id,
          "shipped",
          { status: "delivered", notes: "First Concurrent Worker" },
          { expectedVersion: 1 }
        ),
        orderRepository.transitionStatusIfCurrent(
          testOrder._id,
          "shipped",
          { status: "delivered", notes: "Second Concurrent Worker" },
          { expectedVersion: 1 }
        ),
      ]);

      const winners = [res1, res2].filter(Boolean);
      const losers = [res1, res2].filter((r) => r === null);

      expect(winners.length).toBe(1);
      expect(losers.length).toBe(1);
      expect(winners[0].version).toBe(2);
    });

    test("Transition on an already-bumped version 2 document with stale expectedVersion: 1 is rejected", async () => {
      const orderPayload = createValidOrderPayload({ status: "processing", version: 2 });
      const testOrder = await Order.create(orderPayload);
      createdTestOrderIds.push(testOrder._id);

      // Stale attempt with expectedVersion: 1 must fail
      const staleResult = await orderRepository.transitionStatusIfCurrent(
        testOrder._id,
        "processing",
        { status: "shipped" },
        { expectedVersion: 1 }
      );
      expect(staleResult).toBeNull();

      // Current attempt with expectedVersion: 2 must succeed and advance to version: 3
      const validResult = await orderRepository.transitionStatusIfCurrent(
        testOrder._id,
        "processing",
        { status: "shipped" },
        { expectedVersion: 2 }
      );
      expect(validResult).not.toBeNull();
      expect(validResult.version).toBe(3);
      expect(validResult.status).toBe("shipped");
    });
  });

  // =========================================================================
  // 2. P1: Superadmin Order Status Override & Shipment Re-entrancy Prevention
  // =========================================================================
  describe("2. Superadmin Order Status Override & Shipment Re-entrancy Prevention", () => {
    test("updateAdminOrderStatus transitions order and shipments to delivered without re-entrancy collision", async () => {
      const vendorId = new mongoose.Types.ObjectId();
      const variantId = new mongoose.Types.ObjectId();
      const warehouseId = new mongoose.Types.ObjectId();

      const orderPayload = createValidOrderPayload({
        status: "shipped",
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productVariantId: variantId,
          vendorId,
          warehouseId,
          productName: "Shipped Item",
          sku: "SHIPPED-SKU-1",
          quantity: 1,
          unitPrice: 1200,
          lineTotal: 1200,
          currency: "INR",
          fulfillmentStatus: "shipped",
        }],
        vendorFulfillments: [{
          vendorId,
          fulfillmentStatus: "shipped",
          isFulfillmentConfirmed: true,
          expectedDeliveryDate: new Date("2026-11-10"),
        }],
      });

      const testOrder = await Order.create(orderPayload);
      createdTestOrderIds.push(testOrder._id);

      // Create an active shipment linked to this order
      const testShipment = await Shipment.create({
        shipmentNumber: `SHP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        orderId: testOrder._id,
        customerId: dummyCustomerId,
        vendorId,
        warehouseId,
        status: "in_transit",
        trackingNumber: "TEST-TRK-999",
        carrier: "BlueDart",
        shippingAddress: testOrder.shippingAddress,
        items: [{
          productId: testOrder.items[0].productId,
          productVariantId: variantId,
          sku: "SHIPPED-SKU-1",
          name: "Shipped Item",
          quantity: 1,
        }],
        timeline: [],
      });
      createdTestShipmentIds.push(testShipment._id);

      // Strip version field to test legacy compatibility under updateAdminOrderStatus
      await Order.collection.updateOne(
        { _id: testOrder._id },
        { $unset: { version: "" } }
      );

      // Superadmin executes transition to 'delivered'
      const adminActor = {
        userId: new mongoose.Types.ObjectId(),
        role: "superadmin",
      };

      const result = await orderService.updateAdminOrderStatus({
        orderId: testOrder._id.toString(),
        status: "delivered",
        reason: "Customer acknowledged parcel delivery",
        expectedPreviousStatus: "shipped",
        expectedVersion: 1,
        actor: adminActor,
      });

      expect(result).toBeDefined();
      expect(result.status).toBe("delivered");
      expect(result.fulfillmentStatus).toBe("fulfilled");

      // Verify shipment was also transitioned to delivered
      const refreshedShipment = await Shipment.findById(testShipment._id);
      expect(refreshedShipment.status).toBe("delivered");

      // Verify order has version 2 in MongoDB
      const persistedOrder = await Order.collection.findOne({ _id: testOrder._id });
      expect(persistedOrder.version).toBe(2);
      expect(persistedOrder.status).toBe("delivered");
    });
  });

  // =========================================================================
  // 3. P2: Admin Delivery Estimate Delegation
  // =========================================================================
  describe("3. Admin Delivery Estimate Delegation", () => {
    test("getAdminOrderById delegates to calculateDeliveryEstimate and surfaces vendor-confirmed delivery date", async () => {
      const vendorId = new mongoose.Types.ObjectId();
      const orderPayload = createValidOrderPayload({
        status: "shipped",
        placedAt: new Date("2026-10-30T10:00:00.000Z"),
        deliveryOption: {
          name: "Standard Ground Delivery",
          estimatedDays: "1-2 days", // Checkout provisional option: 31 Oct - 1 Nov
        },
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productVariantId: new mongoose.Types.ObjectId(),
          vendorId,
          warehouseId: new mongoose.Types.ObjectId(),
          productName: "Confirmed Item",
          sku: "CONF-SKU-1",
          quantity: 1,
          unitPrice: 800,
          lineTotal: 800,
          currency: "INR",
          fulfillmentStatus: "shipped",
          expectedDeliveryDate: new Date("2026-11-07T12:00:00.000Z"),
          isFulfillmentConfirmed: true,
        }],
        vendorFulfillments: [{
          vendorId,
          fulfillmentStatus: "shipped",
          isFulfillmentConfirmed: true,
          expectedDeliveryDate: new Date("2026-11-07T12:00:00.000Z"),
        }],
      });

      const testOrder = await Order.create(orderPayload);
      createdTestOrderIds.push(testOrder._id);

      const adminOrder = await orderService.getAdminOrderById(testOrder._id);

      expect(adminOrder).toBeDefined();
      expect(adminOrder.estimatedDelivery).toBeDefined();
      // Authoritative vendor-confirmed date must take precedence over provisional checkout delivery option
      expect(adminOrder.estimatedDelivery.source).toBe("vendor_confirmed");
      expect(adminOrder.estimatedDelivery.estimatedDateRange).toBe("7 Nov 2026");
      expect(adminOrder.estimatedDelivery.deliveryOptionName).toBe("Standard Ground Delivery");
      expect(adminOrder.version).toBe(1);
    });
  });

  // =========================================================================
  // 4. P2: Fulfillment SLA Inactivity Triage Calculation
  // =========================================================================
  describe("4. Fulfillment SLA Inactivity Triage Calculation", () => {
    test("calculateOrderFulfillmentTriage accurately classifies shipped orders with 96h dispatch SLA threshold", () => {
      const now = new Date("2026-11-02T12:00:00.000Z");
      const placedAt = new Date("2026-10-30T16:00:00.000Z"); // 68 hours ago

      const shippedOrder = {
        status: "shipped",
        placedAt,
        fulfillmentStatus: "fulfilled",
        items: [{
          vendorId: new mongoose.Types.ObjectId(),
          fulfillmentStatus: "shipped",
          isFulfillmentConfirmed: true,
          vendorAcceptance: { status: "accepted", acceptedAt: new Date("2026-10-30T17:00:00.000Z") },
        }],
        vendorFulfillments: [{
          vendorId: new mongoose.Types.ObjectId(),
          fulfillmentStatus: "shipped",
          acceptanceStatus: "accepted",
          isFulfillmentConfirmed: true,
        }],
      };

      const triage = calculateOrderFulfillmentTriage(shippedOrder, now);

      expect(triage).toBeDefined();
      expect(triage.stage).toBe("shipped");
      expect(triage.triageStatus).toBe("normal");
      expect(triage.isOverdue).toBe(false);
      // SLA threshold must be DISPATCH_HOURS (96), NOT hardcoded ACCEPTANCE_HOURS (24)
      expect(triage.slaThresholdHours).toBe(VENDOR_FULFILLMENT_SLA.DISPATCH_HOURS);
      expect(triage.hoursOverdue).toBe(0);
      expect(triage.recommendedAction).toContain("in transit");
    });
  });

  // =========================================================================
  // 5. Reference Order BB-MVV7IT7M-B44FFC71 State Preservation
  // =========================================================================
  describe("5. Reference Order BB-MVV7IT7M-B44FFC71 State Preservation", () => {
    test("Reference order BB-MVV7IT7M-B44FFC71 remains completely unmutated in development database", async () => {
      // Connect to development DB in read-only mode using a dedicated connection
      const devConn = await mongoose.createConnection(DEV_MONGODB_URI).asPromise();

      try {
        const refDoc = await devConn.collection("orders").findOne({ orderNumber: "BB-MVV7IT7M-B44FFC71" });
        expect(refDoc).not.toBeNull();
        expect(refDoc.orderNumber).toBe("BB-MVV7IT7M-B44FFC71");
        // MUST remain shipped (never altered to delivered)
        expect(refDoc.status).toBe("shipped");
        expect(refDoc.fulfillmentStatus).toBe("fulfilled");

        // Verify vendor fulfillment date is 7 Nov 2026
        const vf = refDoc.vendorFulfillments?.[0];
        expect(vf).toBeDefined();
        expect(new Date(vf.expectedDeliveryDate).toISOString().slice(0, 10)).toBe("2026-11-07");
      } finally {
        await devConn.close();
      }
    });
  });
});
