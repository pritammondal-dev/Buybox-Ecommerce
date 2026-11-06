const SkuRegistry = require("../models/SkuRegistry");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const AppError = require("../errors/AppError");

/**
 * Normalizes SKU strings consistently across the application:
 * trimmed and converted to uppercase.
 */
const normalizeSku = (sku) => {
  if (!sku) return "";
  return String(sku).trim().toUpperCase();
};

/**
 * Pre-validation check for SKU availability across Product, ProductVariant, and SkuRegistry.
 * Allows unchanged self-updates and the canonical Simple Product default-variant exception.
 */
const checkAvailability = async (
  sku,
  {
    excludeProductId = null,
    excludeVariantId = null,
    session = null,
    entityType = null,
  } = {}
) => {
  if (!sku) return;
  const upperSku = normalizeSku(sku);

  // 1. Check Centralized SkuRegistry
  let regQuery = SkuRegistry.findOne({ sku: upperSku, deletedAt: null });
  if (session) regQuery = regQuery.session(session);
  const regEntry = await regQuery;

  if (regEntry) {
    const isSameProduct =
      excludeProductId &&
      regEntry.productId?.toString() === excludeProductId.toString();
    const isExcludedVariant =
      excludeVariantId &&
      regEntry.variantId?.toString() === excludeVariantId.toString();

    // Canonical simple product exception: parent product and its default variant share the SKU
    // If the entry already has a variantId bound, only that exact variantId can share it
    const isAllowedParentProductDefaultVariant =
      isSameProduct &&
      regEntry.isDefault &&
      (regEntry.variantId
        ? (excludeVariantId && regEntry.variantId.toString() === excludeVariantId.toString())
        : (entityType === "variant" && !excludeVariantId));

    const isSelfParent =
      isSameProduct &&
      regEntry.entityType === "product" &&
      !excludeVariantId;

    if (!isExcludedVariant && !isAllowedParentProductDefaultVariant && !isSelfParent) {
      if (
        entityType === "product" ||
        (!entityType && (regEntry.entityType === "product" || regEntry.isDefault))
      ) {
        throw new AppError(
          "Product SKU already exists",
          409,
          "PRODUCT_SKU_ALREADY_EXISTS"
        );
      } else {
        throw new AppError(
          "Product variant SKU already exists in catalog",
          409,
          "VARIANT_SKU_ALREADY_EXISTS"
        );
      }
    }
  }

  // 2. Fallback check against Product collection (for unmigrated legacy documents)
  let prodQuery = Product.findOne({ sku: upperSku, deletedAt: null });
  if (session) prodQuery = prodQuery.session(session);
  const existingProduct = await prodQuery;

  if (
    existingProduct &&
    (!excludeProductId ||
      existingProduct._id.toString() !== excludeProductId.toString())
  ) {
    const code =
      entityType === "variant"
        ? "VARIANT_SKU_ALREADY_EXISTS"
        : "PRODUCT_SKU_ALREADY_EXISTS";
    const message =
      entityType === "variant"
        ? "Product variant SKU already exists in catalog"
        : "Product SKU already exists";
    throw new AppError(message, 409, code);
  }

  // 3. Fallback check against ProductVariant collection (for unmigrated legacy documents)
  let varQuery = ProductVariant.findOne({ sku: upperSku, deletedAt: null });
  if (session) varQuery = varQuery.session(session);
  const existingVariant = await varQuery;

  if (existingVariant) {
    const isSameProduct =
      excludeProductId &&
      existingVariant.productId?.toString() === excludeProductId.toString();
    const isExcludedVariant =
      excludeVariantId &&
      existingVariant._id?.toString() === excludeVariantId.toString();

    const isAllowedParentProductDefaultVariant =
      isSameProduct && existingVariant.isDefault && !excludeVariantId;

    if (!isExcludedVariant && !isAllowedParentProductDefaultVariant) {
      const code =
        entityType === "product"
          ? "PRODUCT_SKU_ALREADY_EXISTS"
          : "VARIANT_SKU_ALREADY_EXISTS";
      const message =
        entityType === "product"
          ? "Product SKU already exists"
          : "Product variant SKU already exists in catalog";
      throw new AppError(message, 409, code);
    }
  }
};

