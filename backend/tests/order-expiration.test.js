const mongoose = require("mongoose");

jest.mock("../src/repositories/order.repository");
jest.mock("../src/repositories/payment.repository");
jest.mock("../src/repositories/inventory.repository");
jest.mock("../src/repositories/shipment.repository");
jest.mock("../src/repositories/coupon.repository");
jest.mock("../src/repositories/coupon-redemption.repository");
jest.mock("../src/services/inventory.service");
jest.mock("../src/services/notification.service");
jest.mock("../src/services/notification-outbox.service");
jest.mock("../src/services/payment-reconciliation.service");
jest.mock("../src/models/Customer");
jest.mock("../src/models/User");
jest.mock("../src/utils/withTransaction");
jest.mock("../src/integrations/payments/razorpay.provider");

const orderRepository = require("../src/repositories/order.repository");
const paymentRepository = require("../src/repositories/payment.repository");
const inventoryRepository = require("../src/repositories/inventory.repository");
const shipmentRepository = require("../src/repositories/shipment.repository");
const couponRepository = require("../src/repositories/coupon.repository");
const couponRedemptionRepository = require("../src/repositories/coupon-redemption.repository");
const inventoryService = require("../src/services/inventory.service");
const paymentReconciliationService = require("../src/services/payment-reconciliation.service");
const Customer = require("../src/models/Customer");
const User = require("../src/models/User");
const withTransaction = require("../src/utils/withTransaction");
const razorpayProvider = require("../src/integrations/payments/razorpay.provider");

const orderService = require("../src/services/order.service");
const orderExpirationService = require("../src/services/order-expiration.service");
const { createPaymentForOrder } = require("../src/services/payment.service");

