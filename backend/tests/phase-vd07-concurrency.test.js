jest.mock("../src/integrations/payments/razorpay.provider", () => {
  const actual = jest.requireActual("../src/integrations/payments/razorpay.provider");
  return {
    ...actual,
    refundPayment: jest.fn().mockImplementation(async ({ paymentId, amount, idempotencyKey }) => ({
      id: `rfnd_mock_${Date.now()}`,
      entity: "refund",
      amount,
      currency: "INR",
      payment_id: paymentId,
      status: "processed",
      idempotency_key: idempotencyKey,
    })),
  };
});

const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../src/app");
const Order = require("../src/models/Order");
const Shipment = require("../src/models/Shipment");
const ShipmentWebhookEvent = require("../src/models/ShipmentWebhookEvent");
const Category = require("../src/models/Category");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Inventory = require("../src/models/Inventory");
const Warehouse = require("../src/models/Warehouse");
const Vendor = require("../src/models/Vendor");
const User = require("../src/models/User");
const Customer = require("../src/models/Customer");
const Payment = require("../src/models/Payment");
const courierService = require("../src/services/courier.service");
const shipmentService = require("../src/services/shipment.service");
const orderService = require("../src/services/order.service");
const razorpayProvider = require("../src/integrations/payments/razorpay.provider");
const { SHIPMENT_STATUSES } = require("../src/constants/shipping.constants");
const { ORDER_STATUSES, FULFILLMENT_STATUSES } = require("../src/constants/order.constants");
const { generateAccessToken, TOKEN_CONTEXTS } = require("../src/services/token.service");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const { hashPassword } = require("../src/utils/password");

const TEST_MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/buybox-ecommerce";

