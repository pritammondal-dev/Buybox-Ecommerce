const mongoose = require("mongoose");
const xlsx = require("xlsx");
const Order = require("../models/Order");
const Shipment = require("../models/Shipment");
const Warehouse = require("../models/Warehouse");
const WarehouseLocation = require("../models/WarehouseLocation");
const Vendor = require("../models/Vendor");
const AppError = require("../errors/AppError");
const { decodeSecureId, encodeSecureId } = require("../utils/secure-id.util");
const { PERMISSIONS } = require("../constants/permissions.constants");

/**
 * Sanitize cell values against spreadsheet formula injection (CSV/Excel Formula Injection).
 * Any string beginning with '=', '+', '-', '@', '\t', or '\r' is prefixed with a single quote.
 */
const sanitizeCellValue = (val) => {
  if (val === null || val === undefined) return "";
  if (typeof val === "number" || typeof val === "boolean") return val;
  if (val instanceof Date) return val.toISOString();
  const rawStr = String(val);
  if (/^[=+\-@\t\r]/.test(rawStr)) {
    return `'${rawStr}`;
  }
  const str = rawStr.trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
};

/**
 * Helper to build CSV or XLSX buffer from headers and row arrays using xlsx library.
 */
const buildSpreadsheet = ({ sheetName = "Sheet1", headers, rows, format = "csv", baseFilename = "export" }) => {
  const isXlsx = String(format).toLowerCase() === "xlsx";
  const sanitizedRows = rows.map((row) => row.map(sanitizeCellValue));
  const data = [headers.map(sanitizeCellValue), ...sanitizedRows];

  const ws = xlsx.utils.aoa_to_sheet(data);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));

  const timestamp = new Date().toISOString().slice(0, 10);
  const ext = isXlsx ? "xlsx" : "csv";
  const filename = `${baseFilename}_${timestamp}.${ext}`;

  if (isXlsx) {
    const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
    return {
      buffer,
      filename,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      count: rows.length,
    };
  }

  const buffer = xlsx.write(wb, { type: "buffer", bookType: "csv" });
  return {
    buffer,
    filename,
    contentType: "text/csv; charset=utf-8",
    count: rows.length,
  };
};

/**
 * Helper to resolve vendor ID from authenticated user.
 */
const resolveVendorId = async (user) => {
  if (!user) return null;
  if (user.vendorId && mongoose.isValidObjectId(user.vendorId)) {
    return user.vendorId.toString();
  }
  if (typeof Vendor.findOne !== "function") return null;
  const query = Vendor.findOne({ userId: user.id || user._id });
  const vendor = query && typeof query.lean === "function" ? await query.lean() : await query;
  return vendor ? vendor._id.toString() : null;
};

const safeIsoDate = (d) => {
  if (!d) return new Date().toISOString();
  try {
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  } catch {
    return new Date().toISOString();
  }
};

/**
 * Helper to check if user has admin/staff platform order/shipment/warehouse read rights.
 */
const hasStaffReadAccess = (user) => {
  if (!user) return false;
  const role = user.role;
  const roles = user.roles || [];
  if (
    role === "admin" ||
    role === "superadmin" ||
    role === "super_admin" ||
    roles.includes("admin") ||
    roles.includes("superadmin") ||
    roles.includes("super_admin")
  ) {
    return true;
  }
  const perms = user.permissions || [];
  return (
    perms.includes(PERMISSIONS.ORDERS_READ) ||
    perms.includes(PERMISSIONS.SHIPMENTS_READ) ||
    perms.includes(PERMISSIONS.WAREHOUSES_READ) ||
    perms.includes("orders.view") ||
    perms.includes("warehouses.view") ||
    perms.includes("shipping.view")
  );
};

/**
 * Phase 5B.1: Generate Printable Warehouse Packing Slip
 *
 * Supports generating packing slip from:
 * 1. Specific shipment (split or full)
 * 2. Order ID (with optional warehouseId filter)
 *
 * Strictly enforces authoritative snapshots, vendor tenancy, and hides all payment/cost data.
 */
