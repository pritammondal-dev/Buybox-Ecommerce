const mongoose = require("mongoose");
const xlsx = require("xlsx");
const Inventory = require("../models/Inventory");
const Warehouse = require("../models/Warehouse");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const InventoryTransaction = require("../models/InventoryTransaction");
const StockReceiving = require("../models/StockReceiving");
const StockTransfer = require("../models/StockTransfer");
const StockCount = require("../models/StockCount");
const Order = require("../models/Order");
const { resolveApprovedVendor } = require("../middlewares/vendor.middleware");
const { decodeSecureId } = require("../utils/secure-id.util");
const AppError = require("../errors/AppError");

const sanitizeCellValue = (val) => {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
};

const resolveDateRange = ({ period = "30d", days, startDate, endDate }) => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const date = now.getUTCDate();

  const numDays =
    typeof days === "number" && days > 0
      ? days
      : typeof period === "number" && period > 0
      ? period
      : !isNaN(Number(period)) && Number(period) > 0
      ? Number(period)
      : null;

  if (numDays) {
    return {
      period: `${numDays}d`,
      days: numDays,
      startDate: new Date(Date.UTC(year, month, date - (numDays - 1), 0, 0, 0, 0)),
      endDate: new Date(Date.UTC(year, month, date, 23, 59, 59, 999)),
    };
  }

  if (period === "today") {
    return {
      period,
      days: 1,
      startDate: new Date(Date.UTC(year, month, date, 0, 0, 0, 0)),
      endDate: new Date(Date.UTC(year, month, date, 23, 59, 59, 999)),
    };
  }

  if (period === "7d" || period === "last_7_days") {
    return {
      period: "7d",
      days: 7,
      startDate: new Date(Date.UTC(year, month, date - 6, 0, 0, 0, 0)),
      endDate: new Date(Date.UTC(year, month, date, 23, 59, 59, 999)),
    };
  }

  if (period === "30d" || period === "last_30_days") {
    return {
      period: "30d",
      days: 30,
      startDate: new Date(Date.UTC(year, month, date - 29, 0, 0, 0, 0)),
      endDate: new Date(Date.UTC(year, month, date, 23, 59, 59, 999)),
    };
  }

  if (period === "90d" || period === "last_90_days") {
    return {
      period: "90d",
      days: 90,
      startDate: new Date(Date.UTC(year, month, date - 89, 0, 0, 0, 0)),
      endDate: new Date(Date.UTC(year, month, date, 23, 59, 59, 999)),
    };
  }

  if (period === "this_month") {
    const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, date, 23, 59, 59, 999));
    const daysCount = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    return { period, days: daysCount, startDate: start, endDate: end };
  }

  if (period === "custom" && startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
      const daysCount = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
      return { period: "custom", days: daysCount, startDate: start, endDate: end };
    }
  }

  // Fallback to 30 days
  return {
    period: "30d",
    days: 30,
    startDate: new Date(Date.UTC(year, month, date - 29, 0, 0, 0, 0)),
    endDate: new Date(Date.UTC(year, month, date, 23, 59, 59, 999)),
  };
};

const resolveWarehouseFilter = (rawId) => {
  if (!rawId || rawId === "all") return null;
  const trimmed = String(rawId).trim();
  if (trimmed.startsWith("wh_")) {
    try {
      const decoded = decodeSecureId(trimmed, "warehouse", { strict: false });
      if (mongoose.isValidObjectId(decoded)) return new mongoose.Types.ObjectId(decoded);
    } catch {
      // Fallback
    }
  }
  if (mongoose.isValidObjectId(trimmed)) {
    return new mongoose.Types.ObjectId(trimmed);
  }
  return null;
};

/**
 * ============================================================
 * 1. WAREHOUSE OVERVIEW KPIS & SUMMARY
 * ============================================================
 */
