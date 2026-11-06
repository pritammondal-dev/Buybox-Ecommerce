const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Employee = require("../src/models/Employee");
const Role = require("../src/models/Role");
const Permission = require("../src/models/Permission");
const RolePermission = require("../src/models/RolePermission");
const EmployeeRole = require("../src/models/EmployeeRole");
const SpecialEventPage = require("../src/models/SpecialEventPage");
const Product = require("../src/models/Product");
const Category = require("../src/models/Category");
const Vendor = require("../src/models/Vendor");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const { generateAccessToken } = require("../src/services/token.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_e6a_audit_test?")
  : "mongodb://127.0.0.1:27017/buybox_e6a_audit_test?replicaSet=rs0";

describe("PHASE E6A — CMS Special Event Page Builder Forensic Acceptance Audit", () => {
  jest.setTimeout(45000);

  let adminUser;
  let adminToken;
  let customerUser;
  let customerToken;
  let testVendor;
  let testCategory;
  let activeProduct;
  let inactiveProduct;

  async function getOrCreatePermission(slug) {
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
    return perm;
  }

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    const managePerm = await getOrCreatePermission(PERMISSIONS.SETTINGS_MANAGE);
    const readPerm = await getOrCreatePermission(PERMISSIONS.SETTINGS_READ);

    let adminRole = await Role.findOne({ slug: "e6a-audit-admin" });
    if (!adminRole) {
      adminRole = await Role.create({
        slug: "e6a-audit-admin",
        name: "E6A Audit Admin",
        description: "Admin role for special event audit tests",
        isActive: true,
      });
    }

    await RolePermission.findOneAndUpdate(
      { roleId: adminRole._id, permissionId: managePerm._id },
      { $setOnInsert: { isActive: true } },
      { upsert: true }
    );
    await RolePermission.findOneAndUpdate(
      { roleId: adminRole._id, permissionId: readPerm._id },
      { $setOnInsert: { isActive: true } },
      { upsert: true }
    );

    adminUser = await User.create({
      firstName: "AuditAdmin",
      lastName: "E6A",
      email: `audit_admin_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`,
      password: "Password123!",
      role: "admin",
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const adminEmp = await Employee.create({
      userId: adminUser._id,
      employeeNumber: `EMP_E6A_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      jobTitle: "Audit Lead",
      department: "Governance",
      status: "active",
    });

    await EmployeeRole.create({
      employeeId: adminEmp._id,
      roleId: adminRole._id,
      isActive: true,
    });

    adminToken = generateAccessToken({
      sub: adminUser._id.toString(),
      role: adminUser.role,
      authVersion: adminUser.authVersion,
      permissionVersion: adminUser.permissionVersion,
    });

    customerUser = await User.create({
      firstName: "Shopper",
      lastName: "E6A",
      email: `shopper_e6a_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`,
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

    const vendorUser = await User.create({
      firstName: "Vendor",
      lastName: "E6A",
      email: `vendor_e6a_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`,
      password: "Password123!",
      role: ROLES.VENDOR,
      isActive: true,
    });

    testVendor = await Vendor.create({
      userId: vendorUser._id,
      businessName: `Test Audit Vendor ${Date.now()}`,
      businessSlug: `test-audit-vendor-${Date.now()}`,
      status: "active",
    });

    testCategory = await Category.create({
      name: `Audit Category ${Date.now()}`,
      slug: `audit-category-${Date.now()}`,
      description: "Category for audit",
      isActive: true,
      createdBy: adminUser._id,
      updatedBy: adminUser._id,
    });

    activeProduct = await Product.create({
      name: `Audit Active Product ${Date.now()}`,
      slug: `audit-active-product-${Date.now()}`,
      sku: `SKU-ACT-${Date.now()}`,
      price: 1999,
      compareAtPrice: 2999,
      vendorId: testVendor._id,
      categoryId: testCategory._id,
      status: "active",
      isPublished: true,
      isDeleted: false,
      stock: 25,
      createdBy: adminUser._id,
      updatedBy: adminUser._id,
    });

    inactiveProduct = await Product.create({
      name: `Audit Inactive Product ${Date.now()}`,
      slug: `audit-inactive-product-${Date.now()}`,
      sku: `SKU-INACT-${Date.now()}`,
      price: 3999,
      vendorId: testVendor._id,
      categoryId: testCategory._id,
      status: "inactive",
      isPublished: false,
      isDeleted: false,
      stock: 10,
      createdBy: adminUser._id,
      updatedBy: adminUser._id,
    });
  });

  afterAll(async () => {
    await SpecialEventPage.deleteMany({ createdBy: adminUser?._id });
    if (activeProduct?._id) await Product.findByIdAndDelete(activeProduct._id);
    if (inactiveProduct?._id) await Product.findByIdAndDelete(inactiveProduct._id);
    if (testCategory?._id) await Category.findByIdAndDelete(testCategory._id);
    if (testVendor?._id) {
      await Vendor.findByIdAndDelete(testVendor._id);
      await User.findByIdAndDelete(testVendor.userId);
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  describe("Pillar 2: Lifecycle & Scheduling State Audit", () => {
    test("Concluded event (endsAt in the past) returns 404 to public, 200 to authorized preview", async () => {
      const pastEvent = await SpecialEventPage.create({
        name: "Concluded Flash Sale",
        slug: `concluded-sale-${Date.now()}`,
        status: "published",
        startsAt: new Date(Date.now() - 86400000 * 2),
        endsAt: new Date(Date.now() - 3600000), // 1 hour ago
        sections: [
          {
            id: "sec_hero",
            type: "hero_banner",
            title: "Old Sale",
            displayOrder: 0,
            isActive: true,
          },
        ],
        createdBy: adminUser._id,
      });

      // Public request without preview credentials -> 404
      const pubRes = await request(app).get(`/api/v1/storefront/events/${pastEvent.slug}`);
      expect(pubRes.status).toBe(404);
      expect(pubRes.body.code || pubRes.body.errorCode).toBe("EVENT_PAGE_EXPIRED");

      // Authorized request with token -> 200
      const tokenRes = await request(app)
        .get(`/api/v1/storefront/events/${pastEvent.slug}`)
        .query({ preview: "true", token: pastEvent.previewToken });
      expect(tokenRes.status).toBe(200);
      expect(tokenRes.body.data.name).toBe("Concluded Flash Sale");
    });

    test("Upcoming event (startsAt in the future) returns 404 to public, 200 to admin", async () => {
      const futureEvent = await SpecialEventPage.create({
        name: "Upcoming Mega Festival",
        slug: `upcoming-festival-${Date.now()}`,
        status: "published",
        startsAt: new Date(Date.now() + 86400000 * 3), // 3 days in future
        endsAt: new Date(Date.now() + 86400000 * 5),
        sections: [
          {
            id: "sec_hero",
            type: "hero_banner",
            title: "Future Festival",
            displayOrder: 0,
            isActive: true,
          },
        ],
        createdBy: adminUser._id,
      });

      // Public request -> 404
      const pubRes = await request(app).get(`/api/v1/storefront/events/${futureEvent.slug}`);
      expect(pubRes.status).toBe(404);
      expect(pubRes.body.code || pubRes.body.errorCode).toBe("EVENT_PAGE_NOT_STARTED");

      // Admin request -> 200
      const adminRes = await request(app)
        .get(`/api/v1/storefront/events/${futureEvent.slug}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(adminRes.status).toBe(200);
      expect(adminRes.body.data.name).toBe("Upcoming Mega Festival");
    });

    test("Publishing page with 0 active sections is rejected with 400", async () => {
      const emptyPage = await SpecialEventPage.create({
        name: "Empty Event Page",
        slug: `empty-page-${Date.now()}`,
        status: "draft",
        sections: [],
        createdBy: adminUser._id,
      });

      const res = await request(app)
        .patch(`/api/v1/cms/events/${emptyPage._id}/publish`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.code || res.body.errorCode).toBe("EVENT_PAGE_EMPTY_SECTIONS");
    });

    test("Deleting published page is rejected with 400", async () => {
      const pubPage = await SpecialEventPage.create({
        name: "Delete Protected Page",
        slug: `delete-protected-${Date.now()}`,
        status: "published",
        sections: [
          {
            id: "sec_h",
            type: "hero_banner",
            title: "Banner",
            displayOrder: 0,
            isActive: true,
          },
        ],
        createdBy: adminUser._id,
      });

      const res = await request(app)
        .delete(`/api/v1/cms/events/${pubPage._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.code || res.body.errorCode).toBe("CANNOT_DELETE_PUBLISHED_EVENT");
    });
  });

  describe("Pillar 3: Security & Token Boundary Audit", () => {
    let testDraft;

    beforeAll(async () => {
      testDraft = await SpecialEventPage.create({
        name: "Security Boundary Draft",
        slug: `sec-boundary-draft-${Date.now()}`,
        status: "draft",
        sections: [
          {
            id: "sec_1",
            type: "hero_banner",
            title: "Hero",
            displayOrder: 0,
            isActive: true,
          },
        ],
        createdBy: adminUser._id,
      });
    });

    test("preview=true alone without valid token or admin auth is rejected with 404", async () => {
      const res = await request(app)
        .get(`/api/v1/storefront/events/${testDraft.slug}`)
        .query({ preview: "true" });

      expect(res.status).toBe(404);
      expect(res.body.code || res.body.errorCode).toBe("EVENT_PAGE_NOT_AVAILABLE");
    });

    test("preview with invalid or altered token is rejected with 404", async () => {
      const res = await request(app)
        .get(`/api/v1/storefront/events/${testDraft.slug}`)
        .query({ preview: "true", token: "tampered_token_999" });

      expect(res.status).toBe(404);
      expect(res.body.code || res.body.errorCode).toBe("EVENT_PAGE_NOT_AVAILABLE");
    });

    test("Storefront API response never leaks previewToken to client", async () => {
      const res = await request(app)
        .get(`/api/v1/storefront/events/${testDraft.slug}`)
        .query({ preview: "true", token: testDraft.previewToken });

      expect(res.status).toBe(200);
      expect(res.body.data.previewToken).toBeUndefined();
    });
  });

  describe("Pillar 4: Catalog & Product Eligibility Audit", () => {
    test("Hydration filters out inactive and unpublished products from product_collection", async () => {
      const pageWithMixedProducts = await SpecialEventPage.create({
        name: "Catalog Filter Audit Event",
        slug: `catalog-filter-event-${Date.now()}`,
        status: "published",
        sections: [
          {
            id: "sec_col",
            type: "product_collection",
            title: "Audited Products",
            displayOrder: 0,
            isActive: true,
            config: {
              productIds: [activeProduct._id.toString(), inactiveProduct._id.toString()],
            },
          },
        ],
        createdBy: adminUser._id,
      });

      const res = await request(app).get(`/api/v1/storefront/events/${pageWithMixedProducts.slug}`);

      expect(res.status).toBe(200);
      const sec = res.body.data.sections[0];
      expect(sec.resolvedProducts).toHaveLength(1);
      expect(sec.resolvedProducts[0]._id.toString()).toBe(activeProduct._id.toString());
      // Inactive product must not be included
      const foundInactive = sec.resolvedProducts.some(
        (p) => p._id.toString() === inactiveProduct._id.toString()
      );
      expect(foundInactive).toBe(false);
    });
  });

  describe("Pillar 5: Admin-Scoped Route Namespace Audit", () => {
    test("GET /api/v1/admin/cms/events route alias is accessible with admin token", async () => {
      const res = await request(app)
        .get("/api/v1/admin/cms/events")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
