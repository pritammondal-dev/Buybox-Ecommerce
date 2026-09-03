const inventoryTransactionRepository = require("../repositories/inventory-transaction.repository");
const AppError = require("../errors/AppError");

const TRANSACTION_TYPES = Object.freeze([
  "receive",
  "adjustment",
  "reservation",
  "release",
  "sale",
  "return",
  "transfer",
]);

const createTransaction = async ({
  productVariantId,
  warehouseId,
  type,
  quantity,
  onHandBefore,
  onHandAfter,
  reservedBefore,
  reservedAfter,
  referenceType = null,
  referenceId = null,
  idempotencyKey = null,
  actorUserId = null,
  notes = null,
  session = null,
}) => {
  if (!TRANSACTION_TYPES.includes(type)) {
    throw new AppError(
      "Invalid inventory transaction type",
      400,
      "INVALID_INVENTORY_TRANSACTION_TYPE"
    );
  }

  if (!Number.isInteger(quantity) || quantity === 0) {
    throw new AppError(
      "Transaction quantity must be a non-zero integer",
      400,
      "INVALID_INVENTORY_TRANSACTION_QUANTITY"
    );
  }

  if (
    !Number.isInteger(onHandBefore) ||
    onHandBefore < 0 ||
    !Number.isInteger(onHandAfter) ||
    onHandAfter < 0
  ) {
    throw new AppError(
      "Invalid on-hand inventory values",
      400,
      "INVALID_ON_HAND_VALUES"
    );
  }

  if (
    !Number.isInteger(reservedBefore) ||
    reservedBefore < 0 ||
    !Number.isInteger(reservedAfter) ||
    reservedAfter < 0
  ) {
    throw new AppError(
      "Invalid reserved inventory values",
      400,
      "INVALID_RESERVED_VALUES"
    );
  }

  if (onHandAfter < reservedAfter) {
    throw new AppError(
      "On-hand stock cannot be lower than reserved stock",
      400,
      "INVALID_INVENTORY_STATE"
    );
  }

  if (idempotencyKey) {
    const existing =
      await inventoryTransactionRepository.findByIdempotencyKey(
        idempotencyKey,
        { session }
      );

    if (existing) {
      return existing;
    }
  }

  try {
    return await inventoryTransactionRepository.create(
      {
        productVariantId,
        warehouseId,
        type,
        quantity,
        onHandBefore,
        onHandAfter,
        reservedBefore,
        reservedAfter,
        referenceType,
        referenceId,
        idempotencyKey,
        actorUserId,
        notes,
      },
      { session }
    );
  } catch (error) {
    if (error?.code === 11000 && idempotencyKey) {
      const existing =
        await inventoryTransactionRepository.findByIdempotencyKey(
          idempotencyKey,
          { session }
        );

      if (existing) {
        return existing;
      }
    }

    throw error;
  }
};

const getTransaction = async (id) => {
  const transaction =
    await inventoryTransactionRepository.findById(id);

  if (!transaction) {
    throw new AppError(
      "Inventory transaction not found",
      404,
      "INVENTORY_TRANSACTION_NOT_FOUND"
    );
  }

  return transaction;
};

const getInventoryHistory = async ({
  productVariantId,
  warehouseId,
}) => {
  return inventoryTransactionRepository.findByInventory({
    productVariantId,
    warehouseId,
  });
};

const getVariantHistory = async (productVariantId) => {
  return inventoryTransactionRepository.findByVariant(
    productVariantId
  );
};

const getWarehouseHistory = async (warehouseId) => {
  return inventoryTransactionRepository.findByWarehouse(
    warehouseId
  );
};

module.exports = {
  createTransaction,
  getTransaction,
  getInventoryHistory,
  getVariantHistory,
  getWarehouseHistory,
};