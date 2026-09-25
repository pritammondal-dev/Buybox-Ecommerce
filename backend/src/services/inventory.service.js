const inventoryRepository = require("../repositories/inventory.repository");
const warehouseRepository = require("../repositories/warehouse.repository");
const inventoryTransactionRepository = require("../repositories/inventory-transaction.repository");
const inventoryTransactionService = require("./inventory-transaction.service");

const ProductVariant = require("../models/ProductVariant");
const Product = require("../models/Product");
const Inventory = require("../models/Inventory");
const AppError = require("../errors/AppError");
const withTransaction = require("../utils/withTransaction");
const { resolveApprovedVendor } = require("../middlewares/vendor.middleware");
const { encodeSecureId } = require("../utils/secure-id.util");

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

  try {
    return await withTransaction(async (session) => {
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

      if (transactionContext.idempotencyKey) {
        const existingTx =
          await inventoryTransactionRepository.findByIdempotencyKey(
            transactionContext.idempotencyKey,
            { session }
          );

        if (existingTx) {
          return inventory;
        }
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
  } catch (error) {
    const isIdempotencyConflict =
      (error?.code === 11000 || error?.message?.includes("E11000")) &&
      transactionContext.idempotencyKey &&
      (error?.keyPattern?.idempotencyKey ||
        error?.message?.includes("idempotencyKey"));

    if (isIdempotencyConflict) {
      const existingTx =
        await inventoryTransactionRepository.findByIdempotencyKey(
          transactionContext.idempotencyKey
        );
      if (existingTx) {
        return inventoryRepository.findById(inventoryId);
      }
    }

    throw error;
  }
};

const reserveStockInTransaction = async (
  inventoryId,
  quantity,
  transactionContext = {},
  session
) => {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new AppError(
      "Reservation quantity must be a positive integer",
      400,
      "INVALID_RESERVATION_QUANTITY"
    );
  }

  if (!session) {
    throw new AppError(
      "MongoDB session is required for transactional reservation",
      500,
      "TRANSACTION_SESSION_REQUIRED"
    );
  }

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

  if (transactionContext.idempotencyKey) {
    const existingTx =
      await inventoryTransactionRepository.findByIdempotencyKey(
        transactionContext.idempotencyKey,
        { session }
      );

    if (existingTx) {
      return inventory;
    }
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

    onHandAfter:
      reservedInventory.onHand,

    reservedBefore,

    reservedAfter:
      reservedInventory.reserved,

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

  try {
    return await withTransaction(async (session) => {
      return reserveStockInTransaction(
        inventoryId,
        quantity,
        transactionContext,
        session
      );
    });
  } catch (error) {
    const isIdempotencyConflict =
      (error?.code === 11000 || error?.message?.includes("E11000")) &&
      transactionContext.idempotencyKey &&
      (error?.keyPattern?.idempotencyKey ||
        error?.message?.includes("idempotencyKey"));

    if (isIdempotencyConflict) {
      const existingTx =
        await inventoryTransactionRepository.findByIdempotencyKey(
          transactionContext.idempotencyKey
        );
      if (existingTx) {
        return inventoryRepository.findById(inventoryId);
      }
    }

    throw error;
  }
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

  try {
    return await withTransaction(async (session) => {
      return releaseStockInTransaction(
        inventoryId,
        quantity,
        transactionContext,
        session
      );
    });
  } catch (error) {
    const isIdempotencyConflict =
      (error?.code === 11000 || error?.message?.includes("E11000")) &&
      transactionContext.idempotencyKey &&
      (error?.keyPattern?.idempotencyKey ||
        error?.message?.includes("idempotencyKey"));

    if (isIdempotencyConflict) {
      const existingTx =
        await inventoryTransactionRepository.findByIdempotencyKey(
          transactionContext.idempotencyKey
        );
      if (existingTx) {
        return inventoryRepository.findById(inventoryId);
      }
    }

    throw error;
  }
};

const releaseStockInTransaction = async (
  inventoryId,
  quantity,
  transactionContext = {},
  session
) => {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new AppError(
      "Release quantity must be a positive integer",
      400,
      "INVALID_RELEASE_QUANTITY"
    );
  }

  if (!session) {
    throw new AppError(
      "MongoDB session is required for transactional release",
      500,
      "TRANSACTION_SESSION_REQUIRED"
    );
  }

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

  if (transactionContext.idempotencyKey) {
    const existingTx =
      await inventoryTransactionRepository.findByIdempotencyKey(
        transactionContext.idempotencyKey,
        { session }
      );

    if (existingTx) {
      return inventory;
    }
  }

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
    onHandAfter:
      releasedInventory.onHand,
    reservedBefore,
    reservedAfter:
      releasedInventory.reserved,
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

  try {
    return await withTransaction(async (session) => {
      return deductReservedStockInTransaction(
        inventoryId,
        quantity,
        transactionContext,
        session
      );
    });
  } catch (error) {
    const isIdempotencyConflict =
      (error?.code === 11000 || error?.message?.includes("E11000")) &&
      transactionContext.idempotencyKey &&
      (error?.keyPattern?.idempotencyKey ||
        error?.message?.includes("idempotencyKey"));

    if (isIdempotencyConflict) {
      const existingTx =
        await inventoryTransactionRepository.findByIdempotencyKey(
          transactionContext.idempotencyKey
        );
      if (existingTx) {
        return inventoryRepository.findById(inventoryId);
      }
    }

    throw error;
  }
};

const deductReservedStockInTransaction = async (
  inventoryId,
  quantity,
  transactionContext = {},
  session
) => {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new AppError(
      "Deduction quantity must be a positive integer",
      400,
      "INVALID_DEDUCTION_QUANTITY"
    );
  }

  if (!session) {
    throw new AppError(
      "MongoDB session is required for transactional deduction",
      500,
      "TRANSACTION_SESSION_REQUIRED"
    );
  }

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

  if (transactionContext.idempotencyKey) {
    const existingTx =
      await inventoryTransactionRepository.findByIdempotencyKey(
        transactionContext.idempotencyKey,
        { session }
      );

    if (existingTx) {
      return inventory;
    }
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

    onHandAfter:
      deductedInventory.onHand,

    reservedBefore,

    reservedAfter:
      deductedInventory.reserved,

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
};

const getMyVendorInventory = async ({ userId, query = {} }) => {
  const vendor = await resolveApprovedVendor(userId);

  const safePage = Math.max(Number(query.page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const skip = (safePage - 1) * safeLimit;

  // 1. Get vendor products
  const productFilter = { vendorId: vendor._id, deletedAt: null };
  if (query.search) {
    productFilter.$or = [
      { name: { $regex: query.search, $options: "i" } },
      { title: { $regex: query.search, $options: "i" } },
    ];
  }

  const products = await Product.find(productFilter).select("_id name title status").lean();
  const productIds = products.map((p) => p._id);
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  if (productIds.length === 0) {
    return {
      items: [],
      meta: { page: safePage, limit: safeLimit, total: 0, totalPages: 0 },
    };
  }

  // 2. Get variants
  const variants = await ProductVariant.find({
    productId: { $in: productIds },
  }).lean();
  const variantIds = variants.map((v) => v._id);
  const variantMap = new Map(variants.map((v) => [v._id.toString(), v]));

  // 3. Query inventory
  const inventoryFilter = { productVariantId: { $in: variantIds } };
  if (query.warehouseId) {
    inventoryFilter.warehouseId = query.warehouseId;
  }

  const total = await Inventory.countDocuments(inventoryFilter);
  const inventories = await Inventory.find(inventoryFilter)
    .populate("warehouseId", "name code city state isActive")
    .skip(skip)
    .limit(safeLimit)
    .sort({ onHand: 1 })
    .lean();

  const items = inventories.map((inv) => {
    const variant = variantMap.get(inv.productVariantId.toString());
    const product = variant ? productMap.get(variant.productId?.toString()) : null;
    const available = Math.max((inv.onHand || 0) - (inv.reserved || 0), 0);
    const isLowStock = available <= (inv.lowStockThreshold || 5);

    return {
      _id: inv._id,
      secureId: encodeSecureId("inventory", inv._id),
      sku: variant?.sku || "N/A",
      product: {
        _id: product?._id,
        secureId: encodeSecureId("product", product?._id),
        title: product?.name || product?.title || "Product",
        status: product?.status,
      },
      variant: {
        _id: variant?._id,
        secureId: encodeSecureId("variant", variant?._id),
        price: variant?.price?.toString(),
        attributes: variant?.attributes,
      },
      warehouse: inv.warehouseId
        ? {
            _id: inv.warehouseId._id,
            secureId: encodeSecureId("warehouse", inv.warehouseId._id),
            name: inv.warehouseId.name,
            code: inv.warehouseId.code,
            city: inv.warehouseId.city,
            state: inv.warehouseId.state,
          }
        : null,
      onHand: inv.onHand || 0,
      reserved: inv.reserved || 0,
      available,
      lowStockThreshold: inv.lowStockThreshold || 5,
      isLowStock,
      updatedAt: inv.updatedAt,
    };
  });

  return {
    items,
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
};

/**
 * Platform-wide inventory query for admins.
 */
const listAllInventory = async ({ page = 1, limit = 20, isLowStock } = {}) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (safePage - 1) * safeLimit;

  const query = {};
  if (isLowStock === "true") {
    query.$expr = {
      $lte: [{ $subtract: ["$onHand", "$reserved"] }, "$lowStockThreshold"],
    };
  }

  const [docs, total] = await Promise.all([
    Inventory.find(query)
      .populate({
        path: "productVariantId",
        select: "sku title price productId",
        populate: { path: "productId", select: "name slug vendorId" },
      })
      .populate("warehouseId", "name code city state")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    Inventory.countDocuments(query),
  ]);

  const items = docs.map((inv) => {
    const onHand = inv.onHand || 0;
    const reserved = inv.reserved || 0;
    const available = Math.max(0, onHand - reserved);
    const lowStockThreshold = inv.lowStockThreshold || 5;

    return {
      id: inv._id,
      productVariant: inv.productVariantId,
      warehouse: inv.warehouseId,
      onHand,
      reserved,
      available,
      lowStockThreshold,
      isLowStock: available <= lowStockThreshold,
      updatedAt: inv.updatedAt,
    };
  });

  return {
    items,
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
};

/**
 * Transfer stock atomically between two warehouses.
 */
const transferStock = async ({
  productVariantId,
  sourceWarehouseId,
  destinationWarehouseId,
  quantity,
  reason = "Inter-warehouse stock transfer",
  actor = null,
  req = null,
}) => {
  const mongoose = require("mongoose");
  const Warehouse = require("../models/Warehouse");
  const { recordAuditLog } = require("./governance.service");

  if (!mongoose.isValidObjectId(productVariantId)) {
    throw new AppError("Invalid product variant ID", 400, "INVALID_ID");
  }
  if (!mongoose.isValidObjectId(sourceWarehouseId)) {
    throw new AppError("Invalid source warehouse ID", 400, "INVALID_ID");
  }
  if (!mongoose.isValidObjectId(destinationWarehouseId)) {
    throw new AppError("Invalid destination warehouse ID", 400, "INVALID_ID");
  }
  if (sourceWarehouseId.toString() === destinationWarehouseId.toString()) {
    throw new AppError("Source and destination warehouses cannot be the same", 400, "SAME_WAREHOUSE_TRANSFER");
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new AppError("Transfer quantity must be a positive integer", 400, "INVALID_QUANTITY");
  }

  const [sourceWarehouse, destWarehouse] = await Promise.all([
    Warehouse.findById(sourceWarehouseId),
    Warehouse.findById(destinationWarehouseId),
  ]);

  if (!sourceWarehouse || !sourceWarehouse.isActive) {
    throw new AppError("Source warehouse not found or inactive", 404, "SOURCE_WAREHOUSE_NOT_FOUND");
  }
  if (!destWarehouse || !destWarehouse.isActive) {
    throw new AppError("Destination warehouse not found or inactive", 404, "DESTINATION_WAREHOUSE_NOT_FOUND");
  }

  return await withTransaction(async (session) => {
    const sourceInventory = await Inventory.findOne({
      productVariantId,
      warehouseId: sourceWarehouseId,
    }).session(session);

    if (!sourceInventory) {
      throw new AppError("Source warehouse does not hold stock for this variant", 404, "INVENTORY_NOT_FOUND");
    }

    let destInventory = await Inventory.findOne({
      productVariantId,
      warehouseId: destinationWarehouseId,
    }).session(session);

    const availableStock = sourceInventory.onHand - sourceInventory.reserved;
    if (availableStock < quantity) {
      throw new AppError(
        `Insufficient available stock for transfer. Available: ${availableStock}, Requested: ${quantity}`,
        409,
        "INSUFFICIENT_STOCK_FOR_TRANSFER"
      );
    }

    const sourceOnHandBefore = sourceInventory.onHand;
    const sourceOnHandAfter = sourceInventory.onHand - quantity;
    const sourceReserved = sourceInventory.reserved;

    sourceInventory.onHand = sourceOnHandAfter;
    await sourceInventory.save({ session });

    const destOnHandBefore = destInventory ? destInventory.onHand : 0;
    const destOnHandAfter = destOnHandBefore + quantity;
    const destReserved = destInventory ? destInventory.reserved : 0;

    if (!destInventory) {
      destInventory = new Inventory({
        productVariantId,
        warehouseId: destinationWarehouseId,
        onHand: destOnHandAfter,
        reserved: 0,
        lowStockThreshold: sourceInventory.lowStockThreshold || 10,
      });
    } else {
      destInventory.onHand = destOnHandAfter;
    }
    await destInventory.save({ session });

    await inventoryTransactionService.createTransaction({
      productVariantId,
      warehouseId: sourceWarehouseId,
      type: "transfer",
      quantity: -quantity,
      onHandBefore: sourceOnHandBefore,
      onHandAfter: sourceOnHandAfter,
      reservedBefore: sourceReserved,
      reservedAfter: sourceReserved,
      referenceType: "warehouse_transfer",
      referenceId: destinationWarehouseId,
      notes: `Transferred to warehouse ${destWarehouse.name}: ${reason}`,
      session,
    });

    await inventoryTransactionService.createTransaction({
      productVariantId,
      warehouseId: destinationWarehouseId,
      type: "transfer",
      quantity,
      onHandBefore: destOnHandBefore,
      onHandAfter: destOnHandAfter,
      reservedBefore: destReserved,
      reservedAfter: destReserved,
      referenceType: "warehouse_transfer",
      referenceId: sourceWarehouseId,
      notes: `Transferred from warehouse ${sourceWarehouse.name}: ${reason}`,
      session,
    });

    if (actor) {
      await recordAuditLog({
        actorId: actor._id || actor.id,
        targetId: sourceInventory._id,
        action: "inventory.transfer",
        entityType: "inventory",
        afterState: {
          productVariantId,
          sourceWarehouseId,
          destinationWarehouseId,
          quantity,
          reason,
        },
        req,
      });
    }

    return {
      success: true,
      message: "Stock transferred successfully",
      sourceInventory,
      destinationInventory: destInventory,
      transferredQuantity: quantity,
    };
  });
};

/**
 * Get inventory dashboard metrics & summaries (low stock, out of stock, totals)
 */
const getInventorySummary = async ({ vendorId = null } = {}) => {
  const mongoose = require("mongoose");
  const Warehouse = require("../models/Warehouse");
  const query = {};

  if (vendorId && mongoose.isValidObjectId(vendorId)) {
    const vendorProducts = await Product.find({ vendorId, deletedAt: null }).select("_id").lean();
    const vendorProductIds = vendorProducts.map((p) => p._id);
    const vendorVariants = await ProductVariant.find({
      productId: { $in: vendorProductIds },
      deletedAt: null,
    }).select("_id").lean();
    query.productVariantId = { $in: vendorVariants.map((v) => v._id) };
  }

  const [records, totalWarehouses] = await Promise.all([
    Inventory.find(query).lean(),
    Warehouse.countDocuments({ isActive: true, deletedAt: null }),
  ]);

  let totalUnitsOnHand = 0;
  let totalUnitsReserved = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  for (const inv of records) {
    const onHand = inv.onHand || 0;
    const reserved = inv.reserved || 0;
    const available = Math.max(0, onHand - reserved);
    const threshold = inv.lowStockThreshold || 5;

    totalUnitsOnHand += onHand;
    totalUnitsReserved += reserved;

    if (available === 0) {
      outOfStockCount++;
    } else if (available <= threshold) {
      lowStockCount++;
    }
  }

  const totalUnitsAvailable = Math.max(0, totalUnitsOnHand - totalUnitsReserved);

  return {
    totalRecords: records.length,
    totalSkus: records.length,
    totalUnitsOnHand,
    totalUnitsReserved,
    totalUnitsAvailable,
    lowStockCount,
    outOfStockCount,
    totalWarehouses,
  };
};

module.exports = {
  createInventory,
  getInventoryById,
  getVariantInventory,
  getWarehouseInventory,
  adjustStock,
  reserveStock,
  reserveStockInTransaction,
  releaseStock,
  releaseStockInTransaction,
  deductReservedStock,
  deductReservedStockInTransaction,
  getMyVendorInventory,
  listAllInventory,
  transferStock,
  getInventorySummary,
};