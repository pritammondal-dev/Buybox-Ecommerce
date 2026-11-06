const mongoose = require("mongoose");
const Warehouse = require("../models/Warehouse");
const Inventory = require("../models/Inventory");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const InventoryTransaction = require("../models/InventoryTransaction");
const StockReceiving = require("../models/StockReceiving");
const StockTransfer = require("../models/StockTransfer");
const StockCount = require("../models/StockCount");
const AppError = require("../errors/AppError");

/**
 * Helper to get list of ProductVariant IDs owned by a vendor.
 */
const getVendorVariantIds = async (vendorId) => {
  if (!vendorId || !mongoose.isValidObjectId(vendorId)) return null;
  const products = await Product.find({ vendorId, deletedAt: null }).select("_id").lean();
  const productIds = products.map((p) => p._id);
  const variants = await ProductVariant.find({ productId: { $in: productIds }, deletedAt: null })
    .select("_id")
    .lean();
  return variants.map((v) => v._id);
};

/**
 * 1. Warehouse Dashboard Overview Metrics
 */
const getWarehouseDashboardOverview = async ({ warehouseId = null, vendorId = null } = {}) => {
  const invQuery = {};
  const transferQuery = { status: "dispatched" };

  if (warehouseId && mongoose.isValidObjectId(warehouseId)) {
    invQuery.warehouseId = warehouseId;
    transferQuery.$or = [{ sourceWarehouseId: warehouseId }, { destinationWarehouseId: warehouseId }];
  }

  const vendorVariantIds = await getVendorVariantIds(vendorId);
  if (vendorVariantIds) {
    invQuery.productVariantId = { $in: vendorVariantIds };
  }

  // Authoritative Inventory totals
  const inventories = await Inventory.find(invQuery).lean();

  let totalUnitsOnHand = 0;
  let totalUnitsReserved = 0;
  let totalUnitsDamaged = 0;
  let totalUnitsDefective = 0;
  let totalUnitsExpired = 0;
  let totalUnitsNonSellable = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  for (const inv of inventories) {
    const onHand = inv.onHand || 0;
    const reserved = inv.reserved || 0;
    const damaged = inv.damaged || 0;
    const defective = inv.defective || 0;
    const expired = inv.expired || 0;
    const nonSellable = damaged + defective + expired;
    const available = Math.max(0, onHand - reserved - nonSellable);
    const threshold = inv.lowStockThreshold || 5;

    totalUnitsOnHand += onHand;
    totalUnitsReserved += reserved;
    totalUnitsDamaged += damaged;
    totalUnitsDefective += defective;
    totalUnitsExpired += expired;
    totalUnitsNonSellable += nonSellable;

    if (available === 0) {
      outOfStockCount++;
    } else if (available <= threshold) {
      lowStockCount++;
    }
  }

  const totalUnitsAvailable = Math.max(0, totalUnitsOnHand - totalUnitsReserved - totalUnitsNonSellable);

  // In-transit stock calculation from active transfers
  const activeDispatchedTransfers = await StockTransfer.find(transferQuery).lean();
  let totalInTransitUnits = 0;
  for (const transfer of activeDispatchedTransfers) {
    for (const item of transfer.items || []) {
      if (vendorVariantIds && !vendorVariantIds.some((vId) => vId.toString() === item.productVariantId?.toString())) {
        continue;
      }
      totalInTransitUnits += (item.quantityDispatched || 0) - (item.quantityReceived || 0);
    }
  }

  // Count active warehouses
  const totalWarehouses = await Warehouse.countDocuments({ isActive: true, deletedAt: null });

  // Recent operational records
  const recentReceivingFilter = warehouseId ? { warehouseId } : {};
  const recentTransferFilter = warehouseId
    ? { $or: [{ sourceWarehouseId: warehouseId }, { destinationWarehouseId: warehouseId }] }
    : {};
  const recentCountFilter = warehouseId ? { warehouseId } : {};

  const [recentReceivings, recentTransfers, recentStockCounts] = await Promise.all([
    StockReceiving.find(recentReceivingFilter)
      .populate("warehouseId", "name code")
      .populate("receivedBy", "name email")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    StockTransfer.find(recentTransferFilter)
      .populate("sourceWarehouseId", "name code")
      .populate("destinationWarehouseId", "name code")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    StockCount.find(recentCountFilter)
      .populate("warehouseId", "name code")
      .populate("completedBy", "name email")
      .populate("startedBy", "name email")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
  ]);

  return {
    metrics: {
      totalWarehouses,
      totalRecords: inventories.length,
      totalUnitsOnHand,
      totalUnitsReserved,
      totalUnitsDamaged,
      totalUnitsDefective,
      totalUnitsExpired,
      totalUnitsNonSellable,
      totalUnitsAvailable,
      totalInTransitUnits,
      lowStockCount,
      outOfStockCount,
    },
    recentActivity: {
      receivings: recentReceivings,
      transfers: recentTransfers,
      stockCounts: recentStockCounts,
    },
  };
};

