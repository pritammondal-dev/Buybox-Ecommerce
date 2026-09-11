const mongoose = require("mongoose");

jest.mock("../src/repositories/payment.repository");
jest.mock("../src/repositories/order.repository");
jest.mock("../src/repositories/payment-webhook-event.repository");
jest.mock("../src/integrations/payments/razorpay.provider");
jest.mock("../src/services/order.service");

const paymentRepository = require("../src/repositories/payment.repository");
const orderRepository = require("../src/repositories/order.repository");
const paymentWebhookEventRepository = require("../src/repositories/payment-webhook-event.repository");
const razorpayProvider = require("../src/integrations/payments/razorpay.provider");
const orderService = require("../src/services/order.service");

const {
  processPaymentWebhookEvent,
} = require("../src/services/payment-webhook-processor.service");

describe("Task 8B.5.3 — Payment Orphan Recovery (Phase 1A)", () => {
  const orderId = new mongoose.Types.ObjectId().toString();
  const paymentId = new mongoose.Types.ObjectId().toString();
  const gatewayOrderId = "order_GATEWAY123";
  const gatewayPaymentId = "pay_GATEWAY123";

  let mockSession;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };

    jest.spyOn(mongoose, "startSession").mockResolvedValue(mockSession);

    paymentWebhookEventRepository.markProcessing.mockResolvedValue(true);
    paymentWebhookEventRepository.markProcessed.mockResolvedValue(true);
    paymentWebhookEventRepository.markFailed.mockResolvedValue(true);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe("1. Fast Path vs. Orphan Fallback Resolution", () => {
    it("Test 1 & 13: existing gatewayOrderId uses fast path and NEVER calls fetchOrder", async () => {
      paymentWebhookEventRepository.findByEventId.mockResolvedValue({
        eventId: "event-fast-path",
        eventType: "payment.captured",
        status: "received",
        payload: {
          payload: {
            payment: {
              entity: {
                id: gatewayPaymentId,
                order_id: gatewayOrderId,
                amount: 279900,
                currency: "INR",
                status: "captured",
              },
            },
          },
        },
      });

      const existingPayment = {
        _id: paymentId,
        orderId,
        gateway: "razorpay",
        gatewayOrderId,
        gatewayPaymentId: null,
        amount: "2799.00",
        currency: "INR",
        status: "created",
      };

      paymentRepository.findByGatewayOrderId.mockResolvedValue(existingPayment);
      orderRepository.findById.mockResolvedValue({
        _id: orderId,
        grandTotal: "2799.00",
        currency: "INR",
        orderNumber: "BB-001",
      });
      paymentRepository.updateById.mockResolvedValue({
        ...existingPayment,
        status: "captured",
        gatewayPaymentId,
      });
      orderService.markOrderPaymentCaptured.mockResolvedValue({
        _id: orderId,
        status: "confirmed",
        paymentStatus: "paid",
      });

      const result = await processPaymentWebhookEvent("event-fast-path");

      expect(result.processed).toBe(true);
      expect(paymentRepository.findByGatewayOrderId).toHaveBeenCalledWith(
        "razorpay",
        gatewayOrderId,
        { session: mockSession }
      );
      expect(razorpayProvider.fetchOrder).not.toHaveBeenCalled();
      expect(paymentRepository.linkOrphanGatewayOrderId).not.toHaveBeenCalled();
      expect(orderService.markOrderPaymentCaptured).toHaveBeenCalledWith(
        orderId,
        { session: mockSession }
      );
    });

    it("Test 2: order.paid with order.entity.notes.buyboxOrderId links orphan without fetchOrder", async () => {
      paymentWebhookEventRepository.findByEventId.mockResolvedValue({
        eventId: "event-order-paid",
        eventType: "order.paid",
        status: "received",
        payload: {
          payload: {
            order: {
              entity: {
                id: gatewayOrderId,
                notes: {
                  buyboxOrderId: orderId,
                  orderNumber: "BB-002",
                },
              },
            },
            payment: {
              entity: {
                id: gatewayPaymentId,
                order_id: gatewayOrderId,
                amount: 279900,
                currency: "INR",
                status: "captured",
              },
            },
          },
        },
      });

      // 1. Fast path returns null
      paymentRepository.findByGatewayOrderId.mockResolvedValue(null);

      // 2. Candidate orphan exists
      const candidateOrphan = {
        _id: paymentId,
        orderId,
        gateway: "razorpay",
        gatewayOrderId: null,
        amount: "2799.00",
        currency: "INR",
        status: "created",
      };
      paymentRepository.findActiveByOrderId.mockResolvedValue(candidateOrphan);

      // 3. Local order
      const localOrder = {
        _id: orderId,
        grandTotal: "2799.00",
        currency: "INR",
        orderNumber: "BB-002",
      };
      orderRepository.findById.mockResolvedValue(localOrder);

      // 4. Atomic conditional update succeeds
      const linkedPayment = {
        ...candidateOrphan,
        gatewayOrderId,
      };
      paymentRepository.linkOrphanGatewayOrderId.mockResolvedValue(linkedPayment);

      paymentRepository.updateById.mockResolvedValue({
        ...linkedPayment,
        status: "captured",
        gatewayPaymentId,
      });
      orderService.markOrderPaymentCaptured.mockResolvedValue({
        _id: orderId,
        status: "confirmed",
        paymentStatus: "paid",
      });

      const result = await processPaymentWebhookEvent("event-order-paid");

      expect(result.processed).toBe(true);
      expect(razorpayProvider.fetchOrder).not.toHaveBeenCalled();
      expect(paymentRepository.linkOrphanGatewayOrderId).toHaveBeenCalledWith(
        paymentId,
        gatewayOrderId,
        { session: mockSession }
      );
      expect(orderService.markOrderPaymentCaptured).toHaveBeenCalledWith(
        orderId,
        { session: mockSession }
      );
    });

    it("Test 3: payment.captured without order.entity calls fetchOrder and links orphan", async () => {
      paymentWebhookEventRepository.findByEventId.mockResolvedValue({
        eventId: "event-pay-captured",
        eventType: "payment.captured",
        status: "received",
        payload: {
          payload: {
            payment: {
              entity: {
                id: gatewayPaymentId,
                order_id: gatewayOrderId,
                amount: 279900,
                currency: "INR",
                status: "captured",
              },
            },
          },
        },
      });

      paymentRepository.findByGatewayOrderId.mockResolvedValue(null);

      // fetchOrder is called
      razorpayProvider.fetchOrder.mockResolvedValue({
        id: gatewayOrderId,
        amount: 279900,
        currency: "INR",
        notes: {
          buyboxOrderId: orderId,
          orderNumber: "BB-003",
        },
      });

      const candidateOrphan = {
        _id: paymentId,
        orderId,
        gateway: "razorpay",
        gatewayOrderId: null,
        amount: "2799.00",
        currency: "INR",
        status: "created",
      };
      paymentRepository.findActiveByOrderId.mockResolvedValue(candidateOrphan);

      const localOrder = {
        _id: orderId,
        grandTotal: "2799.00",
        currency: "INR",
        orderNumber: "BB-003",
      };
      orderRepository.findById.mockResolvedValue(localOrder);

      const linkedPayment = {
        ...candidateOrphan,
        gatewayOrderId,
      };
      paymentRepository.linkOrphanGatewayOrderId.mockResolvedValue(linkedPayment);

      paymentRepository.updateById.mockResolvedValue({
        ...linkedPayment,
        status: "captured",
        gatewayPaymentId,
      });
      orderService.markOrderPaymentCaptured.mockResolvedValue({
        _id: orderId,
        status: "confirmed",
        paymentStatus: "paid",
      });

      const result = await processPaymentWebhookEvent("event-pay-captured");

      expect(result.processed).toBe(true);
      expect(razorpayProvider.fetchOrder).toHaveBeenCalledWith(gatewayOrderId);
      expect(paymentRepository.linkOrphanGatewayOrderId).toHaveBeenCalledWith(
        paymentId,
        gatewayOrderId,
        { session: mockSession }
      );
    });

    it("Test 4: payment.authorized event links orphan and updates status to authorized", async () => {
      paymentWebhookEventRepository.findByEventId.mockResolvedValue({
        eventId: "event-pay-auth",
        eventType: "payment.authorized",
        status: "received",
        payload: {
          payload: {
            payment: {
              entity: {
                id: gatewayPaymentId,
                order_id: gatewayOrderId,
                amount: 279900,
                currency: "INR",
                status: "authorized",
              },
            },
          },
        },
      });

      paymentRepository.findByGatewayOrderId.mockResolvedValue(null);

      razorpayProvider.fetchOrder.mockResolvedValue({
        id: gatewayOrderId,
        notes: {
          buyboxOrderId: orderId,
          orderNumber: "BB-004",
        },
      });

      const candidateOrphan = {
        _id: paymentId,
        orderId,
        gateway: "razorpay",
        gatewayOrderId: null,
        amount: "2799.00",
        currency: "INR",
        status: "created",
      };
      paymentRepository.findActiveByOrderId.mockResolvedValue(candidateOrphan);

      const localOrder = {
        _id: orderId,
        grandTotal: "2799.00",
        currency: "INR",
        orderNumber: "BB-004",
        paymentStatus: "pending",
      };
      orderRepository.findById.mockResolvedValue(localOrder);

      const linkedPayment = {
        ...candidateOrphan,
        gatewayOrderId,
      };
      paymentRepository.linkOrphanGatewayOrderId.mockResolvedValue(linkedPayment);

      paymentRepository.updateById.mockResolvedValue({
        ...linkedPayment,
        status: "authorized",
        gatewayPaymentId,
      });
      orderRepository.updateById.mockResolvedValue({
        ...localOrder,
        paymentStatus: "authorized",
      });

      const result = await processPaymentWebhookEvent("event-pay-auth");

      expect(result.processed).toBe(true);
      expect(paymentRepository.updateById).toHaveBeenCalledWith(
        paymentId,
        expect.objectContaining({
          status: "authorized",
          gatewayPaymentId,
        }),
        { session: mockSession }
      );
      expect(orderRepository.updateById).toHaveBeenCalledWith(
        orderId,
        { paymentStatus: "authorized" },
        { session: mockSession }
      );
      expect(orderService.markOrderPaymentCaptured).not.toHaveBeenCalled();
    });

    it("Test 5: payment.failed links orphan, sets status failed, does NOT mark successful", async () => {
      paymentWebhookEventRepository.findByEventId.mockResolvedValue({
        eventId: "event-pay-failed",
        eventType: "payment.failed",
        status: "received",
        payload: {
          payload: {
            payment: {
              entity: {
                id: gatewayPaymentId,
                order_id: gatewayOrderId,
                amount: 279900,
                currency: "INR",
                status: "failed",
                error_description: "Card expired",
              },
            },
          },
        },
      });

      paymentRepository.findByGatewayOrderId.mockResolvedValue(null);

      razorpayProvider.fetchOrder.mockResolvedValue({
        id: gatewayOrderId,
        notes: {
          buyboxOrderId: orderId,
          orderNumber: "BB-005",
        },
      });

      const candidateOrphan = {
        _id: paymentId,
        orderId,
        gateway: "razorpay",
        gatewayOrderId: null,
        amount: "2799.00",
        currency: "INR",
        status: "created",
      };
      paymentRepository.findActiveByOrderId.mockResolvedValue(candidateOrphan);

      const localOrder = {
        _id: orderId,
        grandTotal: "2799.00",
        currency: "INR",
        orderNumber: "BB-005",
        paymentStatus: "pending",
      };
      orderRepository.findById.mockResolvedValue(localOrder);

      const linkedPayment = {
        ...candidateOrphan,
        gatewayOrderId,
      };
      paymentRepository.linkOrphanGatewayOrderId.mockResolvedValue(linkedPayment);

      paymentRepository.updateById.mockResolvedValue({
        ...linkedPayment,
        status: "failed",
        gatewayPaymentId,
        failureReason: "Card expired",
      });
      orderRepository.updateById.mockResolvedValue({
        ...localOrder,
        paymentStatus: "failed",
      });

      const result = await processPaymentWebhookEvent("event-pay-failed");

      expect(result.processed).toBe(true);
      expect(paymentRepository.updateById).toHaveBeenCalledWith(
        paymentId,
        expect.objectContaining({
          status: "failed",
          failureReason: "Card expired",
        }),
        { session: mockSession }
      );
      expect(orderRepository.updateById).toHaveBeenCalledWith(
        orderId,
        { paymentStatus: "failed" },
        { session: mockSession }
      );
      expect(orderService.markOrderPaymentCaptured).not.toHaveBeenCalled();
    });
  });

  describe("2. Safety Invariant Guards & Abort Behaviors", () => {
    it("Test 6: Amount mismatch aborts linkage and throws 404 PAYMENT_NOT_FOUND", async () => {
      paymentWebhookEventRepository.findByEventId.mockResolvedValue({
        eventId: "event-amount-mismatch",
        eventType: "payment.captured",
        status: "received",
        payload: {
          payload: {
            payment: {
              entity: {
                id: gatewayPaymentId,
                order_id: gatewayOrderId,
                amount: 999900, // Different amount
                currency: "INR",
                status: "captured",
              },
            },
          },
        },
      });

      paymentRepository.findByGatewayOrderId.mockResolvedValue(null);
      razorpayProvider.fetchOrder.mockResolvedValue({
        id: gatewayOrderId,
        notes: { buyboxOrderId: orderId },
      });

      const candidateOrphan = {
        _id: paymentId,
        orderId,
        gateway: "razorpay",
        gatewayOrderId: null,
        amount: "2799.00",
        currency: "INR",
        status: "created",
      };
      paymentRepository.findActiveByOrderId.mockResolvedValue(candidateOrphan);
      orderRepository.findById.mockResolvedValue({
        _id: orderId,
        grandTotal: "2799.00",
        currency: "INR",
      });

      await expect(
        processPaymentWebhookEvent("event-amount-mismatch")
      ).rejects.toMatchObject({
        statusCode: 404,
        code: "PAYMENT_NOT_FOUND",
      });

      expect(paymentRepository.linkOrphanGatewayOrderId).not.toHaveBeenCalled();
    });

    it("Test 7: Currency mismatch aborts linkage and throws 404 PAYMENT_NOT_FOUND", async () => {
      paymentWebhookEventRepository.findByEventId.mockResolvedValue({
        eventId: "event-currency-mismatch",
        eventType: "payment.captured",
        status: "received",
        payload: {
          payload: {
            payment: {
              entity: {
                id: gatewayPaymentId,
                order_id: gatewayOrderId,
                amount: 279900,
                currency: "USD", // Mismatched currency
                status: "captured",
              },
            },
          },
        },
      });

      paymentRepository.findByGatewayOrderId.mockResolvedValue(null);
      razorpayProvider.fetchOrder.mockResolvedValue({
        id: gatewayOrderId,
        notes: { buyboxOrderId: orderId },
      });

      const candidateOrphan = {
        _id: paymentId,
        orderId,
        gateway: "razorpay",
        gatewayOrderId: null,
        amount: "2799.00",
        currency: "INR",
        status: "created",
      };
      paymentRepository.findActiveByOrderId.mockResolvedValue(candidateOrphan);
      orderRepository.findById.mockResolvedValue({
        _id: orderId,
        grandTotal: "2799.00",
        currency: "INR",
      });

      await expect(
        processPaymentWebhookEvent("event-currency-mismatch")
      ).rejects.toMatchObject({
        statusCode: 404,
        code: "PAYMENT_NOT_FOUND",
      });

      expect(paymentRepository.linkOrphanGatewayOrderId).not.toHaveBeenCalled();
    });

    it("Test 8: Invalid or missing Buybox order ID aborts linkage", async () => {
      paymentWebhookEventRepository.findByEventId.mockResolvedValue({
        eventId: "event-invalid-buybox-id",
        eventType: "payment.captured",
        status: "received",
        payload: {
          payload: {
            payment: {
              entity: {
                id: gatewayPaymentId,
                order_id: gatewayOrderId,
                amount: 279900,
                currency: "INR",
                status: "captured",
              },
            },
          },
        },
      });

      paymentRepository.findByGatewayOrderId.mockResolvedValue(null);
      razorpayProvider.fetchOrder.mockResolvedValue({
        id: gatewayOrderId,
        notes: {
          buyboxOrderId: "not-a-valid-mongo-object-id",
        },
      });

      await expect(
        processPaymentWebhookEvent("event-invalid-buybox-id")
      ).rejects.toMatchObject({
        statusCode: 404,
        code: "PAYMENT_NOT_FOUND",
      });

      expect(paymentRepository.findActiveByOrderId).not.toHaveBeenCalled();
      expect(paymentRepository.linkOrphanGatewayOrderId).not.toHaveBeenCalled();
    });

    it("Test 9: No matching orphan Payment found (status not created or gatewayOrderId present)", async () => {
      paymentWebhookEventRepository.findByEventId.mockResolvedValue({
        eventId: "event-no-orphan",
        eventType: "payment.captured",
        status: "received",
        payload: {
          payload: {
            payment: {
              entity: {
                id: gatewayPaymentId,
                order_id: gatewayOrderId,
                amount: 279900,
                currency: "INR",
                status: "captured",
              },
            },
          },
        },
      });

      paymentRepository.findByGatewayOrderId.mockResolvedValue(null);
      razorpayProvider.fetchOrder.mockResolvedValue({
        id: gatewayOrderId,
        notes: { buyboxOrderId: orderId },
      });

      // Active payment already has a gatewayOrderId
      paymentRepository.findActiveByOrderId.mockResolvedValue({
        _id: paymentId,
        orderId,
        gateway: "razorpay",
        gatewayOrderId: "order_EXISTING_OTHER",
        status: "created",
      });

      await expect(
        processPaymentWebhookEvent("event-no-orphan")
      ).rejects.toMatchObject({
        statusCode: 404,
        code: "PAYMENT_NOT_FOUND",
      });

      expect(paymentRepository.linkOrphanGatewayOrderId).not.toHaveBeenCalled();
    });

    it("Test 10: fetchOrder gateway failure does not perform unsafe linkage", async () => {
      paymentWebhookEventRepository.findByEventId.mockResolvedValue({
        eventId: "event-fetch-fail",
        eventType: "payment.captured",
        status: "received",
        payload: {
          payload: {
            payment: {
              entity: {
                id: gatewayPaymentId,
                order_id: gatewayOrderId,
                amount: 279900,
                currency: "INR",
                status: "captured",
              },
            },
          },
        },
      });

      paymentRepository.findByGatewayOrderId.mockResolvedValue(null);
      razorpayProvider.fetchOrder.mockRejectedValue(
        new Error("Razorpay timeout or connection refused")
      );

      await expect(
        processPaymentWebhookEvent("event-fetch-fail")
      ).rejects.toMatchObject({
        statusCode: 404,
        code: "PAYMENT_NOT_FOUND",
      });

      expect(paymentRepository.linkOrphanGatewayOrderId).not.toHaveBeenCalled();
    });

    it("Test 11: Race where candidate payment acquired a DIFFERENT gatewayOrderId is never overwritten", async () => {
      paymentWebhookEventRepository.findByEventId.mockResolvedValue({
        eventId: "event-race-lost",
        eventType: "payment.captured",
        status: "received",
        payload: {
          payload: {
            payment: {
              entity: {
                id: gatewayPaymentId,
                order_id: gatewayOrderId,
                amount: 279900,
                currency: "INR",
                status: "captured",
              },
            },
          },
        },
      });

      paymentRepository.findByGatewayOrderId.mockResolvedValue(null);
      razorpayProvider.fetchOrder.mockResolvedValue({
        id: gatewayOrderId,
        notes: { buyboxOrderId: orderId },
      });

      const candidateOrphan = {
        _id: paymentId,
        orderId,
        gateway: "razorpay",
        gatewayOrderId: null,
        amount: "2799.00",
        currency: "INR",
        status: "created",
      };
      paymentRepository.findActiveByOrderId.mockResolvedValue(candidateOrphan);
      orderRepository.findById.mockResolvedValue({
        _id: orderId,
        grandTotal: "2799.00",
        currency: "INR",
      });

      // Conditional linkage returns null (lost race)
      paymentRepository.linkOrphanGatewayOrderId.mockResolvedValue(null);

      // Re-read reveals a different gateway order was linked concurrently!
      paymentRepository.findById.mockResolvedValue({
        ...candidateOrphan,
        gatewayOrderId: "order_CONCURRENT_DIFFERENT",
      });

      await expect(
        processPaymentWebhookEvent("event-race-lost")
      ).rejects.toMatchObject({
        statusCode: 404,
        code: "PAYMENT_NOT_FOUND",
      });

      expect(paymentRepository.updateById).not.toHaveBeenCalled();
    });

    it("Test 12: Replay after successful linkage is idempotent and performs no duplicate gateway calls", async () => {
      paymentWebhookEventRepository.findByEventId.mockResolvedValue({
        eventId: "event-processed-replay",
        eventType: "payment.captured",
        status: "processed",
      });

      const result = await processPaymentWebhookEvent("event-processed-replay");

      expect(result.processed).toBe(true);
      expect(result.duplicate).toBe(true);
      expect(paymentRepository.findByGatewayOrderId).not.toHaveBeenCalled();
      expect(razorpayProvider.fetchOrder).not.toHaveBeenCalled();
    });

    it("Test 14: Ensure no responses expose raw Razorpay error details", async () => {
      paymentWebhookEventRepository.findByEventId.mockResolvedValue({
        eventId: "event-error-sanitized",
        eventType: "payment.captured",
        status: "received",
        payload: {
          payload: {
            payment: {
              entity: {
                id: gatewayPaymentId,
                order_id: gatewayOrderId,
                amount: 279900,
                currency: "INR",
                status: "captured",
              },
            },
          },
        },
      });

      paymentRepository.findByGatewayOrderId.mockResolvedValue(null);
      razorpayProvider.fetchOrder.mockRejectedValue(
        new Error("Sensitive internal stack trace / gateway authorization failed")
      );

      try {
        await processPaymentWebhookEvent("event-error-sanitized");
        throw new Error("Should have thrown");
      } catch (err) {
        expect(err.statusCode).toBe(404);
        expect(err.code).toBe("PAYMENT_NOT_FOUND");
        expect(err.message).not.toContain("Sensitive internal stack trace");
      }
    });
  });

  describe("3. razorpayProvider.fetchOrder Provider Unit Tests", () => {
    const actualProvider = jest.requireActual(
      "../src/integrations/payments/razorpay.provider"
    );
    const { razorpay } = require("../src/config/payment");

    it("rejects invalid or missing order ID with 400 INVALID_GATEWAY_ORDER_ID", async () => {
      await expect(actualProvider.fetchOrder("")).rejects.toMatchObject({
        statusCode: 400,
        code: "INVALID_GATEWAY_ORDER_ID",
      });
      await expect(actualProvider.fetchOrder("   ")).rejects.toMatchObject({
        statusCode: 400,
        code: "INVALID_GATEWAY_ORDER_ID",
      });
      await expect(actualProvider.fetchOrder(null)).rejects.toMatchObject({
        statusCode: 400,
        code: "INVALID_GATEWAY_ORDER_ID",
      });
    });

    it("fetches order successfully when razorpay.orders.fetch resolves", async () => {
      const mockOrder = { id: "order_123", amount: 10000 };
      const spy = jest
        .spyOn(razorpay.orders, "fetch")
        .mockResolvedValue(mockOrder);

      const result = await actualProvider.fetchOrder("order_123");
      expect(result).toEqual(mockOrder);
      expect(spy).toHaveBeenCalledWith("order_123");

      spy.mockRestore();
    });

    it("wraps gateway errors in 502 RAZORPAY_ORDER_FETCH_FAILED without raw leaks", async () => {
      const spy = jest
        .spyOn(razorpay.orders, "fetch")
        .mockRejectedValue(new Error("Internal gateway crash"));

      await expect(actualProvider.fetchOrder("order_123")).rejects.toMatchObject({
        statusCode: 502,
        code: "RAZORPAY_ORDER_FETCH_FAILED",
        message: "Unable to fetch Razorpay order",
      });

      spy.mockRestore();
    });
  });
});
