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

const {
  verifyRazorpayPayment,
} = require("../src/services/payment-verification.service");

describe("Razorpay Payment Verification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("verifies a captured Razorpay payment and confirms the order", async () => {
    const order = {
      _id: "order-123",
      customerId: "customer-123",
      grandTotal: "2799.00",
      currency: "INR",
      status: "pending",
    };

    const customer = {
      _id: "customer-123",
    };

    const payment = {
      _id: "payment-123",
      orderId: "order-123",
      customerId: "customer-123",
      gateway: "razorpay",
      gatewayOrderId: "order_TEST123",
      gatewayPaymentId: null,
      amount: "2799.00",
      currency: "INR",
      status: "created",
    };

    const updatedPayment = {
      ...payment,
      gatewayPaymentId: "pay_TEST123",
      status: "captured",
      method: "upi",
    };

    Customer.findOne.mockResolvedValue(customer);
    orderRepository.findById.mockResolvedValue(order);

    paymentRepository.findByGatewayOrderId.mockResolvedValue(payment);

    razorpayProvider.fetchPayment.mockResolvedValue({
      id: "pay_TEST123",
      order_id: "order_TEST123",
      amount: 279900,
      currency: "INR",
      status: "captured",
      method: "upi",
    });

    paymentRepository.updateById.mockResolvedValue(updatedPayment);

    orderService.markOrderPaymentCaptured.mockResolvedValue({
      ...order,
      status: "confirmed",
      paymentStatus: "paid",
    });

    const signature = require("crypto")
      .createHmac(
        "sha256",
        process.env.RAZORPAY_KEY_SECRET
      )
      .update("order_TEST123|pay_TEST123")
      .digest("hex");

    const result = await verifyRazorpayPayment({
      orderId: "order-123",
      userId: "user-123",
      razorpayOrderId: "order_TEST123",
      razorpayPaymentId: "pay_TEST123",
      razorpaySignature: signature,
    });

    expect(result.status).toBe("captured");

    expect(
      razorpayProvider.fetchPayment
    ).toHaveBeenCalledWith("pay_TEST123");

    expect(
      orderService.markOrderPaymentCaptured
    ).toHaveBeenCalledWith("order-123");
  });
});
