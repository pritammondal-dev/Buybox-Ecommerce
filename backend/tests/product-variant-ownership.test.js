const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const Customer = require("../src/models/Customer");
const Category = require("../src/models/Category");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Permission = require("../src/models/Permission");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const { generateAccessToken } = require("../src/services/token.service");
const productVariantService = require("../src/services/product-variant.service");
const {
  ensureProductOwnership,
  resolveActorVendorId,
} = require("../src/services/product.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_variant_ownership_test?")
  : "mongodb://127.0.0.1:27017/buybox_variant_ownership_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Buybox Phase 2A — ProductVariant Vendor Ownership Integrity & Isolation", () => {
  let createdPermissions = new Map();
  let testCategory;

  // Helper to ensure permissions exist in DB
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

  // Helper to create test vendor user + vendor profile
  async function createTestVendor(overrides = {}) {
    const user = await User.create({
      firstName: overrides.firstName || "Vendor",
      lastName: overrides.lastName || "Tester",
      email: `vendor_${Date.now()}_${Math.random().toString(36).substring(7)}@test-ownership.com`,
      password: "Password123!",
      role: ROLES.VENDOR,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    let vendor = null;
    if (overrides.hasProfile !== false) {
      vendor = await Vendor.create({
        userId: user._id,
        businessName: `Vendor Corp ${Date.now()}-${Math.random().toString(36).substring(7)}`,
        businessSlug: `vendor-corp-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        isActive: overrides.vendorActive !== undefined ? overrides.vendorActive : true,
        deletedAt: overrides.vendorDeletedAt !== undefined ? overrides.vendorDeletedAt : null,
        onboardingStatus: "approved",
      });
    }

    const token = generateAccessToken({
      sub: user._id.toString(),
      role: user.role,
      authVersion: user.authVersion,
      permissionVersion: user.permissionVersion,
    });

    return { user, vendor, token };
  }

  // Helper to create customer
  async function createTestCustomer() {
    const user = await User.create({
      firstName: "Customer",
      lastName: "Tester",
      email: `customer_${Date.now()}_${Math.random().toString(36).substring(7)}@test-ownership.com`,
      password: "Password123!",
      role: ROLES.CUSTOMER,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const customer = await Customer.create({
      userId: user._id,
      isActive: true,
    });

    const token = generateAccessToken({
      sub: user._id.toString(),
      role: user.role,
      authVersion: user.authVersion,
      permissionVersion: user.permissionVersion,
    });

    return { user, customer, token };
  }

  // Helper to create privileged user (admin, super_admin, manager)
  async function createPrivilegedUser(role = "admin") {
    if (role === "super_admin") {
      await User.deleteMany({ role: "super_admin" });
    }
    const user = await User.create({
      firstName: "Privileged",
      lastName: role,
      email: `${role}_${Date.now()}_${Math.random().toString(36).substring(7)}@test-ownership.com`,
      password: "Password123!",
      role,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const token = generateAccessToken({
      sub: user._id.toString(),
      role: user.role,
      authVersion: user.authVersion,
      permissionVersion: user.permissionVersion,
    });

    return { user, token };
  }

  // Helper to create a product owned by a specific vendor
  async function createTestProduct(vendorId, overrides = {}) {
    const rand = Math.random().toString(36).substring(7);
    return Product.create({
      name: `Test Product ${rand}`,
      slug: `test-product-${Date.now()}-${rand}`,
      sku: `PROD-${Date.now()}-${rand}`.toUpperCase(),
      categoryId: testCategory._id,
      vendorId,
      price: 99.99,
      status: "active",
      ...overrides,
    });
  }

  // Helper to create a product variant
  async function createTestVariant(productId, overrides = {}) {
    const rand = Math.random().toString(36).substring(7);
    return ProductVariant.create({
      productId,
      sku: `VAR-${Date.now()}-${rand}`.toUpperCase(),
      name: `Variant ${rand}`,
      price: 99.99,
      stockQuantity: 10,
      stockStatus: "in_stock",
      isActive: true,
      ...overrides,
    });
  }

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    // Ensure permissions
    await getOrCreatePermission(PERMISSIONS.PRODUCTS_READ);
    await getOrCreatePermission(PERMISSIONS.PRODUCTS_CREATE);
    await getOrCreatePermission(PERMISSIONS.PRODUCTS_UPDATE);
    await getOrCreatePermission(PERMISSIONS.PRODUCTS_DELETE);

    // Create shared category for testing
    testCategory = await Category.create({
      name: `Electronics ${Date.now()}`,
      slug: `electronics-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      isActive: true,
    });
  });

  afterAll(async () => {
    try {
      await User.deleteMany({ email: /@test-ownership\.com$/ });
      await Vendor.deleteMany({ businessSlug: /^vendor-corp-/ });
      await Customer.deleteMany({});
      await Category.deleteMany({ slug: /^electronics-/ });
      await Product.deleteMany({ sku: /^PROD-/ });
      await ProductVariant.deleteMany({ sku: /^VAR-/ });
    } catch (e) {
      // Ignored in cleanup
    }
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  // ===========================================================================
  // 1. Canonical Ownership Model & Helper Unit Contract
  // ===========================================================================
  describe("1. Canonical Ownership Model & Helper Unit Contract", () => {
    test("User._id and Vendor._id are distinct ObjectIds in the domain model", async () => {
      const { user, vendor } = await createTestVendor();
      expect(user._id).toBeDefined();
      expect(vendor._id).toBeDefined();
      expect(user._id.toString()).not.toBe(vendor._id.toString());
      expect(vendor.userId.toString()).toBe(user._id.toString());
    });

    test("resolveActorVendorId resolves User._id to Vendor._id for vendor actor", async () => {
      const { user, vendor } = await createTestVendor();
      const resolvedVendorId = await resolveActorVendorId(user);
      expect(resolvedVendorId.toString()).toBe(vendor._id.toString());
    });

    test("resolveActorVendorId returns null for privileged roles (admin, super_admin, manager)", async () => {
      const admin = await createPrivilegedUser("admin");
      const superAdmin = await createPrivilegedUser("super_admin");
      const manager = await createPrivilegedUser("manager");

      expect(await resolveActorVendorId(admin.user)).toBeNull();
      expect(await resolveActorVendorId(superAdmin.user)).toBeNull();
      expect(await resolveActorVendorId(manager.user)).toBeNull();
    });

    test("resolveActorVendorId throws 403 INSUFFICIENT_PERMISSIONS for customer actor", async () => {
      const { user } = await createTestCustomer();
      await expect(resolveActorVendorId(user)).rejects.toMatchObject({
        statusCode: 403,
        code: "INSUFFICIENT_PERMISSIONS",
      });
    });

    test("resolveActorVendorId throws 404 VENDOR_NOT_FOUND if vendor document does not exist", async () => {
      const { user } = await createTestVendor({ hasProfile: false });
      await expect(resolveActorVendorId(user)).rejects.toMatchObject({
        statusCode: 404,
        code: "VENDOR_NOT_FOUND",
      });
    });

    test("resolveActorVendorId throws 404 VENDOR_NOT_FOUND if vendor is inactive or soft-deleted", async () => {
      const inactive = await createTestVendor({ vendorActive: false });
      await expect(resolveActorVendorId(inactive.user)).rejects.toMatchObject({
        statusCode: 404,
        code: "VENDOR_NOT_FOUND",
      });

      const deleted = await createTestVendor({ vendorDeletedAt: new Date() });
      await expect(resolveActorVendorId(deleted.user)).rejects.toMatchObject({
        statusCode: 404,
        code: "VENDOR_NOT_FOUND",
      });
    });

    test("ensureProductOwnership succeeds when product.vendorId === vendor._id", async () => {
      const { user, vendor } = await createTestVendor();
      const product = await createTestProduct(vendor._id);

      const result = await ensureProductOwnership(product, user);
      expect(result.toString()).toBe(vendor._id.toString());
    });

    test("BUG FIX VERIFICATION: ensureProductOwnership REJECTS when product.vendorId was wrongly compared to user._id", async () => {
      const { user, vendor } = await createTestVendor();
      // Suppose a product erroneously had user._id instead of vendor._id
      const bogusProduct = await createTestProduct(user._id);

      // Now ensureProductOwnership correctly resolves actor's vendor._id and sees mismatch!
      await expect(ensureProductOwnership(bogusProduct, user)).rejects.toMatchObject({
        statusCode: 403,
        code: "PRODUCT_OWNERSHIP_REQUIRED",
      });
    });

    test("ensureProductOwnership throws 403 PRODUCT_OWNERSHIP_REQUIRED on cross-vendor product access", async () => {
      const vendorA = await createTestVendor();
      const vendorB = await createTestVendor();
      const productB = await createTestProduct(vendorB.vendor._id);

      await expect(ensureProductOwnership(productB, vendorA.user)).rejects.toMatchObject({
        statusCode: 403,
        code: "PRODUCT_OWNERSHIP_REQUIRED",
      });
    });

    test("ensureProductOwnership allows privileged roles without vendor check", async () => {
      const vendorA = await createTestVendor();
      const productA = await createTestProduct(vendorA.vendor._id);

      const admin = await createPrivilegedUser("admin");
      const superAdmin = await createPrivilegedUser("super_admin");
      const manager = await createPrivilegedUser("manager");

      await expect(ensureProductOwnership(productA, admin.user)).resolves.toBeNull();
      await expect(ensureProductOwnership(productA, superAdmin.user)).resolves.toBeNull();
      await expect(ensureProductOwnership(productA, manager.user)).resolves.toBeNull();
    });
  });

  // ===========================================================================
  // 2. Direct Service-Level ProductVariant Ownership & Mutation Tests
  // ===========================================================================
  describe("2. Direct Service-Level ProductVariant Mutation Ownership", () => {
    let vendorA, vendorB;
    let productA, productB;
    let variantA, variantB;

    beforeEach(async () => {
      vendorA = await createTestVendor();
      vendorB = await createTestVendor();

      productA = await createTestProduct(vendorA.vendor._id);
      productB = await createTestProduct(vendorB.vendor._id);

      variantA = await createTestVariant(productA._id);
      variantB = await createTestVariant(productB._id);
    });

    // --- CREATE ---
    test("createProductVariant: Vendor A can create variant for own Product A", async () => {
      const sku = `VAR-CREATE-A-${Date.now()}`.toUpperCase();
      const created = await productVariantService.createProductVariant({
        data: {
          productId: productA._id,
          sku,
          price: "150.00",
          stockQuantity: 25,
        },
        actor: vendorA.user,
      });

      expect(created).toBeDefined();
      expect(created.sku).toBe(sku);
      expect(created.productId.toString()).toBe(productA._id.toString());
    });

    test("createProductVariant: Vendor A CANNOT create variant for Vendor B's Product B (403 PRODUCT_OWNERSHIP_REQUIRED)", async () => {
      const sku = `VAR-CROSS-${Date.now()}`.toUpperCase();
      await expect(
        productVariantService.createProductVariant({
          data: {
            productId: productB._id,
            sku,
            price: "150.00",
            stockQuantity: 25,
          },
          actor: vendorA.user,
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "PRODUCT_OWNERSHIP_REQUIRED",
      });
    });

    test("createProductVariant: Vendor without profile fails safely (404 VENDOR_NOT_FOUND)", async () => {
      const noProfile = await createTestVendor({ hasProfile: false });
      await expect(
        productVariantService.createProductVariant({
          data: {
            productId: productA._id,
            sku: `VAR-NOPROF-${Date.now()}`.toUpperCase(),
            price: "100.00",
          },
          actor: noProfile.user,
        })
      ).rejects.toMatchObject({
        statusCode: 404,
        code: "VENDOR_NOT_FOUND",
      });
    });

    test("createProductVariant: duplicate SKU is rejected with 409 VARIANT_SKU_ALREADY_EXISTS", async () => {
      await expect(
        productVariantService.createProductVariant({
          data: {
            productId: productA._id,
            sku: variantA.sku,
            price: "100.00",
          },
          actor: vendorA.user,
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "VARIANT_SKU_ALREADY_EXISTS",
      });
    });

    test("createProductVariant: non-existent product throws 404 PRODUCT_NOT_FOUND", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await expect(
        productVariantService.createProductVariant({
          data: {
            productId: fakeId,
            sku: `VAR-FAK-${Date.now()}`.toUpperCase(),
            price: "100.00",
          },
          actor: vendorA.user,
        })
      ).rejects.toMatchObject({
        statusCode: 404,
        code: "PRODUCT_NOT_FOUND",
      });
    });

    // --- GET & LIST ---
    test("getProductVariant: Vendor A can retrieve own Variant A", async () => {
      const result = await productVariantService.getProductVariant({
        id: variantA._id,
        actor: vendorA.user,
      });
      expect(result._id.toString()).toBe(variantA._id.toString());
    });

    test("getProductVariant: Vendor A CANNOT retrieve Vendor B's Variant B (403 PRODUCT_OWNERSHIP_REQUIRED)", async () => {
      await expect(
        productVariantService.getProductVariant({
          id: variantB._id,
          actor: vendorA.user,
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "PRODUCT_OWNERSHIP_REQUIRED",
      });
    });

    test("listProductVariants: Vendor A can list variants for own Product A", async () => {
      const list = await productVariantService.listProductVariants({
        productId: productA._id,
        actor: vendorA.user,
      });
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThanOrEqual(1);
      expect(list.some((v) => v._id.toString() === variantA._id.toString())).toBe(true);
    });

    test("listProductVariants: Vendor A CANNOT list variants for Vendor B's Product B (403 PRODUCT_OWNERSHIP_REQUIRED)", async () => {
      await expect(
        productVariantService.listProductVariants({
          productId: productB._id,
          actor: vendorA.user,
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "PRODUCT_OWNERSHIP_REQUIRED",
      });
    });

    // --- UPDATE ---
    test("updateProductVariant: Vendor A can update own Variant A", async () => {
      const updated = await productVariantService.updateProductVariant({
        id: variantA._id,
        data: {
          name: "Updated Name A",
          stockQuantity: 99,
        },
        actor: vendorA.user,
      });

      expect(updated.name).toBe("Updated Name A");
      expect(updated.stockQuantity).toBe(99);
    });

    test("updateProductVariant: Vendor A CANNOT update Vendor B's Variant B (403 PRODUCT_OWNERSHIP_REQUIRED)", async () => {
      await expect(
        productVariantService.updateProductVariant({
          id: variantB._id,
          data: {
            name: "Hacked Variant B",
          },
          actor: vendorA.user,
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "PRODUCT_OWNERSHIP_REQUIRED",
      });
    });

    test("updateProductVariant: defense-in-depth ensures productId cannot be hijacked via update payload", async () => {
      const hijackedProductId = new mongoose.Types.ObjectId();
      const updated = await productVariantService.updateProductVariant({
        id: variantA._id,
        data: {
          name: "Legit Update",
          productId: hijackedProductId, // Should be stripped
        },
        actor: vendorA.user,
      });

      expect(updated.productId.toString()).toBe(productA._id.toString());
      expect(updated.productId.toString()).not.toBe(hijackedProductId.toString());
    });

    // --- DELETE ---
    test("deleteProductVariant: Vendor A can soft-delete own Variant A", async () => {
      const deleted = await productVariantService.deleteProductVariant({
        id: variantA._id,
        actor: vendorA.user,
      });

      expect(deleted.deletedAt).toBeDefined();
      expect(deleted.isActive).toBe(false);

      // Verify cannot be retrieved via normal findById
      const check = await productVariantService.getProductVariant({
        id: variantA._id,
        actor: vendorA.user,
      }).catch((e) => e);

      expect(check.statusCode).toBe(404);
      expect(check.code).toBe("VARIANT_NOT_FOUND");
    });

    test("deleteProductVariant: Vendor A CANNOT delete Vendor B's Variant B (403 PRODUCT_OWNERSHIP_REQUIRED)", async () => {
      await expect(
        productVariantService.deleteProductVariant({
          id: variantB._id,
          actor: vendorA.user,
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "PRODUCT_OWNERSHIP_REQUIRED",
      });

      // Verify variant B is still alive
      const check = await ProductVariant.findById(variantB._id);
      expect(check.deletedAt).toBeNull();
      expect(check.isActive).toBe(true);
    });

    // --- PRIVILEGED ACTORS ---
    test("Privileged roles (admin, super_admin, manager) can manage variants for any vendor's product", async () => {
      const admin = await createPrivilegedUser("admin");
      const superAdmin = await createPrivilegedUser("super_admin");
      const manager = await createPrivilegedUser("manager");

      // Admin gets Variant B
      const getB = await productVariantService.getProductVariant({
        id: variantB._id,
        actor: admin.user,
      });
      expect(getB._id.toString()).toBe(variantB._id.toString());

      // Super Admin updates Variant B
      const updateB = await productVariantService.updateProductVariant({
        id: variantB._id,
        data: { name: "Admin Updated" },
        actor: superAdmin.user,
      });
      expect(updateB.name).toBe("Admin Updated");

      // Manager lists variants for Product B
      const listB = await productVariantService.listProductVariants({
        productId: productB._id,
        actor: manager.user,
      });
      expect(listB.length).toBeGreaterThanOrEqual(1);

      // Admin creates variant for Product B
      const sku = `VAR-ADMIN-${Date.now()}`.toUpperCase();
      const created = await productVariantService.createProductVariant({
        data: {
          productId: productB._id,
          sku,
          price: "200.00",
        },
        actor: admin.user,
      });
      expect(created.sku).toBe(sku);

      // Super Admin deletes created variant
      const del = await productVariantService.deleteProductVariant({
        id: created._id,
        actor: superAdmin.user,
      });
      expect(del.deletedAt).toBeDefined();
    });
  });

  // ===========================================================================
  // 3. HTTP Integration Tests on Mounted Routes (/api/v1/product-variants)
  // ===========================================================================
  describe("3. HTTP Integration on /api/v1/product-variants", () => {
    let vendorA, vendorB, customerUser, adminUser;
    let productA, productB;
    let variantA, variantB;

    beforeEach(async () => {
      vendorA = await createTestVendor();
      vendorB = await createTestVendor();
      customerUser = await createTestCustomer();
      adminUser = await createPrivilegedUser("admin");

      productA = await createTestProduct(vendorA.vendor._id);
      productB = await createTestProduct(vendorB.vendor._id);

      variantA = await createTestVariant(productA._id);
      variantB = await createTestVariant(productB._id);
    });

    // --- POST /product/:productId ---
    test("POST /product/:productId: Vendor A creates variant under Product A (201 CREATED)", async () => {
      const sku = `HTTP-VAR-A-${Date.now()}`.toUpperCase();
      const res = await request(app)
        .post(`/api/v1/product-variants/product/${productA._id}`)
        .set("Authorization", `Bearer ${vendorA.token}`)
        .send({
          sku,
          price: "199.99",
          stockQuantity: 15,
          stockStatus: "in_stock",
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.variant.sku).toBe(sku);
      expect(res.body.data.variant.productId.toString()).toBe(productA._id.toString());
    });

    test("POST /product/:productId: Vendor A CANNOT create variant under Vendor B's Product B (403 PRODUCT_OWNERSHIP_REQUIRED)", async () => {
      const sku = `HTTP-CROSS-VAR-${Date.now()}`.toUpperCase();
      const res = await request(app)
        .post(`/api/v1/product-variants/product/${productB._id}`)
        .set("Authorization", `Bearer ${vendorA.token}`)
        .send({
          sku,
          price: "199.99",
          stockQuantity: 15,
        })
        .expect(403);

      expect(res.body.code).toBe("PRODUCT_OWNERSHIP_REQUIRED");
    });

    test("POST /product/:productId: Customer cannot create variant (403 INSUFFICIENT_PERMISSIONS)", async () => {
      const sku = `HTTP-CUST-VAR-${Date.now()}`.toUpperCase();
      const res = await request(app)
        .post(`/api/v1/product-variants/product/${productA._id}`)
        .set("Authorization", `Bearer ${customerUser.token}`)
        .send({
          sku,
          price: "199.99",
        })
        .expect(403);

      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("POST /product/:productId: Admin can create variant under any vendor's product (201 CREATED)", async () => {
      const sku = `HTTP-ADMIN-VAR-${Date.now()}`.toUpperCase();
      const res = await request(app)
        .post(`/api/v1/product-variants/product/${productB._id}`)
        .set("Authorization", `Bearer ${adminUser.token}`)
        .send({
          sku,
          price: "299.99",
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.variant.sku).toBe(sku);
    });

    // --- GET /product/:productId ---
    test("GET /product/:productId: Vendor A retrieves variants for own Product A (200 OK)", async () => {
      const res = await request(app)
        .get(`/api/v1/product-variants/product/${productA._id}`)
        .set("Authorization", `Bearer ${vendorA.token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.variants)).toBe(true);
      expect(res.body.data.variants.length).toBeGreaterThanOrEqual(1);
    });

    test("GET /product/:productId: Vendor A CANNOT retrieve variants for Vendor B's Product B (403 PRODUCT_OWNERSHIP_REQUIRED)", async () => {
      const res = await request(app)
        .get(`/api/v1/product-variants/product/${productB._id}`)
        .set("Authorization", `Bearer ${vendorA.token}`)
        .expect(403);

      expect(res.body.code).toBe("PRODUCT_OWNERSHIP_REQUIRED");
    });

    // --- GET /:id ---
    test("GET /:id: Vendor A retrieves own Variant A (200 OK)", async () => {
      const res = await request(app)
        .get(`/api/v1/product-variants/${variantA._id}`)
        .set("Authorization", `Bearer ${vendorA.token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.variant._id.toString()).toBe(variantA._id.toString());
    });

    test("GET /:id: Vendor A CANNOT retrieve Vendor B's Variant B (403 PRODUCT_OWNERSHIP_REQUIRED)", async () => {
      const res = await request(app)
        .get(`/api/v1/product-variants/${variantB._id}`)
        .set("Authorization", `Bearer ${vendorA.token}`)
        .expect(403);

      expect(res.body.code).toBe("PRODUCT_OWNERSHIP_REQUIRED");
    });

    // --- PATCH /:id ---
    test("PATCH /:id: Vendor A updates own Variant A (200 OK)", async () => {
      const res = await request(app)
        .patch(`/api/v1/product-variants/${variantA._id}`)
        .set("Authorization", `Bearer ${vendorA.token}`)
        .send({
          price: "88.50",
          stockQuantity: 42,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      const priceVal = res.body.data.variant.price.$numberDecimal || res.body.data.variant.price;
      expect(["88.50", "88.5"]).toContain(priceVal.toString());
      expect(res.body.data.variant.stockQuantity).toBe(42);
    });

    test("PATCH /:id: Vendor A CANNOT update Vendor B's Variant B (403 PRODUCT_OWNERSHIP_REQUIRED)", async () => {
      const res = await request(app)
        .patch(`/api/v1/product-variants/${variantB._id}`)
        .set("Authorization", `Bearer ${vendorA.token}`)
        .send({
          price: "1.00",
        })
        .expect(403);

      expect(res.body.code).toBe("PRODUCT_OWNERSHIP_REQUIRED");
    });

    // --- DELETE /:id ---
    test("DELETE /:id: Admin can soft delete Variant B (200 OK)", async () => {
      const res = await request(app)
        .delete(`/api/v1/product-variants/${variantB._id}`)
        .set("Authorization", `Bearer ${adminUser.token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const check = await ProductVariant.findById(variantB._id);
      expect(check.deletedAt).toBeDefined();
    });

    test("DELETE /:id: Unauthenticated request returns 401 AUTHENTICATION_REQUIRED", async () => {
      const res = await request(app)
        .delete(`/api/v1/product-variants/${variantA._id}`)
        .expect(401);

      expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
    });
  });
});
