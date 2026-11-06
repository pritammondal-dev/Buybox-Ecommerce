const request = require("supertest");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const app = require("../src/app");
const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const Customer = require("../src/models/Customer");
const Category = require("../src/models/Category");
const Brand = require("../src/models/Brand");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Warehouse = require("../src/models/Warehouse");
const Inventory = require("../src/models/Inventory");
const SkuRegistry = require("../src/models/SkuRegistry");
const AuditLog = require("../src/models/AuditLog");
const Order = require("../src/models/Order");
const Shipment = require("../src/models/Shipment");
const FinancialLedgerEntry = require("../src/models/FinancialLedgerEntry");
const Permission = require("../src/models/Permission");

const productService = require("../src/services/product.service");
const productVariantService = require("../src/services/product-variant.service");
const cartService = require("../src/services/cart.service");
const productRepository = require("../src/repositories/product.repository");
const skuRegistryService = require("../src/services/sku-registry.service");

const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const { generateAccessToken } = require("../src/services/token.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace(/\/buybox(\?|$)/, "/buybox_variable_archival_test$1")
  : "mongodb://127.0.0.1:27017/buybox_variable_archival_test?replicaSet=rs0";

jest.setTimeout(90000);

describe("Buybox — Variable Product Deletion & Archival Integrity (20 Scenarios)", () => {
  let adminUser, adminToken;
  let superAdminUser, superAdminToken;
  let customerUser, customerDoc, customerToken;
  let vendor1User, vendor1Doc, vendor1Token;
  let vendor2User, vendor2Doc, vendor2Token;
  let testCategory, testBrand, testWarehouse1, testWarehouse2;

  async function getOrCreatePermission(slug) {
    let perm = await Permission.findOne({ slug });
    if (!perm) {
      perm = await Permission.create({
        slug,
        name: `Perm ${slug}`,
        module: slug.split(":")[0],
        description: `Description for ${slug}`,
        isActive: true,
      });
    }
    return perm;
  }

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }
    await SkuRegistry.syncIndexes();
    await Product.syncIndexes();
    await ProductVariant.syncIndexes();

    await getOrCreatePermission(PERMISSIONS.PRODUCTS_READ);
    await getOrCreatePermission(PERMISSIONS.PRODUCTS_CREATE);
    await getOrCreatePermission(PERMISSIONS.PRODUCTS_UPDATE);
    await getOrCreatePermission(PERMISSIONS.PRODUCTS_DELETE);
    await getOrCreatePermission(PERMISSIONS.PRODUCTS_MODERATE);
  });

  afterAll(async () => {
    await SkuRegistry.deleteMany({});
    await Inventory.deleteMany({});
    await ProductVariant.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});
    await Shipment.deleteMany({});
    if (FinancialLedgerEntry.collection) {
      await FinancialLedgerEntry.collection.deleteMany({});
    }
    await Warehouse.deleteMany({});
    await Category.deleteMany({});
    await Brand.deleteMany({});
    await Vendor.deleteMany({});
    await Customer.deleteMany({});
    await User.deleteMany({});
    if (AuditLog.collection) {
      await AuditLog.collection.deleteMany({});
    }
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await SkuRegistry.deleteMany({});
    await Inventory.deleteMany({});
    await ProductVariant.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});
    await Shipment.deleteMany({});
    if (FinancialLedgerEntry.collection) {
      await FinancialLedgerEntry.collection.deleteMany({});
    }
    await Warehouse.deleteMany({});
    await Category.deleteMany({});
    await Brand.deleteMany({});
    await Vendor.deleteMany({});
    await Customer.deleteMany({});
    await User.deleteMany({});
    if (AuditLog.collection) {
      await AuditLog.collection.deleteMany({});
    }

    // Super Admin
    superAdminUser = await User.create({
      firstName: "Super",
      lastName: "Admin",
      email: `superadmin_${Date.now()}@buybox.test`,
      password: "Password123!",
      role: ROLES.SUPER_ADMIN,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    superAdminToken = generateAccessToken({
      sub: superAdminUser._id.toString(),
      role: superAdminUser.role,
      authVersion: superAdminUser.authVersion,
      permissionVersion: superAdminUser.permissionVersion,
    });

    // Admin
    adminUser = await User.create({
      firstName: "Admin",
      lastName: "User",
      email: `admin_${Date.now()}@buybox.test`,
      password: "Password123!",
      role: ROLES.ADMIN,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    adminToken = generateAccessToken({
      sub: adminUser._id.toString(),
      role: adminUser.role,
      authVersion: adminUser.authVersion,
      permissionVersion: adminUser.permissionVersion,
    });

    // Customer
    customerUser = await User.create({
      firstName: "Customer",
      lastName: "Shopper",
      email: `customer_${Date.now()}@buybox.test`,
      password: "Password123!",
      role: ROLES.CUSTOMER,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    customerDoc = await Customer.create({
      userId: customerUser._id,
      isActive: true,
    });
    customerToken = generateAccessToken({
      sub: customerUser._id.toString(),
      role: customerUser.role,
      authVersion: customerUser.authVersion,
      permissionVersion: customerUser.permissionVersion,
    });

    // Vendor 1
    vendor1User = await User.create({
      firstName: "VendorOne",
      lastName: "Owner",
      email: `vendor1_${Date.now()}@buybox.test`,
      password: "Password123!",
      role: ROLES.VENDOR,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    vendor1Doc = await Vendor.create({
      userId: vendor1User._id,
      businessName: "Vendor One Corp",
      businessSlug: `vendor-one-${Date.now()}`,
      email: vendor1User.email,
      onboardingStatus: "approved",
      isActive: true,
    });
    vendor1Token = generateAccessToken({
      sub: vendor1User._id.toString(),
      role: vendor1User.role,
      authVersion: vendor1User.authVersion,
      permissionVersion: vendor1User.permissionVersion,
    });

    // Vendor 2
    vendor2User = await User.create({
      firstName: "VendorTwo",
      lastName: "Owner",
      email: `vendor2_${Date.now()}@buybox.test`,
      password: "Password123!",
      role: ROLES.VENDOR,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    vendor2Doc = await Vendor.create({
      userId: vendor2User._id,
      businessName: "Vendor Two Corp",
      businessSlug: `vendor-two-${Date.now()}`,
      email: vendor2User.email,
      onboardingStatus: "approved",
      isActive: true,
    });
    vendor2Token = generateAccessToken({
      sub: vendor2User._id.toString(),
      role: vendor2User.role,
      authVersion: vendor2User.authVersion,
      permissionVersion: vendor2User.permissionVersion,
    });

    // Category and Brand
    testCategory = await Category.create({
      name: "Electronics",
      slug: `electronics-${Date.now()}`,
      isActive: true,
    });

    testBrand = await Brand.create({
      name: "Nexus",
      slug: `nexus-${Date.now()}`,
      isActive: true,
    });

    // Warehouses
    testWarehouse1 = await Warehouse.create({
      name: "Bangalore Main Facility",
      code: `WH-BLR-${Date.now().toString().slice(-4)}`,
      address: {
        addressLine1: "100 Tech Park",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "IN",
      },
      isActive: true,
    });

    testWarehouse2 = await Warehouse.create({
      name: "Mumbai Coastal Hub",
      code: `WH-BOM-${Date.now().toString().slice(-4)}`,
      address: {
        addressLine1: "200 Marine Way",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "IN",
      },
      isActive: true,
    });
  });

  // Helper to create product with arbitrary variants
  async function createProductWithVariants({
    vendorId,
    productType = "variable",
    variantCount = 1,
    prefix = "P",
  }) {
    const pSku = `${prefix}-PROD-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
    const product = await Product.create({
      name: `Test Product ${pSku}`,
      slug: `test-product-${pSku.toLowerCase()}`,
      sku: pSku,
      productType,
      categoryId: testCategory._id,
      brandId: testBrand._id,
      vendorId,
      price: mongoose.Types.Decimal128.fromString("999.00"),
      currency: "INR",
      status: "active",
      isActive: true,
    });

    await skuRegistryService.reserveSku({
      sku: pSku,
      productId: product._id,
      entityType: "product",
      isDefault: false,
    });

    const variants = [];
    for (let i = 0; i < variantCount; i++) {
      const vSku = `${pSku}-V${i + 1}`;
      const variant = await ProductVariant.create({
        productId: product._id,
        sku: vSku,
        name: `${product.name} - Variant ${i + 1}`,
        price: mongoose.Types.Decimal128.fromString(`${100 + i * 20}.00`),
        vendorId,
        isActive: true,
        attributes: {
          Size: `Size-${i + 1}`,
          Color: "Black",
        },
      });

      await skuRegistryService.reserveSku({
        sku: vSku,
        productId: product._id,
        variantId: variant._id,
        entityType: "variant",
        isDefault: i === 0,
      });

      variants.push(variant);
    }

    return { product, variants };
  }

  // =========================================================================
  // SCENARIO 1: Simple product archival
  // =========================================================================
  test("Scenario 1: Simple product archival sets deletedAt and creates audit log", async () => {
    const { product } = await createProductWithVariants({
      vendorId: vendor1Doc._id,
      productType: "simple",
      variantCount: 0,
      prefix: "S1",
    });

    const res = await request(app)
      .delete(`/api/v1/products/${product._id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Product archived successfully");

    const updated = await Product.findById(product._id);
    expect(updated.deletedAt).not.toBeNull();
    expect(updated.status).toBe("archived");

    const audit = await AuditLog.findOne({
      targetId: product._id,
      action: "product_archived",
    });
    expect(audit).not.toBeNull();
  });

  // =========================================================================
  // SCENARIO 2: Variable product with 1 variant
  // =========================================================================
  test("Scenario 2: Variable product with 1 variant archives parent and single child variant", async () => {
    const { product, variants } = await createProductWithVariants({
      vendorId: vendor1Doc._id,
      productType: "variable",
      variantCount: 1,
      prefix: "S2",
    });

    const res = await request(app)
      .delete(`/api/v1/products/${product._id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Product archived successfully");

    const updatedProd = await Product.findById(product._id);
    expect(updatedProd.deletedAt).not.toBeNull();

    const updatedVariant = await ProductVariant.findById(variants[0]._id);
    expect(updatedVariant.deletedAt).not.toBeNull();
    expect(updatedVariant.isActive).toBe(false);
  });

  // =========================================================================
  // SCENARIO 3: Variable product with 2 variants
  // =========================================================================
  test("Scenario 3: Variable product with 2 variants archives parent and both variants", async () => {
    const { product, variants } = await createProductWithVariants({
      vendorId: vendor1Doc._id,
      productType: "variable",
      variantCount: 2,
      prefix: "S3",
    });

    const res = await request(app)
      .delete(`/api/v1/products/${product._id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    const updatedProd = await Product.findById(product._id);
    expect(updatedProd.deletedAt).not.toBeNull();

    const dbVariants = await ProductVariant.find({ productId: product._id });
    expect(dbVariants).toHaveLength(2);
    dbVariants.forEach((v) => {
      expect(v.deletedAt).not.toBeNull();
      expect(v.isActive).toBe(false);
    });
  });

  // =========================================================================
  // SCENARIO 4: Variable product with 3 variants
  // =========================================================================
  test("Scenario 4: Variable product with 3 variants archives parent and all 3 variants", async () => {
    const { product, variants } = await createProductWithVariants({
      vendorId: vendor1Doc._id,
      productType: "variable",
      variantCount: 3,
      prefix: "S4",
    });

    const res = await request(app)
      .delete(`/api/v1/products/${product._id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    const updatedProd = await Product.findById(product._id);
    expect(updatedProd.deletedAt).not.toBeNull();

    const dbVariants = await ProductVariant.find({ productId: product._id });
    expect(dbVariants).toHaveLength(3);
    dbVariants.forEach((v) => {
      expect(v.deletedAt).not.toBeNull();
      expect(v.isActive).toBe(false);
    });
  });

  // =========================================================================
  // SCENARIO 5: Variable product with many variants (>10)
  // =========================================================================
  test("Scenario 5: Variable product with many variants (>10) archives all variants completely", async () => {
    const { product, variants } = await createProductWithVariants({
      vendorId: vendor1Doc._id,
      productType: "variable",
      variantCount: 12,
      prefix: "S5",
    });

    expect(variants).toHaveLength(12);

    const res = await request(app)
      .delete(`/api/v1/products/${product._id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    const updatedProd = await Product.findById(product._id);
    expect(updatedProd.deletedAt).not.toBeNull();

    const dbVariants = await ProductVariant.find({ productId: product._id });
    expect(dbVariants).toHaveLength(12);
    dbVariants.forEach((v) => {
      expect(v.deletedAt).not.toBeNull();
      expect(v.isActive).toBe(false);
    });
  });

  // =========================================================================
  // SCENARIO 6: Active reservation on the first variant
  // =========================================================================
  test("Scenario 6: Active reservation on first variant blocks product archival with 409", async () => {
    const { product, variants } = await createProductWithVariants({
      vendorId: vendor1Doc._id,
      productType: "variable",
      variantCount: 3,
      prefix: "S6",
    });

    // Place active reservation on first variant
    await Inventory.create({
      productVariantId: variants[0]._id,
      warehouseId: testWarehouse1._id,
      onHand: 10,
      reserved: 3,
    });

    const res = await request(app)
      .delete(`/api/v1/products/${product._id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CANNOT_DELETE_PRODUCT_WITH_RESERVATIONS");
    expect(res.body.details).toBeDefined();
    expect(res.body.details[0].variantId.toString()).toBe(variants[0]._id.toString());
    expect(res.body.details[0].reservedQuantity).toBe(3);

    // Parent product and all variants remain un-archived
    const unarchivedProd = await Product.findById(product._id);
    expect(unarchivedProd.deletedAt).toBeNull();
    const unarchivedVars = await ProductVariant.find({ productId: product._id });
    unarchivedVars.forEach((v) => expect(v.deletedAt).toBeNull());
  });

  // =========================================================================
  // SCENARIO 7: Active reservation on a middle variant
  // =========================================================================
  test("Scenario 7: Active reservation on middle variant blocks product archival with 409", async () => {
    const { product, variants } = await createProductWithVariants({
      vendorId: vendor1Doc._id,
      productType: "variable",
      variantCount: 3,
      prefix: "S7",
    });

    // Place active reservation on second (middle) variant
    await Inventory.create({
      productVariantId: variants[1]._id,
      warehouseId: testWarehouse1._id,
      onHand: 15,
      reserved: 5,
    });

    const res = await request(app)
      .delete(`/api/v1/products/${product._id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CANNOT_DELETE_PRODUCT_WITH_RESERVATIONS");
    expect(res.body.details[0].variantId.toString()).toBe(variants[1]._id.toString());
    expect(res.body.details[0].reservedQuantity).toBe(5);

    const unarchivedProd = await Product.findById(product._id);
    expect(unarchivedProd.deletedAt).toBeNull();
  });

  // =========================================================================
  // SCENARIO 8: Active reservation on the last variant
  // =========================================================================
  test("Scenario 8: Active reservation on last variant blocks product archival with 409", async () => {
    const { product, variants } = await createProductWithVariants({
      vendorId: vendor1Doc._id,
      productType: "variable",
      variantCount: 3,
      prefix: "S8",
    });

    // Place active reservation on third (last) variant
    await Inventory.create({
      productVariantId: variants[2]._id,
      warehouseId: testWarehouse1._id,
      onHand: 20,
      reserved: 8,
    });

    const res = await request(app)
      .delete(`/api/v1/products/${product._id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CANNOT_DELETE_PRODUCT_WITH_RESERVATIONS");
    expect(res.body.details[0].variantId.toString()).toBe(variants[2]._id.toString());
    expect(res.body.details[0].reservedQuantity).toBe(8);

    const unarchivedProd = await Product.findById(product._id);
    expect(unarchivedProd.deletedAt).toBeNull();
  });

  // =========================================================================
  // SCENARIO 9: Reservations across multiple warehouses
  // =========================================================================
  test("Scenario 9: Reservations across multiple warehouses are aggregated with warehouse attribution", async () => {
    const { product, variants } = await createProductWithVariants({
      vendorId: vendor1Doc._id,
      productType: "variable",
      variantCount: 2,
      prefix: "S9",
    });

    // Variant 1 reserved in Warehouse 1
    await Inventory.create({
      productVariantId: variants[0]._id,
      warehouseId: testWarehouse1._id,
      onHand: 10,
      reserved: 2,
    });

    // Variant 2 reserved in Warehouse 2
    await Inventory.create({
      productVariantId: variants[1]._id,
      warehouseId: testWarehouse2._id,
      onHand: 8,
      reserved: 4,
    });

    const res = await request(app)
      .delete(`/api/v1/products/${product._id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.details).toHaveLength(2);

    const wh1Entry = res.body.details.find(
      (d) => d.warehouseId.toString() === testWarehouse1._id.toString()
    );
    const wh2Entry = res.body.details.find(
      (d) => d.warehouseId.toString() === testWarehouse2._id.toString()
    );

    expect(wh1Entry).toBeDefined();
    expect(wh1Entry.warehouseName).toBe(testWarehouse1.name);
    expect(wh1Entry.reservedQuantity).toBe(2);

    expect(wh2Entry).toBeDefined();
    expect(wh2Entry.warehouseName).toBe(testWarehouse2.name);
    expect(wh2Entry.reservedQuantity).toBe(4);
  });

  // =========================================================================
  // SCENARIO 10: Actionable HTTP 409 responses with structured details array
  // =========================================================================
  test("Scenario 10: Actionable HTTP 409 response contains complete structured schema with resolution guidance", async () => {
    const { product, variants } = await createProductWithVariants({
      vendorId: vendor1Doc._id,
      productType: "variable",
      variantCount: 1,
      prefix: "S10",
    });

    await Inventory.create({
      productVariantId: variants[0]._id,
      warehouseId: testWarehouse1._id,
      onHand: 12,
      reserved: 6,
    });

    const res = await request(app)
      .delete(`/api/v1/products/${product._id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(Array.isArray(res.body.details)).toBe(true);
    const detail = res.body.details[0];

    expect(detail).toHaveProperty("variantId");
    expect(detail).toHaveProperty("sku", variants[0].sku);
    expect(detail).toHaveProperty("variantName");
    expect(detail).toHaveProperty("warehouseId");
    expect(detail).toHaveProperty("warehouseName", testWarehouse1.name);
    expect(detail).toHaveProperty("warehouseCode", testWarehouse1.code);
    expect(detail).toHaveProperty("reservedQuantity", 6);
    expect(detail).toHaveProperty("onHandQuantity", 12);
    expect(detail).toHaveProperty("resolution");
    expect(detail.resolution).toContain("Fulfill or cancel outstanding customer orders");
  });

  // =========================================================================
  // SCENARIO 11: Historical order references preserved
  // =========================================================================
  test("Scenario 11: Archival preserves historical order references and pricing snapshots", async () => {
    const { product, variants } = await createProductWithVariants({
      vendorId: vendor1Doc._id,
      productType: "variable",
      variantCount: 1,
      prefix: "S11",
    });

    // Create an order referencing this product and variant
    const order = await Order.create({
      orderNumber: `ORD-HIST-${Date.now()}`,
      customerId: customerDoc._id,
      status: "completed",
      currency: "INR",
      items: [
        {
          productId: product._id,
          productVariantId: variants[0]._id,
          warehouseId: testWarehouse1._id,
          vendorId: vendor1Doc._id,
          sku: variants[0].sku,
          productName: product.name,
          quantity: 2,
          unitPrice: mongoose.Types.Decimal128.fromString("150.00"),
          discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
          taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
          lineTotal: mongoose.Types.Decimal128.fromString("300.00"),
          currency: "INR",
          inventoryStatus: "deducted",
        },
      ],
      subtotal: mongoose.Types.Decimal128.fromString("300.00"),
      grandTotal: mongoose.Types.Decimal128.fromString("300.00"),
      shippingAddress: {
        fullName: "Test Customer",
        addressLine1: "123 Main St",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "IN",
        phone: "+919876543210",
      },
      billingAddress: {
        fullName: "Test Customer",
        addressLine1: "123 Main St",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "IN",
        phone: "+919876543210",
      },
    });

    // Now archive the product (no active reservations)
    const res = await request(app)
      .delete(`/api/v1/products/${product._id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    // Verify historical order record is 100% intact
    const fetchedOrder = await Order.findById(order._id);
    expect(fetchedOrder).not.toBeNull();
    expect(fetchedOrder.items).toHaveLength(1);
    expect(fetchedOrder.items[0].productId.toString()).toBe(product._id.toString());
    expect(fetchedOrder.items[0].productVariantId.toString()).toBe(variants[0]._id.toString());
    expect(fetchedOrder.items[0].sku).toBe(variants[0].sku);
    expect(Number(fetchedOrder.items[0].lineTotal.toString())).toBe(300);
  });

  // =========================================================================
  // SCENARIO 12: Shipment and financial ledger references preserved intact
  // =========================================================================
  test("Scenario 12: Shipment and financial ledger references remain intact after archival", async () => {
    const { product, variants } = await createProductWithVariants({
      vendorId: vendor1Doc._id,
      productType: "variable",
      variantCount: 1,
      prefix: "S12",
    });

    const order = await Order.create({
      orderNumber: `ORD-SHIP-${Date.now()}`,
      customerId: customerDoc._id,
      status: "processing",
      currency: "INR",
      items: [
        {
          productId: product._id,
          productVariantId: variants[0]._id,
          warehouseId: testWarehouse1._id,
          vendorId: vendor1Doc._id,
          sku: variants[0].sku,
          productName: product.name,
          quantity: 1,
          unitPrice: mongoose.Types.Decimal128.fromString("100.00"),
          discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
          taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
          lineTotal: mongoose.Types.Decimal128.fromString("100.00"),
          currency: "INR",
          inventoryStatus: "deducted",
        },
      ],
      subtotal: mongoose.Types.Decimal128.fromString("100.00"),
      grandTotal: mongoose.Types.Decimal128.fromString("100.00"),
      shippingAddress: {
        fullName: "Test Customer",
        addressLine1: "123 Main St",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "IN",
        phone: "+919876543210",
      },
      billingAddress: {
        fullName: "Test Customer",
        addressLine1: "123 Main St",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "IN",
        phone: "+919876543210",
      },
    });

    const shipment = await Shipment.create({
      orderId: order._id,
      customerId: customerDoc._id,
      vendorId: vendor1Doc._id,
      warehouseId: testWarehouse1._id,
      shipmentNumber: `SHP-${Date.now()}`,
      carrier: "Delhivery",
      status: "delivered",
      shippingAddress: order.shippingAddress,
    });

    const ledger = await FinancialLedgerEntry.create({
      journalId: `JRN-${Date.now()}`,
      entryType: "order_sale",
      direction: "credit",
      accountType: "vendor",
      accountReference: vendor1Doc._id.toString(),
      amount: mongoose.Types.Decimal128.fromString("100.00"),
      currency: "INR",
      source: "system",
      sourceId: order._id.toString(),
      description: `Settlement for variant ${variants[0].sku}`,
      ledgerAccount: "vendor_pending_earnings",
      status: "posted",
      effectiveDate: new Date(),
    });

    // Archive product
    const res = await request(app)
      .delete(`/api/v1/products/${product._id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    // Verify shipment and ledger documents are intact
    const verifyShipment = await Shipment.findById(shipment._id);
    expect(verifyShipment).not.toBeNull();
    expect(verifyShipment.status).toBe("delivered");

    const verifyLedger = await FinancialLedgerEntry.findById(ledger._id);
    expect(verifyLedger).not.toBeNull();
    expect(verifyLedger.accountReference).toBe(vendor1Doc._id.toString());
  });

  // =========================================================================
  // SCENARIO 13: Archived variants cannot be purchased
  // =========================================================================
  test("Scenario 13: Archived variants cannot be added to customer cart", async () => {
    const { product, variants } = await createProductWithVariants({
      vendorId: vendor1Doc._id,
      productType: "variable",
      variantCount: 1,
      prefix: "S13",
    });

    // Archive product
    await request(app)
      .delete(`/api/v1/products/${product._id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    // Customer attempts to add archived variant to cart
    const res = await request(app)
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        productVariantId: variants[0]._id.toString(),
        quantity: 1,
      });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PRODUCT_VARIANT_NOT_FOUND");
  });

  // =========================================================================
  // SCENARIO 14: Archived inventory is not sellable
  // =========================================================================
  test("Scenario 14: Archived inventory is excluded from active catalog and storefront queries", async () => {
    const { product, variants } = await createProductWithVariants({
      vendorId: vendor1Doc._id,
      productType: "variable",
      variantCount: 1,
      prefix: "S14",
    });

    await Inventory.create({
      productVariantId: variants[0]._id,
      warehouseId: testWarehouse1._id,
      onHand: 50,
      reserved: 0,
    });

    // Archive product
    await request(app)
      .delete(`/api/v1/products/${product._id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    // Active variant lookup excludes archived variants
    const activeVar = await ProductVariant.findOne({
      _id: variants[0]._id,
      isActive: true,
      deletedAt: null,
    });
    expect(activeVar).toBeNull();

    // Default catalog listing excludes archived products
    const catalogList = await productRepository.list({
      filter: { categoryId: testCategory._id },
    });
    const found = catalogList.items.find(
      (p) => p._id.toString() === product._id.toString()
    );
    expect(found).toBeUndefined();
  });

  // =========================================================================
  // SCENARIO 15: Unauthorized archival attempts (401/403)
  // =========================================================================
  test("Scenario 15: Unauthenticated and unauthorized requests are rejected with 401/403", async () => {
    const { product } = await createProductWithVariants({
      vendorId: vendor1Doc._id,
      productType: "variable",
      variantCount: 1,
      prefix: "S15",
    });

    // 1. Unauthenticated request -> 401
    const resUnauth = await request(app).delete(`/api/v1/products/${product._id}`);
    expect(resUnauth.status).toBe(401);

    // 2. Customer role -> 403
    const resCustomer = await request(app)
      .delete(`/api/v1/products/${product._id}`)
      .set("Authorization", `Bearer ${customerToken}`);
    expect(resCustomer.status).toBe(403);
  });

  // =========================================================================
  // SCENARIO 16: Cross-tenant deletion attempts (403 PRODUCT_OWNERSHIP_REQUIRED)
  // =========================================================================
  test("Scenario 16: Cross-tenant archival attempt by another vendor is rejected with 403", async () => {
    // Product owned by Vendor 1
    const { product, variants } = await createProductWithVariants({
      vendorId: vendor1Doc._id,
      productType: "variable",
      variantCount: 1,
      prefix: "S16",
    });

    // Vendor 2 attempts to delete Vendor 1's product
    const resProd = await request(app)
      .delete(`/api/v1/products/${product._id}`)
      .set("Authorization", `Bearer ${vendor2Token}`);

    expect(resProd.status).toBe(403);
    expect(resProd.body.code).toBe("PRODUCT_OWNERSHIP_REQUIRED");

    // Vendor 2 attempts to delete Vendor 1's variant
    const resVar = await request(app)
      .delete(`/api/v1/product-variants/${variants[0]._id}`)
      .set("Authorization", `Bearer ${vendor2Token}`);

    expect(resVar.status).toBe(403);
    expect(resVar.body.code).toBe("PRODUCT_OWNERSHIP_REQUIRED");
  });

  // =========================================================================
  // SCENARIO 17: Repeated archive requests handled safely/idempotently
  // =========================================================================
  test("Scenario 17: Repeated archive requests are handled idempotently without error", async () => {
    const { product, variants } = await createProductWithVariants({
      vendorId: vendor1Doc._id,
      productType: "variable",
      variantCount: 1,
      prefix: "S17",
    });

    // First deletion
    const res1 = await request(app)
      .delete(`/api/v1/products/${product._id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res1.status).toBe(200);

    const firstDeletedProd = await Product.findById(product._id);
    const originalDeletedAt = firstDeletedProd.deletedAt;
    expect(originalDeletedAt).not.toBeNull();

    // Second repeated deletion -> idempotent 200
    const res2 = await request(app)
      .delete(`/api/v1/products/${product._id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res2.status).toBe(200);
    expect(res2.body.message).toBe("Product archived successfully");

    const secondDeletedProd = await Product.findById(product._id);
    expect(secondDeletedProd.deletedAt.getTime()).toBe(originalDeletedAt.getTime());

    // Also test variant repeated archival
    const varRes1 = await productVariantService.deleteProductVariant({
      id: variants[0]._id,
      actor: adminUser,
    });
    expect(varRes1).toBeDefined();

    const varRes2 = await productVariantService.deleteProductVariant({
      id: variants[0]._id,
      actor: adminUser,
    });
    expect(varRes2).toBeDefined();
  });

  // =========================================================================
  // SCENARIO 18: Database failure / transaction rollback behavior
  // =========================================================================
  test("Scenario 18: Transaction aborts and rolls back changes if variant soft-deletion fails", async () => {
    const { product, variants } = await createProductWithVariants({
      vendorId: vendor1Doc._id,
      productType: "variable",
      variantCount: 2,
      prefix: "S18",
    });

    // Mock ProductVariant.updateMany to simulate a failure during variant batch update
    const originalUpdateMany = ProductVariant.updateMany;
    jest.spyOn(ProductVariant, "updateMany").mockImplementationOnce(() => {
      throw new Error("Simulated database failure during variant archival");
    });

    await expect(
      productService.deleteProduct({
        id: product._id.toString(),
        actor: adminUser,
      })
    ).rejects.toThrow("Simulated database failure during variant archival");

    // Restore spy
    ProductVariant.updateMany = originalUpdateMany;

    // Check that product deletion was rolled back
    const rolledBackProduct = await Product.findById(product._id);
    expect(rolledBackProduct.deletedAt).toBeNull();

    const rolledBackVariants = await ProductVariant.find({ productId: product._id });
    rolledBackVariants.forEach((v) => {
      expect(v.deletedAt).toBeNull();
      expect(v.isActive).toBe(true);
    });
  });

  // =========================================================================
  // SCENARIO 19: Product list and product details UI terminology verification
  // =========================================================================
  test("Scenario 19: UI files strictly use 'Archive' terminology and avoid misleading 'Delete Permanently'", () => {
    const productsListPage = fs.readFileSync(
      path.resolve(__dirname, "../../frontend/src/app/administrator/catalog/products/page.js"),
      "utf8"
    );
    const productDetailPage = fs.readFileSync(
      path.resolve(__dirname, "../../frontend/src/app/administrator/catalog/products/[id]/page.js"),
      "utf8"
    );
    const variantTable = fs.readFileSync(
      path.resolve(__dirname, "../../frontend/src/components/vendor/variants/VariantTable.jsx"),
      "utf8"
    );

    // Assert absence of "Delete Permanently"
    expect(productsListPage).not.toMatch(/delete permanently/i);
    expect(productDetailPage).not.toMatch(/delete permanently/i);
    expect(variantTable).not.toMatch(/confirm delete/i);

    // Assert presence of "Archive Product" and "Archive Variant"
    expect(productsListPage).toMatch(/Archive Product/i);
    expect(productDetailPage).toMatch(/Archive Product/i);
    expect(variantTable).toMatch(/Archive Variant/i);

    // Assert presence of actionable reservation guidance in UI
    expect(productsListPage).toMatch(/Active Reservations Blocking Archival/i);
    expect(productDetailPage).toMatch(/Active Reservations Blocking Archival/i);
    expect(variantTable).toMatch(/Cannot archive/i);
  });

  // =========================================================================
  // SCENARIO 20: Existing simple-product, catalog, variant, and SKU registry regressions
  // =========================================================================
  test("Scenario 20: SkuRegistry accurately releases SKU on archival without breaking active sibling products", async () => {
    const { product: prod1, variants: vars1 } = await createProductWithVariants({
      vendorId: vendor1Doc._id,
      productType: "variable",
      variantCount: 1,
      prefix: "S20A",
    });

    const { product: prod2, variants: vars2 } = await createProductWithVariants({
      vendorId: vendor1Doc._id,
      productType: "variable",
      variantCount: 1,
      prefix: "S20B",
    });

    // Archive prod1
    const res = await request(app)
      .delete(`/api/v1/products/${prod1._id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    // SkuRegistry for prod1 and vars1 should be soft-deleted
    const skuRegProd1 = await SkuRegistry.findOne({ productId: prod1._id });
    expect(skuRegProd1.deletedAt).not.toBeNull();

    // SkuRegistry for active prod2 and vars2 must remain completely active (deletedAt === null)
    const skuRegProd2 = await SkuRegistry.findOne({ productId: prod2._id });
    expect(skuRegProd2.deletedAt).toBeNull();
    const skuRegVar2 = await SkuRegistry.findOne({ variantId: vars2[0]._id });
    expect(skuRegVar2.deletedAt).toBeNull();

    // Active listing continues to return prod2 and not prod1
    const listRes = await productRepository.list({
      filter: { categoryId: testCategory._id },
    });
    const ids = listRes.items.map((p) => p._id.toString());
    expect(ids).toContain(prod2._id.toString());
    expect(ids).not.toContain(prod1._id.toString());
  });
});