const getPackingSlip = async ({ orderId, shipmentId, warehouseId, user }) => {
  let targetShipment = null;
  let targetOrder = null;

  const isStaff = hasStaffReadAccess(user);
  let authenticatedVendorId = null;

  if (!isStaff) {
    authenticatedVendorId = await resolveVendorId(user);
    if (!authenticatedVendorId) {
      throw new AppError("Access denied: unauthorized packing slip request", 403, "ACCESS_DENIED");
    }
  }

  // 1. If shipmentId provided, retrieve the specific shipment
  if (shipmentId) {
    const resolvedShipmentId = decodeSecureId(shipmentId, "shipment", { strict: false });
    if (!mongoose.isValidObjectId(resolvedShipmentId)) {
      throw new AppError("Invalid shipment ID", 400, "INVALID_SHIPMENT_ID");
    }

    targetShipment = await Shipment.findById(resolvedShipmentId)
      .populate("warehouseId", "name code address contactPhone contactEmail")
      .populate("vendorId", "storeName businessName")
      .lean();

    if (!targetShipment) {
      throw new AppError("Shipment not found", 404, "SHIPMENT_NOT_FOUND");
    }

    // Tenant check
    if (authenticatedVendorId && targetShipment.vendorId?._id?.toString() !== authenticatedVendorId && targetShipment.vendorId?.toString() !== authenticatedVendorId) {
      throw new AppError("Shipment not found or access denied", 404, "SHIPMENT_NOT_FOUND");
    }

    targetOrder = await Order.findById(targetShipment.orderId).lean();
    if (!targetOrder) {
      throw new AppError("Associated order not found", 404, "ORDER_NOT_FOUND");
    }
  } else if (orderId) {
    const resolvedOrderId = decodeSecureId(orderId, "order", { strict: false });
    if (!mongoose.isValidObjectId(resolvedOrderId)) {
      throw new AppError("Invalid order ID", 400, "INVALID_ORDER_ID");
    }

    targetOrder = await Order.findById(resolvedOrderId)
      .populate("items.warehouseId", "name code address contactPhone contactEmail")
      .populate("items.vendorId", "storeName businessName")
      .lean();

    if (!targetOrder) {
      throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
    }

    // If warehouseId filter provided, resolve it
    if (warehouseId) {
      const resolvedWhId = decodeSecureId(warehouseId, "warehouse", { strict: false });
      if (mongoose.isValidObjectId(resolvedWhId)) {
        warehouseId = resolvedWhId.toString();
      }
    }
  } else {
    throw new AppError("Either orderId or shipmentId must be provided", 400, "MISSING_PARAMETERS");
  }

  // Build packing slip response
  const orderNumber = targetOrder.orderNumber;
  const orderDate = targetOrder.placedAt || targetOrder.createdAt;
  const shippingAddress = targetShipment?.shippingAddress || targetOrder.shippingAddress || {};

  const cleanRecipient = {
    fullName: shippingAddress.fullName || "",
    phone: shippingAddress.phone || "",
    addressLine1: shippingAddress.addressLine1 || "",
    addressLine2: shippingAddress.addressLine2 || "",
    city: shippingAddress.city || "",
    state: shippingAddress.state || "",
    postalCode: shippingAddress.postalCode || "",
    country: shippingAddress.country || "IN",
  };

  let items = [];
  let warehouseInfo = null;
  let shipmentRef = null;
  let carrier = null;
  let trackingNumber = null;
  let isSplitShipment = false;

  if (targetShipment) {
    // Shipment-specific items (for split shipments, contains only this shipment's items)
    shipmentRef = targetShipment.shipmentNumber;
    carrier = targetShipment.carrier || null;
    trackingNumber = targetShipment.trackingNumber || null;

    // Check if this is a split shipment of the order
    const totalOrderQuantity = (targetOrder.items || []).reduce((acc, it) => acc + (it.quantity || 0), 0);
    const shipmentQuantity = (targetShipment.items || []).reduce((acc, it) => acc + (it.quantity || 0), 0);
    isSplitShipment = shipmentQuantity < totalOrderQuantity;

    // Extract warehouse
    const wh = targetShipment.warehouseId;
    if (wh) {
      warehouseInfo = {
        id: wh._id ? wh._id.toString() : wh.toString(),
        name: wh.name || "Default Warehouse",
        code: wh.code || "",
        address: wh.address || {},
        phone: wh.contactPhone || "",
        email: wh.contactEmail || "",
      };
    }

    // Match shipment items with order items to fetch snapshot variant names and descriptions safely
    items = (targetShipment.items || []).map((sItem) => {
      const matchingOrderItem = (targetOrder.items || []).find(
        (oItem) =>
          oItem.productVariantId?.toString() === sItem.productVariantId?.toString() ||
          oItem.sku === sItem.sku
      );

      return {
        productId: sItem.productId,
        productVariantId: sItem.productVariantId,
        sku: sItem.sku,
        productName: sItem.name || matchingOrderItem?.productName || "Product",
        variantName: matchingOrderItem?.variantName || "",
        quantity: sItem.quantity,
        merchantName:
          targetShipment.vendorId?.storeName ||
          targetShipment.vendorId?.businessName ||
          matchingOrderItem?.vendorId?.storeName ||
          matchingOrderItem?.vendorId?.businessName ||
          "Buybox Merchant",
        warehouseName: warehouseInfo?.name || "Main Warehouse",
      };
    });
  } else {
    // Order-level packing slip (grouped by warehouse or specific warehouse)
    let candidateItems = targetOrder.items || [];

    // Vendor tenant isolation: filter candidate items strictly to this vendor
    if (authenticatedVendorId) {
      candidateItems = candidateItems.filter(
        (it) => it.vendorId?._id?.toString() === authenticatedVendorId || it.vendorId?.toString() === authenticatedVendorId
      );
      if (candidateItems.length === 0) {
        throw new AppError("Order not found or no items authorized for this vendor", 404, "ORDER_NOT_FOUND");
      }
    }

    // Warehouse filter
    if (warehouseId) {
      candidateItems = candidateItems.filter(
        (it) => it.warehouseId?._id?.toString() === warehouseId || it.warehouseId?.toString() === warehouseId
      );
    }

    // Primary warehouse from first candidate item or order-level warehouse
    const firstWh = candidateItems[0]?.warehouseId || targetOrder.warehouseId;
    if (firstWh) {
      if (typeof firstWh === "object" && firstWh.name) {
        warehouseInfo = {
          id: firstWh._id?.toString(),
          name: firstWh.name,
          code: firstWh.code,
          address: firstWh.address || {},
          phone: firstWh.contactPhone || "",
          email: firstWh.contactEmail || "",
        };
      } else {
        // Warehouse ID only, load warehouse document
        const whDoc = await Warehouse.findById(firstWh).lean();
        if (whDoc) {
          warehouseInfo = {
            id: whDoc._id.toString(),
            name: whDoc.name,
            code: whDoc.code,
            address: whDoc.address || {},
            phone: whDoc.contactPhone || "",
            email: whDoc.contactEmail || "",
          };
        }
      }
    }

    items = candidateItems.map((oItem) => ({
      productId: oItem.productId,
      productVariantId: oItem.productVariantId,
      sku: oItem.sku,
      productName: oItem.productName,
      variantName: oItem.variantName || "",
      quantity: oItem.quantity,
      merchantName:
        oItem.vendorId?.storeName ||
        oItem.vendorId?.businessName ||
        (typeof oItem.vendorId === "string" ? "Merchant" : "Buybox Merchant"),
      warehouseName:
        oItem.warehouseId?.name ||
        warehouseInfo?.name ||
        "Main Warehouse",
    }));
  }

  const totalQuantity = items.reduce((sum, it) => sum + (it.quantity || 0), 0);

  return {
    packingSlipNumber: `PS-${orderNumber}${shipmentRef ? `-${shipmentRef}` : ""}`,
    orderNumber,
    orderDate,
    shipmentReference: shipmentRef,
    carrier,
    trackingNumber,
    isSplitShipment,
    deliveryOption: targetOrder.deliveryOption?.name || "Standard Delivery",
    estimatedDays: targetOrder.deliveryOption?.estimatedDays || null,
    warehouse: warehouseInfo || {
      name: "Main Dispatch Center",
      code: "MAIN",
      address: { addressLine1: "Central Fulfillment Dock", city: "National Hub", country: "IN" },
    },
    recipient: cleanRecipient,
    items,
    totalQuantity,
    fulfillmentNotes: isSplitShipment
      ? `Package contains partial shipment of Order ${orderNumber}. Remaining items dispatched separately.`
      : "Standard package fulfillment. Inspect package contents upon receipt.",
    generatedAt: new Date(),
  };
};

