const mongoose = require("mongoose");
const request = require("supertest");

jest.mock("../src/repositories/payment.repository");
jest.mock("../src/repositories/order.repository");
jest.mock("../src/integrations/payments/razorpay.provider");
jest.mock("../src/models/Customer");
jest.mock("../src/models/User");

const app = require("../src/app");
const paymentRepository = require("../src/repositories/payment.repository");
const orderRepository = require("../src/repositories/order.repository");
const razorpayProvider = require("../src/integrations/payments/razorpay.provider");
const Customer = require("../src/models/Customer");
const { generateAccessToken } = require("../src/services/token.service");

describe("Task 8B.4 — Concurrent Payment Creation API & Lifecycle Hardening", () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();
  const orderId = new mongoose.Types.ObjectId().toString();

  let token;
  let mockOrder;
  let mockCustomer;

  beforeEach(() => {
    jest.clearAllMocks();

    token = generateAccessToken({ sub: userId, role: "customer" });

    mockCustomer = {
      _id: customerId,
      userId,
      isActive: true,
      deletedAt: null,
    };

    mockOrder = {
      _id: orderId,
      customerId,
      orderNumber: "BB-ORD-CONCURRENCY-1",
      grandTotal: "2500.00",
      currency: "INR",
      paymentStatus: "pending",
      status: "pending",
    };

    Customer.findOne.mockResolvedValue(mockCustomer);
    orderRepository.findById.mockResolvedValue(mockOrder);
  });

  describe("API Authentication & Idempotency Key Validation", () => {
    it("rejects unauthenticated payment creation requests with 401", async () => {
      const response = await request(app)
        .post(`/api/v1/payments/orders/${orderId}`)
        .set("Idempotency-Key", "valid-key-12345");

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("AUTHENTICATION_REQUIRED");
      expect(paymentRepository.create).not.toHaveBeenCalled();
    });

    it("rejects payment creation with missing Idempotency-Key with 400", async () => {
      const response = await request(app)
        .post(`/api/v1/payments/orders/${orderId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("INVALID_IDEMPOTENCY_KEY");
      expect(paymentRepository.create).not.toHaveBeenCalled();
    });

    it("rejects payment creation with short Idempotency-Key (< 8 chars) with 400", async () => {
      const response = await request(app)
        .post(`/api/v1/payments/orders/${orderId}`)
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", "short");

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("INVALID_IDEMPOTENCY_KEY");
      expect(paymentRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("Single-Flight & Concurrency Protection", () => {
    it("creates a single Razorpay order and returns 201 on first valid request", async () => {
      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(null);
      paymentRepository.findActiveByOrderId.mockResolvedValue(null);

      const initialPayment = {
        _id: "pay-1",
        orderId,
        customerId,
        amount: "2500.00",
        currency: "INR",
        status: "created",
        gatewayOrderId: null,
      };

      const persistedPayment = {
        ...initialPayment,
        gatewayOrderId: "order_rzp_first",
        receipt: "BB-BB-ORD-CONCURRENCY-1-ABC",
      };

      paymentRepository.create.mockResolvedValue(initialPayment);
      razorpayProvider.createOrder.mockResolvedValue({
        id: "order_rzp_first",
        status: "created",
      });
      paymentRepository.updateById.mockResolvedValue(persistedPayment);

      const response = await request(app)
        .post(`/api/v1/payments/orders/${orderId}`)
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", "first-attempt-key");

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.gatewayOrderId).toBe("order_rzp_first");
      expect(razorpayProvider.createOrder).toHaveBeenCalledTimes(1);
    });

    it("returns 409 PAYMENT_CREATION_IN_PROGRESS when an active payment has null gatewayOrderId", async () => {
      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(null);
      paymentRepository.findActiveByOrderId.mockResolvedValue({
        _id: "pay-in-flight",
        orderId,
        customerId,
        status: "created",
        gatewayOrderId: null,
        idempotencyKey: "first-attempt-key",
      });

      const response = await request(app)
        .post(`/api/v1/payments/orders/${orderId}`)
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", "first-attempt-key");

      expect(response.status).toBe(409);
      expect(response.body.code).toBe("PAYMENT_CREATION_IN_PROGRESS");
      expect(razorpayProvider.createOrder).not.toHaveBeenCalled();
      expect(paymentRepository.create).not.toHaveBeenCalled();
    });

    it("returns 409 ACTIVE_PAYMENT_EXISTS when an active payment exists with a different key", async () => {
      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(null);
      paymentRepository.findActiveByOrderId.mockResolvedValue({
        _id: "pay-existing",
        orderId,
        customerId,
        status: "created",
        gatewayOrderId: "order_rzp_existing",
        idempotencyKey: "previous-key-12345",
      });

      const response = await request(app)
        .post(`/api/v1/payments/orders/${orderId}`)
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", "new-key-67890");

      expect(response.status).toBe(409);
      expect(response.body.code).toBe("ACTIVE_PAYMENT_EXISTS");
      expect(razorpayProvider.createOrder).not.toHaveBeenCalled();
      expect(paymentRepository.create).not.toHaveBeenCalled();
    });

    it("returns 409 PAYMENT_ALREADY_AUTHORIZED if an active payment is in status authorized", async () => {
      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(null);
      paymentRepository.findActiveByOrderId.mockResolvedValue({
        _id: "pay-auth",
        orderId,
        customerId,
        status: "authorized",
        gatewayOrderId: "order_rzp_auth",
        idempotencyKey: "auth-key-12345",
      });

      const response = await request(app)
        .post(`/api/v1/payments/orders/${orderId}`)
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", "auth-key-12345");

      expect(response.status).toBe(409);
      expect(response.body.code).toBe("PAYMENT_ALREADY_AUTHORIZED");
      expect(razorpayProvider.createOrder).not.toHaveBeenCalled();
    });

    it("safely handles E11000 duplicate key race and returns 409 PAYMENT_CREATION_IN_PROGRESS when loser races with winner", async () => {
      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(null);
      paymentRepository.findActiveByOrderId.mockResolvedValueOnce(null);

      const duplicateError = new Error("E11000 duplicate key error");
      duplicateError.code = 11000;
      paymentRepository.create.mockRejectedValue(duplicateError);

      paymentRepository.findActiveByOrderId.mockResolvedValueOnce({
        _id: "pay-winner-in-flight",
        orderId,
        customerId,
        status: "created",
        gatewayOrderId: null,
      });

      const response = await request(app)
        .post(`/api/v1/payments/orders/${orderId}`)
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", "racing-concurrent-key");

      expect(response.status).toBe(409);
      expect(response.body.code).toBe("PAYMENT_CREATION_IN_PROGRESS");
      expect(razorpayProvider.createOrder).not.toHaveBeenCalled();
    });

    it("safely handles E11000 duplicate key race and returns completed payment if winner finished", async () => {
      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(null);
      paymentRepository.findActiveByOrderId.mockResolvedValueOnce(null);

      const duplicateError = new Error("E11000 duplicate key error");
      duplicateError.code = 11000;
      paymentRepository.create.mockRejectedValue(duplicateError);

      paymentRepository.findActiveByOrderId.mockResolvedValueOnce({
        _id: "pay-winner-done",
        orderId,
        customerId,
        status: "created",
        gatewayOrderId: "order_rzp_winner_done",
        idempotencyKey: "racing-same-key",
      });

      const response = await request(app)
        .post(`/api/v1/payments/orders/${orderId}`)
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", "racing-same-key");

      expect(response.status).toBe(201);
      expect(response.body.data.gatewayOrderId).toBe("order_rzp_winner_done");
      expect(razorpayProvider.createOrder).not.toHaveBeenCalled();
    });

    it("marks payment failed and drops it out of active uniqueness when Razorpay returns 502", async () => {
      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(null);
      paymentRepository.findActiveByOrderId.mockResolvedValue(null);

      const createdPayment = {
        _id: "pay-will-fail",
        orderId,
        customerId,
        status: "created",
        gatewayOrderId: null,
      };

      paymentRepository.create.mockResolvedValue(createdPayment);
      razorpayProvider.createOrder.mockRejectedValue(new Error("Razorpay timeout"));
      paymentRepository.updateById.mockResolvedValue({
        ...createdPayment,
        status: "failed",
        failureReason: "Razorpay timeout",
      });

      const response = await request(app)
        .post(`/api/v1/payments/orders/${orderId}`)
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", "failing-attempt-key");

      expect(response.status).toBe(500); // unhandled Error -> 500 or AppError 502
      expect(paymentRepository.updateById).toHaveBeenCalledWith(
        "pay-will-fail",
        expect.objectContaining({
          status: "failed",
          failureReason: "Razorpay timeout",
        })
      );
    });
  });
});
