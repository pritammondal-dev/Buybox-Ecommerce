const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Employee = require("../src/models/Employee");
const Role = require("../src/models/Role");
const Permission = require("../src/models/Permission");
const RolePermission = require("../src/models/RolePermission");
const EmployeeRole = require("../src/models/EmployeeRole");
const StorefrontBanner = require("../src/models/StorefrontBanner");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const { generateAccessToken } = require("../src/services/token.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_banner_test?")
  : "mongodb://127.0.0.1:27017/buybox_banner_test?replicaSet=rs0";

describe("Storefront Banner Slot Manager API Tests", () => {
  jest.setTimeout(30000);

  let adminUser;
  let adminToken;
  let regularUser;
  let regularToken;

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
    let adminRole = await Role.findOne({ slug: "banner-slot-admin" });
    if (!adminRole) {
      adminRole = await Role.create({
        slug: "banner-slot-admin",
        name: "Banner Slot Admin",
        description: "Admin for banner slots",
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

    // Create Admin User
    adminUser = await User.create({
      firstName: "Banner",
      lastName: "Admin",
      email: `banner_admin_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`,
      password: "Password123!",
      role: "admin",
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const adminEmp = await Employee.create({
      userId: adminUser._id,
      employeeNumber: `EMP_BANN_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      jobTitle: "Marketing Director",
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

    // Create Regular Customer
    regularUser = await User.create({
      firstName: "Regular",
      lastName: "Customer",
      email: `customer_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`,
      password: "Password123!",
      role: ROLES.CUSTOMER,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    regularToken = generateAccessToken({
      sub: regularUser._id.toString(),
      role: regularUser.role,
      authVersion: regularUser.authVersion,
      permissionVersion: regularUser.permissionVersion,
    });
  });

  afterAll(async () => {
    await StorefrontBanner.deleteMany({ title: /Test Banner/ });
    if (adminUser) await User.findByIdAndDelete(adminUser._id);
    if (regularUser) await User.findByIdAndDelete(regularUser._id);
    await mongoose.disconnect();
  });

  describe("1. Validation & Allowed Placements", () => {
    it("should accept valid promotional slotKey (hero_audio)", async () => {
      const res = await request(app)
        .post("/api/v1/storefront/banners")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Test Banner - Hero Audio",
          slotKey: "hero_audio",
          altText: "Audio Essentials Promo",
          imageUrl: "/images/banners/promo-audio-essentials.svg",
          linkUrl: "/shop?category=audio",
          displayOrder: 1,
          isActive: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.slotKey).toBe("hero_audio");
      expect(res.body.data.altText).toBe("Audio Essentials Promo");
      expect(res.body.data.imageUrl).toBe("/images/banners/promo-audio-essentials.svg");
      expect(res.body.data.linkUrl).toBe("/shop?category=audio");
    });

    it("should accept placement alias and map to slotKey", async () => {
      const res = await request(app)
        .post("/api/v1/storefront/banners")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Test Banner - Mid Work Smarter",
          placement: "mid_work_smarter",
          imageUrl: "https://example.com/banner.png",
          linkUrl: "/shop?category=laptops",
          isActive: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.slotKey).toBe("mid_work_smarter");
    });

    it("should accept data URI image format", async () => {
      const dummyDataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const res = await request(app)
        .post("/api/v1/storefront/banners")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Test Banner - Data URI",
          slotKey: "bottom_smart_gadgets",
          imageUrl: dummyDataUri,
          isActive: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.imageUrl).toBe(dummyDataUri);
    });

    it("should reject an invalid slotKey not in the allowed enum list", async () => {
      const res = await request(app)
        .post("/api/v1/storefront/banners")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Test Banner - Invalid Slot",
          slotKey: "invalid_slot_key_xyz",
          imageUrl: "/images/banners/test.png",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("2. Active Banners Listing & Slot Filtering", () => {
    let activeSlotBanner;
    let inactiveSlotBanner;

    beforeAll(async () => {
      activeSlotBanner = await StorefrontBanner.create({
        title: "Test Banner - Active Category Audio",
        slotKey: "category_audio",
        altText: "Audio For Every Mood",
        imageUrl: "/images/banners/cat-audio-mood.png",
        linkUrl: "/shop?category=audio",
        isActive: true,
        createdBy: adminUser._id,
      });

      inactiveSlotBanner = await StorefrontBanner.create({
        title: "Test Banner - Inactive Category Workspace",
        slotKey: "category_workspace",
        imageUrl: "/images/banners/cat-workspace-upgrade.png",
        isActive: false,
        createdBy: adminUser._id,
      });
    });

    it("public GET /storefront/banners/active returns active banners without auth", async () => {
      const res = await request(app)
        .get("/api/v1/storefront/banners/active");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const foundActive = res.body.data.find(b => b.title === "Test Banner - Active Category Audio");
      expect(foundActive).toBeDefined();
      expect(foundActive.slotKey).toBe("category_audio");

      const foundInactive = res.body.data.find(b => b.title === "Test Banner - Inactive Category Workspace");
      expect(foundInactive).toBeUndefined();
    });

    it("public GET /storefront/banners/active?slotKey=category_audio filters specifically by slotKey", async () => {
      const res = await request(app)
        .get("/api/v1/storefront/banners/active?slotKey=category_audio");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.every(b => b.slotKey === "category_audio")).toBe(true);
    });
  });

  describe("3. Banner Updates & Deletion", () => {
    let bannerToUpdate;

    beforeEach(async () => {
      bannerToUpdate = await StorefrontBanner.create({
        title: "Test Banner - To Update",
        slotKey: "bottom_monsoon_special",
        imageUrl: "/images/banners/promo-monsoon-special.svg",
        linkUrl: "/shop?category=fashion",
        isActive: true,
        createdBy: adminUser._id,
      });
    });

    it("should allow admin to update slotKey, altText, linkUrl, and isActive", async () => {
      const res = await request(app)
        .patch(`/api/v1/storefront/banners/${bannerToUpdate._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          altText: "Updated Monsoon Rainwear Gear",
          linkUrl: "/shop?category=monsoon",
          isActive: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.altText).toBe("Updated Monsoon Rainwear Gear");
      expect(res.body.data.linkUrl).toBe("/shop?category=monsoon");
      expect(res.body.data.isActive).toBe(false);

      // Verify excluded from public active list
      const activeRes = await request(app).get(`/api/v1/storefront/banners/active?slotKey=bottom_monsoon_special`);
      const matched = activeRes.body.data.find(b => b._id === bannerToUpdate._id.toString());
      expect(matched).toBeUndefined();
    });

    it("should allow admin to delete a banner", async () => {
      const res = await request(app)
        .delete(`/api/v1/storefront/banners/${bannerToUpdate._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      const check = await StorefrontBanner.findById(bannerToUpdate._id);
      expect(check).toBeNull();
    });
  });

  describe("4. Security & Role Enforcement", () => {
    it("should reject unauthenticated attempt to create banner with 401", async () => {
      const res = await request(app)
        .post("/api/v1/storefront/banners")
        .send({
          title: "Test Banner - Unauth",
          imageUrl: "/images/banners/test.png",
        });

      expect(res.status).toBe(401);
    });

    it("should reject customer attempt to create banner with 403", async () => {
      const res = await request(app)
        .post("/api/v1/storefront/banners")
        .set("Authorization", `Bearer ${regularToken}`)
        .send({
          title: "Test Banner - Customer",
          imageUrl: "/images/banners/test.png",
        });

      expect(res.status).toBe(403);
    });
  });
});
