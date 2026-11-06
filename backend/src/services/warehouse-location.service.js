const mongoose = require("mongoose");
const WarehouseLocation = require("../models/WarehouseLocation");
const Warehouse = require("../models/Warehouse");
const ProductVariant = require("../models/ProductVariant");
const Inventory = require("../models/Inventory");
const AppError = require("../errors/AppError");

/**
 * Create a new bin/shelf location inside a warehouse.
 */
const createLocation = async (warehouseIdOrData, maybeData = {}) => {
  let warehouseId;
  let data;
  if (typeof warehouseIdOrData === "object" && warehouseIdOrData !== null && !mongoose.isValidObjectId(warehouseIdOrData)) {
    warehouseId = warehouseIdOrData.warehouseId;
    data = warehouseIdOrData;
  } else {
    warehouseId = warehouseIdOrData;
    data = maybeData;
  }

  if (!mongoose.isValidObjectId(warehouseId)) {
    throw new AppError("Invalid warehouse ID", 400, "INVALID_WAREHOUSE_ID");
  }

  const warehouse = await Warehouse.findById(warehouseId);
  if (!warehouse || !warehouse.isActive || warehouse.deletedAt) {
    throw new AppError("Warehouse not found or inactive", 404, "WAREHOUSE_NOT_FOUND");
  }

  const code = String(data.code || "").trim().toUpperCase();
  if (!code) {
    throw new AppError("Location code is required", 400, "LOCATION_CODE_REQUIRED");
  }

  const existing = await WarehouseLocation.findOne({
    warehouseId,
    code,
  });

  if (existing) {
    throw new AppError(`Location code '${code}' already exists in this warehouse`, 409, "LOCATION_CODE_ALREADY_EXISTS");
  }

  const location = await WarehouseLocation.create({
    warehouseId,
    code,
    zone: data.zone || "General",
    aisle: data.aisle || null,
    rack: data.rack || null,
    shelf: data.shelf || null,
    bin: data.bin || null,
    type: data.type || "pick",
    maxCapacity: Number(data.maxCapacity) || 1000,
    isActive: data.isActive !== false,
    items: [],
  });

  return location;
};

/**
 * Update an existing bin/shelf location.
 */
const updateLocation = async (id, data) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid location ID", 400, "INVALID_ID");
  }

  const location = await WarehouseLocation.findById(id);
  if (!location) {
    throw new AppError("Warehouse location not found", 404, "LOCATION_NOT_FOUND");
  }

  if (data.code && data.code.toUpperCase() !== location.code) {
    const code = data.code.trim().toUpperCase();
    const existing = await WarehouseLocation.findOne({
      warehouseId: location.warehouseId,
      code,
    });
    if (existing && existing._id.toString() !== id.toString()) {
      throw new AppError(`Location code '${code}' is already in use in this warehouse`, 409, "LOCATION_CODE_ALREADY_EXISTS");
    }
    location.code = code;
  }

  if (data.zone !== undefined) location.zone = data.zone;
  if (data.aisle !== undefined) location.aisle = data.aisle;
  if (data.rack !== undefined) location.rack = data.rack;
  if (data.shelf !== undefined) location.shelf = data.shelf;
  if (data.bin !== undefined) location.bin = data.bin;
  if (data.type !== undefined) location.type = data.type;
  if (data.maxCapacity !== undefined) location.maxCapacity = Number(data.maxCapacity);
  if (data.isActive !== undefined) location.isActive = Boolean(data.isActive);

  await location.save();
  return location;
};

/**
 * List bin locations for a warehouse.
 */
const listLocations = async (warehouseId, { type, isActive } = {}) => {
  if (!mongoose.isValidObjectId(warehouseId)) {
    throw new AppError("Invalid warehouse ID", 400, "INVALID_WAREHOUSE_ID");
  }

  const query = { warehouseId };
  if (type) query.type = type;
  if (isActive !== undefined) query.isActive = isActive === "true" || isActive === true;

  return WarehouseLocation.find(query)
    .populate("items.productVariantId", "sku title name price")
    .sort({ zone: 1, code: 1 })
    .lean();
};

/**
 * Assign a quantity of product variant to a specific bin location.
 * Validates against authoritative Inventory.onHand.
 */
