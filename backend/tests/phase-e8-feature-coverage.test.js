const request = require("supertest");
const mongoose = require("mongoose");
const express = require("express");

const {
  PERMISSIONS,
  ALIAS_MAP,
  resolvePermissionAliases,
  SECTION5_CATALOG,
} = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const {
  CANONICAL_PERMISSIONS_49,
} = require("../src/constants/role-permissions.constants");
const {
  getEffectivePermissions,
} = require("../src/services/authorization.service");

// Models
const User = require("../src/models/User");
const Employee = require("../src/models/Employee");
const JobRole = require("../src/models/JobRole");
const Role = require("../src/models/Role");
const Permission = require("../src/models/Permission");
const Category = require("../src/models/Category");
const Brand = require("../src/models/Brand");
const Attribute = require("../src/models/Attribute");

// Route modules
const storefrontBannerRoutes = require("../src/routes/storefront-banner.routes");
const cmsPageRoutes = require("../src/routes/cms-page.routes");
const storefrontMediaRoutes = require("../src/routes/storefront-media.routes");
const storefrontMenuRoutes = require("../src/routes/storefront-menu.routes");
const storefrontContentBlockRoutes = require("../src/routes/storefront-content-block.routes");
const categoryRoutes = require("../src/routes/category.routes");
const brandRoutes = require("../src/routes/brand.routes");
const attributeRoutes = require("../src/routes/attribute.routes");
const productRoutes = require("../src/routes/product.routes");
const credentialRoutes = require("../src/routes/credential.routes");
const cmsEventRoutes = require("../src/routes/cms-event.routes");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_e8_test?")
  : "mongodb://127.0.0.1:27017/buybox_e8_test?replicaSet=rs0";

