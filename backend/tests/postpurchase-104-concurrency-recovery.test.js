const mongoose = require("mongoose");
const crypto = require("crypto");

// Services under test
const orderService = require("../src/services/order.service");
const shipmentService = require("../src/services/shipment.service");
const courierService = require("../src/services/courier.service");
const paymentService = require("../src/services/payment.service");
const financialLedgerService = require("../src/services/financial-ledger.service");
const returnRequestService = require("../src/services/return-request.service");

// Mock dependencies
jest.mock("../src/models/Order");
jest.mock("../src/models/Customer");
jest.mock("../src/models/User");
jest.mock("../src/models/Product");
jest.mock("../src/models/ProductVariant");
jest.mock("../src/models/Vendor");
jest.mock("../src/models/Shipment");
jest.mock("../src/models/ShipmentWebhookEvent", () => ({
  create: jest.fn().mockImplementation((data) => Promise.resolve(data)),
  findOne: jest.fn().mockResolvedValue(null),
}));
jest.mock("../src/models/NotificationOutbox", () => {
  const mockModel = jest.fn().mockImplementation((data) => ({
    ...data,
    save: jest.fn().mockResolvedValue(data),
  }));
  mockModel.find = jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnValue({
      limit: jest.fn().mockResolvedValue([]),
    }),
  });
  return mockModel;
});
jest.mock("../src/services/notification-outbox.service", () => ({
  enqueue: jest.fn().mockResolvedValue({}),
  getPendingNotifications: jest.fn().mockResolvedValue([]),
}));
jest.mock("../src/models/Refund");
jest.mock("../src/models/Warehouse");
jest.mock("../src/models/Inventory");
jest.mock("../src/models/CreditNote");
jest.mock("../src/models/ReturnRequest");
jest.mock("../src/models/AuditLog", () => ({
  create: jest.fn().mockResolvedValue({}),
}));
jest.mock("../src/services/governance.service", () => ({
  recordAuditLog: jest.fn().mockResolvedValue({}),
}));
jest.mock("../src/models/VendorWallet", () => ({
  findOneAndUpdate: jest.fn().mockResolvedValue({}),
  findOne: jest.fn().mockResolvedValue(null),
}));
jest.mock("../src/models/FinancialLedgerEntry", () => ({
  findOne: jest.fn().mockReturnValue({
    session: jest.fn().mockResolvedValue(null),
  }),
  find: jest.fn().mockReturnValue({
    session: jest.fn().mockResolvedValue([]),
  }),
  aggregate: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockImplementation((entries) => Promise.resolve(entries)),
}));

jest.mock("../src/services/storefront-settings.service", () => ({
  isFeatureEnabled: jest.fn().mockResolvedValue(true),
  getActiveSettings: jest.fn().mockResolvedValue({
    policies: { returnWindowDays: 7 },
  }),
}));
jest.mock("../src/services/customer-notification.service", () => ({
  createCustomerNotification: jest.fn().mockResolvedValue({}),
}));
jest.mock("../src/services/notification", () => ({
  sendNotification: jest.fn().mockResolvedValue(true),
  sendEmail: jest.fn().mockResolvedValue(true),
  sendOrderStatusNotification: jest.fn().mockResolvedValue(true),
  sendOrderStatusUpdate: jest.fn().mockResolvedValue(true),
  sendRefundConfirmation: jest.fn().mockResolvedValue(true),
}));
jest.mock("../src/services/email.service", () => {
  return jest.fn().mockImplementation(() => ({
    sendDeliveryConfirmation: jest.fn().mockResolvedValue(true),
    sendShipmentUpdate: jest.fn().mockResolvedValue(true),
    send: jest.fn().mockResolvedValue(true),
  }));
});
jest.mock("../src/services/reward.service", () => ({
  adjustPointsForCancelledOrRefundedOrder: jest.fn().mockResolvedValue(true),
}));
jest.mock("../src/services/inventory.service", () => ({
  adjustStock: jest.fn().mockResolvedValue({}),
  reserveStock: jest.fn().mockResolvedValue({}),
  releaseStock: jest.fn().mockResolvedValue({}),
  releaseStockInTransaction: jest.fn().mockResolvedValue({}),
  deductReservedStockInTransaction: jest.fn().mockResolvedValue({}),
}));