/**
 * Phase 5B.2: Warehouse Pick Lists
 *
 * Pure read-only aggregation:
 * - Groups unfulfilled/ready-to-fulfill order items by warehouse and then by SKU / variant.
 * - Resolves bin & shelf locations from WarehouseLocation.
 * - Retains full traceability back to contributing orders.
 * - Strictly never mutates inventory, reserves stock, or changes order states.
 */
const generatePickList = async ({ warehouseId = null, dateFrom = null, dateTo = null, orderStatus = null, orderIds = null, user = null }) => {
  const isStaff = hasStaffReadAccess(user);
  let authenticatedVendorId = null;

  if (!isStaff) {
    authenticatedVendorId = await resolveVendorId(user);
    if (!authenticatedVendorId) {
      throw new AppError("Access denied: unauthorized pick list request", 403, "ACCESS_DENIED");
    }
  }

  // 1. Build Order Filter
  const orderFilter = {
    paymentStatus: "paid", // Only paid orders are eligible for pick lists
    status: { $in: ["confirmed", "processing"] }, // Must be in active fulfillable state
  };

  if (orderStatus && ["confirmed", "processing"].includes(orderStatus)) {
    orderFilter.status = orderStatus;
  }

  if (dateFrom || dateTo) {
    orderFilter.createdAt = {};
    if (dateFrom) orderFilter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) orderFilter.createdAt.$lte = new Date(dateTo);
  }

  if (orderIds && Array.isArray(orderIds) && orderIds.length > 0) {
    const resolvedIds = orderIds
      .map((id) => decodeSecureId(id, "order", { strict: false }))
      .filter((id) => mongoose.isValidObjectId(id));
    if (resolvedIds.length > 0) {
      orderFilter._id = { $in: resolvedIds };
    }
  }

  let resolvedWarehouseId = null;
  if (warehouseId) {
    const rawWhId = decodeSecureId(warehouseId, "warehouse", { strict: false });
    if (mongoose.isValidObjectId(rawWhId)) {
      resolvedWarehouseId = rawWhId.toString();
      orderFilter["items.warehouseId"] = new mongoose.Types.ObjectId(resolvedWarehouseId);
    }
  }

  // 2. Fetch Eligible Orders
  const orders = await Order.find(orderFilter)
    .populate("items.warehouseId", "name code address")
    .lean();

  // 3. Aggregate items grouped by Warehouse -> ProductVariant/SKU
  // Structure: Map<warehouseIdStr, { warehouse, itemsMap: Map<sku, PickItem> }>
  const warehousePickMap = new Map();
  const allVariantIds = new Set();
  const allWarehouseIds = new Set();

  for (const order of orders) {
    for (const item of order.items || []) {
      // Exclude virtual/downloadable items
      if (item.isVirtual === true || item.isDownloadable === true) continue;

      // Exclude shipped, delivered, or cancelled items
      if (!["unfulfilled", "processing", "ready_to_ship"].includes(item.fulfillmentStatus)) {
        continue;
      }

      // Exclude if inventory was released
      if (item.inventoryStatus === "released") continue;

      // Vendor tenant isolation check
      if (authenticatedVendorId) {
        const itemVendorId = item.vendorId?._id?.toString() || item.vendorId?.toString();
        if (itemVendorId !== authenticatedVendorId) {
          continue;
        }
      }

      // Warehouse filter check
      const itemWhId = item.warehouseId?._id?.toString() || item.warehouseId?.toString();
      if (!itemWhId) continue;
      if (resolvedWarehouseId && itemWhId !== resolvedWarehouseId) continue;

      const whKey = itemWhId;
      allWarehouseIds.add(whKey);
      if (item.productVariantId) {
        allVariantIds.add(item.productVariantId.toString());
      }

      if (!warehousePickMap.has(whKey)) {
        warehousePickMap.set(whKey, {
          warehouse: item.warehouseId || { _id: whKey, name: "Warehouse", code: "WH" },
          itemsMap: new Map(),
        });
      }

      const whEntry = warehousePickMap.get(whKey);
      const skuKey = String(item.sku || item.productVariantId || "").toUpperCase();

      if (!whEntry.itemsMap.has(skuKey)) {
        whEntry.itemsMap.set(skuKey, {
          productVariantId: item.productVariantId,
          productId: item.productId,
          sku: item.sku,
          productName: item.productName,
          variantName: item.variantName || "",
          requiredQuantity: 0,
          contributingOrders: [],
        });
      }

      const skuEntry = whEntry.itemsMap.get(skuKey);
      skuEntry.requiredQuantity += item.quantity || 0;
      skuEntry.contributingOrders.push({
        orderId: order._id,
        secureOrderId: encodeSecureId("order", order._id),
        orderNumber: order.orderNumber,
        orderDate: order.placedAt || order.createdAt,
        orderItemId: item._id,
        quantity: item.quantity,
        fulfillmentStatus: item.fulfillmentStatus,
        recipientName: order.shippingAddress?.fullName || "Customer",
        recipientCity: order.shippingAddress?.city || "",
      });
    }
  }

  // 4. Batch query bin and shelf locations for all variant-warehouse combinations
  const locationLookup = new Map(); // Key: `${warehouseId}_${variantId}` -> Location Array
  if (allWarehouseIds.size > 0 && allVariantIds.size > 0) {
    const locations = await WarehouseLocation.find({
      warehouseId: { $in: Array.from(allWarehouseIds).map((id) => new mongoose.Types.ObjectId(id)) },
      "items.productVariantId": { $in: Array.from(allVariantIds).map((id) => new mongoose.Types.ObjectId(id)) },
      isActive: true,
    }).lean();

    for (const loc of locations) {
      const whIdStr = loc.warehouseId.toString();
      for (const bItem of loc.items || []) {
        const vIdStr = bItem.productVariantId.toString();
        const lookupKey = `${whIdStr}_${vIdStr}`;
        if (!locationLookup.has(lookupKey)) {
          locationLookup.set(lookupKey, []);
        }
        locationLookup.get(lookupKey).push({
          locationId: loc._id,
          code: loc.code,
          zone: loc.zone || "General",
          aisle: loc.aisle || null,
          rack: loc.rack || null,
          shelf: loc.shelf || null,
          bin: loc.bin || null,
          type: loc.type,
          binQuantity: bItem.quantity || 0,
          displayLocation: [
            loc.zone ? `Zone: ${loc.zone}` : null,
            loc.aisle ? `Aisle: ${loc.aisle}` : null,
            loc.rack ? `Rack: ${loc.rack}` : null,
            loc.shelf ? `Shelf: ${loc.shelf}` : null,
            loc.bin ? `Bin: ${loc.bin}` : null,
          ]
            .filter(Boolean)
            .join(" / ") || loc.code,
        });
      }
    }
  }

  // 5. Build Final Grouped Pick Lists
  const pickLists = [];
  let totalUnitsToPick = 0;
  let totalUniqueSkus = 0;

  for (const [whId, { warehouse, itemsMap }] of warehousePickMap.entries()) {
    const items = [];
    for (const [sku, itemData] of itemsMap.entries()) {
      const vId = itemData.productVariantId ? itemData.productVariantId.toString() : "";
      const locKey = `${whId}_${vId}`;
      const bins = locationLookup.get(locKey) || [];

      items.push({
        ...itemData,
        locations: bins,
        primaryLocation: bins.length > 0 ? bins[0].displayLocation : "Unassigned / General Storage",
        primaryLocationCode: bins.length > 0 ? bins[0].code : "UNASSIGNED",
      });

      totalUnitsToPick += itemData.requiredQuantity;
      totalUniqueSkus += 1;
    }

    // Sort items by primaryLocationCode, then SKU for warehouse picking route optimization
    items.sort((a, b) => a.primaryLocationCode.localeCompare(b.primaryLocationCode) || a.sku.localeCompare(b.sku));

    pickLists.push({
      warehouse: {
        id: warehouse._id ? warehouse._id.toString() : whId,
        name: warehouse.name || "Warehouse",
        code: warehouse.code || "WH",
        address: warehouse.address || {},
      },
      itemCount: items.length,
      totalUnits: items.reduce((sum, it) => sum + it.requiredQuantity, 0),
      items,
    });
  }

  return {
    generatedAt: new Date(),
    totalWarehouses: pickLists.length,
    totalUniqueSkus,
    totalUnitsToPick,
    pickLists,
  };
};

