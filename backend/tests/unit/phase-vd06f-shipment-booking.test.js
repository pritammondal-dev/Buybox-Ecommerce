const mongoose = require("mongoose");
const DelhiveryAdapter = require("../../src/integrations/shipping/delhivery.adapter");
const {
  SHIPMENT_STATUSES,
  SHIPMENT_STATUS_TRANSITIONS,
} = require("../../src/constants/shipping.constants");
const {
  createVendorOrderShipmentSchema,
} = require("../../src/validators/order/vendor-order.validator");
const shipmentService = require("../../src/services/shipment.service");
const shipmentRepository = require("../../src/repositories/shipment.repository");
const Order = require("../../src/models/Order");
const Vendor = require("../../src/models/Vendor");
const Shipment = require("../../src/models/Shipment");
const AppError = require("../../src/errors/AppError");

describe("Phase VD-06F: Merchant Shipment Creation & Courier Booking Unit Suite", () => {
  describe("1. Delhivery Courier Adapter (CFG-VD06E-01 & INT-VD06E-01)", () => {
    let adapter;

    beforeEach(() => {
      adapter = new DelhiveryAdapter();
    });

    test("resolves credentials correctly when none are set (fallback to empty)", () => {
      const creds = adapter.resolveCredentials({});
      expect(creds).toBeDefined();
      expect(creds.apiKey).toBe("");
    });

    test("returns not_configured status gracefully when API credentials are missing (NEVER synthetic AWBs)", async () => {
      const result = await adapter.createShipment({
        shipment: { _id: new mongoose.Types.ObjectId() },
        destination: { fullName: "Jane Doe", postalCode: "110001" },
        runtimeCredentials: { apiKey: "" },
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe("not_configured");
      expect(result.error).toMatch(/credentials not configured/i);
      expect(result.waybill).toBeUndefined();
    });

    test("rejects shipment creation when destination postalCode or name is missing", async () => {
      const result = await adapter.createShipment({
        shipment: {},
        destination: { fullName: "", postalCode: "" },
        runtimeCredentials: { apiKey: "test-valid-key" },
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe("invalid_destination");
      expect(result.error).toMatch(/recipient name and postal code are required/i);
    });

    test("generates authentic Delhivery tracking URL for given waybill", () => {
      const url = adapter.generateTrackingUrl("DLH1234567890");
      expect(url).toBe("https://www.delhivery.com/track/package/DLH1234567890");
      expect(adapter.generateTrackingUrl("")).toBeNull();
      expect(adapter.generateTrackingUrl(null)).toBeNull();
    });

    test("handles API rejections and errors gracefully without crashing", async () => {
      // Mock global fetch
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: "Invalid client credentials" }),
        text: async () => JSON.stringify({ error: "Invalid client credentials" }),
      });

      try {
        const result = await adapter.createShipment({
          shipment: {},
          destination: { fullName: "John Smith", postalCode: "400001" },
          runtimeCredentials: { apiKey: "dummy_key", clientId: "dummy_client" },
        });

        expect(result.success).toBe(false);
        expect(result.status).toBe("rejected");
        expect(result.error).toMatch(/Invalid client credentials|HTTP 400/);
      } finally {
        global.fetch = originalFetch;
      }
    });

    test("processes successful Delhivery CMU package creation correctly", async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          packages: [
            {
              waybill: "DLH9876543210",
              status: "Success",
              client: "BUYBOX_MERCHANT",
            },
          ],
        }),
      });

      try {
        const result = await adapter.createShipment({
          shipment: { shipmentNumber: "SHP-12345" },
          destination: { fullName: "Smriti Crafts", postalCode: "110037", phone: "9876543210", addressLine1: "123 Main St" },
          origin: { fullName: "Warehouse A", postalCode: "110001", phone: "9876543211", addressLine1: "Warehouse 1" },
          runtimeCredentials: { apiKey: "live_test_api_key", clientId: "live_client" },
        });

        expect(result.success).toBe(true);
        expect(result.waybill).toBe("DLH9876543210");
        expect(result.providerShipmentId).toBe("DLH9876543210");
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe("2. Vendor Order Shipment Validator (BUG-VD06E-01)", () => {
    test("accepts valid shipment payload with optional idempotencyKey", () => {
      const validPayload = {
        carrier: "Delhivery",
        serviceLevel: "Standard Surface",
        warehouseId: new mongoose.Types.ObjectId().toString(),
        notes: "Careful packaging",
        idempotencyKey: "idemp-shp-1730000000-abcd1234",
      };

      const result = createVendorOrderShipmentSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      expect(result.data.idempotencyKey).toBe("idemp-shp-1730000000-abcd1234");
    });

    test("accepts valid shipment payload without idempotencyKey (controller/header fallback)", () => {
      const validPayload = {
        carrier: "Delhivery",
        serviceLevel: "Standard Surface",
      };

      const result = createVendorOrderShipmentSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      expect(result.data.carrier).toBe("Delhivery");
    });

    test("rejects idempotencyKey shorter than 8 characters", () => {
      const invalidPayload = {
        carrier: "Delhivery",
        idempotencyKey: "short",
      };

      const result = createVendorOrderShipmentSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].path).toContain("idempotencyKey");
    });

    test("rejects unknown extra fields due to strict schema", () => {
      const unknownPayload = {
        carrier: "Delhivery",
        unauthorizedField: "hacked",
      };

      const result = createVendorOrderShipmentSchema.safeParse(unknownPayload);
      expect(result.success).toBe(false);
    });
  });

  describe("3. Shipping Constants & State Machine Transitions", () => {
    test("includes booking_pending and booking_failed in SHIPMENT_STATUSES", () => {
      expect(SHIPMENT_STATUSES.BOOKING_PENDING).toBe("booking_pending");
      expect(SHIPMENT_STATUSES.BOOKED).toBe("booked");
      expect(SHIPMENT_STATUSES.BOOKING_FAILED).toBe("booking_failed");
    });

    test("permits valid transitions from created status", () => {
      const allowed = SHIPMENT_STATUS_TRANSITIONS.created;
      expect(allowed).toContain("booking_pending");
      expect(allowed).toContain("booked");
      expect(allowed).toContain("booking_failed");
      expect(allowed).toContain("cancelled");
    });

    test("permits retry transitions from booking_failed status", () => {
      const allowed = SHIPMENT_STATUS_TRANSITIONS.booking_failed;
      expect(allowed).toContain("booking_pending");
      expect(allowed).toContain("booked");
      expect(allowed).toContain("created");
      expect(allowed).toContain("cancelled");
    });
  });

  describe("4. Shipment Service Idempotency Invariants", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    test("detects payload mismatch when reusing same idempotency key with different carrier", async () => {
      const orderId = new mongoose.Types.ObjectId();
      const vendorId = new mongoose.Types.ObjectId();
      const existingShipment = {
        _id: new mongoose.Types.ObjectId(),
        orderId,
        vendorId,
        carrier: "Delhivery",
        warehouseId: new mongoose.Types.ObjectId(),
      };

      jest.spyOn(shipmentRepository, "findByIdempotencyKey").mockResolvedValue(existingShipment);

      await expect(
        shipmentService.createShipment({
          orderId,
          vendorId,
          carrier: "Shiprocket", // different carrier!
          warehouseId: existingShipment.warehouseId,
          idempotencyKey: "idemp-key-conflict-test",
        })
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: 409,
          code: "IDEMPOTENCY_PAYLOAD_MISMATCH",
        })
      );
    });

    test("replays existing shipment cleanly when idempotency key and payload match", async () => {
      const orderId = new mongoose.Types.ObjectId();
      const vendorId = new mongoose.Types.ObjectId();
      const warehouseId = new mongoose.Types.ObjectId();
      const existingShipment = {
        _id: new mongoose.Types.ObjectId(),
        orderId,
        vendorId,
        carrier: "Delhivery",
        warehouseId,
      };

      jest.spyOn(shipmentRepository, "findByIdempotencyKey").mockResolvedValue(existingShipment);

      const result = await shipmentService.createShipment({
        orderId,
        vendorId,
        carrier: "Delhivery",
        warehouseId,
        idempotencyKey: "idemp-key-match-test",
      });

      expect(result).toBe(existingShipment);
    });
  });

  describe("5. Carrier Booking Retry & Tenant Isolation", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    test("blocks vendor from retrying booking for another vendor's shipment (returns 404)", async () => {
      const shipmentId = new mongoose.Types.ObjectId();
      const vendorAId = new mongoose.Types.ObjectId();
      const vendorBId = new mongoose.Types.ObjectId();
      const userBId = new mongoose.Types.ObjectId();

      jest.spyOn(shipmentRepository, "findById").mockResolvedValue({
        _id: shipmentId,
        vendorId: vendorAId, // belongs to Vendor A
        status: "created",
      });

      jest.spyOn(Vendor, "findOne").mockResolvedValue({
        _id: vendorBId, // user B is Vendor B
        userId: userBId,
      });

      await expect(
        shipmentService.retryCarrierBooking({
          shipmentId,
          userId: userBId,
          actorRole: "vendor",
        })
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: 404,
          code: "SHIPMENT_NOT_FOUND",
        })
      );
    });

    test("rejects booking retry on already booked shipment", async () => {
      const shipmentId = new mongoose.Types.ObjectId();
      const vendorId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();

      jest.spyOn(shipmentRepository, "findById").mockResolvedValue({
        _id: shipmentId,
        vendorId,
        status: "booked",
        awbNumber: "DLH123456",
      });

      jest.spyOn(Vendor, "findOne").mockResolvedValue({
        _id: vendorId,
        userId,
      });

      await expect(
        shipmentService.retryCarrierBooking({
          shipmentId,
          userId,
          actorRole: "vendor",
        })
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: 400,
          code: "SHIPMENT_ALREADY_BOOKED",
        })
      );
    });

    test("rejects booking retry on cancelled shipment", async () => {
      const shipmentId = new mongoose.Types.ObjectId();
      const vendorId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();

      jest.spyOn(shipmentRepository, "findById").mockResolvedValue({
        _id: shipmentId,
        vendorId,
        status: "cancelled",
      });

      jest.spyOn(Vendor, "findOne").mockResolvedValue({
        _id: vendorId,
        userId,
      });

      await expect(
        shipmentService.retryCarrierBooking({
          shipmentId,
          userId,
          actorRole: "vendor",
        })
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: 400,
          code: "INVALID_SHIPMENT_STATUS",
        })
      );
    });

    test("successfully books carrier on retry and updates AWB & tracking events", async () => {
      const shipmentId = new mongoose.Types.ObjectId();
      const orderId = new mongoose.Types.ObjectId();
      const vendorId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();

      const mockShipment = {
        _id: shipmentId,
        orderId,
        vendorId,
        carrier: "Delhivery",
        provider: "delhivery",
        status: "booking_failed",
        shippingAddress: { fullName: "Customer", postalCode: "110001" },
        bookingDetails: { attempts: 1 },
        trackingEvents: [],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(shipmentRepository, "findById").mockResolvedValue(mockShipment);
      jest.spyOn(Vendor, "findOne").mockResolvedValue({ _id: vendorId, userId });
      jest.spyOn(Order, "updateOne").mockResolvedValue({ modifiedCount: 1 });

      const courierService = require("../../src/services/courier.service");
      jest.spyOn(courierService, "createCourierShipment").mockResolvedValue({
        success: true,
        waybill: "DLH_RETRY_SUCCESS_123",
        providerShipmentId: "DLH_RETRY_SUCCESS_123",
      });

      const result = await shipmentService.retryCarrierBooking({
        shipmentId,
        userId,
        actorRole: "vendor",
      });

      expect(result.status).toBe("booked");
      expect(result.awbNumber).toBe("DLH_RETRY_SUCCESS_123");
      expect(result.trackingNumber).toBe("DLH_RETRY_SUCCESS_123");
      expect(result.trackingUrl).toContain("DLH_RETRY_SUCCESS_123");
      expect(result.bookingDetails.status).toBe("booked");
      expect(result.bookingDetails.attempts).toBe(2);
      expect(mockShipment.save).toHaveBeenCalled();
    });
  });
});
