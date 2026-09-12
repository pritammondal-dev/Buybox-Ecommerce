const mongoose = require("mongoose");

jest.mock("../src/repositories/inventory.repository");
jest.mock("../src/repositories/inventory-transaction.repository");
jest.mock("../src/repositories/warehouse.repository");
jest.mock("../src/models/ProductVariant");
jest.mock("../src/utils/withTransaction");

const inventoryRepository = require("../src/repositories/inventory.repository");
const inventoryTransactionRepository = require("../src/repositories/inventory-transaction.repository");
const withTransaction = require("../src/utils/withTransaction");
const inventoryService = require("../src/services/inventory.service");
const inventoryTransactionService = require("../src/services/inventory-transaction.service");

describe("F-02: Inventory Idempotency & Concurrency Hardening (Unit-Level / Mocked)", () => {
  const inventoryId = new mongoose.Types.ObjectId().toString();
  const productVariantId = new mongoose.Types.ObjectId().toString();
  const warehouseId = new mongoose.Types.ObjectId().toString();

  let mockInventory;
  let mockSession;
  let transactionsDb;

  beforeEach(() => {
    jest.clearAllMocks();
    transactionsDb = new Map();

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

    mockInventory = {
      _id: inventoryId,
      productVariantId,
      warehouseId,
      onHand: 10,
      reserved: 2,
    };

    inventoryRepository.findById.mockImplementation(async (id) => {
      return { ...mockInventory };
    });

    inventoryRepository.adjustStock.mockImplementation(async (id, qty) => {
      mockInventory.onHand += qty;
      return { ...mockInventory };
    });

    inventoryRepository.reserveAvailableStock.mockImplementation(async (id, qty) => {
      mockInventory.reserved += qty;
      return { ...mockInventory };
    });

    inventoryRepository.releaseReservedStock.mockImplementation(async (id, qty) => {
      mockInventory.reserved -= qty;
      return { ...mockInventory };
    });

    inventoryRepository.deductReservedStock.mockImplementation(async (id, qty) => {
      mockInventory.onHand -= qty;
      mockInventory.reserved -= qty;
      return { ...mockInventory };
    });

    inventoryTransactionRepository.findByIdempotencyKey.mockImplementation(async (key) => {
      return transactionsDb.get(key) || null;
    });

    inventoryTransactionRepository.create.mockImplementation(async (data) => {
      const record = { _id: new mongoose.Types.ObjectId().toString(), ...data };
      if (data.idempotencyKey) {
        if (transactionsDb.has(data.idempotencyKey)) {
          const err = new Error(
            `E11000 duplicate key error collection: inventorytransactions index: inventoryTransaction_idempotencyKey_unique dup key: { idempotencyKey: "${data.idempotencyKey}" }`
          );
          err.code = 11000;
          err.keyPattern = { idempotencyKey: 1 };
          throw err;
        }
        transactionsDb.set(data.idempotencyKey, record);
      }
      return record;
    });
  });

  describe("1. Sequential same-key retries", () => {
    it("adjustStock: same-key sequential retry results in exactly one inventory balance mutation", async () => {
      const key = "adj-key-seq-1";

      const firstResult = await inventoryService.adjustStock(inventoryId, 5, {
        idempotencyKey: key,
      });
      expect(firstResult.onHand).toBe(15);
      expect(inventoryRepository.adjustStock).toHaveBeenCalledTimes(1);

      // Sequential retry with identical idempotencyKey
      const retryResult = await inventoryService.adjustStock(inventoryId, 5, {
        idempotencyKey: key,
      });

      expect(inventoryRepository.adjustStock).toHaveBeenCalledTimes(1);
      expect(retryResult.onHand).toBe(15);
      expect(mockInventory.onHand).toBe(15);
    });

    it("reserveStockInTransaction: same-key sequential retry results in exactly one reservation", async () => {
      const key = "res-key-seq-1";

      const firstResult = await inventoryService.reserveStockInTransaction(
        inventoryId,
        2,
        { idempotencyKey: key },
        mockSession
      );
      expect(firstResult.reserved).toBe(4);
      expect(inventoryRepository.reserveAvailableStock).toHaveBeenCalledTimes(1);

      // Sequential retry
      const retryResult = await inventoryService.reserveStockInTransaction(
        inventoryId,
        2,
        { idempotencyKey: key },
        mockSession
      );

      expect(inventoryRepository.reserveAvailableStock).toHaveBeenCalledTimes(1);
      expect(retryResult.reserved).toBe(4);
      expect(mockInventory.reserved).toBe(4);
    });

    it("reserveStock: standalone wrapper same-key sequential retry results in exactly one reservation", async () => {
      const key = "res-standalone-seq-1";

      const firstResult = await inventoryService.reserveStock(inventoryId, 2, {
        idempotencyKey: key,
      });
      expect(firstResult.reserved).toBe(4);
      expect(inventoryRepository.reserveAvailableStock).toHaveBeenCalledTimes(1);

      // Sequential retry
      const retryResult = await inventoryService.reserveStock(inventoryId, 2, {
        idempotencyKey: key,
      });

      expect(inventoryRepository.reserveAvailableStock).toHaveBeenCalledTimes(1);
      expect(retryResult.reserved).toBe(4);
    });

    it("deductReservedStockInTransaction: same-key sequential retry results in exactly one deduction", async () => {
      const key = "ded-key-seq-1";

      const firstResult = await inventoryService.deductReservedStockInTransaction(
        inventoryId,
        2,
        { idempotencyKey: key },
        mockSession
      );
      expect(firstResult.onHand).toBe(8);
      expect(firstResult.reserved).toBe(0);
      expect(inventoryRepository.deductReservedStock).toHaveBeenCalledTimes(1);

      // Sequential retry
      const retryResult = await inventoryService.deductReservedStockInTransaction(
        inventoryId,
        2,
        { idempotencyKey: key },
        mockSession
      );

      expect(inventoryRepository.deductReservedStock).toHaveBeenCalledTimes(1);
      expect(retryResult.onHand).toBe(8);
      expect(retryResult.reserved).toBe(0);
      expect(mockInventory.onHand).toBe(8);
    });

    it("deductReservedStock: standalone wrapper same-key sequential retry results in exactly one deduction", async () => {
      const key = "ded-standalone-seq-1";

      const firstResult = await inventoryService.deductReservedStock(inventoryId, 2, {
        idempotencyKey: key,
      });
      expect(firstResult.onHand).toBe(8);
      expect(firstResult.reserved).toBe(0);
      expect(inventoryRepository.deductReservedStock).toHaveBeenCalledTimes(1);

      // Sequential retry
      const retryResult = await inventoryService.deductReservedStock(inventoryId, 2, {
        idempotencyKey: key,
      });

      expect(inventoryRepository.deductReservedStock).toHaveBeenCalledTimes(1);
      expect(retryResult.onHand).toBe(8);
    });

    it("releaseStockInTransaction: same-key sequential retry results in exactly one release", async () => {
      const key = "rel-key-seq-1";

      const firstResult = await inventoryService.releaseStockInTransaction(
        inventoryId,
        1,
        { idempotencyKey: key },
        mockSession
      );
      expect(firstResult.reserved).toBe(1);
      expect(inventoryRepository.releaseReservedStock).toHaveBeenCalledTimes(1);

      // Sequential retry
      const retryResult = await inventoryService.releaseStockInTransaction(
        inventoryId,
        1,
        { idempotencyKey: key },
        mockSession
      );

      expect(inventoryRepository.releaseReservedStock).toHaveBeenCalledTimes(1);
      expect(retryResult.reserved).toBe(1);
      expect(mockInventory.reserved).toBe(1);
    });

    it("releaseStock: standalone wrapper same-key sequential retry results in exactly one release", async () => {
      const key = "rel-standalone-seq-1";

      const firstResult = await inventoryService.releaseStock(inventoryId, 1, {
        idempotencyKey: key,
      });
      expect(firstResult.reserved).toBe(1);
      expect(inventoryRepository.releaseReservedStock).toHaveBeenCalledTimes(1);

      // Sequential retry
      const retryResult = await inventoryService.releaseStock(inventoryId, 1, {
        idempotencyKey: key,
      });

      expect(inventoryRepository.releaseReservedStock).toHaveBeenCalledTimes(1);
      expect(retryResult.reserved).toBe(1);
    });
  });

  describe("2. Concurrent same-key collisions & E11000 recovery", () => {
    it("adjustStock: recovers from concurrent E11000 duplicate key conflict by returning canonical inventory", async () => {
      const key = "adj-concurrent-collision-1";
      const conflictError = new Error(
        `E11000 duplicate key error collection: inventorytransactions index: inventoryTransaction_idempotencyKey_unique dup key: { idempotencyKey: "${key}" }`
      );
      conflictError.code = 11000;
      conflictError.keyPattern = { idempotencyKey: 1 };

      withTransaction.mockImplementationOnce(async () => {
        throw conflictError;
      });

      transactionsDb.set(key, { _id: "existing-tx-id", idempotencyKey: key });
      mockInventory.onHand = 15; // Represents winning transaction's committed state

      const result = await inventoryService.adjustStock(inventoryId, 5, {
        idempotencyKey: key,
      });

      expect(result).toBeDefined();
      expect(result.onHand).toBe(15);
    });

    it("deductReservedStock: recovers from concurrent E11000 duplicate key conflict by returning canonical inventory", async () => {
      const key = "ded-concurrent-collision-1";
      const conflictError = new Error(
        `E11000 duplicate key error collection: inventorytransactions index: inventoryTransaction_idempotencyKey_unique dup key: { idempotencyKey: "${key}" }`
      );
      conflictError.code = 11000;
      conflictError.keyPattern = { idempotencyKey: 1 };

      withTransaction.mockImplementationOnce(async () => {
        throw conflictError;
      });

      transactionsDb.set(key, { _id: "existing-ded-tx", idempotencyKey: key });
      mockInventory.onHand = 8;
      mockInventory.reserved = 0;

      const result = await inventoryService.deductReservedStock(inventoryId, 2, {
        idempotencyKey: key,
      });

      expect(result).toBeDefined();
      expect(result.onHand).toBe(8);
    });

    it("re-throws unrelated E11000 duplicate key errors", async () => {
      const key = "unrelated-collision-1";
      const unrelatedError = new Error("E11000 duplicate key error collection: users index: email_1");
      unrelatedError.code = 11000;
      unrelatedError.keyPattern = { email: 1 };

      withTransaction.mockImplementationOnce(async () => {
        throw unrelatedError;
      });

      await expect(
        inventoryService.adjustStock(inventoryId, 5, { idempotencyKey: key })
      ).rejects.toThrow("email_1");
    });
  });

  describe("3. Different idempotency keys", () => {
    it("allows multiple distinct mutations with different idempotency keys", async () => {
      const resultA = await inventoryService.adjustStock(inventoryId, 2, {
        idempotencyKey: "adj-distinct-A",
      });
      expect(resultA.onHand).toBe(12);

      const resultB = await inventoryService.adjustStock(inventoryId, 3, {
        idempotencyKey: "adj-distinct-B",
      });
      expect(resultB.onHand).toBe(15);

      expect(inventoryRepository.adjustStock).toHaveBeenCalledTimes(2);
      expect(mockInventory.onHand).toBe(15);
    });
  });

  describe("4. Transaction callback retry after WriteConflict", () => {
    it("idempotency pre-check inside transaction callback prevents double mutation when callback retries", async () => {
      const key = "writeconflict-retry-key";
      let executionCount = 0;

      withTransaction.mockImplementation(async (callback) => {
        // First execution simulates WriteConflict after inserting the transaction
        executionCount++;
        try {
          await callback(mockSession);
        } catch (e) {
          // In real MongoDB, TransientTransactionError triggers driver re-run of callback
        }

        // Second execution (the driver retry)
        executionCount++;
        return callback(mockSession);
      });

      // On first attempt: createTransaction will succeed and populate transactionsDb,
      // but let's simulate an error thrown right before commit to trigger driver retry.
      let hasThrownTransient = false;
      const originalAdjust = inventoryRepository.adjustStock.getMockImplementation();
      inventoryRepository.adjustStock.mockImplementation(async (id, qty) => {
        const res = await originalAdjust(id, qty);
        if (!hasThrownTransient) {
          hasThrownTransient = true;
          // Pre-populate transaction as if inserted, then trigger transient conflict
          transactionsDb.set(key, { _id: "tx-writeconflict", idempotencyKey: key });
          const transientError = new Error("WriteConflict in transaction");
          transientError.errorLabels = ["TransientTransactionError"];
          throw transientError;
        }
        return res;
      });

      const result = await inventoryService.adjustStock(inventoryId, 5, {
        idempotencyKey: key,
      });

      expect(executionCount).toBe(2);
      // Because the pre-check checked findByIdempotencyKey on retry 2, adjustStock was NOT called a second time!
      expect(inventoryRepository.adjustStock).toHaveBeenCalledTimes(1);
      expect(result.onHand).toBe(15);
    });
  });

  describe("5. Operations without idempotency keys", () => {
    it("retains existing behavior when no idempotency key is passed", async () => {
      const result1 = await inventoryService.adjustStock(inventoryId, 2, {});
      expect(result1.onHand).toBe(12);

      const result2 = await inventoryService.adjustStock(inventoryId, 3, {});
      expect(result2.onHand).toBe(15);

      expect(inventoryRepository.adjustStock).toHaveBeenCalledTimes(2);
    });
  });

  describe("6. inventory-transaction.service createTransaction hardening", () => {
    it("throws E11000 duplicate key error if an existing transaction is found inside an active session", async () => {
      transactionsDb.set("existing-active-session-key", {
        _id: "tx-1",
        idempotencyKey: "existing-active-session-key",
      });

      await expect(
        inventoryTransactionService.createTransaction({
          productVariantId,
          warehouseId,
          type: "adjustment",
          quantity: 5,
          onHandBefore: 10,
          onHandAfter: 15,
          reservedBefore: 2,
          reservedAfter: 2,
          idempotencyKey: "existing-active-session-key",
          session: mockSession,
        })
      ).rejects.toThrow("inventoryTransaction_idempotencyKey_unique");
    });

    it("returns existing transaction if found when session is null (non-transactional caller)", async () => {
      const existingTx = {
        _id: "tx-non-session",
        idempotencyKey: "existing-non-session-key",
      };
      transactionsDb.set("existing-non-session-key", existingTx);

      const result = await inventoryTransactionService.createTransaction({
        productVariantId,
        warehouseId,
        type: "adjustment",
        quantity: 5,
        onHandBefore: 10,
        onHandAfter: 15,
        reservedBefore: 2,
        reservedAfter: 2,
        idempotencyKey: "existing-non-session-key",
        session: null,
      });

      expect(result).toEqual(existingTx);
    });
  });
});
