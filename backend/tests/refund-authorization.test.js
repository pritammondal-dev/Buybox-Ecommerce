const request = require("supertest");
const mongoose = require("mongoose");

jest.mock("../src/services/refund.service");
jest.mock("../src/repositories/payment.repository");
jest.mock("../src/repositories/order.repository");
jest.mock("../src/repositories/refund.repository");
jest.mock("../src/repositories/payment-webhook-event.repository");
jest.mock("../src/integrations/payments/razorpay.provider");
jest.mock("../src/integrations/payments/razorpay-refund.provider");
jest.mock("../src/services/order.service");
jest.mock("../src/models/Customer");
jest.mock("../src/models/User");
jest.mock("../src/services/notification");

const app = require("../src/app");
const refundService = require("../src/services/refund.service");
const paymentRepository = require("../src/repositories/payment.repository");
const orderRepository = require("../src/repositories/order.repository");
const refundRepository = require("../src/repositories/refund.repository");
const paymentWebhookEventRepository = require("../src/repositories/payment-webhook-event.repository");
const razorpayProvider = require("../src/integrations/payments/razorpay.provider");
const orderService = require("../src/services/order.service");
const Customer = require("../src/models/Customer");
const User = require("../src/models/User");

const { generateAccessToken } = require("../src/services/token.service");
const { verifyRazorpayPayment } = require("../src/services/payment-verification.service");
const { captureRazorpayPayment } = require("../src/services/payment-capture.service");
const { processPaymentWebhookEvent } = require("../src/services/payment-webhook-processor.service");
const { processRefundWebhook } = require("../src/services/refund-webhook.service");

