jest.mock("../src/repositories/order.repository");
jest.mock("../src/repositories/payment.repository");
jest.mock("../src/integrations/payments/razorpay.provider");
jest.mock("../src/models/Customer");

const orderRepository = require("../src/repositories/order.repository");
const paymentRepository = require("../src/repositories/payment.repository");
const razorpayProvider = require("../src/integrations/payments/razorpay.provider");
const Customer = require("../src/models/Customer");

const {
  createPaymentForOrder,
  refundPaymentForOrder,
} = require("../src/services/payment.service");

describe("Payment Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    ).rejects.toThrow();

    expect(
      razorpayProvider.refundPayment
    ).not.toHaveBeenCalled();
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
});

