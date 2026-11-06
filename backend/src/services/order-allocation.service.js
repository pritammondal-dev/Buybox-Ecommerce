const mongoose = require("mongoose");
const Order = require("../models/Order");
const Warehouse = require("../models/Warehouse");
const ProductVariant = require("../models/ProductVariant");
const Inventory = require("../models/Inventory");
const inventoryService = require("./inventory.service");
const withTransaction = require("../utils/withTransaction");
const AppError = require("../errors/AppError");

/**
 * Get eligible warehouses that can fulfill a specific product variant and quantity.
 */
const getEligibleWarehousesForItem = async (productVariantIdOrParams, maybeQuantity = 1, maybeStrategy = "deepest_stock") => {
  let productVariantId;
  let requiredQuantity = maybeQuantity;
  let strategy = maybeStrategy;
  if (typeof productVariantIdOrParams === "object" && productVariantIdOrParams !== null && !mongoose.isValidObjectId(productVariantIdOrParams)) {
    productVariantId = productVariantIdOrParams.productVariantId;
    requiredQuantity = productVariantIdOrParams.requiredQuantity || maybeQuantity;
    strategy = productVariantIdOrParams.strategy || maybeStrategy;
  } else {
    productVariantId = productVariantIdOrParams;
  }

  if (!mongoose.isValidObjectId(productVariantId)) {
    throw new AppError("Invalid product variant ID", 400, "INVALID_VARIANT_ID");
  }

  const activeWarehouses = await Warehouse.find({
    isActive: true,
    deletedAt: null,
  }).lean();

  const activeIds = activeWarehouses.map((w) => w._id);
  const inventories = await Inventory.find({
    productVariantId,
    warehouseId: { $in: activeIds },
  }).populate("warehouseId", "name code city state").lean();

  const results = inventories.map((inv) => {
    const onHand = inv.onHand || 0;
    const reserved = inv.reserved || 0;
    const nonSellable = (inv.damaged || 0) + (inv.defective || 0) + (inv.expired || 0);
    const available = Math.max(0, onHand - reserved - nonSellable);

    return {
      warehouseId: inv.warehouseId?._id || inv.warehouseId,
      warehouseName: inv.warehouseId?.name || "Unknown Warehouse",
      warehouseCode: inv.warehouseId?.code || "",
      onHand,
      reserved,
      nonSellable,
      available,
      availableStock: available,
      canFulfill: available >= requiredQuantity,
    };
  });

  if (strategy === "deepest_stock") {
    results.sort((a, b) => b.available - a.available);
  }

  return results;
};

/**
 * Reallocate an order item from its current warehouse to a new target warehouse.
 * Atomically releases reservation at old warehouse and reserves at new warehouse.
 */
