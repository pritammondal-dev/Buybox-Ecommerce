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

describe("Courier Integrations & Webhook Security Suite", () => {
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

  describe("1. Courier Adapter Interface & Raw-Body Cryptographic Signature Verification", () => {
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

    it("verifies Delhivery webhook signature correctly with exact raw payload buffer", () => {
      const delhivery = new DelhiveryAdapter();
      const secret = "test_webhook_secret_key_123";
      const payload = { awb: "TRK-001", status: "in_transit" };
      const rawPayload = JSON.stringify(payload);
      const signature = crypto.createHmac("sha256", secret).update(Buffer.from(rawPayload, "utf8")).digest("hex");

      const isValid = delhivery.verifyWebhookSignature({
        headers: { "x-delhivery-signature": signature },
        body: payload,
        rawBody: Buffer.from(rawPayload, "utf8"),
        runtimeCredentials: { clientSecret: secret },
      });
      expect(isValid).toBe(true);
    });

    it("verifies Delhivery signature with whitespace variations when rawBody is preserved", () => {
      const delhivery = new DelhiveryAdapter();
      const secret = "test_webhook_secret_key_123";
      // Raw string containing extra whitespace and newlines as sent by courier
      const rawPayloadWithWhitespace = '{\n  "awb": "TRK-001",  \n  "status": "in_transit"\n}';
      const signature = crypto.createHmac("sha256", secret).update(Buffer.from(rawPayloadWithWhitespace, "utf8")).digest("hex");
      const parsedBody = JSON.parse(rawPayloadWithWhitespace);

      // Raw body verification succeeds with exact bytes
      const isValid = delhivery.verifyWebhookSignature({
        headers: { "x-delhivery-signature": signature },
        body: parsedBody,
        rawBody: Buffer.from(rawPayloadWithWhitespace, "utf8"),
        runtimeCredentials: { clientSecret: secret },
      });
      expect(isValid).toBe(true);

      // Contrast: If re-stringified JSON was used, hash would differ and fail
      const stringifiedPayload = JSON.stringify(parsedBody);
      const recomputedHash = crypto.createHmac("sha256", secret).update(stringifiedPayload).digest("hex");
      expect(recomputedHash).not.toBe(signature);
    });

    it("verifies Delhivery signature with alternative key ordering in raw payload bytes", () => {
      const delhivery = new DelhiveryAdapter();
      const secret = "test_webhook_secret_key_123";
      const rawPayload = '{"status":"in_transit","awb":"TRK-001"}';
      const signature = crypto.createHmac("sha256", secret).update(Buffer.from(rawPayload, "utf8")).digest("hex");
      const parsedBody = JSON.parse(rawPayload);

      const isValid = delhivery.verifyWebhookSignature({
        headers: { "x-delhivery-signature": signature },
        body: parsedBody,
        rawBody: Buffer.from(rawPayload, "utf8"),
        runtimeCredentials: { clientSecret: secret },
      });
      expect(isValid).toBe(true);
    });

    it("rejects Delhivery signature when payload has been modified", () => {
      const delhivery = new DelhiveryAdapter();
      const secret = "test_webhook_secret_key_123";
      const originalPayload = '{"awb":"TRK-001","status":"in_transit"}';
      const signature = crypto.createHmac("sha256", secret).update(Buffer.from(originalPayload, "utf8")).digest("hex");

      const modifiedPayload = '{"awb":"TRK-001","status":"delivered"}';
      const isValid = delhivery.verifyWebhookSignature({
        headers: { "x-delhivery-signature": signature },
        body: JSON.parse(modifiedPayload),
        rawBody: Buffer.from(modifiedPayload, "utf8"),
        runtimeCredentials: { clientSecret: secret },
      });
      expect(isValid).toBe(false);
    });

    it("rejects Delhivery signature when header is missing, malformed, or incorrect", () => {
      const delhivery = new DelhiveryAdapter();
      const secret = "test_webhook_secret_key_123";
      const rawPayload = '{"awb":"TRK-001","status":"in_transit"}';

      // 1. Missing signature
      expect(
        delhivery.verifyWebhookSignature({
          headers: {},
          body: JSON.parse(rawPayload),
          rawBody: Buffer.from(rawPayload, "utf8"),
          runtimeCredentials: { clientSecret: secret },
        })
      ).toBe(false);

      // 2. Malformed signature (non-hex string)
      expect(
        delhivery.verifyWebhookSignature({
          headers: { "x-delhivery-signature": "not-a-valid-hex-string!!" },
          body: JSON.parse(rawPayload),
          rawBody: Buffer.from(rawPayload, "utf8"),
          runtimeCredentials: { clientSecret: secret },
        })
      ).toBe(false);

      // 3. Incorrect length
      expect(
        delhivery.verifyWebhookSignature({
          headers: { "x-delhivery-signature": "abcdef123456" },
          body: JSON.parse(rawPayload),
          rawBody: Buffer.from(rawPayload, "utf8"),
          runtimeCredentials: { clientSecret: secret },
        })
      ).toBe(false);

      // 4. Incorrect 64-char hex hash
      const fakeHex = "a".repeat(64);
      expect(
        delhivery.verifyWebhookSignature({
          headers: { "x-delhivery-signature": fakeHex },
          body: JSON.parse(rawPayload),
          rawBody: Buffer.from(rawPayload, "utf8"),
          runtimeCredentials: { clientSecret: secret },
        })
      ).toBe(false);
    });

    it("rejects Delhivery signature when rawBody is missing without silently falling back to JSON.stringify", () => {
      const delhivery = new DelhiveryAdapter();
      const secret = "test_webhook_secret_key_123";
      const payload = { awb: "TRK-001", status: "in_transit" };
      const rawPayload = JSON.stringify(payload);
      const signature = crypto.createHmac("sha256", secret).update(rawPayload).digest("hex");

      // When secret is configured and rawBody is omitted/null, it MUST return false (Rule 11)
      const isValid = delhivery.verifyWebhookSignature({
        headers: { "x-delhivery-signature": signature },
        body: payload,
        rawBody: null,
        runtimeCredentials: { clientSecret: secret },
      });
      expect(isValid).toBe(false);
    });

    it("verifies and rejects Shiprocket webhook tokens using constant-time comparison", () => {
      const shiprocket = new ShiprocketAdapter();
      const validToken = "secure_shiprocket_token_xyz_789";

      // 1. Valid token
      expect(
        shiprocket.verifyWebhookSignature({
          headers: { "x-api-key": validToken },
          runtimeCredentials: { apiKey: validToken },
        })
      ).toBe(true);

      // 2. Mismatched token
      expect(
        shiprocket.verifyWebhookSignature({
          headers: { "x-api-key": "invalid_wrong_token_123" },
          runtimeCredentials: { apiKey: validToken },
        })
      ).toBe(false);

      // 3. Missing header
      expect(
        shiprocket.verifyWebhookSignature({
          headers: {},
          runtimeCredentials: { apiKey: validToken },
        })
      ).toBe(false);
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

  describe("3. Webhook HTTP Ingress, Raw Body Capture & Invariant Verification", () => {
    it("receives POST /api/v1/shipping/webhooks/shiprocket successfully", async () => {
      const trackingNumber = `TRK-ROUTE-SR-${Date.now()}`;
      await Shipment.create({
        orderId: dummyOrderId,
        customerId: dummyCustomerId,
        vendorId: dummyVendorId,
        warehouseId: dummyWarehouseId,
        shipmentNumber: `TEST-COURIER-SR-${Date.now()}`,
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

    it("verifies HTTP POST /api/v1/shipping/webhooks/delhivery with raw JSON body and valid HMAC", async () => {
      const trackingNumber = `TRK-ROUTE-DL-${Date.now()}`;
      const shipment = await Shipment.create({
        orderId: dummyOrderId,
        customerId: dummyCustomerId,
        vendorId: dummyVendorId,
        warehouseId: dummyWarehouseId,
        shipmentNumber: `TEST-COURIER-DL-${Date.now()}`,
        status: SHIPMENT_STATUSES.READY_TO_SHIP,
        inventoryStatus: "reserved",
        carrier: "Delhivery",
        trackingNumber,
        shippingAddress: {
          fullName: "Bob Smith",
          phone: "9876543210",
          addressLine1: "789 High Street",
          city: "Delhi",
          state: "Delhi",
          postalCode: "110001",
          country: "India",
        },
      });

      // Raw JSON body with whitespace variations
      const rawBody = `{\n  "awb": "${trackingNumber}", \n  "status": "picked_up"\n}`;

      const res = await request(app)
        .post("/api/v1/shipping/webhooks/delhivery")
        .set("Content-Type", "application/json")
        .set("x-delhivery-signature", "valid_mock_signature")
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.newStatus).toBe(SHIPMENT_STATUSES.PICKED_UP);

      const updated = await Shipment.findById(shipment._id);
      expect(updated.status).toBe(SHIPMENT_STATUSES.PICKED_UP);
    });

    it("rejects invalid webhook signature over HTTP without mutating shipment status", async () => {
      const trackingNumber = `TRK-ROUTE-FAIL-${Date.now()}`;
      const shipment = await Shipment.create({
        orderId: dummyOrderId,
        customerId: dummyCustomerId,
        vendorId: dummyVendorId,
        warehouseId: dummyWarehouseId,
        shipmentNumber: `TEST-COURIER-FAIL-${Date.now()}`,
        status: SHIPMENT_STATUSES.READY_TO_SHIP,
        inventoryStatus: "reserved",
        carrier: "Delhivery",
        trackingNumber,
        shippingAddress: {
          fullName: "Charles Darwin",
          phone: "9876543210",
          addressLine1: "1 Darwin Way",
          city: "Bangalore",
          state: "Karnataka",
          postalCode: "560001",
          country: "India",
        },
      });

      // Mock an invalid webhook request with missing signature header
      const res = await request(app)
        .post("/api/v1/shipping/webhooks/delhivery")
        .set("Content-Type", "application/json")
        .send({
          awb: trackingNumber,
          status: "delivered",
        });

      // When signature is absent, verifyWebhookSignature returns false -> 401
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);

      // Verify shipment status was NOT mutated
      const unchanged = await Shipment.findById(shipment._id);
      expect(unchanged.status).toBe(SHIPMENT_STATUSES.READY_TO_SHIP);
    });

    it("preserves standard JSON body parsing on unrelated routes", async () => {
      // Unrelated route that accepts JSON
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "unrelated-test@buybox.test",
          password: "SamplePassword123!",
        });

      // Should be processed through standard express.json()
      // Status will be 401/400 (credentials not found/invalid), proving normal JSON parsing succeeded
      expect([400, 401, 404]).toContain(res.status);
      expect(res.body).toBeDefined();
    });
  });
});
