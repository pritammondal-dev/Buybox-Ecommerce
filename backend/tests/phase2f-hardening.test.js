const mongoose = require("mongoose");
const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const Category = require("../src/models/Category");
const Brand = require("../src/models/Brand");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Warehouse = require("../src/models/Warehouse");
const Inventory = require("../src/models/Inventory");
const SkuRegistry = require("../src/models/SkuRegistry");
const productService = require("../src/services/product.service");
const productVariantService = require("../src/services/product-variant.service");
const skuRegistryService = require("../src/services/sku-registry.service");
const inventoryService = require("../src/services/inventory.service");
const reconciliationService = require("../src/services/catalog-reconciliation.service");
const { ROLES } = require("../src/constants/auth.constants");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_phase2f_hardening_test?")
  : "mongodb://127.0.0.1:27017/buybox_phase2f_hardening_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Phase 2F — SKU Registry, Inventory Reconciliation & Catalog Lifecycle Hardening", () => {
  let adminUser, vendorUserA, vendorUserB, customerUser;
  let vendorA, vendorB;
  let testCategory, testBrand;
  let activeWarehouse1, activeWarehouse2, inactiveWarehouse;
  let adminActor, vendorActorA, vendorActorB, customerActor;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }
    await SkuRegistry.syncIndexes();
    await Product.syncIndexes();
    await ProductVariant.syncIndexes();
  });

  afterAll(async () => {
    await SkuRegistry.deleteMany({});
    await Inventory.deleteMany({});
    await ProductVariant.deleteMany({});
    await Product.deleteMany({});
    await Warehouse.deleteMany({});
    await Category.deleteMany({});
    await Brand.deleteMany({});
    await Vendor.deleteMany({});
    await User.deleteMany({});
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await SkuRegistry.deleteMany({});
    await Inventory.deleteMany({});
    await ProductVariant.deleteMany({});
    await Product.deleteMany({});
    await Warehouse.deleteMany({});
    await Category.deleteMany({});
    await Brand.deleteMany({});
    await Vendor.deleteMany({});
    await User.deleteMany({});

    // 1. Users & Roles
    adminUser = await User.create({
      firstName: "Super",
      lastName: "Admin",
      email: `admin_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`,
      password: "Password123!",
      role: ROLES.ADMIN,
      isActive: true,
    });
    adminActor = { id: adminUser._id.toString(), _id: adminUser._id, role: ROLES.ADMIN };

    vendorUserA = await User.create({
      firstName: "Vendor",
      lastName: "Alpha",
      email: `vendor_a_${Date.now()}@test.com`,
      password: "Password123!",
      role: ROLES.VENDOR,
      isActive: true,
    });
    vendorA = await Vendor.create({
      userId: vendorUserA._id,
      businessName: "Vendor Alpha Store",
      businessSlug: `store-alpha-${Date.now()}`,
      email: vendorUserA.email,
      onboardingStatus: "approved",
      isActive: true,
    });
    vendorActorA = { id: vendorUserA._id.toString(), _id: vendorUserA._id, role: ROLES.VENDOR };

    vendorUserB = await User.create({
      firstName: "Vendor",
      lastName: "Beta",
      email: `vendor_b_${Date.now()}@test.com`,
      password: "Password123!",
      role: ROLES.VENDOR,
      isActive: true,
    });
    vendorB = await Vendor.create({
      userId: vendorUserB._id,
      businessName: "Vendor Beta Store",
      businessSlug: `store-beta-${Date.now()}`,
      email: vendorUserB.email,
      onboardingStatus: "approved",
      isActive: true,
    });
    vendorActorB = { id: vendorUserB._id.toString(), _id: vendorUserB._id, role: ROLES.VENDOR };

    customerUser = await User.create({
      firstName: "Jane",
      lastName: "Customer",
      email: `customer_${Date.now()}@test.com`,
      password: "Password123!",
      role: ROLES.CUSTOMER,
      isActive: true,
    });
    customerActor = { id: customerUser._id.toString(), _id: customerUser._id, role: ROLES.CUSTOMER };

    // 2. Taxonomy
    testCategory = await Category.create({
      name: "Hardware",
      slug: `hardware-${Date.now()}`,
      isActive: true,
    });

    testBrand = await Brand.create({
      name: "ForgeTech",
      slug: `forgetech-${Date.now()}`,
      isActive: true,
    });

    // 3. Multi-Warehouse Setup (Active & Inactive)
    activeWarehouse1 = await Warehouse.create({
      name: "East Hub",
      code: `WH-EAST-${Date.now().toString().slice(-4)}`,
      address: { addressLine1: "1 East Way", city: "Kolkata", state: "West Bengal", postalCode: "700001", country: "IN" },
      isActive: true,
    });

    activeWarehouse2 = await Warehouse.create({
      name: "West Hub",
      code: `WH-WEST-${Date.now().toString().slice(-4)}`,
      address: { addressLine1: "2 West Way", city: "Mumbai", state: "Maharashtra", postalCode: "400001", country: "IN" },
      isActive: true,
    });

    inactiveWarehouse = await Warehouse.create({
      name: "Decommissioned Facility",
      code: `WH-INACT-${Date.now().toString().slice(-4)}`,
      address: { addressLine1: "99 Old Rd", city: "Pune", state: "Maharashtra", postalCode: "411001", country: "IN" },
      isActive: false, // INACTIVE!
    });
  });

  // ---------------------------------------------------------------------------
  // 1. SKU CREATION & UPDATE CONCURRENCY
  // ---------------------------------------------------------------------------
  it("1. Concurrent conflicting SKU updates cannot both commit", async () => {
    const targetSku = `CONCURRENT-TARGET-${Date.now()}`;

    // Create Product A with initial SKU A
    const prodA = await productService.createProduct({
      data: {
        name: "Product A",
        slug: `prod-a-${Date.now()}`,
        sku: `SKU-A-${Date.now()}`,
        productType: "simple",
        categoryId: testCategory._id,
        brandId: testBrand._id,
        vendorId: vendorA._id,
        price: 100,
        warehouseId: activeWarehouse1._id,
      },
      userId: vendorUserA._id.toString(),
      actor: vendorActorA,
    });

    // Create Product B with initial SKU B
    const prodB = await productService.createProduct({
      data: {
        name: "Product B",
        slug: `prod-b-${Date.now()}`,
        sku: `SKU-B-${Date.now()}`,
        productType: "simple",
        categoryId: testCategory._id,
        brandId: testBrand._id,
        vendorId: vendorA._id,
        price: 200,
        warehouseId: activeWarehouse1._id,
      },
      userId: vendorUserA._id.toString(),
      actor: vendorActorA,
    });

    // Both attempt to update their SKU to targetSku simultaneously
    const opA = productService.updateProduct({
      id: prodA._id.toString(),
      data: { sku: targetSku },
      actor: vendorActorA,
    });

    const opB = productService.updateProduct({
      id: prodB._id.toString(),
      data: { sku: targetSku },
      actor: vendorActorA,
    });

    const results = await Promise.allSettled([opA, opB]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Exactly one commits, exactly one rejected with 409
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect(rejected[0].reason.statusCode).toBe(409);

    // Exactly one active record in SkuRegistry
    const registryDocs = await SkuRegistry.find({ sku: targetSku, deletedAt: null });
    expect(registryDocs.length).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // 2. CANONICAL DEFAULT-VARIANT SKU SHARING
  // ---------------------------------------------------------------------------
  it("2. Canonical default variant shares parent SKU, while non-default variant is rejected", async () => {
    const parentSku = `CANONICAL-TEST-${Date.now()}`;

    const simpleProduct = await productService.createProduct({
      data: {
        name: "Simple Canonical Item",
        slug: `simple-item-${Date.now()}`,
        sku: parentSku,
        productType: "simple",
        categoryId: testCategory._id,
        brandId: testBrand._id,
        vendorId: vendorA._id,
        price: 500,
        warehouseId: activeWarehouse1._id,
      },
      userId: vendorUserA._id.toString(),
      actor: vendorActorA,
    });

    // Default variant exists and shares the parent SKU
    const defaultVar = await ProductVariant.findOne({ productId: simpleProduct._id, isDefault: true });
    expect(defaultVar).toBeDefined();
    expect(defaultVar.sku).toBe(parentSku);

    // An attempt by a different entity to create another variant with the same SKU must be rejected
    await expect(
      productVariantService.createProductVariant({
        data: {
          productId: simpleProduct._id,
          sku: parentSku,
          name: "Conflicting Extra Variant",
          price: 500,
          warehouseId: activeWarehouse1._id,
        },
        actor: vendorActorA,
      })
    ).rejects.toThrow();
  });

  // ---------------------------------------------------------------------------
  // 3. REGISTRY RELEASE AND RESTORATION GUARDS
  // ---------------------------------------------------------------------------
  it("3. Soft deletion releases SKU, allows reuse, and blocks restoration if SKU is claimed by another entity", async () => {
    const sharedSku = `REUSE-LIFECYCLE-${Date.now()}`;

    const originalProduct = await productService.createProduct({
      data: {
        name: "Original Product",
        slug: `orig-prod-${Date.now()}`,
        sku: sharedSku,
        productType: "simple",
        categoryId: testCategory._id,
        brandId: testBrand._id,
        vendorId: vendorA._id,
        price: 150,
        warehouseId: activeWarehouse1._id,
      },
      userId: vendorUserA._id.toString(),
      actor: vendorActorA,
    });

    // Soft delete original
    await productService.deleteProduct({
      id: originalProduct._id.toString(),
      actor: vendorActorA,
    });

    // SkuRegistry entry for original is soft-deleted
    const activeReg = await SkuRegistry.findOne({ sku: sharedSku, deletedAt: null });
    expect(activeReg).toBeNull();

    // New product claims the released SKU
    const newProduct = await productService.createProduct({
      data: {
        name: "New Product Claiming SKU",
        slug: `new-prod-${Date.now()}`,
        sku: sharedSku,
        productType: "simple",
        categoryId: testCategory._id,
        brandId: testBrand._id,
        vendorId: vendorB._id,
        price: 250,
        warehouseId: activeWarehouse1._id,
      },
      userId: vendorUserB._id.toString(),
      actor: vendorActorB,
    });
    expect(newProduct.sku).toBe(sharedSku);

    // Attempting to restore originalProduct while newProduct is active must fail with 409
    await expect(
      productService.restoreProduct({
        id: originalProduct._id.toString(),
        actor: vendorActorA,
      })
    ).rejects.toThrow("already in use by another active product");
  });

  // ---------------------------------------------------------------------------
  // 4. LEGACY RECORDS WITHOUT REGISTRY ENTRIES
  // ---------------------------------------------------------------------------
  it("4. Legacy records without SkuRegistry entries remain protected by fallback checks and seed registry upon restore", async () => {
    const legacySku = `LEGACY-UNREGISTERED-${Date.now()}`;

    // Seed a legacy product directly without SkuRegistry entry
    const legacyProduct = await Product.create({
      name: "Legacy Product",
      slug: `legacy-item-${Date.now()}`,
      sku: legacySku,
      productType: "simple",
      categoryId: testCategory._id,
      brandId: testBrand._id,
      vendorId: vendorA._id,
      price: 99,
      status: "draft",
      deletedAt: new Date(), // Soft deleted initially
    });

    // SkuRegistry has 0 records for legacySku
    expect(await SkuRegistry.countDocuments({ sku: legacySku })).toBe(0);

    // If another product is active with legacySku, restore must be blocked by fallback checks
    const activeCollidingProduct = await Product.create({
      name: "Active Competitor",
      slug: `competitor-${Date.now()}`,
      sku: legacySku,
      productType: "simple",
      categoryId: testCategory._id,
      brandId: testBrand._id,
      vendorId: vendorB._id,
      price: 120,
      status: "active",
      deletedAt: null,
    });

    await expect(
      productService.restoreProduct({
        id: legacyProduct._id.toString(),
        actor: vendorActorA,
      })
    ).rejects.toThrow("already in use");

    // Remove the colliding product
    await Product.deleteOne({ _id: activeCollidingProduct._id });

    // Now restore legacy product: it must succeed and automatically seed SkuRegistry!
    await productService.restoreProduct({
      id: legacyProduct._id.toString(),
      actor: vendorActorA,
    });

    const newlySeededReg = await SkuRegistry.findOne({
      sku: legacySku,
      productId: legacyProduct._id,
      deletedAt: null,
    });
    expect(newlySeededReg).toBeDefined();
    expect(newlySeededReg.sku).toBe(legacySku);
  });

  // ---------------------------------------------------------------------------
  // 5. TRANSACTION ROLLBACK AND RETRY SAFETY
  // ---------------------------------------------------------------------------
  it("5. Failed operations in transactions leave no orphan SkuRegistry or inventory records", async () => {
    const rollbackSku = `ROLLBACK-TEST-${Date.now()}`;

    // Attempting product creation with non-existent brand should trigger rollback
    const invalidBrandId = new mongoose.Types.ObjectId();

    await expect(
      productService.createProduct({
        data: {
          name: "Doomed Product",
          slug: `doomed-${Date.now()}`,
          sku: rollbackSku,
          productType: "simple",
          categoryId: testCategory._id,
          brandId: invalidBrandId,
          vendorId: vendorA._id,
          price: 50,
          warehouseId: activeWarehouse1._id,
        },
        userId: vendorUserA._id.toString(),
        actor: vendorActorA,
      })
    ).rejects.toThrow();

    // Verify SkuRegistry and Product have zero records for rollbackSku
    expect(await SkuRegistry.countDocuments({ sku: rollbackSku })).toBe(0);
    expect(await Product.countDocuments({ sku: rollbackSku })).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // 6. MULTI-WAREHOUSE STOCK AGGREGATION & INVENTORY MIRROR
  // ---------------------------------------------------------------------------
  it("6. Multi-warehouse aggregation sums available stock max(0, onHand - reserved) across active warehouses", async () => {
    const variantProd = await productService.createProduct({
      data: {
        name: "Multi Warehouse Product",
        slug: `multi-wh-${Date.now()}`,
        sku: `MULTI-WH-${Date.now()}`,
        productType: "simple",
        categoryId: testCategory._id,
        brandId: testBrand._id,
        vendorId: vendorA._id,
        price: 100,
        warehouseId: activeWarehouse1._id,
      },
      userId: vendorUserA._id.toString(),
      actor: vendorActorA,
    });

    const variant = await ProductVariant.findOne({ productId: variantProd._id, isDefault: true });

    // Inventory in Active Warehouse 1: onHand = 20, reserved = 5 -> available = 15
    await Inventory.updateOne(
      { productVariantId: variant._id, warehouseId: activeWarehouse1._id },
      { onHand: 20, reserved: 5 }
    );

    // Inventory in Active Warehouse 2: onHand = 30, reserved = 10 -> available = 20
    await Inventory.create({
      productVariantId: variant._id,
      warehouseId: activeWarehouse2._id,
      onHand: 30,
      reserved: 10,
      lowStockThreshold: 5,
    });

    // Inventory in Inactive Warehouse: onHand = 100, reserved = 0 (MUST BE EXCLUDED)
    await Inventory.create({
      productVariantId: variant._id,
      warehouseId: inactiveWarehouse._id,
      onHand: 100,
      reserved: 0,
      lowStockThreshold: 5,
    });

    // Run authoritative calculation
    const stockResult = await inventoryService.calculateAuthoritativeStock(variant._id);

    // Total available = 15 (WH1) + 20 (WH2) = 35. (WH-Inactive 100 is ignored!)
    expect(stockResult.totalAvailable).toBe(35);
    expect(stockResult.totalOnHand).toBe(50);
    expect(stockResult.totalReserved).toBe(15);
    expect(stockResult.warehouseCount).toBe(2);

    // Sync mirror and verify ProductVariant.stockQuantity reflects 35
    await inventoryService.syncVariantStockMirror(variant._id);
    const updatedVar = await ProductVariant.findById(variant._id);
    expect(updatedVar.stockQuantity).toBe(35);
    expect(updatedVar.stockStatus).toBe("in_stock");
  });

  // ---------------------------------------------------------------------------
  // 7. PRODUCT AND VARIANT DELETION GUARDS (RESERVATIONS)
  // ---------------------------------------------------------------------------
  it("7. Cannot delete product or variant with active inventory reservations", async () => {
    const prod = await productService.createProduct({
      data: {
        name: "Reserved Stock Product",
        slug: `reserved-stock-${Date.now()}`,
        sku: `RES-PROD-${Date.now()}`,
        productType: "simple",
        categoryId: testCategory._id,
        brandId: testBrand._id,
        vendorId: vendorA._id,
        price: 300,
        warehouseId: activeWarehouse1._id,
      },
      userId: vendorUserA._id.toString(),
      actor: vendorActorA,
    });

    const variant = await ProductVariant.findOne({ productId: prod._id, isDefault: true });

    // Place an active reservation on variant
    await Inventory.updateOne(
      { productVariantId: variant._id },
      { onHand: 10, reserved: 2 }
    );

    // Attempting to delete variant directly must throw 409
    await expect(
      productVariantService.deleteProductVariant({
        id: variant._id.toString(),
        actor: vendorActorA,
      })
    ).rejects.toThrow("Cannot delete variant with active inventory reservations");

    // Attempting to delete parent product must throw 409
    await expect(
      productService.deleteProduct({
        id: prod._id.toString(),
        actor: vendorActorA,
      })
    ).rejects.toThrow("Cannot delete product with active inventory reservations");

    // Clear reservations
    await Inventory.updateOne({ productVariantId: variant._id }, { reserved: 0 });

    // Deletion should now succeed cleanly
    const deleted = await productService.deleteProduct({
      id: prod._id.toString(),
      actor: vendorActorA,
    });
    expect(deleted.deletedAt).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // 8. INDIVIDUAL VARIANT RESTORATION & PARENT GUARDS
  // ---------------------------------------------------------------------------
  it("8. Individual variant restoration succeeds when valid, and is blocked if parent product is deleted", async () => {
    const varParent = await productService.createProduct({
      data: {
        name: "Variable Clothing Item",
        slug: `var-clothing-${Date.now()}`,
        sku: `VAR-CLOTH-${Date.now()}`,
        productType: "variable",
        categoryId: testCategory._id,
        brandId: testBrand._id,
        vendorId: vendorA._id,
        price: 700,
        warehouseId: activeWarehouse1._id,
      },
      userId: vendorUserA._id.toString(),
      actor: vendorActorA,
    });

    const vBlue = await productVariantService.createProductVariant({
      data: {
        productId: varParent._id,
        sku: `CLOTH-BLUE-${Date.now()}`,
        name: "Blue Variant",
        price: 750,
        attributes: { color: "Blue" },
        warehouseId: activeWarehouse1._id,
      },
      actor: vendorActorA,
    });

    // 1. Delete the variant while parent is active
    await productVariantService.deleteProductVariant({
      id: vBlue._id.toString(),
      actor: vendorActorA,
    });

    let checkV = await ProductVariant.findById(vBlue._id);
    expect(checkV.deletedAt).toBeDefined();

    // 2. Restoring vBlue while parent is active must succeed cleanly!
    const restoredV = await productVariantService.restoreProductVariant({
      id: vBlue._id.toString(),
      actor: vendorActorA,
    });
    expect(restoredV.deletedAt).toBeNull();
    expect(restoredV.isActive).toBe(true);

    // 3. Delete vBlue again
    await productVariantService.deleteProductVariant({
      id: vBlue._id.toString(),
      actor: vendorActorA,
    });

    // 4. Soft delete the parent product
    await productService.deleteProduct({
      id: varParent._id.toString(),
      actor: vendorActorA,
    });

    // 5. Attempting to restore vBlue while parent is deleted must fail
    await expect(
      productVariantService.restoreProductVariant({
        id: vBlue._id.toString(),
        actor: vendorActorA,
      })
    ).rejects.toThrow("parent product is deleted");
  });

  // ---------------------------------------------------------------------------
  // 9. BULK OPERATIONS FAILURE ISOLATION (ATOMICITY PER ITEM)
  // ---------------------------------------------------------------------------
  it("9. Admin bulk operations isolate item failures without leaving partial states", async () => {
    const prodValid = await productService.createProduct({
      data: {
        name: "Bulk Item 1 Valid",
        slug: `bulk-valid-${Date.now()}`,
        sku: `BULK-1-${Date.now()}`,
        productType: "simple",
        categoryId: testCategory._id,
        brandId: testBrand._id,
        vendorId: vendorA._id,
        price: 100,
        warehouseId: activeWarehouse1._id,
      },
      userId: adminUser._id.toString(),
      actor: adminActor,
    });

    const prodWithReservation = await productService.createProduct({
      data: {
        name: "Bulk Item 2 Reserved",
        slug: `bulk-reserved-${Date.now()}`,
        sku: `BULK-2-${Date.now()}`,
        productType: "simple",
        categoryId: testCategory._id,
        brandId: testBrand._id,
        vendorId: vendorA._id,
        price: 200,
        warehouseId: activeWarehouse1._id,
      },
      userId: adminUser._id.toString(),
      actor: adminActor,
    });

    const variant2 = await ProductVariant.findOne({ productId: prodWithReservation._id });
    await Inventory.updateOne({ productVariantId: variant2._id }, { onHand: 10, reserved: 4 });

    // Run bulk delete on both
    const bulkResult = await productService.adminBulkOperations({
      productIds: [prodValid._id.toString(), prodWithReservation._id.toString()],
      action: "delete",
      actor: adminActor,
    });

    expect(bulkResult.summary.total).toBe(2);
    expect(bulkResult.summary.succeeded).toBe(1);
    expect(bulkResult.summary.failed).toBe(1);

    // Item 1 succeeded and is soft-deleted
    const check1 = await Product.findById(prodValid._id);
    expect(check1.deletedAt).toBeDefined();

    // Item 2 failed and is untouched
    const check2 = await Product.findById(prodWithReservation._id);
    expect(check2.deletedAt).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // 10. AUTHORIZATION & VENDOR OWNERSHIP ISOLATION
  // ---------------------------------------------------------------------------
  it("10. Vendor ownership isolation prevents mutating another vendor's products or variants", async () => {
    const prodA = await productService.createProduct({
      data: {
        name: "Vendor Alpha Secret Product",
        slug: `alpha-secret-${Date.now()}`,
        sku: `ALPHA-SEC-${Date.now()}`,
        productType: "simple",
        categoryId: testCategory._id,
        brandId: testBrand._id,
        vendorId: vendorA._id,
        price: 999,
        warehouseId: activeWarehouse1._id,
      },
      userId: vendorUserA._id.toString(),
      actor: vendorActorA,
    });

    // Vendor Beta tries to update Product A
    await expect(
      productService.updateProduct({
        id: prodA._id.toString(),
        data: { name: "Hijacked by Beta" },
        actor: vendorActorB,
      })
    ).rejects.toThrow("You do not own this product");

    // Customer tries to delete Product A
    await expect(
      productService.deleteProduct({
        id: prodA._id.toString(),
        actor: customerActor,
      })
    ).rejects.toThrow("You do not have permission");
  });
});
