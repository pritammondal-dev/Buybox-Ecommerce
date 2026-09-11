jest.mock("../src/repositories/order.repository");
jest.mock("../src/repositories/payment.repository");
jest.mock("../src/repositories/refund.repository");
jest.mock("../src/integrations/payments/razorpay.provider");
jest.mock("../src/services/order.service");
jest.mock("../src/models/Customer");

const orderRepository = require("../src/repositories/order.repository");
const paymentRepository = require("../src/repositories/payment.repository");
const razorpayProvider = require("../src/integrations/payments/razorpay.provider");
const orderService = require("../src/services/order.service");
const Customer = require("../src/models/Customer");

const {
  createPaymentForOrder,
} = require("../src/services/payment.service");

describe("Task 8B.5.5 — Active Payment Reuse & Razorpay Payment Listing", () => {
  const customerId = "customer-123";
  const userId = "user-123";
  const orderId = "order-123";

  let mockCustomer;
  let mockOrder;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCustomer = {
      _id: customerId,
      userId,
      isActive: true,
      deletedAt: null,
    };

    mockOrder = {
      _id: orderId,
      customerId,
      orderNumber: "BB-TEST-001",
      grandTotal: "2500.00",
      currency: "INR",
      paymentStatus: "pending",
      status: "pending",
    };

    Customer.findOne.mockResolvedValue(mockCustomer);
    orderRepository.findById.mockResolvedValue(mockOrder);
  });

  describe("Provider: fetchOrderPayments", () => {
    const actualProvider = jest.requireActual(
      "../src/integrations/payments/razorpay.provider"
    );
    const { razorpay } = require("../src/config/payment");

    it("rejects invalid order IDs with 400 INVALID_GATEWAY_ORDER_ID", async () => {
      await expect(actualProvider.fetchOrderPayments(null)).rejects.toMatchObject({
        statusCode: 400,
        code: "INVALID_GATEWAY_ORDER_ID",
      });

      await expect(actualProvider.fetchOrderPayments("")).rejects.toMatchObject({
        statusCode: 400,
        code: "INVALID_GATEWAY_ORDER_ID",
      });

      await expect(actualProvider.fetchOrderPayments("   ")).rejects.toMatchObject({
        statusCode: 400,
        code: "INVALID_GATEWAY_ORDER_ID",
      });

      await expect(actualProvider.fetchOrderPayments(12345)).rejects.toMatchObject({
        statusCode: 400,
        code: "INVALID_GATEWAY_ORDER_ID",
      });
    });

    it("sanitizes gateway errors into 502 RAZORPAY_ORDER_PAYMENTS_FETCH_FAILED", async () => {
      const fetchPaymentsSpy = jest
        .spyOn(razorpay.orders, "fetchPayments")
        .mockRejectedValue(new Error("Raw Razorpay internal gateway failure"));

      await expect(
        actualProvider.fetchOrderPayments("order_test_123")
      ).rejects.toMatchObject({
        statusCode: 502,
        code: "RAZORPAY_ORDER_PAYMENTS_FETCH_FAILED",
      });

      fetchPaymentsSpy.mockRestore();
    });

    it("returns fetched payments collection on success", async () => {
      const mockPayments = {
        entity: "collection",
        count: 1,
        items: [
          {
            id: "pay_test_123",
            order_id: "order_test_123",
            status: "captured",
            amount: 250000,
          },
        ],
      };

      const fetchPaymentsSpy = jest
        .spyOn(razorpay.orders, "fetchPayments")
        .mockResolvedValue(mockPayments);

      const result = await actualProvider.fetchOrderPayments("order_test_123");
      expect(result).toEqual(mockPayments);

      fetchPaymentsSpy.mockRestore();
    });
  });

  describe("Active Payment Reuse", () => {
    it("reuses active payment when retrying with a different key and gateway order is 'created'", async () => {
      const activePayment = {
        _id: "pay-active-1",
        orderId,
        customerId,
        amount: "2500.00",
        currency: "INR",
        status: "created",
        gatewayOrderId: "order_rzp_active_1",
        idempotencyKey: "original-key-11111",
      };

      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(null);
      paymentRepository.findActiveByOrderId.mockResolvedValue(activePayment);

      razorpayProvider.fetchOrder.mockResolvedValue({
        id: "order_rzp_active_1",
        status: "created",
        amount: 250000,
        currency: "INR",
        notes: {
          buyboxOrderId: orderId,
        },
      });

      const result = await createPaymentForOrder(
        orderId,
        userId,
        "different-retry-key-22222"
      );

      expect(result).toBe(activePayment);
      expect(razorpayProvider.fetchOrder).toHaveBeenCalledWith("order_rzp_active_1");
      expect(paymentRepository.create).not.toHaveBeenCalled();
      expect(razorpayProvider.createOrder).not.toHaveBeenCalled();
    });

    it("reuses active payment when retrying with a different key and gateway order is 'attempted'", async () => {
      const activePayment = {
        _id: "pay-active-2",
        orderId,
        customerId,
        amount: "2500.00",
        currency: "INR",
        status: "pending",
        gatewayOrderId: "order_rzp_attempted_1",
        idempotencyKey: "original-key-11111",
      };

      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(null);
      paymentRepository.findActiveByOrderId.mockResolvedValue(activePayment);

      razorpayProvider.fetchOrder.mockResolvedValue({
        id: "order_rzp_attempted_1",
        status: "attempted",
        amount: 250000,
        currency: "INR",
        notes: {
          buyboxOrderId: orderId,
        },
      });

      const result = await createPaymentForOrder(
        orderId,
        userId,
        "new-key-after-fail-attempt"
      );

      expect(result).toBe(activePayment);
      expect(paymentRepository.create).not.toHaveBeenCalled();
      expect(razorpayProvider.createOrder).not.toHaveBeenCalled();
    });

    it("preserves same-key replay behavior and reuses existing payment", async () => {
      const sameKeyPayment = {
        _id: "pay-same-key",
        orderId,
        customerId,
        amount: "2500.00",
        currency: "INR",
        status: "created",
        gatewayOrderId: "order_rzp_same",
        idempotencyKey: "same-idempotency-key",
      };

      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(sameKeyPayment);
      razorpayProvider.fetchOrder.mockResolvedValue({
        id: "order_rzp_same",
        status: "created",
        amount: 250000,
        currency: "INR",
        notes: {
          buyboxOrderId: orderId,
        },
      });

      const result = await createPaymentForOrder(
        orderId,
        userId,
        "same-idempotency-key"
      );

      expect(result).toBe(sameKeyPayment);
      expect(paymentRepository.create).not.toHaveBeenCalled();
      expect(razorpayProvider.createOrder).not.toHaveBeenCalled();
    });

    it("preserves 409 PAYMENT_ALREADY_AUTHORIZED if active payment is authorized", async () => {
      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(null);
      paymentRepository.findActiveByOrderId.mockResolvedValue({
        _id: "pay-auth",
        orderId,
        status: "authorized",
        gatewayOrderId: "order_rzp_auth",
        idempotencyKey: "first-key",
      });

      await expect(
        createPaymentForOrder(orderId, userId, "retry-key-after-auth")
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "PAYMENT_ALREADY_AUTHORIZED",
      });

      expect(razorpayProvider.createOrder).not.toHaveBeenCalled();
    });

    it("preserves 409 PAYMENT_CREATION_IN_PROGRESS if active payment has null gatewayOrderId", async () => {
      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(null);
      paymentRepository.findActiveByOrderId.mockResolvedValue({
        _id: "pay-inflight",
        orderId,
        status: "created",
        gatewayOrderId: null,
        idempotencyKey: "first-key",
      });

      await expect(
        createPaymentForOrder(orderId, userId, "retry-key-while-inflight")
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "PAYMENT_CREATION_IN_PROGRESS",
      });

      expect(razorpayProvider.createOrder).not.toHaveBeenCalled();
    });
  });

  describe("Paid Gateway Order Reconciliation", () => {
    it("reconciles payment and synchronizes order when gateway order reports status 'paid'", async () => {
      const activePayment = {
        _id: "pay-to-reconcile",
        orderId,
        customerId,
        amount: "2500.00",
        currency: "INR",
        status: "created",
        gatewayOrderId: "order_rzp_paid_123",
        idempotencyKey: "key-12345678",
      };

      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(null);
      paymentRepository.findActiveByOrderId.mockResolvedValue(activePayment);

      razorpayProvider.fetchOrder.mockResolvedValue({
        id: "order_rzp_paid_123",
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
            id: "pay_gateway_captured_999",
            status: "captured",
            amount: 250000,
            currency: "INR",
            method: "upi",
            captured_at: 1726050000,
          },
        ],
      });

      const updatedPayment = {
        ...activePayment,
        status: "captured",
        gatewayPaymentId: "pay_gateway_captured_999",
        method: "upi",
        capturedAt: new Date(1726050000 * 1000),
      };

      paymentRepository.updateById.mockResolvedValue(updatedPayment);
      orderService.markOrderPaymentCaptured.mockResolvedValue({
        ...mockOrder,
        paymentStatus: "paid",
        status: "confirmed",
      });

      const result = await createPaymentForOrder(
        orderId,
        userId,
        "retry-key-after-paid"
      );

      expect(result.status).toBe("captured");
      expect(result.gatewayPaymentId).toBe("pay_gateway_captured_999");
      expect(paymentRepository.updateById).toHaveBeenCalledWith(
        "pay-to-reconcile",
        expect.objectContaining({
          status: "captured",
          gatewayPaymentId: "pay_gateway_captured_999",
          method: "upi",
        })
      );
      expect(orderService.markOrderPaymentCaptured).toHaveBeenCalledWith(orderId);
      expect(paymentRepository.create).not.toHaveBeenCalled();
      expect(razorpayProvider.createOrder).not.toHaveBeenCalled();
    });

    it("fails closed with 409 when paid gateway order has only failed payments", async () => {
      const activePayment = {
        _id: "pay-failed-only",
        orderId,
        customerId,
        amount: "2500.00",
        currency: "INR",
        status: "created",
        gatewayOrderId: "order_rzp_failed_only",
        idempotencyKey: "key-failed-only",
      };

      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(null);
      paymentRepository.findActiveByOrderId.mockResolvedValue(activePayment);

      razorpayProvider.fetchOrder.mockResolvedValue({
        id: "order_rzp_failed_only",
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
            id: "pay_failed_123",
            status: "failed",
            amount: 250000,
            currency: "INR",
            error_description: "Card expired",
          },
        ],
      });

      await expect(
        createPaymentForOrder(orderId, userId, "retry-after-failed-only")
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "ACTIVE_PAYMENT_EXISTS",
      });

      expect(paymentRepository.updateById).not.toHaveBeenCalled();
      expect(orderService.markOrderPaymentCaptured).not.toHaveBeenCalled();
    });

    it("fails closed with 409 when paid gateway order has only authorized payments", async () => {
      const activePayment = {
        _id: "pay-auth-only",
        orderId,
        customerId,
        amount: "2500.00",
        currency: "INR",
        status: "created",
        gatewayOrderId: "order_rzp_auth_only",
        idempotencyKey: "key-auth-only",
      };

      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(null);
      paymentRepository.findActiveByOrderId.mockResolvedValue(activePayment);

      razorpayProvider.fetchOrder.mockResolvedValue({
        id: "order_rzp_auth_only",
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
            id: "pay_auth_123",
            status: "authorized",
            amount: 250000,
            currency: "INR",
          },
        ],
      });

      await expect(
        createPaymentForOrder(orderId, userId, "retry-after-auth-only")
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "ACTIVE_PAYMENT_EXISTS",
      });

      expect(paymentRepository.updateById).not.toHaveBeenCalled();
      expect(orderService.markOrderPaymentCaptured).not.toHaveBeenCalled();
    });

    it("fails closed with 409 when paid gateway order has empty payment list", async () => {
      const activePayment = {
        _id: "pay-empty-list",
        orderId,
        customerId,
        amount: "2500.00",
        currency: "INR",
        status: "created",
        gatewayOrderId: "order_rzp_empty_list",
        idempotencyKey: "key-empty-list",
      };

      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(null);
      paymentRepository.findActiveByOrderId.mockResolvedValue(activePayment);

      razorpayProvider.fetchOrder.mockResolvedValue({
        id: "order_rzp_empty_list",
        status: "paid",
        amount: 250000,
        currency: "INR",
        notes: {
          buyboxOrderId: orderId,
        },
      });

      razorpayProvider.fetchOrderPayments.mockResolvedValue({
        entity: "collection",
        count: 0,
        items: [],
      });

      await expect(
        createPaymentForOrder(orderId, userId, "retry-after-empty-list")
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "ACTIVE_PAYMENT_EXISTS",
      });

      expect(paymentRepository.updateById).not.toHaveBeenCalled();
      expect(orderService.markOrderPaymentCaptured).not.toHaveBeenCalled();
    });

    it("fails closed with 409 when captured payment amount does not match order amount", async () => {
      const activePayment = {
        _id: "pay-amt-mismatch",
        orderId,
        customerId,
        amount: "2500.00",
        currency: "INR",
        status: "created",
        gatewayOrderId: "order_rzp_amt_mismatch",
        idempotencyKey: "key-amt-mismatch",
      };

      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(null);
      paymentRepository.findActiveByOrderId.mockResolvedValue(activePayment);

      razorpayProvider.fetchOrder.mockResolvedValue({
        id: "order_rzp_amt_mismatch",
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
            id: "pay_captured_wrong_amt",
            status: "captured",
            amount: 100000, // mismatch: expected 250000
            currency: "INR",
          },
        ],
      });

      await expect(
        createPaymentForOrder(orderId, userId, "retry-after-wrong-amt")
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "ACTIVE_PAYMENT_EXISTS",
      });

      expect(paymentRepository.updateById).not.toHaveBeenCalled();
      expect(orderService.markOrderPaymentCaptured).not.toHaveBeenCalled();
    });

    it("fails closed with 409 when captured payment currency does not match order currency", async () => {
      const activePayment = {
        _id: "pay-curr-mismatch",
        orderId,
        customerId,
        amount: "2500.00",
        currency: "INR",
        status: "created",
        gatewayOrderId: "order_rzp_curr_mismatch",
        idempotencyKey: "key-curr-mismatch",
      };

      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(null);
      paymentRepository.findActiveByOrderId.mockResolvedValue(activePayment);

      razorpayProvider.fetchOrder.mockResolvedValue({
        id: "order_rzp_curr_mismatch",
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
            id: "pay_captured_wrong_curr",
            status: "captured",
            amount: 250000,
            currency: "USD", // mismatch: expected INR
          },
        ],
      });

      await expect(
        createPaymentForOrder(orderId, userId, "retry-after-wrong-curr")
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "ACTIVE_PAYMENT_EXISTS",
      });

      expect(paymentRepository.updateById).not.toHaveBeenCalled();
      expect(orderService.markOrderPaymentCaptured).not.toHaveBeenCalled();
    });

    it("fails closed with 409 when captured payment has an empty or invalid ID", async () => {
      const activePayment = {
        _id: "pay-invalid-id",
        orderId,
        customerId,
        amount: "2500.00",
        currency: "INR",
        status: "created",
        gatewayOrderId: "order_rzp_invalid_id",
        idempotencyKey: "key-invalid-id",
      };

      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(null);
      paymentRepository.findActiveByOrderId.mockResolvedValue(activePayment);

      razorpayProvider.fetchOrder.mockResolvedValue({
        id: "order_rzp_invalid_id",
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
            id: "   ", // empty / whitespace only ID
            status: "captured",
            amount: 250000,
            currency: "INR",
          },
        ],
      });

      await expect(
        createPaymentForOrder(orderId, userId, "retry-after-invalid-id")
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "ACTIVE_PAYMENT_EXISTS",
      });

      expect(paymentRepository.updateById).not.toHaveBeenCalled();
      expect(orderService.markOrderPaymentCaptured).not.toHaveBeenCalled();
    });

    it("safely handles race where payment is captured by webhook/verification before update", async () => {
      const activePayment = {
        _id: "pay-racing-webhook",
        orderId,
        customerId,
        amount: "2500.00",
        currency: "INR",
        status: "created",
        gatewayOrderId: "order_rzp_race",
        idempotencyKey: "key-racing",
      };

      const alreadyCapturedDoc = {
        ...activePayment,
        status: "captured",
        gatewayPaymentId: "pay_winner_from_webhook",
      };

      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(null);
      paymentRepository.findActiveByOrderId.mockResolvedValue(activePayment);

      razorpayProvider.fetchOrder.mockResolvedValue({
        id: "order_rzp_race",
        status: "paid",
        amount: 250000,
        currency: "INR",
        notes: {
          buyboxOrderId: orderId,
        },
      });

      // DB check returns already captured doc (concurrent webhook finished first)
      paymentRepository.findById.mockResolvedValue(alreadyCapturedDoc);

      const result = await createPaymentForOrder(
        orderId,
        userId,
        "retry-key-racing-webhook"
      );

      expect(result).toBe(alreadyCapturedDoc);
      expect(paymentRepository.updateById).not.toHaveBeenCalled();
      expect(orderService.markOrderPaymentCaptured).toHaveBeenCalledWith(orderId);
    });

    it("fails closed with 409 and does not overwrite if racing webhook marks payment non-pre-capture before update", async () => {
      const activePayment = {
        _id: "pay-racing-fail",
        orderId,
        customerId,
        amount: "2500.00",
        currency: "INR",
        status: "created",
        gatewayOrderId: "order_rzp_race_fail",
        idempotencyKey: "key-racing-fail",
      };

      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(null);
      paymentRepository.findActiveByOrderId.mockResolvedValue(activePayment);

      razorpayProvider.fetchOrder.mockResolvedValue({
        id: "order_rzp_race_fail",
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
            id: "pay_captured_123",
            status: "captured",
            amount: 250000,
            currency: "INR",
          },
        ],
      });

      // DB check returns doc marked failed concurrently
      paymentRepository.findById.mockResolvedValue({
        ...activePayment,
        status: "failed",
        failureReason: "Gateway failure",
      });

      await expect(
        createPaymentForOrder(orderId, userId, "retry-key-racing-fail")
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "ACTIVE_PAYMENT_EXISTS",
      });

      expect(paymentRepository.updateById).not.toHaveBeenCalled();
      expect(orderService.markOrderPaymentCaptured).not.toHaveBeenCalled();
    });

    it("does not overwrite an already-captured local payment on repeated reconciliation", async () => {
      const alreadyCapturedPayment = {
        _id: "pay-already-captured",
        orderId,
        customerId,
        amount: "2500.00",
        currency: "INR",
        status: "captured",
        gatewayOrderId: "order_rzp_repeated",
        gatewayPaymentId: "pay_already_captured_1",
        idempotencyKey: "key-already-captured",
      };

      // By-key lookup finds it
      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(alreadyCapturedPayment);

      const result = await createPaymentForOrder(
        orderId,
        userId,
        "key-already-captured"
      );

      expect(result).toBe(alreadyCapturedPayment);
      expect(paymentRepository.updateById).not.toHaveBeenCalled();
      expect(razorpayProvider.createOrder).not.toHaveBeenCalled();
    });
  });

  describe("Fail-Closed Invariants & Validation", () => {
    it("fails closed with 409 ACTIVE_PAYMENT_EXISTS when buyboxOrderId in notes mismatches", async () => {
      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(null);
      paymentRepository.findActiveByOrderId.mockResolvedValue({
        _id: "pay-mismatch-order",
        orderId,
        status: "created",
        gatewayOrderId: "order_rzp_mismatch",
      });

      razorpayProvider.fetchOrder.mockResolvedValue({
        id: "order_rzp_mismatch",
        status: "created",
        amount: 250000,
        currency: "INR",
        notes: {
          buyboxOrderId: "different-order-id-456",
        },
      });

      await expect(
        createPaymentForOrder(orderId, userId, "retry-key-mismatch-order")
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "ACTIVE_PAYMENT_EXISTS",
      });

      expect(paymentRepository.create).not.toHaveBeenCalled();
      expect(razorpayProvider.createOrder).not.toHaveBeenCalled();
    });

    it("fails closed with 409 ACTIVE_PAYMENT_EXISTS when gateway amount mismatches local order", async () => {
      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(null);
      paymentRepository.findActiveByOrderId.mockResolvedValue({
        _id: "pay-mismatch-amt",
        orderId,
        status: "created",
        gatewayOrderId: "order_rzp_amt_mismatch",
      });

      razorpayProvider.fetchOrder.mockResolvedValue({
        id: "order_rzp_amt_mismatch",
        status: "created",
        amount: 999999, // mismatch (expected 250000)
        currency: "INR",
        notes: {
          buyboxOrderId: orderId,
        },
      });

      await expect(
        createPaymentForOrder(orderId, userId, "retry-key-mismatch-amt")
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "ACTIVE_PAYMENT_EXISTS",
      });

      expect(paymentRepository.create).not.toHaveBeenCalled();
      expect(razorpayProvider.createOrder).not.toHaveBeenCalled();
    });

    it("fails closed with 409 ACTIVE_PAYMENT_EXISTS when gateway currency mismatches local order", async () => {
      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(null);
      paymentRepository.findActiveByOrderId.mockResolvedValue({
        _id: "pay-mismatch-curr",
        orderId,
        status: "created",
        gatewayOrderId: "order_rzp_curr_mismatch",
      });

      razorpayProvider.fetchOrder.mockResolvedValue({
        id: "order_rzp_curr_mismatch",
        status: "created",
        amount: 250000,
        currency: "USD", // mismatch (expected INR)
        notes: {
          buyboxOrderId: orderId,
        },
      });

      await expect(
        createPaymentForOrder(orderId, userId, "retry-key-mismatch-curr")
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "ACTIVE_PAYMENT_EXISTS",
      });

      expect(paymentRepository.create).not.toHaveBeenCalled();
      expect(razorpayProvider.createOrder).not.toHaveBeenCalled();
    });

    it("fails closed with 409 ACTIVE_PAYMENT_EXISTS when razorpayProvider.fetchOrder fails", async () => {
      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(null);
      paymentRepository.findActiveByOrderId.mockResolvedValue({
        _id: "pay-fetch-fail",
        orderId,
        status: "created",
        gatewayOrderId: "order_rzp_down",
      });

      razorpayProvider.fetchOrder.mockRejectedValue(new Error("Gateway unreachable"));

      await expect(
        createPaymentForOrder(orderId, userId, "retry-key-fetch-fail")
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "ACTIVE_PAYMENT_EXISTS",
      });

      expect(paymentRepository.create).not.toHaveBeenCalled();
      expect(razorpayProvider.createOrder).not.toHaveBeenCalled();
    });

    it("fails closed with 409 ACTIVE_PAYMENT_EXISTS when gateway order has an unexpected status", async () => {
      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(null);
      paymentRepository.findActiveByOrderId.mockResolvedValue({
        _id: "pay-unknown-status",
        orderId,
        status: "created",
        gatewayOrderId: "order_rzp_unknown",
      });

      razorpayProvider.fetchOrder.mockResolvedValue({
        id: "order_rzp_unknown",
        status: "cancelled", // unexpected order status
        amount: 250000,
        currency: "INR",
        notes: {
          buyboxOrderId: orderId,
        },
      });

      await expect(
        createPaymentForOrder(orderId, userId, "retry-key-unknown-status")
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "ACTIVE_PAYMENT_EXISTS",
      });

      expect(paymentRepository.create).not.toHaveBeenCalled();
      expect(razorpayProvider.createOrder).not.toHaveBeenCalled();
    });
  });

  describe("E11000 Concurrent Race Winner Handling", () => {
    it("allows concurrent loser to reuse active payment created by winner", async () => {
      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(null);
      paymentRepository.findActiveByOrderId.mockResolvedValueOnce(null);

      const duplicateError = new Error("E11000 duplicate key error");
      duplicateError.code = 11000;
      paymentRepository.create.mockRejectedValue(duplicateError);

      const winnerPayment = {
        _id: "pay-winner",
        orderId,
        customerId,
        status: "created",
        gatewayOrderId: "order_rzp_winner",
        amount: "2500.00",
        currency: "INR",
        idempotencyKey: "winner-racing-key-1",
      };

      paymentRepository.findActiveByOrderId.mockResolvedValueOnce(winnerPayment);
      razorpayProvider.fetchOrder.mockResolvedValue({
        id: "order_rzp_winner",
        status: "created",
        amount: 250000,
        currency: "INR",
        notes: {
          buyboxOrderId: orderId,
        },
      });

      const result = await createPaymentForOrder(
        orderId,
        userId,
        "loser-racing-key-2"
      );

      expect(result).toBe(winnerPayment);
      expect(razorpayProvider.fetchOrder).toHaveBeenCalledWith("order_rzp_winner");
      expect(razorpayProvider.createOrder).not.toHaveBeenCalled();
    });
  });
});
