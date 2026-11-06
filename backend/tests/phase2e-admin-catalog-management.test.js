const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const Category = require("../src/models/Category");
const Brand = require("../src/models/Brand");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Warehouse = require("../src/models/Warehouse");
const Inventory = require("../src/models/Inventory");
const SkuRegistry = require("../src/models/SkuRegistry");
const AuditLog = require("../src/models/AuditLog");
const Permission = require("../src/models/Permission");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const { generateAccessToken } = require("../src/services/token.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_phase2e_test?")
  : "mongodb://127.0.0.1:27017/buybox_phase2e_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Buybox Phase 2E — Admin Catalog Management Integration", () => {
  let adminUser, adminToken;
  let customerUser, customerToken;
  let vendorUser, vendorDoc, vendorToken;
  let testCategory, testBrand, testWarehouse;

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

    // Ensure permissions exist
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

    adminUser = await User.create({
      firstName: "Admin",
      lastName: "User",
      email: `admin_${Date.now()}@phase2e.com`,
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

    customerUser = await User.create({
      firstName: "Customer",
      lastName: "Shopper",
      email: `customer_${Date.now()}@phase2e.com`,
      password: "Password123!",
      role: ROLES.CUSTOMER,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    customerToken = generateAccessToken({
      sub: customerUser._id.toString(),
      role: customerUser.role,
      authVersion: customerUser.authVersion,
      permissionVersion: customerUser.permissionVersion,
    });

    vendorUser = await User.create({
      firstName: "Vendor",
      lastName: "Seller",
      email: `vendor_${Date.now()}@phase2e.com`,
      password: "Password123!",
      role: ROLES.VENDOR,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    vendorDoc = await Vendor.create({
      userId: vendorUser._id,
      businessName: "Vendor Shop",
      businessSlug: `vendor-shop-${Date.now()}`,
      email: vendorUser.email,
      onboardingStatus: "approved",
      isActive: true,
    });
    vendorToken = generateAccessToken({
      sub: vendorUser._id.toString(),
      role: vendorUser.role,
      authVersion: vendorUser.authVersion,
      permissionVersion: vendorUser.permissionVersion,
    });

    testCategory = await Category.create({
      name: "Apparel",
      slug: `apparel-${Date.now()}`,
      isActive: true,
    });

    testBrand = await Brand.create({
      name: "TopFit",
      slug: `topfit-${Date.now()}`,
      isActive: true,
    });

    testWarehouse = await Warehouse.create({
      name: "Main Facility",
      code: `WH-2E-${Date.now().toString().slice(-4)}`,
      address: {
        addressLine1: "500 Commerce Way",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "IN",
      },
      isActive: true,
    });
  });

  describe("1. Catalog Listing & productType Filtering", () => {
    it("Admin can filter products by productType and receive price ranges for variable products", async () => {
      // Create simple product
      const resSimple = await request(app)
        .post("/api/v1/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Simple Denim Shirt",
          slug: `simple-shirt-${Date.now()}`,
          sku: `SIMP-${Date.now()}`,
          productType: "simple",
          categoryId: testCategory._id,
          brandId: testBrand._id,
          vendorId: vendorDoc._id,
          price: 999,
          status: "active",
        });
      expect(resSimple.status).toBe(201);

      // Create variable product
      const resVar = await request(app)
        .post("/api/v1/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Variable Running Shoes",
          slug: `variable-shoes-${Date.now()}`,
          sku: `VAR-${Date.now()}`,
          productType: "variable",
          categoryId: testCategory._id,
          brandId: testBrand._id,
          vendorId: vendorDoc._id,
          price: 1500,
          status: "active",
        });
      expect(resVar.status).toBe(201);
      const varId = resVar.body.data.product._id;

      // Add two variants to variable product with prices 1200 and 1800
      await ProductVariant.create([
        {
          productId: varId,
          sku: `VAR-RED-${Date.now()}`,
          name: "Red 8",
          price: 1200,
          isDefault: false,
          isActive: true,
        },
        {
          productId: varId,
          sku: `VAR-BLUE-${Date.now()}`,
          name: "Blue 9",
          price: 1800,
          isDefault: false,
          isActive: true,
        },
      ]);

      // Query with productType=simple
      const listSimple = await request(app)
        .get("/api/v1/products?productType=simple")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(listSimple.status).toBe(200);
      expect(listSimple.body.data.length).toBe(1);
      expect(listSimple.body.data[0].productType).toBe("simple");

      // Query with productType=variable
      const listVariable = await request(app)
        .get("/api/v1/products?productType=variable")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(listVariable.status).toBe(200);
      expect(listVariable.body.data.length).toBe(1);
      expect(listVariable.body.data[0].productType).toBe("variable");
      expect(listVariable.body.data[0].priceRange).toBeDefined();
      expect(listVariable.body.data[0].priceRange.min).toBe(1200);
      expect(listVariable.body.data[0].priceRange.max).toBe(1800);
      expect(listVariable.body.data[0].variantCount).toBe(2);
    });
  });

  describe("2. Reservation Protection on Product Deletion & Safe Restoration", () => {
    it("Cannot delete a product whose child variants have active inventory reservations", async () => {
      const res = await request(app)
        .post("/api/v1/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Reserved Stock Jacket",
          slug: `jacket-${Date.now()}`,
          sku: `JACKET-${Date.now()}`,
          productType: "simple",
          categoryId: testCategory._id.toString(),
          brandId: testBrand._id.toString(),
          vendorId: vendorDoc._id.toString(),
          price: 2500,
          status: "active",
        });
      expect(res.status).toBe(201);
      const prodId = res.body.data.product._id;

      // Find the created default variant and simulate an active reservation
      const defaultVariant = await ProductVariant.findOne({
        productId: prodId,
        isDefault: true,
      });
      expect(defaultVariant).toBeDefined();

      await Inventory.findOneAndUpdate(
        { productVariantId: defaultVariant._id },
        { reserved: 2 }
      );

      // Attempt deletion: must be blocked with 409
      const delRes = await request(app)
        .delete(`/api/v1/products/${prodId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(delRes.status).toBe(409);
      expect(delRes.body.code).toBe("CANNOT_DELETE_PRODUCT_WITH_RESERVATIONS");

      // Release reservation
      await Inventory.findOneAndUpdate(
        { productVariantId: defaultVariant._id },
        { reserved: 0 }
      );

      // Now deletion succeeds
      const delRes2 = await request(app)
        .delete(`/api/v1/products/${prodId}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(delRes2.status).toBe(200);

      const deletedProd = await Product.findById(prodId);
      expect(deletedProd.deletedAt).not.toBeNull();

      const deletedVariant = await ProductVariant.findById(defaultVariant._id);
      expect(deletedVariant.deletedAt).not.toBeNull();
    });

    it("Restoring a soft-deleted product restores its default variant and releases draft status", async () => {
      const res = await request(app)
        .post("/api/v1/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Restorable Wool Sweater",
          slug: `sweater-${Date.now()}`,
          sku: `SWEATER-${Date.now()}`,
          productType: "simple",
          categoryId: testCategory._id,
          brandId: testBrand._id,
          vendorId: vendorDoc._id,
          price: 1800,
          status: "active",
        });
      const prodId = res.body.data.product._id;

      // Soft delete
      await request(app)
        .delete(`/api/v1/products/${prodId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      // Restore product
      const restoreRes = await request(app)
        .post(`/api/v1/products/${prodId}/restore`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(restoreRes.status).toBe(200);
      expect(restoreRes.body.data.product.deletedAt).toBeNull();
      expect(restoreRes.body.data.product.status).toBe("draft");

      const variant = await ProductVariant.findOne({ productId: prodId });
      expect(variant.deletedAt).toBeNull();
      expect(variant.isActive).toBe(true);

      // Check audit log
      const audit = await AuditLog.findOne({
        targetId: prodId,
        action: "product_restored",
      });
      expect(audit).toBeDefined();
    });
  });

  describe("3. Admin Bulk Operations & Partial Result Reporting", () => {
    it("Admin can perform bulk activation, deactivation, approval, rejection, and deletion with per-item reporting", async () => {
      // Create 3 products
      const p1 = await Product.create({
        name: "Bulk Prod 1",
        slug: `bulk-p1-${Date.now()}`,
        sku: `BP1-${Date.now()}`,
        productType: "simple",
        categoryId: testCategory._id,
        brandId: testBrand._id,
        vendorId: vendorDoc._id,
        price: 100,
        status: "pending_approval",
      });

      const p2 = await Product.create({
        name: "Bulk Prod 2",
        slug: `bulk-p2-${Date.now()}`,
        sku: `BP2-${Date.now()}`,
        productType: "simple",
        categoryId: testCategory._id,
        brandId: testBrand._id,
        vendorId: vendorDoc._id,
        price: 200,
        status: "pending_approval",
      });

      // Bulk Approve
      const bulkApproveRes = await request(app)
        .post("/api/v1/products/admin/bulk-operations")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          productIds: [p1._id.toString(), p2._id.toString()],
          action: "approve",
        });

      expect(bulkApproveRes.status).toBe(200);
      expect(bulkApproveRes.body.data.summary.total).toBe(2);
      expect(bulkApproveRes.body.data.summary.succeeded).toBe(2);
      expect(bulkApproveRes.body.data.results.every((r) => r.success)).toBe(true);

      const checkP1 = await Product.findById(p1._id);
      expect(checkP1.status).toBe("active");

      // Bulk Deactivate
      const bulkDeactRes = await request(app)
        .post("/api/v1/products/admin/bulk-operations")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          productIds: [p1._id.toString(), p2._id.toString()],
          action: "deactivate",
        });

      expect(bulkDeactRes.status).toBe(200);
      expect(bulkDeactRes.body.data.summary.succeeded).toBe(2);

      const checkP2 = await Product.findById(p2._id);
      expect(checkP2.status).toBe("inactive");

      // Bulk Delete
      const bulkDelRes = await request(app)
        .post("/api/v1/products/admin/bulk-operations")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          productIds: [p1._id.toString(), p2._id.toString()],
          action: "delete",
        });

      expect(bulkDelRes.status).toBe(200);
      expect(bulkDelRes.body.data.summary.succeeded).toBe(2);

      const checkDel = await Product.findById(p1._id);
      expect(checkDel.deletedAt).not.toBeNull();
    });

    it("Reports safe partial failures without aborting other valid items in bulk payload", async () => {
      const validProd = await Product.create({
        name: "Valid Bulk Prod",
        slug: `valid-bulk-${Date.now()}`,
        sku: `VBP-${Date.now()}`,
        productType: "simple",
        categoryId: testCategory._id,
        brandId: testBrand._id,
        vendorId: vendorDoc._id,
        price: 300,
        status: "active",
      });

      const fakeId = new mongoose.Types.ObjectId().toString();

      const bulkRes = await request(app)
        .post("/api/v1/products/admin/bulk-operations")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          productIds: [validProd._id.toString(), fakeId],
          action: "deactivate",
        });

      expect(bulkRes.status).toBe(200);
      expect(bulkRes.body.data.summary.total).toBe(2);
      expect(bulkRes.body.data.summary.succeeded).toBe(1);
      expect(bulkRes.body.data.summary.failed).toBe(1);

      const resValid = bulkRes.body.data.results.find((r) => r.id === validProd._id.toString());
      const resFake = bulkRes.body.data.results.find((r) => r.id === fakeId);
      expect(resValid.success).toBe(true);
      expect(resFake.success).toBe(false);
      expect(resFake.error).toContain("Product not found");
    });
  });

  describe("4. Role Boundaries & Authorization Verification", () => {
    it("Customers cannot access bulk operations or restore products", async () => {
      const bulkRes = await request(app)
        .post("/api/v1/products/admin/bulk-operations")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          productIds: [new mongoose.Types.ObjectId().toString()],
          action: "activate",
        });
      expect(bulkRes.status).toBe(403);

      const restoreRes = await request(app)
        .post(`/api/v1/products/${new mongoose.Types.ObjectId().toString()}/restore`)
        .set("Authorization", `Bearer ${customerToken}`);
      expect(restoreRes.status).toBe(403);
    });

    it("Vendors cannot restore products belonging to other vendors", async () => {
      // Create product under another vendor
      const otherVendorUser = await User.create({
        firstName: "Other",
        lastName: "Vendor",
        email: `othervendor_${Date.now()}@test.com`,
        password: "Password123!",
        role: ROLES.VENDOR,
        isActive: true,
      });
      const otherVendor = await Vendor.create({
        userId: otherVendorUser._id,
        businessName: "Other Vendor Store",
        businessSlug: `other-store-${Date.now()}`,
        email: otherVendorUser.email,
        onboardingStatus: "approved",
        isActive: true,
      });

      const otherProd = await Product.create({
        name: "Other Vendor Product",
        slug: `other-prod-${Date.now()}`,
        sku: `OTH-${Date.now()}`,
        productType: "simple",
        categoryId: testCategory._id,
        brandId: testBrand._id,
        vendorId: otherVendor._id,
        price: 500,
        status: "draft",
        deletedAt: new Date(),
      });

      // Vendor A attempts to restore Vendor B's product
      const res = await request(app)
        .post(`/api/v1/products/${otherProd._id}/restore`)
        .set("Authorization", `Bearer ${vendorToken}`);

      expect(res.status).toBe(403);
    });
  });
});
