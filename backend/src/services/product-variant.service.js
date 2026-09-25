const productVariantRepository = require("../repositories/product-variant.repository");
const productRepository = require("../repositories/product.repository");
const {
  ensureProductOwnership,
} = require("./product.service");
const AppError = require("../errors/AppError");

const createProductVariant = async ({
  data,
  actor,
}) => {
  const product = await productRepository.findById(
    data.productId
  );

  if (!product) {
    throw new AppError(
      "Product not found",
      404,
      "PRODUCT_NOT_FOUND"
    );
  }

  await ensureProductOwnership(product, actor);

  const existingSku =
    await productVariantRepository.findBySku(data.sku);

  if (existingSku) {
    throw new AppError(
      "Product variant SKU already exists",
      409,
      "VARIANT_SKU_ALREADY_EXISTS"
    );
  }

  return productVariantRepository.create(data);
};

const getProductVariant = async ({
  id,
  actor,
}) => {
  const variant =
    await productVariantRepository.findById(id);

  if (!variant) {
    throw new AppError(
      "Product variant not found",
      404,
      "VARIANT_NOT_FOUND"
    );
  }

  const product = await productRepository.findById(
    variant.productId
  );

  if (!product) {
    throw new AppError(
      "Product not found",
      404,
      "PRODUCT_NOT_FOUND"
    );
  }

  await ensureProductOwnership(product, actor);

  return variant;
};

const listProductVariants = async ({
  productId,
  actor,
}) => {
  const product = await productRepository.findById(
    productId
  );

  if (!product) {
    throw new AppError(
      "Product not found",
      404,
      "PRODUCT_NOT_FOUND"
    );
  }

  await ensureProductOwnership(product, actor);

  return productVariantRepository.findByProductId(
    productId
  );
};

const updateProductVariant = async ({
  id,
  data,
  actor,
}) => {
  const variant =
    await productVariantRepository.findById(id);

  if (!variant) {
    throw new AppError(
      "Product variant not found",
      404,
      "VARIANT_NOT_FOUND"
    );
  }

  const product = await productRepository.findById(
    variant.productId
  );

  if (!product) {
    throw new AppError(
      "Product not found",
      404,
      "PRODUCT_NOT_FOUND"
    );
  }

  await ensureProductOwnership(product, actor);

  if (data.sku && data.sku !== variant.sku) {
    const existingSku =
      await productVariantRepository.findBySku(
        data.sku
      );

    if (existingSku) {
      throw new AppError(
        "Product variant SKU already exists",
        409,
        "VARIANT_SKU_ALREADY_EXISTS"
      );
    }
  }

  const safeData = {
    ...data,
  };
  delete safeData.productId;

  return productVariantRepository.updateById(
    id,
    safeData
  );
};

const deleteProductVariant = async ({
  id,
  actor,
}) => {
  const variant =
    await productVariantRepository.findById(id);

  if (!variant) {
    throw new AppError(
      "Product variant not found",
      404,
      "VARIANT_NOT_FOUND"
    );
  }

  const product = await productRepository.findById(
    variant.productId
  );

  if (!product) {
    throw new AppError(
      "Product not found",
      404,
      "PRODUCT_NOT_FOUND"
    );
  }

  await ensureProductOwnership(product, actor);

  return productVariantRepository.softDeleteById(id);
};

const createBulkVariants = async ({ productId, variants, actor, req = null }) => {
  const ProductVariant = require("../models/ProductVariant");
  const Inventory = require("../models/Inventory");
  const InventoryTransaction = require("../models/InventoryTransaction");
  const Warehouse = require("../models/Warehouse");
  const { recordAuditLog } = require("./governance.service");
  const mongoose = require("mongoose");

  const product = await productRepository.findById(productId);
  if (!product) {
    throw new AppError("Product not found", 404, "PRODUCT_NOT_FOUND");
  }

  await ensureProductOwnership(product, actor);

  if (!Array.isArray(variants) || variants.length === 0) {
    throw new AppError("No variants provided", 400, "EMPTY_VARIANTS_PAYLOAD");
  }

  // Check SKU uniqueness in payload
  const seenSkus = new Set();
  const skusToCheck = [];
  for (const v of variants) {
    const sku = String(v.sku || "").trim().toUpperCase();
    if (!sku) {
      throw new AppError("Each variant requires a unique SKU", 400, "MISSING_VARIANT_SKU");
    }
    if (seenSkus.has(sku)) {
      throw new AppError(`Duplicate SKU '${sku}' in request payload`, 400, "DUPLICATE_PAYLOAD_SKU");
    }
    seenSkus.add(sku);
    skusToCheck.push(sku);
  }

  // Check database uniqueness
  const existingVariants = await ProductVariant.find({ sku: { $in: skusToCheck }, deletedAt: null }).lean();
  if (existingVariants.length > 0) {
    throw new AppError(
      `SKU '${existingVariants[0].sku}' already exists in the catalog`,
      409,
      "VARIANT_SKU_ALREADY_EXISTS"
    );
  }

  let primaryWarehouse = await Warehouse.findOne({ isActive: true }).lean();
  if (!primaryWarehouse) {
    primaryWarehouse = await Warehouse.create({
      name: "Default Fulfillment Hub",
      code: `WH-${Date.now().toString().slice(-6)}`,
      address: {
        addressLine1: "Central Hub",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "IN",
      },
      isActive: true,
    });
  }

  const createdVariants = [];
  for (const item of variants) {
    const sku = String(item.sku).trim().toUpperCase();
    const price = Number(item.price) || Number(product.price.toString());
    const stockQty = Math.max(0, parseInt(item.stockQuantity, 10) || 0);

    const variant = await ProductVariant.create({
      productId: product._id,
      sku,
      name: item.name || sku,
      attributes: item.attributes || {},
      price: mongoose.Types.Decimal128.fromString(price.toFixed(2)),
      compareAtPrice: item.compareAtPrice
        ? mongoose.Types.Decimal128.fromString(Number(item.compareAtPrice).toFixed(2))
        : null,
      costPrice: item.costPrice
        ? mongoose.Types.Decimal128.fromString(Number(item.costPrice).toFixed(2))
        : null,
      currency: "INR",
      stockQuantity: stockQty,
      stockStatus: stockQty > 0 ? "in_stock" : "out_of_stock",
      weight: item.weight,
      image: item.image,
    });

    // Initialize warehouse inventory
    await Inventory.create({
      productVariantId: variant._id,
      warehouseId: primaryWarehouse._id,
      onHand: stockQty,
      reserved: 0,
      lowStockThreshold: 5,
      lastStockUpdateAt: new Date(),
    });

    if (stockQty > 0) {
      await InventoryTransaction.create({
        productVariantId: variant._id,
        warehouseId: primaryWarehouse._id,
        type: "receive",
        quantity: stockQty,
        onHandBefore: 0,
        onHandAfter: stockQty,
        reservedBefore: 0,
        reservedAfter: 0,
        referenceType: "variant_matrix_creation",
        referenceId: product._id.toString(),
        actorUserId: actor.id || actor._id,
        notes: `Opening inventory for variant ${sku}`,
      });
    }

    createdVariants.push(variant);
  }

  await recordAuditLog({
    actorId: actor.id,
    targetId: product._id,
    action: "product_variants_bulk_created",
    entityType: "product",
    afterState: {
      productId: product._id,
      variantsCount: createdVariants.length,
      skus: skusToCheck,
    },
    req,
  });

  return createdVariants;
};

module.exports = {
  createProductVariant,
  getProductVariant,
  listProductVariants,
  updateProductVariant,
  deleteProductVariant,
  createBulkVariants,
};