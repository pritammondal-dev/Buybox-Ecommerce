jest.mock("../src/repositories/order.repository");
jest.mock("../src/repositories/payment.repository");
jest.mock("../src/repositories/refund.repository");
jest.mock("../src/integrations/payments/razorpay.provider");
jest.mock("../src/models/Customer");

const orderRepository = require("../src/repositories/order.repository");
const paymentRepository = require("../src/repositories/payment.repository");
const refundRepository = require("../src/repositories/refund.repository");
const razorpayProvider = require("../src/integrations/payments/razorpay.provider");
const Customer = require("../src/models/Customer");

const {
  createPaymentForOrder,
  refundPaymentForOrder,
} = require("../src/services/payment.service");
const {
  createRefund,
} = require("../src/services/refund.service");

describe("Payment Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    orderRepository.transitionStatusIfCurrent.mockImplementation((id, expectedStatus, data) => {
      return Promise.resolve({ _id: id, status: expectedStatus, ...data });
    });
  });

  it("should create a Razorpay payment order successfully", async () => {
    const customer = {
      _id: "customer-123",
    };

    const order = {
      _id: "order-123",
      customerId: "customer-123",
      orderNumber: "BB-TEST-001",
      grandTotal: "2799.00",
      currency: "INR",
      paymentStatus: "pending",
      status: "pending",
    };

    const payment = {
      _id: "payment-123",
      orderId: "order-123",
      customerId: "customer-123",
      gateway: "razorpay",
      gatewayOrderId: null,
      amount: "2799.00",
      currency: "INR",
      status: "created",
      idempotencyKey: "test-payment-001",
    };

    const updatedPayment = {
      ...payment,
      gatewayOrderId: "order_TEST123",
      receipt: "BB-BB-TEST-001-ABC123",
      metadata: {
        razorpayOrderStatus: "created",
      },
    };

    Customer.findOne.mockResolvedValue(customer);
    orderRepository.findById.mockResolvedValue(order);

    paymentRepository.findByIdempotencyKey.mockResolvedValue(null);
    paymentRepository.findLatestByOrderId.mockResolvedValue(null);

    paymentRepository.create.mockResolvedValue(payment);

    razorpayProvider.createOrder.mockResolvedValue({
      id: "order_TEST123",
      status: "created",
    });

    paymentRepository.updateById.mockResolvedValue(updatedPayment);

    const result = await createPaymentForOrder(
      "order-123",
      "user-123",
      "test-payment-001"
    );

    expect(result).toEqual(updatedPayment);

    expect(razorpayProvider.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 279900,
        currency: "INR",
        notes: {
          buyboxOrderId: "order-123",
          orderNumber: "BB-TEST-001",
        },
      })
    );

    expect(paymentRepository.create).toHaveBeenCalledTimes(1);

    expect(paymentRepository.updateById).toHaveBeenCalledWith(
      "payment-123",
      expect.objectContaining({
        gatewayOrderId: "order_TEST123",
        status: "created",
      })
    );
  });

  it("should refund a captured payment successfully", async () => {
    Customer.findOne.mockResolvedValue({
      _id: "customer-123",
    });

    orderRepository.findById.mockResolvedValue({
      _id: "order-123",
      customerId: "customer-123",
      orderNumber: "BB-TEST-002",
      grandTotal: "2799.00",
      currency: "INR",
    });

    paymentRepository.findLatestByOrderId.mockResolvedValue({
      _id: "payment-123",
      orderId: "order-123",
      customerId: "customer-123",
      amount: "2799.00",
      refundedAmount: "0.00",
      refundReservedAmount: "0.00",
      status: "captured",
      gateway: "razorpay",
      gatewayPaymentId: "pay_TEST123",
    });

    paymentRepository.reserveRefundAmount.mockResolvedValue({
      _id: "payment-123",
    });

    razorpayProvider.refundPayment.mockResolvedValue({
      id: "rfnd_TEST123",
      status: "processed",
    });

    paymentRepository.updateById.mockResolvedValue({
      _id: "payment-123",
      status: "refunded",
      refundedAmount: "2799.00",
    });

    paymentRepository.releaseRefundReservation.mockResolvedValue({});

    const result = await refundPaymentForOrder(
      "order-123",
      "user-123"
    );

    expect(
      paymentRepository.reserveRefundAmount
    ).toHaveBeenCalled();

    expect(
      razorpayProvider.refundPayment
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: "pay_TEST123",
        amount: 279900,
      })
    );

    expect(
      paymentRepository.updateById
    ).toHaveBeenCalled();

    expect(
      refundRepository.create
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: "payment-123",
        orderId: "order-123",
        gatewayRefundId: "rfnd_TEST123",
        status: "processed",
      })
    );

    expect(result.status).toBe("refunded");
  });

  it("should return an already refunded payment without calling Razorpay", async () => {
    Customer.findOne.mockResolvedValue({
      _id: "customer-123",
    });

    orderRepository.findById.mockResolvedValue({
      _id: "order-123",
      customerId: "customer-123",
    });

    const payment = {
      _id: "payment-123",
      orderId: "order-123",
      customerId: "customer-123",
      amount: "2799.00",
      refundedAmount: "2799.00",
      refundReservedAmount: "0.00",
      status: "refunded",
      gateway: "razorpay",
      gatewayPaymentId: "pay_TEST123",
    };

    paymentRepository.findLatestByOrderId.mockResolvedValue(
      payment
    );

    const result = await refundPaymentForOrder(
      "order-123",
      "user-123"
    );

    expect(result).toBe(payment);

    expect(
      razorpayProvider.refundPayment
    ).not.toHaveBeenCalled();
  });

  it("should reject refund for a payment that is not captured", async () => {
    Customer.findOne.mockResolvedValue({
      _id: "customer-123",
    });

    orderRepository.findById.mockResolvedValue({
      _id: "order-123",
      customerId: "customer-123",
    });

    paymentRepository.findLatestByOrderId.mockResolvedValue({
      _id: "payment-123",
      orderId: "order-123",
      customerId: "customer-123",
      amount: "2799.00",
      refundedAmount: "0.00",
      refundReservedAmount: "0.00",
      status: "pending",
      gateway: "razorpay",
      gatewayPaymentId: "pay_TEST123",
    });

    await expect(
      refundPaymentForOrder(
        "order-123",
        "user-123"
      )
    ).rejects.toMatchObject({
      code: "PAYMENT_NOT_REFUNDABLE",
    });

    expect(
      razorpayProvider.refundPayment
    ).not.toHaveBeenCalled();
  });

  it("should reject createRefund in refund.service with PAYMENT_NOT_REFUNDABLE when payment is not captured", async () => {
    Customer.findOne.mockResolvedValue({
      _id: "customer-123",
    });

    orderRepository.findById.mockResolvedValue({
      _id: "order-123",
      customerId: "customer-123",
      status: "delivered",
    });

    paymentRepository.findLatestByOrderId.mockResolvedValue({
      _id: "payment-123",
      orderId: "order-123",
      customerId: "customer-123",
      amount: "2799.00",
      refundedAmount: "0.00",
      refundReservedAmount: "0.00",
      status: "pending",
      gateway: "razorpay",
      gatewayPaymentId: null,
    });

    await expect(
      createRefund({
        orderId: "order-123",
        userId: "user-123",
        amount: "1000.00",
        reason: "Customer return",
        idempotencyKey: "test-refund-key",
      })
    ).rejects.toMatchObject({
      code: "PAYMENT_NOT_REFUNDABLE",
    });
  });

  it("should reject createRefund in refund.service with PAYMENT_GATEWAY_ID_MISSING when captured payment has no gatewayPaymentId", async () => {
    Customer.findOne.mockResolvedValue({
      _id: "customer-123",
    });

    orderRepository.findById.mockResolvedValue({
      _id: "order-123",
      customerId: "customer-123",
      status: "delivered",
    });

    paymentRepository.findLatestByOrderId.mockResolvedValue({
      _id: "payment-123",
      orderId: "order-123",
      customerId: "customer-123",
      amount: "2799.00",
      refundedAmount: "0.00",
      refundReservedAmount: "0.00",
      status: "captured",
      gateway: "razorpay",
      gatewayPaymentId: null,
    });

    await expect(
      createRefund({
        orderId: "order-123",
        userId: "user-123",
        amount: "1000.00",
        reason: "Customer return",
        idempotencyKey: "test-refund-key",
      })
    ).rejects.toMatchObject({
      code: "PAYMENT_GATEWAY_ID_MISSING",
    });
  });

  it("should release the refund reservation when Razorpay refund fails", async () => {
    Customer.findOne.mockResolvedValue({
      _id: "customer-123",
    });

    orderRepository.findById.mockResolvedValue({
      _id: "order-123",
      customerId: "customer-123",
    });

    paymentRepository.findLatestByOrderId.mockResolvedValue({
      _id: "payment-123",
      orderId: "order-123",
      customerId: "customer-123",
      amount: "2799.00",
      refundedAmount: "0.00",
      refundReservedAmount: "0.00",
      status: "captured",
      gateway: "razorpay",
      gatewayPaymentId: "pay_TEST123",
    });

    paymentRepository.reserveRefundAmount.mockResolvedValue({
      _id: "payment-123",
    });

    razorpayProvider.refundPayment.mockRejectedValue(
      new Error("Razorpay refund failed")
    );

    paymentRepository.releaseRefundReservation.mockResolvedValue(
      {}
    );

    await expect(
      refundPaymentForOrder(
        "order-123",
        "user-123"
      )
    ).rejects.toThrow("Razorpay refund failed");

    expect(
      paymentRepository.releaseRefundReservation
    ).toHaveBeenCalledWith(
      "payment-123",
      expect.anything()
    );
  });

  it("should generate different idempotency keys for two equal partial refunds", async () => {
    Customer.findOne.mockResolvedValue({ _id: "customer-123" });
    orderRepository.findById.mockResolvedValue({
      _id: "order-123",
      customerId: "customer-123",
      orderNumber: "BB-TEST-003",
    });

    paymentRepository.findLatestByOrderId.mockResolvedValueOnce({
      _id: "65f123456789abcdef000001",
      orderId: "order-123",
      customerId: "customer-123",
      amount: "2000.00",
      refundedAmount: "0.00",
      refundReservedAmount: "0.00",
      status: "captured",
      gateway: "razorpay",
      gatewayPaymentId: "pay_TEST123",
    });

    paymentRepository.reserveRefundAmount.mockResolvedValue({ _id: "65f123456789abcdef000001" });
    razorpayProvider.refundPayment.mockResolvedValue({ id: "rfnd_1", status: "processed" });
    paymentRepository.updateById.mockResolvedValue({
      _id: "65f123456789abcdef000001",
      status: "partially_refunded",
      refundedAmount: "500.00",
    });

    await refundPaymentForOrder("order-123", "user-123", 500);
    const firstCallKey = razorpayProvider.refundPayment.mock.calls[0][0].idempotencyKey;

    paymentRepository.findLatestByOrderId.mockResolvedValueOnce({
      _id: "65f123456789abcdef000001",
      orderId: "order-123",
      customerId: "customer-123",
      amount: "2000.00",
      refundedAmount: "500.00",
      refundReservedAmount: "0.00",
      status: "partially_refunded",
      gateway: "razorpay",
      gatewayPaymentId: "pay_TEST123",
    });

    await refundPaymentForOrder("order-123", "user-123", 500);
    const secondCallKey = razorpayProvider.refundPayment.mock.calls[1][0].idempotencyKey;

    expect(firstCallKey).toBe("rfnd-abcdef000001-0-50000");
    expect(secondCallKey).toBe("rfnd-abcdef000001-50000-50000");
    expect(firstCallKey).not.toBe(secondCallKey);
  });

  it("should generate the same idempotency key when retrying a failed refund", async () => {
    Customer.findOne.mockResolvedValue({ _id: "customer-123" });
    orderRepository.findById.mockResolvedValue({
      _id: "order-123",
      customerId: "customer-123",
      orderNumber: "BB-TEST-004",
    });

    const paymentData = {
      _id: "65f123456789abcdef000001",
      orderId: "order-123",
      customerId: "customer-123",
      amount: "2000.00",
      refundedAmount: "0.00",
      refundReservedAmount: "0.00",
      status: "captured",
      gateway: "razorpay",
      gatewayPaymentId: "pay_TEST123",
    };

    paymentRepository.findLatestByOrderId.mockResolvedValue(paymentData);
    paymentRepository.reserveRefundAmount.mockResolvedValue({ _id: paymentData._id });
    paymentRepository.releaseRefundReservation.mockResolvedValue({});

    razorpayProvider.refundPayment.mockRejectedValueOnce(new Error("Network timeout"));

    await expect(
      refundPaymentForOrder("order-123", "user-123", 500)
    ).rejects.toThrow("Network timeout");

    const attempt1Key = razorpayProvider.refundPayment.mock.calls[0][0].idempotencyKey;

    razorpayProvider.refundPayment.mockResolvedValueOnce({ id: "rfnd_RETRY", status: "processed" });
    paymentRepository.updateById.mockResolvedValue({
      _id: paymentData._id,
      status: "partially_refunded",
      refundedAmount: "500.00",
    });

    await refundPaymentForOrder("order-123", "user-123", 500);
    const attempt2Key = razorpayProvider.refundPayment.mock.calls[1][0].idempotencyKey;

    expect(attempt1Key).toBe("rfnd-abcdef000001-0-50000");
    expect(attempt2Key).toBe("rfnd-abcdef000001-0-50000");
    expect(attempt1Key).toBe(attempt2Key);
  });

  it("should generate an idempotency key <= 40 characters with valid characters", async () => {
    Customer.findOne.mockResolvedValue({ _id: "customer-123" });
    orderRepository.findById.mockResolvedValue({
      _id: "order-123",
      customerId: "customer-123",
      orderNumber: "BB-TEST-005",
    });

    paymentRepository.findLatestByOrderId.mockResolvedValue({
      _id: "65f123456789abcdef000001",
      orderId: "order-123",
      customerId: "customer-123",
      amount: "999999.00",
      refundedAmount: "500000.00",
      refundReservedAmount: "0.00",
      status: "partially_refunded",
      gateway: "razorpay",
      gatewayPaymentId: "pay_TEST123",
    });

    paymentRepository.reserveRefundAmount.mockResolvedValue({ _id: "65f123456789abcdef000001" });
    razorpayProvider.refundPayment.mockResolvedValue({ id: "rfnd_BIG", status: "processed" });
    paymentRepository.updateById.mockResolvedValue({});

    await refundPaymentForOrder("order-123", "user-123", 499999);

    const key = razorpayProvider.refundPayment.mock.calls[0][0].idempotencyKey;

    expect(key.length).toBeLessThanOrEqual(40);
    expect(/^[a-zA-Z0-9_-]+$/.test(key)).toBe(true);
  });

  describe("Concurrent Payment Creation Hardening (Task 8B.4)", () => {
    const customer = { _id: "customer-123" };
    const order = {
      _id: "order-123",
      customerId: "customer-123",
      orderNumber: "BB-TEST-CONCURRENCY",
      grandTotal: "1500.00",
      currency: "INR",
      paymentStatus: "pending",
      status: "pending",
    };

    beforeEach(() => {
      Customer.findOne.mockResolvedValue(customer);
      orderRepository.findById.mockResolvedValue(order);
    });

    it("should reject creation with 409 PAYMENT_ALREADY_AUTHORIZED when payment is authorized", async () => {
      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue({
        _id: "payment-auth",
        status: "authorized",
        gatewayOrderId: "order_auth_123",
      });

      await expect(
        createPaymentForOrder("order-123", "user-123", "idemp-key-auth-1")
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "PAYMENT_ALREADY_AUTHORIZED",
      });
    });

    it("should reject creation with 409 PAYMENT_CREATION_IN_PROGRESS when in-flight payment has null gatewayOrderId", async () => {
      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue({
        _id: "payment-in-flight",
        status: "created",
        gatewayOrderId: null,
      });

      await expect(
        createPaymentForOrder("order-123", "user-123", "idemp-key-inflight-1")
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "PAYMENT_CREATION_IN_PROGRESS",
      });
    });

    it("should reuse completed active payment on replay with same key", async () => {
      const completedPayment = {
        _id: "payment-completed",
        orderId: "order-123",
        gatewayOrderId: "order_rzp_completed",
        status: "created",
        idempotencyKey: "idemp-key-replay-1",
      };

      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(completedPayment);
      razorpayProvider.fetchOrder.mockResolvedValue({
        id: "order_rzp_completed",
        status: "created",
        amount: 150000,
        currency: "INR",
        notes: {
          buyboxOrderId: "order-123",
        },
      });

      const result = await createPaymentForOrder("order-123", "user-123", "idemp-key-replay-1");

      expect(result).toBe(completedPayment);
      expect(paymentRepository.create).not.toHaveBeenCalled();
      expect(razorpayProvider.createOrder).not.toHaveBeenCalled();
    });

    it("should reject creation with 409 ACTIVE_PAYMENT_EXISTS when gateway state cannot be verified", async () => {
      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(null);
      paymentRepository.findActiveByOrderId.mockResolvedValue({
        _id: "payment-other-key",
        orderId: "order-123",
        gatewayOrderId: "order_rzp_other",
        status: "created",
        idempotencyKey: "different-key-123",
      });
      razorpayProvider.fetchOrder.mockRejectedValue(new Error("Gateway unreachable"));

      await expect(
        createPaymentForOrder("order-123", "user-123", "new-attempt-key")
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "ACTIVE_PAYMENT_EXISTS",
      });
    });

    it("should reuse active payment when retried with a different key and gateway order is payable", async () => {
      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(null);
      const activePayment = {
        _id: "payment-reused-different-key",
        orderId: "order-123",
        gatewayOrderId: "order_rzp_reused",
        status: "created",
        idempotencyKey: "key-attempt-1",
      };
      paymentRepository.findActiveByOrderId.mockResolvedValue(activePayment);
      razorpayProvider.fetchOrder.mockResolvedValue({
        id: "order_rzp_reused",
        status: "created",
        amount: 150000,
        currency: "INR",
        notes: {
          buyboxOrderId: "order-123",
        },
      });

      const result = await createPaymentForOrder("order-123", "user-123", "key-attempt-2");

      expect(result).toBe(activePayment);
      expect(paymentRepository.create).not.toHaveBeenCalled();
      expect(razorpayProvider.createOrder).not.toHaveBeenCalled();
    });

    it("should permit fresh creation attempt when historical payment failed (no key poisoning)", async () => {
      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue({
        _id: "payment-failed-history",
        status: "failed",
        gatewayOrderId: null,
      });
      paymentRepository.findActiveByOrderId.mockResolvedValue(null);

      const newPayment = {
        _id: "payment-fresh",
        orderId: "order-123",
        customerId: "customer-123",
        status: "created",
        gatewayOrderId: null,
      };

      const updatedPayment = {
        ...newPayment,
        gatewayOrderId: "order_rzp_new",
      };

      paymentRepository.create.mockResolvedValue(newPayment);
      razorpayProvider.createOrder.mockResolvedValue({
        id: "order_rzp_new",
        status: "created",
      });
      paymentRepository.updateById.mockResolvedValue(updatedPayment);

      const result = await createPaymentForOrder("order-123", "user-123", "retry-after-fail");

      expect(result).toEqual(updatedPayment);
      expect(paymentRepository.create).toHaveBeenCalledTimes(1);
    });

    it("should handle E11000 race and return 409 PAYMENT_CREATION_IN_PROGRESS if winner is still in flight", async () => {
      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(null);
      paymentRepository.findActiveByOrderId.mockResolvedValueOnce(null);

      const duplicateError = new Error("E11000 duplicate key error");
      duplicateError.code = 11000;
      paymentRepository.create.mockRejectedValue(duplicateError);

      paymentRepository.findActiveByOrderId.mockResolvedValueOnce({
        _id: "payment-winner",
        orderId: "order-123",
        status: "created",
        gatewayOrderId: null,
      });

      await expect(
        createPaymentForOrder("order-123", "user-123", "racing-key-1")
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "PAYMENT_CREATION_IN_PROGRESS",
      });
    });

    it("should handle E11000 race and return completed payment if winner finished with same key", async () => {
      paymentRepository.findByOrderIdAndIdempotencyKey.mockResolvedValue(null);
      paymentRepository.findActiveByOrderId.mockResolvedValueOnce(null);

      const duplicateError = new Error("E11000 duplicate key error");
      duplicateError.code = 11000;
      paymentRepository.create.mockRejectedValue(duplicateError);

      const winnerPayment = {
        _id: "payment-winner",
        orderId: "order-123",
        status: "created",
        gatewayOrderId: "order_rzp_winner",
        idempotencyKey: "racing-same-key",
      };

      paymentRepository.findActiveByOrderId.mockResolvedValueOnce(winnerPayment);
      razorpayProvider.fetchOrder.mockResolvedValue({
        id: "order_rzp_winner",
        status: "created",
        amount: 150000,
        currency: "INR",
        notes: {
          buyboxOrderId: "order-123",
        },
      });

      const result = await createPaymentForOrder("order-123", "user-123", "racing-same-key");

      expect(result).toBe(winnerPayment);
    });

    it("should reject creation with 409 ORDER_ALREADY_PAID if order paymentStatus is paid", async () => {
      orderRepository.findById.mockResolvedValue({
        ...order,
        paymentStatus: "paid",
      });

      await expect(
        createPaymentForOrder("order-123", "user-123", "any-valid-key")
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "ORDER_ALREADY_PAID",
      });
    });

    it("should reject creation with 409 ORDER_NOT_PAYABLE if order status is cancelled", async () => {
      orderRepository.findById.mockResolvedValue({
        ...order,
        status: "cancelled",
      });

      await expect(
        createPaymentForOrder("order-123", "user-123", "any-valid-key")
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "ORDER_NOT_PAYABLE",
      });
    });
  });
});

