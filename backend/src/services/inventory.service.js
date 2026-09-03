const inventoryRepository = require("../repositories/inventory.repository");
const warehouseRepository = require("../repositories/warehouse.repository");
const inventoryTransactionService = require("./inventory-transaction.service");

const ProductVariant = require("../models/ProductVariant");
const AppError = require("../errors/AppError");
const withTransaction = require("../utils/withTransaction");

const createInventory = async ({
  productVariantId,
  warehouseId,
  onHand = 0,
  lowStockThreshold = 5,
}) => {
  const variant = await ProductVariant.findById(
    productVariantId
  );

  if (!variant) {
    throw new AppError(
      "Product variant not found",
      404,
      "PRODUCT_VARIANT_NOT_FOUND"
    );
  }

  const warehouse =
    await warehouseRepository.findById(warehouseId);

  if (!warehouse) {
    throw new AppError(
      "Warehouse not found",
      404,
      "WAREHOUSE_NOT_FOUND"
    );
  }

  if (!warehouse.isActive) {
    throw new AppError(
      "Warehouse is inactive",
      400,
      "WAREHOUSE_INACTIVE"
    );
  }

  const existingInventory =
    await inventoryRepository.findByVariantAndWarehouse(
      productVariantId,
      warehouseId
    );

  if (existingInventory) {
    throw new AppError(
      "Inventory record already exists for this variant and warehouse",
      409,
      "INVENTORY_ALREADY_EXISTS"
    );
  }

  try {
    return await inventoryRepository.create({
      productVariantId,
      warehouseId,
      onHand,
      reserved: 0,
      lowStockThreshold,
      lastStockUpdateAt: new Date(),
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError(
        "Inventory record already exists for this variant and warehouse",
        409,
        "INVENTORY_ALREADY_EXISTS"
      );
    }

    throw error;
  }
};

const getInventoryById = async (inventoryId) => {
  const inventory =
    await inventoryRepository.findById(inventoryId);

  if (!inventory) {
    throw new AppError(
      "Inventory record not found",
      404,
      "INVENTORY_NOT_FOUND"
    );
  }

  return inventory;
};

const getVariantInventory = async (
  productVariantId
) => {
  const variant = await ProductVariant.findById(
    productVariantId
  );

  if (!variant) {
    throw new AppError(
      "Product variant not found",
      404,
      "PRODUCT_VARIANT_NOT_FOUND"
    );
  }

  return inventoryRepository.findByVariant(
    productVariantId
  );
};

const getWarehouseInventory = async (
  warehouseId
) => {
  const warehouse =
    await warehouseRepository.findById(warehouseId);

  if (!warehouse) {
    throw new AppError(
      "Warehouse not found",
      404,
      "WAREHOUSE_NOT_FOUND"
    );
  }

  return inventoryRepository.findByWarehouse(
    warehouseId
  );
};

const adjustStock = async (
  inventoryId,
  quantity,
  transactionContext = {}
) => {
  if (!Number.isInteger(quantity) || quantity === 0) {
    throw new AppError(
      "Stock adjustment must be a non-zero integer",
      400,
      "INVALID_STOCK_ADJUSTMENT"
    );
  }

  return withTransaction(async (session) => {
    const inventory =
      await inventoryRepository.findById(
        inventoryId,
        { session }
      );

    if (!inventory) {
      throw new AppError(
        "Inventory record not found",
        404,
        "INVENTORY_NOT_FOUND"
      );
    }

    const onHandBefore = inventory.onHand;
    const reservedBefore = inventory.reserved;

    const updatedInventory =
      await inventoryRepository.adjustStock(
        inventoryId,
        quantity,
        { session }
      );

    if (!updatedInventory) {
      throw new AppError(
        "Stock adjustment would reduce on-hand stock below reserved stock",
        409,
        "INVALID_STOCK_ADJUSTMENT"
      );
    }

    await inventoryTransactionService.createTransaction({
      productVariantId:
        updatedInventory.productVariantId,
      warehouseId:
        updatedInventory.warehouseId,
      type: "adjustment",
      quantity,
      onHandBefore,
      onHandAfter: updatedInventory.onHand,
      reservedBefore,
      reservedAfter: updatedInventory.reserved,
      referenceType:
        transactionContext.referenceType || null,
      referenceId:
        transactionContext.referenceId || null,
      idempotencyKey:
        transactionContext.idempotencyKey || null,
      actorUserId:
        transactionContext.actorUserId || null,
      notes:
        transactionContext.notes || null,
      session,
    });

    return updatedInventory;
  });
};

const reserveStock = async (
  inventoryId,
  quantity,
  transactionContext = {}
) => {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new AppError(
      "Reservation quantity must be a positive integer",
      400,
      "INVALID_RESERVATION_QUANTITY"
    );
  }

  return withTransaction(async (session) => {
    const inventory =
      await inventoryRepository.findById(
        inventoryId,
        { session }
      );

    if (!inventory) {
      throw new AppError(
        "Inventory record not found",
        404,
        "INVENTORY_NOT_FOUND"
      );
    }

    const onHandBefore = inventory.onHand;
    const reservedBefore = inventory.reserved;

    const reservedInventory =
      await inventoryRepository.reserveAvailableStock(
        inventoryId,
        quantity,
        { session }
      );

    if (!reservedInventory) {
      throw new AppError(
        "Insufficient available stock",
        409,
        "INSUFFICIENT_STOCK"
      );
    }

    await inventoryTransactionService.createTransaction({
      productVariantId:
        reservedInventory.productVariantId,
      warehouseId:
        reservedInventory.warehouseId,
      type: "reservation",
      quantity,
      onHandBefore,
      onHandAfter: reservedInventory.onHand,
      reservedBefore,
      reservedAfter: reservedInventory.reserved,
      referenceType:
        transactionContext.referenceType || null,
      referenceId:
        transactionContext.referenceId || null,
      idempotencyKey:
        transactionContext.idempotencyKey || null,
      actorUserId:
        transactionContext.actorUserId || null,
      notes:
        transactionContext.notes || null,
      session,
    });

    return reservedInventory;
  });
};