describe("Phase E8 — Feature-to-Permission Coverage & Granular Authorization Suite", () => {
  let app;
  let testCmsSpecialistUser;
  let testCategorySpecialistUser;
  let testBrandSpecialistUser;
  let testAttributeSpecialistUser;
  let testFullAdminUser;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
      });
    }

    // Clean up any test users
    await User.deleteMany({ email: /@test-e8-coverage\.com$/ });
    await Employee.deleteMany({ employeeNumber: /^EMP_E8_/ });
    await JobRole.deleteMany({ slug: /^e8-role-/ });
    await Category.deleteMany({ name: /Test Category E8/ });
    await Brand.deleteMany({ name: /Test Brand E8/ });
    await Attribute.deleteMany({ name: /Test Attribute E8/ });

    // 1. Create CMS Specialist User & Employee
    testCmsSpecialistUser = await User.create({
      firstName: "CMS",
      lastName: "Specialist",
      email: `cms.specialist_${Date.now()}@test-e8-coverage.com`,
      password: "TestPassword123!",
      role: ROLES.ADMIN,
      isEmailVerified: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    const cmsRole = await JobRole.create({
      name: `CMS Specialist Role ${Date.now()}`,
      slug: `e8-role-cms-${Date.now()}`,
      tier: 4,
      permissions: ["cms.view", "cms.create", "cms.edit"],
      isActive: true,
    });
    await Employee.create({
      userId: testCmsSpecialistUser._id,
      employeeNumber: `EMP_E8_CMS_${Date.now()}`,
      status: "active",
      jobRoleId: cmsRole._id,
    });

    // 2. Create Category Specialist User & Employee
    testCategorySpecialistUser = await User.create({
      firstName: "Category",
      lastName: "Specialist",
      email: `cat.specialist_${Date.now()}@test-e8-coverage.com`,
      password: "TestPassword123!",
      role: ROLES.ADMIN,
      isEmailVerified: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    const catRole = await JobRole.create({
      name: `Category Specialist Role ${Date.now()}`,
      slug: `e8-role-cat-${Date.now()}`,
      tier: 4,
      permissions: ["categories.view", "categories.create", "categories.edit"],
      isActive: true,
    });
    await Employee.create({
      userId: testCategorySpecialistUser._id,
      employeeNumber: `EMP_E8_CAT_${Date.now()}`,
      status: "active",
      jobRoleId: catRole._id,
    });

    // 3. Create Brand Specialist User & Employee
    testBrandSpecialistUser = await User.create({
      firstName: "Brand",
      lastName: "Specialist",
      email: `brand.specialist_${Date.now()}@test-e8-coverage.com`,
      password: "TestPassword123!",
      role: ROLES.ADMIN,
      isEmailVerified: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    const brandRole = await JobRole.create({
      name: `Brand Specialist Role ${Date.now()}`,
      slug: `e8-role-brand-${Date.now()}`,
      tier: 4,
      permissions: ["brands.view", "brands.create", "brands.edit"],
      isActive: true,
    });
    await Employee.create({
      userId: testBrandSpecialistUser._id,
      employeeNumber: `EMP_E8_BRAND_${Date.now()}`,
      status: "active",
      jobRoleId: brandRole._id,
    });

    // 4. Create Attribute Specialist User & Employee
    testAttributeSpecialistUser = await User.create({
      firstName: "Attribute",
      lastName: "Specialist",
      email: `attr.specialist_${Date.now()}@test-e8-coverage.com`,
      password: "TestPassword123!",
      role: ROLES.ADMIN,
      isEmailVerified: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    const attrRole = await JobRole.create({
      name: `Attribute Specialist Role ${Date.now()}`,
      slug: `e8-role-attr-${Date.now()}`,
      tier: 4,
      permissions: ["attributes.view", "attributes.create", "attributes.edit"],
      isActive: true,
    });
    await Employee.create({
      userId: testAttributeSpecialistUser._id,
      employeeNumber: `EMP_E8_ATTR_${Date.now()}`,
      status: "active",
      jobRoleId: attrRole._id,
    });

    // 5. Create Full Admin User & Employee (legacy colon permissions)
    testFullAdminUser = await User.create({
      firstName: "Full",
      lastName: "Admin",
      email: `full.admin_${Date.now()}@test-e8-coverage.com`,
      password: "TestPassword123!",
      role: ROLES.ADMIN,
      isEmailVerified: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    const fullAdminRole = await JobRole.create({
      name: `Full Admin Role ${Date.now()}`,
      slug: `e8-role-full-${Date.now()}`,
      tier: 2,
      permissions: [
        "settings:read",
        "settings:manage",
        "products:read",
        "products:create",
        "products:update",
        "products:delete",
      ],
      isActive: true,
    });
    await Employee.create({
      userId: testFullAdminUser._id,
      employeeNumber: `EMP_E8_FULL_${Date.now()}`,
      status: "active",
      jobRoleId: fullAdminRole._id,
    });

    app = express();
    app.use(express.json());

    // Inject simulated authenticated session
    app.use((req, res, next) => {
      const authHeader = req.headers["x-test-user"];
      if (authHeader) {
        req.user = JSON.parse(authHeader);
      }
      next();
    });

    // Mount audited routes
    app.use("/api/v1/storefront/banners", storefrontBannerRoutes);
    app.use("/api/v1/cms/pages", cmsPageRoutes);
    app.use("/api/v1/storefront/media", storefrontMediaRoutes);
    app.use("/api/v1/storefront/menus", storefrontMenuRoutes);
    app.use("/api/v1/storefront/content-blocks", storefrontContentBlockRoutes);
    app.use("/api/v1/categories", categoryRoutes);
    app.use("/api/v1/brands", brandRoutes);
    app.use("/api/v1/attributes", attributeRoutes);
    app.use("/api/v1/products", productRoutes);
    app.use("/api/v1/credentials", credentialRoutes);
    app.use("/api/v1/cms/events", cmsEventRoutes);

    // Standard error handler
    app.use((err, req, res, next) => {
      res.status(err.statusCode || 500).json({
        success: false,
        errorCode: err.code || err.errorCode || "INTERNAL_ERROR",
        message: err.message,
      });
    });
  });

  afterAll(async () => {
    await User.deleteMany({ email: /@test-e8-coverage\.com$/ });
    await Employee.deleteMany({ email: /@test-e8-coverage\.com$/ });
    await Category.deleteMany({ name: /Test Category E8/ });
    await Brand.deleteMany({ name: /Test Brand E8/ });
    await Attribute.deleteMany({ name: /Test Attribute E8/ });
    await mongoose.connection.close();
  });

  describe("1. Canonical Contract & Section 5 Catalog Integrity", () => {
    it("preserves exactly 49 canonical permissions in CANONICAL_PERMISSIONS_49", () => {
      expect(CANONICAL_PERMISSIONS_49).toHaveLength(49);
      expect(new Set(CANONICAL_PERMISSIONS_49).size).toBe(49);
    });

    it("verifies SECTION5_CATALOG contains all expected operational categories", () => {
      const categories = SECTION5_CATALOG.map((c) => c.category);
      expect(categories).toContain("CMS");
      expect(categories).toContain("Categories");
      expect(categories).toContain("Brands");
      expect(categories).toContain("Attributes");
      expect(categories).toContain("Platform Settings");
      expect(categories).toContain("Platform Credentials");
    });
  });

  describe("2. CMS Granular Permission Remediation Verification", () => {
    it("allows CMS Specialist with cms.view to read banners and pages", async () => {
      const cmsAuth = {
        id: testCmsSpecialistUser._id.toString(),
        role: ROLES.ADMIN,
        isPermissionFresh: true,
      };

      const bannerRes = await request(app)
        .get("/api/v1/storefront/banners")
        .set("x-test-user", JSON.stringify(cmsAuth));
      expect(bannerRes.status).toBe(200);

      const pagesRes = await request(app)
        .get("/api/v1/cms/pages")
        .set("x-test-user", JSON.stringify(cmsAuth));
      expect(pagesRes.status).toBe(200);

      const mediaRes = await request(app)
        .get("/api/v1/storefront/media")
        .set("x-test-user", JSON.stringify(cmsAuth));
      expect(mediaRes.status).toBe(200);

      const menuRes = await request(app)
        .get("/api/v1/storefront/menus")
        .set("x-test-user", JSON.stringify(cmsAuth));
      expect(menuRes.status).toBe(200);

      const blockRes = await request(app)
        .get("/api/v1/storefront/content-blocks")
        .set("x-test-user", JSON.stringify(cmsAuth));
      expect(blockRes.status).toBe(200);
    });

    it("strictly forbids CMS Specialist from accessing platform credentials (403)", async () => {
      const cmsAuth = {
        id: testCmsSpecialistUser._id.toString(),
        role: ROLES.ADMIN,
        isPermissionFresh: true,
      };

      const credRes = await request(app)
        .get("/api/v1/credentials")
        .set("x-test-user", JSON.stringify(cmsAuth));
      expect(credRes.status).toBe(403);
      expect(credRes.body.errorCode).toBe("INSUFFICIENT_PERMISSIONS");
    });
  });

  describe("3. Catalog Sub-domain Granular Isolation Verification", () => {
    it("allows Category Specialist to create category, but forbids product & attribute creation", async () => {
      const catAuth = {
        id: testCategorySpecialistUser._id.toString(),
        role: ROLES.ADMIN,
        isPermissionFresh: true,
      };

      // 1. Category creation -> Permitted
      const catRes = await request(app)
        .post("/api/v1/categories")
        .set("x-test-user", JSON.stringify(catAuth))
        .send({
          name: "Test Category E8 " + Date.now(),
          slug: "test-category-e8-" + Date.now(),
        });
      expect([201, 200]).toContain(catRes.status);

      // 2. Product creation -> FORBIDDEN (403)
      const prodRes = await request(app)
        .post("/api/v1/products")
        .set("x-test-user", JSON.stringify(catAuth))
        .send({ title: "Unauthorized Product" });
      expect(prodRes.status).toBe(403);
      expect(prodRes.body.errorCode).toBe("INSUFFICIENT_PERMISSIONS");

      // 3. Attribute creation -> FORBIDDEN (403)
      const attrRes = await request(app)
        .post("/api/v1/attributes")
        .set("x-test-user", JSON.stringify(catAuth))
        .send({ name: "Unauthorized Attribute" });
      expect(attrRes.status).toBe(403);
      expect(attrRes.body.errorCode).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("allows Brand Specialist to create brand, but forbids product creation", async () => {
      const brandAuth = {
        id: testBrandSpecialistUser._id.toString(),
        role: ROLES.ADMIN,
        isPermissionFresh: true,
      };

      // 1. Brand creation -> Permitted
      const brandRes = await request(app)
        .post("/api/v1/brands")
        .set("x-test-user", JSON.stringify(brandAuth))
        .send({
          name: "Test Brand E8 " + Date.now(),
          slug: "test-brand-e8-" + Date.now(),
        });
      expect([201, 200]).toContain(brandRes.status);

      // 2. Product creation -> FORBIDDEN (403)
      const prodRes = await request(app)
        .post("/api/v1/products")
        .set("x-test-user", JSON.stringify(brandAuth))
        .send({ title: "Unauthorized Product" });
      expect(prodRes.status).toBe(403);
      expect(prodRes.body.errorCode).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("allows Attribute Specialist to create attribute, but forbids product creation", async () => {
      const attrAuth = {
        id: testAttributeSpecialistUser._id.toString(),
        role: ROLES.ADMIN,
        isPermissionFresh: true,
      };

      // 1. Attribute creation -> Permitted
      const attrRes = await request(app)
        .post("/api/v1/attributes")
        .set("x-test-user", JSON.stringify(attrAuth))
        .send({
          name: "Test Attribute E8 " + Date.now(),
          type: "select",
          values: [{ label: "Value 1", value: "val-1" }],
        });
      expect([201, 200]).toContain(attrRes.status);

      // 2. Product creation -> FORBIDDEN (403)
      const prodRes = await request(app)
        .post("/api/v1/products")
        .set("x-test-user", JSON.stringify(attrAuth))
        .send({ title: "Unauthorized Product" });
      expect(prodRes.status).toBe(403);
      expect(prodRes.body.errorCode).toBe("INSUFFICIENT_PERMISSIONS");
    });
  });

  describe("4. Full Admin Backward Compatibility Verification", () => {
    it("allows Full Admin with legacy products:create & settings:manage to access all sub-domains", async () => {
      const adminAuth = {
        id: testFullAdminUser._id.toString(),
        role: ROLES.ADMIN,
        isPermissionFresh: true,
      };

      // 1. Can view and create banners via settings:manage
      const bannerRes = await request(app)
        .get("/api/v1/storefront/banners")
        .set("x-test-user", JSON.stringify(adminAuth));
      expect(bannerRes.status).toBe(200);

      // 2. Can create category via products:create
      const catRes = await request(app)
        .post("/api/v1/categories")
        .set("x-test-user", JSON.stringify(adminAuth))
        .send({
          name: "Admin Category E8 " + Date.now(),
          slug: "admin-cat-e8-" + Date.now(),
        });
      expect([201, 200]).toContain(catRes.status);

      // 3. Can create brand via products:create
      const brandRes = await request(app)
        .post("/api/v1/brands")
        .set("x-test-user", JSON.stringify(adminAuth))
        .send({
          name: "Admin Brand E8 " + Date.now(),
          slug: "admin-brand-e8-" + Date.now(),
        });
      expect([201, 200]).toContain(brandRes.status);

      // 4. Can create attribute via products:create
      const attrRes = await request(app)
        .post("/api/v1/attributes")
        .set("x-test-user", JSON.stringify(adminAuth))
        .send({
          name: "Admin Attribute E8 " + Date.now(),
          type: "text",
        });
      expect([201, 200]).toContain(attrRes.status);
    });
  });
});
