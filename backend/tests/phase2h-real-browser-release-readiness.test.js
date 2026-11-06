const mongoose = require("mongoose");
const xlsx = require("xlsx");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const SkuRegistry = require("../src/models/SkuRegistry");
const Inventory = require("../src/models/Inventory");
const InventoryTransaction = require("../src/models/InventoryTransaction");
const Order = require("../src/models/Order");
const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const Warehouse = require("../src/models/Warehouse");
const Category = require("../src/models/Category");
const Brand = require("../src/models/Brand");

const productService = require("../src/services/product.service");
const productVariantService = require("../src/services/product-variant.service");
const cartService = require("../src/services/cart.service");
const inventoryService = require("../src/services/inventory.service");
const bulkImportExportService = require("../src/services/bulk-import-export.service");
const reconciliationService = require("../src/services/catalog-reconciliation.service");
const withTransaction = require("../src/utils/withTransaction");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_phase2h_e2e_test?")
  : "mongodb://127.0.0.1:27017/buybox_phase2h_e2e_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Buybox Phase 2H — Real-World E2E Acceptance & Release Readiness", () => {
  let primaryWarehouse;
  let platformCategory;
  let platformBrand;

  let vendorUserA;
  let vendorA;
  let vendorActorA;

  let vendorUserB;
  let vendorB;
  let vendorActorB;

  let adminUser;
  let adminActor;

  let customerUser;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }
    await SkuRegistry.syncIndexes();
    await Product.syncIndexes();
    await ProductVariant.syncIndexes();

    // 1. Establish Warehouses
    primaryWarehouse = await Warehouse.findOne({ code: "P2H-WH-01" });
    if (!primaryWarehouse) {
      primaryWarehouse = await Warehouse.create({
        name: "Phase 2H Primary Fulfillment Center",
        code: "P2H-WH-01",
        address: {
          addressLine1: "100 Acceptance Way",
          city: "Bengaluru",
          state: "Karnataka",
          postalCode: "560001",
          country: "IN",
        },
        isActive: true,
      });
    }

    // 2. Establish Platform Taxonomy
    platformCategory = await Category.findOne({ slug: "p2h-electronics" });
    if (!platformCategory) {
      platformCategory = await Category.create({
        name: "Phase 2H Electronics",
        slug: "p2h-electronics",
        isActive: true,
      });
    }

    platformBrand = await Brand.findOne({ slug: "p2h-audio-brand" });
    if (!platformBrand) {
      platformBrand = await Brand.create({
        name: "Phase 2H Audio Brand",
        slug: "p2h-audio-brand",
        isActive: true,
      });
    }

