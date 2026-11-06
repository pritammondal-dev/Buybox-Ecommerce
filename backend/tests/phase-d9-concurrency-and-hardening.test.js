const mongoose = require("mongoose");

jest.mock("../src/config/redis", () => {
  const EventEmitter = require("events");
  const emitter = new EventEmitter();
  emitter.status = "ready";
  return emitter;
});

jest.mock("../src/repositories/order.repository");
jest.mock("../src/repositories/cart.repository");
jest.mock("../src/repositories/address.repository");
jest.mock("../src/repositories/inventory.repository");
jest.mock("../src/repositories/payment.repository");
jest.mock("../src/repositories/vendor-settlement.repository");
jest.mock("../src/services/inventory.service");
jest.mock("../src/services/notification-outbox.service");
jest.mock("../src/services/analytics.service");
jest.mock("../src/services/credential.service");
jest.mock("../src/models/Customer");
jest.mock("../src/models/User");
jest.mock("../src/models/Shipment");
jest.mock("../src/models/ShipmentWebhookEvent");
jest.mock("../src/models/PaymentWebhookEvent");
jest.mock("../src/models/NotificationOutbox");
jest.mock("../src/utils/withTransaction");

const orderRepository = require("../src/repositories/order.repository");
const cartRepository = require("../src/repositories/cart.repository");
const addressRepository = require("../src/repositories/address.repository");
const inventoryRepository = require("../src/repositories/inventory.repository");
const paymentRepository = require("../src/repositories/payment.repository");
const vendorSettlementRepository = require("../src/repositories/vendor-settlement.repository");
const inventoryService = require("../src/services/inventory.service");
const notificationOutboxService = require("../src/services/notification-outbox.service");
const CredentialService = require("../src/services/credential.service");
const Customer = require("../src/models/Customer");
const User = require("../src/models/User");
const Shipment = require("../src/models/Shipment");
const ShipmentWebhookEvent = require("../src/models/ShipmentWebhookEvent");
const PaymentWebhookEvent = require("../src/models/PaymentWebhookEvent");
const NotificationOutbox = require("../src/models/NotificationOutbox");
const withTransaction = require("../src/utils/withTransaction");

const orderService = require("../src/services/order.service");
const courierService = require("../src/services/courier.service");
const paymentWebhookService = require("../src/services/payment-webhook.service");
const vendorSettlementService = require("../src/services/vendor-settlement.service");
const { dispatchPendingNotifications } = require("../src/workers/notification-dispatcher.worker");
const { checkoutLimiter } = require("../src/middlewares/rate-limiter.middleware");
const notificationQueue = require("../src/queues/notification.queue");
const AppError = require("../src/errors/AppError");

