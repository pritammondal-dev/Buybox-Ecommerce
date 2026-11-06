const crypto = require("crypto");
const mongoose = require("mongoose");

jest.mock("../src/repositories/payment.repository");
jest.mock("../src/repositories/order.repository");
jest.mock("../src/repositories/refund.repository");
jest.mock("../src/repositories/payment-webhook-event.repository");
jest.mock("../src/integrations/payments/razorpay.provider");
jest.mock("../src/integrations/payments/razorpay-refund.provider");
jest.mock("../src/integrations/payments/paypal.provider");
jest.mock("../src/services/order.service");
jest.mock("../src/models/Customer");

const paymentRepository = require("../src/repositories/payment.repository");
const orderRepository = require("../src/repositories/order.repository");
const refundRepository = require("../src/repositories/refund.repository");
const paymentWebhookEventRepository = require("../src/repositories/payment-webhook-event.repository");
const razorpayProvider = require("../src/integrations/payments/razorpay.provider");
const razorpayRefundProvider = require("../src/integrations/payments/razorpay-refund.provider");
const paypalProvider = require("../src/integrations/payments/paypal.provider");
const orderService = require("../src/services/order.service");
const Customer = require("../src/models/Customer");

const paymentWebhookService = require("../src/services/payment-webhook.service");
const paymentWebhookProcessorService = require("../src/services/payment-webhook-processor.service");
const paymentService = require("../src/services/payment.service");
const paymentReconciliationService = require("../src/services/payment-reconciliation.service");
const refundService = require("../src/services/refund.service");
const env = require("../src/config/env");