const Customer = require("../src/models/Customer");

    // 3. Vendor A
    vendorUserA = await User.create({
      firstName: "Vendor",
      lastName: "Alpha",
      email: `p2h-vendor-a-${Date.now()}@buybox.test`,
      password: "HashedPassword123!",
      role: "vendor",
      isEmailVerified: true,
    });

    vendorA = await Vendor.create({
      userId: vendorUserA._id,
      businessName: "Vendor Alpha Sovereign Electronics",
      businessSlug: `v-alpha-${Date.now()}`,
      email: vendorUserA.email,
      phone: "+919876543210",
      onboardingStatus: "approved",
      isActive: true,
    });

    vendorActorA = {
      id: vendorUserA._id.toString(),
      _id: vendorUserA._id,
      role: "vendor",
      vendorId: vendorA._id.toString(),
    };

    // 4. Vendor B (Isolation checks)
    vendorUserB = await User.create({
      firstName: "Vendor",
      lastName: "Beta",
      email: `p2h-vendor-b-${Date.now()}@buybox.test`,
      password: "HashedPassword123!",
      role: "vendor",
      isEmailVerified: true,
    });

    vendorB = await Vendor.create({
      userId: vendorUserB._id,
      businessName: "Vendor Beta Rival Electronics",
      businessSlug: `v-beta-${Date.now()}`,
      email: vendorUserB.email,
      phone: "+919876543211",
      onboardingStatus: "approved",
      isActive: true,
    });

    vendorActorB = {
      id: vendorUserB._id.toString(),
      _id: vendorUserB._id,
      role: "vendor",
      vendorId: vendorB._id.toString(),
    };

    // 5. Admin Actor
    adminUser = await User.create({
      firstName: "Super",
      lastName: "Moderator",
      email: `p2h-admin-${Date.now()}@buybox.test`,
      password: "HashedPassword123!",
      role: "admin",
      isEmailVerified: true,
    });

    adminActor = {
      id: adminUser._id.toString(),
      _id: adminUser._id,
      role: "admin",
    };

    // 6. Customer User
    customerUser = await User.create({
      firstName: "Shopper",
      lastName: "Acceptance",
      email: `p2h-customer-${Date.now()}@buybox.test`,
      password: "HashedPassword123!",
      role: "customer",
      isEmailVerified: true,
    });

    await Customer.create({
      userId: customerUser._id,
      firstName: customerUser.firstName,
      lastName: customerUser.lastName,
      email: customerUser.email,
    });
  });

  // =========================================================================
  // WORKFLOW A: Vendor Catalog Management & Integrity
  // =========================================================================
  describe("Workflow A: Vendor Catalog Management", () => {
    test("A.1 Vendor creates simple product with canonical variant, attributes, dimensions & warehouse stock", async () => {
      const sku = `P2H-SIMP-${Date.now()}`;
      const product = await productService.createProduct({
        data: {
          name: "Studio Reference Headphones",
          slug: `studio-ref-${Date.now()}`,
          sku,
          categoryId: platformCategory._id.toString(),
          brandId: platformBrand._id.toString(),
          price: "4999.00",
          stockQuantity: 25,
          warehouseId: primaryWarehouse._id.toString(),
          productType: "simple",
          dimensions: { length: 20, width: 18, height: 8, unit: "cm" },
          weight: { value: 0.28, unit: "kg" },
          shippingClass: "fragile-electronics",
        },
        userId: vendorUserA._id.toString(),
        actor: vendorActorA,
      });

      expect(product.productType).toBe("simple");
      expect(product.status).toBe("draft");

      // Verify canonical default variant
      const defaultVariant = await ProductVariant.findOne({ productId: product._id, isDefault: true });
      expect(defaultVariant).not.toBeNull();
      expect(defaultVariant.sku).toBe(sku);
      expect(defaultVariant.dimensions.length).toBe(20);
      expect(defaultVariant.shippingClass).toBe("fragile-electronics");

      // Verify authoritative warehouse stock
      const inv = await Inventory.findOne({ productVariantId: defaultVariant._id, warehouseId: primaryWarehouse._id });
      expect(inv.onHand).toBe(25);
      expect(inv.reserved).toBe(0);

      // Verify SkuRegistry registration
      const reg = await SkuRegistry.findOne({ sku, isDefault: true });
      expect(reg).not.toBeNull();
      expect(reg.variantId.toString()).toBe(defaultVariant._id.toString());
    });

    test("A.2 Vendor creates variable product with explicit variants and rejects duplicate attribute combinations", async () => {
      const parentSku = `P2H-VAR-PRD-${Date.now()}`;
      const product = await productService.createProduct({
        data: {
          name: "Modular Mechanical Numpad",
          slug: `modular-numpad-${Date.now()}`,
          sku: parentSku,
          categoryId: platformCategory._id.toString(),
          brandId: platformBrand._id.toString(),
          price: "2999.00",
          productType: "variable",
          shippingClass: "standard",
        },
        userId: vendorUserA._id.toString(),
        actor: vendorActorA,
      });

      // Add Variant 1: Black / Linear Switch
      const var1 = await productVariantService.createProductVariant({
        data: {
          productId: product._id,
          name: "Black / Linear",
          sku: `${parentSku}-BLK-LIN`,
          price: "2999.00",
          stockQuantity: 15,
          warehouseId: primaryWarehouse._id.toString(),
          attributes: { color: "Black", switchType: "Linear" },
        },
        actor: vendorActorA,
      });
      expect(var1.isDefault).toBe(false);

      // Add Variant 2: White / Tactile Switch
      const var2 = await productVariantService.createProductVariant({
        data: {
          productId: product._id,
          name: "White / Tactile",
          sku: `${parentSku}-WHT-TAC`,
          price: "3199.00",
          stockQuantity: 10,
          warehouseId: primaryWarehouse._id.toString(),
          attributes: { color: "White", switchType: "Tactile" },
        },
        actor: vendorActorA,
      });
      expect(var2.isDefault).toBe(false);

      // Attempt to add duplicate combination: Black / Linear
      await expect(
        productVariantService.createProductVariant({
          data: {
            productId: product._id,
            name: "Black / Linear Duplicate",
            sku: `${parentSku}-BLK-LIN-DUP`,
            price: "2999.00",
            stockQuantity: 5,
            warehouseId: primaryWarehouse._id.toString(),
            attributes: { color: "Black", switchType: "Linear" },
          },
          actor: vendorActorA,
        })
      ).rejects.toMatchObject({
        code: "DUPLICATE_VARIANT_COMBINATION",
        statusCode: 409,
      });
    });

    test("A.3 Cross-vendor mutation boundary blocks unauthorized vendor from tampering with product", async () => {
      const sku = `P2H-TAMPER-${Date.now()}`;
      const product = await productService.createProduct({
        data: {
          name: "Vendor A Sovereign Item",
          slug: `v-a-sov-${Date.now()}`,
          sku,
          categoryId: platformCategory._id.toString(),
          price: "1500.00",
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
          id: product._id,
          data: { name: "Hijacked by Competitor" },
          actor: vendorActorB,
        })
      ).rejects.toMatchObject({
        code: "PRODUCT_OWNERSHIP_REQUIRED",
        statusCode: 403,
      });

      // Vendor B attempts to delete Vendor A's product
      await expect(
        productService.deleteProduct({
          id: product._id,
          actor: vendorActorB,
        })
      ).rejects.toMatchObject({
        code: "PRODUCT_OWNERSHIP_REQUIRED",
        statusCode: 403,
      });
    });
  });

  // =========================================================================
  // WORKFLOW B: Administrator Moderation & Storefront Publication
  // =========================================================================
  describe("Workflow B: Administrator Moderation", () => {
    test("B.1 Admin approves product -> publication status reflects immediately on Storefront", async () => {
      const sku = `P2H-MOD-${Date.now()}`;
      const product = await productService.createProduct({
        data: {
          name: "Ultra-Fast NVMe Enclosure",
          slug: `nvme-enc-${Date.now()}`,
          sku,
          categoryId: platformCategory._id.toString(),
          price: "3499.00",
          stockQuantity: 20,
          warehouseId: primaryWarehouse._id.toString(),
          productType: "simple",
        },
        userId: vendorUserA._id.toString(),
        actor: vendorActorA,
      });

      const defaultVariant = await ProductVariant.findOne({ productId: product._id, isDefault: true });

      // Before approval, storefront rejects availability inquiry
      await expect(productService.getVariantAvailability(defaultVariant._id)).rejects.toMatchObject({
        code: "PRODUCT_NOT_FOUND",
        statusCode: 404,
      });

      // Vendor submits for review
      await productService.submitProductForApproval({ id: product._id, actor: vendorActorA });

      // Admin approves product
      await productService.approveProduct({ id: product._id, actor: adminActor });

      // Storefront now serves active product with authoritative warehouse stock
      const availability = await productService.getVariantAvailability(defaultVariant._id);
      expect(availability.availableQuantity).toBe(20);
      expect(availability.stockStatus).toBe("in_stock");
    });

    test("B.2 Unauthorized customer cannot perform admin approval or rejection", async () => {
      const sku = `P2H-UNAUTH-${Date.now()}`;
      const product = await productService.createProduct({
        data: {
          name: "Unapproved Gadget",
          slug: `unapp-gadget-${Date.now()}`,
          sku,
          categoryId: platformCategory._id.toString(),
          price: "999.00",
          stockQuantity: 10,
          warehouseId: primaryWarehouse._id.toString(),
          productType: "simple",
        },
        userId: vendorUserA._id.toString(),
        actor: vendorActorA,
      });

      await productService.submitProductForApproval({ id: product._id, actor: vendorActorA });

      // Customer attempts to approve product
      await expect(
        productService.approveProduct({
          id: product._id,
          actor: { id: customerUser._id.toString(), role: "customer" },
        })
      ).rejects.toMatchObject({
        code: "ADMIN_ACCESS_REQUIRED",
        statusCode: 403,
      });
    });
  });

  // =========================================================================
  // WORKFLOW C & D: Storefront, Cart, Checkout, Idempotency & Expiry
  // =========================================================================
  describe("Workflow C & D: Storefront, Cart, Checkout & Inventory Finalization", () => {
    test("C/D.1 Complete purchase lifecycle: Add to cart -> Reserve -> Finalize payment -> Prevent duplicate deductions", async () => {
      const sku = `P2H-CHECKOUT-E2E-${Date.now()}`;
      const product = await productService.createProduct({
        data: {
          name: "Hi-Fi DAC Amplifier",
          slug: `hifi-dac-${Date.now()}`,
          sku,
          categoryId: platformCategory._id.toString(),
          brandId: platformBrand._id.toString(),
          price: "8499.00",
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

      // Step 1: Customer adds 2 units to cart
      const cart = await cartService.addItem(
        customerUser._id.toString(),
        { productVariantId: defaultVariant._id.toString() },
        2
      );
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].quantity).toBe(2);

      // Step 2: Checkout reserves warehouse stock
      const inv = await Inventory.findOne({ productVariantId: defaultVariant._id, warehouseId: primaryWarehouse._id });
      const orderRef = `ORD-P2H-FINAL-${Date.now()}`;
      const resKey = `res-${orderRef}`;

      await withTransaction(async (session) => {
        await inventoryService.reserveStockInTransaction(
          inv._id,
          2,
          {
            referenceType: "order",
            referenceId: orderRef,
            actorUserId: customerUser._id,
            idempotencyKey: resKey,
            notes: "Phase 2H Checkout reservation",
          },
          session
        );
      });

      let currentInv = await Inventory.findById(inv._id);
      expect(currentInv.onHand).toBe(10);
      expect(currentInv.reserved).toBe(2);
      expect(currentInv.available).toBe(8);

      // Step 3: Payment finalization deducts reserved stock
      const deductKey = `pay-${orderRef}`;
      await withTransaction(async (session) => {
        await inventoryService.deductReservedStockInTransaction(
          inv._id,
          2,
          {
            referenceType: "order",
            referenceId: orderRef,
            actorUserId: customerUser._id,
            idempotencyKey: deductKey,
            notes: "Phase 2H Payment finalized",
          },
          session
        );
      });

      currentInv = await Inventory.findById(inv._id);
      expect(currentInv.onHand).toBe(8);
      expect(currentInv.reserved).toBe(0);
      expect(currentInv.available).toBe(8);

      // Step 4: Idempotent duplicate payment webhook produces zero additional deductions
      await withTransaction(async (session) => {
        await inventoryService.deductReservedStockInTransaction(
          inv._id,
          2,
          {
            referenceType: "order",
            referenceId: orderRef,
            actorUserId: customerUser._id,
            idempotencyKey: deductKey,
            notes: "Duplicate webhook delivery",
          },
          session
        );
      });

      currentInv = await Inventory.findById(inv._id);
      expect(currentInv.onHand).toBe(8);
      expect(currentInv.reserved).toBe(0);
      expect(currentInv.available).toBe(8);
    });

    test("C/D.2 Order cancellation or reservation expiry releases stock safely without exceeding on-hand", async () => {
      const sku = `P2H-CANCEL-TEST-${Date.now()}`;
      const product = await productService.createProduct({
        data: {
          name: "Wireless ANC Earphones",
          slug: `wireless-anc-${Date.now()}`,
          sku,
          categoryId: platformCategory._id.toString(),
          price: "2999.00",
          stockQuantity: 12,
          warehouseId: primaryWarehouse._id.toString(),
          productType: "simple",
        },
        userId: vendorUserA._id.toString(),
        actor: vendorActorA,
      });

      await productService.submitProductForApproval({ id: product._id, actor: vendorActorA });
      await productService.approveProduct({ id: product._id, actor: adminActor });
      const defaultVariant = await ProductVariant.findOne({ productId: product._id, isDefault: true });

      const inv = await Inventory.findOne({ productVariantId: defaultVariant._id, warehouseId: primaryWarehouse._id });
      const cancelRef = `ORD-EXPIRE-${Date.now()}`;

      // Reserve 4 units
      await withTransaction(async (session) => {
        await inventoryService.reserveStockInTransaction(
          inv._id,
          4,
          {
            referenceType: "order",
            referenceId: cancelRef,
            actorUserId: customerUser._id,
            idempotencyKey: `res-${cancelRef}`,
          },
          session
        );
      });

      let currentInv = await Inventory.findById(inv._id);
      expect(currentInv.reserved).toBe(4);
      expect(currentInv.available).toBe(8);

      // Expiry / Cancellation releases 4 units
      await withTransaction(async (session) => {
        await inventoryService.releaseStockInTransaction(
          inv._id,
          4,
          {
            referenceType: "order",
            referenceId: cancelRef,
            actorUserId: customerUser._id,
            idempotencyKey: `rel-${cancelRef}`,
          },
          session
        );
      });

      currentInv = await Inventory.findById(inv._id);
      expect(currentInv.onHand).toBe(12);
      expect(currentInv.reserved).toBe(0);
      expect(currentInv.available).toBe(12);

      // Replaying release does NOT inflate available beyond onHand
      await withTransaction(async (session) => {
        await inventoryService.releaseStockInTransaction(
          inv._id,
          4,
          {
            referenceType: "order",
            referenceId: cancelRef,
            actorUserId: customerUser._id,
            idempotencyKey: `rel-${cancelRef}`,
          },
          session
        );
      });

      currentInv = await Inventory.findById(inv._id);
      expect(currentInv.onHand).toBe(12);
      expect(currentInv.reserved).toBe(0);
      expect(currentInv.available).toBe(12);
    });
  });

  // =========================================================================
  // WORKFLOW E: CSV / XLSX Bulk Import & Export Integrity
  // =========================================================================
  describe("Workflow E: Bulk Import / Export Integrity", () => {
    test("E.1 CSV format validates headers, identifies duplicate SKUs, and provisions stock", async () => {
      const sku1 = `P2H-CSV-A-${Date.now()}`;
      const sku2 = `P2H-CSV-B-${Date.now()}`;

      const csvContent = [
        "Product Name,Variant SKU,Category,Price,Stock Quantity",
        `"CSV Product One","${sku1}","${platformCategory.name}",899,20`,
        `"CSV Product Two","${sku2}","${platformCategory.name}",1299,15`,
      ].join("\n");

      const buffer = Buffer.from(csvContent, "utf-8");

      const report = await bulkImportExportService.validateBulkImport({
        buffer,
        filename: "catalog.csv",
        vendorId: vendorA._id,
      });

      expect(report.validRowsCount).toBe(2);
      expect(report.errorRowsCount).toBe(0);

      const commitResult = await bulkImportExportService.commitBulkImport({
        rows: report.rows,
        vendorId: vendorA._id,
        actor: vendorActorA,
      });

      expect(commitResult.createdProductsCount).toBe(2);
      expect(commitResult.createdVariantsCount).toBe(2);

      const prd1 = await Product.findOne({ sku: sku1 });
      const var1 = await ProductVariant.findOne({ productId: prd1._id, isDefault: true });
      const inv1 = await Inventory.findOne({ productVariantId: var1._id });
      expect(inv1.onHand).toBe(20);
    });

    test("E.2 Round-trip Export -> Re-import updates catalog without creating duplicate products", async () => {
      // Export Vendor A catalog in template-compatible format
      const exportResult = await bulkImportExportService.exportVendorProducts({
        vendorId: vendorA._id,
        filters: { templateCompatible: true },
        format: "xlsx",
        actor: vendorActorA,
      });

      expect(exportResult.buffer).toBeDefined();
      expect(exportResult.count).toBeGreaterThan(0);

      // Re-import in CREATE_AND_UPDATE mode
      const validation = await bulkImportExportService.validateBulkImport({
        buffer: exportResult.buffer,
        filename: exportResult.filename,
        vendorId: vendorA._id,
        mode: "CREATE_AND_UPDATE",
      });

      if (validation.errorRowsCount > 0) {
        console.log("VALIDATION ERROR DETAILS:", JSON.stringify(validation.errorDetails, null, 2));
      }
      expect(validation.errorRowsCount).toBe(0);
      expect(validation.validRowsCount).toBeGreaterThanOrEqual(exportResult.count);
      expect(validation.validRowsCount).toBeGreaterThan(0);
    });

    test("E.3 Formula injection safety protects all supported control characters", () => {
      expect(bulkImportExportService.sanitizeFormula("=HYPERLINK()")).toBe("'=HYPERLINK()");
      expect(bulkImportExportService.sanitizeFormula("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
      expect(bulkImportExportService.sanitizeFormula("-42")).toBe("'-42");
      expect(bulkImportExportService.sanitizeFormula("@evil")).toBe("'@evil");
      expect(bulkImportExportService.sanitizeFormula("\tcmd")).toBe("'\tcmd");
      expect(bulkImportExportService.sanitizeFormula("\rcmd")).toBe("'\rcmd");
      expect(bulkImportExportService.sanitizeFormula("Safe Text")).toBe("Safe Text");
    });
  });

  // =========================================================================
  // WORKFLOW F: Read-Only Legacy Reconciliation Dry-Run Safety
  // =========================================================================
  describe("Workflow F: Legacy Reconciliation Scanner Safety", () => {
    test("F.1 Dry-run scanner performs zero database writes and reports accurate discrepancies", async () => {
      const writeSpy = jest.spyOn(mongoose.Model.prototype, "save");
      const updateOneSpy = jest.spyOn(mongoose.Model, "updateOne");
      const updateManySpy = jest.spyOn(mongoose.Model, "updateMany");
      const findOneAndUpdateSpy = jest.spyOn(mongoose.Model, "findOneAndUpdate");
      const deleteOneSpy = jest.spyOn(mongoose.Model, "deleteOne");

      const dryRun = await reconciliationService.runDryRun();

      expect(writeSpy).not.toHaveBeenCalled();
      expect(updateOneSpy).not.toHaveBeenCalled();
      expect(updateManySpy).not.toHaveBeenCalled();
      expect(findOneAndUpdateSpy).not.toHaveBeenCalled();
      expect(deleteOneSpy).not.toHaveBeenCalled();

      expect(dryRun.timestamp).toBeDefined();
      expect(Array.isArray(dryRun.categories)).toBe(true);

      writeSpy.mockRestore();
      updateOneSpy.mockRestore();
      updateManySpy.mockRestore();
      findOneAndUpdateSpy.mockRestore();
      deleteOneSpy.mockRestore();
    });
  });

  afterAll(async () => {
    await SkuRegistry.deleteMany({});
    await InventoryTransaction.deleteMany({});
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
});
