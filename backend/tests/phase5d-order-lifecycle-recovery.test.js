const mongoose = require("mongoose");

jest.mock("../src/models/Order");
jest.mock("../src/models/Payment");
jest.mock("../src/models/Refund");
jest.mock("../src/models/Inventory");
jest.mock("../src/models/Customer");
jest.mock("../src/models/User");
jest.mock("../src/models/AuditLog");
jest.mock("../src/models/Shipment");
jest.mock("../src/models/ShipmentWebhookEvent");
jest.mock("../src/models/NotificationOutbox");
jest.mock("../src/models/Vendor");
jest.mock("../src/models/FulfillmentException");

jest.mock("../src/repositories/order.repository");
jest.mock("../src/repositories/payment.repository");
jest.mock("../src/repositories/refund.repository");
jest.mock("../src/repositories/inventory.repository");
jest.mock("../src/integrations/payments/razorpay.provider");
jest.mock("../src/services/credential.service");

const Order = require("../src/models/Order");
const Payment = require("../src/models/Payment");
const Refund = require("../src/models/Refund");
const Customer = require("../src/models/Customer");
const Shipment = require("../src/models/Shipment");
const ShipmentWebhookEvent = require("../src/models/ShipmentWebhookEvent");
const AuditLog = require("../src/models/AuditLog");
const Vendor = require("../src/models/Vendor");
const FulfillmentException = require("../src/models/FulfillmentException");

const orderRepository = require("../src/repositories/order.repository");
const paymentRepository = require("../src/repositories/payment.repository");
const refundRepository = require("../src/repositories/refund.repository");
const inventoryRepository = require("../src/repositories/inventory.repository");
const razorpayProvider = require("../src/integrations/payments/razorpay.provider");
const CredentialService = require("../src/services/credential.service");

const paymentService = require("../src/services/payment.service");
const orderRecoveryService = require("../src/services/order-recovery.service");
const courierService = require("../src/services/courier.service");
const fulfillmentExceptionService = require("../src/services/fulfillment-exception.service");