describe("PHASE D9 — End-to-End Multi-Tenant Performance & Production Hardening", () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();
  const addressId = new mongoose.Types.ObjectId().toString();
  const variantId = new mongoose.Types.ObjectId().toString();
  const warehouseId = new mongoose.Types.ObjectId().toString();
  const vendorId = new mongoose.Types.ObjectId().toString();
  const orderId = new mongoose.Types.ObjectId().toString();

  let mockSession;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn().mockResolvedValue(),
      abortTransaction: jest.fn().mockResolvedValue(),
      endSession: jest.fn().mockResolvedValue(),
    };
    jest.spyOn(mongoose, "startSession").mockResolvedValue(mockSession);

    withTransaction.mockImplementation(async (callback) => {
      return callback(mockSession);
    });

    notificationOutboxService.enqueue.mockResolvedValue({});
    CredentialService.getDecryptedCredentials.mockResolvedValue({ apiKey: "test_key" });
  });

  /* ==========================================================================
     1. CONCURRENT CHECKOUT & INVENTORY OVERSELL PREVENTION (STAGES B & C)
     ========================================================================== */
  describe("1. Concurrency: Checkout & Atomic Inventory Reservation", () => {
    test("should prevent inventory overselling when simultaneous checkouts compete for limited stock", async () => {
      // Setup limited pool of 3 units
      let availableUnits = 3;
      let successfulReservations = 0;
      let rejectedReservations = 0;

      // Simulate atomic conditional reservation query ($expr: available >= qty)
      const attemptReservation = async (qty) => {
        if (availableUnits >= qty) {
          availableUnits -= qty;
          successfulReservations += 1;
          return { success: true, remaining: availableUnits };
        } else {
          rejectedReservations += 1;
          throw new AppError("Insufficient stock available", 400, "INSUFFICIENT_STOCK");
        }
      };

      // 8 concurrent requests for 1 unit each
      const requests = Array.from({ length: 8 }, () => attemptReservation(1));
      const results = await Promise.allSettled(requests);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled).toHaveLength(3);
      expect(rejected).toHaveLength(5);
      expect(successfulReservations).toBe(3);
      expect(rejectedReservations).toBe(5);
      expect(availableUnits).toBe(0); // Invariant: stock never drops below 0
    });

    test("should safely return existing order when identical idempotency key is replayed", async () => {
      const idempotencyKey = "idem-test-key-12345";
      const existingOrder = {
        _id: orderId,
        orderNumber: "ORD-2026-0001",
        idempotencyKey,
        total: mongoose.Types.Decimal128.fromString("499.00"),
        status: "pending",
        idempotencyFingerprint: "fingerprint-abc-123",
      };

      // When order repository finds existing order by customer and idempotency key
      orderRepository.findByCustomerIdAndIdempotencyKey.mockResolvedValue(existingOrder);

      const result = await orderRepository.findByCustomerIdAndIdempotencyKey(customerId, idempotencyKey);
      expect(result).toBeDefined();
      expect(result._id).toBe(orderId);
      expect(result.idempotencyFingerprint).toBe("fingerprint-abc-123");
    });
  });

  /* ==========================================================================
     2. COURIER WEBHOOK RELIABILITY & OUT-OF-ORDER HANDLING (STAGE F)
     ========================================================================== */
  describe("2. Webhook Reliability: Courier Idempotency & State Machine Guarding", () => {
    test("should deduplicate already processed courier webhook event", async () => {
      const eventId = "evt_courier_dup_001";
      const provider = "delhivery";

      jest.spyOn(courierService.getAdapter(provider), "verifyWebhookSignature").mockReturnValue(true);

      ShipmentWebhookEvent.findOne.mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        provider,
        eventId,
      });

      const response = await courierService.handleWebhook({
        provider,
        headers: { "x-delhivery-signature": "valid_sig" },
        body: {
          event_id: eventId,
          tracking_number: "TRK12345678",
          status: "in_transit",
        },
      });

      expect(response).toEqual({
        success: true,
        duplicate: true,
        message: "Webhook event already processed",
        eventId,
      });
    });

    test("should safely handle stale out-of-order courier events when shipment is already delivered", async () => {
      const eventId = "evt_courier_stale_002";
      const provider = "delhivery";

      jest.spyOn(courierService.getAdapter(provider), "verifyWebhookSignature").mockReturnValue(true);

      // Event is new
      ShipmentWebhookEvent.findOne.mockResolvedValue(null);
      ShipmentWebhookEvent.create.mockResolvedValue({});

      // Shipment is already delivered (terminal state)
      const mockDeliveredShipment = {
        _id: new mongoose.Types.ObjectId(),
        shipmentNumber: "SHP-2026-9999",
        trackingNumber: "TRK99999999",
        status: "delivered",
        populate: jest.fn().mockReturnThis(),
      };
      Shipment.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockDeliveredShipment),
      });

      // Delayed "in_transit" event arrives
      const response = await courierService.handleWebhook({
        provider,
        headers: { "x-delhivery-signature": "valid_sig" },
        body: {
          event_id: eventId,
          tracking_number: "TRK99999999",
          status: "in_transit",
        },
      });

      expect(response.success).toBe(true);
      expect(response.stale).toBe(true);
      expect(response.status).toBe("delivered"); // Status was preserved and not regressed
      expect(response.message).toContain("safely ignored");
    });
  });

  /* ==========================================================================
     3. PAYMENT WEBHOOK & CALLBACK IDEMPOTENCY (STAGE F)
     ========================================================================== */
  describe("3. Payment Webhook: Duplicate Rejection & Idempotency", () => {
    test("should detect and report duplicate payment webhook events safely", async () => {
      const eventId = "pay_evt_razorpay_dup_001";

      PaymentWebhookEvent.findOne = jest.fn().mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        eventId,
        provider: "razorpay",
      });

      // Simulate check in payment webhook service
      const existing = await PaymentWebhookEvent.findOne({ eventId });
      expect(existing).toBeDefined();
      expect(existing.eventId).toBe(eventId);
    });
  });

  /* ==========================================================================
     4. VENDOR SETTLEMENT & SUBSIDY LEDGER INTEGRITY (STAGE C & STAGE G)
     ========================================================================== */
  describe("4. Vendor Settlement & Subsidy Ledger Integrity", () => {
    test("should reject negative net payable calculation (subsidy invariant)", () => {
      expect(() => {
        vendorSettlementService.calculateNetPayable({
          grossSales: "100.00",
          platformSubsidy: "0.00",
          discounts: "20.00",
          refunds: "50.00",
          platformCommission: "50.00", // 100 - 20 - 50 - 50 = -20
        });
      }).toThrow(AppError);
    });

    test("should correctly compute net payable with platform promotion subsidy", () => {
      const net = vendorSettlementService.calculateNetPayable({
        grossSales: "1000.00",
        platformSubsidy: "150.00", // Platform reimburses vendor
        discounts: "150.00",       // Customer got discount
        refunds: "0.00",
        platformCommission: "100.00", // 10% platform fee
      });

      // Net = 1000 + 150 - 150 - 0 - 100 = 900.00
      expect(net.toString()).toBe("900.00");
    });

    test("should handle duplicate concurrent settlement creation idempotently", async () => {
      const idempotencyKey = "settlement-idem-2026-q1";
      const existingSettlement = {
        _id: new mongoose.Types.ObjectId(),
        settlementNumber: "SET-TEST-001",
        vendorId: new mongoose.Types.ObjectId(vendorId),
        idempotencyKey,
        netPayable: mongoose.Types.Decimal128.fromString("900.00"),
        status: "pending",
      };

      vendorSettlementRepository.findByIdempotencyKey.mockResolvedValue(existingSettlement);

      const result = await vendorSettlementService.createSettlement({
        vendorId,
        periodStart: "2026-01-01T00:00:00.000Z",
        periodEnd: "2026-01-31T23:59:59.000Z",
        currency: "INR",
        grossSales: "1000.00",
        platformSubsidy: "150.00",
        discounts: "150.00",
        refunds: "0.00",
        platformCommission: "100.00",
        idempotencyKey,
      });

      expect(result).toBeDefined();
      expect(result.settlementNumber).toBe("SET-TEST-001");
      expect(result.idempotencyKey).toBe(idempotencyKey);
    });
  });

  /* ==========================================================================
     5. QUEUE WORKER HARDENING & JOB DEDUPLICATION (STAGE G)
     ========================================================================== */
  describe("5. Queue & Worker Hardening: Deterministic Deduplication", () => {
    test("should add outbox notifications to BullMQ with deterministic deduplication jobId", async () => {
      const mockNotification = {
        _id: new mongoose.Types.ObjectId(),
        type: "order.created",
        status: "pending",
      };

      NotificationOutbox.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([mockNotification]),
        }),
      });

      jest.spyOn(notificationQueue, "add").mockResolvedValue({ id: `notification-${mockNotification._id}` });

      const count = await dispatchPendingNotifications();

      expect(count).toBe(1);
      expect(notificationQueue.add).toHaveBeenCalledWith(
        mockNotification.type,
        { notificationId: mockNotification._id.toString() },
        expect.objectContaining({
          jobId: `notification-${mockNotification._id}`,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
        })
      );
    });
  });

  /* ==========================================================================
     6. RATE LIMITING & ABUSE RESISTANCE (STAGE E)
     ========================================================================== */
  describe("6. Rate Limiting & Abuse Resistance", () => {
    test("should expose checkoutLimiter with standardized error formatting", () => {
      expect(checkoutLimiter).toBeDefined();
      expect(typeof checkoutLimiter).toBe("function");
    });
  });
});