const getVendorWarehouseOverview = async ({ userId, query = {}, ...rest }) => {
  const q = { ...rest, ...query };
  const vendor = await resolveApprovedVendor(userId);
  const warehouseId = resolveWarehouseFilter(q.warehouseId);
  const categoryId = q.categoryId && mongoose.isValidObjectId(q.categoryId)
    ? new mongoose.Types.ObjectId(q.categoryId)
    : null;

  // 1. Fetch vendor products & variants
  const prodQuery = { vendorId: vendor._id, deletedAt: null };
  if (categoryId) {
    prodQuery.categoryId = categoryId;
  }
  const products = await Product.find(prodQuery).select("_id name sku categoryId price").lean();
  const productIds = products.map((p) => p._id);
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  if (productIds.length === 0) {
    const emptyKpis = {
      totalSkus: 0,
      totalOnHandUnits: 0,
      availableUnits: 0,
      totalAvailableUnits: 0,
      reservedUnits: 0,
      totalReservedUnits: 0,
      nonSellableUnits: 0,
      totalNonSellableUnits: 0,
      damagedUnits: 0,
      defectiveUnits: 0,
      expiredUnits: 0,
      lowStockSkus: 0,
      lowStockSkusCount: 0,
      outOfStockSkus: 0,
      outOfStockSkusCount: 0,
      totalActiveWarehouses: 0,
      activeWarehousesCount: 0,
      latestInventoryAccuracy: null,
      latestInventoryAccuracyRate: 100,
      totalInventoryRetailValue: 0,
      totalInventoryCostValue: null,
      retailValuation: 0,
      costValuation: null,
    };
    return {
      selectedWarehouse: warehouseId ? warehouseId.toString() : "all",
      ...emptyKpis,
      kpis: emptyKpis,
    };
  }

  const variants = await ProductVariant.find({
    productId: { $in: productIds },
    deletedAt: null,
  }).select("_id productId sku name price costPrice stockStatus").lean();
  const variantIds = variants.map((v) => v._id);
  const variantMap = new Map(variants.map((v) => [v._id.toString(), v]));

  // 2. Fetch inventory records across active warehouses
  const invQuery = {
    productVariantId: { $in: variantIds },
  };
  if (warehouseId) {
    invQuery.warehouseId = warehouseId;
  }

  const inventories = await Inventory.find(invQuery).lean();

  // Filter to only active warehouses
  const activeWarehouses = await Warehouse.find({ isActive: true, deletedAt: null }).select("_id").lean();
  const activeWhSet = new Set(activeWarehouses.map((w) => w._id.toString()));

  const eligibleInventories = inventories.filter((inv) => activeWhSet.has(inv.warehouseId.toString()));

  let totalOnHandUnits = 0;
  let availableUnits = 0;
  let reservedUnits = 0;
  let damagedUnits = 0;
  let defectiveUnits = 0;
  let expiredUnits = 0;
  let lowStockSkus = 0;
  let outOfStockSkus = 0;
  let totalInventoryRetailValue = 0;
  let totalInventoryCostValue = 0;
  let hasValidCostValues = false;

  const distinctWarehouses = new Set();
  const distinctSkusWithStock = new Set();

  for (const inv of eligibleInventories) {
    distinctWarehouses.add(inv.warehouseId.toString());
    distinctSkusWithStock.add(inv.productVariantId.toString());

    const onHand = inv.onHand || 0;
    const reserved = inv.reserved || 0;
    const damaged = inv.damaged || 0;
    const defective = inv.defective || 0;
    const expired = inv.expired || 0;
    const nonSellable = damaged + defective + expired;
    const available = Math.max(0, onHand - reserved - nonSellable);
    const threshold = inv.lowStockThreshold || 5;

    totalOnHandUnits += onHand;
    availableUnits += available;
    reservedUnits += reserved;
    damagedUnits += damaged;
    defectiveUnits += defective;
    expiredUnits += expired;

    if (available === 0) {
      outOfStockSkus += 1;
      lowStockSkus += 1;
    } else if (available <= threshold) {
      lowStockSkus += 1;
    }

    const variant = variantMap.get(inv.productVariantId.toString());
    const unitPrice = variant?.price ? Number(variant.price.toString()) : 0;
    totalInventoryRetailValue += onHand * unitPrice;

    if (variant?.costPrice) {
      const unitCost = Number(variant.costPrice.toString());
      if (unitCost > 0) {
        totalInventoryCostValue += onHand * unitCost;
        hasValidCostValues = true;
      }
    }
  }

  const nonSellableUnits = damagedUnits + defectiveUnits + expiredUnits;

  // 3. Fetch latest reconciled stock count accuracy
  const countQuery = { vendorId: vendor._id, status: { $in: ["reconciled", "finalized"] } };
  if (warehouseId) {
    countQuery.warehouseId = warehouseId;
  }
  const latestCount = await StockCount.findOne(countQuery)
    .sort({ reconciledAt: -1, createdAt: -1 })
    .select("countNumber skuAccuracyRate quantityAccuracyRate totalExpectedQty totalCountedQty reconciledAt accuracyRate metrics")
    .lean();

  const accRate = latestCount?.quantityAccuracyRate ?? latestCount?.skuAccuracyRate ?? latestCount?.accuracyRate ?? latestCount?.metrics?.accuracyRate ?? 100;

  const latestInventoryAccuracy = latestCount ? {
    countNumber: latestCount.countNumber,
    skuAccuracyRate: latestCount.skuAccuracyRate ?? accRate,
    quantityAccuracyRate: accRate,
    reconciledAt: latestCount.reconciledAt || null,
  } : null;

  const kpis = {
    totalSkus: distinctSkusWithStock.size,
    totalOnHandUnits,
    availableUnits,
    totalAvailableUnits: availableUnits,
    reservedUnits,
    totalReservedUnits: reservedUnits,
    nonSellableUnits,
    totalNonSellableUnits: nonSellableUnits,
    damagedUnits,
    defectiveUnits,
    expiredUnits,
    lowStockSkus,
    lowStockSkusCount: lowStockSkus,
    outOfStockSkus,
    outOfStockSkusCount: outOfStockSkus,
    totalActiveWarehouses: distinctWarehouses.size,
    activeWarehousesCount: distinctWarehouses.size,
    latestInventoryAccuracy,
    latestInventoryAccuracyRate: latestInventoryAccuracy ? accRate : 100,
    totalInventoryRetailValue: Math.round(totalInventoryRetailValue * 100) / 100,
    totalInventoryCostValue: hasValidCostValues ? Math.round(totalInventoryCostValue * 100) / 100 : null,
    retailValuation: Math.round(totalInventoryRetailValue * 100) / 100,
    costValuation: hasValidCostValues ? Math.round(totalInventoryCostValue * 100) / 100 : null,
  };

  return {
    selectedWarehouse: warehouseId ? warehouseId.toString() : "all",
    ...kpis,
    kpis,
  };
};

/**
 * ============================================================
 * 2. INVENTORY MOVEMENT ANALYTICS & TRENDS
 * ============================================================
 */