/**
 * 2. Warehouse Inventory Report with pagination and filtering
 */
const getWarehouseInventoryReport = async ({
  warehouseId = null,
  search = "",
  isLowStock = null,
  isOutOfStock = null,
  page = 1,
  limit = 20,
  vendorId = null,
} = {}) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (safePage - 1) * safeLimit;

  const invQuery = {};
  if (warehouseId && mongoose.isValidObjectId(warehouseId)) {
    invQuery.warehouseId = warehouseId;
  }

  const vendorVariantIds = await getVendorVariantIds(vendorId);
  if (vendorVariantIds) {
    invQuery.productVariantId = { $in: vendorVariantIds };
  }

  // Handle text search on SKU or Product Title
  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), "i");
    const matchedProducts = await Product.find({
      $or: [{ name: searchRegex }, { title: searchRegex }],
      deletedAt: null,
    })
      .select("_id")
      .lean();
    const matchedProductIds = matchedProducts.map((p) => p._id);

    const matchedVariants = await ProductVariant.find({
      $or: [{ sku: searchRegex }, { productId: { $in: matchedProductIds } }],
      deletedAt: null,
    })
      .select("_id")
      .lean();

    const matchedVariantIds = matchedVariants.map((v) => v._id);

    if (invQuery.productVariantId) {
      const allowedSet = new Set(vendorVariantIds.map((id) => id.toString()));
      invQuery.productVariantId = {
        $in: matchedVariantIds.filter((id) => allowedSet.has(id.toString())),
      };
    } else {
      invQuery.productVariantId = { $in: matchedVariantIds };
    }
  }

  const [inventories, total] = await Promise.all([
    Inventory.find(invQuery)
      .populate({
        path: "productVariantId",
        select: "sku title price productId attributes",
        populate: { path: "productId", select: "name title vendorId status" },
      })
      .populate("warehouseId", "name code city state isActive")
      .skip(skip)
      .limit(safeLimit)
      .sort({ updatedAt: -1 })
      .lean(),
    Inventory.countDocuments(invQuery),
  ]);

  const items = inventories.map((inv) => {
    const onHand = inv.onHand || 0;
    const reserved = inv.reserved || 0;
    const damaged = inv.damaged || 0;
    const defective = inv.defective || 0;
    const expired = inv.expired || 0;
    const nonSellable = damaged + defective + expired;
    const available = Math.max(0, onHand - reserved - nonSellable);
    const lowStockThreshold = inv.lowStockThreshold || 5;

    return {
      id: inv._id,
      productVariant: inv.productVariantId,
      warehouse: inv.warehouseId,
      onHand,
      reserved,
      damaged,
      defective,
      expired,
      nonSellable,
      available,
      lowStockThreshold,
      isLowStock: available <= lowStockThreshold,
      isOutOfStock: available === 0,
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
 * 3. Warehouse Movement History (Auditable Transaction Ledger)
 */
const getWarehouseMovementHistory = async ({
  warehouseId = null,
  type = null,
  dateFrom = null,
  dateTo = null,
  page = 1,
  limit = 20,
  vendorId = null,
} = {}) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (safePage - 1) * safeLimit;

  const txQuery = {};
  if (warehouseId && mongoose.isValidObjectId(warehouseId)) {
    txQuery.warehouseId = warehouseId;
  }
  if (type) {
    txQuery.type = type;
  }
  if (dateFrom || dateTo) {
    txQuery.createdAt = {};
    if (dateFrom) txQuery.createdAt.$gte = new Date(dateFrom);
    if (dateTo) txQuery.createdAt.$lte = new Date(dateTo);
  }

  const vendorVariantIds = await getVendorVariantIds(vendorId);
  if (vendorVariantIds) {
    txQuery.productVariantId = { $in: vendorVariantIds };
  }

  const [transactions, total] = await Promise.all([
    InventoryTransaction.find(txQuery)
      .populate({
        path: "productVariantId",
        select: "sku title price productId",
        populate: { path: "productId", select: "name title" },
      })
      .populate("warehouseId", "name code")
      .populate("actorUserId", "name email role")
      .skip(skip)
      .limit(safeLimit)
      .sort({ createdAt: -1 })
      .lean(),
    InventoryTransaction.countDocuments(txQuery),
  ]);

  return {
    items: transactions,
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
};

module.exports = {
  getWarehouseDashboardOverview,
  getWarehouseInventoryReport,
  getWarehouseMovementHistory,
};
