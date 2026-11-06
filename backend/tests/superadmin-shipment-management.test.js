const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Employee = require("../src/models/Employee");
const Customer = require("../src/models/Customer");
const Vendor = require("../src/models/Vendor");
const Warehouse = require("../src/models/Warehouse");
const Shipment = require("../src/models/Shipment");
const Order = require("../src/models/Order");
const AuditLog = require("../src/models/AuditLog");
const Inventory = require("../src/models/Inventory");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const { generateAccessToken } = require("../src/services/token.service");
const { encodeSecureId } = require("../src/utils/secure-id.util");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_superadmin_shipment_test?")
  : "mongodb://127.0.0.1:27017/buybox_superadmin_shipment_test?replicaSet=rs0";

jest.setTimeout(35000);

describe("Phase 5F — Superadmin Shipment Status Management & Lifecycle Control", () => {
  let superadminUser;
  let superadminToken;
  let regularStaffUser;
  let regularStaffToken;
  let customerUser;
  let customerToken;
  let warehouse;
  let vendor;
  let customer;
  let testOrder;
  let testShipment;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(TEST_MONGODB_URI);
    }
    // 1. Superadmin User
    superadminUser = await User.findOne({ role: ROLES.SUPER_ADMIN, isActive: true });
    if (!superadminUser) {
      superadminUser = await User.create({
        firstName: "Super",
        lastName: "Admin",
        email: `superadmin_ship_${Date.now()}@test.com`,
        password: "Password123!",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        authVersion: 1,
        permissionVersion: 1,
      });
    }
    superadminToken = generateAccessToken({
      userId: superadminUser._id,
      role: superadminUser.role,
      email: superadminUser.email,
    });

    // 2. Create Regular Staff User (manager without shipments:manage permission)
    regularStaffUser = await User.create({
      firstName: "Regular",
      lastName: "Staff",
      email: `regular_staff_${Date.now()}@test.com`,
      password: "Password123!",
      role: "manager",
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    regularStaffToken = generateAccessToken({
      userId: regularStaffUser._id,
      role: regularStaffUser.role,
      email: regularStaffUser.email,
    });
    await Employee.create({
      userId: regularStaffUser._id,
      employeeNumber: `EMP_5F_${Date.now()}`,
      jobTitle: "Operations Manager",
      department: "Warehouse",
      status: "active",
    });

    // 3. Create Customer
    customerUser = await User.create({
      firstName: "John",
      lastName: "Customer",
      email: `customer_ship_${Date.now()}@test.com`,
      password: "Password123!",
      role: "customer",
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    customerToken = generateAccessToken({
      userId: customerUser._id,
      role: customerUser.role,
      email: customerUser.email,
    });
    customer = await Customer.create({
      userId: customerUser._id,
      firstName: "John",
      lastName: "Customer",
      email: customerUser.email,
    });

    // 4. Warehouse & Vendor
    warehouse = await Warehouse.create({
      name: "Central Logistics Hub",
      code: `WH-5F-${Date.now().toString(36).toUpperCase()}`,
      address: {
        addressLine1: "123 Logistics St",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "IN",
      },
      isActive: true,
    });

    vendor = await Vendor.create({
      userId: new mongoose.Types.ObjectId(),
      storeName: "SuperShip Vendor",
      businessName: "SuperShip Technologies Ltd",
      businessSlug: `supership-${Date.now().toString(36)}`,
      isActive: true,
    });
  });

  beforeEach(async () => {
    // Fresh Order
    testOrder = await Order.create({
      orderNumber: `BB-5F-${Date.now().toString(36).toUpperCase()}`,
      customerId: customer._id,
      status: "confirmed",
      paymentStatus: "paid",
      fulfillmentStatus: "unfulfilled",
      subtotal: mongoose.Types.Decimal128.fromString("1999.00"),
      grandTotal: mongoose.Types.Decimal128.fromString("1999.00"),
      currency: "INR",
      shippingAddress: {
        fullName: "John Customer",
        phone: "+919876543210",
        addressLine1: "123 Main Road",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "IN",
      },
      items: [
        {
          productId: new mongoose.Types.ObjectId(),
          productVariantId: new mongoose.Types.ObjectId(),
          productName: "Air Pods Pro",
          sku: `SKU-5F-${Date.now()}`,
          quantity: 2,
          currency: "INR",
          unitPrice: mongoose.Types.Decimal128.fromString("999.50"),
          lineTotal: mongoose.Types.Decimal128.fromString("1999.00"),
          vendorId: vendor._id,
          warehouseId: warehouse._id,
          fulfillmentStatus: "ready_to_ship",
          inventoryStatus: "reserved",
        },
      ],
      timeline: [
        {
          event: "ORDER_CONFIRMED",
          title: "Order Placed & Confirmed",
          description: "Order paid and confirmed.",
          timestamp: new Date(),
        },
      ],
    });

    // Fresh Shipment
    testShipment = await Shipment.create({
      orderId: testOrder._id,
      customerId: customer._id,
      vendorId: vendor._id,
      warehouseId: warehouse._id,
      shipmentNumber: `SHP-5F-${Date.now().toString(36).toUpperCase()}`,
      status: "created",
      inventoryStatus: "reserved",
      carrier: "BlueDart",
      trackingNumber: `BD-${Date.now()}`,
      shippingAddress: testOrder.shippingAddress,
      items: [
        {
          productId: testOrder.items[0].productId,
          productVariantId: testOrder.items[0].productVariantId,
          sku: testOrder.items[0].sku,
          name: testOrder.items[0].productName,
          quantity: 2,
        },
      ],
    });
  });

  afterAll(async () => {
    try {
      await User.deleteMany({ email: /@test\.com$/ });
      await Customer.deleteMany({ _id: customer?._id });
      await Vendor.deleteMany({ _id: vendor?._id });
      await Warehouse.deleteMany({ _id: warehouse?._id });
      await Order.deleteMany({ orderNumber: /^BB-5F-/ });
      await Shipment.deleteMany({ shipmentNumber: /^SHP-5F-/ });
      await AuditLog.deleteMany({ entityType: "Shipment" });
    } catch {
      // Ignored
    }
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  // ==========================================================================
  // SECTION 1: AUTHENTICATION & AUTHORIZATION
  // ==========================================================================
  describe("1. Authentication & Authorization Boundaries", () => {
    test("Unauthenticated request returns 401 AUTHENTICATION_REQUIRED", async () => {
      const res = await request(app)
        .patch(`/api/v1/shipments/${testShipment._id}/status`)
        .send({ status: "ready_to_ship" });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
    });

    test("Unauthorized customer returns 403 INSUFFICIENT_PERMISSIONS", async () => {
      const res = await request(app)
        .patch(`/api/v1/shipments/${testShipment._id}/status`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ status: "ready_to_ship" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("Staff without shipments:manage permission returns 403 INSUFFICIENT_PERMISSIONS", async () => {
      const res = await request(app)
        .patch(`/api/v1/shipments/${testShipment._id}/status`)
        .set("Authorization", `Bearer ${regularStaffToken}`)
        .send({ status: "ready_to_ship" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });
  });

  // ==========================================================================
  // SECTION 2: IDENTIFIER VALIDATION & SECURE ID SUPPORT
  // ==========================================================================
  describe("2. Shipment Identifier Validation", () => {
    test("Malformed shipment ID returns 400 INVALID_OBJECT_ID", async () => {
      const res = await request(app)
        .patch("/api/v1/shipments/not-a-valid-id/status")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ status: "ready_to_ship" });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_OBJECT_ID");
    });

    test("Nonexistent shipment ID returns 404 SHIPMENT_NOT_FOUND", async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .patch(`/api/v1/shipments/${nonExistentId}/status`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ status: "ready_to_ship" });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("SHIPMENT_NOT_FOUND");
    });

    test("Secure ID format (shp_...) is resolved and accepted", async () => {
      const secureId = encodeSecureId("shipment", testShipment._id);

      const res = await request(app)
        .patch(`/api/v1/shipments/${secureId}/status`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ status: "ready_to_ship" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("ready_to_ship");
    });
  });

  // ==========================================================================
  // SECTION 3: CANONICAL STATE MACHINE & TRANSITIONS
  // ==========================================================================
  describe("3. Canonical State Machine & Validation", () => {
    test("Authorized Superadmin can transition created -> ready_to_ship", async () => {
      const res = await request(app)
        .patch(`/api/v1/shipments/${testShipment._id}/status`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          status: "ready_to_ship",
          carrier: "Delhivery",
          trackingNumber: "DLV-999888",
          notes: "Package prepared and manifested by admin",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("ready_to_ship");
      expect(res.body.data.carrier).toBe("Delhivery");
      expect(res.body.data.trackingNumber).toBe("DLV-999888");

      // Verify persistence in MongoDB
      const reloaded = await Shipment.findById(testShipment._id);
      expect(reloaded.status).toBe("ready_to_ship");
      expect(reloaded.carrier).toBe("Delhivery");
      expect(reloaded.trackingNumber).toBe("DLV-999888");

      // Verify Order timeline recorded transition
      const reloadedOrder = await Order.findById(testOrder._id);
      const timelineMatch = reloadedOrder.timeline.find(
        (t) => t.metadata?.shipmentId === testShipment._id.toString()
      );
      expect(timelineMatch).toBeDefined();
      expect(timelineMatch.metadata.newStatus).toBe("ready_to_ship");
      expect(timelineMatch.actor.actorType).toBe("admin");

      // Verify AuditLog recorded
      const auditLog = await AuditLog.findOne({
        targetId: testShipment._id,
        action: "SHIPMENT_STATUS_UPDATED",
      });
      expect(auditLog).toBeDefined();
      expect(auditLog.beforeState.status).toBe("created");
      expect(auditLog.afterState.status).toBe("ready_to_ship");
    });

    test("Invalid forward jump (created -> delivered) is rejected with 409 INVALID_SHIPMENT_STATUS_TRANSITION", async () => {
      const res = await request(app)
        .patch(`/api/v1/shipments/${testShipment._id}/status`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          status: "delivered",
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("INVALID_SHIPMENT_STATUS_TRANSITION");

      // Verify shipment remains created
      const reloaded = await Shipment.findById(testShipment._id);
      expect(reloaded.status).toBe("created");
    });

    test("Repeated same-status update is idempotent", async () => {
      const res1 = await request(app)
        .patch(`/api/v1/shipments/${testShipment._id}/status`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ status: "ready_to_ship" });

      expect(res1.status).toBe(200);

      const res2 = await request(app)
        .patch(`/api/v1/shipments/${testShipment._id}/status`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ status: "ready_to_ship" });

      expect(res2.status).toBe(200);
      expect(res2.body.data.status).toBe("ready_to_ship");
    });
  });

  // ==========================================================================
  // SECTION 4: CONCURRENCY PROTECTION
  // ==========================================================================
  describe("4. Concurrency Protection", () => {
    test("Rejects update when expectedPreviousStatus does not match current shipment status", async () => {
      // First update moves it to ready_to_ship
      await request(app)
        .patch(`/api/v1/shipments/${testShipment._id}/status`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ status: "ready_to_ship" });

      // Stale client thinks status is still 'created'
      const staleRes = await request(app)
        .patch(`/api/v1/shipments/${testShipment._id}/status`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          status: "picked_up",
          expectedPreviousStatus: "created",
        });

      expect(staleRes.status).toBe(409);
      expect(staleRes.body.code).toBe("CONCURRENCY_CONFLICT");
    });
  });

  // ==========================================================================
  // SECTION 5: EXCEPTIONAL SUPERADMIN OVERRIDE
  // ==========================================================================
  describe("5. Superadmin Exceptional Override", () => {
    test("Non-superadmin cannot perform exceptional override", async () => {
      const res = await request(app)
        .patch(`/api/v1/shipments/${testShipment._id}/status`)
        .set("Authorization", `Bearer ${regularStaffToken}`)
        .send({
          status: "in_transit",
          isOverride: true,
          overrideReason: "Manual carrier sync adjustment",
        });

      // Staff lacks manage permission -> 403 INSUFFICIENT_PERMISSIONS
      expect(res.status).toBe(403);
    });

    test("Superadmin override without reason is rejected with 400 OVERRIDE_REASON_REQUIRED", async () => {
      const res = await request(app)
        .patch(`/api/v1/shipments/${testShipment._id}/status`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          status: "in_transit",
          isOverride: true,
          overrideReason: "",
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("OVERRIDE_REASON_REQUIRED");
    });

    test("Superadmin override with valid reason succeeds, records SHIPMENT_STATUS_OVERRIDE in AuditLog", async () => {
      const res = await request(app)
        .patch(`/api/v1/shipments/${testShipment._id}/status`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          status: "in_transit",
          isOverride: true,
          overrideReason: "Emergency administrative reconciliation for lost tracking ping",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("in_transit");

      // Verify AuditLog recorded SHIPMENT_STATUS_OVERRIDE
      const overrideAudit = await AuditLog.findOne({
        targetId: testShipment._id,
        action: "SHIPMENT_STATUS_OVERRIDE",
      });
      expect(overrideAudit).toBeDefined();
      expect(overrideAudit.afterState.isOverride).toBe(true);
      expect(overrideAudit.afterState.overrideReason).toBe(
        "Emergency administrative reconciliation for lost tracking ping"
      );

      // Verify timeline entry on parent order
      const order = await Order.findById(testOrder._id);
      const overrideTimeline = order.timeline.find(
        (t) => t.event === "SHIPMENT_STATUS_OVERRIDDEN"
      );
      expect(overrideTimeline).toBeDefined();
      expect(overrideTimeline.description).toContain(
        "Emergency administrative reconciliation"
      );
    });

    test("Terminal shipments (cancelled/returned) cannot be mutated even with override", async () => {
      // Mark shipment as cancelled
      testShipment.status = "cancelled";
      await testShipment.save();

      const res = await request(app)
        .patch(`/api/v1/shipments/${testShipment._id}/status`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          status: "ready_to_ship",
          isOverride: true,
          overrideReason: "Trying to un-cancel a cancelled shipment",
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("TERMINAL_SHIPMENT_CANNOT_BE_MODIFIED");
    });
  });

  // ==========================================================================
  // SECTION 6: DOWNSTREAM MULTI-SHIPMENT ORDER INTEGRITY
  // ==========================================================================
  describe("6. Downstream Multi-Shipment Order Integrity", () => {
    test("Delivering 1 of 2 shipments marks order partially_fulfilled, NOT delivered", async () => {
      // Create a second shipment for testOrder
      const secondShipment = await Shipment.create({
        orderId: testOrder._id,
        customerId: customer._id,
        vendorId: vendor._id,
        warehouseId: warehouse._id,
        shipmentNumber: `SHP-5F-2ND-${Date.now().toString(36).toUpperCase()}`,
        status: "in_transit",
        inventoryStatus: "deducted",
        carrier: "BlueDart",
        trackingNumber: `BD-2ND-${Date.now()}`,
        shippingAddress: testOrder.shippingAddress,
        items: [
          {
            productId: testOrder.items[0].productId,
            productVariantId: testOrder.items[0].productVariantId,
            sku: testOrder.items[0].sku,
            name: testOrder.items[0].productName,
            quantity: 1,
          },
        ],
      });

      // Move first shipment to in_transit
      testShipment.status = "in_transit";
      testShipment.items[0].quantity = 1;
      await testShipment.save();

      testOrder.status = "shipped";
      await testOrder.save();

      // Superadmin marks first shipment delivered
      const res = await request(app)
        .patch(`/api/v1/shipments/${testShipment._id}/status`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ status: "delivered" });

      expect(res.status).toBe(200);

      // Verify the parent order: should still be 'shipped' (partially fulfilled), NOT 'delivered'
      const order = await Order.findById(testOrder._id);
      expect(order.status).toBe("shipped");
      expect(order.fulfillmentStatus).toBe("partially_fulfilled");

      // Clean up second shipment
      await Shipment.deleteOne({ _id: secondShipment._id });
    });
  });
});