const assignItemToLocation = async (locationIdOrObj, maybeVariantId, maybeQuantity) => {
  let locationId;
  let productVariantId;
  let quantity;
  if (typeof locationIdOrObj === "object" && locationIdOrObj !== null && !mongoose.isValidObjectId(locationIdOrObj)) {
    locationId = locationIdOrObj.locationId || locationIdOrObj.id;
    productVariantId = locationIdOrObj.productVariantId;
    quantity = locationIdOrObj.quantity;
  } else {
    locationId = locationIdOrObj;
    productVariantId = maybeVariantId;
    quantity = maybeQuantity;
  }

  if (!mongoose.isValidObjectId(locationId) || !mongoose.isValidObjectId(productVariantId)) {
    throw new AppError("Invalid IDs provided", 400, "INVALID_ID");
  }

  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 0) {
    throw new AppError("Quantity must be a non-negative integer", 400, "INVALID_QUANTITY");
  }

  const location = await WarehouseLocation.findById(locationId);
  if (!location || !location.isActive) {
    throw new AppError("Warehouse location not found or inactive", 404, "LOCATION_NOT_FOUND");
  }

  // Authoritative check against Inventory
  const inv = await Inventory.findOne({
    warehouseId: location.warehouseId,
    productVariantId,
  });

  const onHand = inv ? inv.onHand : 0;
  if (onHand < qty) {
    throw new AppError(
      `Cannot assign ${qty} units to bin. Authoritative warehouse on-hand stock is only ${onHand}.`,
      400,
      "EXCEEDS_WAREHOUSE_ON_HAND"
    );
  }

  const existingItemIndex = location.items.findIndex(
    (it) => it.productVariantId.toString() === productVariantId.toString()
  );

  if (existingItemIndex >= 0) {
    location.items[existingItemIndex].quantity = qty;
  } else {
    location.items.push({ productVariantId, quantity: qty });
  }

  await location.save();
  return location;
};

/**
 * Move items from one bin location to another bin within the same warehouse.
 */
const moveItemBetweenLocations = async (sourceLocOrObj, maybeDest, maybeVariant, maybeQuantity) => {
  let sourceLocationId;
  let destLocationId;
  let productVariantId;
  let quantity;
  if (typeof sourceLocOrObj === "object" && sourceLocOrObj !== null && !mongoose.isValidObjectId(sourceLocOrObj)) {
    sourceLocationId = sourceLocOrObj.sourceLocationId;
    destLocationId = sourceLocOrObj.destinationLocationId || sourceLocOrObj.destLocationId;
    productVariantId = sourceLocOrObj.productVariantId;
    quantity = sourceLocOrObj.quantity;
  } else {
    sourceLocationId = sourceLocOrObj;
    destLocationId = maybeDest;
    productVariantId = maybeVariant;
    quantity = maybeQuantity;
  }

  if (!mongoose.isValidObjectId(sourceLocationId) || !mongoose.isValidObjectId(destLocationId)) {
    throw new AppError("Invalid location IDs", 400, "INVALID_ID");
  }
  if (!mongoose.isValidObjectId(productVariantId)) {
    throw new AppError("Invalid product variant ID", 400, "INVALID_ID");
  }

  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty <= 0) {
    throw new AppError("Move quantity must be a positive integer", 400, "INVALID_QUANTITY");
  }

  const [sourceLoc, destLoc] = await Promise.all([
    WarehouseLocation.findById(sourceLocationId),
    WarehouseLocation.findById(destLocationId),
  ]);

  if (!sourceLoc || !destLoc) {
    throw new AppError("Source or destination location not found", 404, "LOCATION_NOT_FOUND");
  }

  if (sourceLoc.warehouseId.toString() !== destLoc.warehouseId.toString()) {
    throw new AppError("Bin moves must be within the same warehouse. Use stock transfers for inter-warehouse moves.", 400, "CROSS_WAREHOUSE_BIN_MOVE_DISALLOWED");
  }

  const sourceItem = sourceLoc.items.find(
    (it) => it.productVariantId.toString() === productVariantId.toString()
  );

  if (!sourceItem || (sourceItem.quantity || 0) < qty) {
    throw new AppError(
      `Insufficient quantity at source location '${sourceLoc.code}'. Available: ${sourceItem?.quantity || 0}, Requested: ${qty}`,
      409,
      "INSUFFICIENT_BIN_STOCK"
    );
  }

  sourceItem.quantity -= qty;
  if (sourceItem.quantity <= 0) {
    sourceLoc.items = sourceLoc.items.filter(
      (it) => it.productVariantId.toString() !== productVariantId.toString()
    );
  }

  const destItem = destLoc.items.find(
    (it) => it.productVariantId.toString() === productVariantId.toString()
  );

  if (destItem) {
    destItem.quantity += qty;
  } else {
    destLoc.items.push({ productVariantId, quantity: qty });
  }

  await Promise.all([sourceLoc.save(), destLoc.save()]);

  return {
    sourceLocation: sourceLoc,
    destinationLocation: destLoc,
    movedQuantity: qty,
  };
};

module.exports = {
  createLocation,
  updateLocation,
  listLocations,
  assignItemToLocation,
  moveItemBetweenLocations,
};