const releaseStock = async (
  inventoryId,
  quantity,
  transactionContext = {}
) => {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new AppError(
      "Release quantity must be a positive integer",
      400,
      "INVALID_RELEASE_QUANTITY"
    );
  }

  return withTransaction(async (session) => {
    const inventory =
      await inventoryRepository.findById(
        inventoryId,
        { session }
      );

    if (!inventory) {
      throw new AppError(
        "Inventory record not found",
        404,
        "INVENTORY_NOT_FOUND"
      );
    }

    const onHandBefore = inventory.onHand;
    const reservedBefore = inventory.reserved;

    const releasedInventory =
      await inventoryRepository.releaseReservedStock(
        inventoryId,
        quantity,
        { session }
      );

    if (!releasedInventory) {
      throw new AppError(
        "Cannot release more stock than currently reserved",
        409,
        "INVALID_STOCK_RELEASE"
      );
    }

    await inventoryTransactionService.createTransaction({
      productVariantId:
        releasedInventory.productVariantId,
      warehouseId:
        releasedInventory.warehouseId,
      type: "release",
      quantity: -quantity,
      onHandBefore,
      onHandAfter: releasedInventory.onHand,
      reservedBefore,
      reservedAfter: releasedInventory.reserved,
      referenceType:
        transactionContext.referenceType || null,
      referenceId:
        transactionContext.referenceId || null,
      idempotencyKey:
        transactionContext.idempotencyKey || null,
      actorUserId:
        transactionContext.actorUserId || null,
      notes:
        transactionContext.notes || null,
      session,
    });

    return releasedInventory;
  });
};

const deductReservedStock = async (
  inventoryId,
  quantity,
  transactionContext = {}
) => {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new AppError(
      "Deduction quantity must be a positive integer",
      400,
      "INVALID_DEDUCTION_QUANTITY"
    );
  }

  return withTransaction(async (session) => {
    const inventory =
      await inventoryRepository.findById(
        inventoryId,
        { session }
      );

    if (!inventory) {
      throw new AppError(
        "Inventory record not found",
        404,
        "INVENTORY_NOT_FOUND"
      );
    }

    const onHandBefore = inventory.onHand;
    const reservedBefore = inventory.reserved;

    const deductedInventory =
      await inventoryRepository.deductReservedStock(
        inventoryId,
        quantity,
        { session }
      );

    if (!deductedInventory) {
      throw new AppError(
        "Cannot deduct more stock than currently reserved",
        409,
        "INVALID_STOCK_DEDUCTION"
      );
    }

    await inventoryTransactionService.createTransaction({
      productVariantId:
        deductedInventory.productVariantId,
      warehouseId:
        deductedInventory.warehouseId,
      type: "sale",
      quantity: -quantity,
      onHandBefore,
      onHandAfter: deductedInventory.onHand,
      reservedBefore,
      reservedAfter: deductedInventory.reserved,
      referenceType:
        transactionContext.referenceType || null,
      referenceId:
        transactionContext.referenceId || null,
      idempotencyKey:
        transactionContext.idempotencyKey || null,
      actorUserId:
        transactionContext.actorUserId || null,
      notes:
        transactionContext.notes || null,
      session,
    });

    return deductedInventory;
  });
};

module.exports = {
  createInventory,
  getInventoryById,
  getVariantInventory,
  getWarehouseInventory,
  adjustStock,
  reserveStock,
  releaseStock,
  deductReservedStock,
};