const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Campaign = require("../src/models/Campaign");
const Category = require("../src/models/Category");
const Product = require("../src/models/Product");
const { generateAccessToken } = require("../src/services/token.service");
const { ROLES } = require("../src/constants/auth.constants");

jest.setTimeout(40000);

describe("BUYBOX E-COMMERCE — PHASE E4A: Campaign Banner, Product Targeting & Storefront Integration", () => {
  let superadminUser;
  let superadminToken;
  let customerUser;
  let customerToken;

  let testCategory1;
  let testCategory2;
  let testProduct1;
  let testProduct2;
  let testProductDraft;
  let testProductDeleted;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/buybox_test");
    }

    // 1. Superadmin user & token
    superadminUser = await User.findOne({ role: ROLES.SUPER_ADMIN });
    if (!superadminUser) {
      superadminUser = await User.create({
        firstName: "PhaseE4A",
        lastName: "SuperAdmin",
        email: `phase_e4a_super_${Date.now()}@buybox.test`,
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

    // 2. Customer user & token
    customerUser = await User.findOne({ role: ROLES.CUSTOMER });
    if (!customerUser) {
      customerUser = await User.create({
        firstName: "PhaseE4A",
        lastName: "Customer",
        email: `phase_e4a_cust_${Date.now()}@buybox.test`,
        password: "Password123!",
        role: ROLES.CUSTOMER,
        isActive: true,
        authVersion: 1,
        permissionVersion: 1,
      });
    }

    customerToken = generateAccessToken({
      sub: customerUser._id.toString(),
      role: customerUser.role,
      authVersion: customerUser.authVersion,
      permissionVersion: customerUser.permissionVersion,
    });

    // 3. Create test categories
    testCategory1 = await Category.create({
      name: "Audiophile Headphones",
      slug: `audiophile-headphones-${Date.now()}`,
      isActive: true,
    });

    testCategory2 = await Category.create({
      name: "Studio Monitors",
      slug: `studio-monitors-${Date.now()}`,
      isActive: true,
    });

    // 4. Create test products
    const vendorId = new mongoose.Types.ObjectId();

    testProduct1 = await Product.create({
      name: "Sennheiser HD 800 S",
      slug: `sennheiser-hd-800-s-${Date.now()}`,
      sku: `HD800S-${Date.now()}`,
      categoryId: testCategory1._id,
      vendorId,
      price: mongoose.Types.Decimal128.fromString("139990.00"),
      compareAtPrice: mongoose.Types.Decimal128.fromString("159990.00"),
      status: "active",
      stockStatus: "in_stock",
      isTaxable: true,
      taxCategory: "standard",
    });

    testProduct2 = await Product.create({
      name: "Genelec 8330A SAM Studio Monitor",
      slug: `genelec-8330a-${Date.now()}`,
      sku: `GEN8330A-${Date.now()}`,
      categoryId: testCategory2._id,
      vendorId,
      price: mongoose.Types.Decimal128.fromString("89990.00"),
      compareAtPrice: null,
      status: "active",
      stockStatus: "in_stock",
      isTaxable: true,
      taxCategory: "standard",
    });

    // Draft product (should be excluded from public storefront responses)
    testProductDraft = await Product.create({
      name: "Unreleased Prototype Amp",
      slug: `prototype-amp-${Date.now()}`,
      sku: `PROTOAMP-${Date.now()}`,
      categoryId: testCategory1._id,
      vendorId,
      price: mongoose.Types.Decimal128.fromString("49990.00"),
      status: "draft",
      stockStatus: "out_of_stock",
      isTaxable: true,
      taxCategory: "standard",
    });

    // Soft-deleted product (should be excluded)
    testProductDeleted = await Product.create({
      name: "Discontinued DAC V1",
      slug: `discontinued-dac-${Date.now()}`,
      sku: `DACV1-${Date.now()}`,
      categoryId: testCategory1._id,
      vendorId,
      price: mongoose.Types.Decimal128.fromString("19990.00"),
      status: "active",
      stockStatus: "out_of_stock",
      isTaxable: true,
      taxCategory: "standard",
      deletedAt: new Date(),
    });
  });

  afterAll(async () => {
    await Campaign.deleteMany({ slug: { $regex: /^e4a-test-/ } });
    if (testProduct1) await Product.findByIdAndDelete(testProduct1._id);
    if (testProduct2) await Product.findByIdAndDelete(testProduct2._id);
    if (testProductDraft) await Product.findByIdAndDelete(testProductDraft._id);
    if (testProductDeleted) await Product.findByIdAndDelete(testProductDeleted._id);
    if (testCategory1) await Category.findByIdAndDelete(testCategory1._id);
    if (testCategory2) await Category.findByIdAndDelete(testCategory2._id);
    await mongoose.disconnect();
  });

  describe("1. Campaign Data Persistence & Identifier Normalization", () => {
    test("saving a campaign persists selected product IDs and banner metadata", async () => {
      const now = new Date();
      const nextMonth = new Date(Date.now() + 30 * 86400000);

      const payload = {
        name: "E4A High-End Audio Showcase",
        slug: `e4a-test-audio-showcase-${Date.now()}`,
        type: "seasonal",
        startsAt: now.toISOString(),
        endsAt: nextMonth.toISOString(),
        status: "active",
        scope: "products",
        bannerUrl: "/uploads/media_test_banner_e4a.webp",
        productIds: [testProduct1._id.toString(), testProduct2._id.toString()],
      };

      const res = await request(app)
        .post("/api/v1/campaigns")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.bannerUrl).toBe(payload.bannerUrl);
      expect(res.body.data.isActive).toBe(true);
      expect(res.body.data.productIds.length).toBe(2);
      expect(res.body.data.productIds).toContain(testProduct1._id.toString());
      expect(res.body.data.productIds).toContain(testProduct2._id.toString());
    });

    test("retrieving campaign via getCampaignById returns saved product and category selections", async () => {
      const now = new Date();
      const nextMonth = new Date(Date.now() + 30 * 86400000);

      const created = await Campaign.create({
        name: "E4A Retrieve Verification",
        slug: `e4a-test-retrieve-${Date.now()}`,
        type: "general",
        startsAt: now,
        endsAt: nextMonth,
        status: "active",
        isActive: true,
        scope: "products",
        productIds: [testProduct1._id],
      });

      const res = await request(app)
        .get(`/api/v1/campaigns/${created._id}`)
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data._id).toBe(created._id.toString());
      expect(res.body.data.productIds.length).toBe(1);
      expect(res.body.data.productIds[0].toString()).toBe(testProduct1._id.toString());
    });

    test("partial update of bannerUrl preserves existing product and category selections", async () => {
      const now = new Date();
      const nextMonth = new Date(Date.now() + 30 * 86400000);

      const created = await Campaign.create({
        name: "E4A Preserve Selections Test",
        slug: `e4a-test-preserve-${Date.now()}`,
        type: "general",
        startsAt: now,
        endsAt: nextMonth,
        status: "active",
        isActive: true,
        scope: "products",
        bannerUrl: "/uploads/initial_banner.png",
        productIds: [testProduct1._id, testProduct2._id],
      });

      // Update banner only
      const res = await request(app)
        .patch(`/api/v1/campaigns/${created._id}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ bannerUrl: "/uploads/updated_banner.png" });

      expect(res.status).toBe(200);
      expect(res.body.data.bannerUrl).toBe("/uploads/updated_banner.png");
      expect(res.body.data.productIds.length).toBe(2);
      expect(res.body.data.productIds.map(String)).toContain(testProduct1._id.toString());
      expect(res.body.data.productIds.map(String)).toContain(testProduct2._id.toString());
    });

    test("partial update of products preserves bannerUrl and other settings", async () => {
      const now = new Date();
      const nextMonth = new Date(Date.now() + 30 * 86400000);

      const created = await Campaign.create({
        name: "E4A Update Products Test",
        slug: `e4a-test-update-prods-${Date.now()}`,
        type: "brand_special",
        startsAt: now,
        endsAt: nextMonth,
        status: "active",
        isActive: true,
        scope: "products",
        bannerUrl: "/uploads/saved_creative_banner.jpg",
        productIds: [testProduct1._id],
      });

      const res = await request(app)
        .patch(`/api/v1/campaigns/${created._id}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ productIds: [testProduct2._id.toString()] });

      expect(res.status).toBe(200);
      expect(res.body.data.bannerUrl).toBe("/uploads/saved_creative_banner.jpg");
      expect(res.body.data.type).toBe("brand_special");
      expect(res.body.data.productIds.length).toBe(1);
      expect(res.body.data.productIds[0].toString()).toBe(testProduct2._id.toString());
    });
  });

  describe("2. Selected-Products Scope Resolution", () => {
    test("resolves targeted products and safely excludes draft and deleted products", async () => {
      const now = new Date();
      const nextMonth = new Date(Date.now() + 30 * 86400000);
      const fakeDeletedId = new mongoose.Types.ObjectId();

      const campaign = await Campaign.create({
        name: "E4A Specific Products Event",
        slug: `e4a-test-specific-prods-${Date.now()}`,
        type: "flash_sale",
        startsAt: now,
        endsAt: nextMonth,
        status: "active",
        isActive: true,
        scope: "products",
        bannerUrl: "/uploads/flash_sale_hero.png",
        productIds: [
          testProduct1._id,
          testProductDraft._id,     // draft: should be filtered
          testProductDeleted._id,   // deletedAt: should be filtered
          fakeDeletedId,            // non-existent: should be safely handled
        ],
      });

      const res = await request(app).get(`/api/v1/campaigns/slug/${campaign.slug}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const products = res.body.data.productIds;
      expect(Array.isArray(products)).toBe(true);
      expect(products.length).toBe(1);
      expect(products[0]._id.toString()).toBe(testProduct1._id.toString());
      expect(products[0].name).toBe("Sennheiser HD 800 S");
      expect(typeof products[0].price).toBe("number");
      expect(products[0].price).toBe(139990);
    });
  });

  describe("3. Selected-Categories Scope Resolution", () => {
    test("resolves products belonging to selected categories", async () => {
      const now = new Date();
      const nextMonth = new Date(Date.now() + 30 * 86400000);

      const campaign = await Campaign.create({
        name: "E4A Category Headphones Event",
        slug: `e4a-test-category-event-${Date.now()}`,
        type: "seasonal",
        startsAt: now,
        endsAt: nextMonth,
        status: "active",
        isActive: true,
        scope: "categories",
        categoryIds: [testCategory1._id],
        productIds: [],
      });

      const res = await request(app).get(`/api/v1/campaigns/slug/${campaign.slug}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const products = res.body.data.productIds;
      expect(Array.isArray(products)).toBe(true);
      // Only active, non-deleted product in testCategory1 is testProduct1
      expect(products.length).toBe(1);
      expect(products[0]._id.toString()).toBe(testProduct1._id.toString());
      expect(products[0].categoryId.slug).toBe(testCategory1.slug);
    });

    test("supports multiple selected categories", async () => {
      const now = new Date();
      const nextMonth = new Date(Date.now() + 30 * 86400000);

      const campaign = await Campaign.create({
        name: "E4A Multi-Category Studio & Headphone Gala",
        slug: `e4a-test-multi-cat-${Date.now()}`,
        type: "seasonal",
        startsAt: now,
        endsAt: nextMonth,
        status: "active",
        isActive: true,
        scope: "categories",
        categoryIds: [testCategory1._id, testCategory2._id],
        productIds: [],
      });

      const res = await request(app).get(`/api/v1/campaigns/slug/${campaign.slug}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const products = res.body.data.productIds;
      expect(Array.isArray(products)).toBe(true);
      expect(products.length).toBe(2);

      const productIds = products.map((p) => p._id.toString());
      expect(productIds).toContain(testProduct1._id.toString());
      expect(productIds).toContain(testProduct2._id.toString());
    });
  });

  describe("4. Storefront Homepage Active Campaigns & Banner Resolution", () => {
    test("active campaign API returns uploaded banner property and resolved productCount", async () => {
      const now = new Date();
      const nextMonth = new Date(Date.now() + 30 * 86400000);

      const bannerSlug = `e4a-test-active-banner-${Date.now()}`;
      await Campaign.create({
        name: "E4A Homepage Banner Campaign",
        slug: bannerSlug,
        type: "brand_special",
        startsAt: now,
        endsAt: nextMonth,
        status: "active",
        isActive: true,
        scope: "categories",
        categoryIds: [testCategory1._id],
        bannerUrl: "/uploads/media_e4a_hero_banner.png",
      });

      const res = await request(app).get("/api/v1/campaigns/active");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const found = res.body.data.find((c) => c.slug === bannerSlug);
      expect(found).toBeDefined();
      expect(found.bannerUrl).toBe("/uploads/media_e4a_hero_banner.png");
      expect(found.productCount).toBeGreaterThanOrEqual(1);
    });

    test("expired campaigns are not returned in getActiveCampaigns", async () => {
      const pastStart = new Date(Date.now() - 60 * 86400000);
      const pastEnd = new Date(Date.now() - 10 * 86400000);

      const expiredSlug = `e4a-test-expired-${Date.now()}`;
      await Campaign.create({
        name: "E4A Expired Campaign",
        slug: expiredSlug,
        type: "seasonal",
        startsAt: pastStart,
        endsAt: pastEnd,
        status: "active",
        isActive: true,
        scope: "all",
      });

      const res = await request(app).get("/api/v1/campaigns/active");
      const found = res.body.data.find((c) => c.slug === expiredSlug);
      expect(found).toBeUndefined();
    });

    test("future scheduled campaigns are not returned in getActiveCampaigns", async () => {
      const futureStart = new Date(Date.now() + 5 * 86400000);
      const futureEnd = new Date(Date.now() + 35 * 86400000);

      const futureSlug = `e4a-test-future-${Date.now()}`;
      await Campaign.create({
        name: "E4A Future Scheduled Campaign",
        slug: futureSlug,
        type: "holiday",
        startsAt: futureStart,
        endsAt: futureEnd,
        status: "scheduled",
        isActive: false,
        scope: "all",
      });

      const res = await request(app).get("/api/v1/campaigns/active");
      const found = res.body.data.find((c) => c.slug === futureSlug);
      expect(found).toBeUndefined();
    });
  });

  describe("5. Public Visibility & Preview Security", () => {
    test("draft campaign returns 404 to unauthenticated public requests even with preview=true", async () => {
      const now = new Date();
      const nextMonth = new Date(Date.now() + 30 * 86400000);

      const draftSlug = `e4a-test-draft-${Date.now()}`;
      await Campaign.create({
        name: "E4A Draft Hidden Campaign",
        slug: draftSlug,
        type: "general",
        startsAt: now,
        endsAt: nextMonth,
        status: "draft",
        isActive: false,
        scope: "all",
      });

      // No preview param -> 404
      const res1 = await request(app).get(`/api/v1/campaigns/slug/${draftSlug}`);
      expect(res1.status).toBe(404);

      // Unauthenticated with ?preview=true -> 404
      const res2 = await request(app).get(`/api/v1/campaigns/slug/${draftSlug}?preview=true`);
      expect(res2.status).toBe(404);

      // Customer role with ?preview=true -> 404
      const res3 = await request(app)
        .get(`/api/v1/campaigns/slug/${draftSlug}?preview=true`)
        .set("Authorization", `Bearer ${customerToken}`);
      expect(res3.status).toBe(404);

      // Staff (Superadmin) with ?preview=true -> 200
      const res4 = await request(app)
        .get(`/api/v1/campaigns/slug/${draftSlug}?preview=true`)
        .set("Authorization", `Bearer ${superadminToken}`);
      expect(res4.status).toBe(200);
      expect(res4.body.data.slug).toBe(draftSlug);
    });

    test("empty campaigns return empty productIds array without crashing", async () => {
      const now = new Date();
      const nextMonth = new Date(Date.now() + 30 * 86400000);

      const emptyCat = await Category.create({
        name: "Empty Category Test",
        slug: `empty-cat-${Date.now()}`,
        isActive: true,
      });

      const emptyCampaign = await Campaign.create({
        name: "E4A Empty Category Campaign",
        slug: `e4a-test-empty-cat-${Date.now()}`,
        type: "general",
        startsAt: now,
        endsAt: nextMonth,
        status: "active",
        isActive: true,
        scope: "categories",
        categoryIds: [emptyCat._id],
        productIds: [],
      });

      const res = await request(app).get(`/api/v1/campaigns/slug/${emptyCampaign.slug}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.productIds)).toBe(true);
      expect(res.body.data.productIds.length).toBe(0);

      await Category.findByIdAndDelete(emptyCat._id);
    });
  });
});
