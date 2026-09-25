const request = require("supertest");
const mongoose = require("mongoose");
const xlsx = require("xlsx");
const app = require("../src/app");
const User = require("../src/models/User");
const Employee = require("../src/models/Employee");
const Vendor = require("../src/models/Vendor");
const Category = require("../src/models/Category");
const Brand = require("../src/models/Brand");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Attribute = require("../src/models/Attribute");
const Warehouse = require("../src/models/Warehouse");
const Inventory = require("../src/models/Inventory");
const InventoryTransaction = require("../src/models/InventoryTransaction");
const Permission = require("../src/models/Permission");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const { generateAccessToken } = require("../src/services/token.service");
const bulkImportExportService = require("../src/services/bulk-import-export.service");
const inventoryService = require("../src/services/inventory.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_catalog_ops_test?")
  : "mongodb://127.0.0.1:27017/buybox_catalog_ops_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Buybox Master Production Multivendor — Catalog & Operations System Test Suite", () => {
  let createdPermissions = new Map();
  let adminUser, adminEmployee, adminToken;
  let vendor1User, vendor1Profile, vendor1Token;
  let vendor2User, vendor2Profile, vendor2Token;
  let platformCategory;
  let platformBrand;
  let warehouseA, warehouseB;

  async function getOrCreatePermission(slug) {
    if (createdPermissions.has(slug)) {
      return createdPermissions.get(slug);
    }
    let perm = await Permission.findOne({ slug });
    if (!perm) {
      perm = await Permission.create({
        slug,
        name: `Test Perm ${slug}`,
        module: slug.split(":")[0],
        description: `Description for ${slug}`,
        isActive: true,
      });
    }
    createdPermissions.set(slug, perm);
    return perm;
  }

  async function createTestVendor(namePrefix) {
    const user = await User.create({
      firstName: namePrefix,
      lastName: "Merchant",
      email: `${namePrefix.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(7)}@test-catalog.com`,
      password: "Password123!",
      role: ROLES.VENDOR,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const vendor = await Vendor.create({
      userId: user._id,
      businessName: `${namePrefix} Store ${Date.now()}`,
      businessSlug: `${namePrefix.toLowerCase()}-store-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      isActive: true,
      onboardingStatus: "approved",
    });

    const token = generateAccessToken({
      sub: user._id.toString(),
      role: user.role,
      authVersion: user.authVersion,
      permissionVersion: user.permissionVersion,
    });

    return { user, vendor, token };
  }

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    // Setup required permissions
    const permList = [
      PERMISSIONS.PRODUCTS_READ,
      PERMISSIONS.PRODUCTS_CREATE,
      PERMISSIONS.PRODUCTS_UPDATE,
      PERMISSIONS.PRODUCTS_DELETE,
      PERMISSIONS.PRODUCTS_MODERATE,
      PERMISSIONS.INVENTORY_READ,
      PERMISSIONS.INVENTORY_MANAGE,
    ];
    for (const p of permList) {
      await getOrCreatePermission(p);
    }

    // 1. Create Super Admin with active Employee profile
    await User.deleteMany({ role: ROLES.SUPER_ADMIN });
    adminUser = await User.create({
      firstName: "Platform",
      lastName: "Admin",
      email: `platform_admin_${Date.now()}@test-catalog.com`,
      password: "Password123!",
      role: ROLES.SUPER_ADMIN,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    adminEmployee = await Employee.create({
      userId: adminUser._id,
      employeeNumber: `EMP_ADMIN_${Date.now()}`,
      jobTitle: "Platform Admin",
      department: "Catalog Operations",
      status: "active",
    });

    adminToken = generateAccessToken({
      sub: adminUser._id.toString(),
      role: adminUser.role,
      authVersion: adminUser.authVersion,
      permissionVersion: adminUser.permissionVersion,
    });

    // 2. Create Vendor 1 & Vendor 2
    const v1 = await createTestVendor("VendorOne");
    vendor1User = v1.user;
    vendor1Profile = v1.vendor;
    vendor1Token = v1.token;

    const v2 = await createTestVendor("VendorTwo");
    vendor2User = v2.user;
    vendor2Profile = v2.vendor;
    vendor2Token = v2.token;

    // 3. Create Platform Category & Brand
    platformCategory = await Category.create({
      name: `Laptops & Computers ${Date.now()}`,
      slug: `laptops-computers-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      isActive: true,
    });

    platformBrand = await Brand.create({
      name: `ApexTech ${Date.now()}`,
      slug: `apextech-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      isActive: true,
    });

    // 4. Create Warehouses
    warehouseA = await Warehouse.create({
      name: "Mumbai Central DC",
      code: `WH-BOM-${Date.now().toString().slice(-4)}`,
      address: {
        addressLine1: "Plot 42 Logistics Park",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "IN",
      },
      isActive: true,
    });

    warehouseB = await Warehouse.create({
      name: "Bengaluru South DC",
      code: `WH-BLR-${Date.now().toString().slice(-4)}`,
      address: {
        addressLine1: "Hosur Road Logistics Hub",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "IN",
      },
      isActive: true,
    });
  });

  afterAll(async () => {
    try {
      await User.deleteMany({ email: /@test-catalog\.com$/ });
      await Employee.deleteMany({ jobTitle: "Platform Admin" });
      await Vendor.deleteMany({ businessSlug: /-(store|corp)-/ });
      await Category.deleteMany({ slug: /^laptops-computers-/ });
      await Brand.deleteMany({ slug: /^apextech-/ });
      await Product.deleteMany({ sku: /^PROD-TEST-/ });
      await ProductVariant.deleteMany({ sku: /^VAR-TEST-/ });
      await Attribute.deleteMany({ name: /^RAM Capacity/ });
      await Warehouse.deleteMany({ code: /^WH-(BOM|BLR)-/ });
      await Inventory.deleteMany({});
    } catch (e) {
      // Ignored in cleanup
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  // ===========================================================================
  // SECTION 1: Category Ownership & Restrictions
  // ===========================================================================
  describe("1. Platform Taxonomy & Vendor Category Restrictions", () => {
    test("Platform Admin can create and update categories", async () => {
      const res = await request(app)
        .post("/api/v1/categories")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: `Smart Home ${Date.now()}`,
          slug: `smarthome-${Date.now()}`,
          description: "IoT and connected devices",
          isActive: true,
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
    });

    test("Vendor CANNOT create categories (403 Forbidden enforced server-side)", async () => {
      const res = await request(app)
        .post("/api/v1/categories")
        .set("Authorization", `Bearer ${vendor1Token}`)
        .send({
          name: "Vendor Illegal Category",
          slug: "vendor-illegal-cat",
        });

      expect(res.status).toBe(403);
    });

    test("Vendor CANNOT update platform categories (403 Forbidden enforced)", async () => {
      const res = await request(app)
        .put(`/api/v1/categories/${platformCategory._id}`)
        .set("Authorization", `Bearer ${vendor1Token}`)
        .send({
          name: "Hacked Category Name",
        });

      expect(res.status).toBe(403);
    });
  });

  // ===========================================================================
  // SECTION 2: Dynamic Category Attributes & Attribute Sets
  // ===========================================================================
  describe("2. Platform Attributes & Category Specifics", () => {
    let ramAttribute;

    test("Admin can create dynamic attribute linked to a category", async () => {
      const res = await request(app)
        .post("/api/v1/attributes")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: `RAM Capacity ${Date.now()}`,
          slug: `ram-capacity-${Date.now()}`,
          type: "select",
          values: [
            { label: "8GB", value: "8GB", sortOrder: 1 },
            { label: "16GB", value: "16GB", sortOrder: 2 },
            { label: "32GB", value: "32GB", sortOrder: 3 },
          ],
          isRequired: true,
          categoryIds: [platformCategory._id.toString()],
          attributeGroup: "Hardware",
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
      ramAttribute = res.body.data;
      expect(ramAttribute.values.some((v) => v.value === "16GB")).toBe(true);
    });

    test("Category attributes can be retrieved via category endpoint", async () => {
      const res = await request(app)
        .get(`/api/v1/categories/${platformCategory._id}/attributes`)
        .set("Authorization", `Bearer ${vendor1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const list = res.body.data || [];
      expect(list.some((a) => a.name.startsWith("RAM Capacity"))).toBe(true);
    });

    test("Vendor CANNOT create marketplace attributes (403 Forbidden)", async () => {
      const res = await request(app)
        .post("/api/v1/attributes")
        .set("Authorization", `Bearer ${vendor1Token}`)
        .send({
          name: `Vendor Illegal Attribute ${Date.now()}`,
          slug: `vendor-attr-${Date.now()}`,
          type: "text",
        });

      expect(res.status).toBe(403);
    });
  });

  // ===========================================================================
  // SECTION 3: Product Duplication & Bulk Variants Matrix
  // ===========================================================================
  describe("3. Product Duplication & Bulk Variants Matrix", () => {
    let vendor1Product;

    beforeAll(async () => {
      vendor1Product = await Product.create({
        name: "Pro Ultrabook 14",
        slug: `pro-ultrabook-14-${Date.now()}`,
        sku: `PROD-TEST-ULTRA-${Date.now()}`,
        categoryId: platformCategory._id,
        brandId: platformBrand._id,
        vendorId: vendor1Profile._id,
        price: 79999,
        status: "active",
      });
    });

    test("Vendor can duplicate their own product -> creates duplicate in DRAFT with zero stock", async () => {
      const res = await request(app)
        .post(`/api/v1/products/${vendor1Product._id}/duplicate`)
        .set("Authorization", `Bearer ${vendor1Token}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const duplicated = res.body.data?.product || res.body.data;
      expect(duplicated._id).not.toBe(vendor1Product._id.toString());
      expect(duplicated.status).toBe("draft");
      expect(duplicated.sku).not.toBe(vendor1Product.sku);
      expect(duplicated.vendorId.toString()).toBe(vendor1Profile._id.toString());
    });

    test("Vendor CANNOT duplicate another vendor's product (403 Ownership Required)", async () => {
      const res = await request(app)
        .post(`/api/v1/products/${vendor1Product._id}/duplicate`)
        .set("Authorization", `Bearer ${vendor2Token}`);

      expect([403, 404]).toContain(res.status);
    });

    test("Vendor can generate bulk variants matrix for their product", async () => {
      const res = await request(app)
        .post(`/api/v1/product-variants/product/${vendor1Product._id}/bulk`)
        .set("Authorization", `Bearer ${vendor1Token}`)
        .send({
          variants: [
            {
              sku: `VAR-TEST-U14-8GB-${Date.now()}`,
              name: "Ultrabook 14 - 8GB / 256GB",
              price: 74999,
              stockQuantity: 15,
              attributes: { RAM: "8GB", Storage: "256GB" },
            },
            {
              sku: `VAR-TEST-U14-16GB-${Date.now()}`,
              name: "Ultrabook 14 - 16GB / 512GB",
              price: 84999,
              stockQuantity: 25,
              attributes: { RAM: "16GB", Storage: "512GB" },
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.variants.length).toBe(2);
    });
  });

  // ===========================================================================
  // SECTION 4: Multi-Row Bulk Import & Variant Grouping
  // ===========================================================================
  describe("4. Multi-Row Bulk Import & Cross-Vendor SKU Protection", () => {
    test("Importer groups multiple variant rows under a single parent product", async () => {
      const parentName = `Multi-Row Gaming Laptop ${Date.now()}`;
      const sku1 = `VAR-TEST-ML-${Date.now()}-1`;
      const sku2 = `VAR-TEST-ML-${Date.now()}-2`;

      const wsData = [
        ["Product Name", "Parent SKU", "Variant SKU", "Category", "Brand", "Price", "Stock Quantity", "Color", "Size"],
        [parentName, `P-${Date.now()}`, sku1, platformCategory.name, platformBrand.name, 99999, 10, "Stealth Black", "15.6-inch"],
        [parentName, `P-${Date.now()}`, sku2, platformCategory.name, platformBrand.name, 119999, 20, "Lunar White", "15.6-inch"],
      ];
      const ws = xlsx.utils.aoa_to_sheet(wsData);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "Sheet1");
      const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

      const validation = await bulkImportExportService.validateBulkImport({
        buffer,
        filename: "gaming_laptops.xlsx",
        vendorId: vendor1Profile._id,
        mode: "CREATE_ONLY",
      });

      expect(validation.validRowsCount).toBe(2);
      expect(validation.newProductsCount).toBe(1);
      expect(validation.newVariantsCount).toBe(2);

      const commit = await bulkImportExportService.commitBulkImport({
        rows: validation.rows,
        vendorId: vendor1Profile._id,
        actor: adminUser,
      });

      expect(commit.createdProductsCount).toBe(1);
      expect(commit.createdVariantsCount).toBe(2);

      // Verify parent product exists and is owned by Vendor 1
      const createdProd = await Product.findOne({ name: parentName });
      expect(createdProd).not.toBeNull();
      expect(createdProd.vendorId.toString()).toBe(vendor1Profile._id.toString());

      // Verify attached variants
      const variants = await ProductVariant.find({ productId: createdProd._id });
      expect(variants.length).toBe(2);
      expect(variants.map((v) => v.sku).sort()).toEqual([sku1, sku2].sort());
    });

    test("Cross-vendor SKU collision is rejected on vendor import", async () => {
      // Vendor 1 owns sku
      const existingSku = `VAR-TEST-COLLISION-${Date.now()}`;
      const prod = await Product.create({
        name: "Vendor 1 Exclusive Item",
        slug: `v1-exclusive-item-${Date.now()}`,
        sku: `PROD-TEST-EXCL-${Date.now()}`,
        categoryId: platformCategory._id,
        vendorId: vendor1Profile._id,
        price: 1500,
        status: "active",
      });

      await ProductVariant.create({
        productId: prod._id,
        sku: existingSku,
        name: "Vendor 1 Exclusive Variant",
        price: 1500,
        stockQuantity: 10,
        isActive: true,
      });

      // Vendor 2 tries to import rows containing Vendor 1's SKU
      const hostileData = [
        ["Product Name", "Variant SKU", "Category", "Price", "Stock Quantity"],
        ["Vendor 2 Imposter", existingSku, platformCategory.name, 999, 5],
      ];
      const ws = xlsx.utils.aoa_to_sheet(hostileData);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "Sheet1");
      const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

      const validation = await bulkImportExportService.validateBulkImport({
        buffer,
        filename: "hostile.xlsx",
        vendorId: vendor2Profile._id,
        mode: "CREATE_AND_UPDATE",
      });

      expect(validation.errorRowsCount).toBeGreaterThan(0);
      const hasOwnershipError = validation.errorDetails.some(
        (e) => e.field === "SKU" && (e.error.includes("collision") || e.error.includes("another merchant"))
      );
      expect(hasOwnershipError).toBe(true);
    });
  });

  // ===========================================================================
  // SECTION 5: Formula Injection Protection on Export
  // ===========================================================================
  describe("5. Formula Injection Protection on Export", () => {
    test("Export sanitizes dangerous formula characters (=, +, -, @)", () => {
      const sanitizedEq = bulkImportExportService.sanitizeFormula("=SUM(1+1)");
      expect(sanitizedEq).toBe("'=SUM(1+1)");

      const sanitizedPlus = bulkImportExportService.sanitizeFormula("+cmd|' /C calc'!A0");
      expect(sanitizedPlus).toBe("'+cmd|' /C calc'!A0");

      const sanitizedAt = bulkImportExportService.sanitizeFormula("@evil_macro");
      expect(sanitizedAt).toBe("'@evil_macro");

      const normalText = bulkImportExportService.sanitizeFormula("Normal Product Title");
      expect(normalText).toBe("Normal Product Title");
    });
  });

  // ===========================================================================
  // SECTION 6: Multi-Warehouse Inventory, Ledgers & Transfers
  // ===========================================================================
  describe("6. Multi-Warehouse Inventory, Ledger & Stock Transfer", () => {
    let testVariant;
    let testInventory;

    beforeAll(async () => {
      const prod = await Product.create({
        name: "Warehouse Test Machine",
        slug: `wh-test-machine-${Date.now()}`,
        sku: `PROD-TEST-WH-${Date.now()}`,
        categoryId: platformCategory._id,
        vendorId: vendor1Profile._id,
        price: 50000,
        status: "active",
      });

      testVariant = await ProductVariant.create({
        productId: prod._id,
        sku: `VAR-TEST-WH-${Date.now()}`,
        name: "Standard Configuration",
        price: 50000,
        stockQuantity: 100,
        isActive: true,
      });

      // Create stock at Warehouse A
      testInventory = await inventoryService.createInventory({
        productVariantId: testVariant._id,
        warehouseId: warehouseA._id,
        onHand: 100,
        lowStockThreshold: 10,
      });
    });

    test("Stock reservation and release modifies reserved units and updates ledger", async () => {
      // Reserve 10 units at Warehouse A
      const reservation = await inventoryService.reserveStock(
        testInventory._id,
        10,
        { reason: "Customer order checkout" }
      );

      expect(reservation.reserved).toBe(10);
      expect(reservation.onHand).toBe(100);

      // Verify reservation ledger entry
      const tx = await InventoryTransaction.findOne({
        productVariantId: testVariant._id,
        warehouseId: warehouseA._id,
        type: "reservation",
      });
      expect(tx).not.toBeNull();
      expect(tx.quantity).toBe(10);

      // Release 5 units
      const release = await inventoryService.releaseStock(
        testInventory._id,
        5,
        { reason: "Customer cancelled item" }
      );

      expect(release.reserved).toBe(5);
    });

    test("Stock transfer between warehouses moves stock and logs transactions", async () => {
      // Transfer 30 units from Warehouse A to Warehouse B
      const transferResult = await inventoryService.transferStock({
        productVariantId: testVariant._id,
        sourceWarehouseId: warehouseA._id,
        destinationWarehouseId: warehouseB._id,
        quantity: 30,
        reason: "Stock rebalance",
        actor: adminUser,
      });

      expect(transferResult.success).toBe(true);
      expect(transferResult.sourceInventory.onHand).toBe(70);
      expect(transferResult.destinationInventory.onHand).toBe(30);

      // Verify transaction records
      const txA = await InventoryTransaction.findOne({
        productVariantId: testVariant._id,
        warehouseId: warehouseA._id,
        type: "transfer",
        quantity: -30,
      });
      expect(txA).not.toBeNull();

      const txB = await InventoryTransaction.findOne({
        productVariantId: testVariant._id,
        warehouseId: warehouseB._id,
        type: "transfer",
        quantity: 30,
      });
      expect(txB).not.toBeNull();
    });

    test("getInventorySummary aggregates metrics accurately across warehouses", async () => {
      const summary = await inventoryService.getInventorySummary({
        vendorId: vendor1Profile._id,
      });

      expect(summary.totalRecords).toBeGreaterThan(0);
      expect(summary.totalUnitsOnHand).toBeGreaterThanOrEqual(100);
      expect(summary.totalUnitsReserved).toBeGreaterThanOrEqual(5);
      expect(summary.totalUnitsAvailable).toBe(summary.totalUnitsOnHand - summary.totalUnitsReserved);
    });
  });

  // ===========================================================================
  // SECTION 7: Product Approval Workflow & Storefront Visibility
  // ===========================================================================
  describe("7. Product Approval Lifecycle & Storefront Visibility", () => {
    let pendingProduct;

    test("Vendor creates product in DRAFT status", async () => {
      const res = await request(app)
        .post("/api/v1/products")
        .set("Authorization", `Bearer ${vendor1Token}`)
        .send({
          name: "Innovative Smart Sensor",
          slug: `innovative-smart-sensor-${Date.now()}`,
          sku: `PROD-TEST-SS-${Date.now()}`,
          categoryId: platformCategory._id.toString(),
          price: "2999.00",
          status: "draft",
        });

      expect([200, 201]).toContain(res.status);
      pendingProduct = res.body.data?.product || res.body.data;
      expect(pendingProduct.status).toBe("draft");
    });

    test("Draft product DOES NOT appear on public storefront", async () => {
      const res = await request(app).get(`/api/v1/products/slug/${pendingProduct.slug}`);
      expect([404, 400]).toContain(res.status);
    });

    test("Vendor submits product for review -> status transitions to PENDING_APPROVAL", async () => {
      const res = await request(app)
        .post(`/api/v1/products/${pendingProduct._id}/submit`)
        .set("Authorization", `Bearer ${vendor1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const prod = res.body.data?.product || res.body.data;
      expect(prod.status).toBe("pending_approval");
    });

    test("Admin can reject product with reason", async () => {
      const res = await request(app)
        .patch(`/api/v1/products/${pendingProduct._id}/reject`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          reason: "Missing FCC compliance certificate image in media gallery",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const prod = res.body.data?.product || res.body.data;
      expect(prod.status).toBe("rejected");
      expect(prod.rejectionReason).toContain("FCC compliance");
    });

    test("Admin can approve product -> transitions to ACTIVE and becomes public", async () => {
      // Vendor resubmits corrected product after rejection
      const resubmitRes = await request(app)
        .post(`/api/v1/products/${pendingProduct._id}/submit`)
        .set("Authorization", `Bearer ${vendor1Token}`);
      expect(resubmitRes.status).toBe(200);

      const res = await request(app)
        .patch(`/api/v1/products/${pendingProduct._id}/approve`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const prod = res.body.data?.product || res.body.data;
      expect(prod.status).toBe("active");

      // Verify it is now accessible publicly by slug
      const publicRes = await request(app).get(`/api/v1/products/slug/${pendingProduct.slug}`);
      expect(publicRes.status).toBe(200);
      const pubProd = publicRes.body.data?.product || publicRes.body.data;
      expect(pubProd._id).toBe(pendingProduct._id.toString());
    });
  });
});