describe("Phase VD-07: Order & Shipment State Integrity, Concurrency & Override Safety Suite", () => {
  let customerUser, customer;
  let vendorUser, vendor;
  let adminUser;
  let superAdminUser;
  let warehouse;
  let product, variant;
  let inventoryDoc;
  let customerToken, vendorToken, adminToken, superAdminToken;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    const uniqueSuffix = Date.now();
    const hashedPassword = await hashPassword("StrongPass@123");

    // 1. Create Roles & Users
    customerUser = await User.create({
      firstName: "VD07",
      lastName: "Customer",
      email: `customer-vd07-${uniqueSuffix}@test.buybox.com`,
      password: hashedPassword,
      role: "customer",
      isActive: true,
      emailVerified: true,
    });
    customer = await Customer.create({
      userId: customerUser._id,
      firstName: "VD07",
      lastName: "Customer",
      email: customerUser.email,
    });

    vendorUser = await User.create({
      firstName: "VD07",
      lastName: "Vendor",
      email: `vendor-vd07-${uniqueSuffix}@test.buybox.com`,
      password: hashedPassword,
      role: "vendor",
      isActive: true,
      emailVerified: true,
    });
    vendor = await Vendor.create({
      userId: vendorUser._id,
      businessName: "VD07 Logistics Store",
      businessSlug: `vd07-logistics-${uniqueSuffix}`,
      status: "approved",
      isActive: true,
      approvalStatus: "approved",
      onboardingStatus: "approved",
      email: vendorUser.email,
      phone: "+919876543299",
      complianceStatus: "verified",
      verificationStatus: "verified",
      address: {
        addressLine1: "VD07 Logistics Hub",
        city: "New Delhi",
        state: "Delhi",
        country: "IN",
        postalCode: "110037",
      },
    });

    adminUser = await User.create({
      firstName: "VD07",
      lastName: "Admin",
      email: `admin-vd07-${uniqueSuffix}@test.buybox.com`,
      password: hashedPassword,
      role: "admin",
      roles: ["admin"],
      isActive: true,
      emailVerified: true,
    });

    superAdminUser = await User.create({
      firstName: "VD07",
      lastName: "Superadmin",
      email: `superadmin-vd07-${uniqueSuffix}@test.buybox.com`,
      password: hashedPassword,
      role: "super_admin",
      roles: ["super_admin"],
      isActive: true,
      emailVerified: true,
    });

    // 2. Auth Tokens
    customerToken = generateAccessToken(
      { sub: customerUser._id.toString(), id: customerUser._id.toString(), email: customerUser.email, role: ROLES.CUSTOMER },
      { context: TOKEN_CONTEXTS.CUSTOMER }
    );
    vendorToken = generateAccessToken(
      {
        sub: vendorUser._id.toString(),
        id: vendorUser._id.toString(),
        email: vendorUser.email,
        role: ROLES.VENDOR,
        roles: [ROLES.VENDOR],
        permissions: [PERMISSIONS.SHIPMENTS_READ_OWN, PERMISSIONS.SHIPMENTS_MANAGE_OWN, PERMISSIONS.ORDERS_READ_OWN, PERMISSIONS.ORDERS_MANAGE_OWN],
        vendorId: vendor._id.toString(),
      },
      { context: TOKEN_CONTEXTS.VENDOR }
    );
    adminToken = generateAccessToken(
      {
        sub: adminUser._id.toString(),
        id: adminUser._id.toString(),
        email: adminUser.email,
        role: ROLES.ADMIN,
        roles: [ROLES.ADMIN],
        permissions: [PERMISSIONS.ORDERS_MANAGE, PERMISSIONS.SHIPMENTS_MANAGE],
      },
      { context: TOKEN_CONTEXTS.ADMIN }
    );
    superAdminToken = generateAccessToken(
      {
        sub: superAdminUser._id.toString(),
        id: superAdminUser._id.toString(),
        email: superAdminUser.email,
        role: ROLES.SUPER_ADMIN,
        roles: [ROLES.SUPER_ADMIN],
        permissions: Object.values(PERMISSIONS),
      },
      { context: TOKEN_CONTEXTS.ADMIN }
    );

    // 3. Warehouse, Product, Variant & Inventory
    warehouse = await Warehouse.create({
      name: `VD07 Warehouse ${uniqueSuffix}`,
      code: `WH-VD07-${uniqueSuffix}`,
      vendorId: vendor._id,
      isActive: true,
      address: {
        addressLine1: "Air Cargo Complex",
        city: "New Delhi",
        state: "Delhi",
        country: "IN",
        postalCode: "110037",
      },
    });

    const category = await Category.create({
      name: `Category VD07 ${uniqueSuffix}`,
      slug: `category-vd07-${uniqueSuffix}`,
      isActive: true,
    });

    product = await Product.create({
      name: "VD07 Concurrency Test Product",
      title: "VD07 Concurrency Test Product",
      slug: `vd07-product-${uniqueSuffix}`,
      sku: `PROD-VD07-${uniqueSuffix.toString().slice(-4)}`,
      vendorId: vendor._id,
      categoryId: category._id,
      price: mongoose.Types.Decimal128.fromString("1499.00"),
      currency: "INR",
      status: "active",
      approvalStatus: "approved",
      publishedAt: new Date(),
      isActive: true,
      description: "State integrity and optimistic concurrency test product",
    });

    variant = await ProductVariant.create({
      productId: product._id,
      sku: `SKU-VD07-${uniqueSuffix}`,
      price: mongoose.Types.Decimal128.fromString("1499.00"),
      currency: "INR",
      status: "active",
      approvalStatus: "approved",
      publishedAt: new Date(),
      isActive: true,
    });

    inventoryDoc = await Inventory.create({
      warehouseId: warehouse._id,
      productVariantId: variant._id,
      onHand: 100,
      reserved: 20,
      quantityOnHand: 100,
      quantityReserved: 20,
      quantityAllocated: 0,
      safetyStock: 0,
      isLowStock: false,
    });
  });

  beforeEach(async () => {
    if (inventoryDoc) {
      await Inventory.updateOne(
        { _id: inventoryDoc._id },
        { onHand: 100, reserved: 20, quantityOnHand: 100, quantityReserved: 20 }
      );
    }
  });

  afterAll(async () => {
    try {
      if (customerUser) await User.deleteOne({ _id: customerUser._id });
      if (customer) await Customer.deleteOne({ _id: customer._id });
      if (vendorUser) await User.deleteOne({ _id: vendorUser._id });
      if (vendor) await Vendor.deleteOne({ _id: vendor._id });
      if (adminUser) await User.deleteOne({ _id: adminUser._id });
      if (superAdminUser) await User.deleteOne({ _id: superAdminUser._id });
      if (warehouse) await Warehouse.deleteOne({ _id: warehouse._id });
      if (product) await Product.deleteOne({ _id: product._id });
      if (variant) await ProductVariant.deleteOne({ _id: variant._id });
      if (inventoryDoc) await Inventory.deleteOne({ _id: inventoryDoc._id });
      await Order.deleteMany({ orderNumber: { $regex: /^ORD-VD07-/ } });
      await Shipment.deleteMany({ shipmentNumber: { $regex: /^SHP-VD07-/ } });
      await ShipmentWebhookEvent.deleteMany({ trackingNumber: { $regex: /^TRK-VD07-/ } });
      await mongoose.disconnect();
    } catch {
      // Best-effort cleanup
    }
  });

  // Helper to generate fresh order & shipment
  const createOrderAndShipment = async ({ orderStatus = "processing", shipmentStatus = "ready_to_ship" } = {}) => {
    const unique = Date.now() + Math.floor(Math.random() * 100000);
    const order = await Order.create({
      customerId: customer._id,
      orderNumber: `ORD-VD07-${unique}`,
      status: orderStatus,
      paymentStatus: "paid",
      paymentMethod: "razorpay",
      currency: "INR",
      subtotal: mongoose.Types.Decimal128.fromString("2998.00"),
      discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
      taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
      shippingTotal: mongoose.Types.Decimal128.fromString("0.00"),
      grandTotal: mongoose.Types.Decimal128.fromString("2998.00"),
      amountPaid: mongoose.Types.Decimal128.fromString("2998.00"),
      fulfillmentStatus: "unfulfilled",
      inventoryStatus: "reserved",
      version: 1,
      items: [
        {
          productId: product._id,
          productVariantId: variant._id,
          vendorId: vendor._id,
          warehouseId: warehouse._id,
          sku: variant.sku,
          productName: product.title || "VD07 Concurrency Test Product",
          variantName: "Standard",
          quantity: 2,
          unitPrice: mongoose.Types.Decimal128.fromString("1499.00"),
          price: mongoose.Types.Decimal128.fromString("1499.00"),
          discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
          taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
          lineTotal: mongoose.Types.Decimal128.fromString("2998.00"),
          currency: "INR",
          fulfillmentStatus: "processing",
          inventoryStatus: "reserved",
        },
      ],
      shippingAddress: {
        fullName: "VD07 Recipient",
        phone: "+919876543299",
        addressLine1: "Connaught Place",
        city: "New Delhi",
        state: "Delhi",
        country: "IN",
        postalCode: "110001",
      },
      pricing: {
        subtotal: mongoose.Types.Decimal128.fromString("2998.00"),
        shippingFee: mongoose.Types.Decimal128.fromString("0.00"),
        taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
        total: mongoose.Types.Decimal128.fromString("2998.00"),
      },
    });

    const shipment = await Shipment.create({
      orderId: order._id,
      customerId: customer._id,
      vendorId: vendor._id,
      warehouseId: warehouse._id,
      shipmentNumber: `SHP-VD07-${unique}`,
      trackingNumber: `TRK-VD07-${unique}`,
      awbNumber: `TRK-VD07-${unique}`,
      carrier: "Delhivery",
      status: shipmentStatus,
      inventoryStatus: shipmentStatus === "picked_up" ? "deducted" : "reserved",
      version: 1,
      items: [
        {
          productId: product._id,
          productVariantId: variant._id,
          name: product.title || "VD07 Concurrency Test Product",
          sku: variant.sku,
          quantity: 2,
        },
      ],
      shippingAddress: order.shippingAddress,
      trackingEvents: [
        {
          status: "created",
          milestone: "created",
          description: "Shipment created",
          timestamp: new Date(Date.now() - 3600000),
          source: "system",
        },
      ],
    });

    return { order, shipment };
  };

  describe("1. P0 — Atomic Optimistic Concurrency Engine & Version Lock", () => {
    it("increments shipment version on successful transition", async () => {
      const { shipment } = await createOrderAndShipment({ shipmentStatus: "created" });
      expect(shipment.version).toBe(1);

      const updated = await shipmentService.transitionShipmentStatus({
        shipmentId: shipment._id,
        nextStatus: "ready_to_ship",
        expectedPreviousStatus: "created",
        expectedVersion: 1,
      });

      expect(updated.status).toBe("ready_to_ship");
      expect(updated.version).toBe(2);

      const dbShipment = await Shipment.findById(shipment._id);
      expect(dbShipment.version).toBe(2);
    });

    it("rejects transition with 409 STATE_VERSION_CONFLICT when expectedVersion is stale", async () => {
      const { shipment } = await createOrderAndShipment({ shipmentStatus: "ready_to_ship" });

      // First transition advances version 1 -> 2
      await shipmentService.transitionShipmentStatus({
        shipmentId: shipment._id,
        nextStatus: "picked_up",
        expectedVersion: 1,
      });

      // Second transition attempts with stale expectedVersion: 1 (current is 2)
      await expect(
        shipmentService.transitionShipmentStatus({
          shipmentId: shipment._id,
          nextStatus: "in_transit",
          expectedVersion: 1,
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "STATE_VERSION_CONFLICT",
      });
    });

    it("resolves concurrent competing mutations atomically with exactly one winner", async () => {
      const { shipment } = await createOrderAndShipment({ shipmentStatus: "ready_to_ship" });
      expect(shipment.version).toBe(1);

      // Thread A: Carrier dispatch handover -> picked_up (expectedVersion: 1)
      const threadA = shipmentService.transitionShipmentStatus({
        shipmentId: shipment._id,
        nextStatus: "picked_up",
        expectedPreviousStatus: "ready_to_ship",
        expectedVersion: 1,
      });

      // Thread B: Superadmin override cancellation -> cancelled (expectedVersion: 1)
      const threadB = shipmentService.transitionShipmentStatus({
        shipmentId: shipment._id,
        nextStatus: "cancelled",
        expectedPreviousStatus: "ready_to_ship",
        expectedVersion: 1,
        isOverride: true,
        overrideReason: "Customer requested urgent cancellation before dispatch",
        actorUser: { role: "super_admin" },
      });

      const results = await Promise.allSettled([threadA, threadB]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      // Exactly one must succeed, and one must be rejected with 409 conflict
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      const error = rejected[0].reason;
      expect([409]).toContain(error.statusCode);
      expect(["STATE_VERSION_CONFLICT", "CONCURRENCY_CONFLICT"]).toContain(error.code);

      // Verify the database holds the state of the winning operation, at version 2
      const freshShipment = await Shipment.findById(shipment._id);
      expect(freshShipment.version).toBe(2);
      expect([SHIPMENT_STATUSES.PICKED_UP, SHIPMENT_STATUSES.CANCELLED]).toContain(freshShipment.status);
    });
  });

  describe("2. P0 — Courier Evidence Non-Destruction in Administrative Overrides", () => {
    it("preserves authentic courier tracking events and never mutates cancelled shipments upon admin order status updates", async () => {
      const { order, shipment: activeShipment } = await createOrderAndShipment({ shipmentStatus: "ready_to_ship" });

      // Add authentic courier milestone to active shipment
      activeShipment.trackingEvents.push({
        status: "picked_up",
        milestone: "picked_up",
        description: "Parcel collected from Delhivery Hub Okhla",
        location: "New Delhi",
        timestamp: new Date(Date.now() - 1800000),
        source: "carrier_webhook",
      });
      activeShipment.status = "picked_up";
      await activeShipment.save();

      // Create a secondary cancelled shipment for the same order
      const cancelledShipment = await Shipment.create({
        orderId: order._id,
        customerId: customer._id,
        vendorId: vendor._id,
        warehouseId: warehouse._id,
        shipmentNumber: `SHP-VD07-CANC-${Date.now()}`,
        trackingNumber: `TRK-VD07-CANC-${Date.now()}`,
        carrier: "Delhivery",
        status: "cancelled",
        inventoryStatus: "released",
        cancelledAt: new Date(),
        version: 1,
        items: [
          {
            productId: product._id,
            productVariantId: variant._id,
            name: product.title || "VD07 Concurrency Test Product",
            sku: variant.sku,
            quantity: 1,
          },
        ],
        shippingAddress: order.shippingAddress,
      });

      // Admin updates order status to 'delivered' via order.service.js
      await orderService.updateAdminOrderStatus({
        orderId: order._id.toString(),
        status: "delivered",
        reason: "Customer confirmed parcel receipt via phone",
        expectedPreviousStatus: "processing",
        actor: { userId: superAdminUser._id, role: "super_admin" },
      });

      // 1. Verify active shipment was cleanly transitioned to delivered with milestone history intact
      const updatedActive = await Shipment.findById(activeShipment._id);
      expect(updatedActive.status).toBe(SHIPMENT_STATUSES.DELIVERED);
      expect(updatedActive.deliveredAt).toBeDefined();

      // Milestone history must NOT be wiped out
      const hasCourierMilestone = updatedActive.trackingEvents.some(
        (e) => e.description === "Parcel collected from Delhivery Hub Okhla" && e.source === "carrier_webhook"
      );
      expect(hasCourierMilestone).toBe(true);

      // 2. CRITICAL INVARIANT: The cancelled shipment MUST REMAIN cancelled!
      const freshCancelled = await Shipment.findById(cancelledShipment._id);
      expect(freshCancelled.status).toBe(SHIPMENT_STATUSES.CANCELLED);
      expect(freshCancelled.inventoryStatus).toBe("released");
    });
  });

  describe("3. P1 — Webhook Multiple Milestones Without Event Dropping (F-03 & F-09)", () => {
    it("successfully progresses shipment through multiple webhook status events without explicit event_id", async () => {
      const { shipment } = await createOrderAndShipment({ shipmentStatus: "ready_to_ship" });
      const awb = shipment.trackingNumber;

      // Milestone 1: picked_up (no explicit event_id, only awb and status)
      const res1 = await courierService.handleWebhook({
        provider: "delhivery",
        headers: { "x-delhivery-signature": "mock" },
        body: { awb, status: "picked_up" },
      });
      expect(res1.success).toBe(true);
      expect(res1.newStatus).toBe(SHIPMENT_STATUSES.PICKED_UP);

      // Milestone 2: in_transit (same AWB, different status, no explicit event_id)
      const res2 = await courierService.handleWebhook({
        provider: "delhivery",
        headers: { "x-delhivery-signature": "mock" },
        body: { awb, status: "in_transit" },
      });
      expect(res2.success).toBe(true);
      expect(res2.newStatus).toBe(SHIPMENT_STATUSES.IN_TRANSIT);

      // Milestone 3: out_for_delivery
      const res3 = await courierService.handleWebhook({
        provider: "delhivery",
        headers: { "x-delhivery-signature": "mock" },
        body: { awb, status: "out_for_delivery" },
      });
      expect(res3.success).toBe(true);
      expect(res3.newStatus).toBe(SHIPMENT_STATUSES.OUT_FOR_DELIVERY);

      // Milestone 4: delivered
      const res4 = await courierService.handleWebhook({
        provider: "delhivery",
        headers: { "x-delhivery-signature": "mock" },
        body: { awb, status: "delivered" },
      });
      expect(res4.success).toBe(true);
      expect(res4.newStatus).toBe(SHIPMENT_STATUSES.DELIVERED);

      // Milestone 5: Duplicate of delivered event must be recognized as duplicate
      const resDup = await courierService.handleWebhook({
        provider: "delhivery",
        headers: { "x-delhivery-signature": "mock" },
        body: { awb, status: "delivered" },
      });
      expect(resDup.duplicate).toBe(true);
      expect(resDup.message).toBe("Webhook event already processed");

      // Verify shipment in DB reached delivered
      const dbShipment = await Shipment.findById(shipment._id);
      expect(dbShipment.status).toBe(SHIPMENT_STATUSES.DELIVERED);
    });
  });

  describe("4. P1 — Financial Invariant: Customer Refund on Shipment Cancellation (F-04)", () => {
    it("automatically initiates customer refund when all shipments for a captured order are cancelled", async () => {
      const { order, shipment } = await createOrderAndShipment({ shipmentStatus: "ready_to_ship" });

      // Create Payment document in 'captured' state
      await Payment.create({
        orderId: order._id,
        customerId: customer._id,
        amount: 2998.00,
        currency: "INR",
        paymentMethod: "razorpay",
        gatewayOrderId: `rzp_order_${Date.now()}`,
        gatewayPaymentId: `rzp_pay_${Date.now()}`,
        status: "captured",
        capturedAt: new Date(),
      });

      // Cancel the only shipment for this order
      await shipmentService.transitionShipmentStatus({
        shipmentId: shipment._id,
        nextStatus: "cancelled",
        reason: "Out of stock at fulfilling merchant",
        isOverride: true,
        overrideReason: "Merchant inventory exhausted; order unfulfillable",
        actorUser: { role: "super_admin" },
      });

      // Verify parent order transitioned to cancelled
      const freshOrder = await Order.findById(order._id);
      expect(freshOrder.status).toBe(ORDER_STATUSES.CANCELLED);
      expect(freshOrder.fulfillmentStatus).toBe(FULFILLMENT_STATUSES.CANCELLED);

      // Verify Payment record was refunded
      const updatedPayment = await Payment.findOne({ orderId: order._id });
      expect(["refunded", "partially_refunded"]).toContain(updatedPayment.status);
    });
  });

  describe("5. P1 — Vendor Delivery Fraud Prevention (F-05)", () => {
    it("prohibits vendor from self-certifying delivery on integrated courier shipments in production", async () => {
      const { shipment } = await createOrderAndShipment({ shipmentStatus: "in_transit" });

      const prevEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = "production";

        await expect(
          shipmentService.transitionShipmentStatus({
            shipmentId: shipment._id,
            nextStatus: "delivered",
            userId: vendorUser._id, // Vendor actor
            actorUser: { role: "vendor", _id: vendorUser._id },
          })
        ).rejects.toMatchObject({
          statusCode: 403,
          code: "VENDOR_DELIVERY_SELF_CERTIFICATION_PROHIBITED",
        });
      } finally {
        process.env.NODE_ENV = prevEnv;
      }
    });
  });

  describe("6. P2 — Inventory Restock on Post-Pickup Cancellation Override (F-06)", () => {
    it("restocks warehouse inventory when a picked_up shipment is cancelled by administrator", async () => {
      const { shipment } = await createOrderAndShipment({ shipmentStatus: "picked_up" });

      const initialInventory = await Inventory.findOne({
        warehouseId: warehouse._id,
        productVariantId: variant._id,
      });
      const initialOnHand = initialInventory.quantityOnHand;

      // Superadmin cancels the picked-up shipment
      await shipmentService.transitionShipmentStatus({
        shipmentId: shipment._id,
        nextStatus: "cancelled",
        isOverride: true,
        overrideReason: "Carrier returned damaged parcel before transit",
        actorUser: { role: "super_admin" },
      });

      const updatedShipment = await Shipment.findById(shipment._id);
      expect(updatedShipment.status).toBe(SHIPMENT_STATUSES.CANCELLED);
      expect(updatedShipment.inventoryStatus).toBe("released");

      // Verify stock in inventory was restocked (+2 items restored)
      const restoredInventory = await Inventory.findOne({
        warehouseId: warehouse._id,
        productVariantId: variant._id,
      });
      expect(restoredInventory.quantityOnHand).toBe(initialOnHand + 2);
    });
  });

  describe("7. P2 — Returns & RTO Order Synchronization (F-08)", () => {
    it("synchronizes order fulfillment status and item status when shipment is marked returned", async () => {
      const { order, shipment } = await createOrderAndShipment({ shipmentStatus: "in_transit" });

      // Transition shipment to returned
      await shipmentService.transitionShipmentStatus({
        shipmentId: shipment._id,
        nextStatus: "returned",
        reason: "Customer rejected delivery at doorstep",
        isOverride: true,
        overrideReason: "Consignment returned to merchant origin",
        actorUser: { role: "super_admin" },
      });

      const freshShipment = await Shipment.findById(shipment._id);
      expect(freshShipment.status).toBe(SHIPMENT_STATUSES.RETURNED);

      // Verify parent order item & fulfillment status synchronized
      const freshOrder = await Order.findById(order._id);
      expect(freshOrder.fulfillmentStatus).toBe("returned");
      expect(freshOrder.items[0].fulfillmentStatus).toBe("returned");
    });
  });
});