describe("Phase 3B — Payment Integrity, Webhook Security & Reconciliation", () => {
  const orderId = new mongoose.Types.ObjectId().toString();
  const paymentId = new mongoose.Types.ObjectId().toString();
  const customerId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();

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

    Customer.findOne.mockResolvedValue({
      _id: customerId,
      userId,
      isActive: true,
      deletedAt: null,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("1. Webhook Authenticity & Signature Verification", () => {
    const rawRazorpayPayload = Buffer.from(
      JSON.stringify({
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_test_001",
              order_id: "order_rzp_001",
              amount: 50000,
              currency: "INR",
              status: "captured",
            },
          },
        },
      }),
      "utf8"
    );

    it("accepts valid Razorpay webhook signature and processes event", async () => {
      const validSignature = crypto
        .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
        .update(rawRazorpayPayload)
        .digest("hex");

      paymentWebhookEventRepository.findByEventId.mockResolvedValueOnce(null);
      paymentWebhookEventRepository.create.mockResolvedValueOnce({});

      // Mock processPaymentWebhookEvent internal lookup
      paymentWebhookEventRepository.findByEventId.mockResolvedValueOnce({
        eventId: "evt_rzp_001",
        eventType: "payment.captured",
        gateway: "razorpay",
        status: "received",
        payload: JSON.parse(rawRazorpayPayload.toString("utf8")),
      });

      paymentRepository.findByGatewayOrderId.mockResolvedValueOnce({
        _id: paymentId,
        orderId,
        gateway: "razorpay",
        gatewayOrderId: "order_rzp_001",
        amount: "500.00",
        currency: "INR",
        status: "created",
      });

      orderRepository.findById.mockResolvedValueOnce({
        _id: orderId,
        grandTotal: "500.00",
        currency: "INR",
        paymentStatus: "pending",
        status: "pending",
      });

      paymentRepository.updateById.mockResolvedValueOnce({
        _id: paymentId,
        status: "captured",
      });

      orderService.markOrderPaymentCaptured.mockResolvedValueOnce({
        _id: orderId,
        status: "confirmed",
        paymentStatus: "paid",
      });

      const result = await paymentWebhookService.handleRazorpayWebhook({
        rawBody: rawRazorpayPayload,
        signature: validSignature,
        eventId: "evt_rzp_001",
      });

      expect(result.duplicate).toBe(false);
      expect(result.processed).toBe(true);
      expect(orderService.markOrderPaymentCaptured).toHaveBeenCalledWith(orderId, {
        session: mockSession,
      });
    });

    it("rejects Razorpay webhook with invalid signature (fails closed)", async () => {
      const invalidSignature = "a".repeat(64);

      await expect(
        paymentWebhookService.handleRazorpayWebhook({
          rawBody: rawRazorpayPayload,
          signature: invalidSignature,
          eventId: "evt_rzp_002",
        })
      ).rejects.toMatchObject({
        statusCode: 401,
        code: "INVALID_WEBHOOK_SIGNATURE",
      });
    });

    it("rejects Razorpay webhook without eventId", async () => {
      await expect(
        paymentWebhookService.handleRazorpayWebhook({
          rawBody: rawRazorpayPayload,
          signature: "some-sig",
          eventId: "",
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: "WEBHOOK_EVENT_ID_REQUIRED",
      });
    });

    it("rejects PayPal webhook if transmission headers are missing", async () => {
      const rawBody = Buffer.from(JSON.stringify({ event_type: "PAYMENT.CAPTURE.COMPLETED" }));

      paypalProvider.verifyWebhookSignature.mockImplementationOnce(() => {
        const err = new Error("Missing headers");
        err.statusCode = 401;
        err.errorCode = "INVALID_WEBHOOK_SIGNATURE";
        throw err;
      });

      await expect(
        paymentWebhookService.handlePayPalWebhook({
          rawBody,
          headers: { "paypal-transmission-id": "WH-TX-001" },
        })
      ).rejects.toMatchObject({
        statusCode: 401,
        errorCode: "INVALID_WEBHOOK_SIGNATURE",
      });
    });

    it("accepts PayPal webhook with valid headers and signature", async () => {
      const rawBody = Buffer.from(
        JSON.stringify({
          event_type: "PAYMENT.CAPTURE.COMPLETED",
          resource: {
            id: "2GG12345",
            status: "COMPLETED",
            amount: { value: "500.00", currency_code: "INR" },
            supplementary_data: { related_ids: { order_id: "PAYPAL_ORD_100" } },
          },
        })
      );

      paypalProvider.verifyWebhookSignature.mockResolvedValueOnce(true);
      paymentWebhookEventRepository.findByEventId.mockResolvedValueOnce(null);
      paymentWebhookEventRepository.create.mockResolvedValueOnce({});

      paymentWebhookEventRepository.findByEventId.mockResolvedValueOnce({
        eventId: "WH-TX-002",
        eventType: "PAYMENT.CAPTURE.COMPLETED",
        gateway: "paypal",
        status: "received",
        payload: JSON.parse(rawBody.toString("utf8")),
      });

      paymentRepository.findByGatewayOrderId.mockResolvedValueOnce({
        _id: paymentId,
        orderId,
        gateway: "paypal",
        gatewayOrderId: "PAYPAL_ORD_100",
        amount: "500.00",
        currency: "INR",
        status: "created",
      });

      orderRepository.findById.mockResolvedValueOnce({
        _id: orderId,
        grandTotal: "500.00",
        currency: "INR",
        paymentStatus: "pending",
        status: "pending",
      });

      paymentRepository.updateById.mockResolvedValueOnce({
        _id: paymentId,
        status: "captured",
      });

      orderService.markOrderPaymentCaptured.mockResolvedValueOnce({
        _id: orderId,
        status: "confirmed",
        paymentStatus: "paid",
      });

      const result = await paymentWebhookService.handlePayPalWebhook({
        rawBody,
        headers: {
          "paypal-transmission-id": "WH-TX-002",
          "paypal-transmission-time": new Date().toISOString(),
          "paypal-transmission-sig": "mock-sig",
          "paypal-cert-url": "https://api.paypal.com/cert",
          "paypal-auth-algo": "SHA256withRSA",
          "x-mock-paypal-verify": "true",
        },
      });

      expect(result.duplicate).toBe(false);
      expect(result.processed).toBe(true);
      expect(orderService.markOrderPaymentCaptured).toHaveBeenCalledWith(orderId, {
        session: mockSession,
      });
    });
  });

  describe("2. Webhook Idempotency & Race Safety", () => {
    it("returns duplicate response idempotently for previously processed Razorpay event", async () => {
      const rawBody = Buffer.from(JSON.stringify({ event: "payment.captured" }));
      const validSignature = crypto
        .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
        .update(rawBody)
        .digest("hex");

      paymentWebhookEventRepository.findByEventId.mockResolvedValueOnce({
        eventId: "evt_already_processed",
        eventType: "payment.captured",
        status: "processed",
      });

      const result = await paymentWebhookService.handleRazorpayWebhook({
        rawBody,
        signature: validSignature,
        eventId: "evt_already_processed",
      });

      expect(result.duplicate).toBe(true);
      expect(paymentRepository.updateById).not.toHaveBeenCalled();
    });

    it("handles E11000 duplicate race safely on concurrent webhook insertion", async () => {
      const rawBody = Buffer.from(JSON.stringify({ event: "payment.captured" }));
      const validSignature = crypto
        .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
        .update(rawBody)
        .digest("hex");

      paymentWebhookEventRepository.findByEventId.mockResolvedValueOnce(null);
      const duplicateError = new Error("E11000 duplicate key");
      duplicateError.code = 11000;
      paymentWebhookEventRepository.create.mockRejectedValueOnce(duplicateError);

      paymentWebhookEventRepository.findByEventId.mockResolvedValueOnce({
        eventId: "evt_race_condition",
        eventType: "payment.captured",
        status: "received",
      });

      const result = await paymentWebhookService.handleRazorpayWebhook({
        rawBody,
        signature: validSignature,
        eventId: "evt_race_condition",
      });

      expect(result.duplicate).toBe(true);
      expect(result.eventId).toBe("evt_race_condition");
    });
  });

  describe("3. Webhook Amount & Currency Validation", () => {
    it("rejects Razorpay webhook when payment amount does not match local payment", async () => {
      paymentWebhookEventRepository.findByEventId.mockResolvedValueOnce({
        eventId: "evt_mismatch_amount",
        eventType: "payment.captured",
        gateway: "razorpay",
        status: "received",
        payload: {
          event: "payment.captured",
          payload: {
            payment: {
              entity: {
                id: "pay_bad_amount",
                order_id: "order_rzp_bad",
                amount: 999900, // mismatch
                currency: "INR",
              },
            },
          },
        },
      });

      paymentRepository.findByGatewayOrderId.mockResolvedValueOnce({
        _id: paymentId,
        orderId,
        gateway: "razorpay",
        gatewayOrderId: "order_rzp_bad",
        amount: "500.00", // 50000 in minor units
        currency: "INR",
        status: "created",
      });

      orderRepository.findById.mockResolvedValueOnce({
        _id: orderId,
        grandTotal: "500.00",
        currency: "INR",
      });

      await expect(
        paymentWebhookProcessorService.processPaymentWebhookEvent("evt_mismatch_amount")
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "RAZORPAY_AMOUNT_MISMATCH",
      });

      expect(paymentRepository.updateById).not.toHaveBeenCalled();
      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });

    it("rejects PayPal webhook when currency does not match local order", async () => {
      paymentWebhookEventRepository.findByEventId.mockResolvedValueOnce({
        eventId: "evt_mismatch_curr",
        eventType: "PAYMENT.CAPTURE.COMPLETED",
        gateway: "paypal",
        status: "received",
        payload: {
          resource: {
            id: "2GG_CURR_MISMATCH",
            status: "COMPLETED",
            amount: { value: "500.00", currency_code: "USD" }, // Mismatch: local is INR
            supplementary_data: { related_ids: { order_id: "PAYPAL_ORD_CURR" } },
          },
        },
      });

      paymentRepository.findByGatewayOrderId.mockResolvedValueOnce({
        _id: paymentId,
        orderId,
        gateway: "paypal",
        gatewayOrderId: "PAYPAL_ORD_CURR",
        amount: "500.00",
        currency: "INR",
        status: "created",
      });

      orderRepository.findById.mockResolvedValueOnce({
        _id: orderId,
        grandTotal: "500.00",
        currency: "INR",
      });

      await expect(
        paymentWebhookProcessorService.processPaymentWebhookEvent("evt_mismatch_curr")
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "PAYPAL_CURRENCY_MISMATCH",
      });

      expect(paymentRepository.updateById).not.toHaveBeenCalled();
    });
  });

  describe("4. State Machine Protections & Late Out-of-Order Webhooks", () => {
    it("does not downgrade an already paid/confirmed order when a late failure webhook arrives", async () => {
      paymentWebhookEventRepository.findByEventId.mockResolvedValueOnce({
        eventId: "evt_late_failure",
        eventType: "payment.failed",
        gateway: "razorpay",
        status: "received",
        payload: {
          event: "payment.failed",
          payload: {
            payment: {
              entity: {
                id: "pay_failed_attempt",
                order_id: "order_rzp_late",
                amount: 50000,
                currency: "INR",
                error_description: "Card was declined",
              },
            },
          },
        },
      });

      paymentRepository.findByGatewayOrderId.mockResolvedValueOnce({
        _id: paymentId,
        orderId,
        gateway: "razorpay",
        gatewayOrderId: "order_rzp_late",
        amount: "500.00",
        currency: "INR",
        status: "created",
      });

      // The order was already paid and confirmed by another successful attempt!
      orderRepository.findById.mockResolvedValueOnce({
        _id: orderId,
        grandTotal: "500.00",
        currency: "INR",
        paymentStatus: "paid",
        status: "confirmed",
      });

      paymentRepository.updateById.mockResolvedValueOnce({
        _id: paymentId,
        status: "failed",
      });

      const result = await paymentWebhookProcessorService.processPaymentWebhookEvent("evt_late_failure");

      expect(result.processed).toBe(true);
      // The payment attempt itself is marked failed
      expect(paymentRepository.updateById).toHaveBeenCalledWith(
        paymentId,
        expect.objectContaining({ status: "failed" }),
        { session: mockSession }
      );
      // BUT order paymentStatus must NOT be updated to failed!
      expect(orderRepository.updateById).not.toHaveBeenCalledWith(
        orderId,
        { paymentStatus: "failed" },
        expect.anything()
      );
    });

    it("safely ignores out-of-order state downgrade from captured to failed", async () => {
      paymentWebhookEventRepository.findByEventId.mockResolvedValueOnce({
        eventId: "evt_stale_failed",
        eventType: "payment.failed",
        gateway: "razorpay",
        status: "received",
        payload: {
          event: "payment.failed",
          payload: {
            payment: {
              entity: {
                id: "pay_captured_already",
                order_id: "order_rzp_captured",
                amount: 50000,
                currency: "INR",
              },
            },
          },
        },
      });

      // Payment is ALREADY captured!
      paymentRepository.findByGatewayOrderId.mockResolvedValueOnce({
        _id: paymentId,
        orderId,
        gateway: "razorpay",
        gatewayOrderId: "order_rzp_captured",
        gatewayPaymentId: "pay_captured_already",
        amount: "500.00",
        currency: "INR",
        status: "captured",
      });

      orderRepository.findById.mockResolvedValueOnce({
        _id: orderId,
        grandTotal: "500.00",
        currency: "INR",
        paymentStatus: "paid",
        status: "confirmed",
      });

      const result = await paymentWebhookProcessorService.processPaymentWebhookEvent("evt_stale_failed");

      expect(result.processed).toBe(true);
      expect(result.ignored).toBe(true);
      expect(result.reason).toBe("INVALID_OR_STALE_PAYMENT_TRANSITION");
      expect(paymentRepository.updateById).not.toHaveBeenCalled();
    });
  });

  describe("5. PayPal Payment Capture Flow & Guards", () => {
    it("rejects PayPal capture if payment is in non-transitionable state", async () => {
      orderRepository.findById.mockResolvedValueOnce({
        _id: orderId,
        customerId,
        grandTotal: "750.00",
        currency: "INR",
      });

      paymentRepository.findByGatewayOrderId.mockResolvedValueOnce({
        _id: paymentId,
        orderId,
        gateway: "paypal",
        gatewayOrderId: "PP-ORDER-INVALID",
        status: "refunded", // Non-transitionable to captured!
      });

      await expect(
        paymentService.capturePayPalOrder({
          orderId,
          userId,
          paypalOrderId: "PP-ORDER-INVALID",
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "INVALID_PAYMENT_STATUS_TRANSITION",
      });

      expect(paypalProvider.captureOrder).not.toHaveBeenCalled();
    });

    it("validates captured amount and currency in capturePayPalOrder", async () => {
      orderRepository.findById.mockResolvedValueOnce({
        _id: orderId,
        customerId,
        grandTotal: "750.00",
        currency: "INR",
      });

      paymentRepository.findByGatewayOrderId.mockResolvedValueOnce({
        _id: paymentId,
        orderId,
        gateway: "paypal",
        gatewayOrderId: "PP-ORDER-AMOUNT-MISMATCH",
        status: "created",
      });

      paypalProvider.captureOrder.mockResolvedValueOnce({
        status: "COMPLETED",
        purchase_units: [
          {
            payments: {
              captures: [
                {
                  id: "CAP-123",
                  amount: { value: "100.00", currency_code: "INR" }, // Mismatch: order is 750.00
                },
              ],
            },
          },
        ],
      });

      await expect(
        paymentService.capturePayPalOrder({
          orderId,
          userId,
          paypalOrderId: "PP-ORDER-AMOUNT-MISMATCH",
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "PAYPAL_AMOUNT_MISMATCH",
      });

      expect(orderService.markOrderPaymentCaptured).not.toHaveBeenCalled();
    });

    it("reconciles gracefully if PayPal order was already captured on gateway", async () => {
      orderRepository.findById.mockResolvedValueOnce({
        _id: orderId,
        customerId,
        grandTotal: "750.00",
        currency: "INR",
      });

      paymentRepository.findByGatewayOrderId.mockResolvedValueOnce({
        _id: paymentId,
        orderId,
        gateway: "paypal",
        gatewayOrderId: "PP-ORDER-ALREADY-CAPTURED",
        status: "created",
      });

      // Gateway capture fails because already captured
      paypalProvider.captureOrder.mockRejectedValueOnce(
        new Error("ORDER_ALREADY_CAPTURED")
      );

      // Provider fetchOrder confirms COMPLETED status
      paypalProvider.fetchOrder.mockResolvedValueOnce({
        status: "COMPLETED",
        purchase_units: [
          {
            payments: {
              captures: [
                {
                  id: "CAP-ALREADY-DONE",
                  amount: { value: "750.00", currency_code: "INR" },
                },
              ],
            },
          },
        ],
      });

      paymentRepository.updateById.mockResolvedValueOnce({
        _id: paymentId,
        status: "captured",
        gatewayPaymentId: "CAP-ALREADY-DONE",
      });

      orderService.markOrderPaymentCaptured.mockResolvedValueOnce({
        _id: orderId,
        status: "confirmed",
        paymentStatus: "paid",
      });

      const payment = await paymentService.capturePayPalOrder({
        orderId,
        userId,
        paypalOrderId: "PP-ORDER-ALREADY-CAPTURED",
      });

      expect(payment.status).toBe("captured");
      expect(orderService.markOrderPaymentCaptured).toHaveBeenCalledWith(orderId);
    });
  });

  describe("6. Payment Reconciliation for PayPal and Razorpay", () => {
    it("reconciles pending PayPal payment to captured when gateway order is COMPLETED", async () => {
      const mockPayment = {
        _id: paymentId,
        orderId,
        gateway: "paypal",
        gatewayOrderId: "PP_REC_001",
        amount: "1200.00",
        currency: "INR",
        status: "pending",
      };

      const mockOrder = {
        _id: orderId,
        grandTotal: "1200.00",
        currency: "INR",
        paymentStatus: "pending",
        status: "pending",
      };

      orderRepository.findById.mockResolvedValueOnce(mockOrder);
      paypalProvider.fetchOrder.mockResolvedValueOnce({
        status: "COMPLETED",
        purchase_units: [
          {
            payments: {
              captures: [
                {
                  id: "CAP_PP_REC_001",
                  status: "COMPLETED",
                  amount: { value: "1200.00", currency_code: "INR" },
                  create_time: new Date().toISOString(),
                },
              ],
            },
          },
        ],
      });

      paymentRepository.findById.mockResolvedValueOnce(mockPayment);
      paymentRepository.reconcileActivePayment.mockResolvedValueOnce({
        ...mockPayment,
        status: "captured",
        gatewayPaymentId: "CAP_PP_REC_001",
      });

      const result = await paymentReconciliationService.reconcilePayment(mockPayment);

      expect(result.reconciled).toBe(true);
      expect(result.gatewayPaymentId).toBe("CAP_PP_REC_001");
      expect(orderService.markOrderPaymentCaptured).toHaveBeenCalledWith(orderId);
    });

    it("marks PayPal payment failed if PayPal order was voided", async () => {
      const mockPayment = {
        _id: paymentId,
        orderId,
        gateway: "paypal",
        gatewayOrderId: "PP_REC_VOID",
        status: "pending",
      };

      orderRepository.findById.mockResolvedValueOnce({ _id: orderId });
      paypalProvider.fetchOrder.mockResolvedValueOnce({
        status: "VOIDED",
      });

      paymentRepository.findById.mockResolvedValueOnce(mockPayment);
      paymentRepository.updateById.mockResolvedValueOnce({
        ...mockPayment,
        status: "failed",
      });

      const result = await paymentReconciliationService.reconcilePayment(mockPayment);

      expect(result.reconciled).toBe(true);
      expect(result.status).toBe("failed");
      expect(paymentRepository.updateById).toHaveBeenCalledWith(
        paymentId,
        expect.objectContaining({ status: "failed" })
      );
    });

    it("reconciliation fails closed when PayPal amount or currency does not match local order", async () => {
      const mockPayment = {
        _id: paymentId,
        orderId,
        gateway: "paypal",
        gatewayOrderId: "PP_REC_MISMATCH",
        status: "pending",
      };

      orderRepository.findById.mockResolvedValueOnce({
        _id: orderId,
        grandTotal: "1500.00",
        currency: "INR",
      });

      paypalProvider.fetchOrder.mockResolvedValueOnce({
        status: "COMPLETED",
        purchase_units: [
          {
            payments: {
              captures: [
                {
                  id: "CAP_MISMATCH",
                  status: "COMPLETED",
                  amount: { value: "999.00", currency_code: "INR" }, // Mismatch
                },
              ],
            },
          },
        ],
      });

      const result = await paymentReconciliationService.reconcilePayment(mockPayment);

      expect(result.reconciled).toBe(false);
      expect(result.reason).toBe("AMOUNT_OR_CURRENCY_MISMATCH");
      expect(paymentRepository.reconcileActivePayment).not.toHaveBeenCalled();
    });
  });

  describe("7. Refund Integrity & Gateway Timeout Recovery", () => {
    it("preserves refund reservation and leaves refund pending when gateway call times out", async () => {
      orderRepository.findById.mockResolvedValueOnce({
        _id: orderId,
        customerId,
        grandTotal: "1000.00",
        currency: "INR",
        paymentStatus: "paid",
        status: "confirmed",
      });

      paymentRepository.findLatestByOrderId.mockResolvedValueOnce({
        _id: paymentId,
        orderId,
        gateway: "razorpay",
        gatewayPaymentId: "pay_captured_100",
        amount: "1000.00",
        currency: "INR",
        status: "captured",
      });

      refundRepository.findByPaymentId.mockResolvedValueOnce([]); // no previous refunds
      refundRepository.findByIdempotencyKey.mockResolvedValueOnce(null);
      refundRepository.create.mockResolvedValueOnce({
        _id: new mongoose.Types.ObjectId(),
        status: "created",
        amount: "500.00",
      });

      paymentRepository.reserveRefundAmount.mockResolvedValueOnce({
        _id: paymentId,
        refundReservedAmount: "500.00",
      });

      refundRepository.updateById.mockResolvedValueOnce({
        _id: "ref-123",
        status: "pending",
      });

      // Simulate network timeout from gateway
      const timeoutError = new Error("Gateway timeout");
      timeoutError.isTimeout = true;
      timeoutError.statusCode = 504;
      timeoutError.errorCode = "GATEWAY_TIMEOUT";
      razorpayRefundProvider.createRefund.mockRejectedValueOnce(timeoutError);

      await expect(
        refundService.createRefund({
          orderId,
          userId,
          amount: "500.00",
          idempotencyKey: "refund-key-timeout-test",
        })
      ).rejects.toThrow("Gateway timeout");

      // Reservation must NOT be released!
      expect(paymentRepository.releaseRefundReservation).not.toHaveBeenCalled();
      // Refund record must be updated to pending for reconciliation, NOT failed!
      expect(refundRepository.updateById).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: "pending",
          failureReason: expect.stringContaining("Gateway timeout"),
        })
      );
    });

    it("releases refund reservation when Razorpay deterministically rejects refund (e.g. 400)", async () => {
      orderRepository.findById.mockResolvedValueOnce({
        _id: orderId,
        customerId,
        grandTotal: "1000.00",
        currency: "INR",
        paymentStatus: "paid",
        status: "confirmed",
      });

      paymentRepository.findLatestByOrderId.mockResolvedValueOnce({
        _id: paymentId,
        orderId,
        gateway: "razorpay",
        gatewayPaymentId: "pay_captured_100",
        amount: "1000.00",
        currency: "INR",
        status: "captured",
      });

      refundRepository.findByPaymentId.mockResolvedValueOnce([]);
      refundRepository.findByIdempotencyKey.mockResolvedValueOnce(null);
      refundRepository.create.mockResolvedValueOnce({
        _id: "ref-rejected",
        status: "created",
        amount: "500.00",
      });

      paymentRepository.reserveRefundAmount.mockResolvedValueOnce({
        _id: paymentId,
        refundReservedAmount: "500.00",
      });

      refundRepository.updateById.mockResolvedValueOnce({
        _id: "ref-rejected",
        status: "pending",
      });

      // Client rejection (e.g. 400 Bad Request, amount exceeds refundable)
      const clientError = new Error("Amount exceeds refundable balance");
      clientError.statusCode = 400;
      razorpayRefundProvider.createRefund.mockRejectedValueOnce(clientError);

      paymentRepository.releaseRefundReservation.mockResolvedValueOnce({
        _id: paymentId,
        refundReservedAmount: "0.00",
      });

      await expect(
        refundService.createRefund({
          orderId,
          userId,
          amount: "500.00",
          idempotencyKey: "refund-key-rejected-test",
        })
      ).rejects.toThrow("Amount exceeds refundable balance");

      // For deterministic client rejection, reservation MUST be released
      expect(paymentRepository.releaseRefundReservation).toHaveBeenCalledWith(
        paymentId,
        "500.00",
        expect.anything()
      );
      expect(refundRepository.updateById).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: "failed",
        })
      );
    });

    it("returns existing pending refund on replay with same idempotency key without calling gateway", async () => {
      orderRepository.findById.mockResolvedValueOnce({
        _id: orderId,
        customerId,
        grandTotal: "1000.00",
        currency: "INR",
        paymentStatus: "paid",
        status: "confirmed",
      });

      paymentRepository.findLatestByOrderId.mockResolvedValueOnce({
        _id: paymentId,
        orderId,
        gateway: "razorpay",
        gatewayPaymentId: "pay_captured_100",
        amount: "1000.00",
        currency: "INR",
        status: "captured",
      });

      refundRepository.findByPaymentId.mockResolvedValueOnce([]);

      const existingPendingRefund = {
        _id: "ref-pending-123",
        status: "pending",
        amount: "500.00",
        idempotencyKey: "idempotency-key-replay",
      };

      refundRepository.findByIdempotencyKey.mockResolvedValueOnce(existingPendingRefund);

      const result = await refundService.createRefund({
        orderId,
        userId,
        amount: "500.00",
        idempotencyKey: "idempotency-key-replay",
      });

      expect(result._id).toBe("ref-pending-123");
      expect(razorpayRefundProvider.createRefund).not.toHaveBeenCalled();
      expect(paymentRepository.reserveRefundAmount).not.toHaveBeenCalled();
    });
  });
});