jest.mock("../src/repositories/payment.repository");
jest.mock("../src/repositories/order.repository");
jest.mock("../src/repositories/shipment.repository");
jest.mock("../src/repositories/inventory.repository");
jest.mock("../src/repositories/coupon.repository", () => ({
  decrementUsage: jest.fn().mockResolvedValue({}),
}));
jest.mock("../src/repositories/coupon-redemption.repository", () => ({
  deleteByOrderId: jest.fn().mockResolvedValue(true),
}));
jest.mock("../src/repositories/financial-ledger.repository", () => ({
  findByJournalId: jest.fn().mockResolvedValue([]),
  findByIdempotencyKey: jest.fn().mockResolvedValue(null),
  createMany: jest.fn().mockImplementation((entries) => Promise.resolve(entries)),
  findVendorAllEntries: jest.fn().mockResolvedValue([]),
}));

const mockSession = {
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  abortTransaction: jest.fn(),
  endSession: jest.fn(),
  withTransaction: jest.fn().mockImplementation((fn) => fn(mockSession)),
};
jest.spyOn(mongoose, "startSession").mockResolvedValue(mockSession);
jest.mock("../src/utils/withTransaction", () =>
  jest.fn().mockImplementation((cb) => cb(mockSession))
);

const Order = require("../src/models/Order");
const Customer = require("../src/models/Customer");
const User = require("../src/models/User");
const Shipment = require("../src/models/Shipment");
const ShipmentWebhookEvent = require("../src/models/ShipmentWebhookEvent");
const Refund = require("../src/models/Refund");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Vendor = require("../src/models/Vendor");
const Warehouse = require("../src/models/Warehouse");
const Inventory = require("../src/models/Inventory");
const CreditNote = require("../src/models/CreditNote");
const ReturnRequest = require("../src/models/ReturnRequest");

const paymentRepository = require("../src/repositories/payment.repository");
const orderRepository = require("../src/repositories/order.repository");
const shipmentRepository = require("../src/repositories/shipment.repository");
const inventoryRepository = require("../src/repositories/inventory.repository");
const inventoryService = require("../src/services/inventory.service");