/**
 * Atomically reserves a SKU in SkuRegistry.
 * Leverages MongoDB WiredTiger unique index to serialize concurrent reservations.
 */
const reserveSku = async ({
  sku,
  productId,
  variantId = null,
  entityType = "product",
  isDefault = false,
  session = null,
}) => {
  if (!sku) return null;
  const upperSku = normalizeSku(sku);

  // Canonical Simple Product Exception:
  // If reserving for a default variant whose parent product already reserved this SKU in the same product
  if (isDefault && variantId) {
    let existingEntryQuery = SkuRegistry.findOne({
      sku: upperSku,
      productId,
      deletedAt: null,
    });
    if (session) existingEntryQuery = existingEntryQuery.session(session);
    const existingEntry = await existingEntryQuery;

    if (existingEntry) {
      existingEntry.variantId = variantId;
      existingEntry.isDefault = true;
      existingEntry.entityType = "variant";
      return await existingEntry.save({ session });
    }
  }

  try {
    const docs = await SkuRegistry.create(
      [
        {
          sku: upperSku,
          productId,
          variantId,
          entityType,
          isDefault,
          deletedAt: null,
        },
      ],
      session ? { session } : {}
    );
    return docs[0];
  } catch (err) {
    if (err.code === 11000 || (err.message && err.message.includes("E11000"))) {
      const code =
        entityType === "variant"
          ? "VARIANT_SKU_ALREADY_EXISTS"
          : "PRODUCT_SKU_ALREADY_EXISTS";
      const message =
        entityType === "variant"
          ? "Product variant SKU already exists in catalog"
          : "Product SKU already exists";
      throw new AppError(message, 409, code);
    }
    throw err;
  }
};

/**
 * Releases a SKU reservation upon soft deletion or hard deletion.
 */
const releaseSku = async ({
  sku = null,
  productId = null,
  variantId = null,
  session = null,
  softDelete = true,
}) => {
  const query = { deletedAt: null };
  if (sku) query.sku = normalizeSku(sku);
  if (productId) query.productId = productId;
  if (variantId) query.variantId = variantId;

  if (softDelete) {
    let updateQuery = SkuRegistry.updateMany(query, { deletedAt: new Date() });
    if (session) updateQuery = updateQuery.session(session);
    return await updateQuery;
  } else {
    let deleteQuery = SkuRegistry.deleteMany(query);
    if (session) deleteQuery = deleteQuery.session(session);
    return await deleteQuery;
  }
};

/**
 * Restores soft-deleted SKU reservations, verifying that no collision has occurred
 * with other active products in the interim.
 */