describe("Payment Repository - releaseRefundReservation", () => {
  const actualPaymentRepository = jest.requireActual("../src/repositories/payment.repository");
  const Payment = require("../src/models/Payment");

  let mockPaymentDoc;
  let findOneAndUpdateSpy;

  beforeEach(() => {
    mockPaymentDoc = {
      _id: "payment-123",
      amount: "2000.00",
      refundedAmount: "0.00",
      refundReservedAmount: "500.00",
    };

    findOneAndUpdateSpy = jest.spyOn(Payment, "findOneAndUpdate").mockImplementation((filter, update, options) => {
      const targetAmount = Number(update.$inc.refundReservedAmount.toString().replace(/^-/, ""));
      const currentReserved = Number(mockPaymentDoc.refundReservedAmount);

      if (currentReserved < targetAmount) {
        return Promise.resolve(null);
      }

      const newReserved = (currentReserved + Number(update.$inc.refundReservedAmount.toString())).toFixed(2);
      mockPaymentDoc.refundReservedAmount = newReserved;

      return Promise.resolve({
        ...mockPaymentDoc,
        refundReservedAmount: newReserved,
      });
    });
  });

  afterEach(() => {
    findOneAndUpdateSpy.mockRestore();
  });

  it("should successfully release a reservation and correctly decrease refundReservedAmount", async () => {
    const result = await actualPaymentRepository.releaseRefundReservation("payment-123", "200.00");

    expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: "payment-123",
        $expr: expect.objectContaining({
          $gte: expect.any(Array),
        }),
      }),
      expect.objectContaining({
        $inc: expect.objectContaining({
          refundReservedAmount: expect.any(Object),
        }),
      }),
      expect.objectContaining({
        returnDocument: "after",
        runValidators: true,
      })
    );

    const updateCall = findOneAndUpdateSpy.mock.calls[0][1];
    expect(updateCall.$inc.refundReservedAmount.toString()).toBe("-200.00");
    expect(result).not.toBeNull();
    expect(result.refundReservedAmount).toBe("300.00");
    expect(mockPaymentDoc.refundReservedAmount).toBe("300.00");
  });

  it("should not update payment when attempted release is larger than reserved amount", async () => {
    const result = await actualPaymentRepository.releaseRefundReservation("payment-123", "600.00");

    expect(result).toBeNull();
    expect(mockPaymentDoc.refundReservedAmount).toBe("500.00");
  });
});
