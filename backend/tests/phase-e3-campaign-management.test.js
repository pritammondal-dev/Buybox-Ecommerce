const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Employee = require("../src/models/Employee");
const Role = require("../src/models/Role");
const Permission = require("../src/models/Permission");
const RolePermission = require("../src/models/RolePermission");
const EmployeeRole = require("../src/models/EmployeeRole");
const Campaign = require("../src/models/Campaign");
const Coupon = require("../src/models/Coupon");
const Product = require("../src/models/Product");
const ProductDiscount = require("../src/models/ProductDiscount");
const { generateAccessToken } = require("../src/services/token.service");
const { ROLES } = require("../src/constants/auth.constants");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const campaignService = require("../src/services/campaign.service");

jest.setTimeout(40000);

describe("BUYBOX E-COMMERCE — PHASE E3: Campaign Management & Lifecycle Acceptance Suite", () => {
  let superadminUser;
  let superadminToken;
  let adminUser;
  let adminToken;
  let customerUser;
  let customerToken;
  let vendorUser;
  let vendorToken;

  let testCategory;
  let testProduct;
  let testCoupon;
  let testDiscount;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/buybox_test");
    }

    // 1. Resolve or reuse single active Superadmin
    superadminUser = await User.findOne({ role: ROLES.SUPER_ADMIN });
    if (!superadminUser) {
      superadminUser = await User.create({
        firstName: "PhaseE3",
        lastName: "SuperAdmin",
        email: `phase_e3_super_${Date.now()}@buybox.test`,
        password: "Password123!",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        authVersion: 1,
        permissionVersion: 1,
      });
    }

    superadminToken = generateAccessToken({
      sub: superadminUser._id.toString(),
      role: superadminUser.role,
      authVersion: superadminUser.authVersion,
      permissionVersion: superadminUser.permissionVersion,
    });

    // 2. Provision Admin user with CAMPAIGNS permissions
    let adminRole = await Role.findOne({ slug: "marketing-lead" });
    if (!adminRole) {
      adminRole = await Role.create({
        name: "Marketing Lead",
        slug: "marketing-lead",
        description: "Test role marketing lead",
        isActive: true,
      });
    }

    const permissionSlugs = [
      PERMISSIONS.CAMPAIGNS_READ,
      PERMISSIONS.CAMPAIGNS_MANAGE,
      PERMISSIONS.COUPONS_READ,
      PERMISSIONS.DISCOUNTS_READ,
    ];

    for (const slug of permissionSlugs) {
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
      await RolePermission.findOneAndUpdate(
        { roleId: adminRole._id, permissionId: perm._id },
        { roleId: adminRole._id, permissionId: perm._id },
        { upsert: true, new: true }
      );
    }

    adminUser = await User.create({
      firstName: "Marketing",
      lastName: "Manager",
      email: `marketing_mgr_${Date.now()}@buybox.test`,
      password: "Password123!",
      role: ROLES.ADMIN,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const employee = await Employee.create({
      userId: adminUser._id,
      employeeNumber: `EMP_${Date.now()}`,
      jobTitle: "Senior Marketing Manager",
      department: "Marketing",
      status: "active",
    });

    await EmployeeRole.create({
      employeeId: employee._id,
      roleId: adminRole._id,
      isActive: true,
      expiresAt: null,
    });

    adminToken = generateAccessToken({
      sub: adminUser._id.toString(),
      role: adminUser.role,
      authVersion: adminUser.authVersion,
      permissionVersion: adminUser.permissionVersion,
    });

    // 3. Customer & Vendor tokens for unauthorized testing
    customerUser = await User.create({
      firstName: "Regular",
      lastName: "Shopper",
      email: `customer_e3_${Date.now()}@buybox.test`,
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
      firstName: "Audio",
      lastName: "Vendor",
      email: `vendor_e3_${Date.now()}@buybox.test`,
      password: "Password123!",
      role: ROLES.VENDOR,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    vendorToken = generateAccessToken({
      sub: vendorUser._id.toString(),
      role: vendorUser.role,
      authVersion: vendorUser.authVersion,
      permissionVersion: vendorUser.permissionVersion,
    });

    // 4. Auxiliary product & coupon references
    testCategory = new mongoose.Types.ObjectId();

    testProduct = await Product.create({
      name: "Wireless ANC Pro Headphones",
      slug: `anc-headphones-${Date.now()}`,
      sku: `SKU-ANC-${Date.now()}`,
      categoryId: testCategory,
      vendorId: vendorUser._id,
      price: 4999,
      status: "active",
      isActive: true,
    });

    testCoupon = await Coupon.create({
      code: `FESTIVE${Date.now().toString().slice(-4)}`,
      type: "percentage",
      value: 15,
      minOrderAmount: 1000,
      scope: "all",
      startsAt: new Date(Date.now() - 3600000),
      expiresAt: new Date(Date.now() + 86400000 * 30),
      status: "active",
      isActive: true,
    });

    testDiscount = await ProductDiscount.create({
      name: "Diwali 10% Flat Markdown",
      discountType: "percentage",
      value: "10.00",
      scope: "all",
      startsAt: new Date(Date.now() - 3600000),
      endsAt: new Date(Date.now() + 86400000 * 30),
      status: "active",
      fundingSource: "platform",
    });
  });

  afterAll(async () => {
    // Cleanup items created by this suite
    await Campaign.deleteMany({ slug: { $regex: /^test-e3-/ } });
    if (adminUser) await User.deleteOne({ _id: adminUser._id });
    if (customerUser) await User.deleteOne({ _id: customerUser._id });
    if (vendorUser) await User.deleteOne({ _id: vendorUser._id });
    if (testProduct) await Product.deleteOne({ _id: testProduct._id });
    if (testCoupon) await Coupon.deleteOne({ _id: testCoupon._id });
    if (testDiscount) await ProductDiscount.deleteOne({ _id: testDiscount._id });
  });

  describe("1. Campaign Creation & Field-Level Authoritative Validation", () => {
    test("creates a rich marketing campaign with all Phase E3 fields successfully (201)", async () => {
      const payload = {
        name: "Test E3 Mega Monsoon Clearance",
        slug: `test-e3-monsoon-clearance-${Date.now()}`,
        type: "clearance",
        description: "Massive annual monsoon liquidation event on flagship tech",
        timezone: "Asia/Kolkata",
        bannerUrl: "/uploads/monsoon_hero_banner.jpg",
        mobileBannerUrl: "/uploads/monsoon_mobile_banner.jpg",
        destinationUrl: "/campaign/monsoon-clearance",
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        endsAt: new Date(Date.now() + 86400000 * 10).toISOString(),
        status: "draft",
        scope: "products",
        productIds: [testProduct._id.toString()],
        couponIds: [testCoupon._id.toString()],
        discountIds: [testDiscount._id.toString()],
      };

      const res = await request(app)
        .post("/api/v1/campaigns")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe(payload.name);
      expect(res.body.data.type).toBe("clearance");
      expect(res.body.data.timezone).toBe("Asia/Kolkata");
      expect(res.body.data.bannerUrl).toBe(payload.bannerUrl);
      expect(res.body.data.discountIds).toHaveLength(1);
      expect(res.body.data.status).toBe("draft");
    });

    test("rejects campaign creation when endsAt <= startsAt (400 INVALID_DATES)", async () => {
      const invalidDatesPayload = {
        name: "Test E3 Invalid Dates Campaign",
        slug: `test-e3-invalid-dates-${Date.now()}`,
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        endsAt: new Date(Date.now() + 3600000).toISOString(), // Earlier than startsAt
        scope: "all",
      };

      const res = await request(app)
        .post("/api/v1/campaigns")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(invalidDatesPayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.message || JSON.stringify(res.body)).toMatch(/end date must be after start date/i);
    });

    test("rejects duplicate campaign slugs (409 CAMPAIGN_SLUG_EXISTS)", async () => {
      const fixedSlug = `test-e3-unique-slug-${Date.now()}`;
      await Campaign.create({
        name: "Existing Campaign",
        slug: fixedSlug,
        startsAt: new Date(Date.now() + 86400000),
        endsAt: new Date(Date.now() + 86400000 * 5),
        scope: "all",
      });

      const res = await request(app)
        .post("/api/v1/campaigns")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Duplicate Slug Attempt",
          slug: fixedSlug,
          startsAt: new Date(Date.now() + 86400000).toISOString(),
          endsAt: new Date(Date.now() + 86400000 * 5).toISOString(),
          scope: "all",
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.code || res.body.message).toMatch(/CAMPAIGN_SLUG_EXISTS|already exists/i);
    });
  });

  describe("2. Rich Search, Filtering, Stats & Server-Side Pagination", () => {
    let camp1, camp2, camp3;

    beforeAll(async () => {
      camp1 = await Campaign.create({
        name: "Test E3 Diwali Sparkle Flash Sale",
        slug: `test-e3-diwali-sparkle-${Date.now()}`,
        type: "flash_sale",
        status: "active",
        isActive: true,
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 86400000),
        scope: "all",
      });

      camp2 = await Campaign.create({
        name: "Test E3 Winter Audio Fest",
        slug: `test-e3-winter-audio-${Date.now()}`,
        type: "seasonal",
        status: "scheduled",
        isActive: false,
        startsAt: new Date(Date.now() + 86400000 * 2),
        endsAt: new Date(Date.now() + 86400000 * 8),
        scope: "all",
      });

      camp3 = await Campaign.create({
        name: "Test E3 Secret Draft Promo",
        slug: `test-e3-secret-draft-${Date.now()}`,
        type: "general",
        status: "draft",
        isActive: false,
        startsAt: new Date(Date.now() + 86400000),
        endsAt: new Date(Date.now() + 86400000 * 5),
        scope: "all",
      });
    });

    test("searches campaigns by substring regex in name/slug", async () => {
      const res = await request(app)
        .get("/api/v1/campaigns?search=Diwali%20Sparkle")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const items = Array.isArray(res.body.data) ? res.body.data : res.body.data.campaigns;
      expect(items.some((c) => c.slug === camp1.slug)).toBe(true);
      expect(items.some((c) => c.slug === camp2.slug)).toBe(false);
    });

    test("filters campaigns by status and type", async () => {
      const res = await request(app)
        .get("/api/v1/campaigns?status=active&type=flash_sale")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const items = Array.isArray(res.body.data) ? res.body.data : res.body.data.campaigns;
      expect(items.every((c) => c.status === "active" && c.type === "flash_sale")).toBe(true);
    });

    test("returns pagination metadata and live KPI stats when paginate=true", async () => {
      const res = await request(app)
        .get("/api/v1/campaigns?paginate=true&page=1&limit=2")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.campaigns).toBeDefined();
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.limit).toBe(2);
      expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(3);

      expect(res.body.data.stats).toBeDefined();
      expect(typeof res.body.data.stats.total).toBe("number");
      expect(res.body.data.stats.active).toBeGreaterThanOrEqual(1);
      expect(res.body.data.stats.scheduled).toBeGreaterThanOrEqual(1);
    });
  });

  describe("3. Lifecycle State Machine Transitions & Archival", () => {
    let testCamp;

    beforeEach(async () => {
      testCamp = await Campaign.create({
        name: "Test E3 Lifecycle Item",
        slug: `test-e3-lifecycle-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        status: "draft",
        startsAt: new Date(Date.now() + 86400000),
        endsAt: new Date(Date.now() + 86400000 * 7),
        scope: "all",
      });
    });

    test("schedules draft campaign when start date is in the future", async () => {
      const res = await request(app)
        .patch(`/api/v1/campaigns/${testCamp._id}/schedule`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("scheduled");
      expect(res.body.data.isActive).toBe(false);
    });

    test("activates campaign and marks isActive true", async () => {
      const res = await request(app)
        .patch(`/api/v1/campaigns/${testCamp._id}/activate`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.campaign.status).toBe("active");
      expect(res.body.data.campaign.isActive).toBe(true);
    });

    test("deactivates active campaign to paused", async () => {
      await Campaign.updateOne({ _id: testCamp._id }, { status: "active", isActive: true });

      const res = await request(app)
        .patch(`/api/v1/campaigns/${testCamp._id}/deactivate`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("paused");
      expect(res.body.data.isActive).toBe(false);
    });

    test("transitions completed/cancelled campaign safely to archived", async () => {
      await Campaign.updateOne({ _id: testCamp._id }, { status: "completed", isActive: false });

      const res = await request(app)
        .patch(`/api/v1/campaigns/${testCamp._id}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "archived" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("archived");
    });

    test("rejects invalid lifecycle transition (e.g. archived -> active) with 409", async () => {
      await Campaign.updateOne({ _id: testCamp._id }, { status: "archived", isActive: false });

      const res = await request(app)
        .patch(`/api/v1/campaigns/${testCamp._id}/activate`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  describe("4. One-Click Duplicate Campaign Workflow", () => {
    test("duplicates existing campaign into new draft with -copy slug", async () => {
      const original = await Campaign.create({
        name: "Test E3 Master Black Friday Sale",
        slug: `test-e3-black-friday-${Date.now()}`,
        type: "flash_sale",
        bannerUrl: "/uploads/black_friday.png",
        scope: "products",
        productIds: [testProduct._id],
        couponIds: [testCoupon._id],
        discountIds: [testDiscount._id],
        status: "active",
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 86400000 * 3),
      });

      const res = await request(app)
        .post("/api/v1/campaigns")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ duplicateFrom: original._id.toString() });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Test E3 Master Black Friday Sale (Copy)");
      expect(res.body.data.slug).toBe(`${original.slug}-copy`);
      expect(res.body.data.status).toBe("draft");
      expect(res.body.data.isActive).toBe(false);
      expect(res.body.data.bannerUrl).toBe(original.bannerUrl);
      expect(res.body.data.productIds).toHaveLength(1);
    });
  });

  describe("5. Storefront Visibility & Draft Isolation", () => {
    let liveCamp, draftCamp, expiredCamp;

    beforeAll(async () => {
      liveCamp = await Campaign.create({
        name: "Test E3 Live Public Sale",
        slug: `test-e3-public-live-${Date.now()}`,
        status: "active",
        isActive: true,
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 86400000 * 2),
        scope: "all",
      });

      draftCamp = await Campaign.create({
        name: "Test E3 Hidden Draft Sale",
        slug: `test-e3-hidden-draft-${Date.now()}`,
        status: "draft",
        isActive: false,
        startsAt: new Date(Date.now() + 86400000),
        endsAt: new Date(Date.now() + 86400000 * 5),
        scope: "all",
      });

      expiredCamp = await Campaign.create({
        name: "Test E3 Expired Past Sale",
        slug: `test-e3-expired-sale-${Date.now()}`,
        status: "completed",
        isActive: false,
        startsAt: new Date(Date.now() - 86400000 * 10),
        endsAt: new Date(Date.now() - 86400000 * 2),
        scope: "all",
      });
    });

    test("public active endpoint /api/v1/campaigns/active includes only ongoing active campaigns", async () => {
      const res = await request(app).get("/api/v1/campaigns/active");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const activeList = res.body.data;
      expect(activeList.some((c) => c.slug === liveCamp.slug)).toBe(true);
      expect(activeList.some((c) => c.slug === draftCamp.slug)).toBe(false);
      expect(activeList.some((c) => c.slug === expiredCamp.slug)).toBe(false);
    });

    test("public slug route /api/v1/campaigns/slug/:slug returns 404 for draft campaign without preview", async () => {
      const res = await request(app).get(`/api/v1/campaigns/slug/${draftCamp.slug}`);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    test("public slug route rejects previewing draft campaign without staff authorization (404)", async () => {
      const res = await request(app).get(`/api/v1/campaigns/slug/${draftCamp.slug}?preview=true`);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    test("public slug route allows previewing draft campaign with ?preview=true when authorized as staff", async () => {
      const res = await request(app)
        .get(`/api/v1/campaigns/slug/${draftCamp.slug}?preview=true`)
        .set("Authorization", `Bearer ${superadminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.slug).toBe(draftCamp.slug);
    });
  });

  describe("6. Authorization & RBAC Boundaries", () => {
    test("rejects unauthenticated requests to campaign management (401)", async () => {
      const res = await request(app)
        .post("/api/v1/campaigns")
        .send({ name: "Unauth Campaign", slug: "unauth-camp" });

      expect(res.status).toBe(401);
    });

    test("rejects customer role from mutating campaigns (403)", async () => {
      const res = await request(app)
        .post("/api/v1/campaigns")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ name: "Customer Campaign", slug: "customer-camp" });

      expect(res.status).toBe(403);
    });

    test("rejects vendor role from mutating platform campaigns (403)", async () => {
      const res = await request(app)
        .post("/api/v1/campaigns")
        .set("Authorization", `Bearer ${vendorToken}`)
        .send({ name: "Vendor Campaign", slug: "vendor-camp" });

      expect(res.status).toBe(403);
    });

    test("grants Superadmin full access to campaign operations", async () => {
      const res = await request(app)
        .get("/api/v1/campaigns?limit=1")
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await Campaign.deleteMany({ slug: /phase-e3/ });
      await User.deleteMany({ email: /@buybox\.test$/ });
      await mongoose.disconnect();
    }
  });
});