/**
 * Phase 5B.3: Export Pick Lists to CSV or XLSX
 */
const exportPickList = async ({ warehouseId = null, format = "csv", user = null }) => {
  const result = await generatePickList({ warehouseId, user });
  const headers = [
    "Warehouse Code",
    "Warehouse Name",
    "SKU",
    "Product Name",
    "Variant Name",
    "Required Quantity",
    "Primary Location Code",
    "Location Details",
    "Contributing Orders Count",
    "Contributing Order Numbers",
  ];

  const rows = [];
  for (const pl of result.pickLists) {
    for (const item of pl.items) {
      rows.push([
        pl.warehouse.code,
        pl.warehouse.name,
        item.sku,
        item.productName,
        item.variantName,
        item.requiredQuantity,
        item.primaryLocationCode,
        item.primaryLocation,
        item.contributingOrders.length,
        item.contributingOrders.map((o) => o.orderNumber).join(", "),
      ]);
    }
  }

  return buildSpreadsheet({
    sheetName: "Pick List",
    headers,
    rows,
    format,
    baseFilename: "buybox_warehouse_pick_list",
  });
};

/**
 * Phase 5B.3: Export Orders to CSV or XLSX
 *
 * Supports role-based scoping and vendor tenant isolation.
 * Protects against formula injection.
 */
