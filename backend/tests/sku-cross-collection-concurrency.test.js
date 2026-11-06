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
const { ROLES } = require("../src/constants/auth.constants");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_sku_concurrency_test?")
  : "mongodb://127.0.0.1:27017/buybox_sku_concurrency_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Phase 2E — Cross-Collection SKU Concurrency & Registry Integrity", () => {
  let testUser, testVendor, testCategory, testBrand, testWarehouse;
  let adminActor;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    // Ensure SkuRegistry unique index is synced in MongoDB
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

    testUser = await User.create({
      firstName: "Catalog",
      lastName: "Admin",
      email: `admin_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`,
      password: "Password123!",
      role: ROLES.ADMIN,
      isActive: true,
    });

    testVendor = await Vendor.create({
      userId: testUser._id,
      businessName: "Test Store",
      businessSlug: `store-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      email: `vendor_${Date.now()}@test.com`,
      onboardingStatus: "approved",
      isActive: true,
    });

    testCategory = await Category.create({
      name: "Electronics",
      slug: `electronics-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      isActive: true,
    });

    testBrand = await Brand.create({
      name: "TechBrand",
      slug: `techbrand-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      isActive: true,
    });

    testWarehouse = await Warehouse.create({
      name: "Primary Hub",
      code: `WH-${Date.now().toString().slice(-4)}`,
      address: {
        addressLine1: "123 Hub St",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "IN",
      },
      isActive: true,
    });

    adminActor = {
      id: testUser._id.toString(),
      _id: testUser._id,
      role: ROLES.ADMIN,
    };
  });

  it("1. SkuRegistry enforces atomic uniqueness: concurrent conflicting SKU creation cannot both commit", async () => {
    const conflictingSku = `RACE-SKU-${Date.now()}`;

    // Create an existing parent product that will host a variant
    const existingParent = await productService.createProduct({
      data: {
        name: "Existing Base Product",
        slug: `base-prod-${Date.now()}`,
        sku: `BASE-SKU-${Date.now()}`,
        productType: "variable",
        categoryId: testCategory._id,
        brandId: testBrand._id,
        vendorId: testVendor._id,
        price: 999,
        warehouseId: testWarehouse._id,
      },
      userId: testUser._id.toString(),
      actor: adminActor,
    });

    // Operation A: Create a simple Product with `conflictingSku`
    const opA = productService.createProduct({
      data: {
        name: "Conflicting Product A",
        slug: `conflicting-a-${Date.now()}`,
        sku: conflictingSku,
        productType: "simple",
        categoryId: testCategory._id,
        brandId: testBrand._id,
        vendorId: testVendor._id,
        price: 500,
        warehouseId: testWarehouse._id,
      },
      userId: testUser._id.toString(),
      actor: adminActor,
    });

    // Operation B: Create a ProductVariant on `existingParent` with `conflictingSku`
    const opB = productVariantService.createProductVariant({
      data: {
        productId: existingParent._id,
        sku: conflictingSku,
        name: "Conflicting Variant B",
        price: 550,
        attributes: { color: "Blue" },
        warehouseId: testWarehouse._id,
      },
      actor: adminActor,
    });

    // Fire both operations simultaneously into the event loop
    const results = await Promise.allSettled([opA, opB]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Exactly one must succeed, exactly one must fail
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    // The failure must be a 409 conflict
    expect(rejected[0].reason.statusCode).toBe(409);
    expect([
      "PRODUCT_SKU_ALREADY_EXISTS",
      "VARIANT_SKU_ALREADY_EXISTS",
      "SKU_ALREADY_EXISTS",
    ]).toContain(rejected[0].reason.code);

    // SkuRegistry must contain exactly ONE active record for this SKU
    const activeRegistryDocs = await SkuRegistry.find({
      sku: conflictingSku,
      deletedAt: null,
    });
    expect(activeRegistryDocs.length).toBe(1);
  });

  it("2. Canonical Simple Product Exception: parent product and canonical default variant share the SKU safely", async () => {
    const simpleSku = `CANONICAL-${Date.now()}`;

    const simpleProduct = await productService.createProduct({
      data: {
        name: "Simple Canonical Product",
        slug: `canonical-${Date.now()}`,
        sku: simpleSku,
        productType: "simple",
        categoryId: testCategory._id,
        brandId: testBrand._id,
        vendorId: testVendor._id,
        price: 799,
        stockQuantity: 10,
        warehouseId: testWarehouse._id,
      },
      userId: testUser._id.toString(),
      actor: adminActor,
    });

    const defaultVariant = await ProductVariant.findOne({
      productId: simpleProduct._id,
      isDefault: true,
      deletedAt: null,
    });

    expect(defaultVariant).toBeDefined();
    expect(defaultVariant.sku).toBe(simpleSku);

    // SkuRegistry records this canonical shared mapping without conflict
    const regDocs = await SkuRegistry.find({
      sku: simpleSku,
      deletedAt: null,
    });
    expect(regDocs.length).toBe(1);
    expect(regDocs[0].isDefault).toBe(true);
    expect(regDocs[0].productId.toString()).toBe(simpleProduct._id.toString());
    expect(regDocs[0].variantId.toString()).toBe(defaultVariant._id.toString());
  });

  it("3. Unchanged SKU updates are preserved without self-collision errors", async () => {
    const sku = `UNCHANGED-${Date.now()}`;

    const product = await productService.createProduct({
      data: {
        name: "Unchanged SKU Product",
        slug: `unchanged-${Date.now()}`,
        sku,
        productType: "simple",
        categoryId: testCategory._id,
        brandId: testBrand._id,
        vendorId: testVendor._id,
        price: 299,
        warehouseId: testWarehouse._id,
      },
      userId: testUser._id.toString(),
      actor: adminActor,
    });

    // Updating name and description while passing identical SKU
    const updated = await productService.updateProduct({
      id: product._id.toString(),
      data: {
        name: "Updated Product Name",
        sku,
        description: "New description",
      },
      actor: adminActor,
    });

    expect(updated.name).toBe("Updated Product Name");
    expect(updated.sku).toBe(sku);
  });

  it("4. Soft deletion releases SKU reservation and allows subsequent reuse", async () => {
    const reusableSku = `REUSE-${Date.now()}`;

    const product1 = await productService.createProduct({
      data: {
        name: "First Product",
        slug: `first-prod-${Date.now()}`,
        sku: reusableSku,
        productType: "simple",
        categoryId: testCategory._id,
        brandId: testBrand._id,
        vendorId: testVendor._id,
        price: 100,
        warehouseId: testWarehouse._id,
      },
      userId: testUser._id.toString(),
      actor: adminActor,
    });

    // Soft delete product1
    await productService.deleteProduct({
      id: product1._id.toString(),
      actor: adminActor,
    });

    // SkuRegistry should show soft-deleted (deletedAt !== null)
    const activeBefore = await SkuRegistry.findOne({
      sku: reusableSku,
      deletedAt: null,
    });
    expect(activeBefore).toBeNull();

    // Now product2 can safely reuse the same SKU
    const product2 = await productService.createProduct({
      data: {
        name: "Second Product Reusing SKU",
        slug: `second-prod-${Date.now()}`,
        sku: reusableSku,
        productType: "simple",
        categoryId: testCategory._id,
        brandId: testBrand._id,
        vendorId: testVendor._id,
        price: 150,
        warehouseId: testWarehouse._id,
      },
      userId: testUser._id.toString(),
      actor: adminActor,
    });

    expect(product2.sku).toBe(reusableSku);

    // If attempting to restore product1 while product2 is active, restore must be blocked
    await expect(
      productService.restoreProduct({
        id: product1._id.toString(),
        actor: adminActor,
      })
    ).rejects.toThrow("already in use");
  });

  it("5. Failed operations in transactions leave no orphan SkuRegistry records", async () => {
    const orphanTestSku = `ORPHAN-TEST-${Date.now()}`;

    // Attempting product creation with invalid category should fail
    const invalidCategoryId = new mongoose.Types.ObjectId();

    await expect(
      productService.createProduct({
        data: {
          name: "Failed Product",
          slug: `failed-prod-${Date.now()}`,
          sku: orphanTestSku,
          productType: "simple",
          categoryId: invalidCategoryId,
          brandId: testBrand._id,
          vendorId: testVendor._id,
          price: 100,
          warehouseId: testWarehouse._id,
        },
        userId: testUser._id.toString(),
        actor: adminActor,
      })
    ).rejects.toThrow();

    // Verify SkuRegistry has 0 records for orphanTestSku
    const registryEntry = await SkuRegistry.findOne({
      sku: orphanTestSku,
    });
    expect(registryEntry).toBeNull();
  });
});
