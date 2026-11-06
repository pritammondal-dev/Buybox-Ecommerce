const mongoose = require("mongoose");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const Inventory = require("../models/Inventory");
const SkuRegistry = require("../models/SkuRegistry");
const Warehouse = require("../models/Warehouse");
const {
  normalizeVariantAttributes,
  serializeAttributeCombination,
} = require("../utils/attribute.util");
const { normalizeSku } = require("./sku-registry.service");

/**
 * Phase 2F Controlled Catalog Reconciliation Service (Strictly Read-Only Dry-Run).
 *
 * Scans catalog documents across 12 integrity categories without performing
 * any database mutations, index drops, or automatic destructive changes.
 */
const runDryRun = async ({ sampleLimit = 5 } = {}) => {
  const timestamp = new Date().toISOString();

  // 1. Gather baseline record counts
  const totalProducts = await Product.countDocuments();
  const totalVariants = await ProductVariant.countDocuments();
  const totalInventories = await Inventory.countDocuments();

  const categories = [];

  // =========================================================================
  // RULE 1: Simple products without a canonical default variant
  // =========================================================================
  const simpleProducts = await Product.find({
    productType: "simple",
    deletedAt: null,
  })
    .select("_id sku name")
    .lean();

  const simpleProductIds = simpleProducts.map((p) => p._id);
  const defaultVariants = await ProductVariant.find({
    productId: { $in: simpleProductIds },
    isDefault: true,
    deletedAt: null,
  })
    .select("_id productId sku")
    .lean();

  const defaultVariantMap = new Map();
  for (const dv of defaultVariants) {
    const pid = dv.productId.toString();
    defaultVariantMap.set(pid, (defaultVariantMap.get(pid) || 0) + 1);
  }

  const missingDefaultSamples = [];
  let missingDefaultCount = 0;
  for (const p of simpleProducts) {
    const count = defaultVariantMap.get(p._id.toString()) || 0;
    if (count === 0) {
      missingDefaultCount++;
      if (missingDefaultSamples.length < sampleLimit) {
        missingDefaultSamples.push({
          recordId: p._id.toString(),
          currentStoredValue: { defaultVariantCount: 0, sku: p.sku },
          expectedValue: { defaultVariantCount: 1, sku: p.sku },
          authoritativeSource: "Product.productType === 'simple' canonical variant contract",
          proposedRemediation: "Provision canonical default variant matching parent SKU and price",
          isDeterministic: true,
          prerequisites: "Database snapshot backup. Verification that parent SKU does not conflict with active variants.",
        });
      }
    } else if (count > 1) {
      missingDefaultCount++;
      if (missingDefaultSamples.length < sampleLimit) {
        missingDefaultSamples.push({
          recordId: p._id.toString(),
          currentStoredValue: { defaultVariantCount: count, sku: p.sku },
          expectedValue: { defaultVariantCount: 1, sku: p.sku },
          authoritativeSource: "Product.productType === 'simple' canonical variant contract",
          proposedRemediation: "Retain the oldest variant as default and unmark others",
          isDeterministic: true,
          prerequisites: "Database snapshot backup. Verification that parent SKU does not conflict with active variants.",
        });
      }
    }
  }

  categories.push({
    ruleId: "DEF_VAR_MISSING",
    ruleName: "Simple products without canonical default variant",
    detectionRule:
      "Simple active products having either 0 or >1 active ProductVariant where isDefault=true and deletedAt=null.",
    authoritativeSource: "Product.productType === 'simple' canonical variant contract",
    affectedRecordCount: missingDefaultCount,
    sampleIdentifiers: missingDefaultSamples,
    proposedReconciliationAction:
      "For 0 variants: provision canonical default variant matching parent SKU and price. For >1: retain the oldest variant as default and unmark others.",
    classification: "DETERMINISTIC",
    prerequisites:
      "Database snapshot backup. Verification that parent SKU does not conflict with active variants.",
  });

  // =========================================================================
  // RULE 2: Missing, duplicate, or inconsistent variant references
  // =========================================================================
  const allVariants = await ProductVariant.find({ deletedAt: null })
    .select("_id productId isDefault sku")
    .lean();

  const variantProductIds = [
    ...new Set(allVariants.map((v) => v.productId.toString())),
  ];
  const existingProducts = await Product.find({
    _id: { $in: variantProductIds },
  })
    .select("_id productType deletedAt")
    .lean();
  const existingProductMap = new Map(
    existingProducts.map((p) => [p._id.toString(), p])
  );

  const brokenRefSamples = [];
  let brokenRefCount = 0;
  for (const v of allVariants) {
    const parent = existingProductMap.get(v.productId.toString());
    if (!parent || parent.deletedAt !== null) {
      brokenRefCount++;
      if (brokenRefSamples.length < sampleLimit) {
        brokenRefSamples.push({
          recordId: v._id.toString(),
          currentStoredValue: {
            productId: v.productId.toString(),
            parentStatus: parent ? "soft_deleted" : "missing",
          },
          expectedValue: { parentStatus: "active_non_deleted" },
          authoritativeSource: "Product collection parent existence and deletedAt status",
          proposedRemediation:
            "Quarantine orphan variants; soft-delete variants whose parent products were soft-deleted.",
          isDeterministic: false,
          prerequisites:
            "Historical order snapshot inspection to verify whether orphan variant is bound to active shipments.",
        });
      }
    }
  }

  categories.push({
    ruleId: "VARIANT_REF_INCONSISTENCY",
    ruleName: "Missing or inconsistent parent product references",
    detectionRule:
      "Active ProductVariant whose productId points to non-existent or soft-deleted parent Product.",
    authoritativeSource: "Product collection parent existence and deletedAt status",
    affectedRecordCount: brokenRefCount,
    sampleIdentifiers: brokenRefSamples,
    proposedReconciliationAction:
      "Quarantine orphan variants; soft-delete variants whose parent products were soft-deleted.",
    classification: "AMBIGUOUS",
    prerequisites:
      "Historical order snapshot inspection to verify whether orphan variant is bound to active shipments.",
  });

  // =========================================================================
  // RULE 3: Variable products with duplicate attribute combinations
  // =========================================================================
  const variableProducts = await Product.find({
    productType: "variable",
    deletedAt: null,
  })
    .select("_id sku name price")
    .lean();
  const variableProductIds = variableProducts.map((p) => p._id);

  const variableVariants = await ProductVariant.find({
    productId: { $in: variableProductIds },
    deletedAt: null,
  })
    .select("_id productId attributes sku price isActive")
    .lean();

  const variantsByProduct = new Map();
  for (const v of variableVariants) {
    const pid = v.productId.toString();
    if (!variantsByProduct.has(pid)) variantsByProduct.set(pid, []);
    variantsByProduct.get(pid).push(v);
  }

  const duplicateComboSamples = [];
  let duplicateComboCount = 0;

  for (const [pid, vList] of variantsByProduct.entries()) {
    const seenCombos = new Map();
    for (const v of vList) {
      try {
        const normalized = normalizeVariantAttributes(v.attributes);
        const comboKey = serializeAttributeCombination(normalized);
        if (comboKey) {
          if (seenCombos.has(comboKey)) {
            duplicateComboCount++;
            if (duplicateComboSamples.length < sampleLimit) {
              duplicateComboSamples.push({
                recordId: v._id.toString(),
                currentStoredValue: {
                  productId: pid,
                  combination: comboKey,
                  duplicateOfVariantId: seenCombos.get(comboKey)._id.toString(),
                },
                expectedValue: "Unique attribute combination per variable product",
                authoritativeSource: "ProductVariant.attributes serialized combination",
                proposedRemediation:
                  "Flag conflicting variants for vendor catalog review. Do NOT auto-merge or auto-delete to protect warehouse inventory integrity.",
                isDeterministic: false,
                prerequisites:
                  "Vendor notification, inventory reservation audit on each duplicate variant.",
              });
            }
          } else {
            seenCombos.set(comboKey, v);
          }
        }
      } catch {
        // Handled in Rule 12
      }
    }
  }

  categories.push({
    ruleId: "DUPLICATE_ATTR_COMBINATION",
    ruleName: "Variable products with duplicate attribute combinations",
    detectionRule:
      "Multiple active variants on the same variable product having identical serialized attribute combinations.",
    authoritativeSource: "ProductVariant.attributes serialized combination",
    affectedRecordCount: duplicateComboCount,
    sampleIdentifiers: duplicateComboSamples,
    proposedReconciliationAction:
      "Flag conflicting variants for vendor catalog review. Do NOT auto-merge or auto-delete to protect warehouse inventory integrity.",
    classification: "AMBIGUOUS",
    prerequisites:
      "Vendor notification, inventory reservation audit on each duplicate variant.",
  });

  // =========================================================================
  // RULE 4: Product and variant active SKU collisions across different products
  // =========================================================================
  const activeProducts = await Product.find({ deletedAt: null })
    .select("_id sku")
    .lean();
  const activeVariantsList = await ProductVariant.find({ deletedAt: null })
    .select("_id productId sku isDefault")
    .lean();

  const prodSkuMap = new Map();
  for (const p of activeProducts) {
    if (p.sku) prodSkuMap.set(normalizeSku(p.sku), p);
  }

  const skuCollisionSamples = [];
  let skuCollisionCount = 0;
  for (const v of activeVariantsList) {
    const uSku = normalizeSku(v.sku);
    if (prodSkuMap.has(uSku)) {
      const collProd = prodSkuMap.get(uSku);
      const isCanonicalPair =
        collProd._id.toString() === v.productId.toString() && v.isDefault;
      if (!isCanonicalPair) {
        skuCollisionCount++;
        if (skuCollisionSamples.length < sampleLimit) {
          skuCollisionSamples.push({
            recordId: v._id.toString(),
            currentStoredValue: {
              sku: uSku,
              collidingProductId: collProd._id.toString(),
              variantProductId: v.productId.toString(),
            },
            expectedValue: "Global unique active SKU across catalog",
            authoritativeSource: "Product and ProductVariant collections",
            proposedRemediation:
              "Quarantine colliding records and issue merchant correction workflow. Populate SkuRegistry for non-colliding catalog.",
            isDeterministic: false,
            prerequisites:
              "Merchant notification, isolated SKU migration script with manual alias mapping.",
          });
        }
      }
    }
  }

  categories.push({
    ruleId: "CROSS_COLLECTION_SKU_COLLISION",
    ruleName: "Product and variant active SKU collisions across different products",
    detectionRule:
      "Active Product and active ProductVariant sharing identical normalized SKU outside canonical default-variant relationship.",
    authoritativeSource: "Product and ProductVariant collections",
    affectedRecordCount: skuCollisionCount,
    sampleIdentifiers: skuCollisionSamples,
    proposedReconciliationAction:
      "Quarantine colliding records and issue merchant correction workflow. Populate SkuRegistry for non-colliding catalog.",
    classification: "POTENTIALLY_DESTRUCTIVE",
    prerequisites:
      "Merchant notification, isolated SKU migration script with manual alias mapping.",
  });

  // =========================================================================
  // RULE 5: Active records missing from centralized SkuRegistry
  // =========================================================================
  const activeRegistryEntries = await SkuRegistry.find({ deletedAt: null })
    .select("sku productId variantId entityType")
    .lean();

  const regProductSet = new Set(
    activeRegistryEntries
      .filter((r) => r.entityType === "product" || r.productId)
      .map((r) => r.productId.toString())
  );
  const regVariantSet = new Set(
    activeRegistryEntries
      .filter((r) => r.variantId)
      .map((r) => r.variantId.toString())
  );

  const missingRegistrySamples = [];
  let missingRegistryCount = 0;

  for (const p of activeProducts) {
    if (p.sku && !regProductSet.has(p._id.toString())) {
      missingRegistryCount++;
      if (missingRegistrySamples.length < sampleLimit) {
        missingRegistrySamples.push({
          recordId: p._id.toString(),
          currentStoredValue: { inSkuRegistry: false, sku: p.sku, type: "product" },
          expectedValue: { inSkuRegistry: true, sku: p.sku, type: "product" },
          authoritativeSource: "SkuRegistry collection",
          proposedRemediation: "Seed active product into SkuRegistry via reserveSku",
          isDeterministic: true,
          prerequisites: "Verify SKU has no collision in SkuRegistry.",
        });
      }
    }
  }

  for (const v of activeVariantsList) {
    if (v.sku && !regVariantSet.has(v._id.toString())) {
      missingRegistryCount++;
      if (missingRegistrySamples.length < sampleLimit) {
        missingRegistrySamples.push({
          recordId: v._id.toString(),
          currentStoredValue: { inSkuRegistry: false, sku: v.sku, type: "variant" },
          expectedValue: { inSkuRegistry: true, sku: v.sku, type: "variant" },
          authoritativeSource: "SkuRegistry collection",
          proposedRemediation: "Seed active variant into SkuRegistry via reserveSku",
          isDeterministic: true,
          prerequisites: "Verify SKU has no collision in SkuRegistry.",
        });
      }
    }
  }

  categories.push({
    ruleId: "MISSING_SKU_REGISTRY_ENTRY",
    ruleName: "Active catalog records missing from centralized SkuRegistry",
    detectionRule:
      "Active non-deleted Product or ProductVariant having no active record in SkuRegistry.",
    authoritativeSource: "SkuRegistry collection",
    affectedRecordCount: missingRegistryCount,
    sampleIdentifiers: missingRegistrySamples,
    proposedReconciliationAction:
      "Seed unmigrated active catalog SKUs into SkuRegistry once verified collision-free.",
    classification: "DETERMINISTIC",
    prerequisites:
      "Pre-verification of SKU availability and database backup before reservation backfill.",
  });

  // =========================================================================
  // RULE 6: Missing warehouse inventory records
  // =========================================================================
  const allActiveVariantIds = activeVariantsList.map((v) => v._id);

  const existingInventories = await Inventory.find({
    productVariantId: { $in: allActiveVariantIds },
  })
    .select("productVariantId")
    .lean();

  const inventoryVariantSet = new Set(
    existingInventories.map((i) => i.productVariantId.toString())
  );

  const missingInventorySamples = [];
  let missingInventoryCount = 0;
  for (const v of activeVariantsList) {
    if (!inventoryVariantSet.has(v._id.toString())) {
      missingInventoryCount++;
      if (missingInventorySamples.length < sampleLimit) {
        missingInventorySamples.push({
          recordId: v._id.toString(),
          currentStoredValue: { inventoryRecordsCount: 0, sku: v.sku },
          expectedValue: { inventoryRecordsCount: ">= 1", sku: v.sku },
          authoritativeSource: "Inventory collection records",
          proposedRemediation:
            "Initialize authoritative Inventory records with onHand=0, reserved=0 linked to default active warehouse.",
          isDeterministic: true,
          prerequisites:
            "Active warehouse verification. Multi-document transaction during provisioning.",
        });
      }
    }
  }

  categories.push({
    ruleId: "MISSING_WAREHOUSE_INVENTORY",
    ruleName: "Active product variants missing warehouse inventory records",
    detectionRule:
      "Active non-deleted ProductVariant with zero associated Inventory records.",
    authoritativeSource: "Inventory collection records",
    affectedRecordCount: missingInventoryCount,
    sampleIdentifiers: missingInventorySamples,
    proposedReconciliationAction:
      "Initialize authoritative Inventory records with onHand=0, reserved=0 linked to default active warehouse.",
    classification: "DETERMINISTIC",
    prerequisites:
      "Active warehouse verification. Multi-document transaction during provisioning.",
  });

  // =========================================================================
  // RULE 7: Stale ProductVariant.stockQuantity mirrors
  // =========================================================================
  const activeWarehouses = await Warehouse.find({
    isActive: true,
    deletedAt: null,
  })
    .select("_id")
    .lean();
  const activeWarehouseIds = (activeWarehouses || []).map((w) => w._id);

  const activeInventories = await Inventory.find({
    warehouseId: { $in: activeWarehouseIds },
    deletedAt: null,
  })
    .select("productVariantId onHand reserved")
    .lean();

  const variantAvailableMap = new Map();
  for (const inv of activeInventories) {
    const vId = inv.productVariantId?.toString();
    if (vId) {
      const onHand = Number(inv.onHand) || 0;
      const reserved = Number(inv.reserved) || 0;
      const available = Math.max(0, onHand - reserved);
      variantAvailableMap.set(
        vId,
        (variantAvailableMap.get(vId) || 0) + available
      );
    }
  }

  const staleMirrorSamples = [];
  let staleMirrorCount = 0;
  for (const v of activeVariantsList) {
    const authoritativeAvailable =
      variantAvailableMap.get(v._id.toString()) || 0;
    const currentMirror = v.stockQuantity || 0;
    if (currentMirror !== authoritativeAvailable) {
      staleMirrorCount++;
      if (staleMirrorSamples.length < sampleLimit) {
        staleMirrorSamples.push({
          recordId: v._id.toString(),
          currentStoredValue: { cachedMirrorStock: currentMirror, sku: v.sku },
          expectedValue: { authoritativeAvailableStock: authoritativeAvailable, sku: v.sku },
          authoritativeSource:
            "Inventory collection across eligible active warehouses: sum(max(0, onHand - reserved))",
          proposedRemediation:
            "Synchronize ProductVariant.stockQuantity with sum(max(0, onHand - reserved)). NEVER overwrite Inventory with mirror.",
          isDeterministic: true,
          prerequisites:
            "Inventory read transaction lock to prevent race conditions during update.",
        });
      }
    }
  }

  categories.push({
    ruleId: "STALE_STOCK_QUANTITY_MIRROR",
    ruleName: "Stale ProductVariant.stockQuantity read mirrors",
    detectionRule:
      "ProductVariant.stockQuantity mirror value does not match authoritative sum(max(0, onHand - reserved)) across eligible active warehouses.",
    authoritativeSource:
      "Inventory collection across eligible active warehouses: sum(max(0, onHand - reserved))",
    affectedRecordCount: staleMirrorCount,
    sampleIdentifiers: staleMirrorSamples,
    proposedReconciliationAction:
      "Synchronize ProductVariant.stockQuantity with sum(max(0, onHand - reserved)). NEVER overwrite Inventory with mirror.",
    classification: "DETERMINISTIC",
    prerequisites:
      "Inventory read transaction lock to prevent race conditions during update.",
  });

  // =========================================================================
  // RULE 8: Invalid or missing inventory fields
  // =========================================================================
  const invalidInventories = await Inventory.find({
    $or: [
      { onHand: { $lt: 0 } },
      { reserved: { $lt: 0 } },
      { $expr: { $gt: ["$reserved", "$onHand"] } },
    ],
  })
    .select("_id productVariantId warehouseId onHand reserved")
    .lean();

  const invalidInventorySamples = invalidInventories
    .slice(0, sampleLimit)
    .map((inv) => ({
      recordId: inv._id.toString(),
      currentStoredValue: {
        onHand: inv.onHand,
        reserved: inv.reserved,
        available: (inv.onHand || 0) - (inv.reserved || 0),
      },
      expectedValue: "onHand >= 0, reserved >= 0, onHand >= reserved",
      authoritativeSource: "Inventory ledger invariants",
      proposedRemediation:
        "Flag records for physical warehouse cycle count. Do not auto-reset reserved counts while customer checkouts or unfulfilled orders exist.",
      isDeterministic: false,
      prerequisites:
        "Warehouse manager audit, open order unfulfilled reservation verification.",
    }));

  categories.push({
    ruleId: "INVALID_INVENTORY_FIELDS",
    ruleName: "Invalid inventory numbers or negative available quantities",
    detectionRule:
      "Inventory documents with onHand < 0, reserved < 0, or reserved > onHand (negative available stock).",
    authoritativeSource: "Inventory ledger invariants",
    affectedRecordCount: invalidInventories.length,
    sampleIdentifiers: invalidInventorySamples,
    proposedReconciliationAction:
      "Flag records for physical warehouse cycle count. Do not auto-reset reserved counts while customer checkouts or unfulfilled orders exist.",
    classification: "AMBIGUOUS",
    prerequisites:
      "Warehouse manager audit, open order unfulfilled reservation verification.",
  });

  // =========================================================================
  // RULE 9: Orphan variants and orphan inventory records
  // =========================================================================
  const allInventories = await Inventory.find({ deletedAt: null })
    .select("_id productVariantId")
    .lean();
  const allVariantIdSet = new Set(allVariants.map((v) => v._id.toString()));

  const orphanInventorySamples = [];
  let orphanInventoryCount = 0;
  for (const inv of allInventories) {
    if (!allVariantIdSet.has(inv.productVariantId?.toString())) {
      orphanInventoryCount++;
      if (orphanInventorySamples.length < sampleLimit) {
        orphanInventorySamples.push({
          recordId: inv._id.toString(),
          currentStoredValue: {
            missingVariantId: inv.productVariantId?.toString(),
            variantExists: false,
          },
          expectedValue: "Inventory record must reference existing ProductVariant",
          authoritativeSource: "ProductVariant collection",
          proposedRemediation:
            "Verify historical ledger entries; soft-delete orphan inventory documents after audit confirmation.",
          isDeterministic: false,
          prerequisites:
            "Ledger audit trail verification, historical order line items reference check.",
        });
      }
    }
  }

  categories.push({
    ruleId: "ORPHAN_CATALOG_RECORDS",
    ruleName: "Orphan inventory records referencing missing product variants",
    detectionRule:
      "Inventory records whose productVariantId does not correspond to any active or soft-deleted ProductVariant.",
    authoritativeSource: "ProductVariant collection",
    affectedRecordCount: orphanInventoryCount,
    sampleIdentifiers: orphanInventorySamples,
    proposedReconciliationAction:
      "Verify historical ledger entries; soft-delete orphan inventory documents after audit confirmation.",
    classification: "AMBIGUOUS",
    prerequisites:
      "Ledger audit trail verification, historical order line items reference check.",
  });

  // =========================================================================
  // RULE 10: Soft-deleted records whose SKU reuse behavior is inconsistent
  // =========================================================================
  const softDeletedProducts = await Product.find({
    deletedAt: { $ne: null },
  })
    .select("_id sku deletedAt")
    .lean();

  const softDeletedVariants = await ProductVariant.find({
    deletedAt: { $ne: null },
  })
    .select("_id sku deletedAt")
    .lean();

  const activeSkuSet = new Set([
    ...activeProducts.map((p) => normalizeSku(p.sku)),
    ...activeVariantsList.map((v) => normalizeSku(v.sku)),
  ]);

  const softDeletedCollisions = [];
  let softDeletedCollisionCount = 0;

  for (const p of softDeletedProducts) {
    const uSku = normalizeSku(p.sku);
    if (activeSkuSet.has(uSku)) {
      softDeletedCollisionCount++;
      if (softDeletedCollisions.length < sampleLimit) {
        softDeletedCollisions.push({
          recordId: p._id.toString(),
          currentStoredValue: {
            sku: uSku,
            deletedAt: p.deletedAt,
            reusedByActiveCatalog: true,
          },
          expectedValue: "Unique active SKU upon restore",
          authoritativeSource: "Active catalog entities in Product and ProductVariant",
          proposedRemediation:
            "No mutation required. Document that restoring these soft-deleted products will block until a new unique SKU is supplied.",
          isDeterministic: true,
          prerequisites:
            "Restore operation SKU conflict guard enforcement in productService.restoreProduct.",
        });
      }
    }
  }

  for (const v of softDeletedVariants) {
    const uSku = normalizeSku(v.sku);
    if (activeSkuSet.has(uSku)) {
      softDeletedCollisionCount++;
      if (softDeletedCollisions.length < sampleLimit) {
        softDeletedCollisions.push({
          recordId: v._id.toString(),
          currentStoredValue: {
            sku: uSku,
            deletedAt: v.deletedAt,
            reusedByActiveCatalog: true,
          },
          expectedValue: "Unique active SKU upon restore",
          authoritativeSource: "Active catalog entities in Product and ProductVariant",
          proposedRemediation:
            "No mutation required. Document that restoring these soft-deleted variants will block until a new unique SKU is supplied.",
          isDeterministic: true,
          prerequisites:
            "Restore operation SKU conflict guard enforcement in productVariantService.restoreProductVariant.",
        });
      }
    }
  }

  categories.push({
    ruleId: "INCONSISTENT_SOFT_DELETED_SKU",
    ruleName: "Soft-deleted SKUs re-allocated to active products",
    detectionRule:
      "Soft-deleted Product or ProductVariant whose SKU matches an active catalog entity.",
    authoritativeSource: "Active catalog entities in Product and ProductVariant",
    affectedRecordCount: softDeletedCollisionCount,
    sampleIdentifiers: softDeletedCollisions,
    proposedReconciliationAction:
      "No mutation required. Document that restoring these soft-deleted products will block until a new unique SKU is supplied.",
    classification: "DETERMINISTIC",
    prerequisites:
      "Restore operation SKU conflict guard enforcement in productService.restoreProduct.",
  });

  // =========================================================================
  // RULE 11: Parent prices that disagree with active variant minimum prices
  // =========================================================================
  const priceMismatchSamples = [];
  let priceMismatchCount = 0;

  for (const p of variableProducts) {
    const vList = variantsByProduct.get(p._id.toString()) || [];
    const activeVList = vList.filter((v) => v.isActive !== false);
    if (activeVList.length > 0) {
      const prices = activeVList
        .map((v) => Number(v.price))
        .filter((pr) => !isNaN(pr) && pr >= 0);
      if (prices.length > 0) {
        const minVariantPrice = Math.min(...prices);
        const parentPrice = Number(p.price?.toString() || 0);
        if (Math.abs(parentPrice - minVariantPrice) > 0.001) {
          priceMismatchCount++;
          if (priceMismatchSamples.length < sampleLimit) {
            priceMismatchSamples.push({
              recordId: p._id.toString(),
              currentStoredValue: { parentPrice, sku: p.sku },
              expectedValue: { expectedMinPrice: minVariantPrice, sku: p.sku },
              authoritativeSource: "Active ProductVariant prices for variable product",
              proposedRemediation:
                "Synchronize parent price to the minimum active variant price.",
              isDeterministic: true,
              prerequisites:
                "Product update transaction with audit logging.",
            });
          }
        }
      }
    }
  }

  categories.push({
    ruleId: "PARENT_PRICE_MISMATCH",
    ruleName: "Variable product parent prices disagreeing with active variant minimum price",
    detectionRule:
      "Variable product where parent price !== min(activeVariants.price).",
    authoritativeSource: "Active ProductVariant prices for variable product",
    affectedRecordCount: priceMismatchCount,
    sampleIdentifiers: priceMismatchSamples,
    proposedReconciliationAction:
      "Synchronize parent price to the minimum active variant price.",
    classification: "DETERMINISTIC",
    prerequisites:
      "Product update transaction with audit logging.",
  });

  // =========================================================================
  // RULE 12: Legacy attribute formats that cannot be normalized safely
  // =========================================================================
  const malformedAttrSamples = [];
  let malformedAttrCount = 0;

  for (const v of allVariants) {
    if (v.attributes) {
      try {
        const norm = normalizeVariantAttributes(v.attributes);
        if (typeof norm !== "object" || norm === null) {
          malformedAttrCount++;
          if (malformedAttrSamples.length < sampleLimit) {
            malformedAttrSamples.push({
              recordId: v._id.toString(),
              currentStoredValue: { rawAttributes: v.attributes },
              expectedValue: "Valid key-value attribute map",
              authoritativeSource: "Attribute normalization specification",
              proposedRemediation:
                "Quarantine records and prompt merchant to re-specify variant attributes in Admin/Vendor portal.",
              isDeterministic: false,
              prerequisites:
                "Merchant communication, schema validation.",
            });
          }
        }
      } catch (err) {
        malformedAttrCount++;
        if (malformedAttrSamples.length < sampleLimit) {
          malformedAttrSamples.push({
            recordId: v._id.toString(),
            currentStoredValue: { rawAttributes: v.attributes, error: err.message },
            expectedValue: "Valid key-value attribute map",
            authoritativeSource: "Attribute normalization specification",
            proposedRemediation:
              "Quarantine records and prompt merchant to re-specify variant attributes in Admin/Vendor portal.",
            isDeterministic: false,
            prerequisites:
              "Merchant communication, schema validation.",
          });
        }
      }
    }
  }

  categories.push({
    ruleId: "MALFORMED_VARIANT_ATTRIBUTES",
    ruleName: "Legacy variant attribute structures that cannot be normalized safely",
    detectionRule:
      "ProductVariant documents whose attributes property fails normalization to key-value Map.",
    authoritativeSource: "Attribute normalization specification",
    affectedRecordCount: malformedAttrCount,
    sampleIdentifiers: malformedAttrSamples,
    proposedReconciliationAction:
      "Quarantine records and prompt merchant to re-specify variant attributes in Admin/Vendor portal.",
    classification: "AMBIGUOUS",
    prerequisites:
      "Merchant communication, schema validation.",
  });

  const totalDiscrepancies = categories.reduce(
    (sum, cat) => sum + cat.affectedRecordCount,
    0
  );

  const ambiguousCount = categories
    .filter((c) => c.classification !== "DETERMINISTIC")
    .reduce((sum, cat) => sum + cat.affectedRecordCount, 0);

  return {
    timestamp,
    mode: "DRY_RUN_READ_ONLY",
    recordsExamined: {
      totalProducts,
      totalVariants,
      totalInventories,
    },
    discrepanciesFound: totalDiscrepancies,
    categories,
    skippedAmbiguousCount: ambiguousCount,
    summary: {
      deterministicCount: totalDiscrepancies - ambiguousCount,
      ambiguousCount,
      destructiveCount: categories
        .filter((c) => c.classification === "POTENTIALLY_DESTRUCTIVE")
        .reduce((sum, cat) => sum + cat.affectedRecordCount, 0),
    },
  };
};

module.exports = {
  runDryRun,
};