const exportOrders = async ({ query = {}, user = null, format = "csv" }) => {
  const isStaff = hasStaffReadAccess(user);
  let authenticatedVendorId = null;

  if (!isStaff) {
    authenticatedVendorId = await resolveVendorId(user);
    if (!authenticatedVendorId) {
      throw new AppError("Access denied: unauthorized orders export", 403, "ACCESS_DENIED");
    }
  }

  const filter = {};
  if (query.status && query.status !== "all") {
    filter.status = query.status;
  }
  if (query.paymentStatus && query.paymentStatus !== "all") {
    filter.paymentStatus = query.paymentStatus;
  }
  if (query.fulfillmentStatus && query.fulfillmentStatus !== "all") {
    filter.fulfillmentStatus = query.fulfillmentStatus;
  }
  if (query.search) {
    filter.$or = [
      { orderNumber: { $regex: query.search.trim(), $options: "i" } },
      { "shippingAddress.fullName": { $regex: query.search.trim(), $options: "i" } },
      { "shippingAddress.phone": { $regex: query.search.trim(), $options: "i" } },
    ];
  }

  if (authenticatedVendorId) {
    filter["items.vendorId"] = new mongoose.Types.ObjectId(authenticatedVendorId);
  }

  const orders = await Order.find(filter)
    .populate("customerId", "firstName lastName email phone")
    .sort({ createdAt: -1 })
    .lean();

  const headers = [
    "Order Number",
    "Order Date",
    "Order Status",
    "Payment Status",
    "Fulfillment Status",
    "Currency",
    "Subtotal",
    "Discount Total",
    "Tax Total",
    "Shipping Total",
    "Grand Total",
    "Item Count",
    "Recipient Name",
    "Recipient Phone",
    "Address Line 1",
    "Address Line 2",
    "City",
    "State",
    "Postal Code",
    "Country",
    "Delivery Method",
  ];

  const rows = orders.map((order) => {
    let relevantItems = order.items || [];
    if (authenticatedVendorId) {
      relevantItems = relevantItems.filter(
        (it) => it.vendorId?.toString() === authenticatedVendorId
      );
    }

    const itemCount = relevantItems.reduce((sum, it) => sum + (it.quantity || 0), 0);
    const addr = order.shippingAddress || {};

    let subtotal = order.subtotal?.toString?.() ?? String(order.subtotal ?? "0");
    let grandTotal = order.grandTotal?.toString?.() ?? String(order.grandTotal ?? "0");

    // For vendor-scoped export, calculate vendor-specific item subtotal to avoid leaking platform totals
    if (authenticatedVendorId) {
      const vendorSubtotal = relevantItems.reduce((sum, it) => {
        const line = parseFloat(it.lineTotal?.toString?.() || 0);
        return sum + line;
      }, 0);
      subtotal = vendorSubtotal.toFixed(2);
      grandTotal = vendorSubtotal.toFixed(2);
    }

    return [
      order.orderNumber,
      safeIsoDate(order.placedAt || order.createdAt),
      order.status,
      order.paymentStatus,
      order.fulfillmentStatus,
      order.currency || "INR",
      subtotal,
      authenticatedVendorId ? "0.00" : (order.discountTotal?.toString?.() ?? "0.00"),
      authenticatedVendorId ? "0.00" : (order.taxTotal?.toString?.() ?? "0.00"),
      authenticatedVendorId ? "0.00" : (order.shippingTotal?.toString?.() ?? "0.00"),
      grandTotal,
      itemCount,
      addr.fullName || "",
      addr.phone || "",
      addr.addressLine1 || "",
      addr.addressLine2 || "",
      addr.city || "",
      addr.state || "",
      addr.postalCode || "",
      addr.country || "IN",
      order.deliveryOption?.name || "Standard",
    ];
  });

  return buildSpreadsheet({
    sheetName: "Orders",
    headers,
    rows,
    format,
    baseFilename: authenticatedVendorId ? "buybox_vendor_orders_export" : "buybox_platform_orders_export",
  });
};

