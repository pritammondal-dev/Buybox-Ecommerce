const mongoose = require("mongoose");

jest.mock("../src/repositories/payment.repository");
jest.mock("../src/repositories/order.repository");
jest.mock("../src/integrations/payments/razorpay.provider");
jest.mock("../src/services/order.service");
jest.mock("../src/models/Customer");

const paymentRepository = require("../src/repositories/payment.repository");
const orderRepository = require("../src/repositories/order.repository");
const razorpayProvider = require("../src/integrations/payments/razorpay.provider");
const orderService = require("../src/services/order.service");
const Customer = require("../src/models/Customer");

const paymentService = require("../src/services/payment.service");
const paymentOrphanRecoveryService = require("../src/services/payment-orphan-recovery.service");
const paymentReconciliationService = require("../src/services/payment-reconciliation.service");
const actualRazorpayProvider = jest.requireActual(
  "../src/integrations/payments/razorpay.provider"
);

describe("Task 8B.5.11 — Durable Receipt-Based Orphan Recovery", () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const orderId = new mongoose.Types.ObjectId().toString();
  const paymentId = new mongoose.Types.ObjectId().toString();
  const customerId = new mongoose.Types.ObjectId().toString();
  const idempotencyKey = "test-idempotency-key-12345";
  const orderNumber = "BB-2026-99999";
  const gatewayOrderId = "order_RZP12345678";
  const gatewayPaymentId = "pay_RZP87654321";

  let mockOrder;
  let mockCustomer;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOrder = {
      _id: orderId,
      customerId,
      orderNumber,
      grandTotal: "2799.00",
      currency: "INR",
      status: "pending",
      paymentStatus: "unpaid",
    };

    mockCustomer = {
      _id: customerId,
      userId,
      isActive: true,
      deletedAt: null,
    };

    Customer.findOne.mockResolvedValue(mockCustomer);
    orderRepository.findById.mockResolvedValue(mockOrder);
    orderRepository.transitionStatusIfCurrent.mockImplementation((id, expectedStatus, data) => {
      return Promise.resolve({ ...mockOrder, ...data });
    });
    orderService.markOrderPaymentCaptured.mockResolvedValue({
      _id: orderId,
      status: "confirmed",
      paymentStatus: "paid",
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe("1. Receipt Generation & Pre-Persistence", () => {
    it("Test A: persists receipt in local Payment before calling razorpayProvider.createOrder", async () => {
      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(null);
      paymentRepository.findActiveByOrderId.mockResolvedValue(null);

      let persistedReceipt = null;
      paymentRepository.create.mockImplementation(async (paymentData) => {
        persistedReceipt = paymentData.receipt;
        return {
          _id: paymentId,
          ...paymentData,
        };
      });

      let gatewayCallReceipt = null;
      razorpayProvider.createOrder.mockImplementation(async (orderParams) => {
        gatewayCallReceipt = orderParams.receipt;
        return {
          id: gatewayOrderId,
          status: "created",
          amount: 279900,
          currency: "INR",
          receipt: orderParams.receipt,
        };
      });

      paymentRepository.updateById.mockResolvedValue({
        _id: paymentId,
        orderId,
        gatewayOrderId,
        status: "created",
        receipt: persistedReceipt,
      });

      await paymentService.createPaymentForOrder(orderId, userId, idempotencyKey);

      // Verify receipt was populated in create call
      expect(persistedReceipt).toBeTruthy();
      expect(typeof persistedReceipt).toBe("string");
      expect(persistedReceipt.startsWith("BB-")).toBe(true);
      expect(persistedReceipt.length).toBeLessThanOrEqual(40);

      // Verify createOrder received the exact same persisted receipt
      expect(gatewayCallReceipt).toBe(persistedReceipt);

      // Verify ordering: paymentRepository.create must be called before createOrder
      const createOrderCallOrder = razorpayProvider.createOrder.mock.invocationCallOrder[0];
      const paymentCreateCallOrder = paymentRepository.create.mock.invocationCallOrder[0];
      expect(paymentCreateCallOrder).toBeLessThan(createOrderCallOrder);
    });

    it("Test B: generates unique receipts for separate Payment attempts on the same Order", async () => {
      const receipt1 = paymentService.generateReceipt(orderNumber);
      const receipt2 = paymentService.generateReceipt(orderNumber);

      expect(receipt1).toBeTruthy();
      expect(receipt2).toBeTruthy();
      expect(receipt1).not.toBe(receipt2);
      expect(receipt1.length).toBeLessThanOrEqual(40);
      expect(receipt2.length).toBeLessThanOrEqual(40);
    });

    it("Test C: retry on an existing active Payment reuses persisted receipt and never mutates it", async () => {
      const persistedReceipt = "BB-2026-99999-ABCD1234";
      const existingPayment = {
        _id: paymentId,
        orderId,
        gateway: "razorpay",
        gatewayOrderId,
        status: "created",
        receipt: persistedReceipt,
      };

      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(existingPayment);
      paymentRepository.findById.mockResolvedValue(existingPayment);

      razorpayProvider.fetchOrder.mockResolvedValue({
        id: gatewayOrderId,
        status: "created",
        amount: 279900,
        currency: "INR",
        notes: { buyboxOrderId: orderId },
      });

      const result = await paymentService.createPaymentForOrder(orderId, userId, idempotencyKey);

      expect(result.receipt).toBe(persistedReceipt);
      expect(razorpayProvider.createOrder).not.toHaveBeenCalled();
    });
  });

  describe("2. Targeted Receipt Lookup via Provider", () => {
    it("Test D: fetchOrdersByReceipt sends exact receipt filter and does NOT perform broad scan", async () => {
      const testReceipt = "BB-2026-99999-ABCD1234";
      const { razorpay } = require("../src/config/payment");

      // Mock razorpay.orders.all directly
      razorpay.orders.all = jest.fn().mockResolvedValue({
        entity: "collection",
        count: 1,
        items: [
          {
            id: gatewayOrderId,
            receipt: testReceipt,
            amount: 279900,
            currency: "INR",
          },
        ],
      });

      const response = await actualRazorpayProvider.fetchOrdersByReceipt(testReceipt);

      expect(razorpay.orders.all).toHaveBeenCalledWith({
        receipt: testReceipt,
      });
      expect(response.items).toHaveLength(1);
    });

    it("Test D-2: fetchOrdersByReceipt rejects invalid or empty receipt", async () => {
      await expect(actualRazorpayProvider.fetchOrdersByReceipt("")).rejects.toThrow(
        "Invalid receipt identifier"
      );
      await expect(actualRazorpayProvider.fetchOrdersByReceipt(null)).rejects.toThrow(
        "Invalid receipt identifier"
      );
    });

    it("Test D-3: fetchOrdersByReceipt sanitizes gateway errors into 502", async () => {
      const { razorpay } = require("../src/config/payment");
      razorpay.orders.all = jest.fn().mockRejectedValue(new Error("Gateway 500 error"));

      await expect(
        actualRazorpayProvider.fetchOrdersByReceipt("BB-2026-99999-ABCD1234")
      ).rejects.toThrow("Unable to fetch Razorpay orders by receipt");
    });
  });

  describe("3. Orphan Recovery Validation & Linking", () => {
    const testReceipt = "BB-2026-99999-ABCD1234";

    it("Test E: recovers orphan with matching receipt and links gatewayOrderId without calling createOrder", async () => {
      const orphanPayment = {
        _id: paymentId,
        orderId,
        gateway: "razorpay",
        gatewayOrderId: null,
        status: "created",
        receipt: testReceipt,
      };

      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(orphanPayment);
      paymentRepository.findActiveByOrderId.mockResolvedValue(orphanPayment);

      razorpayProvider.fetchOrdersByReceipt.mockResolvedValue({
        entity: "collection",
        count: 1,
        items: [
          {
            id: gatewayOrderId,
            receipt: testReceipt,
            amount: 279900,
            currency: "INR",
            status: "created",
            notes: {
              buyboxOrderId: orderId,
              orderNumber,
            },
          },
        ],
      });

      const linkedPayment = {
        ...orphanPayment,
        gatewayOrderId,
      };

      paymentRepository.linkOrphanGatewayOrderId.mockResolvedValue(linkedPayment);

      const result = await paymentService.createPaymentForOrder(orderId, userId, idempotencyKey);

      expect(paymentRepository.linkOrphanGatewayOrderId).toHaveBeenCalledWith(
        paymentId,
        gatewayOrderId
      );
      expect(razorpayProvider.createOrder).not.toHaveBeenCalled();
      expect(result.gatewayOrderId).toBe(gatewayOrderId);
    });

    it("Test F: fails closed when recovered order buyboxOrderId mismatches", async () => {
      const orphanPayment = {
        _id: paymentId,
        orderId,
        gateway: "razorpay",
        gatewayOrderId: null,
        status: "created",
        receipt: testReceipt,
      };

      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(orphanPayment);

      razorpayProvider.fetchOrdersByReceipt.mockResolvedValue({
        entity: "collection",
        count: 1,
        items: [
          {
            id: gatewayOrderId,
            receipt: testReceipt,
            amount: 279900,
            currency: "INR",
            status: "created",
            notes: {
              buyboxOrderId: "different-buybox-order-id",
              orderNumber,
            },
          },
        ],
      });

      await expect(
        paymentService.createPaymentForOrder(orderId, userId, idempotencyKey)
      ).rejects.toThrow("Payment creation is currently in progress for this order");

      expect(paymentRepository.linkOrphanGatewayOrderId).not.toHaveBeenCalled();
    });

    it("Test G: fails closed when notes.orderNumber mismatches", async () => {
      const orphanPayment = {
        _id: paymentId,
        orderId,
        gateway: "razorpay",
        gatewayOrderId: null,
        status: "created",
        receipt: testReceipt,
      };

      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(orphanPayment);

      razorpayProvider.fetchOrdersByReceipt.mockResolvedValue({
        entity: "collection",
        count: 1,
        items: [
          {
            id: gatewayOrderId,
            receipt: testReceipt,
            amount: 279900,
            currency: "INR",
            status: "created",
            notes: {
              buyboxOrderId: orderId,
              orderNumber: "DIFFERENT-ORDER-NUM",
            },
          },
        ],
      });

      await expect(
        paymentService.createPaymentForOrder(orderId, userId, idempotencyKey)
      ).rejects.toThrow("Payment creation is currently in progress for this order");

      expect(paymentRepository.linkOrphanGatewayOrderId).not.toHaveBeenCalled();
    });

    it("Test H: fails closed when amount mismatches", async () => {
      const orphanPayment = {
        _id: paymentId,
        orderId,
        gateway: "razorpay",
        gatewayOrderId: null,
        status: "created",
        receipt: testReceipt,
      };

      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(orphanPayment);

      razorpayProvider.fetchOrdersByReceipt.mockResolvedValue({
        entity: "collection",
        count: 1,
        items: [
          {
            id: gatewayOrderId,
            receipt: testReceipt,
            amount: 999900, // wrong amount
            currency: "INR",
            status: "created",
            notes: { buyboxOrderId: orderId },
          },
        ],
      });

      await expect(
        paymentService.createPaymentForOrder(orderId, userId, idempotencyKey)
      ).rejects.toThrow("Payment creation is currently in progress for this order");

      expect(paymentRepository.linkOrphanGatewayOrderId).not.toHaveBeenCalled();
    });

    it("Test I: fails closed when currency mismatches", async () => {
      const orphanPayment = {
        _id: paymentId,
        orderId,
        gateway: "razorpay",
        gatewayOrderId: null,
        status: "created",
        receipt: testReceipt,
      };

      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(orphanPayment);

      razorpayProvider.fetchOrdersByReceipt.mockResolvedValue({
        entity: "collection",
        count: 1,
        items: [
          {
            id: gatewayOrderId,
            receipt: testReceipt,
            amount: 279900,
            currency: "USD", // wrong currency
            status: "created",
            notes: { buyboxOrderId: orderId },
          },
        ],
      });

      await expect(
        paymentService.createPaymentForOrder(orderId, userId, idempotencyKey)
      ).rejects.toThrow("Payment creation is currently in progress for this order");

      expect(paymentRepository.linkOrphanGatewayOrderId).not.toHaveBeenCalled();
    });

    it("Test J: fails closed when receipt query returns multiple candidates", async () => {
      const orphanPayment = {
        _id: paymentId,
        orderId,
        gateway: "razorpay",
        gatewayOrderId: null,
        status: "created",
        receipt: testReceipt,
      };

      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(orphanPayment);

      razorpayProvider.fetchOrdersByReceipt.mockResolvedValue({
        entity: "collection",
        count: 2,
        items: [
          { id: "order_1", receipt: testReceipt, amount: 279900, currency: "INR" },
          { id: "order_2", receipt: testReceipt, amount: 279900, currency: "INR" },
        ],
      });

      await expect(
        paymentService.createPaymentForOrder(orderId, userId, idempotencyKey)
      ).rejects.toThrow("Payment creation is currently in progress for this order");

      expect(paymentRepository.linkOrphanGatewayOrderId).not.toHaveBeenCalled();
    });

    it("Test K: preserves active Payment and fails closed when zero candidates are returned", async () => {
      const orphanPayment = {
        _id: paymentId,
        orderId,
        gateway: "razorpay",
        gatewayOrderId: null,
        status: "created",
        receipt: testReceipt,
      };

      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(orphanPayment);

      razorpayProvider.fetchOrdersByReceipt.mockResolvedValue({
        entity: "collection",
        count: 0,
        items: [],
      });

      await expect(
        paymentService.createPaymentForOrder(orderId, userId, idempotencyKey)
      ).rejects.toThrow("Payment creation is currently in progress for this order");

      // Verify payment was NOT updated to failed
      expect(paymentRepository.updateById).not.toHaveBeenCalled();
      expect(razorpayProvider.createOrder).not.toHaveBeenCalled();
    });

    it("Test L: preserves local Payment when gateway lookup throws network or 502 error", async () => {
      const orphanPayment = {
        _id: paymentId,
        orderId,
        gateway: "razorpay",
        gatewayOrderId: null,
        status: "created",
        receipt: testReceipt,
      };

      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(orphanPayment);

      razorpayProvider.fetchOrdersByReceipt.mockRejectedValue(
        new Error("Gateway connection timed out")
      );

      await expect(
        paymentService.createPaymentForOrder(orderId, userId, idempotencyKey)
      ).rejects.toThrow();

      // State remains untouched
      expect(paymentRepository.updateById).not.toHaveBeenCalled();
      expect(paymentRepository.linkOrphanGatewayOrderId).not.toHaveBeenCalled();
      expect(razorpayProvider.createOrder).not.toHaveBeenCalled();
    });
  });

  describe("4. Paid Recovery & Concurrency Handling", () => {
    const testReceipt = "BB-2026-99999-ABCD1234";

    it("Test M: recovered order with status 'paid' reconciles payment and marks order confirmed", async () => {
      const orphanPayment = {
        _id: paymentId,
        orderId,
        gateway: "razorpay",
        gatewayOrderId: null,
        status: "created",
        receipt: testReceipt,
      };

      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(orphanPayment);

      razorpayProvider.fetchOrdersByReceipt.mockResolvedValue({
        entity: "collection",
        count: 1,
        items: [
          {
            id: gatewayOrderId,
            receipt: testReceipt,
            amount: 279900,
            currency: "INR",
            status: "paid",
            notes: { buyboxOrderId: orderId },
          },
        ],
      });

      const linkedPayment = {
        ...orphanPayment,
        gatewayOrderId,
      };

      paymentRepository.linkOrphanGatewayOrderId.mockResolvedValue(linkedPayment);
      paymentRepository.findById.mockResolvedValue(linkedPayment);

      razorpayProvider.fetchOrderPayments.mockResolvedValue({
        entity: "collection",
        count: 1,
        items: [
          {
            id: gatewayPaymentId,
            order_id: gatewayOrderId,
            amount: 279900,
            currency: "INR",
            status: "captured",
            captured_at: Math.floor(Date.now() / 1000),
          },
        ],
      });

      paymentRepository.updateById.mockResolvedValue({
        ...linkedPayment,
        status: "captured",
        gatewayPaymentId,
      });

      const result = await paymentService.createPaymentForOrder(orderId, userId, idempotencyKey);

      expect(paymentRepository.linkOrphanGatewayOrderId).toHaveBeenCalledWith(
        paymentId,
        gatewayOrderId
      );
      expect(paymentRepository.updateById).toHaveBeenCalledWith(
        paymentId,
        expect.objectContaining({
          status: "captured",
          gatewayPaymentId,
        })
      );
      expect(orderService.markOrderPaymentCaptured).toHaveBeenCalledWith(orderId);
      expect(result.status).toBe("captured");
    });

    it("Test N: concurrent recovery converges safely on one gatewayOrderId", async () => {
      const orphanPayment = {
        _id: paymentId,
        orderId,
        gateway: "razorpay",
        gatewayOrderId: null,
        status: "created",
        receipt: testReceipt,
      };

      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(orphanPayment);

      razorpayProvider.fetchOrdersByReceipt.mockResolvedValue({
        entity: "collection",
        count: 1,
        items: [
          {
            id: gatewayOrderId,
            receipt: testReceipt,
            amount: 279900,
            currency: "INR",
            status: "created",
            notes: { buyboxOrderId: orderId },
          },
        ],
      });

      // Atomic link returns null because concurrent request linked it first
      paymentRepository.linkOrphanGatewayOrderId.mockResolvedValue(null);

      // Re-read returns the concurrently linked payment with matching gatewayOrderId
      const concurrentlyLinked = {
        ...orphanPayment,
        gatewayOrderId,
      };
      paymentRepository.findById.mockResolvedValue(concurrentlyLinked);

      const result = await paymentService.createPaymentForOrder(orderId, userId, idempotencyKey);

      expect(result.gatewayOrderId).toBe(gatewayOrderId);
      expect(razorpayProvider.createOrder).not.toHaveBeenCalled();
    });

    it("Test P: legacy null-receipt orphan fails closed safely without errors", async () => {
      const legacyPayment = {
        _id: paymentId,
        orderId,
        gateway: "razorpay",
        gatewayOrderId: null,
        status: "created",
        receipt: null, // legacy null receipt
      };

      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(legacyPayment);

      await expect(
        paymentService.createPaymentForOrder(orderId, userId, idempotencyKey)
      ).rejects.toThrow("Payment creation is currently in progress for this order");

      expect(razorpayProvider.fetchOrdersByReceipt).not.toHaveBeenCalled();
      expect(razorpayProvider.createOrder).not.toHaveBeenCalled();
    });
  });

  describe("5. Background Reconciliation Worker Integration", () => {
    const testReceipt = "BB-2026-99999-ABCD1234";

    it("Test R: reconciliation service discovers unlinked payment with receipt, recovers and captures", async () => {
      const unlinkedPayment = {
        _id: paymentId,
        orderId,
        gateway: "razorpay",
        gatewayOrderId: null,
        status: "created",
        receipt: testReceipt,
      };

      // Mock recovery service helper call
      razorpayProvider.fetchOrdersByReceipt.mockResolvedValue({
        entity: "collection",
        count: 1,
        items: [
          {
            id: gatewayOrderId,
            receipt: testReceipt,
            amount: 279900,
            currency: "INR",
            status: "paid",
            notes: { buyboxOrderId: orderId },
          },
        ],
      });

      const linkedPayment = {
        ...unlinkedPayment,
        gatewayOrderId,
      };

      paymentRepository.linkOrphanGatewayOrderId.mockResolvedValue(linkedPayment);
      paymentRepository.findById.mockResolvedValue(linkedPayment);

      razorpayProvider.fetchOrder.mockResolvedValue({
        id: gatewayOrderId,
        status: "paid",
        amount: 279900,
        currency: "INR",
        notes: { buyboxOrderId: orderId },
      });

      razorpayProvider.fetchOrderPayments.mockResolvedValue({
        entity: "collection",
        count: 1,
        items: [
          {
            id: gatewayPaymentId,
            order_id: gatewayOrderId,
            amount: 279900,
            currency: "INR",
            status: "captured",
          },
        ],
      });

      paymentRepository.reconcileActivePayment.mockResolvedValue({
        ...linkedPayment,
        status: "captured",
        gatewayPaymentId,
      });

      const result = await paymentReconciliationService.reconcilePayment(unlinkedPayment);

      expect(result.reconciled).toBe(true);
      expect(paymentRepository.linkOrphanGatewayOrderId).toHaveBeenCalledWith(
        paymentId,
        gatewayOrderId
      );
      expect(paymentRepository.reconcileActivePayment).toHaveBeenCalledWith(
        paymentId,
        expect.objectContaining({
          status: "captured",
          gatewayPaymentId,
        })
      );
      expect(orderService.markOrderPaymentCaptured).toHaveBeenCalledWith(orderId);
    });

    it("Test R-2: reconciliation service fails closed when unlinked payment has no receipt", async () => {
      const legacyUnlinked = {
        _id: paymentId,
        orderId,
        gateway: "razorpay",
        gatewayOrderId: null,
        status: "created",
        receipt: null,
      };

      const result = await paymentReconciliationService.reconcilePayment(legacyUnlinked);

      expect(result.reconciled).toBe(false);
      expect(result.reason).toBe("MISSING_GATEWAY_ORDER_ID");
      expect(razorpayProvider.fetchOrdersByReceipt).not.toHaveBeenCalled();
    });
  });
});
