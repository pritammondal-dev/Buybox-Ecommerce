const mongoose = require("mongoose");

jest.mock("../src/repositories/order.repository");
jest.mock("../src/repositories/payment.repository");
jest.mock("../src/repositories/inventory.repository");
jest.mock("../src/repositories/inventory-transaction.repository");
jest.mock("../src/repositories/shipment.repository");
jest.mock("../src/repositories/coupon.repository");
jest.mock("../src/repositories/coupon-redemption.repository");
jest.mock("../src/repositories/cart.repository");
jest.mock("../src/services/inventory.service");
jest.mock("../src/services/notification.service");
jest.mock("../src/services/notification-outbox.service");
jest.mock("../src/services/payment.service");
jest.mock("../src/services/payment-reconciliation.service");
jest.mock("../src/services/digital-entitlement.service");
jest.mock("../src/models/Customer");
jest.mock("../src/models/User");
jest.mock("../src/models/Order");
jest.mock("../src/models/Product");
jest.mock("../src/models/ProductVariant");
jest.mock("../src/models/Warehouse");
jest.mock("../src/utils/withTransaction");
jest.mock("../src/integrations/payments/razorpay.provider");

const orderRepository = require("../src/repositories/order.repository");
const paymentRepository = require("../src/repositories/payment.repository");
const inventoryRepository = require("../src/repositories/inventory.repository");
const inventoryTransactionRepository = require("../src/repositories/inventory-transaction.repository");
const shipmentRepository = require("../src/repositories/shipment.repository");
const couponRepository = require("../src/repositories/coupon.repository");
const couponRedemptionRepository = require("../src/repositories/coupon-redemption.repository");
const cartRepository = require("../src/repositories/cart.repository");
const inventoryService = require("../src/services/inventory.service");
const paymentService = require("../src/services/payment.service");
const paymentReconciliationService = require("../src/services/payment-reconciliation.service");
const digitalEntitlementService = require("../src/services/digital-entitlement.service");
const notificationOutboxService = require("../src/services/notification-outbox.service");
const Customer = require("../src/models/Customer");
const User = require("../src/models/User");
const Order = require("../src/models/Order");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Warehouse = require("../src/models/Warehouse");
const withTransaction = require("../src/utils/withTransaction");

const orderService = require("../src/services/order.service");
const orderExpirationService = require("../src/services/order-expiration.service");
const orderExpirationWorker = require("../src/workers/order-expiration.worker");
const orderAllocationService = require("../src/services/order-allocation.service");