describe("Refund Authorization & Payment Invariants (Task 8B.2)", () => {
  const adminUserId = new mongoose.Types.ObjectId().toString();
  const customerUserId = new mongoose.Types.ObjectId().toString();
  const orderId = new mongoose.Types.ObjectId().toString();

  let adminToken;
  let customerToken;
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

    adminToken = generateAccessToken({ sub: adminUserId, role: "admin" });
    customerToken = generateAccessToken({ sub: customerUserId, role: "customer" });
  });

  afterAll(async () => {
    jest.restoreAllMocks();
  });

  describe("1. Refund Authorization Controls", () => {
    it("Test A: rejects unauthenticated refund requests with 401", async () => {
      const response = await request(app)
        .post(`/api/v1/payments/orders/${orderId}/refunds`)
        .send({ amount: "100.00", reason: "Customer request" });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("AUTHENTICATION_REQUIRED");
      expect(refundService.createRefund).not.toHaveBeenCalled();
    });

    it("Test B: rejects authenticated customer refund requests with 403 INSUFFICIENT_PERMISSIONS", async () => {
      const response = await request(app)
        .post(`/api/v1/payments/orders/${orderId}/refunds`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ amount: "100.00", reason: "Customer request" });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("INSUFFICIENT_PERMISSIONS");
      expect(refundService.createRefund).not.toHaveBeenCalled();
    });

    it("Test C: allows authenticated admin with payments:manage to create a refund", async () => {
      refundService.createRefund.mockResolvedValue({
        _id: "refund-admin-123",
        orderId,
        amount: "100.00",
        status: "processed",
      });

      const response = await request(app)
        .post(`/api/v1/payments/orders/${orderId}/refunds`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ amount: "100.00", reason: "Admin authorized refund" });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe("refund-admin-123");
      expect(refundService.createRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId,
          amount: "100.00",
          reason: "Admin authorized refund",
          user: expect.objectContaining({
            id: adminUserId,
            role: "admin",
          }),
        })
      );
    });
  });

  describe("2. Non-Resurrection Invariants (cancelled -> captured impossible)", () => {
    it("Test D: verifyRazorpayPayment rejects with 409 INVALID_PAYMENT_STATUS_TRANSITION when payment is cancelled", async () => {
      Customer.findOne.mockResolvedValue({ _id: "cust-123" });
      orderRepository.findById.mockResolvedValue({
        _id: orderId,
        customerId: "cust-123",
        grandTotal: "2799.00",
        currency: "INR",
        status: "cancelled",
      });

      paymentRepository.findByGatewayOrderId.mockResolvedValue({
        _id: "payment-cancelled-123",
        orderId,
        customerId: "cust-123",
        gateway: "razorpay",
        gatewayOrderId: "order_TEST123",
        gatewayPaymentId: null,
        amount: "2799.00",
        currency: "INR",
        status: "cancelled",
      });

      razorpayProvider.fetchPayment.mockResolvedValue({
        id: "pay_TEST123",
        order_id: "order_TEST123",
        amount: 279900,
        currency: "INR",
        status: "captured",
        method: "card",
      });

      const signature = require("crypto")
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update("order_TEST123|pay_TEST123")
        .digest("hex");

      await expect(
        verifyRazorpayPayment({
          orderId,
          userId: "user-123",
          razorpayOrderId: "order_TEST123",
          razorpayPaymentId: "pay_TEST123",
          razorpaySignature: signature,
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "INVALID_PAYMENT_STATUS_TRANSITION",
      });

      expect(paymentRepository.updateById).not.toHaveBeenCalled();
      expect(orderService.markOrderPaymentCaptured).not.toHaveBeenCalled();
    });

    it("Test E: captureRazorpayPayment rejects with 409 INVALID_PAYMENT_STATUS_TRANSITION when payment is cancelled", async () => {
      Customer.findOne.mockResolvedValue({ _id: "cust-123" });
      orderRepository.findById.mockResolvedValue({
        _id: orderId,
        customerId: "cust-123",
        grandTotal: "2799.00",
        currency: "INR",
        status: "pending",
      });

      paymentRepository.findLatestByOrderId.mockResolvedValue({
        _id: "payment-cancelled-124",
        orderId,
        customerId: "cust-123",
        gateway: "razorpay",
        gatewayOrderId: "order_TEST124",
        gatewayPaymentId: "pay_TEST124",
        amount: "2799.00",
        currency: "INR",
        status: "cancelled",
      });

      razorpayProvider.fetchPayment.mockResolvedValue({
        id: "pay_TEST124",
        order_id: "order_TEST124",
        amount: 279900,
        currency: "INR",
        status: "captured",
        method: "card",
      });

      await expect(
        captureRazorpayPayment({
          orderId,
          userId: "user-123",
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "INVALID_PAYMENT_STATUS_TRANSITION",
      });

      expect(paymentRepository.updateById).not.toHaveBeenCalled();
      expect(orderService.markOrderPaymentCaptured).not.toHaveBeenCalled();
    });

    it("Test F: processPaymentWebhook safely ignores payment.captured when payment is cancelled", async () => {
      paymentWebhookEventRepository.findByEventId.mockResolvedValue({
        eventId: "event-123",
        eventType: "payment.captured",
        status: "pending",
        payload: {
          payload: {
            payment: {
              entity: {
                id: "pay_TEST125",
                order_id: "order_TEST125",
                amount: 279900,
                currency: "INR",
                status: "captured",
              },
            },
          },
        },
      });
      paymentWebhookEventRepository.markProcessing.mockResolvedValue(true);
      paymentWebhookEventRepository.markProcessed.mockResolvedValue(true);

      paymentRepository.findByGatewayOrderId.mockResolvedValue({
        _id: "payment-cancelled-125",
        orderId,
        gateway: "razorpay",
        gatewayOrderId: "order_TEST125",
        amount: "2799.00",
        currency: "INR",
        status: "cancelled",
      });

      orderRepository.findById.mockResolvedValue({
        _id: orderId,
        grandTotal: "2799.00",
        currency: "INR",
        status: "cancelled",
      });

      const result = await processPaymentWebhookEvent("event-123");

      expect(result.processed).toBe(true);
      expect(result.ignored).toBe(true);
      expect(result.reason).toBe("INVALID_OR_STALE_PAYMENT_TRANSITION");
      expect(paymentRepository.updateById).not.toHaveBeenCalled();
      expect(orderService.markOrderPaymentCaptured).not.toHaveBeenCalled();
    });
  });

  describe("3. Refund Webhook Fallback Reconciliation", () => {
    it("Test I: processRefundWebhook idempotently reconciles missing local refund without 404", async () => {
      // 1. Initial lookup by gatewayRefundId returns null (missing local record)
      refundRepository.findByGatewayRefundId.mockResolvedValue(null);

      // 2. Fallback lookup by gateway payment_id finds local payment
      const paymentDoc = {
        _id: "payment-fallback-126",
        orderId,
        customerId: "cust-123",
        gateway: "razorpay",
        gatewayPaymentId: "pay_TEST126",
        amount: "2799.00",
        currency: "INR",
        status: "captured",
      };
      paymentRepository.findByGatewayPaymentId.mockResolvedValue(paymentDoc);
      paymentRepository.findById.mockResolvedValue(paymentDoc);
      paymentRepository.releaseRefundReservation.mockResolvedValue(paymentDoc);

      // 3. Lookup order by payment.orderId
      const orderDoc = {
        _id: orderId,
        customerId: "cust-123",
        currency: "INR",
        paymentStatus: "paid",
      };
      orderRepository.findById.mockResolvedValue(orderDoc);

      // 4. Fallback creation creates the missing Refund in pending status
      const createdRefund = {
        _id: "refund-reconciled-126",
        paymentId: paymentDoc._id,
        orderId,
        customerId: "cust-123",
        gateway: "razorpay",
        gatewayRefundId: "rfnd_TEST126",
        amount: "2799.00",
        currency: "INR",
        status: "pending",
      };
      refundRepository.create.mockResolvedValue(createdRefund);
      refundRepository.updateById.mockResolvedValue({
        ...createdRefund,
        status: "processed",
      });

      // 5. Total processed refunds query
      refundRepository.findByPaymentId.mockResolvedValue([
        { ...createdRefund, status: "processed" },
      ]);

      // 6. Payment and order updates
      paymentRepository.updateById.mockResolvedValue({
        ...paymentDoc,
        status: "refunded",
        refundedAmount: "2799.00",
      });
      orderRepository.updateById.mockResolvedValue({
        ...orderDoc,
        paymentStatus: "refunded",
      });

      const result = await processRefundWebhook({
        eventType: "refund.processed",
        payload: {
          payload: {
            refund: {
              entity: {
                id: "rfnd_TEST126",
                payment_id: "pay_TEST126",
                amount: 279900,
                currency: "INR",
                status: "processed",
              },
            },
          },
        },
        session: mockSession,
      });

      expect(result.processed).toBe(true);
      expect(refundRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentId: paymentDoc._id,
          orderId,
          gatewayRefundId: "rfnd_TEST126",
          amount: "2799.00",
        }),
        { session: mockSession }
      );
      expect(paymentRepository.updateById).toHaveBeenCalledWith(
        paymentDoc._id,
        expect.objectContaining({
          status: "refunded",
          refundedAmount: "2799.00",
        }),
        expect.anything()
      );
    });
  });
});
