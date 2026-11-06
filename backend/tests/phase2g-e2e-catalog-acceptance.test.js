const mongoose = require("mongoose");
const xlsx = require("xlsx");
const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const Category = require("../src/models/Category");
const Brand = require("../src/models/Brand");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Warehouse = require("../src/models/Warehouse");
const Inventory = require("../src/models/Inventory");
const InventoryTransaction = require("../src/models/InventoryTransaction");
const SkuRegistry = require("../src/models/SkuRegistry");
const Cart = require("../src/models/Cart");
const Customer = require("../src/models/Customer");
const Order = require("../src/models/Order");

const productService = require("../src/services/product.service");
const productVariantService = require("../src/services/product-variant.service");
const bulkImportExportService = require("../src/services/bulk-import-export.service");
const skuRegistryService = require("../src/services/sku-registry.service");
const inventoryService = require("../src/services/inventory.service");
const cartService = require("../src/services/cart.service");
const reconciliationService = require("../src/services/catalog-reconciliation.service");
const withTransaction = require("../src/utils/withTransaction");
const { ROLES } = require("../src/constants/auth.constants");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_phase2g_e2e_test?")
  : "mongodb://127.0.0.1:27017/buybox_phase2g_e2e_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Buybox Phase 2G — End-to-End Catalog Acceptance, Import/Export & Cross-System Regression", () => {
  let adminUser, vendorUserA, vendorUserB, customerUser;
  let adminActor, vendorActorA, vendorActorB, customerActor;
  let vendorA, vendorB, customer;
  let platformCategory, platformBrand;
  let primaryWarehouse, secondaryWarehouse, inactiveWarehouse;

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
    await InventoryTransaction.deleteMany({});
    await Inventory.deleteMany({});
    await ProductVariant.deleteMany({});
    await Product.deleteMany({});
    await Cart.deleteMany({});
    await Order.deleteMany({});
    await Warehouse.deleteMany({});
    await Category.deleteMany({});
    await Brand.deleteMany({});
    await Customer.deleteMany({});
    await Vendor.deleteMany({});
    await User.deleteMany({});
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await SkuRegistry.deleteMany({});
    await InventoryTransaction.deleteMany({});
    await Inventory.deleteMany({});
    await ProductVariant.deleteMany({});
    await Product.deleteMany({});
    await Cart.deleteMany({});
    await Order.deleteMany({});
    await Warehouse.deleteMany({});
    await Category.deleteMany({});
    await Brand.deleteMany({});
    await Customer.deleteMany({});
    await Vendor.deleteMany({});
    await User.deleteMany({});

    // 1. Setup Admin
    adminUser = await User.create({
      firstName: "Admin",
      lastName: "Master",
      email: `admin_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`,
      password: "Password123!",
      role: ROLES.ADMIN,
      isActive: true,
    });
    adminActor = { id: adminUser._id.toString(), _id: adminUser._id, role: ROLES.ADMIN };

    // 2. Setup Vendor A
    vendorUserA = await User.create({
      firstName: "Vendor",
      lastName: "Alpha",
      email: `vendor_a_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`,
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

    // 3. Setup Vendor B
    vendorUserB = await User.create({
      firstName: "Vendor",
      lastName: "Beta",
      email: `vendor_b_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`,
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

    // 4. Setup Customer
    customerUser = await User.create({
      firstName: "Buyer",
      lastName: "Shopper",
      email: `customer_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`,
      password: "Password123!",
      role: ROLES.CUSTOMER,
      isActive: true,
    });
    customer = await Customer.create({
      userId: customerUser._id,
      isActive: true,
    });
    customerActor = { id: customerUser._id.toString(), _id: customerUser._id, role: ROLES.CUSTOMER };

    // 5. Setup Platform Taxonomy & Warehouses
    platformCategory = await Category.create({
      name: "Electronics",
      slug: `electronics-${Date.now()}`,
      isActive: true,
    });

    platformBrand = await Brand.create({
      name: "Nexus",
      slug: `nexus-${Date.now()}`,
      isActive: true,
    });

    primaryWarehouse = await Warehouse.create({
      name: "Central Mumbai Hub",
      code: `WH-BOM-${Date.now().toString().slice(-4)}`,
      address: {
        addressLine1: "Plot 10, MIDC",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "IN",
      },
      isActive: true,
    });

    secondaryWarehouse = await Warehouse.create({
      name: "North Delhi Hub",
      code: `WH-DEL-${Date.now().toString().slice(-4)}`,
      address: {
        addressLine1: "Sector 18, Okhla",
        city: "Delhi",
        state: "Delhi",
        postalCode: "110020",
        country: "IN",
      },
      isActive: true,
    });

    inactiveWarehouse = await Warehouse.create({
      name: "Decommissioned Hub",
      code: `WH-DEC-${Date.now().toString().slice(-4)}`,
      address: {
        addressLine1: "Old Depot",
        city: "Kolkata",
        state: "West Bengal",
        postalCode: "700001",
        country: "IN",
      },
      isActive: false,
    });
  });

  // =========================================================================
  // SECTION 1: Bulk Import / Export Correctness & Formula-Injection Safety
  // =========================================================================
  describe("1. Catalog Import/Export Correctness & Integrity", () => {
    test("1.1 Formula-injection protection escapes dangerous spreadsheet prefixes", () => {
      expect(bulkImportExportService.sanitizeFormula("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
      expect(bulkImportExportService.sanitizeFormula("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
      expect(bulkImportExportService.sanitizeFormula("-100")).toBe("'-100");
      expect(bulkImportExportService.sanitizeFormula("@evil.com")).toBe("'@evil.com");
      expect(bulkImportExportService.sanitizeFormula("\tmalicious")).toBe("'\tmalicious");
      expect(bulkImportExportService.sanitizeFormula("Standard Product Name")).toBe("Standard Product Name");
    });

    test("1.2 Validates imported headers and rejects files missing mandatory columns", async () => {
      const invalidData = [
        ["Title", "SKU", "Description"], // Missing Category, Price
        ["Sample", "SMP-001", "Desc"],
      ];
      const ws = xlsx.utils.aoa_to_sheet(invalidData);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "Products");
      const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

      await expect(
        bulkImportExportService.validateBulkImport({
          buffer,
          filename: "invalid_headers.xlsx",
          vendorId: vendorA._id,
        })
      ).rejects.toMatchObject({
        code: "MISSING_REQUIRED_COLUMNS",
        statusCode: 400,
      });
    });

    test("1.3 Rejects duplicate SKUs within the same file with row-level error attribution", async () => {
      const duplicateSku = `P2G-DUP-${Date.now()}`;
      const wsData = [
        ["Product Name", "Variant SKU", "Category", "Price", "Stock Quantity"],
        ["Product Row 1", duplicateSku, platformCategory.name, 499, 10],
        ["Product Row 2", duplicateSku, platformCategory.name, 599, 15],
      ];
      const ws = xlsx.utils.aoa_to_sheet(wsData);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "Products");
      const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

      const report = await bulkImportExportService.validateBulkImport({
        buffer,
        filename: "dup_sku.xlsx",
        vendorId: vendorA._id,
      });

      expect(report.validRowsCount).toBe(1);
      expect(report.errorRowsCount).toBe(1);
      const dupError = report.errorDetails.find((e) => e.rowNumber === 3 && e.sku === duplicateSku);
      expect(dupError).toBeDefined();
      expect(dupError.error).toContain("Duplicate SKU");
    });

    test("1.4 Detects and rejects duplicate variant attribute combinations for the same parent product", async () => {
      const parentSku = `P2G-VAR-DUP-${Date.now()}`;
      const wsData = [
        ["Product Name", "Parent SKU", "Variant SKU", "Category", "Price", "Color", "Size"],
        ["Variable Shirt", parentSku, `${parentSku}-V1`, platformCategory.name, 999, "Black", "L"],
        ["Variable Shirt", parentSku, `${parentSku}-V2`, platformCategory.name, 999, "Black", "L"], // Duplicate combination!
      ];
      const ws = xlsx.utils.aoa_to_sheet(wsData);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "Products");
      const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

      const report = await bulkImportExportService.validateBulkImport({
        buffer,
        filename: "dup_attributes.xlsx",
        vendorId: vendorA._id,
      });

      expect(report.errorRowsCount).toBe(1);
      const attrError = report.errorDetails.find((e) => e.field === "Attributes" && e.rowNumber === 3);
      expect(attrError).toBeDefined();
      expect(attrError.error).toContain("Duplicate variant attribute combination");
    });

    test("1.5 Cross-vendor SKU collision is caught against SkuRegistry and existing catalog", async () => {
      // Vendor A owns an active product & registered SKU
      const existingSku = `P2G-COLLISION-${Date.now()}`;
      const prodA = await productService.createProduct({
        data: {
          name: "Vendor A Sovereign Item",
          slug: `v-a-sov-${Date.now()}`,
          sku: existingSku,
          categoryId: platformCategory._id.toString(),
          price: "1200.00",
          stockQuantity: 10,
          warehouseId: primaryWarehouse._id.toString(),
          productType: "simple",
        },
        userId: vendorUserA._id.toString(),
        actor: vendorActorA,
      });

      // Vendor B attempts to import rows with Vendor A's SKU
      const hostileData = [
        ["Product Name", "Variant SKU", "Category", "Price", "Stock Quantity"],
        ["Vendor B Item", existingSku, platformCategory.name, 1100, 5],
      ];
      const ws = xlsx.utils.aoa_to_sheet(hostileData);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "Products");
      const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

      const report = await bulkImportExportService.validateBulkImport({
        buffer,
        filename: "hostile_import.xlsx",
        vendorId: vendorB._id,
      });

      expect(report.errorRowsCount).toBe(1);
      const collisionErr = report.errorDetails.find(
        (e) => e.field === "SKU" && (e.error.includes("collision") || e.error.includes("another merchant"))
      );
      expect(collisionErr).toBeDefined();
    });

    test("1.6 Multi-row bulk import creates simple product with canonical default variant, SkuRegistry entry, and warehouse stock", async () => {
      const sku = `P2G-IMP-SIM-${Date.now()}`;
      const wsData = [
        ["Product Name", "Variant SKU", "Category", "Brand", "Price", "Stock Quantity", "Weight (kg)", "Dimensions (LxWxH cm)"],
        ["Imported Simple Gadget", sku, platformCategory.name, platformBrand.name, 1499.0, 40, 0.5, "10x5x2"],
      ];
      const ws = xlsx.utils.aoa_to_sheet(wsData);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "Products");
      const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

      const validation = await bulkImportExportService.validateBulkImport({
        buffer,
        filename: "simple_import.xlsx",
        vendorId: vendorA._id,
      });

      expect(validation.validRowsCount).toBe(1);
      expect(validation.newProductsCount).toBe(1);

      const commitResult = await bulkImportExportService.commitBulkImport({
        rows: validation.rows,
        vendorId: vendorA._id,
        actor: vendorActorA,
      });

      expect(commitResult.createdProductsCount).toBe(1);
      expect(commitResult.createdVariantsCount).toBe(1);
      expect(commitResult.failedCount).toBe(0);

      // Verify product and canonical default variant
      const product = await Product.findOne({ sku });
      expect(product).not.toBeNull();
      expect(product.productType).toBe("simple");

      const variant = await ProductVariant.findOne({ productId: product._id, isDefault: true, deletedAt: null });
      expect(variant).not.toBeNull();
      expect(variant.isDefault).toBe(true);
      expect(variant.sku).toBe(sku);
      expect(variant.stockQuantity).toBe(40);

      // Verify SkuRegistry contains entries
      const regProduct = await SkuRegistry.findOne({ sku, entityType: "variant", isDefault: true });
      expect(regProduct).not.toBeNull();
      expect(regProduct.productId.toString()).toBe(product._id.toString());
      expect(regProduct.variantId.toString()).toBe(variant._id.toString());

      // Verify authoritative warehouse inventory record
      const inv = await Inventory.findOne({ productVariantId: variant._id, warehouseId: primaryWarehouse._id });
      expect(inv).not.toBeNull();
      expect(inv.onHand).toBe(40);
      expect(inv.reserved).toBe(0);

      // Verify inventory transaction ledger
      const tx = await InventoryTransaction.findOne({ productVariantId: variant._id, referenceType: "bulk_import" });
      expect(tx).not.toBeNull();
      expect(tx.quantity).toBe(40);
    });

    test("1.7 Template-compatible export preserves product matrix and allows safe round-trip re-import", async () => {
      // 0. Seed a product for Vendor A
      await productService.createProduct({
        data: {
          name: "Exportable Simple Gadget",
          slug: `exp-gadget-${Date.now()}`,
          sku: `EXP-SIMP-${Date.now()}`,
          categoryId: platformCategory._id.toString(),
          brandId: platformBrand._id.toString(),
          price: "899.00",
          stockQuantity: 20,
          warehouseId: primaryWarehouse._id.toString(),
          productType: "simple",
        },
        userId: vendorUserA._id.toString(),
        actor: vendorActorA,
      });

      // 1. Export Vendor A products using templateCompatible option
      const exportResult = await bulkImportExportService.exportVendorProducts({
        vendorId: vendorA._id,
        filters: { templateCompatible: true },
        format: "xlsx",
        actor: vendorActorA,
      });

      expect(exportResult.buffer).toBeDefined();
      expect(exportResult.count).toBeGreaterThan(0);

      // 2. Validate exported buffer back through validateBulkImport in UPDATE_ONLY or CREATE_AND_UPDATE mode
      const reimportValidation = await bulkImportExportService.validateBulkImport({
        buffer: exportResult.buffer,
        filename: exportResult.filename,
        vendorId: vendorA._id,
        mode: "CREATE_AND_UPDATE",
      });

      expect(reimportValidation.errorRowsCount).toBe(0);
      expect(reimportValidation.validRowsCount).toBe(exportResult.count);
    });
  });

  // =========================================================================
  // SECTION 2: Simple Product Full End-to-End Lifecycle
  // =========================================================================
  describe("2. Simple Product Full End-to-End Lifecycle", () => {
    test("Vendor creates simple product -> canonical variant provisioned -> Admin approves -> Storefront availability -> Cart -> Checkout reservation -> Payment deduction", async () => {
      const sku = `P2G-SIM-E2E-${Date.now()}`;

      // Step 1 & 2: Vendor creates simple product
      const product = await productService.createProduct({
        data: {
          name: "E2E Simple Wireless Mouse",
          slug: `mouse-e2e-${Date.now()}`,
          sku,
          categoryId: platformCategory._id.toString(),
          brandId: platformBrand._id.toString(),
          price: "1299.00",
          stockQuantity: 15,
          warehouseId: primaryWarehouse._id.toString(),
          productType: "simple",
          dimensions: { length: 12, width: 6, height: 4, unit: "cm" },
          weight: { value: 0.15, unit: "kg" },
          shippingClass: "standard-courier",
        },
        userId: vendorUserA._id.toString(),
        actor: vendorActorA,
      });

      expect(product.status).toBe("draft");
      expect(product.productType).toBe("simple");

      // Verify canonical default variant
      const defaultVariant = await ProductVariant.findOne({ productId: product._id, isDefault: true });
      expect(defaultVariant).not.toBeNull();
      expect(defaultVariant.sku).toBe(sku);
      expect(defaultVariant.isActive).toBe(true);

      // Verify SkuRegistry reservation
      const registryEntry = await SkuRegistry.findOne({ sku, isDefault: true });
      expect(registryEntry).not.toBeNull();
      expect(registryEntry.variantId.toString()).toBe(defaultVariant._id.toString());

      // Verify warehouse inventory
      const initialInv = await Inventory.findOne({ productVariantId: defaultVariant._id, warehouseId: primaryWarehouse._id });
      expect(initialInv.onHand).toBe(15);
      expect(initialInv.reserved).toBe(0);

      // Verify draft product is NOT available on storefront / cart
      await expect(
        cartService.addItem(customerUser._id.toString(), { productVariantId: defaultVariant._id.toString() }, 1)
      ).rejects.toMatchObject({
        code: "PRODUCT_UNAVAILABLE",
      });

      // Step 3: Vendor submits for review and Admin reviews & approves
      await productService.submitProductForApproval({ id: product._id, actor: vendorActorA });
      await productService.approveProduct({ id: product._id, actor: adminActor });
      const approvedProduct = await Product.findById(product._id);
      expect(approvedProduct.status).toBe("active");

      // Step 4: Storefront displays accurate availability
      const availability = await productService.getVariantAvailability(defaultVariant._id);
      expect(availability.availableQuantity).toBe(15);
      expect(availability.stockStatus).toBe("in_stock");

      // Step 5: Customer adds canonical variant to cart
      const cart = await cartService.addItem(
        customerUser._id.toString(),
        { productVariantId: defaultVariant._id.toString() },
        2
      );
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].productVariantId.toString()).toBe(defaultVariant._id.toString());
      expect(cart.items[0].quantity).toBe(2);

      // Step 6: Checkout reserves warehouse inventory
      const checkoutRef = `ORD-P2G-SIM-${Date.now()}`;
      await withTransaction(async (session) => {
        await inventoryService.reserveStockInTransaction(
          initialInv._id,
          2,
          {
            referenceType: "order",
            referenceId: checkoutRef,
            actorUserId: customerUser._id,
            idempotencyKey: `res-${checkoutRef}`,
            notes: "Phase 2G E2E reservation",
          },
          session
        );
      });

      // Verify reserved quantity incremented, available decremented
      const reservedInv = await Inventory.findById(initialInv._id);
      expect(reservedInv.onHand).toBe(15);
      expect(reservedInv.reserved).toBe(2);
      expect(reservedInv.available).toBe(13);

      // Storefront availability now reflects 13
      const updatedAvailability = await productService.getVariantAvailability(defaultVariant._id);
      expect(updatedAvailability.availableQuantity).toBe(13);

      // Step 7: Payment finalization deducts reserved inventory idempotently
      const paymentDeductKey = `deduct-${checkoutRef}`;
      await withTransaction(async (session) => {
        await inventoryService.deductReservedStockInTransaction(
          initialInv._id,
          2,
          {
            referenceType: "order",
            referenceId: checkoutRef,
            actorUserId: customerUser._id,
            idempotencyKey: paymentDeductKey,
            notes: "Payment finalization",
          },
          session
        );
      });

      const finalizedInv = await Inventory.findById(initialInv._id);
      expect(finalizedInv.onHand).toBe(13);
      expect(finalizedInv.reserved).toBe(0);
      expect(finalizedInv.available).toBe(13);

      // Step 8: Duplicate payment callback produces zero duplicate deductions
      await withTransaction(async (session) => {
        await inventoryService.deductReservedStockInTransaction(
          initialInv._id,
          2,
          {
            referenceType: "order",
            referenceId: checkoutRef,
            actorUserId: customerUser._id,
            idempotencyKey: paymentDeductKey,
            notes: "Duplicate payment webhook",
          },
          session
        );
      });

      const duplicateCheckedInv = await Inventory.findById(initialInv._id);
      expect(duplicateCheckedInv.onHand).toBe(13);
      expect(duplicateCheckedInv.reserved).toBe(0);
    });
  });

  // =========================================================================
  // SECTION 3: Variable Product Full End-to-End Lifecycle & Cancellation
  // =========================================================================
  describe("3. Variable Product Full Lifecycle & Safe Cancellation / Expiry", () => {
    test("Variable product with explicit variants -> Storefront selection -> Reservation -> Cancellation safely releases stock", async () => {
      const parentSku = `P2G-VAR-PAR-${Date.now()}`;
      const variantSkuM = `P2G-VAR-M-${Date.now()}`;
      const variantSkuL = `P2G-VAR-L-${Date.now()}`;

      // Step 1: Vendor creates variable product
      const product = await productService.createProduct({
        data: {
          name: "Premium Linen Shirt",
          slug: `linen-shirt-${Date.now()}`,
          sku: parentSku,
          categoryId: platformCategory._id.toString(),
          brandId: platformBrand._id.toString(),
          price: "2499.00",
          productType: "variable",
          shippingClass: "standard-courier",
        },
        userId: vendorUserA._id.toString(),
        actor: vendorActorA,
      });

      expect(product.productType).toBe("variable");

      // Vendor adds explicit Variant M
      const variantM = await productVariantService.createProductVariant({
        data: {
          productId: product._id,
          name: "Medium / White",
          sku: variantSkuM,
          price: "2499.00",
          stockQuantity: 10,
          warehouseId: primaryWarehouse._id.toString(),
          attributes: { size: "M", color: "White" },
          dimensions: { length: 30, width: 25, height: 2, unit: "cm" },
          weight: { value: 0.3, unit: "kg" },
        },
        actor: vendorActorA,
      });

      // Vendor adds explicit Variant L
      const variantL = await productVariantService.createProductVariant({
        data: {
          productId: product._id,
          name: "Large / White",
          sku: variantSkuL,
          price: "2699.00",
          stockQuantity: 5,
          warehouseId: primaryWarehouse._id.toString(),
          attributes: { size: "L", color: "White" },
          dimensions: { length: 30, width: 25, height: 2, unit: "cm" },
          weight: { value: 0.35, unit: "kg" },
        },
        actor: vendorActorA,
      });

      expect(variantM.isDefault).toBe(false);
      expect(variantL.isDefault).toBe(false);

      // Step 2: SkuRegistry verified for parent and explicit variants
      const regParent = await SkuRegistry.findOne({ sku: parentSku, entityType: "product" });
      const regM = await SkuRegistry.findOne({ sku: variantSkuM, entityType: "variant" });
      const regL = await SkuRegistry.findOne({ sku: variantSkuL, entityType: "variant" });
      expect(regParent).not.toBeNull();
      expect(regM).not.toBeNull();
      expect(regL).not.toBeNull();

      // Step 3: Vendor submits for review and Admin reviews & approves
      await productService.submitProductForApproval({ id: product._id, actor: vendorActorA });
      await productService.approveProduct({ id: product._id, actor: adminActor });

      // Step 4: Customer selects Variant M and adds to cart
      const cart = await cartService.addItem(
        customerUser._id.toString(),
        { productVariantId: variantM._id.toString() },
        3
      );
      expect(cart.items[0].productVariantId.toString()).toBe(variantM._id.toString());
      expect(cart.items[0].quantity).toBe(3);

      // Step 5: Checkout reserves Variant M inventory
      const invM = await Inventory.findOne({ productVariantId: variantM._id, warehouseId: primaryWarehouse._id });
      const checkoutRefM = `ORD-CANCEL-TEST-${Date.now()}`;

      await withTransaction(async (session) => {
        await inventoryService.reserveStockInTransaction(
          invM._id,
          3,
          {
            referenceType: "order",
            referenceId: checkoutRefM,
            actorUserId: customerUser._id,
            idempotencyKey: `res-${checkoutRefM}`,
            notes: "Reservation before cancel",
          },
          session
        );
      });

      let currentInvM = await Inventory.findById(invM._id);
      expect(currentInvM.reserved).toBe(3);
      expect(currentInvM.available).toBe(7);

      // Step 6: Order cancellation or expiration safely releases reservation
      await withTransaction(async (session) => {
        await inventoryService.releaseStockInTransaction(
          invM._id,
          3,
          {
            referenceType: "order",
            referenceId: checkoutRefM,
            actorUserId: customerUser._id,
            idempotencyKey: `rel-${checkoutRefM}`,
            notes: "Order cancelled by customer",
          },
          session
        );
      });

      currentInvM = await Inventory.findById(invM._id);
      expect(currentInvM.onHand).toBe(10);
      expect(currentInvM.reserved).toBe(0);
      expect(currentInvM.available).toBe(10);

      // Idempotent double-release does NOT increase available stock above onHand
      await withTransaction(async (session) => {
        await inventoryService.releaseStockInTransaction(
          invM._id,
          3,
          {
            referenceType: "order",
            referenceId: checkoutRefM,
            actorUserId: customerUser._id,
            idempotencyKey: `rel-${checkoutRefM}`,
            notes: "Duplicate cancel webhook",
          },
          session
        );
      });

      currentInvM = await Inventory.findById(invM._id);
      expect(currentInvM.onHand).toBe(10);
      expect(currentInvM.reserved).toBe(0);
      expect(currentInvM.available).toBe(10);
    });
  });

  // =========================================================================
  // SECTION 4: Integrity, Security, Concurrency & Ownership Controls
  // =========================================================================
  describe("4. Catalog Consistency, Concurrency & Authorization Hardening", () => {
    test("4.1 Inactive variants are blocked from cart addition and storefront checkout", async () => {
      const sku = `P2G-INACT-${Date.now()}`;
      const product = await productService.createProduct({
        data: {
          name: "Deactivated Variant Item",
          slug: `inact-item-${Date.now()}`,
          sku,
          categoryId: platformCategory._id.toString(),
          price: "800.00",
          stockQuantity: 10,
          warehouseId: primaryWarehouse._id.toString(),
          productType: "simple",
        },
        userId: vendorUserA._id.toString(),
        actor: vendorActorA,
      });

      await productService.submitProductForApproval({ id: product._id, actor: vendorActorA });
      await productService.approveProduct({ id: product._id, actor: adminActor });
      const defaultVariant = await ProductVariant.findOne({ productId: product._id, isDefault: true });

      // Deactivate variant
      await productVariantService.updateProductVariant({
        id: defaultVariant._id,
        data: { isActive: false },
        actor: vendorActorA,
      });

      // Customer attempt to add deactivated variant to cart must fail
      await expect(
        cartService.addItem(customerUser._id.toString(), { productVariantId: defaultVariant._id.toString() }, 1)
      ).rejects.toMatchObject({
        code: "PRODUCT_VARIANT_NOT_FOUND",
        statusCode: 404,
      });
    });

    test("4.2 Zero available warehouse stock rejects cart addition with OUT_OF_STOCK", async () => {
      const sku = `P2G-OOS-${Date.now()}`;
      const product = await productService.createProduct({
        data: {
          name: "Zero Stock Product",
          slug: `oos-item-${Date.now()}`,
          sku,
          categoryId: platformCategory._id.toString(),
          price: "450.00",
          stockQuantity: 0,
          warehouseId: primaryWarehouse._id.toString(),
          productType: "simple",
        },
        userId: vendorUserA._id.toString(),
        actor: vendorActorA,
      });

      await productService.submitProductForApproval({ id: product._id, actor: vendorActorA });
      await productService.approveProduct({ id: product._id, actor: adminActor });
      const defaultVariant = await ProductVariant.findOne({ productId: product._id, isDefault: true });

      await expect(
        cartService.addItem(customerUser._id.toString(), { productVariantId: defaultVariant._id.toString() }, 1)
      ).rejects.toMatchObject({
        code: "OUT_OF_STOCK",
        statusCode: 400,
      });
    });

    test("4.3 Concurrent checkout reservation serialization prevents overselling single unit", async () => {
      const sku = `P2G-CONCUR-STOCK-${Date.now()}`;
      const product = await productService.createProduct({
        data: {
          name: "Hot Drop Limited Edition Item",
          slug: `hot-drop-${Date.now()}`,
          sku,
          categoryId: platformCategory._id.toString(),
          price: "9999.00",
          stockQuantity: 1, // Only 1 unit in stock!
          warehouseId: primaryWarehouse._id.toString(),
          productType: "simple",
        },
        userId: vendorUserA._id.toString(),
        actor: vendorActorA,
      });

      const defaultVariant = await ProductVariant.findOne({ productId: product._id, isDefault: true });
      const inventory = await Inventory.findOne({ productVariantId: defaultVariant._id, warehouseId: primaryWarehouse._id });

      // Two users race to reserve the final 1 unit simultaneously
      const attempt1 = withTransaction(async (session) => {
        return inventoryService.reserveStockInTransaction(
          inventory._id,
          1,
          {
            referenceType: "order",
            referenceId: `ORD-RACE-1-${Date.now()}`,
            actorUserId: customerUser._id,
            idempotencyKey: `race-key-1-${Date.now()}`,
          },
          session
        );
      });

      const attempt2 = withTransaction(async (session) => {
        return inventoryService.reserveStockInTransaction(
          inventory._id,
          1,
          {
            referenceType: "order",
            referenceId: `ORD-RACE-2-${Date.now()}`,
            actorUserId: adminUser._id,
            idempotencyKey: `race-key-2-${Date.now()}`,
          },
          session
        );
      });

      const results = await Promise.allSettled([attempt1, attempt2]);
      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      // Exactly 1 must succeed and 1 must fail with insufficient stock
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const finalInv = await Inventory.findById(inventory._id);
      expect(finalInv.reserved).toBe(1);
      expect(finalInv.available).toBe(0);
    });

    test("4.4 Vendor ownership boundary blocks cross-vendor mutation and deletion", async () => {
      const sku = `P2G-ISOLATION-${Date.now()}`;
      const prodA = await productService.createProduct({
        data: {
          name: "Vendor A Protected Product",
          slug: `v-a-prot-${Date.now()}`,
          sku,
          categoryId: platformCategory._id.toString(),
          price: "500.00",
          stockQuantity: 10,
          warehouseId: primaryWarehouse._id.toString(),
          productType: "simple",
        },
        userId: vendorUserA._id.toString(),
        actor: vendorActorA,
      });

      // Vendor B attempts to update Vendor A's product
      await expect(
        productService.updateProduct({
          id: prodA._id,
          data: { name: "Hostile Hijack Name" },
          actor: vendorActorB,
        })
      ).rejects.toMatchObject({
        code: "PRODUCT_OWNERSHIP_REQUIRED",
        statusCode: 403,
      });

      // Vendor B attempts to delete Vendor A's product
      await expect(
        productService.deleteProduct({
          id: prodA._id,
          actor: vendorActorB,
        })
      ).rejects.toMatchObject({
        code: "PRODUCT_OWNERSHIP_REQUIRED",
        statusCode: 403,
      });

      const pristineProd = await Product.findById(prodA._id);
      expect(pristineProd.name).toBe("Vendor A Protected Product");
      expect(pristineProd.deletedAt).toBeNull();
    });
  });

  // =========================================================================
  // SECTION 5: Controlled Legacy Reconciliation Scanner Safety
  // =========================================================================
  describe("5. Controlled Legacy Reconciliation Scanner Safety", () => {
    test("Scanner performs zero database writes and produces repeatable output", async () => {
      // Seed a legacy discrepancy: Simple product without defaultVariantId
      const legacyProd = await Product.create({
        name: "Legacy Product Without Default Variant",
        slug: `legacy-prod-${Date.now()}`,
        sku: `P2G-LEGACY-${Date.now()}`,
        categoryId: platformCategory._id,
        vendorId: vendorA._id,
        price: 350.0,
        productType: "simple",
        status: "active",
      });

      // Spy on all Mongoose model write operations
      const writeSpy = jest.spyOn(mongoose.Model.prototype, "save");
      const updateOneSpy = jest.spyOn(mongoose.Model, "updateOne");
      const updateManySpy = jest.spyOn(mongoose.Model, "updateMany");
      const findOneAndUpdateSpy = jest.spyOn(mongoose.Model, "findOneAndUpdate");
      const deleteOneSpy = jest.spyOn(mongoose.Model, "deleteOne");

      const run1 = await reconciliationService.runDryRun();
      const run2 = await reconciliationService.runDryRun();

      // Verify ZERO database mutations occurred during dry run
      expect(writeSpy).not.toHaveBeenCalled();
      expect(updateOneSpy).not.toHaveBeenCalled();
      expect(updateManySpy).not.toHaveBeenCalled();
      expect(findOneAndUpdateSpy).not.toHaveBeenCalled();
      expect(deleteOneSpy).not.toHaveBeenCalled();

      // Verify identical, repeatable scan metrics
      expect(run1.discrepanciesFound).toBe(run2.discrepanciesFound);
      const missingCanonicalRule = run1.categories.find(
        (c) => c.ruleId === "DEF_VAR_MISSING"
      );
      expect(missingCanonicalRule).toBeDefined();
      expect(missingCanonicalRule.affectedRecordCount).toBeGreaterThanOrEqual(1);

      writeSpy.mockRestore();
      updateOneSpy.mockRestore();
      updateManySpy.mockRestore();
      findOneAndUpdateSpy.mockRestore();
      deleteOneSpy.mockRestore();
    });
  });
});