const getVendorMovementAnalytics = async ({ userId, query = {}, ...rest }) => {
  const q = { ...rest, ...query };
  const vendor = await resolveApprovedVendor(userId);
  const warehouseId = resolveWarehouseFilter(q.warehouseId);
  const range = resolveDateRange({
    period: q.period || "30d",
    days: q.days ? Number(q.days) : undefined,
    startDate: q.startDate,
    endDate: q.endDate,
  });

  const matchStage = {
    vendorId: vendor._id,
    createdAt: { $gte: range.startDate, $lte: range.endDate },
  };
  if (warehouseId) {
    matchStage.warehouseId = warehouseId;
  }

  // Aggregate movements by type
  const movementsByType = await InventoryTransaction.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$type",
        totalQuantity: { $sum: "$quantity" },
        transactionCount: { $sum: 1 },
      },
    },
  ]);

  const typeMap = new Map(movementsByType.map((m) => [m._id, m]));

  const receiveQty = typeMap.get("receive")?.totalQuantity || 0;
  const saleQty = Math.abs(typeMap.get("sale")?.totalQuantity || 0);
  const returnQty = typeMap.get("return")?.totalQuantity || 0;
  const transferQty = Math.abs(typeMap.get("transfer")?.totalQuantity || 0);
  const adjQty = typeMap.get("adjustment")?.totalQuantity || 0;
  const reconQty = typeMap.get("count_reconciliation")?.totalQuantity || 0;
  const conditionQty = Math.abs(typeMap.get("condition_change")?.totalQuantity || 0);

  // Inbound vs Outbound External Flow (Transfers are internal!)
  const totalInboundUnits = receiveQty + returnQty + (adjQty > 0 ? adjQty : 0);
  const totalOutboundUnits = saleQty + (adjQty < 0 ? Math.abs(adjQty) : 0);
  const netStockChange = totalInboundUnits - totalOutboundUnits + reconQty;

  // Daily time series aggregation
  const dailyTimeSeries = await InventoryTransaction.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" },
        },
        inbound: {
          $sum: {
            $cond: [
              { $in: ["$type", ["receive", "return"]] },
              "$quantity",
              { $cond: [{ $and: [{ $eq: ["$type", "adjustment"] }, { $gt: ["$quantity", 0] }] }, "$quantity", 0] },
            ],
          },
        },
        outbound: {
          $sum: {
            $cond: [
              { $eq: ["$type", "sale"] },
              { $abs: "$quantity" },
              { $cond: [{ $and: [{ $eq: ["$type", "adjustment"] }, { $lt: ["$quantity", 0] }] }, { $abs: "$quantity" }, 0] },
            ],
          },
        },
        transfers: {
          $sum: {
            $cond: [{ $eq: ["$type", "transfer"] }, { $abs: "$quantity" }, 0],
          },
        },
        reconciliation: {
          $sum: {
            $cond: [{ $eq: ["$type", "count_reconciliation"] }, "$quantity", 0],
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const trends = dailyTimeSeries.map((d) => ({
    date: d._id,
    inbound: d.inbound || 0,
    outbound: d.outbound || 0,
    netChange: (d.inbound || 0) - (d.outbound || 0) + (d.reconciliation || 0),
    transfers: d.transfers || 0,
  }));

  return {
    period: range.period,
    startDate: range.startDate.toISOString(),
    endDate: range.endDate.toISOString(),
    days: range.days,
    summary: {
      totalInboundUnits,
      totalOutboundUnits,
      netStockChange,
      receivedUnits: receiveQty,
      fulfilledSalesUnits: saleQty,
      customerReturnUnits: returnQty,
      netAdjustmentUnits: adjQty,
      transferVolumeUnits: transferQty,
      totalTransferUnits: transferQty,
      reconciliationAdjustmentUnits: reconQty,
      conditionChangeUnits: conditionQty,
      transferNotice: "Internal warehouse transfers are tracked separately to avoid double-counting external customer demand.",
      byType: {
        receive: receiveQty,
        sale: saleQty,
        transfer: transferQty,
        return: returnQty,
        adjustment: adjQty,
        count_reconciliation: reconQty,
        condition_change: conditionQty,
      },
    },
    dailyTrends: trends,
    timeSeries: trends,
  };
};

/**
 * ============================================================
 * 3. INVENTORY AGING & SLOW-MOVING STOCK (FIFO DEPLETION QUEUE)
 * ============================================================
 */
const getVendorInventoryAging = async ({ userId, query = {}, ...rest }) => {
  const q = { ...rest, ...query };
  const vendor = await resolveApprovedVendor(userId);
  const warehouseId = resolveWarehouseFilter(q.warehouseId);
  const categoryId = q.categoryId && mongoose.isValidObjectId(q.categoryId)
    ? new mongoose.Types.ObjectId(q.categoryId)
    : null;
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit, 10) || 20));
  const skip = (page - 1) * limit;

  // 1. Fetch products & variants
  const prodQuery = { vendorId: vendor._id, deletedAt: null };
  if (categoryId) {
    prodQuery.categoryId = categoryId;
  }
  const products = await Product.find(prodQuery).select("_id name sku categoryId price").lean();
  const productIds = products.map((p) => p._id);
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  const variants = await ProductVariant.find({
    productId: { $in: productIds },
    deletedAt: null,
  }).select("_id productId sku name price costPrice").lean();
  const variantIds = variants.map((v) => v._id);
  const variantMap = new Map(variants.map((v) => [v._id.toString(), v]));

  // 2. Fetch on-hand inventory
  const invQuery = { productVariantId: { $in: variantIds }, onHand: { $gt: 0 } };
  if (warehouseId) {
    invQuery.warehouseId = warehouseId;
  }
  const inventories = await Inventory.find(invQuery).lean();

  const now = new Date();
  let totalOnHandUnits = 0;
  let totalBucket0_30 = 0;
  let totalBucket31_60 = 0;
  let totalBucket61_90 = 0;
  let totalBucket91_180 = 0;
  let totalBucket181Plus = 0;

  // Inbound receipt transactions for FIFO allocation
  const receiptMatch = {
    vendorId: vendor._id,
    productVariantId: { $in: variantIds },
    type: { $in: ["receive", "transfer"] },
    quantity: { $gt: 0 },
  };
  if (warehouseId) {
    receiptMatch.warehouseId = warehouseId;
  }

  const receipts = await InventoryTransaction.find(receiptMatch)
    .sort({ createdAt: -1 })
    .select("productVariantId quantity createdAt")
    .lean();

  // Group receipts by productVariantId
  const receiptsByVariant = new Map();
  for (const rc of receipts) {
    const k = rc.productVariantId.toString();
    if (!receiptsByVariant.has(k)) {
      receiptsByVariant.set(k, []);
    }
    receiptsByVariant.get(k).push(rc);
  }

  // Recent 60-day sales count to identify zero-sales stock
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const recentSales = await InventoryTransaction.aggregate([
    {
      $match: {
        vendorId: vendor._id,
        productVariantId: { $in: variantIds },
        type: "sale",
        createdAt: { $gte: sixtyDaysAgo },
      },
    },
    {
      $group: {
        _id: "$productVariantId",
        totalSold: { $sum: { $abs: "$quantity" } },
      },
    },
  ]);
  const salesMap = new Map(recentSales.map((s) => [s._id.toString(), s.totalSold]));

  const agingItems = [];

  for (const inv of inventories) {
    const variantIdStr = inv.productVariantId.toString();
    const variant = variantMap.get(variantIdStr);
    if (!variant) continue;
    const product = productMap.get(variant.productId.toString());

    const onHand = inv.onHand || 0;
    totalOnHandUnits += onHand;

    // FIFO Depletion allocation
    let remaining = onHand;
    let b0_30 = 0;
    let b31_60 = 0;
    let b61_90 = 0;
    let b91_180 = 0;
    let b181Plus = 0;

    const variantReceipts = receiptsByVariant.get(variantIdStr) || [];
    let latestReceiptDate = variantReceipts[0]?.createdAt || inv.createdAt;

    for (const rx of variantReceipts) {
      if (remaining <= 0) break;
      const alloc = Math.min(remaining, rx.quantity);
      const diffDays = Math.floor((now - new Date(rx.createdAt)) / (1000 * 60 * 60 * 24));

      if (diffDays <= 30) b0_30 += alloc;
      else if (diffDays <= 60) b31_60 += alloc;
      else if (diffDays <= 90) b61_90 += alloc;
      else if (diffDays <= 180) b91_180 += alloc;
      else b181Plus += alloc;

      remaining -= alloc;
    }

    // Allocate any remaining stock against inventory creation baseline
    if (remaining > 0) {
      const baselineAge = Math.floor((now - new Date(inv.createdAt)) / (1000 * 60 * 60 * 24));
      if (baselineAge <= 30) b0_30 += remaining;
      else if (baselineAge <= 60) b31_60 += remaining;
      else if (baselineAge <= 90) b61_90 += remaining;
      else if (baselineAge <= 180) b91_180 += remaining;
      else b181Plus += remaining;
    }

    totalBucket0_30 += b0_30;
    totalBucket31_60 += b31_60;
    totalBucket61_90 += b61_90;
    totalBucket91_180 += b91_180;
    totalBucket181Plus += b181Plus;

    const sold60d = salesMap.get(variantIdStr) || 0;
    const agedUnits = b91_180 + b181Plus;
    const isSlowMoving = (b61_90 + agedUnits) > (onHand * 0.5) && sold60d < 5;
    const isZeroSales = onHand > 0 && sold60d === 0;

    const ageBrackets = {
      "0-30": b0_30,
      "31-60": b31_60,
      "61-90": b61_90,
      "91-180": b91_180,
      "181+": b181Plus,
    };

    agingItems.push({
      inventoryId: inv._id,
      productVariantId: variant._id,
      sku: variant.sku,
      productName: product?.name || variant.name || "Product",
      warehouseId: inv.warehouseId,
      onHand,
      bucket0_30: b0_30,
      bucket31_60: b31_60,
      bucket61_90: b61_90,
      bucket91_180: b91_180,
      bucket181Plus: b181Plus,
      ageBrackets,
      latestReceiptDate,
      daysSinceLatestReceipt: Math.max(0, Math.floor((now - new Date(latestReceiptDate)) / (1000 * 60 * 60 * 24))),
      soldLast60Days: sold60d,
      isSlowMoving,
      isZeroSales,
    });
  }

  const totalAgedUnits = totalBucket91_180 + totalBucket181Plus;
  const agedStockPercentage = totalOnHandUnits > 0
    ? Math.round((totalAgedUnits / totalOnHandUnits) * 10000) / 100
    : 0;

  // Sorting: slow moving and aged stock first
  agingItems.sort((a, b) => (b.bucket181Plus + b.bucket91_180) - (a.bucket181Plus + a.bucket91_180));

  const paginatedItems = agingItems.slice(skip, skip + limit);

  const disclosure = "Individual lot/batch tracking is not utilized by the facility. Inventory age is determined by allocating current on-hand quantities against historical receipt timestamps on a FIFO queue allocation basis (First-In, First-Out).";

  return {
    methodology: "fifo_depletion_allocation",
    methodologyLabel: "FIFO Depletion Queue Allocation",
    disclosure,
    limitationDisclosure: disclosure,
    brackets: {
      "0-30": { units: totalBucket0_30, label: "0–30 Days" },
      "31-60": { units: totalBucket31_60, label: "31–60 Days" },
      "61-90": { units: totalBucket61_90, label: "61–90 Days" },
      "91-180": { units: totalBucket91_180, label: "91–180 Days" },
      "181+": { units: totalBucket181Plus, label: "181+ Days" },
    },
    summary: {
      totalOnHandUnits,
      bucket0_30: totalBucket0_30,
      bucket31_60: totalBucket31_60,
      bucket61_90: totalBucket61_90,
      bucket91_180: totalBucket91_180,
      bucket181Plus: totalBucket181Plus,
      totalAgedUnits,
      agedStockPercentage,
      slowMovingCount: agingItems.filter((i) => i.isSlowMoving).length,
      slowMovingSkusCount: agingItems.filter((i) => i.isSlowMoving).length,
      zeroSalesCount: agingItems.filter((i) => i.isZeroSales).length,
      zeroSalesSkusCount: agingItems.filter((i) => i.isZeroSales).length,
    },
    items: paginatedItems,
    pagination: {
      total: agingItems.length,
      page,
      limit,
      totalPages: Math.ceil(agingItems.length / limit) || 1,
    },
  };
};

