const mongoose = require("mongoose");

jest.mock("../src/repositories/order.repository");
jest.mock("../src/repositories/shipment.repository");
jest.mock("../src/repositories/inventory.repository");
jest.mock("../src/repositories/payment.repository");
jest.mock("../src/repositories/coupon.repository");
jest.mock("../src/repositories/coupon-redemption.repository");
jest.mock("../src/services/inventory.service");
jest.mock("../src/services/notification.service");
jest.mock("../src/services/notification-outbox.service");
jest.mock("../src/services/payment.service");
jest.mock("../src/models/Customer");
jest.mock("../src/models/User");
jest.mock("../src/utils/withTransaction");

const orderRepository = require("../src/repositories/order.repository");
const shipmentRepository = require("../src/repositories/shipment.repository");
const inventoryRepository = require("../src/repositories/inventory.repository");
const paymentRepository = require("../src/repositories/payment.repository");
const inventoryService = require("../src/services/inventory.service");
const notificationOutboxService = require("../src/services/notification-outbox.service");
const Customer = require("../src/models/Customer");
const User = require("../src/models/User");
const withTransaction = require("../src/utils/withTransaction");

const orderService = require("../src/services/order.service");
const shipmentService = require("../src/services/shipment.service");

describe("Task 8B.6 F-01: Inventory Double-Release Concurrency & Idempotency", () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();
  const orderId = new mongoose.Types.ObjectId().toString();
  const shipmentId = new mongoose.Types.ObjectId().toString();
  const variantId = new mongoose.Types.ObjectId().toString();
  const warehouseId = new mongoose.Types.ObjectId().toString();
  const inventoryId = new mongoose.Types.ObjectId().toString();
  const vendorId = new mongoose.Types.ObjectId().toString();

  let mockInventory;
  let mockOrder;
  let mockShipment;
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

    notificationOutboxService.enqueue.mockResolvedValue({});

    Customer.findOne.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(customerId),
      userId,
      isActive: true,
      deletedAt: null,
    });

    Customer.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: new mongoose.Types.ObjectId(customerId),
        userId,
      }),
    });

    User.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          email: "customer@example.com",
          firstName: "Jane",
          lastName: "Doe",
        }),
      }),
    });

    mockInventory = {
      _id: inventoryId,
      productVariantId: variantId,
      warehouseId,
      onHand: 10,
      reserved: 2, // 1 for our test order, 1 for another customer's order
    };

    mockOrder = {
      _id: orderId,
      orderNumber: "BB-ORD-F01-TEST",
      customerId,
      status: "processing",
      paymentStatus: "paid",
      cancellationStatus: "none",
      fulfillmentStatus: "unfulfilled",
      items: [
        {
          _id: new mongoose.Types.ObjectId().toString(),
          productVariantId: variantId,
          warehouseId,
          sku: "SKU-F01",
          quantity: 1,
          inventoryStatus: "reserved",
          inventoryReleasedAt: null,
        },
      ],
    };

    mockShipment = {
      _id: shipmentId,
      shipmentNumber: "SHP-F01-TEST",
      orderId,
      customerId,
      vendorId,
      warehouseId,
      status: "ready_to_ship",
      inventoryStatus: "reserved",
      inventoryReleasedAt: null,
      items: [
        {
          productVariantId: variantId,
          sku: "SKU-F01",
          quantity: 1,
        },
      ],
    };

    inventoryRepository.findByVariantAndWarehouse.mockImplementation(
      async (pVarId, wId) => {
        if (
          pVarId.toString() === variantId.toString() &&
          wId.toString() === warehouseId.toString()
        ) {
          return mockInventory;
        }
        return null;
      }
    );

    inventoryRepository.findByVariant.mockImplementation(async (pVarId) => {
      if (pVarId.toString() === variantId.toString()) {
        return [mockInventory];
      }
      return [];
    });

    const executedReleaseKeys = new Set();
    inventoryService.releaseStockInTransaction.mockImplementation(
      async (invId, qty, context) => {
        if (
          context?.idempotencyKey &&
          executedReleaseKeys.has(context.idempotencyKey)
        ) {
          return { ...mockInventory };
        }
        if (context?.idempotencyKey) {
          executedReleaseKeys.add(context.idempotencyKey);
        }
        if (mockInventory.reserved < qty) {
          throw new Error("Cannot release more stock than currently reserved");
        }
        mockInventory.reserved -= qty;
        return { ...mockInventory };
      }
    );

    orderRepository.findById.mockImplementation(async (id) => {
      if (id.toString() === orderId.toString()) {
        return { ...mockOrder };
      }
      return null;
    });

    orderRepository.updateById.mockImplementation(async (id, update) => {
      if (id.toString() === orderId.toString()) {
        mockOrder = { ...mockOrder, ...update };
        return mockOrder;
      }
      return null;
    });

    shipmentRepository.findById.mockImplementation(async (id) => {
      if (id.toString() === shipmentId.toString()) {
        return { ...mockShipment };
      }
      return null;
    });

    shipmentRepository.findByOrderId.mockImplementation(async (oId) => {
      if (oId.toString() === orderId.toString()) {
        return [mockShipment];
      }
      return [];
    });

    shipmentRepository.updateById.mockImplementation(async (id, update) => {
      if (id.toString() === shipmentId.toString()) {
        mockShipment = { ...mockShipment, ...update };
        return mockShipment;
      }
      return null;
    });

    shipmentRepository.claimReservationRelease.mockImplementation(async (id) => {
      if (
        id.toString() === shipmentId.toString() &&
        mockShipment.inventoryStatus === "reserved" &&
        ["created", "ready_to_ship"].includes(mockShipment.status)
      ) {
        mockShipment.inventoryStatus = "released";
        mockShipment.inventoryReleasedAt = new Date();
        return mockShipment;
      }
      return null;
    });

    paymentRepository.findLatestByOrderId.mockResolvedValue(null);
  });

  it("1. Order cancellation releases reserved inventory once and marks items and shipments as released", async () => {
    const cancelledOrder = await orderService.cancelOrder(orderId, {
      userId,
    });

    expect(cancelledOrder.status).toBe("cancelled");
    expect(inventoryService.releaseStockInTransaction).toHaveBeenCalledTimes(1);
    expect(inventoryService.releaseStockInTransaction).toHaveBeenCalledWith(
      inventoryId,
      1,
      expect.objectContaining({
        referenceType: "order",
        referenceId: "BB-ORD-F01-TEST",
      }),
      expect.anything()
    );

    expect(mockInventory.reserved).toBe(1); // Decremented from 2 to 1
    expect(mockOrder.items[0].inventoryStatus).toBe("released");
    expect(mockOrder.items[0].inventoryReleasedAt).toBeInstanceOf(Date);
    expect(mockShipment.status).toBe("cancelled");
    expect(mockShipment.inventoryStatus).toBe("released");
  });

  it("2. Shipment cancellation AFTER order cancellation does NOT release inventory a second time", async () => {
    // Step 1: Customer cancels the order
    await orderService.cancelOrder(orderId, { userId });
    expect(inventoryService.releaseStockInTransaction).toHaveBeenCalledTimes(1);
    expect(mockInventory.reserved).toBe(1);

    // Step 2: Vendor subsequently cancels the shipment
    const updatedShipment = await shipmentService.transitionShipmentStatus({
      shipmentId,
      nextStatus: "cancelled",
    });

    expect(updatedShipment.status).toBe("cancelled");
    // Crucial check: releaseStockInTransaction was NOT called again
    expect(inventoryService.releaseStockInTransaction).toHaveBeenCalledTimes(1);
    expect(mockInventory.reserved).toBe(1); // Stays at 1, another customer's reservation is protected
  });

  it("3. Shipment cancellation BEFORE order cancellation does NOT release inventory a second time", async () => {
    // Step 1: Vendor cancels the shipment first
    const updatedShipment = await shipmentService.transitionShipmentStatus({
      shipmentId,
      nextStatus: "cancelled",
    });

    expect(updatedShipment.status).toBe("cancelled");
    expect(inventoryService.releaseStockInTransaction).toHaveBeenCalledTimes(1);
    expect(mockInventory.reserved).toBe(1);
    expect(mockShipment.inventoryStatus).toBe("released");

    // Step 2: Customer calls cancelOrder afterwards
    const cancelledOrder = await orderService.cancelOrder(orderId, { userId });

    expect(cancelledOrder.status).toBe("cancelled");
    // Crucial check: releaseStockInTransaction was NOT called a second time
    expect(inventoryService.releaseStockInTransaction).toHaveBeenCalledTimes(1);
    expect(mockInventory.reserved).toBe(1);
  });

  it("4. Repeated shipment cancellation is idempotent and releases stock exactly once", async () => {
    // First shipment cancellation
    await shipmentService.transitionShipmentStatus({
      shipmentId,
      nextStatus: "cancelled",
    });
    expect(inventoryService.releaseStockInTransaction).toHaveBeenCalledTimes(1);
    expect(mockInventory.reserved).toBe(1);

    // Second shipment cancellation attempt
    const secondCallResult = await shipmentService.transitionShipmentStatus({
      shipmentId,
      nextStatus: "cancelled",
    });

    expect(secondCallResult.status).toBe("cancelled");
    expect(inventoryService.releaseStockInTransaction).toHaveBeenCalledTimes(1);
    expect(mockInventory.reserved).toBe(1);
  });

  it("5. Concurrent cancellation operations do not reduce another order's reservation", async () => {
    // Initial state: 2 units reserved across the warehouse
    expect(mockInventory.reserved).toBe(2);

    // Run both cancellation paths concurrently
    const [orderCancelResult, shipmentCancelResult] = await Promise.all([
      orderService.cancelOrder(orderId, { userId }),
      shipmentService.transitionShipmentStatus({
        shipmentId,
        nextStatus: "cancelled",
      }),
    ]);

    expect(orderCancelResult.status).toBe("cancelled");
    expect(shipmentCancelResult.status).toBe("cancelled");

    // Reserved must ONLY have decremented by 1 (for our order), preserving the other customer's 1 reserved unit
    expect(mockInventory.reserved).toBe(1);
    expect(inventoryService.releaseStockInTransaction).toHaveBeenCalledWith(
      inventoryId,
      1,
      expect.objectContaining({
        idempotencyKey: `order-reservation-release-${orderId}-${variantId}-${warehouseId}`,
      }),
      expect.anything()
    );
  });

  it("6. Standard shipment cancellation on active order successfully releases inventory once", async () => {
    mockOrder.status = "confirmed";
    mockShipment.status = "created";

    const result = await shipmentService.transitionShipmentStatus({
      shipmentId,
      nextStatus: "cancelled",
    });

    expect(result.status).toBe("cancelled");
    expect(inventoryService.releaseStockInTransaction).toHaveBeenCalledTimes(1);
    expect(mockInventory.reserved).toBe(1);
    expect(mockShipment.inventoryStatus).toBe("released");
    expect(mockOrder.status).toBe("cancelled");
  });

  it("7. Handles E11000 idempotency conflict by returning canonical cancelled order", async () => {
    mockOrder.status = "processing";

    const duplicateError = new Error("E11000 duplicate key error collection: inventorytransactions index: idempotencyKey_1");
    duplicateError.code = 11000;
    duplicateError.keyPattern = { idempotencyKey: 1 };

    let findCount = 0;
    orderRepository.findById.mockImplementation(async (id) => {
      findCount++;
      if (findCount === 1) {
        return { ...mockOrder, status: "processing" };
      }
      return { ...mockOrder, status: "cancelled" };
    });

    withTransaction.mockImplementationOnce(async () => {
      throw duplicateError;
    });

    const result = await orderService.cancelOrder(orderId, { userId });
    expect(result.status).toBe("cancelled");
  });

  it("8. Re-throws unrelated E11000 duplicate key errors", async () => {
    mockOrder.status = "processing";

    const unrelatedError = new Error("E11000 duplicate key error collection: users index: email_1");
    unrelatedError.code = 11000;
    unrelatedError.keyPattern = { email: 1 };

    orderRepository.findById.mockImplementation(async (id) => {
      return { ...mockOrder, status: "processing" };
    });

    withTransaction.mockImplementationOnce(async () => {
      throw unrelatedError;
    });

    await expect(
      orderService.cancelOrder(orderId, { userId })
    ).rejects.toThrow("email_1");
  });

  it("9. Handles E11000 idempotency conflict in shipment status transition by returning canonical shipment", async () => {
    mockShipment.status = "ready_to_ship";
    mockShipment.inventoryStatus = "reserved";

    const duplicateError = new Error("E11000 duplicate key error collection: inventorytransactions index: idempotencyKey_1");
    duplicateError.code = 11000;
    duplicateError.keyPattern = { idempotencyKey: 1 };

    inventoryService.releaseStockInTransaction.mockRejectedValueOnce(duplicateError);

    let findShipmentCount = 0;
    shipmentRepository.findById.mockImplementation(async (id) => {
      findShipmentCount++;
      if (findShipmentCount === 1) {
        return { ...mockShipment, status: "ready_to_ship", inventoryStatus: "reserved" };
      }
      return { ...mockShipment, status: "cancelled", inventoryStatus: "released" };
    });

    const result = await shipmentService.transitionShipmentStatus({
      shipmentId,
      nextStatus: "cancelled",
    });

    expect(result.status).toBe("cancelled");
    expect(mockSession.abortTransaction).toHaveBeenCalled();
  });

  it("10. InventoryTransaction schema defines partial unique index with explicit name 'inventoryTransaction_idempotencyKey_unique'", () => {
    const InventoryTransaction = require("../src/models/InventoryTransaction");
    const indexes = InventoryTransaction.schema.indexes();

    const idempotencyIndex = indexes.find(([fields, options]) => {
      return (
        fields.idempotencyKey === 1 &&
        Object.keys(fields).length === 1 &&
        options.unique === true &&
        options.name === "inventoryTransaction_idempotencyKey_unique" &&
        options.partialFilterExpression?.idempotencyKey?.$type === "string"
      );
    });

    expect(idempotencyIndex).toBeDefined();
  });

  it("11. InventoryTransaction schema has no duplicate or conflicting standalone indexes on idempotencyKey", () => {
    const InventoryTransaction = require("../src/models/InventoryTransaction");
    const indexes = InventoryTransaction.schema.indexes();

    const standaloneIdempotencyIndexes = indexes.filter(([fields]) => {
      return fields.idempotencyKey !== undefined && Object.keys(fields).length === 1;
    });

    expect(standaloneIdempotencyIndexes).toHaveLength(1);
    expect(standaloneIdempotencyIndexes[0][1].name).toBe(
      "inventoryTransaction_idempotencyKey_unique"
    );
  });
});

