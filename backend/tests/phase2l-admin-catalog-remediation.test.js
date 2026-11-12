const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Employee = require("../src/models/Employee");
const Vendor = require("../src/models/Vendor");
const Category = require("../src/models/Category");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Permission = require("../src/models/Permission");
const Role = require("../src/models/Role");
const RolePermission = require("../src/models/RolePermission");
const EmployeeRole = require("../src/models/EmployeeRole");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const { generateAccessToken } = require("../src/services/token.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_phase2l_test?")
  : "mongodb://127.0.0.1:27017/buybox_phase2l_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Buybox Phase 2L.1 — Admin Catalog Remediation Integration Suite", () => {
  let adminToken;
  let adminUser;
  let vendorAToken;
  let vendorAUser;
  let vendorAVendor;
  let vendorBToken;
  let vendorBUser;
  let vendorBVendor;
  let testCategory;

  let activeProduct;
  let draftProductA;
  let pendingProductA;
  let draftProductB;
  let variableProductWithInactiveVariant;
  let activeVariant;
  let inactiveVariant;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    // Clean test collections
    await Promise.all([
      User.deleteMany({ email: /@phase2l\.test$/ }),
      Employee.deleteMany({}),
      Role.deleteMany({ slug: /phase2l/ }),
      RolePermission.deleteMany({}),
      EmployeeRole.deleteMany({}),
      Vendor.deleteMany({ businessName: /Phase2L/ }),
      Category.deleteMany({ slug: /phase2l/ }),
      Product.deleteMany({ slug: /phase2l/ }),
      ProductVariant.deleteMany({ sku: /P2L-/ }),
    ]);

    testCategory = await Category.create({
      name: "Phase 2L Catalog Category",
      slug: "phase2l-catalog-cat",
      isActive: true,
    });

    // 1. Create Super Admin / Staff user with products permissions
    adminUser = await User.create({
      firstName: "Admin",
      lastName: "User",
      email: "admin@phase2l.test",
      password: "HashedPassword123!",
      role: ROLES.ADMIN,
      context: "administrator",
      isEmailVerified: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const adminEmp = await Employee.create({
      userId: adminUser._id,
      employeeNumber: "EMP-P2L-001",
      jobTitle: "Catalog Administrator",
      department: "Catalog Operations",
      status: "active",
      joiningDate: new Date(),
    });

    // Create and assign products:read, products:update, products:moderate permissions
    const permSlugs = [
      PERMISSIONS.PRODUCTS_READ,
      PERMISSIONS.PRODUCTS_CREATE,
      PERMISSIONS.PRODUCTS_UPDATE,
      PERMISSIONS.PRODUCTS_DELETE,
      PERMISSIONS.PRODUCTS_MODERATE,
    ];
    for (const slug of permSlugs) {
      let p = await Permission.findOne({ slug });
      if (!p) {
        p = await Permission.create({
          slug,
          name: `Permission ${slug}`,
          module: "products",
          isActive: true,
        });
      }
    }

    const adminRole = await Role.create({
      name: "Phase2L Admin Role",
      slug: "phase2l-admin-role",
      description: "Full Catalog Admin",
      isActive: true,
    });

    for (const slug of permSlugs) {
      const p = await Permission.findOne({ slug });
      await RolePermission.create({ roleId: adminRole._id, permissionId: p._id });
    }

    await EmployeeRole.create({
      employeeId: adminEmp._id,
      roleId: adminRole._id,
      isActive: true,
      expiresAt: null,
    });

    adminToken = generateAccessToken({
      sub: adminUser._id.toString(),
      role: ROLES.ADMIN,
      context: "administrator",
      isEmailVerified: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    // 2. Create Vendor A
    vendorAUser = await User.create({
      firstName: "Vendor",
      lastName: "A",
      email: "vendor_a@phase2l.test",
      password: "HashedPassword123!",
      role: ROLES.VENDOR,
      context: "vendor",
      isEmailVerified: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    vendorAVendor = await Vendor.create({
      userId: vendorAUser._id,
      businessName: "Phase2L Vendor A Store",
      businessSlug: "phase2l-vendor-a",
      email: "vendor_a@phase2l.test",
      onboardingStatus: "approved",
      status: "approved",
      isActive: true,
    });

    vendorAToken = generateAccessToken({
      sub: vendorAUser._id.toString(),
      role: ROLES.VENDOR,
      context: "vendor",
      isEmailVerified: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    // 3. Create Vendor B
    vendorBUser = await User.create({
      firstName: "Vendor",
      lastName: "B",
      email: "vendor_b@phase2l.test",
      password: "HashedPassword123!",
      role: ROLES.VENDOR,
      context: "vendor",
      isEmailVerified: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    vendorBVendor = await Vendor.create({
      userId: vendorBUser._id,
      businessName: "Phase2L Vendor B Store",
      businessSlug: "phase2l-vendor-b",
      email: "vendor_b@phase2l.test",
      onboardingStatus: "approved",
      status: "approved",
      isActive: true,
    });

    vendorBToken = generateAccessToken({
      sub: vendorBUser._id.toString(),
      role: ROLES.VENDOR,
      context: "vendor",
      isEmailVerified: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    // 4. Create Seed Products
    activeProduct = await Product.create({
      name: "Active Public Product",
      slug: "phase2l-active-public-product",
      sku: "P2L-ACT-001",
      productType: "simple",
      price: mongoose.Types.Decimal128.fromString("99.99"),
      status: "active",
      vendorId: vendorAVendor._id,
      categoryId: testCategory._id,
      images: [{ url: "/uploads/active.png", sortOrder: 0 }],
    });

    draftProductA = await Product.create({
      name: "Draft Product Vendor A",
      slug: "phase2l-draft-product-vendor-a",
      sku: "P2L-DFT-001",
      productType: "simple",
      price: mongoose.Types.Decimal128.fromString("49.99"),
      status: "draft",
      vendorId: vendorAVendor._id,
      categoryId: testCategory._id,
      images: [{ url: "/uploads/draft_a.png", sortOrder: 0 }],
    });

    pendingProductA = await Product.create({
      name: "Pending Approval Product Vendor A",
      slug: "phase2l-pending-product-vendor-a",
      sku: "P2L-PND-001",
      productType: "simple",
      price: mongoose.Types.Decimal128.fromString("59.99"),
      status: "pending_approval",
      submittedAt: new Date(),
      vendorId: vendorAVendor._id,
      categoryId: testCategory._id,
      images: [{ url: "/uploads/pending_a.png", sortOrder: 0 }],
    });

    draftProductB = await Product.create({
      name: "Draft Product Vendor B",
      slug: "phase2l-draft-product-vendor-b",
      sku: "P2L-DFT-002",
      productType: "simple",
      price: mongoose.Types.Decimal128.fromString("149.99"),
      status: "draft",
      vendorId: vendorBVendor._id,
      categoryId: testCategory._id,
      images: [{ url: "/uploads/draft_b.png", sortOrder: 0 }],
    });

    // Variable product with 1 active variant and 1 inactive variant
    variableProductWithInactiveVariant = await Product.create({
      name: "Variable Product with Variants",
      slug: "phase2l-variable-product-variants",
      sku: "P2L-VAR-001",
      productType: "variable",
      price: mongoose.Types.Decimal128.fromString("199.99"),
      status: "active",
      vendorId: vendorAVendor._id,
      categoryId: testCategory._id,
      images: [{ url: "/uploads/var_main.png", sortOrder: 0 }],
    });

    activeVariant = await ProductVariant.create({
      productId: variableProductWithInactiveVariant._id,
      sku: "P2L-VAR-001-ACT",
      price: mongoose.Types.Decimal128.fromString("199.99"),
      isActive: true,
      stockQuantity: 10,
      attributes: { Color: "Blue" },
    });

    inactiveVariant = await ProductVariant.create({
      productId: variableProductWithInactiveVariant._id,
      sku: "P2L-VAR-001-INA",
      price: mongoose.Types.Decimal128.fromString("219.99"),
      isActive: false,
      stockQuantity: 5,
      attributes: { Color: "Red" },
    });
  });

  afterAll(async () => {
    await Promise.all([
      User.deleteMany({ email: /@phase2l\.test$/ }),
      Employee.deleteMany({ employeeNumber: /EMP-P2L/ }),
      Role.deleteMany({ slug: /phase2l/ }),
      RolePermission.deleteMany({}),
      EmployeeRole.deleteMany({}),
      Vendor.deleteMany({ businessName: /Phase2L/ }),
      Category.deleteMany({ slug: /phase2l/ }),
      Product.deleteMany({ slug: /phase2l/ }),
      ProductVariant.deleteMany({ sku: /P2L-/ }),
    ]);
    await mongoose.disconnect();
  });

  // ==========================================
  // DEF-006: PUBLIC STOREFRONT SECURITY
  // ==========================================
  describe("DEF-006: Public Storefront Security & Visibility Restrictions", () => {
    it("1. Public GET /products without status query returns ONLY active products", async () => {
      const res = await request(app).get("/api/v1/products");
      expect(res.status).toBe(200);
      const items = res.body.data || [];
      const nonActive = items.filter((p) => p.status !== "active");
      expect(nonActive.length).toBe(0);
    });

    it("2. Anonymous GET /products?status=draft does NOT return draft products (coerced to active)", async () => {
      const res = await request(app).get("/api/v1/products?status=draft");
      expect(res.status).toBe(200);
      const items = res.body.data || [];
      const drafts = items.filter((p) => p.status === "draft");
      expect(drafts.length).toBe(0);
      const nonActive = items.filter((p) => p.status !== "active");
      expect(nonActive.length).toBe(0);
    });

    it("3. Anonymous GET /products?status=pending_approval does NOT return pending products", async () => {
      const res = await request(app).get("/api/v1/products?status=pending_approval");
      expect(res.status).toBe(200);
      const items = res.body.data || [];
      const pending = items.filter((p) => p.status === "pending_approval");
      expect(pending.length).toBe(0);
    });

    it("4. Anonymous GET /products?status=all does NOT disclose non-active products", async () => {
      const res = await request(app).get("/api/v1/products?status=all");
      expect(res.status).toBe(200);
      const items = res.body.data || [];
      const nonActive = items.filter((p) => p.status !== "active");
      expect(nonActive.length).toBe(0);
    });

    it("5. Anonymous GET /products/:id on draft product returns 404 (does not leak draft)", async () => {
      const res = await request(app).get(`/api/v1/products/${draftProductA._id}`);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
    });

    it("6. Anonymous GET /products/:id on pending_approval product returns 404", async () => {
      const res = await request(app).get(`/api/v1/products/${pendingProductA._id}`);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
    });
  });

  // ==========================================
  // DEF-003: AUTHENTICATED ADMINISTRATOR INSPECTION
  // ==========================================
  describe("DEF-003: Authenticated Administrator Catalog Inspection", () => {
    it("7. Authenticated Admin can list products across all statuses via dedicated /admin/catalog", async () => {
      const res = await request(app)
        .get("/api/v1/products/admin/catalog?status=all")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const items = res.body.data || [];
      expect(items.length).toBeGreaterThan(0);
      const hasActive = items.some((p) => p.status === "active");
      const hasDraft = items.some((p) => p.status === "draft");
      const hasPending = items.some((p) => p.status === "pending_approval");
      expect(hasActive).toBe(true);
      expect(hasDraft).toBe(true);
      expect(hasPending).toBe(true);
    });

    it("8. Authenticated Admin can inspect draft product via /products/admin/:id", async () => {
      const res = await request(app)
        .get(`/api/v1/products/admin/${draftProductA._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.product._id.toString()).toBe(draftProductA._id.toString());
      expect(res.body.data.product.status).toBe("draft");
    });

    it("9. Authenticated Admin can inspect pending_approval product via /products/admin/:id", async () => {
      const res = await request(app)
        .get(`/api/v1/products/admin/${pendingProductA._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.product.status).toBe("pending_approval");
    });

    it("10. Authenticated Admin inspecting through /products/:id also succeeds via bearer token", async () => {
      const res = await request(app)
        .get(`/api/v1/products/${draftProductA._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.product.status).toBe("draft");
    });

    it("11. Unauthorized caller cannot access /products/admin/catalog (401 without token)", async () => {
      const res = await request(app).get("/api/v1/products/admin/catalog");
      expect(res.status).toBe(401);
    });

    it("12. Vendor cannot access /products/admin/catalog (403 INSUFFICIENT_ROLE)", async () => {
      const res = await request(app)
        .get("/api/v1/products/admin/catalog")
        .set("Authorization", `Bearer ${vendorAToken}`);
      expect(res.status).toBe(403);
    });

    it("13. Cross-vendor isolation: Vendor A cannot inspect Vendor B's draft product (404)", async () => {
      const res = await request(app)
        .get(`/api/v1/products/${draftProductB._id}`)
        .set("Authorization", `Bearer ${vendorAToken}`);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
    });
  });

  // ==========================================
  // DEF-010: INACTIVE VARIANT VISIBILITY
  // ==========================================
  describe("DEF-010: Inactive Variant Admin Visibility vs Storefront Masking", () => {
    it("14. Admin inspecting variable product receives BOTH active and inactive variants", async () => {
      const res = await request(app)
        .get(`/api/v1/products/admin/${variableProductWithInactiveVariant._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const variants = res.body.data.product.variants || [];
      expect(variants.length).toBe(2);
      const foundActive = variants.find((v) => v.sku === "P2L-VAR-001-ACT");
      const foundInactive = variants.find((v) => v.sku === "P2L-VAR-001-INA");
      expect(foundActive).toBeDefined();
      expect(foundActive.isActive).toBe(true);
      expect(foundInactive).toBeDefined();
      expect(foundInactive.isActive).toBe(false);
    });

    it("15. Storefront public inspect receives ONLY active variants (inactive masked)", async () => {
      const res = await request(app).get(
        `/api/v1/products/${variableProductWithInactiveVariant._id}`
      );

      expect(res.status).toBe(200);
      const variants = res.body.data.product.variants || [];
      expect(variants.length).toBe(1);
      expect(variants[0]._id).toBe(activeVariant._id.toString());
      expect(variants[0].sku).toBeUndefined();
    });
  });

  // ==========================================
  // DEF-004 & DEF-011: LIFECYCLE APPROVAL & SUBMISSION
  // ==========================================
  describe("DEF-004 & DEF-011: Product Lifecycle Approval and Submission Rules", () => {
    it("16. Approving a draft product directly fails with 400 INVALID_PRODUCT_STATUS", async () => {
      const res = await request(app)
        .patch(`/api/v1/products/${draftProductA._id}/approve`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_PRODUCT_STATUS");
      expect(res.body.message).toContain("Must be pending_approval");
    });

    it("17. Submitting a draft product transitions it to pending_approval", async () => {
      const res = await request(app)
        .post(`/api/v1/products/${draftProductA._id}/submit`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.product.status).toBe("pending_approval");
      expect(res.body.data.product.submittedAt).not.toBeNull();
    });

    it("18. Once submitted (pending_approval), approving the product succeeds", async () => {
      const res = await request(app)
        .patch(`/api/v1/products/${draftProductA._id}/approve`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.product.status).toBe("active");
      expect(res.body.data.product.approvedAt).not.toBeNull();
    });
  });

  // ==========================================
  // DEF-005 & DEF-008: BULK OPERATION RESPONSE CONTRACT
  // ==========================================
  describe("DEF-005 & DEF-008: Bulk Operations Contract & Per-Item Status", () => {
    let bulkDraft1;
    let bulkDraft2;

    beforeAll(async () => {
      bulkDraft1 = await Product.create({
        name: "Bulk Draft 1",
        slug: "phase2l-bulk-draft-1",
        sku: "P2L-BLK-001",
        productType: "simple",
        price: mongoose.Types.Decimal128.fromString("29.99"),
        status: "draft",
        vendorId: vendorAVendor._id,
        categoryId: testCategory._id,
      });

      bulkDraft2 = await Product.create({
        name: "Bulk Draft 2",
        slug: "phase2l-bulk-draft-2",
        sku: "P2L-BLK-002",
        productType: "simple",
        price: mongoose.Types.Decimal128.fromString("39.99"),
        status: "draft",
        vendorId: vendorAVendor._id,
        categoryId: testCategory._id,
      });
    });

    it("19. Bulk action 'submit' successfully submits draft products for approval", async () => {
      const res = await request(app)
        .post("/api/v1/products/admin/bulk-operations")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          productIds: [bulkDraft1._id.toString(), bulkDraft2._id.toString()],
          action: "submit",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.summary.total).toBe(2);
      expect(res.body.data.summary.succeeded).toBe(2);
      expect(res.body.data.summary.failed).toBe(0);
      expect(res.body.data.results).toHaveLength(2);
      expect(res.body.data.results[0].id).toBe(bulkDraft1._id.toString());
      expect(res.body.data.results[0].success).toBe(true);
      expect(res.body.data.results[0].status).toBe("pending_approval");
    });

    it("20. Bulk action 'approve' on newly pending items succeeds with canonical summary", async () => {
      const res = await request(app)
        .post("/api/v1/products/admin/bulk-operations")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          productIds: [bulkDraft1._id.toString(), bulkDraft2._id.toString()],
          action: "approve",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.summary.total).toBe(2);
      expect(res.body.data.summary.succeeded).toBe(2);
      expect(res.body.data.summary.failed).toBe(0);
      expect(res.body.data.results[0].status).toBe("active");
    });

    it("21. Bulk action 'approve' on draft product reports accurate failure in summary and results[].id", async () => {
      const freshDraft = await Product.create({
        name: "Fresh Draft for Failed Bulk",
        slug: "phase2l-fresh-draft-bulk-fail",
        sku: "P2L-BLK-003",
        productType: "simple",
        price: mongoose.Types.Decimal128.fromString("19.99"),
        status: "draft",
        vendorId: vendorAVendor._id,
        categoryId: testCategory._id,
      });

      const res = await request(app)
        .post("/api/v1/products/admin/bulk-operations")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          productIds: [freshDraft._id.toString()],
          action: "approve",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.summary.total).toBe(1);
      expect(res.body.data.summary.succeeded).toBe(0);
      expect(res.body.data.summary.failed).toBe(1);
      expect(res.body.data.results[0].id).toBe(freshDraft._id.toString());
      expect(res.body.data.results[0].success).toBe(false);
      expect(res.body.data.results[0].error).toContain("Must be pending_approval");
    });
  });
});