/**
 * ============================================================
 * 4. INVENTORY TURNOVER & DIO (WITH COST AVAILABILITY GUARD)
 * ============================================================
 */
const getVendorInventoryTurnover = async ({ userId, query = {}, ...rest }) => {
  const q = { ...rest, ...query };
  const vendor = await resolveApprovedVendor(userId);
  const warehouseId = resolveWarehouseFilter(q.warehouseId);
  const range = resolveDateRange({
    period: q.period || "30d",
    days: q.days ? Number(q.days) : undefined,
    startDate: q.startDate,
    endDate: q.endDate,
  });

  // 1. Check vendor catalog cost data availability
  const products = await Product.find({ vendorId: vendor._id, deletedAt: null }).select("_id").lean();
  const productIds = products.map((p) => p._id);

  const variants = await ProductVariant.find({
    productId: { $in: productIds },
    deletedAt: null,
  }).select("_id sku price costPrice").lean();

  const totalVariantCount = variants.length;
  let variantsWithCost = 0;
  const variantMap = new Map();

  for (const v of variants) {
    variantMap.set(v._id.toString(), v);
    if (v.costPrice !== null && v.costPrice !== undefined) {
      const c = Number(v.costPrice.toString());
      if (c > 0) variantsWithCost++;
    }
  }

  const costDataCoveragePercent = totalVariantCount > 0
    ? Math.round((variantsWithCost / totalVariantCount) * 10000) / 100
    : 0;

  // 2. Aggregate actual fulfilled units from InventoryTransaction during window
  const saleMatch = {
    vendorId: vendor._id,
    type: "sale",
    createdAt: { $gte: range.startDate, $lte: range.endDate },
  };
  if (warehouseId) {
    saleMatch.warehouseId = warehouseId;
  }

  const salesAgg = await InventoryTransaction.aggregate([
    { $match: saleMatch },
    {
      $group: {
        _id: "$productVariantId",
        totalSoldUnits: { $sum: { $abs: "$quantity" } },
      },
    },
  ]);

  let totalUnitsFulfilled = 0;
  let totalCogs = 0;

  for (const s of salesAgg) {
    const qty = s.totalSoldUnits || 0;
    totalUnitsFulfilled += qty;

    const v = variantMap.get(s._id.toString());
    if (v?.costPrice) {
      totalCogs += qty * Number(v.costPrice.toString());
    }
  }

  // 3. Compute Average On-Hand Stock during window
  const invMatch = {
    productVariantId: { $in: variants.map((v) => v._id) },
  };
  if (warehouseId) {
    invMatch.warehouseId = warehouseId;
  }
  const currentInventories = await Inventory.find(invMatch).select("onHand productVariantId").lean();

  let endingOnHandUnits = 0;
  let endingInventoryValue = 0;

  for (const inv of currentInventories) {
    endingOnHandUnits += inv.onHand || 0;
    const v = variantMap.get(inv.productVariantId.toString());
    if (v?.costPrice) {
      endingInventoryValue += (inv.onHand || 0) * Number(v.costPrice.toString());
    }
  }

  // Approximate beginning inventory: ending + sales - receipts
  const avgOnHandUnits = Math.max(1, endingOnHandUnits);
  const avgInventoryValue = Math.max(1, endingInventoryValue);

  // Unit-Based Movement Velocity (Always reliable)
  const unitMovementVelocity = Math.round((totalUnitsFulfilled / avgOnHandUnits) * 100) / 100;
  const annualizedTurnoverVelocity = Math.round((unitMovementVelocity * (365 / range.days)) * 100) / 100;

  // Cost-Based Turnover (Only when reliable cost exists)
  if (costDataCoveragePercent < 80) {
    return {
      period: range.period,
      days: range.days,
      costBasedTurnoverAvailable: false,
      costCoveragePercent: costDataCoveragePercent,
      costDataCoveragePercent,
      turnoverRatio: null,
      daysInventoryOutstanding: null,
      dio: null,
      reason: "cost_data_incomplete",
      costUnavailableReason: "cost_data_incomplete",
      formulaExplanation: "Inventory Turnover Ratio = Cost of Goods Sold / Average Inventory Value. Requires accurate vendor purchase cost (costPrice) on catalog variants.",
      stockMovementVelocity: {
        totalUnitsFulfilled,
        averageOnHandUnits: avgOnHandUnits,
        velocityRatio: unitMovementVelocity,
        annualizedTurnoverEstimate: annualizedTurnoverVelocity,
      },
      unitMovementVelocity: {
        totalUnitsFulfilled,
        averageOnHandUnits: avgOnHandUnits,
        velocityRatio: unitMovementVelocity,
        annualizedTurnoverEstimate: annualizedTurnoverVelocity,
      },
    };
  }

  const turnoverRatio = Math.round((totalCogs / avgInventoryValue) * 100) / 100;
  const daysInventoryOutstanding = turnoverRatio > 0
    ? Math.round((range.days / turnoverRatio) * 10) / 10
    : null;

  return {
    period: range.period,
    days: range.days,
    costBasedTurnoverAvailable: true,
    costCoveragePercent: costDataCoveragePercent,
    costDataCoveragePercent,
    costOfGoodsSold: Math.round(totalCogs * 100) / 100,
    cogs: Math.round(totalCogs * 100) / 100,
    averageInventoryValue: Math.round(avgInventoryValue * 100) / 100,
    turnoverRatio,
    daysInventoryOutstanding,
    dio: daysInventoryOutstanding,
    stockMovementVelocity: {
      totalUnitsFulfilled,
      averageOnHandUnits: avgOnHandUnits,
      velocityRatio: unitMovementVelocity,
      annualizedTurnoverEstimate: annualizedTurnoverVelocity,
    },
    unitMovementVelocity: {
      totalUnitsFulfilled,
      averageOnHandUnits: avgOnHandUnits,
      velocityRatio: unitMovementVelocity,
      annualizedTurnoverEstimate: annualizedTurnoverVelocity,
    },
  };
};

