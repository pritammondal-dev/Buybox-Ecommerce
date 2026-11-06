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
const reconciliationService = require("../src/services/catalog-reconciliation.service");
const { ROLES } = require("../src/constants/auth.constants");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_reconciliation_test?")
  : "mongodb://127.0.0.1:27017/buybox_reconciliation_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Phase 2F — Controlled Legacy Catalog Reconciliation Dry-Run", () => {
  let testVendor, testCategory, testBrand, testWarehouse;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }
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

    const user = await User.create({
      firstName: "Merchant",
      lastName: "Tester",
      email: `merchant_${Date.now()}@test.com`,
      password: "Password123!",
      role: ROLES.VENDOR,
      isActive: true,
    });

    testVendor = await Vendor.create({
      userId: user._id,
      businessName: "Reconciliation Test Store",
      businessSlug: `store-recon-${Date.now()}`,
      email: user.email,
      onboardingStatus: "approved",
      isActive: true,
    });

    testCategory = await Category.create({
      name: "Sports",
      slug: `sports-${Date.now()}`,
      isActive: true,
    });

    testBrand = await Brand.create({
      name: "Athletics",
      slug: `athletics-${Date.now()}`,
      isActive: true,
    });

    testWarehouse = await Warehouse.create({
      name: "Recon WH",
      code: `WH-RC-${Date.now().toString().slice(-4)}`,
      address: {
        addressLine1: "1 Recon St",
        city: "Delhi",
        state: "Delhi",
        postalCode: "110001",
        country: "IN",
      },
      isActive: true,
    });
  });

  it("1. Accurately detects catalog discrepancies across integrity rules", async () => {
    // Discrepancy 1: Simple product WITHOUT canonical default variant
    const simpleNoDefault = await Product.create({
      name: "Legacy Simple Product Without Variant",
      slug: `legacy-simple-${Date.now()}`,
      sku: `LEG-SIMP-${Date.now()}`,
      productType: "simple",
      categoryId: testCategory._id,
      brandId: testBrand._id,
      vendorId: testVendor._id,
      price: 500,
      status: "active",
    });

    // Discrepancy 2: Variable product with parent price mismatching min(variants)
    const varMismatch = await Product.create({
      name: "Price Mismatch Sneaker",
      slug: `sneaker-mismatch-${Date.now()}`,
      sku: `SNEAK-${Date.now()}`,
      productType: "variable",
      categoryId: testCategory._id,
      brandId: testBrand._id,
      vendorId: testVendor._id,
      price: 2000, // Parent price is 2000
      status: "active",
    });

    const v1 = await ProductVariant.create({
      productId: varMismatch._id,
      sku: `SNEAK-V1-${Date.now()}`,
      name: "Size 8",
      price: 1500, // Min active price is 1500!
      isActive: true,
      stockQuantity: 10,
    });

    const v2 = await ProductVariant.create({
      productId: varMismatch._id,
      sku: `SNEAK-V2-${Date.now()}`,
      name: "Size 9",
      price: 1800,
      isActive: true,
      stockQuantity: 5,
    });

    // Discrepancy 3: Stale mirror stock quantity
    // v1 has stockQuantity: 10 in cache, but authoritative warehouse inventory has onHand: 4
    await Inventory.create({
      productVariantId: v1._id,
      warehouseId: testWarehouse._id,
      onHand: 4,
      reserved: 0,
      lowStockThreshold: 2,
    });

    // Discrepancy 4: Duplicate attribute combination on variable product
    const dupComboProd = await Product.create({
      name: "Duplicate Combo Shirt",
      slug: `dup-combo-${Date.now()}`,
      sku: `DUP-SHIRT-${Date.now()}`,
      productType: "variable",
      categoryId: testCategory._id,
      brandId: testBrand._id,
      vendorId: testVendor._id,
      price: 800,
      status: "active",
    });

    await ProductVariant.create([
      {
        productId: dupComboProd._id,
        sku: `DCS-A-${Date.now()}`,
        name: "Red Medium A",
        price: 800,
        attributes: { color: "Red", size: "M" },
        isActive: true,
      },
      {
        productId: dupComboProd._id,
        sku: `DCS-B-${Date.now()}`,
        name: "Red Medium B",
        price: 800,
        attributes: { color: "Red", size: "M" }, // DUPLICATE COMBO!
        isActive: true,
      },
    ]);

    // Snapshot counts before dry run
    const productsBefore = await Product.countDocuments();
    const variantsBefore = await ProductVariant.countDocuments();
    const inventoryBefore = await Inventory.countDocuments();

    // Execute dry run
    const report = await reconciliationService.runDryRun({ sampleLimit: 5 });

    // Assert Report Structure
    expect(report.mode).toBe("DRY_RUN_READ_ONLY");
    expect(report.discrepanciesFound).toBeGreaterThan(0);
    expect(report.categories.length).toBe(12);

    // Rule 1: Missing default variant detected
    const rule1 = report.categories.find((c) => c.ruleId === "DEF_VAR_MISSING");
    expect(rule1.affectedRecordCount).toBeGreaterThanOrEqual(1);
    expect(rule1.sampleIdentifiers.some((s) => s.recordId === simpleNoDefault._id.toString())).toBe(true);

    // Rule 7: Stale stock quantity mirror detected
    const rule7 = report.categories.find((c) => c.ruleId === "STALE_STOCK_QUANTITY_MIRROR");
    expect(rule7.affectedRecordCount).toBeGreaterThanOrEqual(1);
    expect(rule7.sampleIdentifiers.some((s) => s.recordId === v1._id.toString())).toBe(true);
    expect(rule7.sampleIdentifiers[0]).toHaveProperty("authoritativeSource");
    expect(rule7.sampleIdentifiers[0]).toHaveProperty("expectedValue");
    expect(rule7.sampleIdentifiers[0]).toHaveProperty("currentStoredValue");

    // Rule 11: Parent price mismatch detected
    const rule11 = report.categories.find((c) => c.ruleId === "PARENT_PRICE_MISMATCH");
    expect(rule11.affectedRecordCount).toBeGreaterThanOrEqual(1);
    expect(rule11.sampleIdentifiers.some((s) => s.recordId === varMismatch._id.toString())).toBe(true);

    // Rule 3: Duplicate attribute combination detected
    const rule3 = report.categories.find((c) => c.ruleId === "DUPLICATE_ATTR_COMBINATION");
    expect(rule3.affectedRecordCount).toBeGreaterThanOrEqual(1);

    // Rule 5: Missing SKU registry entries detected
    const rule5 = report.categories.find((c) => c.ruleId === "MISSING_SKU_REGISTRY_ENTRY");
    expect(rule5.affectedRecordCount).toBeGreaterThanOrEqual(1);
    expect(rule5.classification).toBe("DETERMINISTIC");

    // Verify 100% READ-ONLY guarantee: counts after dry-run match exactly
    const productsAfter = await Product.countDocuments();
    const variantsAfter = await ProductVariant.countDocuments();
    const inventoryAfter = await Inventory.countDocuments();

    expect(productsAfter).toBe(productsBefore);
    expect(variantsAfter).toBe(variantsBefore);
    expect(inventoryAfter).toBe(inventoryBefore);

    // Ensure no mutations to the documents occurred
    const recheckSimple = await Product.findById(simpleNoDefault._id);
    expect(recheckSimple.status).toBe("active");
    const recheckVar = await Product.findById(varMismatch._id);
    expect(Number(recheckVar.price)).toBe(2000); // Parent price was NOT mutated in dry-run
  });

  it("2. Produces repeatable and deterministic output across multiple dry runs", async () => {
    const run1 = await reconciliationService.runDryRun();
    const run2 = await reconciliationService.runDryRun();

    expect(run1.discrepanciesFound).toBe(run2.discrepanciesFound);
    expect(run1.summary.deterministicCount).toBe(run2.summary.deterministicCount);
    expect(run1.summary.ambiguousCount).toBe(run2.summary.ambiguousCount);
    expect(run1.categories.length).toBe(run2.categories.length);

    for (let i = 0; i < run1.categories.length; i++) {
      expect(run1.categories[i].ruleId).toBe(run2.categories[i].ruleId);
      expect(run1.categories[i].affectedRecordCount).toBe(run2.categories[i].affectedRecordCount);
    }
  });

  it("3. Verification: ZERO write operations executed on any model during dry run", async () => {
    const productUpdateSpy = jest.spyOn(Product, "updateOne");
    const productUpdateManySpy = jest.spyOn(Product, "updateMany");
    const productDeleteSpy = jest.spyOn(Product, "deleteOne");
    const productDeleteManySpy = jest.spyOn(Product, "deleteMany");
    const variantUpdateSpy = jest.spyOn(ProductVariant, "updateOne");
    const variantUpdateManySpy = jest.spyOn(ProductVariant, "updateMany");
    const inventoryUpdateSpy = jest.spyOn(Inventory, "updateOne");
    const registryCreateSpy = jest.spyOn(SkuRegistry, "create");

    await reconciliationService.runDryRun();

    expect(productUpdateSpy).not.toHaveBeenCalled();
    expect(productUpdateManySpy).not.toHaveBeenCalled();
    expect(productDeleteSpy).not.toHaveBeenCalled();
    expect(productDeleteManySpy).not.toHaveBeenCalled();
    expect(variantUpdateSpy).not.toHaveBeenCalled();
    expect(variantUpdateManySpy).not.toHaveBeenCalled();
    expect(inventoryUpdateSpy).not.toHaveBeenCalled();
    expect(registryCreateSpy).not.toHaveBeenCalled();

    productUpdateSpy.mockRestore();
    productUpdateManySpy.mockRestore();
    productDeleteSpy.mockRestore();
    productDeleteManySpy.mockRestore();
    variantUpdateSpy.mockRestore();
    variantUpdateManySpy.mockRestore();
    inventoryUpdateSpy.mockRestore();
    registryCreateSpy.mockRestore();
  });
});