const restoreSku = async ({
  productId = null,
  variantId = null,
  session = null,
}) => {
  if (variantId) {
    let varQuery = ProductVariant.findById(variantId);
    if (session) varQuery = varQuery.session(session);
    const variant = await varQuery;

    if (!variant) {
      throw new AppError("Variant not found", 404, "VARIANT_NOT_FOUND");
    }

    const upperSku = normalizeSku(variant.sku);

    // Verify parent product is active
    let parentProdQuery = Product.findById(variant.productId);
    if (session) parentProdQuery = parentProdQuery.session(session);
    const parentProd = await parentProdQuery;

    if (!parentProd || parentProd.deletedAt !== null) {
      throw new AppError(
        "Cannot restore variant: parent product is deleted. Restore the parent product first.",
        400,
        "PARENT_PRODUCT_DELETED"
      );
    }

    // Check SkuRegistry for active collisions
    let activeRegQuery = SkuRegistry.findOne({ sku: upperSku, deletedAt: null });
    if (session) activeRegQuery = activeRegQuery.session(session);
    const activeReg = await activeRegQuery;

    if (activeReg) {
      const isAllowedDefaultSharing =
        variant.isDefault &&
        activeReg.productId?.toString() === variant.productId?.toString();
      const isSameVariant =
        activeReg.variantId?.toString() === variant._id.toString();

      if (!isAllowedDefaultSharing && !isSameVariant) {
        throw new AppError(
          `Cannot restore variant: SKU '${upperSku}' is already in use by another active catalog item`,
          409,
          "SKU_COLLISION_ON_RESTORE"
        );
      }
    }

    // Check Product collection fallback
    let prodQuery = Product.findOne({ sku: upperSku, deletedAt: null });
    if (session) prodQuery = prodQuery.session(session);
    const activeProd = await prodQuery;
    if (activeProd) {
      const isAllowedDefaultSharing =
        variant.isDefault &&
        activeProd._id.toString() === variant.productId.toString();
      if (!isAllowedDefaultSharing) {
        throw new AppError(
          `Cannot restore variant: SKU '${upperSku}' is already in use by another active product`,
          409,
          "SKU_COLLISION_ON_RESTORE"
        );
      }
    }

    // Check ProductVariant collection fallback
    let otherVarQuery = ProductVariant.findOne({
      sku: upperSku,
      deletedAt: null,
      _id: { $ne: variant._id },
    });
    if (session) otherVarQuery = otherVarQuery.session(session);
    const activeOtherVar = await otherVarQuery;
    if (activeOtherVar) {
      throw new AppError(
        `Cannot restore variant: SKU '${upperSku}' is already in use by another active variant`,
        409,
        "SKU_COLLISION_ON_RESTORE"
      );
    }

    // Restore or create SkuRegistry record
    let regDocQuery = SkuRegistry.findOne({ variantId: variant._id });
    if (session) regDocQuery = regDocQuery.session(session);
    const regDoc = await regDocQuery;

    if (regDoc) {
      regDoc.deletedAt = null;
      return await regDoc.save({ session });
    } else {
      return await reserveSku({
        sku: upperSku,
        productId: variant.productId,
        variantId: variant._id,
        entityType: "variant",
        isDefault: Boolean(variant.isDefault),
        session,
      });
    }
  }

  if (productId) {
    let prodQuery = Product.findById(productId);
    if (session) prodQuery = prodQuery.session(session);
    const product = await prodQuery;

    if (!product) {
      throw new AppError("Product not found", 404, "PRODUCT_NOT_FOUND");
    }

    // Collect all SKUs belonging to this product and its variants
    let variantsQuery = ProductVariant.find({ productId });
    if (session) variantsQuery = variantsQuery.session(session);
    const childVariants = await variantsQuery;

    const skusToCheck = new Set();
    if (product.sku) skusToCheck.add(normalizeSku(product.sku));
    for (const cv of childVariants) {
      if (cv.sku) skusToCheck.add(normalizeSku(cv.sku));
    }

    // Check every SKU against active records outside this product
    for (const sku of skusToCheck) {
      // 1. SkuRegistry
      let activeRegQuery = SkuRegistry.findOne({ sku, deletedAt: null });
      if (session) activeRegQuery = activeRegQuery.session(session);
      const activeReg = await activeRegQuery;

      if (activeReg && activeReg.productId?.toString() !== productId.toString()) {
        throw new AppError(
          `Cannot restore product: SKU '${sku}' is already in use by another active product`,
          409,
          "SKU_COLLISION_ON_RESTORE"
        );
      }

      // 2. Product collection fallback
      let activeProdQuery = Product.findOne({
        sku,
        deletedAt: null,
        _id: { $ne: productId },
      });
      if (session) activeProdQuery = activeProdQuery.session(session);
      const activeProd = await activeProdQuery;

      if (activeProd) {
        throw new AppError(
          `Cannot restore product: SKU '${sku}' is already in use by another active product`,
          409,
          "SKU_COLLISION_ON_RESTORE"
        );
      }

      // 3. ProductVariant collection fallback
      let activeVarQuery = ProductVariant.findOne({
        sku,
        deletedAt: null,
        productId: { $ne: productId },
      });
      if (session) activeVarQuery = activeVarQuery.session(session);
      const activeVar = await activeVarQuery;

      if (activeVar) {
        throw new AppError(
          `Cannot restore product: SKU '${sku}' is already in use by another active variant`,
          409,
          "SKU_COLLISION_ON_RESTORE"
        );
      }
    }

    // Restore existing soft-deleted SkuRegistry entries
    let restoreQuery = SkuRegistry.updateMany(
      { productId, deletedAt: { $ne: null } },
      { deletedAt: null }
    );
    if (session) restoreQuery = restoreQuery.session(session);
    await restoreQuery;

    // Ensure parent product has an active SkuRegistry entry (covers legacy unmigrated products)
    let prodRegQuery = SkuRegistry.findOne({
      productId,
      sku: normalizeSku(product.sku),
      deletedAt: null,
    });
    if (session) prodRegQuery = prodRegQuery.session(session);
    const prodReg = await prodRegQuery;

    if (!prodReg && product.sku) {
      await reserveSku({
        sku: product.sku,
        productId: product._id,
        entityType: "product",
        isDefault: product.productType === "simple",
        session,
      });
    }

    // Ensure child variants have active SkuRegistry entries
    for (const cv of childVariants) {
      if (cv.sku) {
        let varRegQuery = SkuRegistry.findOne({
          productId,
          variantId: cv._id,
          deletedAt: null,
        });
        if (session) varRegQuery = varRegQuery.session(session);
        let varReg = await varRegQuery;

        // If canonical default variant of simple product, check shared entry
        if (!varReg && cv.isDefault && product.productType === "simple") {
          let sharedQuery = SkuRegistry.findOne({
            productId,
            sku: normalizeSku(cv.sku),
            isDefault: true,
            deletedAt: null,
          });
          if (session) sharedQuery = sharedQuery.session(session);
          varReg = await sharedQuery;

          if (varReg && !varReg.variantId) {
            varReg.variantId = cv._id;
            await varReg.save({ session });
          }
        }

        if (!varReg) {
          await reserveSku({
            sku: cv.sku,
            productId: product._id,
            variantId: cv._id,
            entityType: "variant",
            isDefault: Boolean(cv.isDefault),
            session,
          });
        }
      }
    }

    return true;
  }
};