/**
 * ============================================================
 * 5. DEMAND & REPLENISHMENT INTELLIGENCE
 * ============================================================
 */
const getVendorDemandAndReplenishment = async ({ userId, query = {}, ...rest }) => {
  const q = { ...rest, ...query };
  const vendor = await resolveApprovedVendor(userId);
  const warehouseId = resolveWarehouseFilter(q.warehouseId);
  const categoryId = q.categoryId && mongoose.isValidObjectId(q.categoryId)
    ? new mongoose.Types.ObjectId(q.categoryId)
    : null;
  const riskFilter = q.riskLevel || "all";
  const windowDays = Math.min(90, Math.max(7, parseInt(q.windowDays, 10) || 30));
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit, 10) || 20));
  const skip = (page - 1) * limit;

  // 1. Fetch vendor products & variants
  const prodQuery = { vendorId: vendor._id, deletedAt: null };
  if (categoryId) {
    prodQuery.categoryId = categoryId;
  }
  const products = await Product.find(prodQuery).select("_id name sku categoryId").lean();
  const productIds = products.map((p) => p._id);
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  const variants = await ProductVariant.find({
    productId: { $in: productIds },
    deletedAt: null,
  }).select("_id productId sku name price").lean();
  const variantIds = variants.map((v) => v._id);
  const variantMap = new Map(variants.map((v) => [v._id.toString(), v]));

  // 2. Fetch live inventories
  const invQuery = { productVariantId: { $in: variantIds } };
  if (warehouseId) {
    invQuery.warehouseId = warehouseId;
  }
  const inventories = await Inventory.find(invQuery).lean();

  // 3. Compute historical fulfilled sales in window
  const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  // Demand from fulfilled orders
  const orderAgg = await Order.aggregate([
    {
      $match: {
        status: { $in: ["confirmed", "processing", "ready_to_ship", "shipped", "delivered", "completed"] },
        cancellationStatus: { $nin: ["pending", "completed"] },
        createdAt: { $gte: windowStart },
      },
    },
    { $unwind: "$items" },
    {
      $match: {
        "items.vendorId": vendor._id,
        ...(warehouseId ? { "items.warehouseId": warehouseId } : {}),
      },
    },
    {
      $group: {
        _id: { $ifNull: ["$items.productVariantId", "$items.variantId"] },
        totalSold: { $sum: "$items.quantity" },
      },
    },
  ]);

  const saleMatch = {
    vendorId: vendor._id,
    type: "sale",
    createdAt: { $gte: windowStart },
  };
  if (warehouseId) {
    saleMatch.warehouseId = warehouseId;
  }
  const salesAgg = await InventoryTransaction.aggregate([
    { $match: saleMatch },
    {
      $group: {
        _id: "$productVariantId",
        totalSold: { $sum: { $abs: "$quantity" } },
      },
    },
  ]);

  const salesMap = new Map();
  if (orderAgg.length > 0) {
    for (const o of orderAgg) {
      if (o._id) salesMap.set(o._id.toString(), o.totalSold);
    }
  } else {
    for (const s of salesAgg) {
      if (s._id) salesMap.set(s._id.toString(), s.totalSold);
    }
  }

  // 4. Inbound in-transit transfers (status: dispatched or in_transit)
  const transferMatch = {
    vendorId: vendor._id,
    status: { $in: ["dispatched", "in_transit"] },
  };
  if (warehouseId) {
    transferMatch.destinationWarehouseId = warehouseId;
  }
  const inTransitTransfers = await StockTransfer.find(transferMatch).select("items").lean();
  const inTransitMap = new Map();
  for (const t of inTransitTransfers) {
    for (const it of t.items || []) {
      const k = it.productVariantId.toString();
      inTransitMap.set(k, (inTransitMap.get(k) || 0) + (it.dispatchedQuantity || it.requestedQuantity || 0));
    }
  }

  // 5. Evaluate replenishment and stockout risks
  const recommendations = [];
  let criticalCount = 0;
  let warningCount = 0;
  let healthyCount = 0;
  let overstockCount = 0;
  let totalSuggestedReorderUnits = 0;

  for (const inv of inventories) {
    const variant = variantMap.get(inv.productVariantId.toString());
    if (!variant) continue;
    const product = productMap.get(variant.productId.toString());

    const onHand = inv.onHand || 0;
    const reserved = inv.reserved || 0;
    const nonSellable = (inv.damaged || 0) + (inv.defective || 0) + (inv.expired || 0);
    const available = Math.max(0, onHand - reserved - nonSellable);

    const totalSold = salesMap.get(variant._id.toString()) || 0;
    const avgDailyDemand = Math.round((totalSold / windowDays) * 100) / 100;
    const inTransitQty = inTransitMap.get(variant._id.toString()) || 0;

    let daysOfCover;
    if (avgDailyDemand > 0) {
      daysOfCover = Math.round(available / avgDailyDemand);
    } else {
      daysOfCover = available > 0 ? 999 : 0;
    }

    let riskLevel = "healthy";
    if (available === 0 || daysOfCover <= 7) {
      riskLevel = "critical";
      criticalCount++;
    } else if (daysOfCover <= 14) {
      riskLevel = "warning";
      warningCount++;
    } else if (daysOfCover > 60 && available >= 20) {
      riskLevel = "overstock";
      overstockCount++;
    } else {
      healthyCount++;
    }

    // Suggested reorder quantity formula
    const reorderPoint = inv.reorderPoint || inv.lowStockThreshold * 2 || 15;
    const reorderQty = inv.reorderQuantity || Math.ceil(avgDailyDemand * 30) || 20;
    const reorderTarget = reorderPoint + reorderQty;
    const effectiveStock = available + inTransitQty;
    const suggestedReorderQty = Math.max(0, reorderTarget - effectiveStock);

    if (suggestedReorderQty > 0) {
      totalSuggestedReorderUnits += suggestedReorderQty;
    }

    if (riskFilter === "all" || riskFilter === riskLevel) {
      recommendations.push({
        inventoryId: inv._id,
        productVariantId: variant._id,
        sku: variant.sku,
        productName: product?.name || variant.name || "Product",
        warehouseId: inv.warehouseId,
        availableStock: available,
        available,
        reservedStock: reserved,
        reserved,
        onHandStock: onHand,
        onHand,
        inTransitQuantity: inTransitQty,
        inTransitTransferUnits: inTransitQty,
        windowSalesDemand: totalSold,
        fulfilledDemandUnits: totalSold,
        avgDailyDemand,
        averageDailyDemand: avgDailyDemand,
        daysOfCover,
        riskLevel,
        reorderPoint,
        reorderQuantity: reorderQty,
        suggestedReorderQuantity: suggestedReorderQty,
      });
    }
  }

  // Sort critical risk items first
  recommendations.sort((a, b) => {
    const riskWeight = { critical: 4, warning: 3, overstock: 2, healthy: 1 };
    return (riskWeight[b.riskLevel] || 0) - (riskWeight[a.riskLevel] || 0);
  });

  const paginatedRecs = recommendations.slice(skip, skip + limit);

  return {
    windowDays,
    summary: {
      criticalRiskCount: criticalCount,
      warningRiskCount: warningCount,
      healthyCount,
      overstockCount,
      totalSuggestedReorderUnits,
    },
    recommendations: paginatedRecs,
    items: paginatedRecs,
    pagination: {
      total: recommendations.length,
      page,
      limit,
      totalPages: Math.ceil(recommendations.length / limit) || 1,
    },
  };
};