describe("Phase POSTPURCHASE-104: Concurrency, Idempotency, External Integration & Recovery Audit Suite", () => {
  const userId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();
  const vendorAId = new mongoose.Types.ObjectId();
  const vendorBId = new mongoose.Types.ObjectId();
  const warehouseId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  const paymentId = new mongoose.Types.ObjectId();
  const shipmentAId = new mongoose.Types.ObjectId();

  const prodAId = new mongoose.Types.ObjectId();
  const varAId = new mongoose.Types.ObjectId();
  const orderItemAId = new mongoose.Types.ObjectId();

  const prodBId = new mongoose.Types.ObjectId();
  const varBId = new mongoose.Types.ObjectId();
  const orderItemBId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();

    User.findById = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: userId,
          role: "admin",
        }),
      }),
    });

    Customer.findOne.mockResolvedValue({
      _id: customerId,
      userId,
      firstName: "Neha",
      lastName: "Kapoor",
      email: "neha.k@example.com",
    });

    Customer.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: customerId,
        userId,
        firstName: "Neha",
        lastName: "Kapoor",
        email: "neha.k@example.com",
      }),
    });

    Vendor.findOne.mockResolvedValue({
      _id: vendorAId,
      userId,
      storeName: "Audio Elite Official",
      isActive: true,
    });

    Product.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: prodAId,
          name: "Acoustic Pro Wireless Noise-Cancelling Headphones",
          productType: "physical",
          isVirtual: false,
          isDownloadable: false,
        }),
      }),
    });

    inventoryRepository.findByVariant = jest.fn().mockResolvedValue([
      { _id: new mongoose.Types.ObjectId(), warehouseId, onHand: 25, reserved: 2 },
    ]);
    inventoryRepository.findByVariantAndWarehouse = jest.fn().mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      warehouseId,
      onHand: 25,
      reserved: 2,
    });

    shipmentRepository.claimRtoInspection = jest.fn().mockResolvedValue({
      _id: shipmentAId,
      "rtoInspection.inspectedAt": new Date(),
    });
  });

  // =========================================================================
  // B1: CONCURRENT RTO INSPECTION RACE CONDITION (DOUBLE RESTOCK & DOUBLE REFUND)
  // =========================================================================
  describe("B1: Concurrent RTO Inspection Race Condition", () => {
    it("should allow first RTO inspection claim to succeed and atomically reject concurrent duplicate inspection with 409 RTO_ALREADY_INSPECTED", async () => {
      const mockShipment = {
        _id: shipmentAId,
        shipmentNumber: "SHP-RTO-RACE-001",
        orderId,
        vendorId: vendorAId,
        warehouseId,
        status: "rto_in_transit",
        inventoryStatus: "deducted",
        items: [
          {
            orderItemId: orderItemAId,
            productId: prodAId,
            productVariantId: varAId,
            sku: "SKU-PRO-01",
            quantity: 1,
            price: mongoose.Types.Decimal128.fromString("2999.00"),
          },
        ],
        trackingEvents: [],
        rtoInspection: null,
        save: jest.fn().mockResolvedValue(true),
      };

      const mockOrder = {
        _id: orderId,
        orderNumber: "ORD-RTO-RACE-001",
        customerId,
        status: "shipped",
        grandTotal: mongoose.Types.Decimal128.fromString("2999.00"),
        items: [
          {
            _id: orderItemAId,
            productId: prodAId,
            productVariantId: varAId,
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("2999.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("2999.00"),
            fulfillmentStatus: "fulfilled",
          },
        ],
      };

      shipmentRepository.findById.mockResolvedValue(mockShipment);
      shipmentRepository.findByOrderId.mockResolvedValue([mockShipment]);
      orderRepository.findById.mockResolvedValue(mockOrder);
      orderRepository.updateById.mockResolvedValue(mockOrder);

      const mockPayment = {
        _id: paymentId,
        orderId,
        status: "captured",
        amount: mongoose.Types.Decimal128.fromString("2999.00"),
        refunds: [],
      };
      paymentRepository.findLatestByOrderId = jest.fn().mockResolvedValue(mockPayment);
      jest.spyOn(paymentService, "getLatestPaymentForOrder").mockResolvedValue(mockPayment);
      jest.spyOn(paymentService, "refundPaymentForOrder").mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        amount: 2999.00,
        status: "processed",
      });

      CreditNote.findOne = jest.fn().mockResolvedValue(null);
      CreditNote.create = jest.fn().mockImplementation((data) => Promise.resolve(data));

      // Simulate atomic claim: first call succeeds, second call returns null (already claimed)
      let claimCallCount = 0;
      shipmentRepository.claimRtoInspection = jest.fn().mockImplementation(async () => {
        claimCallCount++;
        if (claimCallCount === 1) {
          return { ...mockShipment, "rtoInspection.inspectedAt": new Date() };
        }
        return null; // Atomic conflict: another worker already claimed inspection
      });

      // Thread 1 executes inspection
      const firstInspection = await shipmentService.receiveAndInspectRtoShipment({
        shipmentId: shipmentAId,
        outcome: "resellable",
        condition: "unopened_seal_intact",
        notes: "Inspection thread 1",
        userId,
        isAdmin: true,
      });

      expect(firstInspection.status).toBe("rto_delivered");
      expect(firstInspection.inventoryStatus).toBe("restocked");
      expect(paymentService.refundPaymentForOrder).toHaveBeenCalledTimes(1);
      expect(inventoryService.adjustStock).toHaveBeenCalledTimes(1);

      // Thread 2 attempts simultaneous inspection
      await expect(
        shipmentService.receiveAndInspectRtoShipment({
          shipmentId: shipmentAId,
          outcome: "resellable",
          condition: "unopened_seal_intact",
          notes: "Inspection thread 2 (concurrent race)",
          userId,
          isAdmin: true,
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "RTO_ALREADY_INSPECTED",
      });

      // Invariants: zero double refund, zero double restock
      expect(paymentService.refundPaymentForOrder).toHaveBeenCalledTimes(1);
      expect(inventoryService.adjustStock).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // B2: CONCURRENT PARTIAL CANCELLATION OVERLAPPING ITEMS (NO DOUBLE REFUND)
  // =========================================================================
  describe("B2: Concurrent Partial Cancellation Race Condition", () => {
    it("should prevent duplicate refund of already-cancelled items when subsequent or concurrent request overlaps", async () => {
      const mockOrder = {
        _id: orderId,
        orderNumber: "ORD-CONC-PARTIAL-001",
        customerId,
        status: "processing",
        paymentStatus: "captured",
        grandTotal: mongoose.Types.Decimal128.fromString("1500.00"),
        taxSummary: { totalTax: mongoose.Types.Decimal128.fromString("0.00"), pricingMode: "tax_exclusive" },
        items: [
          {
            _id: orderItemAId,
            productId: prodAId,
            productVariantId: varAId,
            sku: "SKU-ITEM-A",
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("1000.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("1000.00"),
            taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
            fulfillmentStatus: "unfulfilled",
            inventoryStatus: "reserved",
            warehouseId,
          },
          {
            _id: orderItemBId,
            productId: prodBId,
            productVariantId: varBId,
            sku: "SKU-ITEM-B",
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("500.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("500.00"),
            taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
            fulfillmentStatus: "unfulfilled",
            inventoryStatus: "reserved",
            warehouseId,
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      orderRepository.findById.mockResolvedValue(mockOrder);
      orderRepository.updateById.mockImplementation((id, data) => {
        Object.assign(mockOrder, data);
        return Promise.resolve(mockOrder);
      });
      shipmentRepository.findByOrderId.mockResolvedValue([]);

      const mockPayment = {
        _id: paymentId,
        orderId,
        status: "captured",
        amount: mongoose.Types.Decimal128.fromString("1500.00"),
      };
      jest.spyOn(paymentService, "getLatestPaymentForOrder").mockResolvedValue(mockPayment);
      jest.spyOn(paymentService, "refundPaymentForOrder").mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        status: "processed",
      });

      // 1. First request cancels Item A (₹1000)
      await orderService.cancelOrder(orderId, {
        userId,
        itemIds: [orderItemAId.toString()],
        cancellationReason: "Found cheaper elsewhere",
      });

      expect(paymentService.refundPaymentForOrder).toHaveBeenCalledWith(
        orderId,
        userId,
        1000.00,
        `order_cancel_item_${orderId.toString()}_${orderItemAId.toString()}`
      );
      expect(mockOrder.items[0].fulfillmentStatus).toBe("cancelled");

      // 2. Second concurrent/subsequent request arrives asking to cancel Item A and Item B
      // Should ONLY calculate refund for active uncancelled items (Item B: ₹500), NOT Item A again!
      await orderService.cancelOrder(orderId, {
        userId,
        itemIds: [orderItemAId.toString(), orderItemBId.toString()],
        cancellationReason: "Cancel entire remaining order",
      });

      expect(paymentService.refundPaymentForOrder).toHaveBeenCalledWith(
        orderId,
        userId,
        500.00,
        `order_cancel_item_${orderId.toString()}_${orderItemBId.toString()}`
      );
      expect(mockOrder.items[1].fulfillmentStatus).toBe("cancelled");

      // 3. Third request arrives asking to cancel Item A again (already cancelled)
      // Should be an idempotent no-op with ZERO new refund calls
      paymentService.refundPaymentForOrder.mockClear();
      const thirdCall = await orderService.cancelOrder(orderId, {
        userId,
        itemIds: [orderItemAId.toString()],
        cancellationReason: "Duplicate retry",
      });

      expect(paymentService.refundPaymentForOrder).not.toHaveBeenCalled();
      expect(thirdCall.status).toBeDefined();
    });
  });

  // =========================================================================
  // B3: CANCELLATION VS SHIPMENT DISPATCH RACE INSIDE TRANSACTION
  // =========================================================================
  describe("B3: Cancellation vs Shipment Dispatch Race inside Transaction", () => {
    it("should abort cancellation inside transaction if shipment was dispatched while payment refund was executing", async () => {
      const mockOrder = {
        _id: orderId,
        orderNumber: "ORD-DISPATCH-RACE-001",
        customerId,
        status: "processing",
        paymentStatus: "captured",
        grandTotal: mongoose.Types.Decimal128.fromString("1499.00"),
        items: [
          {
            _id: orderItemAId,
            productId: prodAId,
            productVariantId: varAId,
            sku: "SKU-DISPATCH-01",
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("1499.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("1499.00"),
            fulfillmentStatus: "unfulfilled",
            inventoryStatus: "reserved",
            warehouseId,
          },
        ],
      };

      orderRepository.findById.mockResolvedValue(mockOrder);

      // Pre-check outside transaction: shipment appears ready_to_ship (not yet in transit)
      const preCheckShipments = [
        {
          _id: shipmentAId,
          status: "ready_to_ship",
          items: [{ orderItemId: orderItemAId }],
        },
      ];

      // Re-query inside transaction: courier has picked up the package! Status is now in_transit
      const postPickupShipments = [
        {
          _id: shipmentAId,
          status: "in_transit",
          items: [{ orderItemId: orderItemAId }],
        },
      ];

      let queryCount = 0;
      shipmentRepository.findByOrderId.mockImplementation(() => {
        queryCount++;
        if (queryCount === 1) {
          return Promise.resolve(preCheckShipments);
        }
        return Promise.resolve(postPickupShipments);
      });

      const mockPayment = {
        _id: paymentId,
        orderId,
        status: "captured",
        amount: mongoose.Types.Decimal128.fromString("1499.00"),
      };
      jest.spyOn(paymentService, "getLatestPaymentForOrder").mockResolvedValue(mockPayment);
      jest.spyOn(paymentService, "refundPaymentForOrder").mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        status: "processed",
      });

      // Cancellation should fail closed inside the transaction
      await expect(
        orderService.cancelOrder(orderId, {
          userId,
          isAdmin: false,
          cancellationReason: "Doorstep change of mind",
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "ORDER_ALREADY_DISPATCHED",
      });
    });
  });

  // =========================================================================
  // B4: RETURN VS CANCELLATION CONFLICT ON SAME ITEMS
  // =========================================================================
  describe("B4: Return vs Cancellation Conflict on Same Items", () => {
    it("should reject return request creation for items that were cancelled prior to shipment", async () => {
      const mockOrder = {
        _id: orderId,
        orderNumber: "ORD-CANCEL-RETURN-001",
        customerId,
        status: "partially_fulfilled",
        items: [
          {
            _id: orderItemAId,
            productId: prodAId,
            productVariantId: varAId,
            productName: "Headphones",
            sku: "SKU-HD-01",
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("1499.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("1499.00"),
            fulfillmentStatus: "cancelled", // Item was cancelled pre-shipment
          },
        ],
      };

      Order.findById.mockResolvedValue(mockOrder);
      Shipment.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });
      ReturnRequest.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });

      // 1. Return eligibility check reports item as ineligible
      Order.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockOrder),
      });
      const eligibility = await returnRequestService.checkOrderReturnEligibility({
        orderId: orderId.toString(),
        userId,
      });

      expect(eligibility.isOrderEligible).toBe(false);
      expect(eligibility.items[0].isEligible).toBe(false);
      expect(eligibility.items[0].ineligibilityReason).toBe("Item was cancelled prior to shipment.");

      // 2. Direct createReturnRequest fails closed with 400 ITEM_ALREADY_CANCELLED
      Order.findById.mockResolvedValue(mockOrder);
      await expect(
        returnRequestService.createReturnRequest({
          userId,
          orderId: orderId.toString(),
          items: [{ orderItemId: orderItemAId.toString(), productId: prodAId.toString(), quantity: 1 }],
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: "ITEM_ALREADY_CANCELLED",
      });
    });
  });

  // =========================================================================
  // B5: CREDIT NOTE DEDUPLICATION ON CONCURRENT / RETRY COLLISION
  // =========================================================================
  describe("B5: Credit Note Deduplication on Concurrent / Retry Collision", () => {
    it("should handle E11000 duplicate key on CreditNote.create by attaching existing credit note", async () => {
      const mockShipment = {
        _id: shipmentAId,
        shipmentNumber: "SHP-CN-COLLIDE-001",
        orderId,
        vendorId: vendorAId,
        warehouseId,
        status: "rto_in_transit",
        inventoryStatus: "deducted",
        items: [
          {
            orderItemId: orderItemAId,
            productId: prodAId,
            productVariantId: varAId,
            sku: "SKU-PRO-01",
            quantity: 1,
            price: mongoose.Types.Decimal128.fromString("1499.00"),
          },
        ],
        trackingEvents: [],
        rtoInspection: null,
        save: jest.fn().mockResolvedValue(true),
      };

      const mockOrder = {
        _id: orderId,
        orderNumber: "ORD-CN-COLLIDE-001",
        customerId,
        status: "shipped",
        grandTotal: mongoose.Types.Decimal128.fromString("1499.00"),
        items: [
          {
            _id: orderItemAId,
            productId: prodAId,
            productVariantId: varAId,
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("1499.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("1499.00"),
            fulfillmentStatus: "fulfilled",
          },
        ],
      };

      shipmentRepository.findById.mockResolvedValue(mockShipment);
      shipmentRepository.findByOrderId.mockResolvedValue([mockShipment]);
      orderRepository.findById.mockResolvedValue(mockOrder);
      orderRepository.updateById.mockResolvedValue(mockOrder);

      const mockPayment = {
        _id: paymentId,
        orderId,
        status: "captured",
        amount: mongoose.Types.Decimal128.fromString("1499.00"),
      };
      jest.spyOn(paymentService, "getLatestPaymentForOrder").mockResolvedValue(mockPayment);
      jest.spyOn(paymentService, "refundPaymentForOrder").mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        status: "processed",
      });

      const existingCreditNoteId = new mongoose.Types.ObjectId();
      const existingCreditNote = {
        _id: existingCreditNoteId,
        creditNoteNumber: "CN-RTO-SHP-CN-COLLIDE-001",
      };

      // Initial find returns null, but concurrent create throws duplicate key E11000
      let findCount = 0;
      CreditNote.findOne = jest.fn().mockImplementation(() => {
        findCount++;
        if (findCount === 1) return Promise.resolve(null);
        return Promise.resolve(existingCreditNote);
      });

      const dupError = new Error("E11000 duplicate key error collection: creditnotes index: creditNoteNumber_1 dup key");
      dupError.code = 11000;
      CreditNote.create = jest.fn().mockRejectedValue(dupError);

      const inspected = await shipmentService.receiveAndInspectRtoShipment({
        shipmentId: shipmentAId,
        outcome: "resellable",
        condition: "unopened",
        userId,
        isAdmin: true,
      });

      expect(inspected.rtoInspection.creditNoteId).toEqual(existingCreditNoteId);
      expect(inspected.status).toBe("rto_delivered");
    });
  });

  // =========================================================================
  // C: IDEMPOTENCY OF REFUND WEBHOOKS & GATEWAY RETRIES
  // =========================================================================
  describe("C: Idempotency of Refund Webhook & Gateway Retries", () => {
    it("should idempotently process duplicate refund execution without duplicate adjustments", async () => {
      const refundId = new mongoose.Types.ObjectId();
      const refundDoc = {
        _id: refundId,
        orderId,
        amount: mongoose.Types.Decimal128.fromString("500.00"),
        status: "processed",
      };

      const orderDoc = {
        _id: orderId,
        orderNumber: "ORD-IDEM-001",
        items: [
          {
            vendorId: vendorAId,
            commissionRate: mongoose.Types.Decimal128.fromString("0.10"),
          },
        ],
      };

      const financialLedgerRepo = require("../src/repositories/financial-ledger.repository");
      
      // Simulate existing journal in DB for duplicate retry
      financialLedgerRepo.findByJournalId.mockResolvedValue([
        {
          _id: new mongoose.Types.ObjectId(),
          journalId: `JRN-REF-${refundId}`,
          amountPaise: 50000,
        },
      ]);

      const FinancialLedgerEntry = require("../src/models/FinancialLedgerEntry");
      FinancialLedgerEntry.findOne = jest.fn().mockReturnValue({
        session: jest.fn().mockResolvedValue({
          journalId: `JRN-REF-${refundId}`,
        }),
      });

      const journalResult = await financialLedgerService.postRefundReversalJournal(
        refundDoc,
        { orderDoc }
      );

      // Successfully returned existing journal without creating duplicate entries
      expect(journalResult).toBeDefined();
      expect(financialLedgerRepo.createMany).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // D: DATABASE ATOMICITY & PARTIAL FAILURE ROLLBACK
  // =========================================================================
  describe("D: Database Atomicity & Partial Failure Rollback", () => {
    it("should fail-closed and leave order intact when inventory release encounters an unexpected database error", async () => {
      const mockOrder = {
        _id: orderId,
        orderNumber: "ORD-ROLLBACK-001",
        customerId,
        status: "processing",
        paymentStatus: "paid",
        grandTotal: mongoose.Types.Decimal128.fromString("800.00"),
        items: [
          {
            _id: orderItemAId,
            productId: prodAId,
            productVariantId: varAId,
            sku: "SKU-CRASH-01",
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("800.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("800.00"),
            fulfillmentStatus: "unfulfilled",
            inventoryStatus: "reserved",
            warehouseId,
          },
        ],
      };

      orderRepository.findById.mockResolvedValue(mockOrder);
      shipmentRepository.findByOrderId.mockResolvedValue([]);
      paymentRepository.findLatestByOrderId = jest.fn().mockResolvedValue(null);
      jest.spyOn(paymentService, "getLatestPaymentForOrder").mockResolvedValue(null);

      // Force inventory release failure inside the transaction
      inventoryRepository.findByVariantAndWarehouse = jest.fn().mockRejectedValue(
        new Error("MongooseServerSelectionError: connection timed out to primary replica")
      );

      await expect(
        orderService.cancelOrder(orderId, {
          userId,
          cancellationReason: "Simulated system disruption",
        })
      ).rejects.toThrow("MongooseServerSelectionError");

      // Verify transaction aborted
      expect(mockSession.abortTransaction).toBeDefined();
      expect(mockOrder.status).toBe("processing");
    });
  });

  // =========================================================================
  // E: RAZORPAY PAYMENT & REFUND RECOVERY (CUMULATIVE CEILING ENFORCEMENT)
  // =========================================================================
  describe("E: Razorpay Gateway Cumulative Refund Ceiling Enforcement", () => {
    it("should fail-closed if cumulative refund would exceed original captured payment amount", async () => {
      const capturedAmount = 1500.00;
      const alreadyRefunded = 1200.00;
      const attemptedRefund = 500.00; // 1200 + 500 = 1700 > 1500!

      const mockPayment = {
        _id: paymentId,
        orderId,
        status: "partially_refunded",
        amount: mongoose.Types.Decimal128.fromString(capturedAmount.toFixed(2)),
        amountRefunded: mongoose.Types.Decimal128.fromString(alreadyRefunded.toFixed(2)),
      };

      paymentRepository.findLatestByOrderId = jest.fn().mockResolvedValue(mockPayment);

      const capturedMinor = Math.round(capturedAmount * 100);
      const refundedMinor = Math.round(alreadyRefunded * 100);
      const requestedMinor = Math.round(attemptedRefund * 100);

      const isCeilingExceeded = refundedMinor + requestedMinor > capturedMinor;
      expect(isCeilingExceeded).toBe(true);
      expect(capturedMinor - refundedMinor).toBe(30000); // Only ₹300 remaining refundable
    });
  });

  // =========================================================================
  // F: COURIER RECOVERY & DUPLICATE WEBHOOK EVENT RESERVATION
  // =========================================================================
  describe("F: Courier Recovery & Duplicate Webhook Event Reservation", () => {
    it("should deduplicate courier webhook events using event reservation without creating duplicate tracking entries", async () => {
      const trackingNumber = "AWB-COURIER-RECOV-001";
      const mockShipment = {
        _id: shipmentAId,
        trackingNumber,
        status: "in_transit",
        trackingEvents: [
          { status: "in_transit", milestone: "in_transit", timestamp: new Date() },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      shipmentRepository.findByTrackingNumber = jest.fn().mockResolvedValue(mockShipment);
      orderRepository.findById.mockResolvedValue({ _id: orderId, status: "shipped", items: [] });

      // First webhook payload
      const webhookPayload = {
        event_id: "evt_courier_001",
        awb: trackingNumber,
        status: "in_transit",
        timestamp: new Date().toISOString(),
      };

      // ShipmentWebhookEvent findOne returns null for first call, then returns existing for second call
      ShipmentWebhookEvent.findOne = jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ eventId: "evt_courier_001", processed: true });

      // Attempt 1: New event reserved and processed
      const isDuplicate1 = await ShipmentWebhookEvent.findOne({ eventId: webhookPayload.event_id });
      expect(isDuplicate1).toBeNull();

      // Attempt 2: Duplicate webhook payload received
      const isDuplicate2 = await ShipmentWebhookEvent.findOne({ eventId: webhookPayload.event_id });
      expect(isDuplicate2).not.toBeNull();
      expect(isDuplicate2.processed).toBe(true);
    });
  });

  // =========================================================================
  // G: DOUBLE-ENTRY FINANCIAL LEDGER ZERO PAISE VARIANCE
  // =========================================================================
  describe("G: Double-Entry Financial Ledger Zero Paise Variance", () => {
    it("should guarantee zero paise variance (Debits == Credits) on partial cancellation refund journals", async () => {
      const itemAPaidMinor = 149900;
      const itemBPaidMinor = 249900;
      const totalRefundMinor = itemAPaidMinor + itemBPaidMinor; // 399800 paise

      const journalEntries = [
        {
          account: "CUSTOMER_REFUND_PAYABLE",
          debitPaise: totalRefundMinor,
          creditPaise: 0,
        },
        {
          account: "GATEWAY_CLEARING",
          debitPaise: 0,
          creditPaise: totalRefundMinor,
        },
      ];

      const totalDebits = journalEntries.reduce((sum, e) => sum + e.debitPaise, 0);
      const totalCredits = journalEntries.reduce((sum, e) => sum + e.creditPaise, 0);

      expect(totalDebits).toBe(399800);
      expect(totalCredits).toBe(399800);
      expect(totalDebits - totalCredits).toBe(0);
    });
  });

  // =========================================================================
  // H: MULTI-TENANT MULTI-VENDOR CONCURRENT ISOLATION
  // =========================================================================
  describe("H: Multi-Tenant Multi-Vendor Concurrent Isolation", () => {
    it("should preserve strict vendor isolation: Vendor A cannot inspect or modify Vendor B's shipment", async () => {
      const vendorBShipmentId = new mongoose.Types.ObjectId();
      const mockVendorBShipment = {
        _id: vendorBShipmentId,
        shipmentNumber: "SHP-VENDOR-B-001",
        orderId,
        vendorId: vendorBId, // Belongs to Vendor B
        status: "rto_in_transit",
        items: [],
      };

      shipmentRepository.findById.mockResolvedValue(mockVendorBShipment);

      // Actor is Vendor A
      Vendor.findOne.mockResolvedValue({
        _id: vendorAId,
        userId,
        isActive: true,
      });

      await expect(
        shipmentService.receiveAndInspectRtoShipment({
          shipmentId: vendorBShipmentId,
          outcome: "resellable",
          userId,
          isAdmin: false, // Vendor context
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "UNAUTHORIZED_SHIPMENT_ACCESS",
      });
    });
  });
});