/**
 * Safely synchronizes an SKU update for a product or variant.
 */
const syncSkuUpdate = async ({
  oldSku,
  newSku,
  productId,
  variantId = null,
  entityType = "product",
  isDefault = false,
  session = null,
}) => {
  const upperOld = normalizeSku(oldSku);
  const upperNew = normalizeSku(newSku);

  if (upperOld === upperNew) {
    // Unchanged SKU update: ensure registry record exists
    let existingQuery = SkuRegistry.findOne({
      sku: upperNew,
      productId,
      deletedAt: null,
    });
    if (session) existingQuery = existingQuery.session(session);
    const existing = await existingQuery;
    if (!existing) {
      return await reserveSku({
        sku: upperNew,
        productId,
        variantId,
        entityType,
        isDefault,
        session,
      });
    }
    return existing;
  }

  // Release old reservation
  if (upperOld) {
    await releaseSku({
      sku: upperOld,
      productId,
      variantId,
      session,
      softDelete: true,
    });
  }

  // Reserve new SKU
  return await reserveSku({
    sku: upperNew,
    productId,
    variantId,
    entityType,
    isDefault,
    session,
  });
};

module.exports = {
  normalizeSku,
  checkAvailability,
  reserveSku,
  releaseSku,
  restoreSku,
  syncSkuUpdate,
};