/**
 * ============================================================
 * 6. WAREHOUSE OPERATIONAL PERFORMANCE METRICS
 * ============================================================
 */
const getVendorWarehouseOperations = async ({ userId, query = {}, ...rest }) => {
  const q = { ...rest, ...query };
  const vendor = await resolveApprovedVendor(userId);
  const warehouseId = resolveWarehouseFilter(q.warehouseId);
  const range = resolveDateRange({
    period: q.period || "30d",
    days: q.days ? Number(q.days) : undefined,
    startDate: q.startDate,
    endDate: q.endDate,
  });

  // 1. Inbound Receiving Operations
  const recvMatch = {
    vendorId: vendor._id,
    createdAt: { $gte: range.startDate, $lte: range.endDate },
  };
  if (warehouseId) {
    recvMatch.destinationWarehouseId = warehouseId;
  }
  const receivings = await StockReceiving.find(recvMatch).select("status items confirmedAt createdAt").lean();

  let totalReceivedUnits = 0;
  let totalRejectedUnits = 0;
  let confirmedReceivingCount = 0;
  for (const rc of receivings) {
    if (rc.status === "confirmed") confirmedReceivingCount++;
    for (const it of rc.items || []) {
      totalReceivedUnits += it.receivedQuantity || 0;
      totalRejectedUnits += it.rejectedQuantity || 0;
    }
  }

  // If no formal StockReceiving docs, fallback to receiving transactions in ledger
  if (totalReceivedUnits === 0) {
    const rxMatch = {
      vendorId: vendor._id,
      type: "receive",
      createdAt: { $gte: range.startDate, $lte: range.endDate },
    };
    if (warehouseId) rxMatch.warehouseId = warehouseId;
    const rxTx = await InventoryTransaction.find(rxMatch).select("quantity").lean();
    if (rxTx.length > 0) {
      confirmedReceivingCount = rxTx.length;
      totalReceivedUnits = rxTx.reduce((sum, r) => sum + Math.abs(r.quantity || 0), 0);
    }
  }

  // 2. Inter-Warehouse Transfers Operations
  const transferMatch = {
    vendorId: vendor._id,
    createdAt: { $gte: range.startDate, $lte: range.endDate },
  };
  if (warehouseId) {
    transferMatch.$or = [{ sourceWarehouseId: warehouseId }, { destinationWarehouseId: warehouseId }];
  }
  const transfers = await StockTransfer.find(transferMatch).select("status items dispatchedAt receivedAt createdAt").lean();

  let totalTransferVolume = 0;
  let completedTransfers = 0;
  let inTransitTransfers = 0;
  let totalTransitHours = 0;
  let transitDurationCount = 0;
  let totalTransferDiscrepancies = 0;

  for (const tr of transfers) {
    if (tr.status === "received") {
      completedTransfers++;
      if (tr.dispatchedAt && tr.receivedAt) {
        const diffHrs = (new Date(tr.receivedAt) - new Date(tr.dispatchedAt)) / (1000 * 60 * 60);
        if (diffHrs >= 0) {
          totalTransitHours += diffHrs;
          transitDurationCount++;
        }
      }
    } else if (tr.status === "dispatched" || tr.status === "in_transit") {
      inTransitTransfers++;
    }

    for (const it of tr.items || []) {
      totalTransferVolume += it.requestedQuantity || 0;
      totalTransferDiscrepancies += it.discrepancyQuantity || 0;
    }
  }

  const avgTransitHours = transitDurationCount > 0
    ? Math.round((totalTransitHours / transitDurationCount) * 10) / 10
    : null;

  // 3. Inventory Adjustments & Condition Breakdown
  const adjMatch = {
    vendorId: vendor._id,
    type: { $in: ["adjustment", "condition_change"] },
    createdAt: { $gte: range.startDate, $lte: range.endDate },
  };
  if (warehouseId) {
    adjMatch.warehouseId = warehouseId;
  }
  const adjustments = await InventoryTransaction.find(adjMatch).select("type quantity notes").lean();

  let positiveAdjUnits = 0;
  let negativeAdjUnits = 0;
  let damagedMarkedUnits = 0;

  for (const a of adjustments) {
    if (a.type === "condition_change") {
      damagedMarkedUnits += Math.abs(a.quantity || 0);
    } else if (a.quantity > 0) {
      positiveAdjUnits += a.quantity;
    } else {
      negativeAdjUnits += Math.abs(a.quantity || 0);
    }
  }

  // 4. Stock Reconciliation Audits Performance
  const countMatch = {
    vendorId: vendor._id,
    createdAt: { $gte: range.startDate, $lte: range.endDate },
  };
  if (warehouseId) {
    countMatch.warehouseId = warehouseId;
  }
  const counts = await StockCount.find(countMatch).select("status skuAccuracyRate quantityAccuracyRate totalVarianceQty accuracyRate metrics").lean();

  let completedCounts = 0;
  let totalSkuAccuracy = 0;
  let totalQtyAccuracy = 0;
  let netReconAdjustments = 0;

  for (const c of counts) {
    if (["reconciled", "finalized"].includes(c.status)) {
      completedCounts++;
      const acc = c.quantityAccuracyRate ?? c.skuAccuracyRate ?? c.accuracyRate ?? c.metrics?.accuracyRate ?? 100;
      totalSkuAccuracy += c.skuAccuracyRate ?? acc;
      totalQtyAccuracy += acc;
      netReconAdjustments += c.totalVarianceQty || c.metrics?.netDiscrepancyUnits || 0;
    }
  }

  const avgSkuAccuracy = completedCounts > 0 ? Math.round((totalSkuAccuracy / completedCounts) * 100) / 100 : 100;
  const avgQtyAccuracy = completedCounts > 0 ? Math.round((totalQtyAccuracy / completedCounts) * 100) / 100 : 100;

  const reconMetrics = {
    totalCountSessions: counts.length,
    completedCountSessions: completedCounts,
    reconciledSessionsCount: completedCounts,
    averageSkuAccuracyRate: avgSkuAccuracy,
    averageQuantityAccuracyRate: avgQtyAccuracy,
    averageAuditAccuracyRate: avgQtyAccuracy,
    netReconciliationVarianceUnits: netReconAdjustments,
  };

  return {
    period: range.period,
    receiving: {
      totalReceivingRecords: receivings.length || confirmedReceivingCount,
      confirmedReceivingCount,
      totalReceivedUnits,
      totalRejectedUnits,
      rejectionRate: (totalReceivedUnits + totalRejectedUnits) > 0
        ? Math.round((totalRejectedUnits / (totalReceivedUnits + totalRejectedUnits)) * 10000) / 100
        : 0,
      fulfillmentRatePercent: (totalReceivedUnits + totalRejectedUnits) > 0
        ? Math.round((totalReceivedUnits / (totalReceivedUnits + totalRejectedUnits)) * 10000) / 100
        : 100,
    },
    transfers: {
      totalTransfers: transfers.length,
      completedTransfers,
      inTransitTransfers,
      totalTransferVolume,
      averageTransitHours: avgTransitHours,
      totalDiscrepancyUnits: totalTransferDiscrepancies,
    },
    adjustments: {
      totalAdjustmentEvents: adjustments.length,
      positiveAdjustmentUnits: positiveAdjUnits,
      negativeAdjustmentUnits: negativeAdjUnits,
      damagedMarkedUnits,
      totalDamagedUnits: damagedMarkedUnits,
      conditionChangeEvents: adjustments.filter((a) => a.type === "condition_change").length,
    },
    reconciliation: reconMetrics,
    auditPerformance: reconMetrics,
  };
};

