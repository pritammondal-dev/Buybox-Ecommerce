jest.mock("../src/repositories/payment.repository");
jest.mock("../src/repositories/order.repository");
jest.mock("../src/integrations/payments/razorpay.provider");
jest.mock("../src/services/order.service");

const paymentRepository = require("../src/repositories/payment.repository");
const orderRepository = require("../src/repositories/order.repository");
const razorpayProvider = require("../src/integrations/payments/razorpay.provider");
const orderService = require("../src/services/order.service");

const paymentReconciliationService = require("../src/services/payment-reconciliation.service");
const {
  processPaymentReconciliationBatch,
  runPaymentReconciliationScheduler,
  stopPaymentReconciliationScheduler,
} = require("../src/workers/payment-reconciliation.worker");

describe("Task 8B.5.6 — Background Payment Reconciliation Worker", () => {
  const orderId = "64b0f0000000000000000001";
  const paymentId = "64b0f0000000000000000002";
  const gatewayOrderId = "order_rzp_rec_001";
  const gatewayPaymentId = "pay_rzp_rec_captured_001";

  let mockOrder;
  let mockPayment;

  beforeEach(() => {
    jest.clearAllMocks();
    stopPaymentReconciliationScheduler();

    mockOrder = {
      _id: orderId,
      orderNumber: "BB-ORD-1001",
      grandTotal: "2500.00",
      currency: "INR",
      paymentStatus: "pending",
      status: "pending",
    };

    mockPayment = {
      _id: paymentId,
      orderId,
      gateway: "razorpay",
      gatewayOrderId,
      gatewayPaymentId: null,
      amount: "2500.00",
      currency: "INR",
      status: "created",
      createdAt: new Date(Date.now() - 300000),
    };

    orderRepository.findById.mockResolvedValue(mockOrder);
    paymentRepository.findById.mockResolvedValue(mockPayment);
    paymentRepository.findEligibleForReconciliation.mockResolvedValue([mockPayment]);
  });

  afterEach(() => {
    stopPaymentReconciliationScheduler();
  });

  describe("1. Gateway-paid payment is reconciled successfully", () => {
    it("reconciles active payment when gateway order is paid and concrete captured payment exists", async () => {
      razorpayProvider.fetchOrder.mockResolvedValue({
        id: gatewayOrderId,
        status: "paid",
        amount: 250000,
        currency: "INR",
        notes: {
          buyboxOrderId: orderId,
          orderNumber: "BB-ORD-1001",
        },
      });

      razorpayProvider.fetchOrderPayments.mockResolvedValue({
        entity: "collection",
        count: 1,
        items: [
          {
            id: gatewayPaymentId,
            order_id: gatewayOrderId,
            status: "captured",
            amount: 250000,
            currency: "INR",
            method: "upi",
            captured_at: 1726000000,
          },
        ],
      });

      paymentRepository.reconcileActivePayment.mockResolvedValue({
        ...mockPayment,
        status: "captured",
        gatewayPaymentId,
      });

      const batchResult = await processPaymentReconciliationBatch();

      expect(batchResult.scanned).toBe(1);
      expect(batchResult.reconciled).toBe(1);
      expect(batchResult.skipped).toBe(0);
      expect(batchResult.failed).toBe(0);

      expect(razorpayProvider.fetchOrder).toHaveBeenCalledWith(gatewayOrderId);
      expect(razorpayProvider.fetchOrderPayments).toHaveBeenCalledWith(gatewayOrderId);
      expect(paymentRepository.reconcileActivePayment).toHaveBeenCalledWith(
        paymentId,
        expect.objectContaining({
          status: "captured",
          gatewayPaymentId,
          method: "upi",
          failureReason: null,
        })
      );
      expect(orderService.markOrderPaymentCaptured).toHaveBeenCalledWith(orderId);
    });
  });

  describe("2. Lost webhook recovery", () => {
    it("recovers a pending payment whose webhook was lost, transitioning payment and order to captured/paid", async () => {
      const lostWebhookPayment = {
        ...mockPayment,
        status: "pending",
      };

      paymentRepository.findEligibleForReconciliation.mockResolvedValue([lostWebhookPayment]);
      paymentRepository.findById.mockResolvedValue(lostWebhookPayment);

      razorpayProvider.fetchOrder.mockResolvedValue({
        id: gatewayOrderId,
        status: "paid",
        amount: 250000,
        currency: "INR",
        notes: {
          buyboxOrderId: orderId,
        },
      });

      razorpayProvider.fetchOrderPayments.mockResolvedValue({
        entity: "collection",
        count: 1,
        items: [
          {
            id: "pay_rzp_recovered_999",
            status: "captured",
            amount: 250000,
            currency: "INR",
            method: "card",
          },
        ],
      });

      paymentRepository.reconcileActivePayment.mockResolvedValue({
        ...lostWebhookPayment,
        status: "captured",
        gatewayPaymentId: "pay_rzp_recovered_999",
      });

      const result = await paymentReconciliationService.reconcilePayment(lostWebhookPayment);

      expect(result.reconciled).toBe(true);
      expect(paymentRepository.reconcileActivePayment).toHaveBeenCalledWith(
        paymentId,
        expect.objectContaining({
          status: "captured",
          gatewayPaymentId: "pay_rzp_recovered_999",
        })
      );
      expect(orderService.markOrderPaymentCaptured).toHaveBeenCalledWith(orderId);
    });
  });

  describe("3. Missing captured payment fails closed", () => {
    it("fails closed without modifying payment when gateway order is paid but no captured payment item exists", async () => {
      razorpayProvider.fetchOrder.mockResolvedValue({
        id: gatewayOrderId,
        status: "paid",
        amount: 250000,
        currency: "INR",
        notes: {
          buyboxOrderId: orderId,
        },
      });

      // Gateway reports order paid, but payment listing returns only failed / authorized items
      razorpayProvider.fetchOrderPayments.mockResolvedValue({
        entity: "collection",
        count: 2,
        items: [
          {
            id: "pay_failed_1",
            status: "failed",
            amount: 250000,
            currency: "INR",
          },
          {
            id: "pay_authorized_1",
            status: "authorized",
            amount: 250000,
            currency: "INR",
          },
        ],
      });

      const batchResult = await processPaymentReconciliationBatch();

      expect(batchResult.reconciled).toBe(0);
      expect(batchResult.skipped).toBe(1);
      expect(paymentRepository.reconcileActivePayment).not.toHaveBeenCalled();
      expect(paymentRepository.updateById).not.toHaveBeenCalled();
      expect(orderService.markOrderPaymentCaptured).not.toHaveBeenCalled();
    });

    it("fails closed when payment item has empty or whitespace-only ID", async () => {
      razorpayProvider.fetchOrder.mockResolvedValue({
        id: gatewayOrderId,
        status: "paid",
        amount: 250000,
        currency: "INR",
        notes: {
          buyboxOrderId: orderId,
        },
      });

      razorpayProvider.fetchOrderPayments.mockResolvedValue({
        entity: "collection",
        count: 1,
        items: [
          {
            id: "   ",
            status: "captured",
            amount: 250000,
            currency: "INR",
          },
        ],
      });

      const batchResult = await processPaymentReconciliationBatch();

      expect(batchResult.reconciled).toBe(0);
      expect(batchResult.skipped).toBe(1);
      expect(paymentRepository.reconcileActivePayment).not.toHaveBeenCalled();
      expect(orderService.markOrderPaymentCaptured).not.toHaveBeenCalled();
    });

    it("fails closed without failing local payment when gateway order is still created or attempted", async () => {
      razorpayProvider.fetchOrder.mockResolvedValue({
        id: gatewayOrderId,
        status: "attempted",
        amount: 250000,
        currency: "INR",
        notes: {
          buyboxOrderId: orderId,
        },
      });

      const batchResult = await processPaymentReconciliationBatch();

      expect(batchResult.reconciled).toBe(0);
      expect(batchResult.skipped).toBe(1);
      expect(razorpayProvider.fetchOrderPayments).not.toHaveBeenCalled();
      expect(paymentRepository.reconcileActivePayment).not.toHaveBeenCalled();
      expect(paymentRepository.updateById).not.toHaveBeenCalled();
      expect(orderService.markOrderPaymentCaptured).not.toHaveBeenCalled();
    });
  });

  describe("4. Gateway/API failure does not corrupt local state", () => {
    it("fails closed safely when fetchOrder throws a gateway error", async () => {
      razorpayProvider.fetchOrder.mockRejectedValue(
        new Error("Razorpay gateway timeout 504")
      );

      const batchResult = await processPaymentReconciliationBatch();

      expect(batchResult.reconciled).toBe(0);
      expect(batchResult.skipped).toBe(1);
      expect(paymentRepository.reconcileActivePayment).not.toHaveBeenCalled();
      expect(paymentRepository.updateById).not.toHaveBeenCalled();
      expect(orderService.markOrderPaymentCaptured).not.toHaveBeenCalled();
    });

    it("fails closed safely when fetchOrderPayments throws a gateway error", async () => {
      razorpayProvider.fetchOrder.mockResolvedValue({
        id: gatewayOrderId,
        status: "paid",
        amount: 250000,
        currency: "INR",
        notes: {
          buyboxOrderId: orderId,
        },
      });

      razorpayProvider.fetchOrderPayments.mockRejectedValue(
        new Error("Razorpay internal API failure 502")
      );

      const batchResult = await processPaymentReconciliationBatch();

      expect(batchResult.reconciled).toBe(0);
      expect(batchResult.skipped).toBe(1);
      expect(paymentRepository.reconcileActivePayment).not.toHaveBeenCalled();
      expect(paymentRepository.updateById).not.toHaveBeenCalled();
      expect(orderService.markOrderPaymentCaptured).not.toHaveBeenCalled();
    });
  });

  describe("5. Amount/currency mismatch fails closed", () => {
    it("fails closed when gateway order amount does not match local order grandTotal", async () => {
      razorpayProvider.fetchOrder.mockResolvedValue({
        id: gatewayOrderId,
        status: "paid",
        amount: 999900, // mismatch
        currency: "INR",
        notes: {
          buyboxOrderId: orderId,
        },
      });

      const batchResult = await processPaymentReconciliationBatch();

      expect(batchResult.reconciled).toBe(0);
      expect(batchResult.skipped).toBe(1);
      expect(razorpayProvider.fetchOrderPayments).not.toHaveBeenCalled();
      expect(paymentRepository.reconcileActivePayment).not.toHaveBeenCalled();
    });

    it("fails closed when gateway order currency does not match local order currency", async () => {
      razorpayProvider.fetchOrder.mockResolvedValue({
        id: gatewayOrderId,
        status: "paid",
        amount: 250000,
        currency: "USD", // mismatch: local order is INR
        notes: {
          buyboxOrderId: orderId,
        },
      });

      const batchResult = await processPaymentReconciliationBatch();

      expect(batchResult.reconciled).toBe(0);
      expect(batchResult.skipped).toBe(1);
      expect(razorpayProvider.fetchOrderPayments).not.toHaveBeenCalled();
      expect(paymentRepository.reconcileActivePayment).not.toHaveBeenCalled();
    });

    it("fails closed when gateway order notes buyboxOrderId does not match order ID", async () => {
      razorpayProvider.fetchOrder.mockResolvedValue({
        id: gatewayOrderId,
        status: "paid",
        amount: 250000,
        currency: "INR",
        notes: {
          buyboxOrderId: "different_order_999", // identity mismatch
        },
      });

      const batchResult = await processPaymentReconciliationBatch();

      expect(batchResult.reconciled).toBe(0);
      expect(batchResult.skipped).toBe(1);
      expect(razorpayProvider.fetchOrderPayments).not.toHaveBeenCalled();
      expect(paymentRepository.reconcileActivePayment).not.toHaveBeenCalled();
    });

    it("fails closed when captured payment amount does not match expected order amount", async () => {
      razorpayProvider.fetchOrder.mockResolvedValue({
        id: gatewayOrderId,
        status: "paid",
        amount: 250000,
        currency: "INR",
        notes: {
          buyboxOrderId: orderId,
        },
      });

      razorpayProvider.fetchOrderPayments.mockResolvedValue({
        entity: "collection",
        count: 1,
        items: [
          {
            id: gatewayPaymentId,
            status: "captured",
            amount: 150000, // mismatch: expected 250000
            currency: "INR",
          },
        ],
      });

      const batchResult = await processPaymentReconciliationBatch();

      expect(batchResult.reconciled).toBe(0);
      expect(batchResult.skipped).toBe(1);
      expect(paymentRepository.reconcileActivePayment).not.toHaveBeenCalled();
    });

    it("fails closed when captured payment currency does not match expected currency", async () => {
      razorpayProvider.fetchOrder.mockResolvedValue({
        id: gatewayOrderId,
        status: "paid",
        amount: 250000,
        currency: "INR",
        notes: {
          buyboxOrderId: orderId,
        },
      });

      razorpayProvider.fetchOrderPayments.mockResolvedValue({
        entity: "collection",
        count: 1,
        items: [
          {
            id: gatewayPaymentId,
            status: "captured",
            amount: 250000,
            currency: "EUR", // mismatch: expected INR
          },
        ],
      });

      const batchResult = await processPaymentReconciliationBatch();

      expect(batchResult.reconciled).toBe(0);
      expect(batchResult.skipped).toBe(1);
      expect(paymentRepository.reconcileActivePayment).not.toHaveBeenCalled();
    });
  });

  describe("6. Duplicate worker execution does not duplicate side effects", () => {
    it("handles already captured payment idempotently without re-updating payment", async () => {
      const alreadyCapturedPayment = {
        ...mockPayment,
        status: "captured",
        gatewayPaymentId,
      };

      paymentRepository.findById.mockResolvedValue(alreadyCapturedPayment);

      razorpayProvider.fetchOrder.mockResolvedValue({
        id: gatewayOrderId,
        status: "paid",
        amount: 250000,
        currency: "INR",
        notes: {
          buyboxOrderId: orderId,
        },
      });

      razorpayProvider.fetchOrderPayments.mockResolvedValue({
        entity: "collection",
        count: 1,
        items: [
          {
            id: gatewayPaymentId,
            status: "captured",
            amount: 250000,
            currency: "INR",
          },
        ],
      });

      const result = await paymentReconciliationService.reconcilePayment(mockPayment);

      expect(result.reconciled).toBe(true);
      expect(result.alreadyCaptured).toBe(true);
      expect(paymentRepository.reconcileActivePayment).not.toHaveBeenCalled();
      expect(orderService.markOrderPaymentCaptured).toHaveBeenCalledWith(orderId);
    });

    it("worker reentrancy guard: concurrent execution returns ALREADY_PROCESSING", async () => {
      const slowServiceSpy = jest
        .spyOn(paymentReconciliationService, "reconcileActivePaymentsBatch")
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve({ scanned: 1, reconciled: 1 }), 60))
        );

      const run1 = processPaymentReconciliationBatch();
      const run2 = processPaymentReconciliationBatch();

      const [res1, res2] = await Promise.all([run1, run2]);

      expect(res1.reconciled).toBe(1);
      expect(res2).toEqual({ skipped: true, reason: "ALREADY_PROCESSING" });

      slowServiceSpy.mockRestore();
    });
  });

  describe("7. Worker does not create another gateway order", () => {
    it("never calls razorpayProvider.createOrder under any condition", async () => {
      razorpayProvider.fetchOrder.mockResolvedValue({
        id: gatewayOrderId,
        status: "paid",
        amount: 250000,
        currency: "INR",
        notes: {
          buyboxOrderId: orderId,
        },
      });

      razorpayProvider.fetchOrderPayments.mockResolvedValue({
        entity: "collection",
        count: 1,
        items: [
          {
            id: gatewayPaymentId,
            status: "captured",
            amount: 250000,
            currency: "INR",
          },
        ],
      });

      paymentRepository.reconcileActivePayment.mockResolvedValue({
        ...mockPayment,
        status: "captured",
        gatewayPaymentId,
      });

      await processPaymentReconciliationBatch();

      expect(razorpayProvider.createOrder).not.toHaveBeenCalled();
    });
  });

  describe("8. Worker shutdown/overlap behavior", () => {
    it("starts and stops scheduler cleanly without overlapping timers", () => {
      jest.useFakeTimers();

      const batchSpy = jest
        .spyOn(paymentReconciliationService, "reconcileActivePaymentsBatch")
        .mockResolvedValue({ scanned: 0, reconciled: 0, skipped: 0, failed: 0 });

      runPaymentReconciliationScheduler();
      // Second call should be a no-op
      runPaymentReconciliationScheduler();

      jest.advanceTimersByTime(60000);
      expect(batchSpy).toHaveBeenCalledTimes(1);

      stopPaymentReconciliationScheduler();

      jest.advanceTimersByTime(120000);
      // No more executions after stop
      expect(batchSpy).toHaveBeenCalledTimes(1);

      batchSpy.mockRestore();
      jest.useRealTimers();
    });
  });
});