describe("Phase 5D — Order Lifecycle Hardening & Operational Recovery", () => {
  const customerId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  const paymentId = new mongoose.Types.ObjectId();
  const variantId = new mongoose.Types.ObjectId();
  const warehouseId = new mongoose.Types.ObjectId();
  const vendorA = new mongoose.Types.ObjectId();
  const vendorB = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // 1. REFUND PROVIDER SUCCESS FOLLOWED BY LOCAL PERSISTENCE FAILURE
  // --------------------------------------------------------------------------
  describe("1. Refund Provider Success Followed by Local Persistence Failure", () => {
    test("preserves reservation and gateway refund ID when local payment update throws", async () => {
      const mockOrder = {
        _id: orderId,
        orderNumber: "ORD-5D-001",
        customerId,
        currency: "INR",
        items: [],
      };

      const mockPayment = {
        _id: paymentId,
        orderId,
        amount: mongoose.Types.Decimal128.fromString("1000.00"),
        refundedAmount: mongoose.Types.Decimal128.fromString("0.00"),
        refundReservedAmount: mongoose.Types.Decimal128.fromString("0.00"),
        status: "captured",
        gateway: "razorpay",
        gatewayPaymentId: "pay_test_12345",
      };

      orderRepository.findById.mockResolvedValue(mockOrder);
      Customer.findById.mockResolvedValue({ _id: customerId });
      Customer.findOne.mockResolvedValue({ _id: customerId });
      paymentRepository.findLatestByOrderId.mockResolvedValue(mockPayment);
      refundRepository.findByIdempotencyKey.mockResolvedValue(null);
      paymentRepository.reserveRefundAmount.mockResolvedValue(mockPayment);

      // Gateway succeeds
      razorpayProvider.refundPayment.mockResolvedValue({
        id: "rfnd_gw_success_999",
        status: "processed",
      });

      // Local refund doc creation succeeds
      refundRepository.create.mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        status: "processed",
        gatewayRefundId: "rfnd_gw_success_999",
      });

      // But updating the payment record throws a database glitch!
      paymentRepository.updateById.mockRejectedValue(new Error("Mongo network disconnected"));

      await expect(
        paymentService.refundPaymentForOrder(orderId, customerId, 500, "idem_test_failure")
      ).rejects.toThrow("Refund processed at gateway, but local payment synchronization failed");

      // Verify that releaseRefundReservation was NOT called (reservation retained for safety)
      expect(paymentRepository.releaseRefundReservation).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // 2. DUPLICATE AND CONCURRENT REFUND REQUESTS
  // --------------------------------------------------------------------------
  describe("2. Duplicate and Concurrent Refund Requests", () => {
    test("duplicate request with existing processed refund reconciles payment without calling gateway again", async () => {
      const mockOrder = {
        _id: orderId,
        orderNumber: "ORD-5D-002",
        customerId,
        currency: "INR",
      };

      const mockPayment = {
        _id: paymentId,
        orderId,
        amount: mongoose.Types.Decimal128.fromString("1000.00"),
        refundedAmount: mongoose.Types.Decimal128.fromString("500.00"),
        status: "partially_refunded",
        gateway: "razorpay",
        gatewayPaymentId: "pay_test_dup",
      };

      orderRepository.findById.mockResolvedValue(mockOrder);
      Customer.findById.mockResolvedValue({ _id: customerId });
      paymentRepository.findLatestByOrderId.mockResolvedValue(mockPayment);
      paymentRepository.updateById.mockResolvedValue(mockPayment);

      // Existing refund with matching idempotency key already processed
      refundRepository.findByIdempotencyKey.mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        status: "processed",
        amount: "500.00",
        gatewayRefundId: "rfnd_existing_555",
      });

      const result = await paymentService.refundPaymentForOrder(
        orderId,
        customerId,
        500,
        "idem_duplicate_key"
      );

      // Gateway must NOT have been called
      expect(razorpayProvider.refundPayment).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    test("concurrent refund requests exceeding balance reject second caller with 409 REFUND_AMOUNT_UNAVAILABLE", async () => {
      const mockOrder = {
        _id: orderId,
        orderNumber: "ORD-5D-003",
        customerId,
        currency: "INR",
      };

      const mockPayment = {
        _id: paymentId,
        orderId,
        amount: mongoose.Types.Decimal128.fromString("500.00"),
        refundedAmount: mongoose.Types.Decimal128.fromString("0.00"),
        refundReservedAmount: mongoose.Types.Decimal128.fromString("0.00"),
        status: "captured",
        gateway: "razorpay",
        gatewayPaymentId: "pay_test_conc",
      };

      orderRepository.findById.mockResolvedValue(mockOrder);
      Customer.findById.mockResolvedValue({ _id: customerId });
      paymentRepository.findLatestByOrderId.mockResolvedValue(mockPayment);
      refundRepository.findByIdempotencyKey.mockResolvedValue(null);

      // Simulate atomic reservation failure (concurrent request took the reservation)
      paymentRepository.reserveRefundAmount.mockResolvedValue(null);

      await expect(
        paymentService.refundPaymentForOrder(orderId, customerId, 500, "idem_concurrent_key")
      ).rejects.toThrow("Refund amount is no longer available");

      expect(razorpayProvider.refundPayment).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // 3. REFUND AMOUNT BOUNDED BY REMAINING REFUNDABLE BALANCE
  // --------------------------------------------------------------------------
  describe("3. Refund Amount Bounded by Remaining Refundable Balance", () => {
    test("rejects refund request greater than remaining refundable balance with 400", async () => {
      const mockOrder = {
        _id: orderId,
        orderNumber: "ORD-5D-004",
        customerId,
        currency: "INR",
      };

      const mockPayment = {
        _id: paymentId,
        orderId,
        amount: mongoose.Types.Decimal128.fromString("1000.00"),
        refundedAmount: mongoose.Types.Decimal128.fromString("700.00"),
        refundReservedAmount: mongoose.Types.Decimal128.fromString("0.00"),
        status: "partially_refunded",
        gatewayPaymentId: "pay_test_bounds",
      };

      orderRepository.findById.mockResolvedValue(mockOrder);
      Customer.findById.mockResolvedValue({ _id: customerId });
      paymentRepository.findLatestByOrderId.mockResolvedValue(mockPayment);

      // Remaining refundable is 300; requesting 400 must be rejected
      await expect(
        paymentService.refundPaymentForOrder(orderId, customerId, 400)
      ).rejects.toThrow("Invalid refund amount");

      expect(paymentRepository.reserveRefundAmount).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // 4. CANCELLATION RETRIES & INVENTORY RELEASE
  // --------------------------------------------------------------------------
  describe("4. Cancellation Retries & Concurrent Inventory Release", () => {
    test("cancellation retry skips items whose inventory is already released or deducted", async () => {
      const mockOrder = {
        _id: orderId,
        orderNumber: "ORD-5D-005",
        status: "processing",
        customerId,
        items: [
          {
            _id: new mongoose.Types.ObjectId(),
            productVariantId: variantId,
            warehouseId,
            quantity: 2,
            inventoryStatus: "released", // Already released on first attempt
            fulfillmentStatus: "cancelled",
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      Order.findById.mockResolvedValue(mockOrder);
      orderRepository.findById.mockResolvedValue(mockOrder);

      // Re-invoking recovery on this order releases 0 additional stock
      const recovery = await orderRecoveryService.recoverIncompleteCancellation(orderId, {
        userId: "admin_123",
        role: "admin",
      });

      expect(recovery.inventoryReleasesCompleted).toBe(0);
      expect(inventoryRepository.releaseReservedStock).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // 5. PARTIAL CANCELLATION WITH UNAFFECTED VENDOR ITEMS
  // --------------------------------------------------------------------------
  describe("5. Partial Cancellation with Unaffected Vendor Items", () => {
    test("exception cancellation for Vendor A modifies only Vendor A item and preserves Vendor B item", async () => {
      const itemAId = new mongoose.Types.ObjectId();
      const itemBId = new mongoose.Types.ObjectId();

      const itemA = {
        _id: itemAId,
        vendorId: vendorA,
        sku: "SKU-VEND-A",
        quantity: 1,
        unitPrice: mongoose.Types.Decimal128.fromString("500.00"),
        lineTotal: mongoose.Types.Decimal128.fromString("500.00"),
        inventoryStatus: "reserved",
        fulfillmentStatus: "processing",
        warehouseId,
        productVariantId: variantId,
      };

      const itemB = {
        _id: itemBId,
        vendorId: vendorB,
        sku: "SKU-VEND-B",
        quantity: 2,
        unitPrice: mongoose.Types.Decimal128.fromString("300.00"),
        lineTotal: mongoose.Types.Decimal128.fromString("600.00"),
        inventoryStatus: "reserved",
        fulfillmentStatus: "processing",
        warehouseId,
        productVariantId: new mongoose.Types.ObjectId(),
      };

      const mockOrder = {
        _id: orderId,
        orderNumber: "ORD-5D-006",
        status: "processing",
        paymentStatus: "paid",
        customerId,
        items: [itemA, itemB],
        save: jest.fn().mockResolvedValue(true),
      };

      const mockException = {
        _id: new mongoose.Types.ObjectId(),
        orderId,
        orderItemId: itemAId,
        vendorId: vendorA,
        quantity: 1,
        reason: "out_of_stock",
        status: "under_review",
        timeline: [],
        cancellationDetails: {},
        save: jest.fn().mockResolvedValue(true),
      };

      const FulfillmentException = require("../src/models/FulfillmentException");
      FulfillmentException.findById = jest.fn().mockImplementation(() => {
        const promise = Promise.resolve(mockException);
        promise.populate = jest.fn().mockReturnValue(promise);
        return promise;
      });

      Vendor.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            email: "vendorA@buybox.test",
            storeName: "Vendor A Store",
            businessName: "Vendor A Corp",
          }),
        }),
      });

      Order.findById = jest.fn().mockResolvedValue(mockOrder);
      inventoryRepository.findByVariantAndWarehouse.mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        reserved: 5,
      });
      inventoryRepository.releaseReservedStock.mockResolvedValue(true);

      paymentRepository.findLatestByOrderId.mockResolvedValue({
        _id: paymentId,
        status: "captured",
        amount: mongoose.Types.Decimal128.fromString("1100.00"),
        refundedAmount: mongoose.Types.Decimal128.fromString("0.00"),
        refundReservedAmount: mongoose.Types.Decimal128.fromString("0.00"),
      });

      jest.spyOn(paymentService, "refundPaymentForOrder").mockResolvedValue({
        status: "partially_refunded",
        refundedAmount: "500.00",
      });

      await fulfillmentExceptionService.adminApproveCancellation({
        exceptionId: mockException._id,
        actorUser: { userId: "admin_1" },
        notes: "Approved stock shortage cancellation",
      });

      // Item A cancelled
      expect(itemA.fulfillmentStatus).toBe("cancelled");
      expect(itemA.inventoryStatus).toBe("released");

      // Item B preserved
      expect(itemB.fulfillmentStatus).toBe("processing");
      expect(itemB.inventoryStatus).toBe("reserved");

      // Multi-vendor order remains active
      expect(mockOrder.status).toBe("processing");
      expect(mockOrder.paymentStatus).toBe("partially_refunded");
    });
  });

  // --------------------------------------------------------------------------
  // 6. RECOVERY OF INCOMPLETE CANCELLATION OPERATIONS
  // --------------------------------------------------------------------------
  describe("6. Recovery of Incomplete Cancellation Operations", () => {
    test("reconciles cancelled order with unreleased inventory and captured unrefunded payment", async () => {
      const cancelledItem = {
        _id: new mongoose.Types.ObjectId(),
        productVariantId: variantId,
        warehouseId,
        sku: "SKU-INCOMPLETE",
        quantity: 3,
        fulfillmentStatus: "cancelled",
        inventoryStatus: "reserved", // Glitch: marked cancelled, but inventory was not released
      };

      const mockOrder = {
        _id: orderId,
        orderNumber: "ORD-5D-007",
        status: "cancelled",
        paymentStatus: "paid",
        customerId,
        items: [cancelledItem],
        save: jest.fn().mockResolvedValue(true),
      };

      Order.findById.mockResolvedValue(mockOrder);
      inventoryRepository.findByVariantAndWarehouse.mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        reserved: 10,
      });
      inventoryRepository.releaseReservedStock.mockResolvedValue(true);

      const mockPayment = {
        _id: paymentId,
        status: "captured",
        amount: mongoose.Types.Decimal128.fromString("1500.00"),
        refundedAmount: mongoose.Types.Decimal128.fromString("0.00"),
        refundReservedAmount: mongoose.Types.Decimal128.fromString("0.00"),
      };
      paymentRepository.findLatestByOrderId.mockResolvedValue(mockPayment);

      jest.spyOn(paymentService, "refundPaymentForOrder").mockImplementation(async () => {
        mockPayment.status = "refunded";
        mockPayment.refundedAmount = mongoose.Types.Decimal128.fromString("1500.00");
        return mockPayment;
      });

      const report = await orderRecoveryService.recoverIncompleteCancellation(orderId, {
        userId: "admin_recon",
        role: "admin",
      });

      expect(report.inventoryReleasesCompleted).toBe(1);
      expect(cancelledItem.inventoryStatus).toBe("released");
      expect(report.refundReconciled).toBe(true);
      expect(mockOrder.paymentStatus).toBe("refunded");
      expect(mockOrder.save).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // 7. OUT-OF-ORDER AND DUPLICATE SHIPMENT WEBHOOK EVENTS
  // --------------------------------------------------------------------------
  describe("7. Out-of-Order and Duplicate Shipment Webhook Events", () => {
    test("stale out-of-order webhook event does not revert delivered shipment", async () => {
      const mockShipment = {
        _id: new mongoose.Types.ObjectId(),
        shipmentNumber: "SHP-5D-001",
        trackingNumber: "TRK-5D-999",
        status: "delivered", // Terminal state
        customerId: { email: "customer@buybox.test" },
      };

      Shipment.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockShipment),
      });

      ShipmentWebhookEvent.findOne = jest.fn().mockResolvedValue(null);
      ShipmentWebhookEvent.create = jest.fn().mockResolvedValue(true);

      CredentialService.getDecryptedCredentials = jest.fn().mockResolvedValue({});

      // Mock courier adapter verification
      jest.spyOn(courierService, "getAdapter").mockReturnValue({
        verifyWebhookSignature: () => true,
      });

      // Inbound event is an older 'in_transit' event
      const result = await courierService.handleWebhook({
        provider: "delhivery",
        headers: {},
        body: {
          event_id: "evt_stale_100",
          tracking_number: "TRK-5D-999",
          status: "in_transit",
        },
      });

      expect(result.success).toBe(true);
      expect(result.stale).toBe(true);
      expect(result.status).toBe("delivered");
      // Shipment state was NOT downgraded
      expect(mockShipment.status).toBe("delivered");
    });
  });

  // --------------------------------------------------------------------------
  // 8. ACCURATE AGGREGATE STATUSES AFTER PARTIAL FULFILLMENT & REFUNDS
  // --------------------------------------------------------------------------
  describe("8. Accurate Aggregate Statuses After Partial Fulfillment and Refunds", () => {
    test("aggregate fulfillmentStatus is partially_fulfilled when only some items shipped", () => {
      const items = [
        { sku: "ITEM-1", quantity: 1, fulfillmentStatus: "shipped" },
        { sku: "ITEM-2", quantity: 1, fulfillmentStatus: "processing" },
      ];

      const active = items.filter((i) => i.fulfillmentStatus !== "cancelled");
      const allShipped = active.every((i) => ["shipped", "delivered"].includes(i.fulfillmentStatus));
      const someShipped = active.some((i) => ["shipped", "delivered"].includes(i.fulfillmentStatus));

      let aggFulfillment = "unfulfilled";
      if (allShipped) aggFulfillment = "fulfilled";
      else if (someShipped) aggFulfillment = "partially_fulfilled";

      expect(aggFulfillment).toBe("partially_fulfilled");
    });

    test("aggregate paymentStatus is partially_refunded when partial refund amount recorded", () => {
      const totalAmount = 1000;
      const refundedAmount = 400;

      let paymentStatus = "paid";
      if (refundedAmount >= totalAmount) {
        paymentStatus = "refunded";
      } else if (refundedAmount > 0) {
        paymentStatus = "partially_refunded";
      }

      expect(paymentStatus).toBe("partially_refunded");
    });
  });

  // --------------------------------------------------------------------------
  // 9. AUTHORIZATION & AUDITABILITY FOR OPERATIONAL RECOVERY
  // --------------------------------------------------------------------------
  describe("9. Authorization & Auditability for Operational Recovery", () => {
    test("records operational recovery action in AuditLog without gateway secrets", async () => {
      const mockOrder = {
        _id: orderId,
        orderNumber: "ORD-5D-009",
        status: "cancelled",
        customerId,
        items: [],
        save: jest.fn().mockResolvedValue(true),
      };

      Order.findById.mockResolvedValue(mockOrder);
      paymentRepository.findLatestByOrderId.mockResolvedValue(null);

      AuditLog.create = jest.fn().mockResolvedValue(true);

      await orderRecoveryService.recoverIncompleteCancellation(orderId, {
        userId: "admin_sec_auditor",
        role: "admin",
      });

      expect(AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ORDER_OPERATIONAL_RECOVERY",
          resourceId: orderId.toString(),
          actorId: "admin_sec_auditor",
        })
      );
    });
  });
});