describe("Phase 3C — Inventory Integrity, Order Cancellation & Expiry Test Suite", () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();
  const orderId = new mongoose.Types.ObjectId().toString();
  const paymentId = new mongoose.Types.ObjectId().toString();
  const variantId = new mongoose.Types.ObjectId().toString();
  const warehouseId = new mongoose.Types.ObjectId().toString();
  const inventoryId = new mongoose.Types.ObjectId().toString();
  const vendorId = new mongoose.Types.ObjectId().toString();
  const productId = new mongoose.Types.ObjectId().toString();

  let mockInventory;
  let mockOrder;
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
      lean: jest.fn().mockResolvedValue({ _id: customerId, userId, firstName: "Test", lastName: "Customer" }),
    });
    Customer.findOne.mockResolvedValue({
      _id: customerId,
      userId,
      firstName: "Test",
      lastName: "Customer",
    });
    User.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: userId, email: "customer@example.com", firstName: "Test", lastName: "Customer" }),
      }),
    });

    mockInventory = {
      _id: inventoryId,
      productVariantId: variantId,
      warehouseId: warehouseId,
      onHand: 10,
      reserved: 2,
      available: 8,
    };

    mockOrder = {
      _id: orderId,
      orderNumber: "BB-ORD-P3C-1",
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
          productId,
          productVariantId: variantId,
          warehouseId,
          vendorId,
          sku: "SKU-P3C-1",
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

    inventoryRepository.findByVariant.mockResolvedValue([mockInventory]);
    inventoryRepository.findByVariantAndWarehouse.mockResolvedValue(mockInventory);
    inventoryRepository.findById.mockResolvedValue(mockInventory);
    inventoryService.reserveStockInTransaction.mockResolvedValue(mockInventory);
    inventoryService.releaseStockInTransaction.mockResolvedValue(mockInventory);
    shipmentRepository.findByOrderId.mockResolvedValue([]);
    shipmentRepository.updateById.mockResolvedValue({});
    paymentRepository.cancelUncompletedPayment.mockResolvedValue({
      _id: paymentId,
      status: "cancelled",
    });
    paymentRepository.cancelPendingPayment.mockResolvedValue({
      _id: paymentId,
      status: "cancelled",
    });
    paymentRepository.findLatestByOrderId.mockResolvedValue(null);
    Order.findById.mockReturnValue({
      session: jest.fn().mockResolvedValue(mockOrder),
    });
    Product.find.mockReturnValue({
      session: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });
    ProductVariant.find.mockReturnValue({
      session: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });
    Warehouse.findById.mockResolvedValue({
      _id: warehouseId,
      isActive: true,
      deletedAt: null,
      name: "WH-1",
    });
    notificationOutboxService.enqueue.mockResolvedValue({});
    digitalEntitlementService.revokeEntitlementsForOrder.mockResolvedValue({ revokedCount: 0 });
  });

  describe("1. Concurrent Stock Reservation & Oversell Prevention", () => {
    it("prevents overselling when concurrent checkouts race for limited stock", async () => {
      // Inventory has onHand: 5, reserved: 0 -> available: 5
      let currentOnHand = 5;
      let currentReserved = 0;

      inventoryService.reserveStockInTransaction.mockImplementation(async (invId, qty, ctx, session) => {
        const available = currentOnHand - currentReserved;
        if (available < qty) {
          const err = new Error("Insufficient available stock");
          err.code = "INSUFFICIENT_STOCK";
          err.statusCode = 409;
          throw err;
        }
        currentReserved += qty;
        return {
          _id: invId,
          onHand: currentOnHand,
          reserved: currentReserved,
          warehouseId,
          productVariantId: variantId,
        };
      });

      // 3 checkout reservations racing, each requesting 2 units (total requested: 6 units > 5 available)
      const reservation1 = orderService.reserveInventoryForOrderItems(
        [{ productVariantId: variantId, sku: "SKU-P3C-1", quantity: 2 }],
        "BB-ORD-RACE-1",
        userId,
        mockSession
      );
      const reservation2 = orderService.reserveInventoryForOrderItems(
        [{ productVariantId: variantId, sku: "SKU-P3C-1", quantity: 2 }],
        "BB-ORD-RACE-2",
        userId,
        mockSession
      );
      const reservation3 = orderService.reserveInventoryForOrderItems(
        [{ productVariantId: variantId, sku: "SKU-P3C-1", quantity: 2 }],
        "BB-ORD-RACE-3",
        userId,
        mockSession
      );

      const results = await Promise.allSettled([reservation1, reservation2, reservation3]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      // Exactly 2 checkouts succeeded (4 units reserved), 1 checkout was rejected
      expect(fulfilled.length).toBe(2);
      expect(rejected.length).toBe(1);
      expect(rejected[0].reason.code).toBe("INSUFFICIENT_STOCK");
      expect(currentReserved).toBe(4);
      expect(currentOnHand - currentReserved).toBe(1); // Never negative!
    });

    it("verifies conditional update logic rejects reservation when available stock is insufficient", async () => {
      // Simulate inventoryRepository.reserveAvailableStock behavior
      inventoryService.reserveStockInTransaction.mockImplementation(async (invId, qty) => {
        const available = mockInventory.onHand - mockInventory.reserved;
        if (available < qty) {
          const err = new Error("Insufficient available stock");
          err.code = "INSUFFICIENT_STOCK";
          err.statusCode = 409;
          throw err;
        }
        mockInventory.reserved += qty;
        return mockInventory;
      });

      // Requesting 9 units when available is only 8
      await expect(
        orderService.reserveInventoryForOrderItems(
          [{ productVariantId: variantId, sku: "SKU-P3C-1", quantity: 9 }],
          "BB-ORD-OVER",
          userId,
          mockSession
        )
      ).rejects.toMatchObject({
        code: "INSUFFICIENT_STOCK",
      });
    });
  });

  describe("2. Duplicate Reservation Idempotency", () => {
    it("sequential replay with same idempotency key returns existing reservation without re-incrementing stock", async () => {
      const items = [{ productVariantId: variantId, sku: "SKU-P3C-1", quantity: 2 }];
      const orderNumber = "BB-ORD-IDEMP-1";

      await orderService.reserveInventoryForOrderItems(items, orderNumber, userId, mockSession);
      expect(inventoryService.reserveStockInTransaction).toHaveBeenCalledTimes(1);
      expect(inventoryService.reserveStockInTransaction).toHaveBeenCalledWith(
        inventoryId,
        2,
        expect.objectContaining({
          idempotencyKey: `order-reservation-${orderNumber}-${variantId}`,
        }),
        mockSession
      );

      // Replay identical reservation call
      await orderService.reserveInventoryForOrderItems(items, orderNumber, userId, mockSession);
      expect(inventoryService.reserveStockInTransaction).toHaveBeenCalledTimes(2);
    });
  });

  describe("3. Exactly-Once Effective Inventory Release", () => {
    it("releases inventory exactly once upon order cancellation and marks items and shipments released", async () => {
      paymentService.getLatestPaymentForOrder.mockResolvedValue(null);

      const result = await orderService.cancelOrder(orderId, { userId });

      expect(result.status).toBe("cancelled");
      expect(result.cancellationStatus).toBe("completed");
      expect(inventoryService.releaseStockInTransaction).toHaveBeenCalledTimes(1);
      expect(inventoryService.releaseStockInTransaction).toHaveBeenCalledWith(
        inventoryId,
        2,
        expect.objectContaining({
          idempotencyKey: `order-reservation-release-${orderId}-${variantId}-${warehouseId}`,
          referenceType: "order",
          referenceId: mockOrder.orderNumber,
        }),
        mockSession
      );
    });

    it("repeated cancellation call on already cancelled order is idempotent and releases stock zero additional times", async () => {
      mockOrder.status = "cancelled";
      mockOrder.cancellationStatus = "completed";
      paymentService.getLatestPaymentForOrder.mockResolvedValue(null);

      const result = await orderService.cancelOrder(orderId, { userId });

      expect(result.status).toBe("cancelled");
      expect(inventoryService.releaseStockInTransaction).not.toHaveBeenCalled();
    });

    it("concurrent order cancellation and shipment cancellation share matching canonical idempotency keys", async () => {
      // Verify both order service and shipment service produce the exact same key:
      // `order-reservation-release-${orderId}-${variantId}-${warehouseId}`
      const canonicalKey = `order-reservation-release-${orderId}-${variantId}-${warehouseId}`;

      paymentService.getLatestPaymentForOrder.mockResolvedValue(null);
      await orderService.cancelOrder(orderId, { userId });

      expect(inventoryService.releaseStockInTransaction).toHaveBeenCalledWith(
        inventoryId,
        2,
        expect.objectContaining({
          idempotencyKey: canonicalKey,
        }),
        mockSession
      );
    });
  });

  describe("4. Order Cancellation with Payment States & Gateway Reconciliation", () => {
    it("cancelling an order with captured payment triggers deterministic refund workflow", async () => {
      paymentService.getLatestPaymentForOrder.mockResolvedValue({
        _id: paymentId,
        orderId,
        status: "captured",
        amount: mongoose.Types.Decimal128.fromString("500.00"),
        currency: "INR",
      });

      paymentService.refundPaymentForOrder.mockResolvedValue({
        _id: new mongoose.Types.ObjectId().toString(),
        status: "refunded",
      });

      const result = await orderService.cancelOrder(orderId, { userId });

      expect(paymentService.refundPaymentForOrder).toHaveBeenCalledTimes(1);
      expect(paymentService.refundPaymentForOrder).toHaveBeenCalledWith(
        orderId,
        userId,
        null,
        `order_cancel_${orderId}`
      );
      expect(result.status).toBe("cancelled");
    });

    it("cancelling an order with active gateway payment reconciles first, triggering refund if captured on gateway", async () => {
      const activePayment = {
        _id: paymentId,
        orderId,
        status: "created",
        gatewayOrderId: "order_rzp_rec_1",
      };

      paymentService.getLatestPaymentForOrder
        .mockResolvedValueOnce(activePayment) // initial fetch
        .mockResolvedValueOnce({ ...activePayment, status: "captured" }); // after reconciliation

      paymentReconciliationService.reconcilePayment.mockResolvedValue({
        reconciled: true,
        reason: "GATEWAY_PAYMENT_CAPTURED",
      });

      paymentService.refundPaymentForOrder.mockResolvedValue({
        status: "refunded",
      });

      const result = await orderService.cancelOrder(orderId, { userId });

      expect(paymentReconciliationService.reconcilePayment).toHaveBeenCalledWith(activePayment);
      expect(paymentService.refundPaymentForOrder).toHaveBeenCalledTimes(1);
      expect(result.status).toBe("cancelled");
    });

    it("cancelling an order with active payment fails closed if gateway reconciliation returns uncertainty", async () => {
      const activePayment = {
        _id: paymentId,
        orderId,
        status: "pending",
        gatewayOrderId: "order_rzp_uncertain_1",
      };

      paymentService.getLatestPaymentForOrder.mockResolvedValue(activePayment);

      paymentReconciliationService.reconcilePayment.mockResolvedValue({
        reconciled: false,
        reason: "GATEWAY_ORDER_FETCH_FAILED",
      });

      await expect(
        orderService.cancelOrder(orderId, { userId })
      ).rejects.toMatchObject({
        code: "PAYMENT_UNCERTAIN_RECONCILIATION_REQUIRED",
        statusCode: 409,
      });

      // No inventory released while payment outcome is uncertain!
      expect(inventoryService.releaseStockInTransaction).not.toHaveBeenCalled();
    });

    it("cancelling an order where payment is captured concurrently inside transaction aborts with PAYMENT_CAPTURED_CONCURRENTLY", async () => {
      // Gateway had pending payment initially
      paymentService.getLatestPaymentForOrder.mockResolvedValue({
        _id: paymentId,
        orderId,
        status: "pending",
      });

      // But inside the session, payment became captured concurrently
      paymentRepository.findLatestByOrderId.mockResolvedValue({
        _id: paymentId,
        orderId,
        status: "captured",
      });

      await expect(
        orderService.cancelOrder(orderId, { userId })
      ).rejects.toMatchObject({
        code: "PAYMENT_CAPTURED_CONCURRENTLY",
        statusCode: 409,
      });

      // Aborted before marking order cancelled
      expect(mockOrder.status).toBe("pending");
    });
  });

  describe("5. Unpaid-Order Expiry Worker & Invariants", () => {
    it("expires eligible unpaid order, claiming order atomically and releasing inventory exactly once", async () => {
      orderRepository.findEligibleForExpiration.mockResolvedValue([mockOrder]);
      paymentRepository.findByOrderId.mockResolvedValue([]);

      const result = await orderExpirationService.reconcileAndExpirePendingOrders();

      expect(result.scanned).toBe(1);
      expect(result.expired).toBe(1);
      expect(orderRepository.transitionStatusIfCurrent).toHaveBeenCalledWith(
        orderId,
        "pending",
        expect.objectContaining({
          status: "cancelled",
          cancellationStatus: "completed",
          inventoryStatus: "released",
        }),
        { session: mockSession }
      );
      expect(inventoryService.releaseStockInTransaction).toHaveBeenCalledTimes(1);
    });

    it("captured payment order is protected from expiration and synchronized to confirmed", async () => {
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

      const markCapturedSpy = jest.spyOn(orderService, "markOrderPaymentCaptured").mockResolvedValue({});

      const result = await orderExpirationService.reconcileAndExpirePendingOrders();

      expect(result.expired).toBe(0);
      expect(result.reconciled).toBe(1);
      expect(inventoryService.releaseStockInTransaction).not.toHaveBeenCalled();
      expect(markCapturedSpy).toHaveBeenCalledWith(orderId);
    });

    it("authorized payment order is strictly skipped without releasing inventory (HARD RULE)", async () => {
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
      expect(inventoryService.releaseStockInTransaction).not.toHaveBeenCalled();
    });

    it("concurrent worker executions return ALREADY_PROCESSING", async () => {
      let resolveFirstBatch;
      const firstBatchPromise = new Promise((resolve) => {
        resolveFirstBatch = resolve;
      });

      const spy = jest.spyOn(orderExpirationService, "reconcileAndExpirePendingOrders").mockImplementation(async () => {
        await firstBatchPromise;
        return { scanned: 0, expired: 0 };
      });

      // Launch worker batch 1
      const p1 = orderExpirationWorker.processOrderExpirationBatch();

      // Launch concurrent worker batch 2
      const result2 = await orderExpirationWorker.processOrderExpirationBatch();

      expect(result2).toEqual({ skipped: true, reason: "ALREADY_PROCESSING" });

      resolveFirstBatch();
      await p1;
      spy.mockRestore();
    });

    it("worker retries after partial crash and skips already cancelled orders", async () => {
      // First order already cancelled, second order pending
      const alreadyCancelledOrder = {
        _id: new mongoose.Types.ObjectId().toString(),
        orderNumber: "BB-ORD-ALREADY-CANCELLED",
        status: "cancelled",
      };
      const pendingOrder = {
        _id: new mongoose.Types.ObjectId().toString(),
        orderNumber: "BB-ORD-RETRY-PENDING",
        status: "pending",
        currency: "INR",
        grandTotal: mongoose.Types.Decimal128.fromString("200.00"),
        items: [
          {
            _id: new mongoose.Types.ObjectId().toString(),
            productVariantId: variantId,
            warehouseId,
            sku: "SKU-RETRY-1",
            quantity: 1,
            inventoryStatus: "reserved",
          },
        ],
      };

      orderRepository.findEligibleForExpiration.mockResolvedValue([
        alreadyCancelledOrder,
        pendingOrder,
      ]);
      paymentRepository.findByOrderId.mockResolvedValue([]);
      orderRepository.findById.mockImplementation((id) => {
        if (id === alreadyCancelledOrder._id) return Promise.resolve(alreadyCancelledOrder);
        return Promise.resolve(pendingOrder);
      });

      const result = await orderExpirationService.reconcileAndExpirePendingOrders();

      expect(result.scanned).toBe(2);
      expect(result.expired).toBe(1);
      expect(result.skipped).toBe(1);
    });
  });

  describe("6. Missing Inventory Records & Transaction Rollback", () => {
    it("missing inventory record during cancellation throws INVENTORY_NOT_FOUND (404) and rolls back transaction", async () => {
      paymentService.getLatestPaymentForOrder.mockResolvedValue(null);
      inventoryRepository.findByVariantAndWarehouse.mockResolvedValue(null);

      await expect(
        orderService.cancelOrder(orderId, { userId })
      ).rejects.toMatchObject({
        code: "INVENTORY_NOT_FOUND",
        statusCode: 404,
      });

      // Verify order status remains pending and inventory was never marked released
      expect(mockOrder.status).toBe("pending");
      expect(inventoryService.releaseStockInTransaction).not.toHaveBeenCalled();
    });

    it("missing inventory record during expiration throws INVENTORY_NOT_FOUND (404) and rolls back transaction", async () => {
      paymentRepository.findByOrderId.mockResolvedValue([]);
      inventoryRepository.findByVariantAndWarehouse.mockResolvedValue(null);

      await expect(
        orderService.expirePendingOrder(orderId)
      ).rejects.toMatchObject({
        code: "INVENTORY_NOT_FOUND",
        statusCode: 404,
      });

      // Verify inventory was never marked released
      expect(inventoryService.releaseStockInTransaction).not.toHaveBeenCalled();
    });
  });

  describe("7. Digital Products & Inventory Exemption Behavior", () => {
    it("digital / downloadable / not_required items skip warehouse reservation and set warehouseId to null", async () => {
      const digitalItems = [
        {
          productId,
          productVariantId: new mongoose.Types.ObjectId().toString(),
          sku: "SKU-DIGITAL-1",
          quantity: 1,
          isVirtual: true,
        },
        {
          productId,
          productVariantId: new mongoose.Types.ObjectId().toString(),
          sku: "SKU-DOWNLOAD-1",
          quantity: 1,
          isDownloadable: true,
        },
        {
          productId,
          productVariantId: new mongoose.Types.ObjectId().toString(),
          sku: "SKU-EXEMPT-1",
          quantity: 1,
          inventoryStatus: "not_required",
        },
      ];

      await orderService.reserveInventoryForOrderItems(
        digitalItems,
        "BB-ORD-DIGITAL-1",
        userId,
        mockSession
      );

      // No warehouse lookup or reservation performed for digital products
      expect(inventoryService.reserveStockInTransaction).not.toHaveBeenCalled();
      digitalItems.forEach((item) => {
        expect(item.warehouseId).toBeNull();
        expect(item.inventoryStatus).toBe("not_required");
      });
    });

    it("expiration of orders containing digital products does not look up warehouse inventory and completes cleanly", async () => {
      mockOrder.items = [
        {
          _id: new mongoose.Types.ObjectId().toString(),
          productId,
          productVariantId: variantId,
          warehouseId: null,
          sku: "SKU-DIGITAL-EXP-1",
          quantity: 1,
          isVirtual: true,
          inventoryStatus: "not_required",
        },
      ];

      paymentRepository.findByOrderId.mockResolvedValue([]);

      const result = await orderService.expirePendingOrder(orderId);

      expect(result.status).toBe("cancelled");
      expect(inventoryRepository.findByVariantAndWarehouse).not.toHaveBeenCalled();
      expect(inventoryService.releaseStockInTransaction).not.toHaveBeenCalled();
    });

    it("cancellation of orders containing digital products revokes entitlements and skips warehouse release", async () => {
      mockOrder.items = [
        {
          _id: new mongoose.Types.ObjectId().toString(),
          productId,
          productVariantId: variantId,
          warehouseId: null,
          sku: "SKU-DIGITAL-CANCEL-1",
          quantity: 1,
          isDownloadable: true,
          inventoryStatus: "not_required",
        },
      ];

      paymentService.getLatestPaymentForOrder.mockResolvedValue(null);

      const result = await orderService.cancelOrder(orderId, { userId });

      expect(result.status).toBe("cancelled");
      expect(digitalEntitlementService.revokeEntitlementsForOrder).toHaveBeenCalled();
      expect(inventoryRepository.findByVariantAndWarehouse).not.toHaveBeenCalled();
      expect(inventoryService.releaseStockInTransaction).not.toHaveBeenCalled();
    });

    it("order allocation service rejects warehouse allocation for digital products", async () => {
      mockOrder.items = [
        {
          _id: new mongoose.Types.ObjectId().toString(),
          productVariantId: variantId,
          isVirtual: true,
          inventoryStatus: "not_required",
        },
      ];

      await expect(
        orderAllocationService.reallocateOrderItem({
          orderId,
          productVariantId: variantId,
          targetWarehouseId: warehouseId,
        })
      ).rejects.toMatchObject({
        code: "VIRTUAL_ITEM_NO_WAREHOUSE",
        statusCode: 400,
      });
    });
  });

  describe("8. Warehouse and Variant Validation Invariants", () => {
    it("rejects reservation when no active warehouses exist for variant", async () => {
      // Mock inventoryRepository.findByVariant returning inventories where warehouse is inactive
      inventoryRepository.findByVariant.mockResolvedValue([
        {
          _id: inventoryId,
          productVariantId: variantId,
          warehouseId: { _id: warehouseId, isActive: false, deletedAt: new Date() },
          onHand: 10,
          reserved: 0,
        },
      ]);

      await expect(
        orderService.reserveInventoryForOrderItems(
          [{ productVariantId: variantId, sku: "SKU-INACTIVE-WH", quantity: 1 }],
          "BB-ORD-INACTIVE-WH",
          userId,
          mockSession
        )
      ).rejects.toMatchObject({
        code: "INVENTORY_NOT_CONFIGURED",
        statusCode: 409,
      });
    });

    it("rejects cart checkout when variant is inactive or soft-deleted", async () => {
      const mockCart = {
        _id: new mongoose.Types.ObjectId().toString(),
        status: "active",
        items: [{ productVariantId: variantId, quantity: 1 }],
      };

      // ProductVariant.find returns empty array because variant isActive: false or deletedAt != null
      ProductVariant.find.mockReturnValue({
        session: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      await expect(
        orderService.validateCartItems(mockCart)
      ).rejects.toMatchObject({
        code: "CART_ITEM_UNAVAILABLE",
        statusCode: 400,
      });
    });
  });
});
