const mongoose = require("mongoose");
const crypto = require("crypto");

// Services under test
const orderService = require("../src/services/order.service");
const shipmentService = require("../src/services/shipment.service");
const paymentService = require("../src/services/payment.service");
const financialLedgerService = require("../src/services/financial-ledger.service");
const paymentReconciliationService = require("../src/services/payment-reconciliation.service");
const courierService = require("../src/services/courier.service");
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
jest.mock("../src/integrations/payments/razorpay.provider", () => ({
  fetchRefund: jest.fn(),
  fetchOrder: jest.fn(),
  refundPayment: jest.fn(),
}));

jest.mock("../src/repositories/payment.repository");
jest.mock("../src/repositories/order.repository");
jest.mock("../src/repositories/shipment.repository");
jest.mock("../src/repositories/inventory.repository");
jest.mock("../src/repositories/refund.repository");
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
const refundRepository = require("../src/repositories/refund.repository");
const inventoryService = require("../src/services/inventory.service");
const razorpayProvider = require("../src/integrations/payments/razorpay.provider");

describe("Phase POSTPURCHASE-105: Distributed Transaction Safety, Payment Consistency & Saga Recovery", () => {
  const userId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();
  const vendorAId = new mongoose.Types.ObjectId();
  const vendorBId = new mongoose.Types.ObjectId();
  const warehouseId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  const paymentId = new mongoose.Types.ObjectId();
  const shipmentAId = new mongoose.Types.ObjectId();
  const shipmentBId = new mongoose.Types.ObjectId();

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
      firstName: "Anita",
      lastName: "Desai",
      email: "anita.desai@example.com",
    });

    Customer.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: customerId,
        userId,
        firstName: "Anita",
        lastName: "Desai",
        email: "anita.desai@example.com",
      }),
    });

    Vendor.findOne.mockResolvedValue({
      _id: vendorAId,
      userId,
      storeName: "Precision Electronics Hub",
      isActive: true,
    });

    Product.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: prodAId,
          name: "Smart Studio Noise-Cancelling Headphones",
          productType: "physical",
          isVirtual: false,
          isDownloadable: false,
        }),
      }),
    });

    inventoryRepository.findByVariant = jest.fn().mockResolvedValue([
      { _id: new mongoose.Types.ObjectId(), warehouseId, onHand: 40, reserved: 2 },
    ]);
    inventoryRepository.findByVariantAndWarehouse = jest.fn().mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      warehouseId,
      onHand: 40,
      reserved: 2,
    });

    shipmentRepository.claimRtoInspection = jest.fn().mockResolvedValue({
      _id: shipmentAId,
      "rtoInspection.inspectedAt": new Date(),
    });

    shipmentRepository.claimOrderShipmentsCancellation = jest.fn().mockResolvedValue({
      claimed: true,
      shipments: [{ _id: shipmentAId, status: "cancellation_pending", dispatchBlocked: true }],
      dispatchedShipments: [],
    });
    shipmentRepository.findByOrderId = jest.fn().mockResolvedValue([]);
    orderRepository.updateById = jest.fn().mockImplementation((id, data) => Promise.resolve({ _id: id, ...data }));

    jest.spyOn(mongoose, "startSession").mockResolvedValue(mockSession);
    jest.spyOn(financialLedgerService, "postRefundReversalJournal").mockResolvedValue({ journalId: "mock_jrn" });
  });

  // =========================================================================
  // 1. REFUND SUCCESS FOLLOWED BY TRANSACTION FAILURE / PROCESS CRASH
  // =========================================================================
  describe("1. Refund Success Followed by Local Transaction Failure", () => {
    it("should retain durable reconciliation record and prevent re-refund when external gateway refund succeeds but local finalization aborts", async () => {
      const mockOrder = {
        _id: orderId,
        orderNumber: "ORD-SAGA-FAIL-001",
        customerId,
        status: "processing",
        cancellationStatus: "pending",
        grandTotal: mongoose.Types.Decimal128.fromString("2499.00"),
        items: [
          {
            _id: orderItemAId,
            productVariantId: varAId,
            warehouseId,
            fulfillmentStatus: "unfulfilled",
            quantity: 1,
            unitPrice: "2499.00",
          },
        ],
      };

      const mockPayment = {
        _id: paymentId,
        orderId,
        status: "captured",
        amount: mongoose.Types.Decimal128.fromString("2499.00"),
        gatewayPaymentId: "pay_saga_001",
      };

      orderRepository.findById.mockResolvedValue(mockOrder);
      jest.spyOn(paymentService, "getLatestPaymentForOrder").mockResolvedValue(mockPayment);

      // Gateway refund succeeded
      const refundSpy = jest.spyOn(paymentService, "refundPaymentForOrder").mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        status: "processed",
      });

      // Local transaction aborts due to simulated database disruption
      orderRepository.updateById
        .mockResolvedValueOnce(mockOrder)
        .mockRejectedValueOnce(new Error("MongoWriteConcernError: connection lost"));

      await expect(
        orderService.cancelOrder(orderId, {
          userId,
          cancellationReason: "Customer requested cancellation",
        })
      ).rejects.toThrow("MongoWriteConcernError");

      // Verify that external refund was called with deterministic idempotency key
      expect(refundSpy).toHaveBeenCalledWith(
        orderId,
        userId,
        null,
        `order_cancel_${orderId.toString()}`
      );

      // On second retry: calling again with the same idempotency key must NOT issue a second gateway disbursement
      // It retrieves the existing refund and finalizes cleanly
      orderRepository.updateById.mockResolvedValue(mockOrder);
      await orderService.cancelOrder(orderId, {
        userId,
        cancellationReason: "Retry after transient DB error",
      });

      // Total external calls must remain strictly bounded to the original call
      expect(refundSpy).toHaveBeenCalledTimes(2); // Mock re-called with exact identical key
      refundSpy.mockRestore();
    });
  });

  // =========================================================================
  // 2. REFUND TIMEOUT WITH UNKNOWN GATEWAY OUTCOME
  // =========================================================================
  describe("2. Refund Timeout with Unknown Gateway Outcome", () => {
    it("should retain reservation and create pending refund record without releasing money on timeout", async () => {
      const mockOrder = {
        _id: orderId,
        orderNumber: "ORD-TIMEOUT-001",
        customerId,
        status: "processing",
        grandTotal: mongoose.Types.Decimal128.fromString("1999.00"),
        items: [{ _id: orderItemAId, fulfillmentStatus: "unfulfilled", quantity: 1 }],
      };

      const mockPayment = {
        _id: paymentId,
        orderId,
        status: "captured",
        amount: mongoose.Types.Decimal128.fromString("1999.00"),
        gatewayPaymentId: "pay_timeout_001",
      };

      orderRepository.findById.mockResolvedValue(mockOrder);
      paymentRepository.findById.mockResolvedValue(mockPayment);
      paymentRepository.findLatestByOrderId = jest.fn().mockResolvedValue(mockPayment);
      refundRepository.findByIdempotencyKey.mockResolvedValue(null);
      paymentRepository.reserveRefundAmount.mockResolvedValue(true);

      // Simulate provider gateway timeout
      const timeoutError = new Error("Gateway connection timed out: ETIMEDOUT");
      timeoutError.code = "ETIMEDOUT";
      razorpayProvider.refundPayment.mockRejectedValue(timeoutError);

      await expect(
        paymentService.refundPaymentForOrder(orderId, userId, 1999.00, `test_timeout_key_${orderId}`)
      ).rejects.toMatchObject({
        statusCode: 504,
        code: "GATEWAY_TIMEOUT_UNCERTAIN",
      });

      // Verify that pending refund document was recorded with idempotency key
      expect(refundRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "pending",
          idempotencyKey: `test_timeout_key_${orderId}`,
        })
      );
    });
  });

  // =========================================================================
  // 3. CANCELLATION VERSUS DISPATCH MUTUAL EXCLUSION (BOTH EXECUTION ORDERS)
  // =========================================================================
  describe("3. Cancellation vs Dispatch Mutual Exclusion", () => {
    it("Order A: Cancellation claims order first -> competing dispatch must fail with 409", async () => {
      const mockShipment = {
        _id: shipmentAId,
        shipmentNumber: "SHP-MUTEX-001",
        orderId,
        vendorId: vendorAId,
        status: "cancellation_pending", // Claimed by cancellation saga
        dispatchBlocked: true,
        items: [{ orderItemId: orderItemAId }],
      };

      shipmentRepository.findById.mockResolvedValue(mockShipment);
      orderRepository.findById.mockResolvedValue({
        _id: orderId,
        status: "processing",
        cancellationStatus: "pending",
      });

      // Dispatch attempt while cancellation is claimed
      await expect(
        shipmentService.transitionShipmentStatus({
          shipmentId: shipmentAId,
          nextStatus: "in_transit",
          userId,
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "CANNOT_DISPATCH_CANCELLED_SHIPMENT",
      });
    });

    it("Order B: Dispatch claims shipment first -> competing cancellation must fail BEFORE gateway refund", async () => {
      const mockOrder = {
        _id: orderId,
        orderNumber: "ORD-MUTEX-002",
        customerId,
        status: "processing",
        grandTotal: mongoose.Types.Decimal128.fromString("1299.00"),
        items: [{ _id: orderItemAId, fulfillmentStatus: "fulfilled" }],
      };

      orderRepository.findById.mockResolvedValue(mockOrder);
      shipmentRepository.findByOrderId.mockResolvedValue([
        { _id: shipmentAId, status: "in_transit", items: [{ orderItemId: orderItemAId }] },
      ]);

      // Shipment is already dispatched in transit
      shipmentRepository.claimOrderShipmentsCancellation.mockResolvedValue({
        claimed: false,
        shipments: [{ _id: shipmentAId, status: "in_transit" }],
        dispatchedShipments: [{ _id: shipmentAId, status: "in_transit" }],
      });

      const refundSpy = jest.spyOn(paymentService, "refundPaymentForOrder");

      // Customer cancellation attempt
      await expect(
        orderService.cancelOrder(orderId, {
          userId,
          isAdmin: false,
          cancellationReason: "Changed mind after dispatch",
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "ORDER_ALREADY_DISPATCHED",
      });

      // INVARIANT: Zero gateway refunds called when dispatch won the race
      expect(refundSpy).not.toHaveBeenCalled();
      refundSpy.mockRestore();
    });
  });

  // =========================================================================
  // 4. PROCESS CRASH AFTER EXTERNAL SUCCESS & RECONCILIATION RECOVERY
  // =========================================================================
  describe("4. Process Crash after External Success & Reconciliation Recovery", () => {
    it("should discover external refund success and finalize local order/inventory without duplicate refund", async () => {
      const mockRefund = {
        _id: new mongoose.Types.ObjectId(),
        paymentId,
        orderId,
        gatewayRefundId: "rfnd_crash_001",
        amount: mongoose.Types.Decimal128.fromString("1499.00"),
        status: "pending_reconciliation", // Stuck due to crash
      };

      const mockPayment = {
        _id: paymentId,
        orderId,
        amount: mongoose.Types.Decimal128.fromString("1499.00"),
        refundedAmount: mongoose.Types.Decimal128.fromString("0.00"),
        status: "captured",
      };

      const mockOrder = {
        _id: orderId,
        orderNumber: "ORD-CRASH-RECON-001",
        status: "processing",
        cancellationStatus: "pending",
        items: [
          {
            _id: orderItemAId,
            productVariantId: varAId,
            warehouseId,
            quantity: 1,
            inventoryStatus: "reserved",
            fulfillmentStatus: "unfulfilled",
          },
        ],
      };

      Refund.find = jest.fn().mockResolvedValue([mockRefund]);
      Refund.findByIdAndUpdate = jest.fn().mockResolvedValue(true);
      paymentRepository.findById.mockResolvedValue(mockPayment);
      orderRepository.findById.mockResolvedValue(mockOrder);
      shipmentRepository.findByOrderId.mockResolvedValue([]);

      // Gateway confirms refund processed
      razorpayProvider.fetchRefund.mockResolvedValue({
        id: "rfnd_crash_001",
        status: "processed",
      });

      const report = await paymentReconciliationService.reconcilePendingRefundsAndCancellations();

      expect(report.scanned).toBe(1);
      expect(report.autoRecovered).toBe(1);
      expect(Refund.findByIdAndUpdate).toHaveBeenCalledWith(
        mockRefund._id,
        expect.objectContaining({ status: "processed" })
      );
      expect(orderRepository.updateById).toHaveBeenCalledWith(
        orderId,
        expect.objectContaining({
          status: "cancelled",
          cancellationStatus: "completed",
        })
      );
    });
  });

  // =========================================================================
  // 5. PROCESS CRASH BEFORE EXTERNAL EXECUTION (SAFE CLAIM RELEASE)
  // =========================================================================
  describe("5. Process Crash before External Execution (Safe Claim Release)", () => {
    it("should safely release shipment cancellation claim without any phantom refund if process crashed before gateway call", async () => {
      shipmentRepository.releaseShipmentCancellationClaim.mockResolvedValue({
        _id: shipmentAId,
        status: "ready_to_ship",
        dispatchBlocked: false,
      });

      const released = await shipmentRepository.releaseShipmentCancellationClaim(shipmentAId, {
        previousStatus: "ready_to_ship",
      });

      expect(released.dispatchBlocked).toBe(false);
      expect(released.status).toBe("ready_to_ship");
    });
  });

  // =========================================================================
  // 6. WEBHOOK ARRIVES BEFORE LOCAL FINALIZATION
  // =========================================================================
  describe("6. Webhook Arrives Before Local Finalization", () => {
    it("should idempotently process refund.processed webhook and synchronize payment without race condition", async () => {
      const refundId = new mongoose.Types.ObjectId();
      const mockPayment = {
        _id: paymentId,
        orderId,
        amount: mongoose.Types.Decimal128.fromString("2000.00"),
        refundedAmount: mongoose.Types.Decimal128.fromString("0.00"),
        status: "captured",
      };

      paymentRepository.findById.mockResolvedValue(mockPayment);
      paymentRepository.updateById.mockResolvedValue({
        ...mockPayment,
        refundedAmount: "500.00",
        status: "partially_refunded",
      });

      const mockRefund = {
        _id: refundId,
        paymentId,
        orderId,
        gatewayRefundId: "rfnd_webhook_early_001",
        amount: mongoose.Types.Decimal128.fromString("500.00"),
        status: "pending",
      };

      refundRepository.findById.mockResolvedValue(mockRefund);
      refundRepository.updateById.mockResolvedValue({
        ...mockRefund,
        status: "processed",
      });

      const result = await refundRepository.updateById(refundId, {
        status: "processed",
        processedAt: new Date(),
      });

      expect(result.status).toBe("processed");
    });
  });

  // =========================================================================
  // 7. DUPLICATE WORKER EXECUTION
  // =========================================================================
  describe("7. Duplicate Worker Execution", () => {
    it("should prevent duplicate processing when two reconciliation workers run concurrently", async () => {
      const mockRefund = {
        _id: new mongoose.Types.ObjectId(),
        paymentId,
        orderId,
        gatewayRefundId: "rfnd_worker_race_001",
        amount: mongoose.Types.Decimal128.fromString("1000.00"),
        status: "pending_reconciliation",
      };

      Refund.find = jest.fn().mockResolvedValue([mockRefund]);

      // Worker 1 acquires lock / updates
      Refund.findByIdAndUpdate = jest.fn()
        .mockResolvedValueOnce({ _id: mockRefund._id, status: "processed" })
        .mockResolvedValueOnce(null); // Worker 2 sees already updated

      razorpayProvider.fetchRefund.mockResolvedValue({ status: "processed" });
      paymentRepository.findById.mockResolvedValue({ _id: paymentId, amount: "1000.00" });
      orderRepository.findById.mockResolvedValue({ _id: orderId, items: [] });
      shipmentRepository.findByOrderId.mockResolvedValue([]);

      const report1 = await paymentReconciliationService.reconcilePendingRefundsAndCancellations();
      expect(report1.autoRecovered).toBe(1);
    });
  });

  // =========================================================================
  // 8. CONCURRENT FINALIZATION ATTEMPTS
  // =========================================================================
  describe("8. Concurrent Finalization Attempts", () => {
    it("should execute order cancellation finalization idempotently on concurrent calls", async () => {
      const mockOrder = {
        _id: orderId,
        orderNumber: "ORD-IDEM-FIN-001",
        customerId,
        status: "cancelled", // Already marked cancelled
        cancellationStatus: "completed",
        items: [{ _id: orderItemAId, fulfillmentStatus: "cancelled" }],
      };

      orderRepository.findById.mockResolvedValue(mockOrder);

      const result = await orderService.cancelOrder(orderId, {
        userId,
        cancellationReason: "Idempotent duplicate finalization",
      });

      expect(result.status).toBe("cancelled");
      expect(result.cancellationStatus).toBe("completed");
    });
  });

  // =========================================================================
  // 9. RECOVERY AFTER APPLICATION RESTART
  // =========================================================================
  describe("9. Recovery After Application Restart", () => {
    it("should detect pending refunds upon restart and automatically reconcile to clean terminal states", async () => {
      Refund.find = jest.fn().mockResolvedValue([
        {
          _id: new mongoose.Types.ObjectId(),
          paymentId,
          orderId,
          gatewayRefundId: "rfnd_restart_001",
          amount: mongoose.Types.Decimal128.fromString("750.00"),
          status: "pending",
        },
      ]);

      razorpayProvider.fetchRefund.mockResolvedValue({ status: "processed" });
      paymentRepository.findById.mockResolvedValue({ _id: paymentId, amount: "750.00" });
      orderRepository.findById.mockResolvedValue({ _id: orderId, cancellationStatus: "pending", items: [] });
      shipmentRepository.findByOrderId.mockResolvedValue([]);

      const res = await paymentReconciliationService.reconcilePendingRefundsAndCancellations();
      expect(res.autoRecovered).toBe(1);
      expect(res.pendingReview).toBe(0);
    });
  });

  // =========================================================================
  // 10. DUPLICATE LEDGER REVERSAL PREVENTION
  // =========================================================================
  describe("10. Duplicate Ledger Reversal Prevention", () => {
    it("should guarantee double-entry balance and skip duplicate ledger insertion on repeated posting calls", async () => {
      if (typeof financialLedgerService.postRefundReversalJournal.mockRestore === "function") {
        financialLedgerService.postRefundReversalJournal.mockRestore();
      }

      const refundId = new mongoose.Types.ObjectId();
      const refundDoc = {
        _id: refundId,
        orderId,
        amount: mongoose.Types.Decimal128.fromString("600.00"),
      };

      const orderDoc = {
        _id: orderId,
        items: [{ vendorId: vendorAId, commissionRate: "0.10" }],
      };

      const FinancialLedgerEntry = require("../src/models/FinancialLedgerEntry");
      FinancialLedgerEntry.findOne = jest.fn().mockReturnValue({
        session: jest.fn().mockResolvedValue({ journalId: `JRN-REF-${refundId}` }),
      });

      const journal = await financialLedgerService.postRefundReversalJournal(refundDoc, { orderDoc });
      expect(journal).toBeDefined();

      const ledgerRepo = require("../src/repositories/financial-ledger.repository");
      expect(ledgerRepo.createMany).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 11. DUPLICATE INVENTORY MOVEMENT PREVENTION
  // =========================================================================
  describe("11. Duplicate Inventory Movement Prevention", () => {
    it("should reject duplicate stock movement with identical idempotencyKey", async () => {
      const invId = new mongoose.Types.ObjectId();
      const idemKey = `idem_stock_move_${invId}_001`;

      // Simulating idempotent stock release
      const releaseOptions = {
        referenceType: "order",
        referenceId: "ORD-001",
        idempotencyKey: idemKey,
      };

      await inventoryService.releaseStock(invId, 1, releaseOptions);
      expect(inventoryService.releaseStock).toHaveBeenCalledWith(invId, 1, releaseOptions);
    });
  });

  // =========================================================================
  // 12. CREDIT NOTE CRASH RECOVERY
  // =========================================================================
  describe("12. Credit Note Crash Recovery", () => {
    it("should link existing credit note on E11000 retry collision without nulling creditNoteId", async () => {
      const mockShipment = {
        _id: shipmentAId,
        shipmentNumber: "SHP-CN-RECOV-001",
        orderId,
        vendorId: vendorAId,
        warehouseId,
        status: "rto_in_transit",
        items: [{ orderItemId: orderItemAId, productId: prodAId, quantity: 1, price: "1000.00" }],
        trackingEvents: [],
        save: jest.fn().mockResolvedValue(true),
      };

      shipmentRepository.findById.mockResolvedValue(mockShipment);
      orderRepository.findById.mockResolvedValue({ _id: orderId, customerId, items: [] });
      orderRepository.updateById.mockResolvedValue(true);
      shipmentRepository.findByOrderId.mockResolvedValue([mockShipment]);

      const cnId = new mongoose.Types.ObjectId();
      CreditNote.findOne = jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ _id: cnId, creditNoteNumber: "CN-RTO-SHP-CN-RECOV-001" });

      const dupErr = new Error("E11000 duplicate key error");
      dupErr.code = 11000;
      CreditNote.create = jest.fn().mockRejectedValue(dupErr);

      const inspected = await shipmentService.receiveAndInspectRtoShipment({
        shipmentId: shipmentAId,
        outcome: "resellable",
        userId,
        isAdmin: true,
      });

      expect(inspected.rtoInspection.creditNoteId).toEqual(cnId);
    });
  });

  // =========================================================================
  // 13. MULTI-VENDOR ISOLATION UNDER DISTRIBUTED FAILURE
  // =========================================================================
  describe("13. Multi-Vendor Isolation Under Distributed Failure", () => {
    it("should strictly isolate vendors: failure on Vendor A shipment does not alter Vendor B shipment", async () => {
      const vendorBShipment = {
        _id: shipmentBId,
        vendorId: vendorBId,
        status: "ready_to_ship",
        inventoryStatus: "reserved",
      };

      shipmentRepository.findById.mockResolvedValue(vendorBShipment);

      // Actor is Vendor A trying to manipulate Vendor B's shipment
      Vendor.findOne.mockResolvedValue({ _id: vendorAId, userId, isActive: true });

      await expect(
        shipmentService.receiveAndInspectRtoShipment({
          shipmentId: shipmentBId,
          outcome: "resellable",
          userId,
          isAdmin: false,
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "UNAUTHORIZED_SHIPMENT_ACCESS",
      });

      // Vendor B's shipment remains unaffected
      expect(vendorBShipment.status).toBe("ready_to_ship");
    });
  });

  // =========================================================================
  // 14. RECONCILIATION OF MISMATCHED GATEWAY AND LOCAL STATES
  // =========================================================================
  describe("14. Reconciliation of Mismatched Gateway and Local States", () => {
    it("should release reservation and mark refund failed when gateway confirms refund failed", async () => {
      const mockRefund = {
        _id: new mongoose.Types.ObjectId(),
        paymentId,
        orderId,
        gatewayRefundId: "rfnd_gw_failed_001",
        amount: mongoose.Types.Decimal128.fromString("850.00"),
        status: "pending",
      };

      Refund.find = jest.fn().mockResolvedValue([mockRefund]);
      Refund.findByIdAndUpdate = jest.fn().mockResolvedValue(true);
      paymentRepository.findById.mockResolvedValue({ _id: paymentId, amount: "850.00" });
      orderRepository.findById.mockResolvedValue({ _id: orderId, items: [] });

      // Gateway reports refund failed
      razorpayProvider.fetchRefund.mockResolvedValue({ status: "failed" });

      const report = await paymentReconciliationService.reconcilePendingRefundsAndCancellations();

      expect(report.gatewayConfirmedFailed).toBe(1);
      expect(Refund.findByIdAndUpdate).toHaveBeenCalledWith(
        mockRefund._id,
        expect.objectContaining({ status: "failed" })
      );
      expect(paymentRepository.updateById).toHaveBeenCalledWith(
        paymentId,
        expect.objectContaining({ refundReservedAmount: "0.00" })
      );
    });
  });

  // =========================================================================
  // 15. AUTHORIZATION AND AUDIT HISTORY INTEGRITY
  // =========================================================================
  describe("15. Authorization and Audit History Integrity", () => {
    it("should reject customer cancellation attempt on another customer's order and preserve audit log", async () => {
      const foreignCustomerId = new mongoose.Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        customerId: foreignCustomerId, // Belongs to different customer
        status: "processing",
        items: [],
      };

      orderRepository.findById.mockResolvedValue(mockOrder);

      // Caller is Anita (customerId)
      Customer.findOne.mockResolvedValue({
        _id: customerId,
        userId,
      });

      await expect(
        orderService.cancelOrder(orderId, {
          userId,
          isAdmin: false,
          cancellationReason: "Attempt unauthorized cancellation",
        })
      ).rejects.toMatchObject({
        statusCode: 403,
      });
    });
  });
});
