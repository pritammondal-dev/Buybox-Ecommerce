const mongoose = require("mongoose");
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

const getMyVendorWarehouseById = async ({ userId, warehouseId, query = {} }) => {
  const vendor = await resolveApprovedVendor(userId);

  let resolvedWarehouseId;
  try {
    resolvedWarehouseId = decodeSecureId(warehouseId, "warehouse");
  } catch {
    resolvedWarehouseId = warehouseId;
  }

  if (!mongoose.Types.ObjectId.isValid(resolvedWarehouseId)) {
    throw new AppError("Warehouse not found", 404, "WAREHOUSE_NOT_FOUND");
  }

  const wh = await Warehouse.findOne({
    _id: resolvedWarehouseId,
    deletedAt: null,
  })
    .populate("managerUserId", "firstName lastName email phone")
    .lean();

  if (!wh) {
    throw new AppError("Warehouse not found", 404, "WAREHOUSE_NOT_FOUND");
  }

  const products = await Product.find({
    vendorId: vendor._id,
    deletedAt: null,
  })
    .select("_id name sku images status isFeatured")
    .lean();
  const productIds = products.map((p) => p._id);
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  const variants = await ProductVariant.find({
    productId: { $in: productIds },
  })
    .select("_id productId sku name attributes price compareAtPrice stockStatus image isDefault")
    .lean();
  const variantIds = variants.map((v) => v._id);
  const variantMap = new Map(variants.map((v) => [v._id.toString(), v]));

  const inventories = await Inventory.find({
    warehouseId: wh._id,
    productVariantId: { $in: variantIds },
  }).lean();

  let totalOnHandUnits = 0;
  let reservedStock = 0;
  let availableStock = 0;
  let lowStockSkus = 0;
  let outOfStockSkus = 0;

  for (const inv of inventories) {
    const onHand = inv.onHand || 0;
    const reserved = inv.reserved || 0;
    const nonSellable = (inv.damaged || 0) + (inv.defective || 0) + (inv.expired || 0);
    const avail = Math.max(onHand - reserved - nonSellable, 0);
    const threshold = inv.lowStockThreshold || 5;

    totalOnHandUnits += onHand;
    reservedStock += reserved;
    availableStock += avail;

    if (avail === 0) {
      outOfStockSkus += 1;
      lowStockSkus += 1;
    } else if (avail <= threshold) {
      lowStockSkus += 1;
    }
  }

  const overview = {
    totalSkus: inventories.length,
    totalOnHandUnits,
    onHandUnits: totalOnHandUnits,
    availableStock,
    reservedStock,
    lowStockSkus,
    outOfStockSkus,
  };

  const allStockItems = inventories.map((inv) => {
    const variant = variantMap.get(inv.productVariantId.toString());
    const product = variant ? productMap.get(variant.productId?.toString()) : null;
    const onHand = inv.onHand || 0;
    const reserved = inv.reserved || 0;
    const nonSellable = (inv.damaged || 0) + (inv.defective || 0) + (inv.expired || 0);
    const available = Math.max(onHand - reserved - nonSellable, 0);
    const threshold = inv.lowStockThreshold || 5;

    let stockStatus = "in_stock";
    if (available === 0) {
      stockStatus = "out_of_stock";
    } else if (available <= threshold) {
      stockStatus = "low_stock";
    }

    let formattedVariantName = "";
    if (variant?.name && variant.name.trim().length > 0) {
      formattedVariantName = variant.name.trim();
    } else if (variant?.attributes) {
      const entries =
        variant.attributes instanceof Map
          ? Array.from(variant.attributes.entries())
          : Object.entries(variant.attributes);
      if (entries.length > 0) {
        formattedVariantName = entries.map(([k, v]) => `${k}: ${v}`).join(", ");
      }
    }
    if (!formattedVariantName) {
      formattedVariantName = "Default Variant";
    }

    const productImage = variant?.image?.url || product?.images?.[0]?.url || null;

    return {
      _id: inv._id,
      secureId: encodeSecureId("inventory", inv._id),
      productId: product?._id || null,
      productSecureId: product ? encodeSecureId("product", product._id) : null,
      productName: product?.name || "Product",
      productTitle: product?.name || "Product",
      productSku: product?.sku || "N/A",
      productImage,
      productStatus: product?.status || "active",
      variantId: variant?._id || null,
      variantSecureId: variant ? encodeSecureId("variant", variant._id) : null,
      variantName: formattedVariantName,
      variantSku: variant?.sku || "N/A",
      sku: variant?.sku || "N/A",
      price: variant?.price ? variant.price.toString() : "0.00",
      compareAtPrice: variant?.compareAtPrice ? variant.compareAtPrice.toString() : null,
      onHand,
      reserved,
      available,
      damaged: inv.damaged || 0,
      defective: inv.defective || 0,
      expired: inv.expired || 0,
      lowStockThreshold: threshold,
      stockStatus,
      isLowStock: available <= threshold,
      lastStockUpdateAt: inv.lastStockUpdateAt || inv.updatedAt || inv.createdAt,
      updatedAt: inv.updatedAt || inv.createdAt,
    };
  });

  let filtered = allStockItems;

  if (query.search && typeof query.search === "string" && query.search.trim().length > 0) {
    const s = query.search.toLowerCase().trim();
    filtered = filtered.filter(
      (item) =>
        item.productName.toLowerCase().includes(s) ||
        item.productSku.toLowerCase().includes(s) ||
        item.variantSku.toLowerCase().includes(s) ||
        item.variantName.toLowerCase().includes(s)
    );
  }

  if (query.status && query.status !== "all") {
    filtered = filtered.filter((item) => item.stockStatus === query.status);
  }

  const sortBy = query.sortBy || "updatedAt";
  const sortOrder = query.sortOrder === "asc" ? 1 : -1;

  filtered.sort((a, b) => {
    let valA = a[sortBy];
    let valB = b[sortBy];

    if (sortBy === "name" || sortBy === "productName") {
      valA = (a.productName || "").toLowerCase();
      valB = (b.productName || "").toLowerCase();
      return sortOrder * valA.localeCompare(valB);
    }
    if (sortBy === "sku" || sortBy === "variantSku") {
      valA = (a.variantSku || "").toLowerCase();
      valB = (b.variantSku || "").toLowerCase();
      return sortOrder * valA.localeCompare(valB);
    }
    if (sortBy === "updatedAt" || sortBy === "lastStockUpdateAt") {
      valA = new Date(valA || 0).getTime();
      valB = new Date(valB || 0).getTime();
      return sortOrder * (valA - valB);
    }
    if (typeof valA === "number" && typeof valB === "number") {
      return sortOrder * (valA - valB);
    }
    return 0;
  });

  const safePage = Math.max(1, parseInt(query.page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const total = filtered.length;
  const totalPages = Math.ceil(total / safeLimit) || 0;
  const startIndex = (safePage - 1) * safeLimit;
  const paginatedItems = filtered.slice(startIndex, startIndex + safeLimit);

  const managerName = wh.managerUserId
    ? `${wh.managerUserId.firstName || ""} ${wh.managerUserId.lastName || ""}`.trim()
    : null;

  const warehouseType = wh.type || "Regional Fulfillment Center";

  return {
    _id: wh._id,
    secureId: encodeSecureId("warehouse", wh._id),
    name: wh.name,
    code: wh.code,
    type: warehouseType,
    warehouseType,
    status: wh.isActive ? "active" : "inactive",
    description: wh.description || null,
    address: {
      addressLine1: wh.address?.addressLine1 || "",
      addressLine2: wh.address?.addressLine2 || "",
      city: wh.address?.city || "",
      state: wh.address?.state || "",
      postalCode: wh.address?.postalCode || "",
      country: wh.address?.country || "IN",
    },
    contactPerson: managerName || wh.contactPerson || null,
    contactPhone: wh.contactPhone || null,
    contactEmail: wh.contactEmail || null,
    capacity: wh.capacity || 0,
    operatingHours: wh.operatingHours || null,
    isActive: wh.isActive,
    overview,
    items: paginatedItems,
    stockItems: paginatedItems,
    allStockItems,
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages,
    },
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