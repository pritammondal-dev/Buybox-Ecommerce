const request = require("supertest");
const mongoose = require("mongoose");
const crypto = require("crypto");
const app = require("../src/app");
const Shipment = require("../src/models/Shipment");
const ShipmentWebhookEvent = require("../src/models/ShipmentWebhookEvent");
const PlatformCredential = require("../src/models/PlatformCredential");
const DelhiveryAdapter = require("../src/integrations/shipping/delhivery.adapter");
const ShiprocketAdapter = require("../src/integrations/shipping/shiprocket.adapter");
const courierService = require("../src/services/courier.service");
const { SHIPMENT_STATUSES } = require("../src/constants/shipping.constants");

const TEST_MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/buybox-ecommerce";

describe("Courier Integrations & Webhook State Machine Suite", () => {
  const dummyOrderId = new mongoose.Types.ObjectId();
  const dummyCustomerId = new mongoose.Types.ObjectId();
  const dummyVendorId = new mongoose.Types.ObjectId();
  const dummyWarehouseId = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    const Order = require("../src/models/Order");
    await Order.deleteOne({ _id: dummyOrderId });
    await Order.create({
      _id: dummyOrderId,
      orderNumber: "ORD-COURIER-TEST",
      customerId: dummyCustomerId,
      status: "processing",
      paymentStatus: "paid",
      shippingAddress: {
        fullName: "Test Customer",
        phone: "9876543210",
        addressLine1: "123 Test Street",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "IN",
      },
      items: [
        {
          productId: new mongoose.Types.ObjectId(),
          productVariantId: new mongoose.Types.ObjectId(),
          vendorId: dummyVendorId,
          warehouseId: dummyWarehouseId,
          productName: "Test Item",
          sku: "SKU-TEST-001",
          unitPrice: 1000,
          lineTotal: 1000,
          currency: "INR",
          quantity: 1,
        },
      ],
      subtotal: 1000,
      total: 1000,
    });

    await Shipment.deleteMany({ shipmentNumber: { $regex: /^TEST-COURIER-/ } });
    await ShipmentWebhookEvent.deleteMany({ trackingNumber: { $regex: /^TRK-/ } });
  });

  afterAll(async () => {
    try {
      const Order = require("../src/models/Order");
      await Order.deleteOne({ _id: dummyOrderId });
      await Shipment.deleteMany({ shipmentNumber: { $regex: /^TEST-COURIER-/ } });
      await ShipmentWebhookEvent.deleteMany({ trackingNumber: { $regex: /^TRK-/ } });
      await mongoose.disconnect();
    } catch {
      // Best-effort cleanup
    }
  });

  describe("1. Courier Adapter Interface & URL Generation", () => {
    it("generates correct tracking URLs for Delhivery and Shiprocket", () => {
      const delhivery = new DelhiveryAdapter();
      const shiprocket = new ShiprocketAdapter();

      expect(delhivery.generateTrackingUrl("WAYBILL12345")).toBe(
        "https://www.delhivery.com/track/package/WAYBILL12345"
      );
      expect(shiprocket.generateTrackingUrl("AWB98765")).toBe(
        "https://shiprocket.co/tracking/AWB98765"
      );
    });

    it("verifies webhook signature correctly with HMAC-SHA256 for Delhivery", () => {
      const delhivery = new DelhiveryAdapter();
      const secret = "test_webhook_secret_key_123";
      const payload = { awb: "TRK-001", status: "in_transit" };
      const rawPayload = JSON.stringify(payload);
      const signature = crypto.createHmac("sha256", secret).update(rawPayload).digest("hex");

      // Valid signature
      const isValid = delhivery.verifyWebhookSignature({
        headers: { "x-delhivery-signature": signature },
        body: payload,
        runtimeCredentials: { clientSecret: secret },
      });
      expect(isValid).toBe(true);

      // Tampered / invalid signature
      const isTampered = delhivery.verifyWebhookSignature({
        headers: { "x-delhivery-signature": "tampered_signature_hex" },
        body: payload,
        runtimeCredentials: { clientSecret: secret },
      });
      expect(isTampered).toBe(false);
    });
  });

  describe("2. Shipment State Machine & Webhook Transitions", () => {
    let testShipment;

    beforeEach(async () => {
      testShipment = await Shipment.create({
        orderId: dummyOrderId,
        customerId: dummyCustomerId,
        vendorId: dummyVendorId,
        warehouseId: dummyWarehouseId,
        shipmentNumber: `TEST-COURIER-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        status: SHIPMENT_STATUSES.READY_TO_SHIP,
        inventoryStatus: "reserved",
        carrier: "Delhivery",
        trackingNumber: `TRK-${Date.now()}`,
        shippingAddress: {
          fullName: "John Doe",
          phone: "9876543210",
          addressLine1: "123 Test Street",
          city: "Kolkata",
          state: "West Bengal",
          postalCode: "700001",
          country: "India",
        },
      });
    });

    it("transitions shipment from ready_to_ship -> picked_up -> in_transit", async () => {
      // Step 1: Picked Up
      const res1 = await courierService.handleWebhook({
        provider: "delhivery",
        headers: { "x-delhivery-signature": "mock" },
        body: {
          event_id: `EVT-1-${Date.now()}`,
          tracking_number: testShipment.trackingNumber,
          status: "picked_up",
        },
      });

      expect(res1.success).toBe(true);
      expect(res1.newStatus).toBe(SHIPMENT_STATUSES.PICKED_UP);

      const dbShipment1 = await Shipment.findById(testShipment._id);
      expect(dbShipment1.status).toBe(SHIPMENT_STATUSES.PICKED_UP);

      // Step 2: In Transit
      const res2 = await courierService.handleWebhook({
        provider: "delhivery",
        headers: { "x-delhivery-signature": "mock" },
        body: {
          event_id: `EVT-2-${Date.now()}`,
          tracking_number: testShipment.trackingNumber,
          status: "in_transit",
        },
      });

      expect(res2.success).toBe(true);
      expect(res2.newStatus).toBe(SHIPMENT_STATUSES.IN_TRANSIT);

      const dbShipment2 = await Shipment.findById(testShipment._id);
      expect(dbShipment2.status).toBe(SHIPMENT_STATUSES.IN_TRANSIT);
    });

    it("rejects illegal status transition (created directly to delivered)", async () => {
      await expect(
        courierService.handleWebhook({
          provider: "delhivery",
          headers: { "x-delhivery-signature": "mock" },
          body: {
            event_id: `EVT-ILLEGAL-${Date.now()}`,
            tracking_number: testShipment.trackingNumber,
            status: "delivered",
          },
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: "INVALID_SHIPMENT_STATUS_TRANSITION",
      });

      // Status should remain ready_to_ship
      const dbShipment = await Shipment.findById(testShipment._id);
      expect(dbShipment.status).toBe(SHIPMENT_STATUSES.READY_TO_SHIP);
    });

    it("enforces idempotency and catches duplicate webhook delivery", async () => {
      const eventId = `EVT-DUP-${Date.now()}`;
      const payload = {
        event_id: eventId,
        tracking_number: testShipment.trackingNumber,
        status: "picked_up",
      };

      // First delivery
      const firstRes = await courierService.handleWebhook({
        provider: "delhivery",
        headers: { "x-delhivery-signature": "mock" },
        body: payload,
      });
      expect(firstRes.success).toBe(true);
      expect(firstRes.newStatus).toBe(SHIPMENT_STATUSES.PICKED_UP);

      // Duplicate delivery with same eventId
      const secondRes = await courierService.handleWebhook({
        provider: "delhivery",
        headers: { "x-delhivery-signature": "mock" },
        body: payload,
      });

      expect(secondRes.duplicate).toBe(true);
      expect(secondRes.message).toBe("Webhook event already processed");

      // Verify only 1 webhook event was created in DB
      const count = await ShipmentWebhookEvent.countDocuments({
        provider: "delhivery",
        eventId,
      });
      expect(count).toBe(1);
    });
  });

  describe("3. Webhook HTTP Endpoint Route", () => {
    it("receives POST /api/v1/shipping/webhooks/:provider successfully", async () => {
      const trackingNumber = `TRK-ROUTE-${Date.now()}`;
      await Shipment.create({
        orderId: dummyOrderId,
        customerId: dummyCustomerId,
        vendorId: dummyVendorId,
        warehouseId: dummyWarehouseId,
        shipmentNumber: `TEST-COURIER-ROUTE-${Date.now()}`,
        status: SHIPMENT_STATUSES.READY_TO_SHIP,
        inventoryStatus: "reserved",
        carrier: "Shiprocket",
        trackingNumber,
        shippingAddress: {
          fullName: "Alice Smith",
          phone: "9876543210",
          addressLine1: "456 Avenue",
          city: "Mumbai",
          state: "Maharashtra",
          postalCode: "400001",
          country: "India",
        },
      });

      const res = await request(app)
        .post("/api/v1/shipping/webhooks/shiprocket")
        .set("x-api-key", "mock")
        .send({
          awb: trackingNumber,
          status: "picked_up",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.newStatus).toBe(SHIPMENT_STATUSES.PICKED_UP);
    });
  });
});
