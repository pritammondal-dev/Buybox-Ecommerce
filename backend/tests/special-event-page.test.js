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
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const { generateAccessToken } = require("../src/services/token.service");

const Vendor = require("../src/models/Vendor");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_special_event_test?")
  : "mongodb://127.0.0.1:27017/buybox_special_event_test?replicaSet=rs0";

describe("PHASE E6 — CMS Special Event Page Builder Tests", () => {
  jest.setTimeout(45000);

  let adminUser;
  let adminToken;
  let customerUser;
  let customerToken;
  let testVendor;
  let testCategory;
  let testProduct;

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

    let adminRole = await Role.findOne({ slug: "event-builder-admin" });
    if (!adminRole) {
      adminRole = await Role.create({
        slug: "event-builder-admin",
        name: "Event Builder Admin",
        description: "Admin role for special event tests",
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
      firstName: "EventAdmin",
      lastName: "E6",
      email: `event_admin_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`,
      password: "Password123!",
      role: "admin",
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const adminEmp = await Employee.create({
      userId: adminUser._id,
      employeeNumber: `EMP_EV_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      jobTitle: "CMS Event Lead",
      department: "Marketing",
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
      firstName: "Regular",
      lastName: "Shopper",
      email: `shopper_ev_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`,
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
      lastName: "Audio",
      email: `vendor_ev_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`,
      password: "Password123!",
      role: ROLES.VENDOR,
      isActive: true,
    });

    testVendor = await Vendor.create({
      userId: vendorUser._id,
      businessName: `Test Event Audio Vendor ${Date.now()}`,
      businessSlug: `test-event-audio-vendor-${Date.now()}`,
      status: "active",
    });

    testCategory = await Category.create({
      name: `Event Tech Category ${Date.now()}`,
      slug: `event-tech-category-${Date.now()}`,
      description: "Audio and tech category for events",
      isActive: true,
      createdBy: adminUser._id,
      updatedBy: adminUser._id,
    });

    testProduct = await Product.create({
      name: `Event Wireless Headphones ${Date.now()}`,
      slug: `event-wireless-headphones-${Date.now()}`,
      description: "High-fidelity audio headphones",
      sku: `SKU-EV-${Date.now()}`,
      price: 4999,
      compareAtPrice: 7999,
      vendorId: testVendor._id,
      categoryId: testCategory._id,
      status: "active",
      isPublished: true,
      isDeleted: false,
      stock: 50,
      createdBy: adminUser._id,
      updatedBy: adminUser._id,
    });
  });

  afterAll(async () => {
    await SpecialEventPage.deleteMany({ createdBy: adminUser?._id });
    if (testProduct?._id) await Product.findByIdAndDelete(testProduct._id);
    if (testCategory?._id) await Category.findByIdAndDelete(testCategory._id);
    if (testVendor?._id) {
      await Vendor.findByIdAndDelete(testVendor._id);
      await User.findByIdAndDelete(testVendor.userId);
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  describe("1. CMS Event Page CRUD & Section Builder API", () => {
    let createdEventId;
    let eventSlug;
    let previewToken;

    test("POST /api/v1/cms/events creates a draft event page with multi-section builder config", async () => {
      eventSlug = `diwali-dhamaka-${Date.now()}`;

      const res = await request(app)
        .post("/api/v1/cms/events")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Diwali Dhamaka Festive Sale",
          slug: eventSlug,
          description: "Exclusive festive bargains and brand discounts.",
          badge: "Diwali Mega Sale",
          status: "draft",
          theme: {
            primaryColor: "#FF6B00",
            accentColor: "#FFD700",
            backgroundGradient: "linear-gradient(135deg, #1A002C 0%, #3B0066 100%)",
            isDark: true,
          },
          sections: [
            {
              id: "sec_hero_1",
              type: "hero_banner",
              title: "Celebrate with Sound",
              subtitle: "Up to 50% off on premium audio systems",
              displayOrder: 0,
              isActive: true,
              config: {
                imageUrl: "/images/banners/diwali-hero.png",
                ctaText: "Explore Festive Deals",
                linkUrl: "/shop?event=diwali",
              },
            },
            {
              id: "sec_countdown_1",
              type: "countdown",
              title: "Festive Sale Ends In",
              subtitle: "Don't miss the biggest sale of the year",
              displayOrder: 1,
              isActive: true,
              config: {
                targetDate: new Date(Date.now() + 86400000 * 5).toISOString(),
                headline: "Lighting Deals Close Tonight!",
              },
            },
            {
              id: "sec_cat_grid_1",
              type: "category_grid",
              title: "Shop By Festive Category",
              displayOrder: 2,
              isActive: true,
              config: {
                categoryIds: [testCategory._id.toString()],
              },
            },
            {
              id: "sec_prod_col_1",
              type: "product_collection",
              title: "Featured Blockbuster Deals",
              displayOrder: 3,
              isActive: true,
              config: {
                productIds: [testProduct._id.toString()],
                layout: "grid",
              },
            },
            {
              id: "sec_ad_1",
              type: "ad_banner",
              title: "Partner Showcase",
              displayOrder: 4,
              isActive: true,
              config: {
                imageUrl: "/images/ads/partner-audio.png",
                sponsorName: "Sony Electronics",
                linkUrl: "/brand/sony",
                isSponsored: true,
              },
            },
          ],
          seo: {
            title: "Diwali Dhamaka Deals | Buybox",
            description: "Celebrate Diwali with authentic audio gear discounts.",
            keywords: ["diwali", "sale", "audio"],
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Diwali Dhamaka Festive Sale");
      expect(res.body.data.slug).toBe(eventSlug);
      expect(res.body.data.status).toBe("draft");
      expect(res.body.data.sections).toHaveLength(5);
      expect(res.body.data.previewToken).toBeDefined();

      createdEventId = res.body.data._id;
      previewToken = res.body.data.previewToken;
    });

    test("POST /api/v1/cms/events rejects duplicate slug with 409 Conflict", async () => {
      const res = await request(app)
        .post("/api/v1/cms/events")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Another Diwali Sale",
          slug: eventSlug,
          description: "Duplicate slug test",
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    test("POST /api/v1/cms/events rejects invalid section type", async () => {
      const res = await request(app)
        .post("/api/v1/cms/events")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Invalid Section Test",
          slug: `invalid-section-${Date.now()}`,
          sections: [
            {
              id: "sec_bad",
              type: "malicious_eval_script",
              title: "Bad Section",
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test("GET /api/v1/cms/events lists events with pagination and filters", async () => {
      const res = await request(app)
        .get("/api/v1/cms/events")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({ search: eventSlug });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].slug).toBe(eventSlug);
      expect(res.body.meta).toBeDefined();
    });

    test("PATCH /api/v1/cms/events/:id updates section configurations and reorders them", async () => {
      const res = await request(app)
        .patch(`/api/v1/cms/events/${createdEventId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          badge: "Updated Grand Sale",
          sections: [
            {
              id: "sec_countdown_1",
              type: "countdown",
              title: "Lightning Festive Clock",
              displayOrder: 0,
              isActive: true,
              config: {
                targetDate: new Date(Date.now() + 86400000 * 3).toISOString(),
              },
            },
            {
              id: "sec_hero_1",
              type: "hero_banner",
              title: "Celebrate with Sound (Updated)",
              displayOrder: 1,
              isActive: true,
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.badge).toBe("Updated Grand Sale");
      expect(res.body.data.sections).toHaveLength(2);
      expect(res.body.data.sections[0].type).toBe("countdown");
      expect(res.body.data.sections[1].type).toBe("hero_banner");
    });

    test("POST /api/v1/cms/events/:id/duplicate duplicates an event page into a new draft", async () => {
      const res = await request(app)
        .post(`/api/v1/cms/events/${createdEventId}/duplicate`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toContain("(Copy)");
      expect(res.body.data.status).toBe("draft");
      expect(res.body.data.sections).toHaveLength(2);
      expect(res.body.data.slug).not.toBe(eventSlug);

      // Clean up the duplicate
      await SpecialEventPage.findByIdAndDelete(res.body.data._id);
    });

    test("PATCH /api/v1/cms/events/:id/publish publishes the event page", async () => {
      const res = await request(app)
        .patch(`/api/v1/cms/events/${createdEventId}/publish`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("published");
      expect(res.body.data.publishedAt).toBeDefined();
    });

    test("PATCH /api/v1/cms/events/:id/unpublish unpublishes back to draft", async () => {
      const res = await request(app)
        .patch(`/api/v1/cms/events/${createdEventId}/unpublish`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("draft");
    });

    test("PATCH /api/v1/cms/events/:id/archive transitions to archived status", async () => {
      const res = await request(app)
        .patch(`/api/v1/cms/events/${createdEventId}/archive`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("archived");
      expect(res.body.data.archivedAt).toBeDefined();
    });
  });

  describe("2. Public Storefront Access, Draft Protection & Preview Authorization", () => {
    let publicEvent;
    let draftEvent;

    beforeAll(async () => {
      // 1. Published event
      publicEvent = await SpecialEventPage.create({
        name: "Public Mega Sale",
        slug: `public-mega-sale-${Date.now()}`,
        status: "published",
        publishedAt: new Date(),
        badge: "Live Sale",
        sections: [
          {
            id: "sec_pub_prod",
            type: "product_collection",
            title: "Live Deals",
            displayOrder: 0,
            isActive: true,
            config: {
              productIds: [testProduct._id.toString()],
            },
          },
          {
            id: "sec_pub_cat",
            type: "category_grid",
            title: "Live Categories",
            displayOrder: 1,
            isActive: true,
            config: {
              categoryIds: [testCategory._id.toString()],
            },
          },
        ],
        createdBy: adminUser._id,
      });

      // 2. Draft event
      draftEvent = await SpecialEventPage.create({
        name: "Confidential Draft Sale",
        slug: `confidential-draft-sale-${Date.now()}`,
        status: "draft",
        sections: [
          {
            id: "sec_draft_hero",
            type: "hero_banner",
            title: "Secret Launch",
            displayOrder: 0,
            isActive: true,
          },
        ],
        createdBy: adminUser._id,
      });
    });

    afterAll(async () => {
      if (publicEvent?._id) await SpecialEventPage.findByIdAndDelete(publicEvent._id);
      if (draftEvent?._id) await SpecialEventPage.findByIdAndDelete(draftEvent._id);
    });

    test("GET /api/v1/storefront/events/:slug returns 200 and hydrates catalog data for published event", async () => {
      const res = await request(app).get(`/api/v1/storefront/events/${publicEvent.slug}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.slug).toBe(publicEvent.slug);

      // Verify Product Collection hydration
      const prodSec = res.body.data.sections.find((s) => s.type === "product_collection");
      expect(prodSec).toBeDefined();
      expect(Array.isArray(prodSec.resolvedProducts)).toBe(true);
      expect(prodSec.resolvedProducts).toHaveLength(1);
      expect(prodSec.resolvedProducts[0].name).toBe(testProduct.name);
      expect(prodSec.resolvedProducts[0].price).toBe(4999);

      // Verify Category Grid hydration
      const catSec = res.body.data.sections.find((s) => s.type === "category_grid");
      expect(catSec).toBeDefined();
      expect(Array.isArray(catSec.resolvedCategories)).toBe(true);
      expect(catSec.resolvedCategories).toHaveLength(1);
      expect(catSec.resolvedCategories[0].name).toBe(testCategory.name);
    });

    test("GET /api/v1/storefront/events/:slug returns 404 for draft event without preview credentials", async () => {
      const res = await request(app).get(`/api/v1/storefront/events/${draftEvent.slug}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    test("GET /api/v1/storefront/events/:slug?token=[previewToken] returns 200 for authorized preview", async () => {
      const res = await request(app)
        .get(`/api/v1/storefront/events/${draftEvent.slug}`)
        .query({ preview: "true", token: draftEvent.previewToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Confidential Draft Sale");
    });

    test("GET /api/v1/storefront/events/:slug with admin Authorization header returns 200 for admin preview", async () => {
      const res = await request(app)
        .get(`/api/v1/storefront/events/${draftEvent.slug}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Confidential Draft Sale");
    });

    test("GET /api/v1/storefront/events/active returns active published events", async () => {
      const res = await request(app).get("/api/v1/storefront/events/active");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      const found = res.body.data.some((e) => e.slug === publicEvent.slug);
      expect(found).toBe(true);
    });
  });

  describe("3. RBAC Access Control", () => {
    test("Non-admin customer receives 403 when attempting to create event page", async () => {
      const res = await request(app)
        .post("/api/v1/cms/events")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          name: "Customer Attempt",
          slug: "customer-attempt",
        });

      expect([401, 403]).toContain(res.status);
    });

    test("Unauthenticated request receives 401 on admin endpoint", async () => {
      const res = await request(app).get("/api/v1/cms/events");
      expect(res.status).toBe(401);
    });
  });
});