/**
 * Phase 5B.3: Export Order Items to CSV or XLSX
 */
const exportOrderItems = async ({ query = {}, user = null, format = "csv" }) => {
  const isStaff = hasStaffReadAccess(user);
  let authenticatedVendorId = null;

  if (!isStaff) {
    authenticatedVendorId = await resolveVendorId(user);
    if (!authenticatedVendorId) {
      throw new AppError("Access denied: unauthorized items export", 403, "ACCESS_DENIED");
    }
  }

  const filter = {};
  if (query.status && query.status !== "all") {
    filter.status = query.status;
  }
  if (query.paymentStatus && query.paymentStatus !== "all") {
    filter.paymentStatus = query.paymentStatus;
  }
  if (authenticatedVendorId) {
    filter["items.vendorId"] = new mongoose.Types.ObjectId(authenticatedVendorId);
  }

  const orders = await Order.find(filter)
    .populate("items.warehouseId", "name code")
    .populate("items.vendorId", "storeName businessName")
    .populate("items.shipmentId", "shipmentNumber carrier trackingNumber status")
    .sort({ createdAt: -1 })
    .lean();

  const headers = [
    "Order Number",
    "Order Date",
    "Order Status",
    "Payment Status",
    "Item Fulfillment Status",
    "SKU",
    "Product Name",
    "Variant Name",
    "Quantity",
    "Unit Price",
    "Tax Total",
    "Line Total",
    "Currency",
    "Warehouse Code",
    "Warehouse Name",
    "Vendor Store",
    "Shipment Number",
    "Carrier",
    "Tracking Number",
  ];

  const rows = [];
  for (const order of orders) {
    for (const item of order.items || []) {
      const itemVendorId = item.vendorId?._id?.toString() || item.vendorId?.toString();
      if (authenticatedVendorId && itemVendorId !== authenticatedVendorId) {
        continue;
      }

      const wh = item.warehouseId;
      const ven = item.vendorId;
      const shp = item.shipmentId;

      rows.push([
        order.orderNumber,
        safeIsoDate(order.placedAt || order.createdAt),
        order.status,
        order.paymentStatus,
        item.fulfillmentStatus,
        item.sku,
        item.productName,
        item.variantName || "",
        item.quantity,
        item.unitPrice?.toString?.() ?? String(item.unitPrice ?? "0"),
        item.taxTotal?.toString?.() ?? String(item.taxTotal ?? "0"),
        item.lineTotal?.toString?.() ?? String(item.lineTotal ?? "0"),
        item.currency || order.currency || "INR",
        wh?.code || "",
        wh?.name || "",
        ven?.storeName || ven?.businessName || "",
        shp?.shipmentNumber || "",
        shp?.carrier || "",
        shp?.trackingNumber || "",
      ]);
    }
  }

  return buildSpreadsheet({
    sheetName: "Order Items",
    headers,
    rows,
    format,
    baseFilename: authenticatedVendorId ? "buybox_vendor_order_items_export" : "buybox_order_items_export",
  });
};

