const request = require("supertest");
const mongoose = require("mongoose");
const xlsx = require("xlsx");
const app = require("../src/app");
const User = require("../src/models/User");
const Customer = require("../src/models/Customer");
const Vendor = require("../src/models/Vendor");
const Category = require("../src/models/Category");
const Brand = require("../src/models/Brand");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Warehouse = require("../src/models/Warehouse");
const Inventory = require("../src/models/Inventory");
const Order = require("../src/models/Order");
const ReturnRequest = require("../src/models/ReturnRequest");
const { VendorSettlement } = require("../src/models/VendorSettlement");
const { hashPassword } = require("../src/utils/password");
const { generateAccessToken } = require("../src/services/token.service");
const { ROLES } = require("../src/constants/auth.constants");
const { ROLE_PERMISSIONS } = require("../src/constants/role-permissions.constants");
const { encodeSecureId, decodeSecureId } = require("../src/utils/secure-id.util");

describe("Vendor Dashboard & Multi-Tenant Isolation Suite", () => {
  let customerUser;
  let customerToken;

  let pendingVendorUser;
  let pendingVendorToken;
  let pendingVendorDoc;

  let approvedVendorUserA;
  let approvedVendorTokenA;
  let approvedVendorDocA;

  let approvedVendorUserB;
  let approvedVendorTokenB;
  let approvedVendorDocB;

  let suspendedVendorUser;
  let suspendedVendorToken;
  let suspendedVendorDoc;

  let testWarehouse;
  let testCategory;
  let testBrand;
  let productA;
  let variantA;
  let inventoryA;
  let productB;
  let variantB;
  let testOrderA;
  let testMultiVendorOrder;

  const TEST_MONGODB_URI = process.env.MONGODB_URI
    ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_vendor_dash_test?")
    : "mongodb://127.0.0.1:27017/buybox_vendor_dash_test?replicaSet=rs0";

  jest.setTimeout(45000);

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    const uniqueStamp = Date.now();

    // 1. Customer user
    customerUser = await User.create({
      email: `cust-${uniqueStamp}@buybox.test`,
      password: await hashPassword("Password123!"),
      firstName: "Retail",
      lastName: "Shopper",
      role: ROLES.CUSTOMER,
      isActive: true,
    });
    await Customer.create({ userId: customerUser._id });
    customerToken = generateAccessToken({
      sub: customerUser._id.toString(),
      id: customerUser._id.toString(),
      role: customerUser.role,
      roles: [customerUser.role],
      permissions: ROLE_PERMISSIONS[ROLES.CUSTOMER] || [],
    });

    // 2. Pending Vendor (onboardingStatus: 'pending', isActive: false)
    pendingVendorUser = await User.create({
      email: `pending-${uniqueStamp}@buybox.test`,
      password: await hashPassword("Password123!"),
      firstName: "Pending",
      lastName: "Seller",
      role: ROLES.VENDOR,
      isActive: true,
    });
    pendingVendorDoc = await Vendor.create({
      userId: pendingVendorUser._id,
      businessName: "Pending Shop",
      businessSlug: `pending-shop-${uniqueStamp}`,
      onboardingStatus: "pending",
      isActive: false,
    });
    pendingVendorToken = generateAccessToken({
      sub: pendingVendorUser._id.toString(),
      id: pendingVendorUser._id.toString(),
      role: pendingVendorUser.role,
      roles: [pendingVendorUser.role],
      permissions: ROLE_PERMISSIONS[ROLES.VENDOR] || [],
    });

    // 3. Approved Vendor A
    approvedVendorUserA = await User.create({
      email: `vendor-a-${uniqueStamp}@buybox.test`,
      password: await hashPassword("Password123!"),
      firstName: "Vendor",
      lastName: "Alpha",
      role: ROLES.VENDOR,
      isActive: true,
    });
    approvedVendorDocA = await Vendor.create({
      userId: approvedVendorUserA._id,
      businessName: "Alpha Store",
      businessSlug: `alpha-store-${uniqueStamp}`,
      onboardingStatus: "approved",
      isActive: true,
    });
    approvedVendorTokenA = generateAccessToken({
      sub: approvedVendorUserA._id.toString(),
      id: approvedVendorUserA._id.toString(),
      role: approvedVendorUserA.role,
      roles: [approvedVendorUserA.role],
      permissions: ROLE_PERMISSIONS[ROLES.VENDOR] || [],
    });

    // 4. Approved Vendor B
    approvedVendorUserB = await User.create({
      email: `vendor-b-${uniqueStamp}@buybox.test`,
      password: await hashPassword("Password123!"),
      firstName: "Vendor",
      lastName: "Beta",
      role: ROLES.VENDOR,
      isActive: true,
    });
    approvedVendorDocB = await Vendor.create({
      userId: approvedVendorUserB._id,
      businessName: "Beta Store",
      businessSlug: `beta-store-${uniqueStamp}`,
      onboardingStatus: "approved",
      isActive: true,
    });
    approvedVendorTokenB = generateAccessToken({
      sub: approvedVendorUserB._id.toString(),
      id: approvedVendorUserB._id.toString(),
      role: approvedVendorUserB.role,
      roles: [approvedVendorUserB.role],
      permissions: ROLE_PERMISSIONS[ROLES.VENDOR] || [],
    });

    // 5. Suspended Vendor
    suspendedVendorUser = await User.create({
      email: `suspended-${uniqueStamp}@buybox.test`,
      password: await hashPassword("Password123!"),
      firstName: "Suspended",
      lastName: "Seller",
      role: ROLES.VENDOR,
      isActive: true,
    });
    suspendedVendorDoc = await Vendor.create({
      userId: suspendedVendorUser._id,
      businessName: "Suspended Store",
      businessSlug: `suspended-store-${uniqueStamp}`,
      onboardingStatus: "suspended",
      isActive: false,
    });
    suspendedVendorToken = generateAccessToken({
      sub: suspendedVendorUser._id.toString(),
      id: suspendedVendorUser._id.toString(),
      role: suspendedVendorUser.role,
      roles: [suspendedVendorUser.role],
      permissions: ROLE_PERMISSIONS[ROLES.VENDOR] || [],
    });

    // Setup Category, Brand, Warehouse
    testCategory = await Category.create({
      name: `Category-${uniqueStamp}`,
      slug: `category-${uniqueStamp}`,
      isActive: true,
    });

    testBrand = await Brand.create({
      name: `Brand-${uniqueStamp}`,
      slug: `brand-${uniqueStamp}`,
      isActive: true,
    });

    testWarehouse = await Warehouse.create({
      name: "Mumbai Regional Fulfillment Center",
      code: `WH-MUM-${uniqueStamp.toString().slice(-6)}`,
      address: {
        addressLine1: "123 Logistics Park",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "IN",
      },
      isActive: true,
    });

    // Product A for Vendor A
    productA = await Product.create({
      name: "Alpha Wireless Headphones",
      title: "Alpha Wireless Headphones",
      slug: `alpha-headphones-${uniqueStamp}`,
      sku: `SKU-ALPHA-${uniqueStamp}`,
      price: 1999.0,
      vendorId: approvedVendorDocA._id,
      categoryId: testCategory._id,
      brandId: testBrand._id,
      status: "active",
      taxCategory: "standard",
    });

    variantA = await ProductVariant.create({
      productId: productA._id,
      sku: `VAR-ALPHA-${uniqueStamp}`,
      price: 1999.0,
      stockQuantity: 3,
    });

    // Inventory record for Variant A in warehouse (low stock: onHand 3 <= threshold 5)
    inventoryA = await Inventory.create({
      productVariantId: variantA._id,
      warehouseId: testWarehouse._id,
      onHand: 3,
      reserved: 0,
      lowStockThreshold: 5,
    });

    // Product B for Vendor B
    productB = await Product.create({
      name: "Beta Mechanical Keyboard",
      title: "Beta Mechanical Keyboard",
      slug: `beta-keyboard-${uniqueStamp}`,
      sku: `SKU-BETA-${uniqueStamp}`,
      price: 4999.0,
      vendorId: approvedVendorDocB._id,
      categoryId: testCategory._id,
      brandId: testBrand._id,
      status: "active",
      taxCategory: "standard",
    });

    variantB = await ProductVariant.create({
      productId: productB._id,
      sku: `VAR-BETA-${uniqueStamp}`,
      price: 4999.0,
      stockQuantity: 20,
    });

    // Order containing only Vendor A's product
    testOrderA = await Order.create({
      orderNumber: `ORD-A-${uniqueStamp}`,
      customerId: customerUser._id,
      status: "confirmed",
      fulfillmentStatus: "unfulfilled",
      currency: "INR",
      subtotal: "1999.00",
      totalAmount: "1999.00",
      grandTotal: "1999.00",
      shippingAddress: {
        fullName: "Test Customer",
        phone: "9876543210",
        addressLine1: "123 Main St",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "IN",
      },
      items: [
        {
          productId: productA._id,
          productVariantId: variantA._id,
          warehouseId: testWarehouse._id,
          vendorId: approvedVendorDocA._id,
          sku: variantA.sku,
          productName: productA.name,
          quantity: 1,
          unitPrice: 1999.0,
          lineTotal: 1999.0,
          currency: "INR",
        },
      ],
    });

    // Multi-vendor order containing items from both Vendor A (₹1999) and Vendor B (₹4999)
    testMultiVendorOrder = await Order.create({
      orderNumber: `ORD-MULTI-${uniqueStamp}`,
      customerId: customerUser._id,
      status: "processing",
      fulfillmentStatus: "partially_fulfilled",
      currency: "INR",
      subtotal: "6998.00",
      totalAmount: "6998.00",
      grandTotal: "6998.00",
      shippingAddress: {
        fullName: "Multi Buyer",
        phone: "9876543211",
        addressLine1: "456 Market St",
        city: "Pune",
        state: "Maharashtra",
        postalCode: "411001",
        country: "IN",
      },
      items: [
        {
          productId: productA._id,
          productVariantId: variantA._id,
          warehouseId: testWarehouse._id,
          vendorId: approvedVendorDocA._id,
          sku: variantA.sku,
          productName: productA.name,
          quantity: 1,
          unitPrice: 1999.0,
          lineTotal: 1999.0,
          currency: "INR",
        },
        {
          productId: productB._id,
          productVariantId: variantB._id,
          warehouseId: testWarehouse._id,
          vendorId: approvedVendorDocB._id,
          sku: variantB.sku,
          productName: productB.name,
          quantity: 1,
          unitPrice: 4999.0,
          lineTotal: 4999.0,
          currency: "INR",
        },
      ],
    });
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await User.deleteMany({ email: /@buybox\.test$/ });
      await Vendor.deleteMany({ _id: { $in: [pendingVendorDoc?._id, approvedVendorDocA?._id, approvedVendorDocB?._id, suspendedVendorDoc?._id] } });
      await Product.deleteMany({ _id: { $in: [productA?._id, productB?._id] } });
      await ProductVariant.deleteMany({ _id: { $in: [variantA?._id, variantB?._id] } });
      await Inventory.deleteMany({ _id: inventoryA?._id });
      await Order.deleteMany({ _id: { $in: [testOrderA?._id, testMultiVendorOrder?._id] } });
      await Warehouse.deleteMany({ _id: testWarehouse?._id });
      await Category.deleteMany({ _id: testCategory?._id });
      await Brand.deleteMany({ _id: testBrand?._id });
      await mongoose.disconnect();
    }
  });

  describe("1. Secure Identifier Utility Tests", () => {
    it("encodes MongoDB ObjectId into an opaque prefixed secure string", () => {
      const orderId = testOrderA._id.toString();
      const secureId = encodeSecureId("order", orderId);

      expect(secureId).toBeDefined();
      expect(secureId.startsWith("ord_")).toBe(true);
      expect(secureId).not.toContain(orderId);
    });

    it("decodes valid opaque secure string back to the exact original ObjectId", () => {
      const orderId = testOrderA._id.toString();
      const secureId = encodeSecureId("order", orderId);
      const decoded = decodeSecureId(secureId, "order");

      expect(decoded).toBe(orderId);
    });

    it("rejects token with mismatched expected resource type", () => {
      const orderId = testOrderA._id.toString();
      const secureId = encodeSecureId("order", orderId);

      expect(() => {
        decodeSecureId(secureId, "product");
      }).toThrow(/mismatch/i);
    });

    it("rejects corrupted or tampered secure identifier", () => {
      expect(() => {
        decodeSecureId("ord_corruptedtoken123", "order");
      }).toThrow();
    });

    it("transparently accepts valid 24-char hex ObjectId for backward compatibility", () => {
      const rawId = testOrderA._id.toString();
      const decoded = decodeSecureId(rawId, "order");
      expect(decoded).toBe(rawId);
    });
  });

  describe("2. Onboarding Status & Access Control Gating", () => {
    it("rejects unauthenticated caller from accessing vendor dashboard", async () => {
      const res = await request(app).get("/api/v1/vendors/me/dashboard");
      expect(res.status).toBe(401);
    });

    it("rejects customer from accessing vendor dashboard", async () => {
      const res = await request(app)
        .get("/api/v1/vendors/me/dashboard")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });

    it("rejects pending vendor (onboardingStatus: pending) from accessing dashboard operations", async () => {
      const res = await request(app)
        .get("/api/v1/vendors/me/dashboard")
        .set("Authorization", `Bearer ${pendingVendorToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("VENDOR_ONBOARDING_NOT_APPROVED");
    });

    it("rejects suspended vendor from accessing dashboard operations", async () => {
      const res = await request(app)
        .get("/api/v1/vendors/me/dashboard")
        .set("Authorization", `Bearer ${suspendedVendorToken}`);

      expect(res.status).toBe(403);
    });

    it("allows approved vendor to access dashboard analytics with real live data", async () => {
      const res = await request(app)
        .get("/api/v1/vendors/me/dashboard?range=30d")
        .set("Authorization", `Bearer ${approvedVendorTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const { data } = res.body;
      expect(data).toBeDefined();
      expect(data.metrics).toBeDefined();

      // Real database calculations
      expect(Number(data.metrics.productsCount)).toBeGreaterThanOrEqual(1);
      expect(Number(data.metrics.ordersCount)).toBeGreaterThanOrEqual(2);
      expect(Number(data.metrics.lowStockCount)).toBeGreaterThanOrEqual(1);
      expect(Number(data.metrics.totalSales)).toBeGreaterThan(0);

      // Real time series
      expect(Array.isArray(data.salesTrends)).toBe(true);
      expect(data.salesTrends.length).toBeGreaterThan(0);

      // Real recent orders with secureId
      expect(Array.isArray(data.recentOrders)).toBe(true);
      expect(data.recentOrders.length).toBeGreaterThanOrEqual(1);
      expect(data.recentOrders[0].secureId).toMatch(/^ord_/);

      // Real alerts generated from live inventory
      expect(Array.isArray(data.alerts)).toBe(true);
      const lowStockAlert = data.alerts.find((a) => a.title.includes("Low Stock"));
      expect(lowStockAlert).toBeDefined();
    });
  });

  describe("3. Vendor Inventory & Warehouse Scoping", () => {
    it("allows approved vendor to view their inventory records", async () => {
      const res = await request(app)
        .get("/api/v1/inventory/vendor/my")
        .set("Authorization", `Bearer ${approvedVendorTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const item = res.body.data.find((i) => i.sku === variantA.sku);
      expect(item).toBeDefined();
      expect(item.secureId).toMatch(/^inv_/);
      expect(item.onHand).toBe(3);
      expect(item.isLowStock).toBe(true);
    });

    it("prevents Vendor B from seeing Vendor A's inventory in vendor inventory endpoint", async () => {
      const res = await request(app)
        .get("/api/v1/inventory/vendor/my")
        .set("Authorization", `Bearer ${approvedVendorTokenB}`);

      expect(res.status).toBe(200);
      // Vendor B should not see variant A's SKU
      const foundItemA = res.body.data.find((i) => i.sku === variantA.sku);
      expect(foundItemA).toBeUndefined();
    });

    it("allows vendor to view authorized warehouses with vendor-specific stock metrics", async () => {
      const res = await request(app)
        .get("/api/v1/warehouses/vendor/my")
        .set("Authorization", `Bearer ${approvedVendorTokenA}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);

      const wh = res.body.data.find((w) => w.code === testWarehouse.code);
      expect(wh).toBeDefined();
      expect(wh.secureId).toMatch(/^wh_/);
      expect(wh.vendorStockOnHand).toBe(3);
      expect(wh.vendorSKUsCount).toBe(1);
      expect(wh.vendorLowStockCount).toBe(1);
    });
  });

  describe("4. Multi-Vendor Order Scoping & Tenant Isolation", () => {
    it("strictly isolates multi-vendor order items and subtotal to Vendor A", async () => {
      const res = await request(app)
        .get(`/api/v1/orders/vendor/my/${testMultiVendorOrder._id}`)
        .set("Authorization", `Bearer ${approvedVendorTokenA}`);

      expect(res.status).toBe(200);
      const orderData = res.body.data;

      // Must contain only Vendor A's items (1 item), not Vendor B's keyboard
      expect(orderData.items.length).toBe(1);
      expect(orderData.items[0].sku).toBe(variantA.sku);
      expect(orderData.items[0].productName).toBe(productA.name);

      // Subtotal must be only Vendor A's amount (1999.00), not the full 6998.00!
      expect(orderData.subtotal).toBe("1999.00");
    });

    it("strictly isolates multi-vendor order items and subtotal to Vendor B", async () => {
      const res = await request(app)
        .get(`/api/v1/orders/vendor/my/${testMultiVendorOrder._id}`)
        .set("Authorization", `Bearer ${approvedVendorTokenB}`);

      expect(res.status).toBe(200);
      const orderData = res.body.data;

      // Must contain only Vendor B's items (1 item), not Vendor A's headphones
      expect(orderData.items.length).toBe(1);
      expect(orderData.items[0].sku).toBe(variantB.sku);
      expect(orderData.items[0].productName).toBe(productB.name);

      // Subtotal must be only Vendor B's amount (4999.00)
      expect(orderData.subtotal).toBe("4999.00");
    });

    it("prevents Vendor B from accessing an order containing only Vendor A items (returns 404)", async () => {
      const res = await request(app)
        .get(`/api/v1/orders/vendor/my/${testOrderA._id}`)
        .set("Authorization", `Bearer ${approvedVendorTokenB}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("ORDER_NOT_FOUND");
    });
  });

  describe("5. Vendor Self-Service Settlements & Finance", () => {
    it("allows approved vendor to fetch their settlements history", async () => {
      const settlement = await VendorSettlement.create({
        vendorId: approvedVendorDocA._id,
        settlementNumber: `STL-ALPHA-${Date.now()}`,
        periodStart: new Date(Date.now() - 14 * 86400000),
        periodEnd: new Date(),
        currency: "INR",
        grossSales: 5000.0,
        discounts: 0,
        refunds: 0,
        platformCommission: 500.0,
        netPayable: 4500.0,
        status: "pending",
      });

      const res = await request(app)
        .get("/api/v1/vendor-settlements/vendor/my")
        .set("Authorization", `Bearer ${approvedVendorTokenA}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);

      const foundStl = res.body.data.find((s) => s.settlementNumber === settlement.settlementNumber);
      expect(foundStl).toBeDefined();
      expect(foundStl.secureId).toMatch(/^stl_/);
      expect(Number(foundStl.netPayable)).toBe(4500);

      // Cleanup
      await VendorSettlement.findByIdAndDelete(settlement._id);
    });
  });

  describe("6. Bulk Product Import & Export Operations", () => {
    it("downloads CSV and XLSX product import templates", async () => {
      // CSV template
      const resCsv = await request(app)
        .get("/api/v1/products/vendor/import/template?format=csv")
        .set("Authorization", `Bearer ${approvedVendorTokenA}`);

      expect(resCsv.status).toBe(200);
      expect(resCsv.headers["content-type"]).toContain("text/csv");
      expect(resCsv.headers["content-disposition"]).toContain("buybox_product_import_template.csv");

      // XLSX template
      const resXlsx = await request(app)
        .get("/api/v1/products/vendor/import/template?format=xlsx")
        .set("Authorization", `Bearer ${approvedVendorTokenA}`);

      expect(resXlsx.status).toBe(200);
      expect(resXlsx.headers["content-type"]).toContain("spreadsheetml");
      expect(resXlsx.headers["content-disposition"]).toContain("buybox_product_import_template.xlsx");
    });

    it("validates CSV import with Category and Brand resolution, reporting row-by-row status", async () => {
      const csvData = [
        "Product Name,SKU,Description,Category,Brand,Price,Compare At Price,Stock Quantity,Tax Category,Weight,Dimensions",
        `Test Headphones Import,SKU-HP-${Date.now()},Great audio quality,${testCategory.name},${testBrand.name},2499.00,3499.00,45,standard,0.4,15x15x5`,
        "Invalid Row Missing Price,SKU-ERR-1,Description,Electronics,AuraVue,,,10,standard,,",
      ].join("\n");

      const res = await request(app)
        .post("/api/v1/products/vendor/import/validate")
        .set("Authorization", `Bearer ${approvedVendorTokenA}`)
        .attach("file", Buffer.from(csvData), "import_test.csv");

      expect(res.status).toBe(200);
      const report = res.body.data;
      expect(report.totalRows).toBe(2);
      expect(report.validCount).toBe(1);
      expect(report.errorCount).toBe(1);

      const validRow = report.results.find((r) => r.isValid);
      expect(validRow).toBeDefined();
      expect(validRow.row.name).toBe("Test Headphones Import");
      expect(validRow.row.categoryId).toBe(testCategory._id.toString());
      expect(validRow.row.brandId).toBe(testBrand._id.toString());
      expect(validRow.action).toBe("create");

      const errorRow = report.results.find((r) => !r.isValid);
      expect(errorRow).toBeDefined();
      expect(errorRow.errors.length).toBeGreaterThan(0);
      expect(errorRow.errors.some((e) => e.includes("Price"))).toBe(true);
    });

    it("prevents cross-vendor SKU collision during bulk validation (Vendor B cannot take Vendor A SKU)", async () => {
      const collisionCsv = [
        "Product Name,SKU,Description,Category,Brand,Price,Compare At Price,Stock Quantity,Tax Category,Weight,Dimensions",
        `Stolen Headphones,${variantA.sku},Trying to steal SKU,${testCategory.name},${testBrand.name},1999.00,,10,standard,,`,
      ].join("\n");

      const res = await request(app)
        .post("/api/v1/products/vendor/import/validate")
        .set("Authorization", `Bearer ${approvedVendorTokenB}`) // Vendor B tries to upload Vendor A's SKU
        .attach("file", Buffer.from(collisionCsv), "collision.csv");

      expect(res.status).toBe(200);
      const report = res.body.data;
      expect(report.errorCount).toBe(1);
      const errorRow = report.results[0];
      expect(errorRow.isValid).toBe(false);
      expect(errorRow.errors.some((e) => e.includes("already registered by another"))).toBe(true);
    });

    it("commits bulk import rows, creating draft products, variants, and warehouse inventory", async () => {
      const uniqueSku = `SKU-CMT-${Date.now()}`;
      const validRows = [
        {
          name: "Bulk Imported Product A",
          sku: uniqueSku,
          description: "Authoritative bulk import test item",
          categoryId: testCategory._id,
          brandId: testBrand._id,
          price: 1599.0,
          compareAtPrice: 1999.0,
          stockQuantity: 75,
          taxCategory: "standard",
          weight: 0.5,
          dimensions: "10x10x10",
          action: "create",
          status: "VALID",
        },
      ];

      const res = await request(app)
        .post("/api/v1/products/vendor/import/commit")
        .set("Authorization", `Bearer ${approvedVendorTokenA}`)
        .send({ rows: validRows });

      expect(res.status).toBe(201);
      expect(res.body.data.createdCount).toBe(1);

      // Verify created product in database
      const createdPrd = await Product.findOne({ sku: uniqueSku });
      expect(createdPrd).toBeDefined();
      expect(createdPrd.vendorId.toString()).toBe(approvedVendorDocA._id.toString());
      expect(createdPrd.status).toBe("draft"); // Newly imported products must start in draft

      // Verify variant
      const createdVariant = await ProductVariant.findOne({ productId: createdPrd._id, sku: uniqueSku });
      expect(createdVariant).toBeDefined();
      expect(createdVariant.stockQuantity).toBe(75);

      // Verify inventory record
      const createdInv = await Inventory.findOne({ productVariantId: createdVariant._id });
      expect(createdInv).toBeDefined();
      expect(createdInv.onHand).toBe(75);

      // Cleanup
      await Inventory.deleteMany({ productVariantId: createdVariant._id });
      await ProductVariant.deleteMany({ productId: createdPrd._id });
      await Product.findByIdAndDelete(createdPrd._id);
    });

    it("exports authenticated vendor products with strict tenant isolation and formula injection sanitization", async () => {
      // Create a test product with potential formula injection string
      const formulaProduct = await Product.create({
        name: "=cmd|' /C calc'!A0",
        slug: `formula-test-${Date.now()}`,
        sku: `SKU-FORMULA-${Date.now()}`,
        description: "+1234567890",
        categoryId: testCategory._id,
        brandId: testBrand._id,
        vendorId: approvedVendorDocA._id,
        price: mongoose.Types.Decimal128.fromString("999.00"),
        status: "active",
        stockStatus: "in_stock",
      });

      const res = await request(app)
        .get("/api/v1/products/vendor/export?format=csv")
        .set("Authorization", `Bearer ${approvedVendorTokenA}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/csv");
      const csvText = res.text;

      // Must include formulaProduct with formula sanitized by leading quote (')
      expect(csvText).toContain("'=cmd|' /C calc'!A0");
      // Must contain secure product ID (prd_...)
      expect(csvText).toMatch(/prd_[A-Za-z0-9_-]+/);
      // Must NOT contain Vendor B's product
      expect(csvText).not.toContain(productB.name);

      // Cleanup
      await Product.findByIdAndDelete(formulaProduct._id);
    });
  });

  describe("7. Secure Identifier Strict Mode & Opaque ID Handling", () => {
    it("strictly disallows raw MongoDB ObjectId on public endpoints when strict: true is requested", () => {
      const rawId = new mongoose.Types.ObjectId().toString();

      expect(() => {
        decodeSecureId(rawId, "product", { strict: true });
      }).toThrow(/Raw database identifiers are disallowed/i);
    });

    it("transparently accepts and decodes opaque secure identifier in strict mode", () => {
      const rawId = new mongoose.Types.ObjectId().toString();
      const secureId = encodeSecureId("order", rawId);

      const decoded = decodeSecureId(secureId, "order", { strict: true });
      expect(decoded).toBe(rawId);
    });

    it("resolves opaque secure order ID (ord_...) on vendor order lookup endpoint", async () => {
      const secureOrderId = encodeSecureId("order", testMultiVendorOrder._id);

      const res = await request(app)
        .get(`/api/v1/orders/vendor/my/${secureOrderId}`)
        .set("Authorization", `Bearer ${approvedVendorTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.orderNumber).toBe(testMultiVendorOrder.orderNumber);
      expect(decodeSecureId(res.body.data.secureId, "order")).toBe(testMultiVendorOrder._id.toString());
    });
  });
});