/**
 * ============================================================
 * 7. AUDIT EXPORT ENGINE (CSV / XLSX)
 * ============================================================
 */
const exportVendorWarehouseAnalytics = async ({ userId, query = {}, ...rest }) => {
  const q = { ...rest, ...query };
  const vendor = await resolveApprovedVendor(userId);
  const format = String(q.format || "csv").toLowerCase();
  const reportType = (q.type || "overview").toLowerCase();
  const isXlsx = format === "xlsx" || format === "excel";

  const [overview, movements, aging, replenishment] = await Promise.all([
    getVendorWarehouseOverview({ userId, query: q }),
    getVendorMovementAnalytics({ userId, query: q }),
    getVendorInventoryAging({ userId, query: { ...q, limit: 1000 } }),
    getVendorDemandAndReplenishment({ userId, query: { ...q, limit: 1000 } }),
  ]);

  const wb = xlsx.utils.book_new();

  // Sheet 1: Overview & Movements
  const overviewRows = [
    ["WAREHOUSE & INVENTORY INTELLIGENCE AUDIT REPORT"],
    ["Generated At", new Date().toISOString()],
    ["Vendor Business", vendor.businessName || "Vendor"],
    [],
    ["METRIC", "VALUE"],
    ["Total Managed SKUs", overview.totalSkus],
    ["Total On-Hand Units", overview.totalOnHandUnits],
    ["Available Sellable Units", overview.availableUnits],
    ["Reserved Order Units", overview.reservedUnits],
    ["Non-Sellable Stock Units", overview.nonSellableUnits],
    ["Low Stock Trigger SKUs", overview.lowStockSkus],
    ["Out of Stock SKUs", overview.outOfStockSkus],
    ["Active Warehouses", overview.totalActiveWarehouses],
    ["Total Retail Valuation", `INR ${overview.totalInventoryRetailValue}`],
    [],
    ["MOVEMENT SUMMARY", "UNITS"],
    ["Inbound Receipts", movements.summary.receivedUnits],
    ["Outbound Sales Fulfilled", movements.summary.fulfilledSalesUnits],
    ["Customer Returns Restocked", movements.summary.customerReturnUnits],
    ["Net Stock Adjustments", movements.summary.netAdjustmentUnits],
    ["Internal Transfers", movements.summary.transferVolumeUnits],
  ];
  const wsOverview = xlsx.utils.aoa_to_sheet(overviewRows.map((r) => r.map(sanitizeCellValue)));

  // Sheet 2: Inventory Aging
  const agingHeaders = [
    "SKU",
    "Product Name",
    "On-Hand Units",
    "0-30 Days",
    "31-60 Days",
    "61-90 Days",
    "91-180 Days",
    "181+ Days",
    "Days Since Receipt",
    "Sales Last 60 Days",
    "Status Flag",
  ];
  const agingRows = [agingHeaders];
  for (const it of aging.items || []) {
    let flag = "Normal";
    if (it.isSlowMoving) flag = "Slow Moving";
    else if (it.isZeroSales) flag = "Zero Sales";

    agingRows.push([
      it.sku,
      it.productName,
      it.onHand,
      it.bucket0_30,
      it.bucket31_60,
      it.bucket61_90,
      it.bucket91_180,
      it.bucket181Plus,
      it.daysSinceLatestReceipt,
      it.soldLast60Days,
      flag,
    ]);
  }
  const wsAging = xlsx.utils.aoa_to_sheet(agingRows.map((r) => r.map(sanitizeCellValue)));

  // Sheet 3: Replenishment Recommendations
  const replHeaders = [
    "SKU",
    "Product Name",
    "Available Stock",
    "Reserved Stock",
    "In-Transit Stock",
    "Avg Daily Demand",
    "Days of Cover",
    "Stockout Risk",
    "Reorder Point",
    "Suggested Reorder Units",
  ];
  const replRows = [replHeaders];
  for (const r of replenishment.recommendations || replenishment.items || []) {
    replRows.push([
      r.sku,
      r.productName,
      r.availableStock,
      r.reservedStock,
      r.inTransitQuantity,
      r.avgDailyDemand,
      r.daysOfCover,
      r.riskLevel,
      r.reorderPoint,
      r.suggestedReorderQuantity,
    ]);
  }
  const wsRepl = xlsx.utils.aoa_to_sheet(replRows.map((r) => r.map(sanitizeCellValue)));

  // Arrange sheets so the primary requested report is sheet 0 (especially for CSV single-sheet output)
  if (reportType === "aging") {
    xlsx.utils.book_append_sheet(wb, wsAging, "Inventory Aging");
    xlsx.utils.book_append_sheet(wb, wsOverview, "Warehouse Overview");
    xlsx.utils.book_append_sheet(wb, wsRepl, "Replenishment Intelligence");
  } else if (reportType === "replenishment") {
    xlsx.utils.book_append_sheet(wb, wsRepl, "Replenishment Intelligence");
    xlsx.utils.book_append_sheet(wb, wsOverview, "Warehouse Overview");
    xlsx.utils.book_append_sheet(wb, wsAging, "Inventory Aging");
  } else {
    xlsx.utils.book_append_sheet(wb, wsOverview, "Warehouse Overview");
    xlsx.utils.book_append_sheet(wb, wsAging, "Inventory Aging");
    xlsx.utils.book_append_sheet(wb, wsRepl, "Replenishment Intelligence");
  }

  const ext = isXlsx ? "xlsx" : "csv";
  const filename = `warehouse_${reportType}_${vendor.businessSlug || "vendor"}_${new Date().toISOString().slice(0, 10)}.${ext}`;

  if (isXlsx) {
    const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
    return {
      buffer,
      filename,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  const buffer = xlsx.write(wb, { type: "buffer", bookType: "csv" });
  const data = buffer.toString("utf8");
  return {
    buffer,
    data,
    filename,
    contentType: "text/csv; charset=utf-8",
  };
};

module.exports = {
  getVendorWarehouseOverview,
  getVendorMovementAnalytics,
  getVendorInventoryAging,
  getVendorInventoryTurnover,
  getVendorDemandAndReplenishment,
  getVendorWarehouseOperations,
  exportVendorWarehouseAnalytics,
};