const reallocateOrderItem = async (orderIdOrParams, maybeOrderItemId, maybeTargetWarehouseId, maybeActor) => {
  let orderId;
  let orderItemId;
  let productVariantId;
  let targetWarehouseId;
  let actor = maybeActor;
  let reason = "Order item reallocation";

  if (typeof orderIdOrParams === "object" && orderIdOrParams !== null && !mongoose.isValidObjectId(orderIdOrParams)) {
    orderId = orderIdOrParams.orderId;
    orderItemId = orderIdOrParams.orderItemId;
    productVariantId = orderIdOrParams.productVariantId;
    targetWarehouseId = orderIdOrParams.targetWarehouseId;
    actor = maybeActor || { _id: orderIdOrParams.actorUserId };
    reason = orderIdOrParams.reason || reason;
  } else {
    orderId = orderIdOrParams;
    orderItemId = maybeOrderItemId;
    targetWarehouseId = maybeTargetWarehouseId;
  }

  if (!mongoose.isValidObjectId(orderId)) {
    throw new AppError("Invalid order ID", 400, "INVALID_ID");
  }
  if (!orderItemId && !productVariantId) {
    throw new AppError("Either orderItemId or productVariantId is required", 400, "INVALID_ID");
  }
  if (!mongoose.isValidObjectId(targetWarehouseId)) {
    throw new AppError("Invalid target warehouse ID", 400, "INVALID_WAREHOUSE_ID");
  }

  const targetWarehouse = await Warehouse.findById(targetWarehouseId);
  if (!targetWarehouse || !targetWarehouse.isActive || targetWarehouse.deletedAt) {
    throw new AppError("Target warehouse not found or inactive", 404, "TARGET_WAREHOUSE_NOT_FOUND");
  }

  return await withTransaction(async (session) => {
    const order = await Order.findById(orderId).session(session);
    if (!order) {
      throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
    }

    if (!["pending", "confirmed", "processing"].includes(order.status)) {
      throw new AppError(
        `Cannot reallocate inventory for order in '${order.status}' status`,
        400,
        "INVALID_ORDER_STATUS_FOR_REALLOCATION"
      );
    }

    const item = orderItemId
      ? order.items.id(orderItemId)
      : order.items.find((it) => it.productVariantId?.toString() === productVariantId?.toString());

    if (!item) {
      throw new AppError("Order item not found", 404, "ORDER_ITEM_NOT_FOUND");
    }

    if (item.isVirtual || item.isDownloadable || item.inventoryStatus === "not_required") {
      throw new AppError("Cannot allocate warehouse inventory for virtual items", 400, "VIRTUAL_ITEM_NO_WAREHOUSE");
    }

    const oldWarehouseId = item.warehouseId;
    if (oldWarehouseId && oldWarehouseId.toString() === targetWarehouseId.toString()) {
      return { success: true, order, reallocated: false, message: "Item is already allocated to target warehouse" };
    }

    // 1. Release stock at old warehouse if previously reserved
    if (oldWarehouseId) {
      const oldInv = await Inventory.findOne({
        productVariantId: item.productVariantId,
        warehouseId: oldWarehouseId,
      }).session(session);

      if (oldInv && oldInv.reserved >= item.quantity) {
        await inventoryService.releaseStockInTransaction(
          oldInv._id,
          item.quantity,
          {
            referenceType: "order_reallocation_release",
            referenceId: order.orderNumber,
            actorUserId: actor?._id || actor?.id || null,
            notes: `Released for reallocation to warehouse ${targetWarehouse.name}`,
          },
          session
        );
      }
    }

    // 2. Reserve stock at new target warehouse
    const targetInv = await Inventory.findOne({
      productVariantId: item.productVariantId,
      warehouseId: targetWarehouseId,
    }).session(session);

    if (!targetInv) {
      throw new AppError(
        `Target warehouse ${targetWarehouse.name} has no inventory configured for SKU ${item.sku}`,
        409,
        "INVENTORY_NOT_CONFIGURED"
      );
    }

    const nonSellable = (targetInv.damaged || 0) + (targetInv.defective || 0) + (targetInv.expired || 0);
    const available = targetInv.onHand - targetInv.reserved - nonSellable;

    if (available < item.quantity) {
      throw new AppError(
        `Insufficient available stock at target warehouse ${targetWarehouse.name} for SKU ${item.sku}. Available: ${available}, Required: ${item.quantity}`,
        409,
        "INSUFFICIENT_STOCK_AT_TARGET"
      );
    }

    await inventoryService.reserveStockInTransaction(
      targetInv._id,
      item.quantity,
      {
        referenceType: "order_reallocation_reserve",
        referenceId: order.orderNumber,
        actorUserId: actor?._id || actor?.id || null,
        notes: `Reallocated from previous warehouse to ${targetWarehouse.name}`,
      },
      session
    );

    // 3. Update order item assignment
    item.warehouseId = targetWarehouse._id;
    item.inventoryStatus = "reserved";
    await order.save({ session });

    return {
      success: true,
      order,
      reallocated: true,
      previousWarehouseId: oldWarehouseId,
      newWarehouseId: targetWarehouse._id,
      message: `Successfully reallocated SKU ${item.sku} to ${targetWarehouse.name}`,
    };
  });
};

module.exports = {
  getEligibleWarehousesForItem,
  reallocateOrderItem,
};
