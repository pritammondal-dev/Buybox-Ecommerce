const warehouseRepository = require("../repositories/warehouse.repository");
const AppError = require("../errors/AppError");

const createWarehouse = async (data) => {
  const existing =
    await warehouseRepository.findByCode(data.code);

  if (existing) {
    throw new AppError(
      "Warehouse code is already in use",
      409,
      "WAREHOUSE_CODE_ALREADY_EXISTS"
    );
  }

  return warehouseRepository.create(data);
};

const getWarehouse = async (id) => {
  const warehouse =
    await warehouseRepository.findById(id);

  if (!warehouse) {
    throw new AppError(
      "Warehouse not found",
      404,
      "WAREHOUSE_NOT_FOUND"
    );
  }

  return warehouse;
};

const listWarehouses = async () => {
  return warehouseRepository.findAll();
};

const validateWarehouseCanBeDeactivatedOrDeleted = async (warehouseId) => {
  const mongoose = require("mongoose");
  if (mongoose.connection.readyState !== 1) return;

  const Inventory = require("../models/Inventory");
  const Order = require("../models/Order");

  // 1. Check for on-hand or reserved stock
  const activeStock = await Inventory.findOne({
    warehouseId,
    $or: [{ onHand: { $gt: 0 } }, { reserved: { $gt: 0 } }],
  });

  if (activeStock) {
    throw new AppError(
      "Cannot deactivate or delete warehouse with active on-hand or reserved stock. Transfer or write off inventory first.",
      409,
      "WAREHOUSE_HAS_ACTIVE_INVENTORY"
    );
  }

  // 2. Check for active unfulfilled orders assigned to this warehouse
  const activeOrder = await Order.findOne({
    status: { $in: ["pending", "confirmed", "processing"] },
    "items.warehouseId": warehouseId,
  });

  if (activeOrder) {
    throw new AppError(
      `Cannot deactivate or delete warehouse associated with active unfulfilled order ${activeOrder.orderNumber}.`,
      409,
      "WAREHOUSE_HAS_ACTIVE_ORDERS"
    );
  }

  // 3. Check for in-transit stock transfers
  try {
    const StockTransfer = require("../models/StockTransfer");
    const activeTransfer = await StockTransfer.findOne({
      $or: [{ sourceWarehouseId: warehouseId }, { destinationWarehouseId: warehouseId }],
      status: { $in: ["dispatched", "partially_received"] },
    });

    if (activeTransfer) {
      throw new AppError(
        `Cannot deactivate or delete warehouse with in-transit transfer ${activeTransfer.transferNumber}.`,
        409,
        "WAREHOUSE_HAS_ACTIVE_TRANSFERS"
      );
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
  }
};

const updateWarehouse = async (id, data) => {
  const warehouse =
    await warehouseRepository.findById(id);

  if (!warehouse) {
    throw new AppError(
      "Warehouse not found",
      404,
      "WAREHOUSE_NOT_FOUND"
    );
  }

  if (data.code && data.code.toUpperCase() !== warehouse.code.toUpperCase()) {
    const existingCode = await warehouseRepository.findByCode(data.code);
    if (existingCode && existingCode._id.toString() !== id.toString()) {
      throw new AppError(
        "Warehouse code is already in use",
        409,
        "WAREHOUSE_CODE_ALREADY_EXISTS"
      );
    }
  }

  if (data.isActive === false && warehouse.isActive === true) {
    await validateWarehouseCanBeDeactivatedOrDeleted(id);
  }

  return warehouseRepository.updateById(
    id,
    data
  );
};

const deleteWarehouse = async (id) => {
  const warehouse =
    await warehouseRepository.findById(id);

  if (!warehouse) {
    throw new AppError(
      "Warehouse not found",
      404,
      "WAREHOUSE_NOT_FOUND"
    );
  }

  await validateWarehouseCanBeDeactivatedOrDeleted(id);

  return warehouseRepository.softDeleteById(id);
};

const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const Inventory = require("../models/Inventory");
const Warehouse = require("../models/Warehouse");
const { resolveApprovedVendor } = require("../middlewares/vendor.middleware");
const { encodeSecureId, decodeSecureId } = require("../utils/secure-id.util");

const getMyVendorWarehouses = async ({ userId }) => {
  const vendor = await resolveApprovedVendor(userId);

  const allWarehouses = await Warehouse.find({
    isActive: true,
    deletedAt: null,
  }).lean();

  const products = await Product.find({
    vendorId: vendor._id,
    deletedAt: null,
  }).select("_id").lean();
  const productIds = products.map((p) => p._id);

  const variants = await ProductVariant.find({
    productId: { $in: productIds },
  }).select("_id").lean();
  const variantIds = variants.map((v) => v._id);

  const inventories = await Inventory.find({
    productVariantId: { $in: variantIds },
  }).lean();

  const warehouseStats = new Map();
  for (const inv of inventories) {
    const whId = inv.warehouseId.toString();
    if (!warehouseStats.has(whId)) {
      warehouseStats.set(whId, { totalOnHand: 0, reserved: 0, skuCount: 0, lowStockCount: 0 });
    }
    const stat = warehouseStats.get(whId);
    stat.totalOnHand += inv.onHand || 0;
    stat.reserved += inv.reserved || 0;
    stat.skuCount += 1;
    const available = (inv.onHand || 0) - (inv.reserved || 0);
    if (available <= (inv.lowStockThreshold || 5)) {
      stat.lowStockCount += 1;
    }
  }

  return allWarehouses.map((wh) => {
    const stats = warehouseStats.get(wh._id.toString()) || {
      totalOnHand: 0,
      reserved: 0,
      skuCount: 0,
      lowStockCount: 0,
    };
    return {
      _id: wh._id,
      secureId: encodeSecureId("warehouse", wh._id),
      name: wh.name,
      code: wh.code,
      description: wh.description,
      address: wh.address,
      contactPhone: wh.contactPhone,
      contactEmail: wh.contactEmail,
      isActive: wh.isActive,
      vendorStockOnHand: stats.totalOnHand,
      vendorReservedStock: stats.reserved,
      vendorAvailableStock: Math.max(stats.totalOnHand - stats.reserved, 0),
      vendorSKUsCount: stats.skuCount,
      vendorLowStockCount: stats.lowStockCount,
    };
  });
};

const getMyVendorWarehouseById = async ({ userId, warehouseId }) => {
  const vendor = await resolveApprovedVendor(userId);
  const resolvedWarehouseId = decodeSecureId(warehouseId, "warehouse");

  const wh = await Warehouse.findOne({
    _id: resolvedWarehouseId,
    deletedAt: null,
  }).lean();

  if (!wh) {
    throw new AppError("Warehouse not found", 404, "WAREHOUSE_NOT_FOUND");
  }

  const products = await Product.find({
    vendorId: vendor._id,
    deletedAt: null,
  }).select("_id title").lean();
  const productIds = products.map((p) => p._id);
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  const variants = await ProductVariant.find({
    productId: { $in: productIds },
  }).lean();
  const variantIds = variants.map((v) => v._id);
  const variantMap = new Map(variants.map((v) => [v._id.toString(), v]));

  const inventories = await Inventory.find({
    warehouseId: wh._id,
    productVariantId: { $in: variantIds },
  }).lean();

  const stockItems = inventories.map((inv) => {
    const variant = variantMap.get(inv.productVariantId.toString());
    const product = variant ? productMap.get(variant.productId?.toString()) : null;
    const available = Math.max((inv.onHand || 0) - (inv.reserved || 0), 0);
    return {
      _id: inv._id,
      secureId: encodeSecureId("inventory", inv._id),
      sku: variant?.sku || "N/A",
      productTitle: product?.title || "Product",
      onHand: inv.onHand || 0,
      reserved: inv.reserved || 0,
      available,
      lowStockThreshold: inv.lowStockThreshold || 5,
    };
  });

  return {
    _id: wh._id,
    secureId: encodeSecureId("warehouse", wh._id),
    name: wh.name,
    code: wh.code,
    description: wh.description,
    address: wh.address,
    contactPhone: wh.contactPhone,
    contactEmail: wh.contactEmail,
    isActive: wh.isActive,
    stockItems,
  };
};

module.exports = {
  createWarehouse,
  getWarehouse,
  listWarehouses,
  updateWarehouse,
  deleteWarehouse,
  getMyVendorWarehouses,
  getMyVendorWarehouseById,
};