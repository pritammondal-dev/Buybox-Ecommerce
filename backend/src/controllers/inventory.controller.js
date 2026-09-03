const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const inventoryService = require("../services/inventory.service");
const {
  ensureInventoryAccess,
  ensureInventoryIdAccess,
} = require("../services/inventory-access.service");

const createInventory = asyncHandler(async (req, res) => {
  await ensureInventoryAccess({
    user: req.user,
    productVariantId: req.body.productVariantId,
  });

  const inventory = await inventoryService.createInventory(
    req.body
  );

  return sendSuccess(res, {
    statusCode: 201,
    message: "Inventory created successfully",
    data: {
      inventory,
    },
  });
});

const getInventory = asyncHandler(async (req, res) => {
  const inventory =
    await inventoryService.getInventoryById(
      req.params.id
    );

  await ensureInventoryIdAccess({
    user: req.user,
    inventory,
  });

  return sendSuccess(res, {
    message: "Inventory retrieved successfully",
    data: {
      inventory,
    },
  });
});

const getVariantInventory = asyncHandler(async (req, res) => {
  await ensureInventoryAccess({
    user: req.user,
    productVariantId: req.params.variantId,
  });

  const inventory =
    await inventoryService.getVariantInventory(
      req.params.variantId
    );

  return sendSuccess(res, {
    message: "Variant inventory retrieved successfully",
    data: {
      inventory,
    },
  });
});

const getWarehouseInventory = asyncHandler(async (req, res) => {
  const inventory =
    await inventoryService.getWarehouseInventory(
      req.params.warehouseId
    );

  if (req.user.role === "vendor") {
    const accessibleInventory = [];

    for (const item of inventory) {
      try {
        await ensureInventoryAccess({
          user: req.user,
          productVariantId: item.productVariantId,
        });

        accessibleInventory.push(item);
      } catch (error) {
        if (error.code === "INVENTORY_ACCESS_DENIED") {
          continue;
        }

        throw error;
      }
    }

    return sendSuccess(res, {
      message: "Warehouse inventory retrieved successfully",
      data: {
        inventory: accessibleInventory,
      },
    });
  }

  return sendSuccess(res, {
    message: "Warehouse inventory retrieved successfully",
    data: {
      inventory,
    },
  });
});

const adjustStock = asyncHandler(async (req, res) => {
  const inventory =
    await inventoryService.getInventoryById(
      req.params.id
    );

  await ensureInventoryIdAccess({
    user: req.user,
    inventory,
  });

  const updatedInventory =
    await inventoryService.adjustStock(
      req.params.id,
      req.body.quantity
    );

  return sendSuccess(res, {
    message: "Stock adjusted successfully",
    data: {
      inventory: updatedInventory,
    },
  });
});

const reserveStock = asyncHandler(async (req, res) => {
  const inventory =
    await inventoryService.getInventoryById(
      req.params.id
    );

  await ensureInventoryIdAccess({
    user: req.user,
    inventory,
  });

  const updatedInventory =
    await inventoryService.reserveStock(
      req.params.id,
      req.body.quantity
    );

  return sendSuccess(res, {
    message: "Stock reserved successfully",
    data: {
      inventory: updatedInventory,
    },
  });
});

const releaseStock = asyncHandler(async (req, res) => {
  const inventory =
    await inventoryService.getInventoryById(
      req.params.id
    );

  await ensureInventoryIdAccess({
    user: req.user,
    inventory,
  });

  const updatedInventory =
    await inventoryService.releaseStock(
      req.params.id,
      req.body.quantity
    );

  return sendSuccess(res, {
    message: "Reserved stock released successfully",
    data: {
      inventory: updatedInventory,
    },
  });
});

const deductReservedStock = asyncHandler(async (req, res) => {
  const inventory =
    await inventoryService.getInventoryById(
      req.params.id
    );

  await ensureInventoryIdAccess({
    user: req.user,
    inventory,
  });

  const updatedInventory =
    await inventoryService.deductReservedStock(
      req.params.id,
      req.body.quantity
    );

  return sendSuccess(res, {
    message: "Reserved stock deducted successfully",
    data: {
      inventory: updatedInventory,
    },
  });
});

module.exports = {
  createInventory,
  getInventory,
  getVariantInventory,
  getWarehouseInventory,
  adjustStock,
  reserveStock,
  releaseStock,
  deductReservedStock,
};