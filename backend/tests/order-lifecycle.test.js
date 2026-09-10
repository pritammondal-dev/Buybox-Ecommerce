jest.mock("../src/repositories/order.repository");
jest.mock("../src/services/notification.service");
jest.mock("../src/services/notification-outbox.service");
jest.mock("../src/services/payment.service");
jest.mock("../src/services/inventory.service");
jest.mock("../src/repositories/inventory.repository");
jest.mock("../src/models/Customer");
jest.mock("../src/models/User");
jest.mock("../src/utils/withTransaction");

const orderRepository = require("../src/repositories/order.repository");
const notificationOutboxService = require("../src/services/notification-outbox.service");
const paymentService = require("../src/services/payment.service");
const inventoryService = require("../src/services/inventory.service");
const inventoryRepository = require("../src/repositories/inventory.repository");
const Customer = require("../src/models/Customer");
const User = require("../src/models/User");
const withTransaction = require("../src/utils/withTransaction");

const {
  transitionOrderStatus,
  cancelOrder,
} = require("../src/services/order.service");

describe("Order Status Lifecycle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should confirm a pending order and set placedAt", async () => {
    const order = {
      _id: "order-123",
      status: "pending",
      placedAt: null,
    };

    const updatedOrder = {
      ...order,
      status: "confirmed",
      placedAt: new Date(),
    };

    orderRepository.findById.mockResolvedValue(order);
    orderRepository.updateById.mockResolvedValue(updatedOrder);

    const result = await transitionOrderStatus(
      "order-123",
      "confirmed"
    );

    expect(result.status).toBe("confirmed");
    expect(result.placedAt).toBeDefined();

    expect(orderRepository.updateById).toHaveBeenCalledWith(
      "order-123",
      expect.objectContaining({
        status: "confirmed",
        placedAt: expect.any(Date),
      }),
      {}
    );
  });

  it("should reject an invalid status transition", async () => {
    orderRepository.findById.mockResolvedValue({
      _id: "order-123",
      status: "pending",
    });

    await expect(
      transitionOrderStatus(
        "order-123",
        "shipped"
      )
    ).rejects.toThrow(
      "Invalid order status transition"
    );

    expect(orderRepository.updateById).not.toHaveBeenCalled();
  });

  it("should not send a notification inside a transaction", async () => {
    const order = {
      _id: "order-123",
      status: "confirmed",
    };

    const updatedOrder = {
      ...order,
      status: "processing",
    };

    orderRepository.findById.mockResolvedValue(order);
    orderRepository.updateById.mockResolvedValue(updatedOrder);

    const result = await transitionOrderStatus(
      "order-123",
      "processing",
      { session: {} }
    );

    expect(result.status).toBe("processing");
    expect(orderRepository.updateById).toHaveBeenCalled();
  });

  it("should cancel a pending order and enqueue cancellation notification", async () => {
    const customer = {
      _id: {
        toString: () => "customer-123",
      },
    };

    const order = {
      _id: "order-123",
      customerId: "customer-123",
      orderNumber: "BB-TEST-123",
      status: "pending",
      items: [
        {
          productVariantId: "variant-123",
          warehouseId: "warehouse-123",
          quantity: 1,
          sku: "SKU-123",
        },
      ],
    };

    const cancelledOrder = {
      ...order,
      status: "cancelled",
    };

    Customer.findOne.mockResolvedValue(customer);

    Customer.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        userId: "user-123",
      }),
    });

    User.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          email: "test@example.com",
          firstName: "Test",
          lastName: "User",
        }),
      }),
    });

    orderRepository.findById.mockResolvedValue(order);
    orderRepository.updateById.mockResolvedValue(cancelledOrder);

    withTransaction.mockImplementation(
      async (callback) => callback({})
    );

    inventoryRepository.findByVariantAndWarehouse.mockResolvedValue({
      _id: "inventory-123",
    });

    inventoryService.releaseStockInTransaction.mockResolvedValue({});

    notificationOutboxService.enqueue.mockResolvedValue({});

    const result = await cancelOrder(
      "order-123",
      {
        userId: "user-123",
      }
    );

    expect(result.status).toBe("cancelled");

    expect(
      inventoryService.releaseStockInTransaction
    ).toHaveBeenCalledWith(
      "inventory-123",
      1,
      expect.objectContaining({
        referenceType: "order",
        referenceId: "BB-TEST-123",
      }),
      {}
    );

    expect(
      notificationOutboxService.enqueue
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "order_cancellation",
        channel: "email",
        recipient: "test@example.com",
        payload: expect.objectContaining({
          customerName: expect.any(String),
          orderNumber: "BB-TEST-123",
        }),
      })
    );
  });

  it("should reject cancellation for an order owned by another customer", async () => {
    Customer.findOne.mockResolvedValue({
      _id: {
        toString: () => "customer-123",
      },
    });

    orderRepository.findById.mockResolvedValue({
      _id: "order-123",
      customerId: "customer-999",
      status: "pending",
    });

    await expect(
      cancelOrder(
        "order-123",
        {
          userId: "user-123",
        }
      )
    ).rejects.toThrow(
      "You are not allowed to access this order"
    );

    expect(withTransaction).not.toHaveBeenCalled();

    expect(
      inventoryService.releaseStockInTransaction
    ).not.toHaveBeenCalled();
  });

  it("should return an already cancelled order without releasing inventory again", async () => {
    Customer.findOne.mockResolvedValue({
      _id: {
        toString: () => "customer-123",
      },
    });

    const cancelledOrder = {
      _id: "order-123",
      customerId: "customer-123",
      orderNumber: "BB-TEST-123",
      status: "cancelled",
    };

    orderRepository.findById.mockResolvedValue(cancelledOrder);

    const result = await cancelOrder(
      "order-123",
      {
        userId: "user-123",
      }
    );

    expect(result.status).toBe("cancelled");

    expect(
      inventoryService.releaseStockInTransaction
    ).not.toHaveBeenCalled();

    expect(
      notificationOutboxService.enqueue
    ).not.toHaveBeenCalled();
  });

  it("should not refund a pending payment when cancelling an order", async () => {
    Customer.findOne.mockResolvedValue({
      _id: {
        toString: () => "customer-123",
      },
    });

    orderRepository.findById.mockResolvedValue({
      _id: "order-123",
      customerId: "customer-123",
      orderNumber: "BB-TEST-124",
      status: "pending",
      items: [],
    });

    paymentService.getLatestPaymentForOrder.mockResolvedValue({
      status: "pending",
    });

    const cancelledOrder = {
      _id: "order-123",
      customerId: "customer-123",
      orderNumber: "BB-TEST-124",
      status: "cancelled",
      items: [],
    };

    orderRepository.updateById.mockResolvedValue(
      cancelledOrder
    );

    withTransaction.mockImplementation(
      async (callback) => callback({})
    );

    const result = await cancelOrder(
      "order-123",
      {
        userId: "user-123",
      }
    );

    expect(result.status).toBe("cancelled");

    expect(
      paymentService.refundPaymentForOrder
    ).not.toHaveBeenCalled();

    expect(
      notificationOutboxService.enqueue
    ).toHaveBeenCalled();
  });

  it("should refund a captured payment before cancelling an order", async () => {
    Customer.findOne.mockResolvedValue({
      _id: {
        toString: () => "customer-123",
      },
    });

    orderRepository.findById.mockResolvedValue({
      _id: "order-123",
      customerId: "customer-123",
      orderNumber: "BB-TEST-125",
      status: "pending",
      items: [],
    });

    paymentService.getLatestPaymentForOrder.mockResolvedValue({
      status: "captured",
    });

    paymentService.refundPaymentForOrder.mockResolvedValue({
      status: "refunded",
    });

    const cancelledOrder = {
      _id: "order-123",
      customerId: "customer-123",
      orderNumber: "BB-TEST-125",
      status: "cancelled",
      items: [],
    };

    orderRepository.updateById.mockResolvedValue(
      cancelledOrder
    );

    withTransaction.mockImplementation(
      async (callback) => callback({})
    );

    const result = await cancelOrder(
      "order-123",
      {
        userId: "user-123",
      }
    );

    expect(result.status).toBe("cancelled");

    expect(
      paymentService.refundPaymentForOrder
    ).toHaveBeenCalledWith(
      "order-123",
      "user-123"
    );
  });

  it("should refund a partially refunded payment before cancelling an order", async () => {
    Customer.findOne.mockResolvedValue({
      _id: {
        toString: () => "customer-123",
      },
    });

    orderRepository.findById.mockResolvedValue({
      _id: "order-123",
      customerId: "customer-123",
      orderNumber: "BB-TEST-128",
      status: "pending",
      items: [],
    });

    paymentService.getLatestPaymentForOrder.mockResolvedValue({
      status: "partially_refunded",
    });

    paymentService.refundPaymentForOrder.mockResolvedValue({
      status: "refunded",
    });

    const cancelledOrder = {
      _id: "order-123",
      customerId: "customer-123",
      orderNumber: "BB-TEST-128",
      status: "cancelled",
      items: [],
    };

    orderRepository.updateById.mockResolvedValue(
      cancelledOrder
    );

    withTransaction.mockImplementation(
      async (callback) => callback({})
    );

    const result = await cancelOrder(
      "order-123",
      {
        userId: "user-123",
      }
    );

    expect(result.status).toBe("cancelled");

    expect(
      paymentService.refundPaymentForOrder
    ).toHaveBeenCalledWith(
      "order-123",
      "user-123"
    );
  });
  it("should not cancel an order when the captured payment refund fails", async () => {
    Customer.findOne.mockResolvedValue({
      _id: {
        toString: () => "customer-123",
      },
    });

    orderRepository.findById.mockResolvedValue({
      _id: "order-123",
      customerId: "customer-123",
      orderNumber: "BB-TEST-126",
      status: "pending",
      items: [],
    });

    paymentService.getLatestPaymentForOrder.mockResolvedValue({
      status: "captured",
    });

    paymentService.refundPaymentForOrder.mockRejectedValue(
      new Error("Refund failed")
    );

    await expect(
      cancelOrder(
        "order-123",
        {
          userId: "user-123",
        }
      )
    ).rejects.toThrow("Refund failed");

    expect(withTransaction).not.toHaveBeenCalled();

    expect(
      inventoryService.releaseStockInTransaction
    ).not.toHaveBeenCalled();
  });

  it("should block cancellation for an authorized payment", async () => {
    Customer.findOne.mockResolvedValue({
      _id: {
        toString: () => "customer-123",
      },
    });

    orderRepository.findById.mockResolvedValue({
      _id: "order-123",
      customerId: "customer-123",
      orderNumber: "BB-TEST-127",
      status: "pending",
      items: [],
    });

    paymentService.getLatestPaymentForOrder.mockResolvedValue({
      status: "authorized",
    });

    await expect(
      cancelOrder(
        "order-123",
        {
          userId: "user-123",
        }
      )
    ).rejects.toThrow(
      "Order payment cannot be cancelled from payment status authorized"
    );

    expect(
      paymentService.refundPaymentForOrder
    ).not.toHaveBeenCalled();

    expect(withTransaction).not.toHaveBeenCalled();
  });
});



