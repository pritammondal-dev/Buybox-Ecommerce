const mongoose = require("mongoose");
const AppError = require("../src/errors/AppError");

jest.mock("../src/repositories/inventory.repository");
jest.mock("../src/services/inventory.service");

const inventoryRepository = require("../src/repositories/inventory.repository");
const inventoryService = require("../src/services/inventory.service");
const orderService = require("../src/services/order.service");

describe("F-05: Multi-Warehouse Inventory Reservation Fallback", () => {
  const variantId = new mongoose.Types.ObjectId().toString();
  const warehouseA = new mongoose.Types.ObjectId().toString();
  const warehouseB = new mongoose.Types.ObjectId().toString();
  const warehouseC = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();
  const orderNumber = "BB-ORD-FALLBACK-001";
  const mockSession = {};

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("1. Warehouse A has stock initially but loses it before atomic reservation; Warehouse B succeeds", async () => {
    const orderItems = [
      {
        productVariantId: variantId,
        sku: "TEST-SKU-FB",
        quantity: 5,
      },
    ];

    // Candidate warehouses: Warehouse A has 10 (avail: 5), Warehouse B has 10 (avail: 5)
    // Tie-breaker will order by warehouseId
    const wh1 = warehouseA < warehouseB ? warehouseA : warehouseB;
    const wh2 = warehouseA < warehouseB ? warehouseB : warehouseA;

    inventoryRepository.findByVariant.mockResolvedValue([
      {
        _id: "inv-wh-1",
        warehouseId: wh1,
        onHand: 10,
        reserved: 5, // 5 available
      },
      {
        _id: "inv-wh-2",
        warehouseId: wh2,
        onHand: 10,
        reserved: 5, // 5 available
      },
    ]);

    // First attempted warehouse loses stock concurrently -> throws INSUFFICIENT_STOCK
    inventoryService.reserveStockInTransaction.mockImplementationOnce(async (id) => {
      throw new AppError("Insufficient available stock", 409, "INSUFFICIENT_STOCK");
    });

    // Second warehouse succeeds
    inventoryService.reserveStockInTransaction.mockImplementationOnce(async (id) => {
      return { warehouseId: wh2 };
    });

    const result = await orderService.reserveInventoryForOrderItems(
      orderItems,
      orderNumber,
      userId,
      mockSession
    );

    expect(inventoryService.reserveStockInTransaction).toHaveBeenCalledTimes(2);
    expect(result[0].warehouseId).toBe(wh2);
  });

  it("2. Prioritizes warehouse with deepest available stock and falls back to secondary if primary loses stock", async () => {
    const orderItems = [
      {
        productVariantId: variantId,
        sku: "TEST-SKU-FB",
        quantity: 4,
      },
    ];

    // Warehouse A has 5 available, Warehouse B has 9 available
    // Warehouse B should be sorted first (9 > 5)
    inventoryRepository.findByVariant.mockResolvedValue([
      {
        _id: "inv-wh-A",
        warehouseId: warehouseA,
        onHand: 10,
        reserved: 5, // 5 available
      },
      {
        _id: "inv-wh-B",
        warehouseId: warehouseB,
        onHand: 10,
        reserved: 1, // 9 available
      },
    ]);

    // Warehouse B (first attempted) loses stock to another buyer
    inventoryService.reserveStockInTransaction.mockImplementationOnce(async (id) => {
      expect(id).toBe("inv-wh-B");
      throw new AppError("Insufficient available stock", 409, "INSUFFICIENT_STOCK");
    });

    // Warehouse A (fallback) succeeds
    inventoryService.reserveStockInTransaction.mockImplementationOnce(async (id) => {
      expect(id).toBe("inv-wh-A");
      return { warehouseId: warehouseA };
    });

    const result = await orderService.reserveInventoryForOrderItems(
      orderItems,
      orderNumber,
      userId,
      mockSession
    );

    expect(inventoryService.reserveStockInTransaction).toHaveBeenCalledTimes(2);
    expect(result[0].warehouseId).toBe(warehouseA);
  });

  it("3. Fails cleanly with INSUFFICIENT_STOCK when all eligible warehouses lose stock to concurrent buyers", async () => {
    const orderItems = [
      {
        productVariantId: variantId,
        sku: "TEST-SKU-FB",
        quantity: 5,
      },
    ];

    inventoryRepository.findByVariant.mockResolvedValue([
      {
        _id: "inv-wh-1",
        warehouseId: warehouseA,
        onHand: 10,
        reserved: 5, // 5 available
      },
      {
        _id: "inv-wh-2",
        warehouseId: warehouseB,
        onHand: 10,
        reserved: 5, // 5 available
      },
    ]);

    // Both warehouses fail atomic reservation race
    inventoryService.reserveStockInTransaction.mockRejectedValue(
      new AppError("Insufficient available stock", 409, "INSUFFICIENT_STOCK")
    );

    await expect(
      orderService.reserveInventoryForOrderItems(
        orderItems,
        orderNumber,
        userId,
        mockSession
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "INSUFFICIENT_STOCK",
    });

    expect(inventoryService.reserveStockInTransaction).toHaveBeenCalledTimes(2);
  });

  it("4. Skips warehouses whose initial read shows available < requested quantity", async () => {
    const orderItems = [
      {
        productVariantId: variantId,
        sku: "TEST-SKU-FB",
        quantity: 5,
      },
    ];

    inventoryRepository.findByVariant.mockResolvedValue([
      {
        _id: "inv-wh-shallow",
        warehouseId: warehouseA,
        onHand: 10,
        reserved: 8, // only 2 available (< 5)
      },
      {
        _id: "inv-wh-deep",
        warehouseId: warehouseB,
        onHand: 10,
        reserved: 3, // 7 available (>= 5)
      },
    ]);

    inventoryService.reserveStockInTransaction.mockResolvedValue({
      warehouseId: warehouseB,
    });

    const result = await orderService.reserveInventoryForOrderItems(
      orderItems,
      orderNumber,
      userId,
      mockSession
    );

    // Shallow warehouse was never even attempted
    expect(inventoryService.reserveStockInTransaction).toHaveBeenCalledTimes(1);
    expect(inventoryService.reserveStockInTransaction).toHaveBeenCalledWith(
      "inv-wh-deep",
      5,
      expect.objectContaining({
        idempotencyKey: `order-reservation-${orderNumber}-${variantId}`,
      }),
      mockSession
    );
    expect(result[0].warehouseId).toBe(warehouseB);
  });

  it("5. Preserves single-warehouse behavior when only one warehouse exists", async () => {
    const orderItems = [
      {
        productVariantId: variantId,
        sku: "TEST-SKU-FB",
        quantity: 3,
      },
    ];

    inventoryRepository.findByVariant.mockResolvedValue([
      {
        _id: "inv-wh-solo",
        warehouseId: warehouseA,
        onHand: 10,
        reserved: 2, // 8 available
      },
    ]);

    inventoryService.reserveStockInTransaction.mockResolvedValue({
      warehouseId: warehouseA,
    });

    const result = await orderService.reserveInventoryForOrderItems(
      orderItems,
      orderNumber,
      userId,
      mockSession
    );

    expect(inventoryService.reserveStockInTransaction).toHaveBeenCalledTimes(1);
    expect(result[0].warehouseId).toBe(warehouseA);
  });

  it("6. Passes canonical idempotency key to prevent double reservation on retry", async () => {
    const orderItems = [
      {
        productVariantId: variantId,
        sku: "TEST-SKU-FB",
        quantity: 2,
      },
    ];

    inventoryRepository.findByVariant.mockResolvedValue([
      {
        _id: "inv-wh-1",
        warehouseId: warehouseA,
        onHand: 10,
        reserved: 0,
      },
    ]);

    inventoryService.reserveStockInTransaction.mockResolvedValue({
      warehouseId: warehouseA,
    });

    await orderService.reserveInventoryForOrderItems(
      orderItems,
      orderNumber,
      userId,
      mockSession
    );

    expect(inventoryService.reserveStockInTransaction).toHaveBeenCalledWith(
      "inv-wh-1",
      2,
      expect.objectContaining({
        referenceType: "order",
        referenceId: orderNumber,
        actorUserId: userId,
        idempotencyKey: `order-reservation-${orderNumber}-${variantId}`,
      }),
      mockSession
    );
  });

  it("7. Fails with INVENTORY_NOT_CONFIGURED when no inventory records exist", async () => {
    const orderItems = [
      {
        productVariantId: variantId,
        sku: "TEST-SKU-EMPTY",
        quantity: 1,
      },
    ];

    inventoryRepository.findByVariant.mockResolvedValue([]);

    await expect(
      orderService.reserveInventoryForOrderItems(
        orderItems,
        orderNumber,
        userId,
        mockSession
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "INVENTORY_NOT_CONFIGURED",
    });

    expect(inventoryService.reserveStockInTransaction).not.toHaveBeenCalled();
  });

  it("8. Rethrows unexpected database errors immediately without swallowing them as stock errors", async () => {
    const orderItems = [
      {
        productVariantId: variantId,
        sku: "TEST-SKU-FB",
        quantity: 2,
      },
    ];

    inventoryRepository.findByVariant.mockResolvedValue([
      {
        _id: "inv-wh-1",
        warehouseId: warehouseA,
        onHand: 10,
        reserved: 0,
      },
      {
        _id: "inv-wh-2",
        warehouseId: warehouseB,
        onHand: 10,
        reserved: 0,
      },
    ]);

    const fatalDbError = new Error("Database connection abruptly terminated");
    inventoryService.reserveStockInTransaction.mockRejectedValue(fatalDbError);

    await expect(
      orderService.reserveInventoryForOrderItems(
        orderItems,
        orderNumber,
        userId,
        mockSession
      )
    ).rejects.toThrow("Database connection abruptly terminated");

    // Must not continue to second warehouse when an unhandled system failure occurs
    expect(inventoryService.reserveStockInTransaction).toHaveBeenCalledTimes(1);
  });
});