describe("Pending Order & Reserved Inventory Expiration Test Suite", () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();
  const orderId = new mongoose.Types.ObjectId().toString();
  const paymentId = new mongoose.Types.ObjectId().toString();
  const variantId = new mongoose.Types.ObjectId().toString();
  const warehouseId = new mongoose.Types.ObjectId().toString();
  const inventoryId = new mongoose.Types.ObjectId().toString();

  let mockOrder;
  let mockInventory;
  let mockSession;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn().mockResolvedValue(),
      abortTransaction: jest.fn().mockResolvedValue(),
      endSession: jest.fn().mockResolvedValue(),
    };
    jest.spyOn(mongoose, "startSession").mockResolvedValue(mockSession);

    withTransaction.mockImplementation(async (callback) => {
      return callback(mockSession);
    });

    Customer.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ userId, firstName: "Test", lastName: "Customer" }),
    });
    User.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ email: "customer@example.com", firstName: "Test", lastName: "Customer" }),
      }),
    });

    mockInventory = {
      _id: inventoryId,
      productVariantId: variantId,
      warehouseId: warehouseId,
      quantityOnHand: 100,
      reserved: 2,
      available: 98,
    };

    mockOrder = {
      _id: orderId,
      orderNumber: "BB-ORD-EXP-1",
      customerId,
      status: "pending",
      paymentStatus: "pending",
      cancellationStatus: "none",
      inventoryStatus: "reserved",
      currency: "INR",
      grandTotal: mongoose.Types.Decimal128.fromString("500.00"),
      createdAt: new Date(Date.now() - 40 * 60 * 1000), // 40 minutes old
      items: [
        {
          _id: new mongoose.Types.ObjectId().toString(),
          productId: new mongoose.Types.ObjectId().toString(),
          productVariantId: variantId,
          warehouseId,
          vendorId: new mongoose.Types.ObjectId().toString(),
          sku: "SKU-EXP-1",
          productName: "Test Product",
          quantity: 2,
          unitPrice: mongoose.Types.Decimal128.fromString("250.00"),
          lineTotal: mongoose.Types.Decimal128.fromString("500.00"),
          currency: "INR",
          inventoryStatus: "reserved",
        },
      ],
    };

    orderRepository.findById.mockResolvedValue(mockOrder);
    orderRepository.updateById.mockImplementation((id, data) =>
      Promise.resolve({ ...mockOrder, ...data })
    );
    orderRepository.transitionStatusIfCurrent.mockImplementation((id, expectedStatus, data) => {
      if (mockOrder.status === expectedStatus) {
        mockOrder.status = data.status || mockOrder.status;
        return Promise.resolve({ ...mockOrder, ...data });
      }
      return Promise.resolve(null);
    });
    inventoryRepository.findByVariantAndWarehouse.mockResolvedValue(mockInventory);
    inventoryService.releaseStockInTransaction.mockResolvedValue(mockInventory);
    shipmentRepository.findByOrderId.mockResolvedValue([]);
    shipmentRepository.updateById.mockResolvedValue({});
    paymentRepository.cancelUncompletedPayment.mockResolvedValue({
      _id: paymentId,
      status: "cancelled",
    });
  });

  describe("1. Payment State & Safety Matrix", () => {
    it("1. no-payment abandonment: pending order with no payment records expires and releases inventory exactly once", async () => {
      orderRepository.findEligibleForExpiration.mockResolvedValue([mockOrder]);
      paymentRepository.findByOrderId.mockResolvedValue([]);

      const result = await orderExpirationService.reconcileAndExpirePendingOrders();

      expect(result.scanned).toBe(1);
      expect(result.expired).toBe(1);
      expect(inventoryService.releaseStockInTransaction).toHaveBeenCalledTimes(1);
      expect(inventoryService.releaseStockInTransaction).toHaveBeenCalledWith(
        mockInventory._id,
        2,
        expect.objectContaining({
          referenceType: "order",
          referenceId: mockOrder.orderNumber,
          idempotencyKey: `order-reservation-release-${orderId}-${variantId}-${warehouseId}`,
        }),
        mockSession
      );
      expect(orderRepository.transitionStatusIfCurrent).toHaveBeenCalledWith(
        orderId,
        "pending",
        expect.objectContaining({
          status: "cancelled",
          cancellationStatus: "completed",
          inventoryStatus: "released",
          paymentStatus: "failed",
        }),
        expect.anything()
      );
    });

    it("2. failed/cancelled-only payments: order with failed payment expires safely and releases inventory", async () => {
      orderRepository.findEligibleForExpiration.mockResolvedValue([mockOrder]);
      paymentRepository.findByOrderId.mockResolvedValue([
        {
          _id: paymentId,
          orderId,
          status: "failed",
          amount: mongoose.Types.Decimal128.fromString("500.00"),
          currency: "INR",
        },
      ]);

      const result = await orderExpirationService.reconcileAndExpirePendingOrders();

      expect(result.scanned).toBe(1);
      expect(result.expired).toBe(1);
      expect(inventoryService.releaseStockInTransaction).toHaveBeenCalledTimes(1);
    });

    it("3. captured payment safety: captured payment prevents expiration and confirms order when consistent", async () => {
      orderRepository.findEligibleForExpiration.mockResolvedValue([mockOrder]);
      paymentRepository.findByOrderId.mockResolvedValue([
        {
          _id: paymentId,
          orderId,
          status: "captured",
          amount: mongoose.Types.Decimal128.fromString("500.00"),
          currency: "INR",
        },
      ]);

      const markCapturedSpy = jest.spyOn(orderService, "markOrderPaymentCaptured");

      const result = await orderExpirationService.reconcileAndExpirePendingOrders();

      expect(result.expired).toBe(0);
      expect(result.reconciled).toBe(1);
      expect(inventoryService.releaseStockInTransaction).not.toHaveBeenCalled();
      expect(markCapturedSpy).toHaveBeenCalledWith(orderId);
    });

    it("3b. captured payment safety: fails closed when captured payment data is inconsistent with order", async () => {
      orderRepository.findEligibleForExpiration.mockResolvedValue([mockOrder]);
      // Inconsistent amount: payment amount 100 vs order total 500
      paymentRepository.findByOrderId.mockResolvedValue([
        {
          _id: paymentId,
          orderId,
          status: "captured",
          amount: mongoose.Types.Decimal128.fromString("100.00"),
          currency: "INR",
        },
      ]);

      const markCapturedSpy = jest.spyOn(orderService, "markOrderPaymentCaptured");

      const result = await orderExpirationService.reconcileAndExpirePendingOrders();

      expect(result.expired).toBe(0);
      expect(result.skipped).toBe(1);
      expect(inventoryService.releaseStockInTransaction).not.toHaveBeenCalled();
      expect(markCapturedSpy).not.toHaveBeenCalled();
    });

    it("4. authorized payment safety (HARD RULE): order with authorized payment is strictly skipped without releasing inventory", async () => {
      orderRepository.findEligibleForExpiration.mockResolvedValue([mockOrder]);
      paymentRepository.findByOrderId.mockResolvedValue([
        {
          _id: paymentId,
          orderId,
          status: "authorized",
          amount: mongoose.Types.Decimal128.fromString("500.00"),
          currency: "INR",
        },
      ]);

      const result = await orderExpirationService.reconcileAndExpirePendingOrders();

      expect(result.expired).toBe(0);
      expect(result.skipped).toBe(1);
      expect(paymentRepository.cancelUncompletedPayment).not.toHaveBeenCalled();
      expect(inventoryService.releaseStockInTransaction).not.toHaveBeenCalled();
    });

    it("5. active created/pending payment with unpaid gateway: reconciles with Razorpay and expires safely when confirmed unpaid", async () => {
      orderRepository.findEligibleForExpiration.mockResolvedValue([mockOrder]);
      const activePayment = {
        _id: paymentId,
        orderId,
        status: "created",
        gatewayOrderId: "order_rzp_123",
        amount: mongoose.Types.Decimal128.fromString("500.00"),
        currency: "INR",
      };
      paymentRepository.findByOrderId.mockResolvedValue([activePayment]);

      // Razorpay reports order unpaid
      paymentReconciliationService.reconcilePayment.mockResolvedValue({
        reconciled: false,
        reason: "GATEWAY_ORDER_NOT_PAID",
      });

      const result = await orderExpirationService.reconcileAndExpirePendingOrders();

      expect(result.expired).toBe(1);
      expect(paymentReconciliationService.reconcilePayment).toHaveBeenCalledWith(activePayment);
      expect(paymentRepository.cancelUncompletedPayment).toHaveBeenCalledWith(paymentId, expect.anything());
      expect(inventoryService.releaseStockInTransaction).toHaveBeenCalledTimes(1);
    });

    it("6. active payment with captured gateway status: reconciliation captures payment and aborts expiration", async () => {
      orderRepository.findEligibleForExpiration.mockResolvedValue([mockOrder]);
      const activePayment = {
        _id: paymentId,
        orderId,
        status: "created",
        gatewayOrderId: "order_rzp_123",
        amount: mongoose.Types.Decimal128.fromString("500.00"),
        currency: "INR",
      };
      paymentRepository.findByOrderId.mockResolvedValue([activePayment]);

      paymentReconciliationService.reconcilePayment.mockResolvedValue({
        reconciled: true,
        paymentId,
        orderId,
      });

      const result = await orderExpirationService.reconcileAndExpirePendingOrders();

      expect(result.expired).toBe(0);
      expect(result.reconciled).toBe(1);
      expect(inventoryService.releaseStockInTransaction).not.toHaveBeenCalled();
    });

    it("7. gateway uncertainty (fail-closed): Razorpay fetch error fails closed and leaves inventory untouched", async () => {
      orderRepository.findEligibleForExpiration.mockResolvedValue([mockOrder]);
      const activePayment = {
        _id: paymentId,
        orderId,
        status: "created",
        gatewayOrderId: "order_rzp_123",
        amount: mongoose.Types.Decimal128.fromString("500.00"),
        currency: "INR",
      };
      paymentRepository.findByOrderId.mockResolvedValue([activePayment]);

      paymentReconciliationService.reconcilePayment.mockResolvedValue({
        reconciled: false,
        reason: "GATEWAY_ORDER_FETCH_FAILED",
      });

      const result = await orderExpirationService.reconcileAndExpirePendingOrders();

      expect(result.expired).toBe(0);
      expect(result.skipped).toBe(1);
      expect(inventoryService.releaseStockInTransaction).not.toHaveBeenCalled();
    });

    it("8. malformed gateway response (fail-closed): unexpected reconciliation reason fails closed", async () => {
      orderRepository.findEligibleForExpiration.mockResolvedValue([mockOrder]);
      const activePayment = {
        _id: paymentId,
        orderId,
        status: "created",
        gatewayOrderId: "order_rzp_123",
        amount: mongoose.Types.Decimal128.fromString("500.00"),
        currency: "INR",
      };
      paymentRepository.findByOrderId.mockResolvedValue([activePayment]);

      paymentReconciliationService.reconcilePayment.mockResolvedValue({
        reconciled: false,
        reason: "UNEXPECTED_MALFORMED_GATEWAY_RESPONSE",
      });

      const result = await orderExpirationService.reconcileAndExpirePendingOrders();

      expect(result.expired).toBe(0);
      expect(result.skipped).toBe(1);
      expect(inventoryService.releaseStockInTransaction).not.toHaveBeenCalled();
    });
  });

  describe("2. Concurrency & Race Tests", () => {
    it("9. payment capture racing expiration: in-transaction check detects captured payment and aborts", async () => {
      paymentRepository.findByOrderId.mockResolvedValue([
        {
          _id: paymentId,
          orderId,
          status: "captured",
        },
      ]);

      await expect(
        orderService.expirePendingOrder(orderId)
      ).rejects.toThrow("Payment was captured. Cannot expire order.");

      expect(inventoryService.releaseStockInTransaction).not.toHaveBeenCalled();
    });

    it("10. webhook racing expiration: concurrent cancelUncompletedPayment conflict aborts expiration transaction", async () => {
      paymentRepository.findByOrderId.mockResolvedValue([
        {
          _id: paymentId,
          orderId,
          status: "created",
        },
      ]);
      // Concurrent webhook updated status to captured, so cancelUncompletedPayment matches 0 documents
      paymentRepository.cancelUncompletedPayment.mockResolvedValue(null);

      await expect(
        orderService.expirePendingOrder(orderId)
      ).rejects.toThrow("Payment state changed concurrently during expiration.");

      expect(inventoryService.releaseStockInTransaction).not.toHaveBeenCalled();
    });

    it("11. reconciliation racing expiration: payment authorized concurrently inside session aborts expiration", async () => {
      paymentRepository.findByOrderId.mockResolvedValue([
        {
          _id: paymentId,
          orderId,
          status: "authorized",
        },
      ]);

      await expect(
        orderService.expirePendingOrder(orderId)
      ).rejects.toThrow("Payment is authorized. Cannot expire order.");

      expect(inventoryService.releaseStockInTransaction).not.toHaveBeenCalled();
    });

    it("12. customer cancellation racing expiration: order cancelled concurrently inside session returns idempotently", async () => {
      orderRepository.findById
        .mockResolvedValueOnce(mockOrder) // Pre-check
        .mockResolvedValueOnce({          // Inside transaction
          ...mockOrder,
          status: "cancelled",
        });

      const result = await orderService.expirePendingOrder(orderId);

      expect(result.status).toBe("cancelled");
      expect(inventoryService.releaseStockInTransaction).not.toHaveBeenCalled();
    });

    it("13. two expiration attempts racing: handles E11000 duplicate key conflict on canonical key and returns cancelled order", async () => {
      paymentRepository.findByOrderId.mockResolvedValue([]);
      const duplicateKeyError = new Error("E11000 duplicate key error collection");
      duplicateKeyError.code = 11000;
      duplicateKeyError.keyPattern = { idempotencyKey: 1 };

      // Initial check sees pending order; recovery check sees cancelled order
      orderRepository.findById
        .mockResolvedValueOnce(mockOrder)
        .mockResolvedValueOnce({
          ...mockOrder,
          status: "cancelled",
        });

      withTransaction.mockImplementationOnce(async () => {
        throw duplicateKeyError;
      });

      const result = await orderService.expirePendingOrder(orderId);

      expect(result.status).toBe("cancelled");
    });
  });

  describe("3. Worker Behavior & Fault Isolation", () => {
    it("14. repeated execution idempotency: running expiration repeatedly on already cancelled orders is safe", async () => {
      const alreadyCancelledOrder = {
        ...mockOrder,
        status: "cancelled",
      };
      orderRepository.findById.mockResolvedValue(alreadyCancelledOrder);

      const result = await orderService.expirePendingOrder(orderId);

      expect(result.status).toBe("cancelled");
      expect(inventoryService.releaseStockInTransaction).not.toHaveBeenCalled();
    });

    it("15. batch fault isolation: error processing one order does not abort the batch", async () => {
      const order2Id = new mongoose.Types.ObjectId().toString();
      const order2 = {
        ...mockOrder,
        _id: order2Id,
        orderNumber: "BB-ORD-EXP-2",
      };

      orderRepository.findEligibleForExpiration.mockResolvedValue([mockOrder, order2]);

      // Order 1 throws an unexpected error in orderRepository.findById
      orderRepository.findById
        .mockRejectedValueOnce(new Error("Unexpected DB glitch on order 1"))
        .mockResolvedValue(order2);

      paymentRepository.findByOrderId.mockResolvedValue([]);

      const result = await orderExpirationService.reconcileAndExpirePendingOrders();

      expect(result.scanned).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.expired).toBe(1);
    });
  });

  describe("4. Minimal Concurrency Fixes (F-04)", () => {
    it("A. Zero-payment race: expiration claims pending order -> concurrent payment creation cannot succeed", async () => {
      orderRepository.findEligibleForExpiration.mockResolvedValue([mockOrder]);
      paymentRepository.findByOrderId.mockResolvedValue([]);

      const expireResult = await orderExpirationService.reconcileAndExpirePendingOrders();
      expect(expireResult.expired).toBe(1);
      expect(mockOrder.status).toBe("cancelled");

      Customer.findOne.mockResolvedValue({ _id: customerId, userId });
      orderRepository.findById.mockResolvedValue(mockOrder);

      await expect(
        createPaymentForOrder(orderId, userId, "idemp-key-zero-race-1")
      ).rejects.toThrow("Payment cannot be created for this order");

      expect(paymentRepository.create).not.toHaveBeenCalled();
      expect(razorpayProvider.createOrder).not.toHaveBeenCalled();
    });

    it("B. Payment creation wins: payment creation claims order first -> expiration cannot release inventory or cancel order", async () => {
      const confirmedOrder = {
        ...mockOrder,
        status: "confirmed",
        paymentStatus: "paid",
      };
      orderRepository.findById.mockResolvedValue(confirmedOrder);
      orderRepository.transitionStatusIfCurrent.mockResolvedValue(null);

      await expect(
        orderService.expirePendingOrder(orderId)
      ).rejects.toThrow("Only pending orders can be expired");

      expect(inventoryService.releaseStockInTransaction).not.toHaveBeenCalled();
    });

    it("C. Expiration wins: expiration claims order first -> payment creation fails and creates no Payment or gateway order", async () => {
      Customer.findOne.mockResolvedValue({ _id: customerId, userId });
      orderRepository.findById.mockResolvedValue(mockOrder);
      orderRepository.transitionStatusIfCurrent.mockResolvedValue(null);

      await expect(
        createPaymentForOrder(orderId, userId, "idemp-key-expiration-wins-1")
      ).rejects.toThrow("Payment cannot be created for this order");

      expect(paymentRepository.create).not.toHaveBeenCalled();
      expect(razorpayProvider.createOrder).not.toHaveBeenCalled();
    });

    it("D. Conditional order transition: transition fails when order is no longer pending", async () => {
      const actualOrderRepository = jest.requireActual("../src/repositories/order.repository");
      const Order = require("../src/models/Order");
      const findOneAndUpdateSpy = jest.spyOn(Order, "findOneAndUpdate").mockResolvedValue(null);

      const result = await actualOrderRepository.transitionStatusIfCurrent(
        orderId,
        "pending",
        { status: "cancelled" },
        { session: mockSession }
      );

      expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
        {
          _id: orderId,
          status: "pending",
        },
        {
          $set: { status: "cancelled" },
        },
        expect.objectContaining({
          session: mockSession,
          new: true,
          runValidators: true,
        })
      );
      expect(result).toBeNull();
      findOneAndUpdateSpy.mockRestore();
    });

    it("E. No inventory release occurs when the conditional order claim fails", async () => {
      paymentRepository.findByOrderId.mockResolvedValue([]);
      orderRepository.findById
        .mockResolvedValueOnce(mockOrder)
        .mockResolvedValueOnce(mockOrder)
        .mockResolvedValueOnce({ ...mockOrder, status: "confirmed" });

      orderRepository.transitionStatusIfCurrent.mockResolvedValue(null);

      await expect(
        orderService.expirePendingOrder(orderId)
      ).rejects.toThrow("Order status changed concurrently to confirmed. Cannot expire.");

      expect(inventoryService.releaseStockInTransaction).not.toHaveBeenCalled();
    });

    it("F. Existing authorized/captured protections remain intact", async () => {
      paymentRepository.findByOrderId.mockResolvedValueOnce([
        { _id: paymentId, orderId, status: "authorized" },
      ]);
      await expect(
        orderService.expirePendingOrder(orderId)
      ).rejects.toThrow("Payment is authorized. Cannot expire order.");
      expect(inventoryService.releaseStockInTransaction).not.toHaveBeenCalled();

      paymentRepository.findByOrderId.mockResolvedValueOnce([
        { _id: paymentId, orderId, status: "captured" },
      ]);
      await expect(
        orderService.expirePendingOrder(orderId)
      ).rejects.toThrow("Payment was captured. Cannot expire order.");
      expect(inventoryService.releaseStockInTransaction).not.toHaveBeenCalled();
    });

    it("G. Two expiration attempts remain safe", async () => {
      paymentRepository.findByOrderId.mockResolvedValue([]);

      const result1 = await orderService.expirePendingOrder(orderId);
      expect(result1.status).toBe("cancelled");
      expect(inventoryService.releaseStockInTransaction).toHaveBeenCalledTimes(1);

      orderRepository.findById.mockResolvedValue({
        ...mockOrder,
        status: "cancelled",
      });

      const result2 = await orderService.expirePendingOrder(orderId);
      expect(result2.status).toBe("cancelled");
      expect(inventoryService.releaseStockInTransaction).toHaveBeenCalledTimes(1);
    });
  });
});
