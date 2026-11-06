const request = require("supertest");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const app = require("../src/app");
const User = require("../src/models/User");
const Employee = require("../src/models/Employee");
const Role = require("../src/models/Role");
const Permission = require("../src/models/Permission");
const RolePermission = require("../src/models/RolePermission");
const EmployeeRole = require("../src/models/EmployeeRole");
const StorefrontBanner = require("../src/models/StorefrontBanner");
const Campaign = require("../src/models/Campaign");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const { generateAccessToken } = require("../src/services/token.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_phase_e5_test?")
  : "mongodb://127.0.0.1:27017/buybox_phase_e5_test?replicaSet=rs0";

describe("PHASE E5 — Store Banner Management UX & Workflow Enhancement Tests", () => {
  jest.setTimeout(45000);

  let adminUser;
  let adminToken;
  let customerUser;
  let customerToken;
  let testCampaign;

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

    // Admin Role
    let adminRole = await Role.findOne({ slug: "phase-e5-banner-admin" });
    if (!adminRole) {
      adminRole = await Role.create({
        slug: "phase-e5-banner-admin",
        name: "Phase E5 Banner Admin",
        description: "Admin role for Phase E5 banner tests",
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

    // Admin User
    adminUser = await User.create({
      firstName: "BannerAdmin",
      lastName: "E5",
      email: `banner_e5_admin_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`,
      password: "Password123!",
      role: "admin",
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const adminEmp = await Employee.create({
      userId: adminUser._id,
      employeeNumber: `EMP_E5_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      jobTitle: "CMS Director",
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

    // Customer User
    customerUser = await User.create({
      firstName: "Regular",
      lastName: "Customer",
      email: `customer_e5_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`,
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

    // Create a standalone marketing campaign to test campaign separation
    testCampaign = await Campaign.create({
      name: "Phase E5 Summer Deals",
      slug: `e5-summer-deals-${Date.now()}`,
      description: "Summer promotional campaign",
      status: "active",
      type: "seasonal",
      scope: "all",
      startsAt: new Date(Date.now() - 3600000),
      endsAt: new Date(Date.now() + 86400000),
      createdBy: adminUser._id,
    });
  });

  afterAll(async () => {
    await StorefrontBanner.deleteMany({ title: /E5 Test/ });
    if (testCampaign) await Campaign.findByIdAndDelete(testCampaign._id);
    if (adminUser) await User.findByIdAndDelete(adminUser._id);
    if (customerUser) await User.findByIdAndDelete(customerUser._id);
    await mongoose.disconnect();
  });

  describe("1. Banner Creation & Listing Contract", () => {
    it("should list existing storefront banners via admin endpoint", async () => {
      const res = await request(app)
        .get("/api/v1/storefront/banners")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("should create a banner with all structured fields", async () => {
      const payload = {
        title: "E5 Test - Hero Showcase Headset",
        subtitle: "Next-gen spatial audio with active noise cancellation",
        badge: "Special 30% Off",
        ctaText: "Shop Headsets",
        slotKey: "hero_main",
        imageUrl: "/images/banners/banner-work-smarter.png",
        mobileImageUrl: "/images/banners/cat-audio-mood.png",
        linkUrl: "/shop?category=audio",
        altText: "Hero Showcase Headset Banner",
        displayOrder: 1,
        isActive: true,
      };

      const res = await request(app)
        .post("/api/v1/storefront/banners")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe(payload.title);
      expect(res.body.data.subtitle).toBe(payload.subtitle);
      expect(res.body.data.badge).toBe(payload.badge);
      expect(res.body.data.ctaText).toBe(payload.ctaText);
      expect(res.body.data.slotKey).toBe("hero_main");
      expect(res.body.data.mobileImageUrl).toBe(payload.mobileImageUrl);
      expect(res.body.data.displayOrder).toBe(1);
    });
  });

  describe("2. Editing Banner without Field Degradation", () => {
    let bannerId;

    beforeAll(async () => {
      const banner = await StorefrontBanner.create({
        title: "E5 Test - Original Banner",
        subtitle: "Original Subtitle",
        badge: "Original Badge",
        ctaText: "Shop Now",
        slotKey: "mid_work_smarter",
        imageUrl: "/images/banners/banner-work-smarter.png",
        mobileImageUrl: "/images/banners/cat-workspace-upgrade.png",
        linkUrl: "/shop?category=laptops",
        altText: "Original Alt",
        displayOrder: 2,
        isActive: true,
        createdBy: adminUser._id,
      });
      bannerId = banner._id.toString();
    });

    it("should update banner title without clearing imageUrl or other fields", async () => {
      const res = await request(app)
        .patch(`/api/v1/storefront/banners/${bannerId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "E5 Test - Updated Banner Title Only",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe("E5 Test - Updated Banner Title Only");
      // Verify preserved fields
      expect(res.body.data.imageUrl).toBe("/images/banners/banner-work-smarter.png");
      expect(res.body.data.mobileImageUrl).toBe("/images/banners/cat-workspace-upgrade.png");
      expect(res.body.data.subtitle).toBe("Original Subtitle");
      expect(res.body.data.badge).toBe("Original Badge");
      expect(res.body.data.slotKey).toBe("mid_work_smarter");
      expect(res.body.data.displayOrder).toBe(2);
    });

    it("should allow replacing imageUrl without affecting displayOrder or linkUrl", async () => {
      const res = await request(app)
        .patch(`/api/v1/storefront/banners/${bannerId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          imageUrl: "/images/banners/banner-stylish-looks.png",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.imageUrl).toBe("/images/banners/banner-stylish-looks.png");
      expect(res.body.data.linkUrl).toBe("/shop?category=laptops");
      expect(res.body.data.displayOrder).toBe(2);
    });
  });

  describe("3. Status & Scheduling Invariants", () => {
    it("should reject startsAt >= endsAt with 400 INVALID_BANNER_SCHEDULE", async () => {
      const now = new Date();
      const future = new Date(now.getTime() + 86400000);

      const res = await request(app)
        .post("/api/v1/storefront/banners")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "E5 Test - Invalid Schedule Banner",
          slotKey: "hero_audio",
          imageUrl: "/images/banners/promo-audio-essentials.svg",
          startsAt: future.toISOString(),
          endsAt: now.toISOString(), // Invalid: start is after end
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should accept valid scheduled start and end dates", async () => {
      const start = new Date(Date.now() - 3600000); // 1 hour ago
      const end = new Date(Date.now() + 86400000); // 24 hours future

      const res = await request(app)
        .post("/api/v1/storefront/banners")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "E5 Test - Valid Scheduled Banner",
          slotKey: "category_audio",
          imageUrl: "/images/banners/cat-audio-mood.png",
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          isActive: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.startsAt).toBeDefined();
      expect(res.body.data.endsAt).toBeDefined();
    });

    it("should exclude expired scheduled banners from public active storefront API", async () => {
      const pastStart = new Date(Date.now() - 7200000); // 2 hours ago
      const pastEnd = new Date(Date.now() - 3600000); // 1 hour ago (expired)

      await StorefrontBanner.create({
        title: "E5 Test - Expired Banner",
        slotKey: "bottom_smart_gadgets",
        imageUrl: "/images/banners/promo-smart-gadgets.svg",
        startsAt: pastStart,
        endsAt: pastEnd,
        isActive: true,
        createdBy: adminUser._id,
      });

      const res = await request(app).get("/api/v1/storefront/banners/active");
      expect(res.status).toBe(200);
      const activeTitles = res.body.data.map((b) => b.title);
      expect(activeTitles).not.toContain("E5 Test - Expired Banner");
    });

    it("should exclude future scheduled banners from public active storefront API", async () => {
      const futureStart = new Date(Date.now() + 3600000); // 1 hour in future
      const futureEnd = new Date(Date.now() + 7200000); // 2 hours in future

      await StorefrontBanner.create({
        title: "E5 Test - Future Scheduled Banner",
        slotKey: "bottom_monsoon_special",
        imageUrl: "/images/banners/promo-monsoon-special.svg",
        startsAt: futureStart,
        endsAt: futureEnd,
        isActive: true,
        createdBy: adminUser._id,
      });

      const res = await request(app).get("/api/v1/storefront/banners/active");
      expect(res.status).toBe(200);
      const activeTitles = res.body.data.map((b) => b.title);
      expect(activeTitles).not.toContain("E5 Test - Future Scheduled Banner");
    });

    it("should hide inactive banners from public active storefront API", async () => {
      await StorefrontBanner.create({
        title: "E5 Test - Hidden Inactive Banner",
        slotKey: "bottom_home_kitchen",
        imageUrl: "/images/banners/promo-home-kitchen.png",
        isActive: false, // explicitly inactive
        createdBy: adminUser._id,
      });

      const res = await request(app).get("/api/v1/storefront/banners/active");
      expect(res.status).toBe(200);
      const activeTitles = res.body.data.map((b) => b.title);
      expect(activeTitles).not.toContain("E5 Test - Hidden Inactive Banner");
    });
  });

  describe("4. Media Upload & Validation Security", () => {
    it("should reject SVG uploads for stored XSS security", async () => {
      const svgBuffer = Buffer.from(
        "<svg xmlns='http://www.w3.org/2000/svg'><script>alert('xss')</script></svg>"
      );

      const res = await request(app)
        .post("/api/v1/storefront/media/upload")
        .set("Authorization", `Bearer ${adminToken}`)
        .attach("file", svgBuffer, "test-banner.svg");

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("SVG_NOT_ALLOWED");
    });

    it("should upload a valid PNG image and return accessible file URL", async () => {
      // 1x1 transparent PNG magic bytes
      const pngBuffer = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64"
      );

      const res = await request(app)
        .post("/api/v1/storefront/media/upload")
        .set("Authorization", `Bearer ${adminToken}`)
        .attach("file", pngBuffer, "test-e5-banner.png");

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.url).toMatch(/^\/uploads\/media_/);
    });
  });

  describe("5. Role & Permission Security", () => {
    it("should reject unauthenticated attempt to create a banner with 401", async () => {
      const res = await request(app)
        .post("/api/v1/storefront/banners")
        .send({
          title: "Unauthorized Banner",
          slotKey: "hero_main",
          imageUrl: "/images/banners/banner-work-smarter.png",
        });

      expect(res.status).toBe(401);
    });

    it("should reject customer role attempt to create or update banner with 403", async () => {
      const res = await request(app)
        .post("/api/v1/storefront/banners")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          title: "Customer Banner",
          slotKey: "hero_main",
          imageUrl: "/images/banners/banner-work-smarter.png",
        });

      expect(res.status).toBe(403);
    });
  });

  describe("6. Campaign Separation Invariants", () => {
    it("should allow linking optional campaignId without altering campaign lifecycle or collection", async () => {
      const banner = await StorefrontBanner.create({
        title: "E5 Test - Banner With Campaign Link",
        slotKey: "hero_brand_deals",
        imageUrl: "/images/banners/promo-brand-deals.svg",
        campaignId: testCampaign._id,
        isActive: true,
        createdBy: adminUser._id,
      });

      // Verify banner belongs to StorefrontBanner collection
      const fetchedBanner = await StorefrontBanner.findById(banner._id);
      expect(fetchedBanner.campaignId.toString()).toBe(testCampaign._id.toString());

      // Verify campaign document is untouched and distinct
      const fetchedCampaign = await Campaign.findById(testCampaign._id);
      expect(fetchedCampaign.name).toBe("Phase E5 Summer Deals");
      expect(fetchedCampaign.status).toBe("active");
    });
  });
});