/**
 * Phase 5B.3: Export Shipments to CSV or XLSX
 */
const exportShipments = async ({ query = {}, user = null, format = "csv" }) => {
  const isStaff = hasStaffReadAccess(user);
  let authenticatedVendorId = null;

  if (!isStaff) {
    authenticatedVendorId = await resolveVendorId(user);
    if (!authenticatedVendorId) {
      throw new AppError("Access denied: unauthorized shipments export", 403, "ACCESS_DENIED");
    }
  }

  const filter = {};
  if (query.status && query.status !== "all") {
    filter.status = query.status;
  }
  if (authenticatedVendorId) {
    filter.vendorId = new mongoose.Types.ObjectId(authenticatedVendorId);
  }

  const shipments = await Shipment.find(filter)
    .populate("orderId", "orderNumber status paymentStatus")
    .populate("warehouseId", "name code")
    .populate("vendorId", "storeName businessName")
    .sort({ createdAt: -1 })
    .lean();

  const headers = [
    "Shipment Number",
    "Order Number",
    "Created Date",
    "Shipped Date",
    "Status",
    "Carrier",
    "Service Level",
    "Tracking Number",
    "Warehouse Code",
    "Warehouse Name",
    "Vendor Store",
    "Recipient Name",
    "Recipient Phone",
    "Recipient City",
    "Recipient State",
    "Total Items Count",
    "SKU Summary",
  ];

  const rows = shipments.map((shp) => {
    const addr = shp.shippingAddress || {};
    const items = shp.items || [];
    const totalQty = items.reduce((sum, it) => sum + (it.quantity || 0), 0);
    const skuSummary = items.map((it) => `${it.sku} (x${it.quantity})`).join("; ");

    return [
      shp.shipmentNumber,
      shp.orderId?.orderNumber || "",
      shp.createdAt ? new Date(shp.createdAt).toISOString() : "",
      shp.shippedAt ? new Date(shp.shippedAt).toISOString() : "",
      shp.status,
      shp.carrier || "",
      shp.serviceLevel || "",
      shp.trackingNumber || "",
      shp.warehouseId?.code || "",
      shp.warehouseId?.name || "",
      shp.vendorId?.storeName || shp.vendorId?.businessName || "",
      addr.fullName || "",
      addr.phone || "",
      addr.city || "",
      addr.state || "",
      totalQty,
      skuSummary,
    ];
  });

  return buildSpreadsheet({
    sheetName: "Shipments",
    headers,
    rows,
    format,
    baseFilename: authenticatedVendorId ? "buybox_vendor_shipments_export" : "buybox_shipments_export",
  });
};

module.exports = {
  sanitizeCellValue,
  buildSpreadsheet,
  getPackingSlip,
  generatePickList,
  exportPickList,
  exportOrders,
  exportOrderItems,
  exportShipments,
};
