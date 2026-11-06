const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../src/app");

const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const Category = require("../src/models/Category");
const Brand = require("../src/models/Brand");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const ProductDiscount = require("../src/models/ProductDiscount");
const AuditLog = require("../src/models/AuditLog");
const Employee = require("../src/models/Employee");
const JobRole = require("../src/models/JobRole");

const { generateAccessToken } = require("../src/services/token.service");
const pricingEngineService = require("../src/services/pricing-engine.service");

const {
  DISCOUNT_TYPES,
  DISCOUNT_STATUSES,
  DISCOUNT_SCOPES,
  FUNDING_SOURCES,
} = require("../src/constants/promotion.constants");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace(/\/buybox(_test)?(\?|$)/, "/buybox_d3_test$2")
  : "mongodb://127.0.0.1:27017/buybox_d3_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Phase D3 — Superadmin Discounts & Promotions Management Endpoints & Lifecycle", () => {
  let superAdminUser;
  let superAdminToken;
  let adminUser;
  let adminToken;
  let customerUser;
  let customerToken;
  let regularStaffUser;
  let regularStaffToken;
  let testVendor;
  let testCategory;
  let testBrand;
  let testProduct;
  let testVariant;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    const rand = Math.random().toString(36).substring(7);

    // Setup Category & Brand
    testCategory = await Category.create({
      name: `D3 Cat ${rand}`,
      slug: `d3-cat-${rand}`,
      isActive: true,
    });

    testBrand = await Brand.create({
      name: `D3 Brand ${rand}`,
      slug: `d3-brand-${rand}`,
      isActive: true,
    });

    // Setup Superadmin
    superAdminUser = await User.create({
      firstName: "Super",
      lastName: "Admin",
      email: `superadmin_${rand}@d3-test.com`,
      password: "Password123!",
      role: "super_admin",
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    superAdminToken = generateAccessToken({
      sub: superAdminUser._id.toString(),
      role: "super_admin",
      authVersion: 1,
      permissionVersion: 1,
      context: "administrator",
    });

    // Setup Admin with Employee Profile & JobRole (has operational permissions including discounts:read, but lacks super_admin and promotions:override_floor)
    const promoRole = await JobRole.create({
      name: `Promo Viewer ${rand}`,
      slug: `promo-viewer-${rand}`,
      tier: 2,
      permissions: ["discounts:read", "coupons:read"],
      isActive: true,
      isSuperadminRole: false,
    });

    adminUser = await User.create({
      firstName: "Admin",
      lastName: "Manager",
      email: `admin_${rand}@d3-test.com`,
      password: "Password123!",
      role: "admin",
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    await Employee.create({
      userId: adminUser._id,
      employeeNumber: `EMP-${rand.toUpperCase()}`,
      jobRoleId: promoRole._id,
      status: "active",
    });

    adminToken = generateAccessToken({
      sub: adminUser._id.toString(),
      role: "admin",
      authVersion: 1,
      permissionVersion: 1,
      context: "administrator",
    });

    // Setup Customer
    customerUser = await User.create({
      firstName: "Customer",
      lastName: "User",
      email: `customer_${rand}@d3-test.com`,
      password: "Password123!",
      role: "customer",
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    customerToken = generateAccessToken({
      sub: customerUser._id.toString(),
      role: "customer",
      authVersion: 1,
      permissionVersion: 1,
      context: "customer",
    });

    // Setup Regular Staff (editor role without super_admin authority)
    regularStaffUser = await User.create({
      firstName: "Staff",
      lastName: "Editor",
      email: `editor_${rand}@d3-test.com`,
      password: "Password123!",
      role: "editor",
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    regularStaffToken = generateAccessToken({
      sub: regularStaffUser._id.toString(),
      role: "editor",
      authVersion: 1,
      permissionVersion: 1,
      context: "administrator",
    });

    // Setup Vendor & Test Products
    const vendorUser = await User.create({
      firstName: "D3",
      lastName: "Vendor",
      email: `vendor_${rand}@d3-test.com`,
      password: "Password123!",
      role: "vendor",
      isActive: true,
    });
    testVendor = await Vendor.create({
      userId: vendorUser._id,
      businessName: `D3 Vendor ${rand}`,
      businessSlug: `d3-vend-${rand}`,
      isActive: true,
    });

    testProduct = await Product.create({
      name: `D3 Test Product ${rand}`,
      slug: `d3-prod-${rand}`,
      sku: `D3-SKU-${rand}`,
      categoryId: testCategory._id,
      brandId: testBrand._id,
      vendorId: testVendor._id,
      price: mongoose.Types.Decimal128.fromString("1500.00"),
      compareAtPrice: mongoose.Types.Decimal128.fromString("2000.00"),
      productType: "simple",
    });

    testVariant = await ProductVariant.create({
      productId: testProduct._id,
      sku: `${testProduct.sku}-VAR`,
      name: "Default Variant",
      price: mongoose.Types.Decimal128.fromString("1500.00"),
      compareAtPrice: mongoose.Types.Decimal128.fromString("2000.00"),
      isDefault: true,
      isActive: true,
    });
  });

  afterAll(async () => {
    try {
      await User.deleteMany({ email: /@d3-test\.com$/ });
      await Vendor.deleteMany({ businessSlug: /^d3-vend-/ });
      await Category.deleteMany({ slug: /^d3-cat-/ });
      await Brand.deleteMany({ slug: /^d3-brand-/ });
      await Product.deleteMany({ sku: /^D3-/ });
      await ProductVariant.deleteMany({ sku: /^D3-/ });
      await ProductDiscount.deleteMany({ name: /^D3 / });
      await AuditLog.deleteMany({ action: /^PROMOTION_/ });
    } catch (err) {
      // Ignore cleanup error
    }
  });

  // =========================================================================
  // 1. AUTHORIZATION AND MULTI-ROLE SECURITY
  // =========================================================================
  describe("1. Authorization & Multi-Role Safety Guardrails", () => {
    test("rejects unauthenticated requests to discounts management API", async () => {
      const res = await request(app).get("/api/v1/admin/discounts");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test("rejects customer attempts to manage or read admin discounts", async () => {
      const res = await request(app)
        .get("/api/v1/admin/discounts")
        .set("Authorization", `Bearer ${customerToken}`);

      // Customer is rejected by admin middleware / permission check
      expect([403, 401]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    test("allows authorized Superadmin to access discounts management API", async () => {
      const res = await request(app)
        .get("/api/v1/admin/discounts")
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.promotions)).toBe(true);
    });
  });

  // =========================================================================
  // 2. INPUT VALIDATION & REJECTIONS
  // =========================================================================
  describe("2. Server-side Input Validation & Rejections", () => {
    test("rejects discount creation with invalid date range (endsAt <= startsAt)", async () => {
      const res = await request(app)
        .post("/api/v1/admin/discounts")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          name: "D3 Invalid Date Promo",
          discountType: DISCOUNT_TYPES.PERCENTAGE,
          value: 20,
          startsAt: "2026-10-26T12:00:00Z",
          endsAt: "2026-10-26T10:00:00Z", // Invalid: endsAt is before startsAt
          scope: DISCOUNT_SCOPES.ALL,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test("rejects percentage discount value exceeding 100%", async () => {
      const res = await request(app)
        .post("/api/v1/admin/discounts")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          name: "D3 Excessive Percentage",
          discountType: DISCOUNT_TYPES.PERCENTAGE,
          value: 125, // Invalid percentage
          startsAt: new Date(),
          endsAt: new Date(Date.now() + 86400000),
          scope: DISCOUNT_SCOPES.ALL,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test("rejects negative monetary values", async () => {
      const res = await request(app)
        .post("/api/v1/admin/discounts")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          name: "D3 Negative Value Promo",
          discountType: DISCOUNT_TYPES.FIXED_AMOUNT,
          value: -150, // Invalid negative value
          startsAt: new Date(),
          endsAt: new Date(Date.now() + 86400000),
          scope: DISCOUNT_SCOPES.ALL,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test("rejects product scope without any target product IDs", async () => {
      const res = await request(app)
        .post("/api/v1/admin/discounts")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          name: "D3 Empty Target Promo",
          discountType: DISCOUNT_TYPES.PERCENTAGE,
          value: 15,
          startsAt: new Date(),
          endsAt: new Date(Date.now() + 86400000),
          scope: DISCOUNT_SCOPES.PRODUCTS,
          productIds: [], // Empty target IDs
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 3. PROMOTION CREATION, PERSISTENCE & AUDITING
  // =========================================================================
  describe("3. Authorized Promotion Creation, Persistence & Policy Defaults", () => {
    let createdPromotionId;

    test("creates promotion with platform funding, coupon-stacking flag, and audit trail", async () => {
      const payload = {
        name: "D3 Festive Mega 25% Off",
        description: "Superadmin promotional pricing event",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: 25,
        scope: DISCOUNT_SCOPES.PRODUCTS,
        productIds: [testProduct._id.toString()],
        startsAt: new Date(Date.now() - 3600000).toISOString(),
        endsAt: new Date(Date.now() + 86400000 * 15).toISOString(),
        priority: 10,
        maxDiscountAmount: 500,
        minSellingPrice: 800,
        fundingSource: FUNDING_SOURCES.PLATFORM,
        allowCoupons: true,
      };

      const res = await request(app)
        .post("/api/v1/admin/discounts")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("D3 Festive Mega 25% Off");
      expect(res.body.data.fundingSource).toBe("platform");
      expect(res.body.data.allowCoupons).toBe(true);
      expect(res.body.data.status).toBe("active");

      createdPromotionId = res.body.data._id;

      // Verify audit log entry
      const audit = await AuditLog.findOne({
        action: "PROMOTION_CREATED",
        targetId: createdPromotionId,
      });
      expect(audit).not.toBeNull();
      expect(audit.actorId.toString()).toBe(superAdminUser._id.toString());
    });

    test("retrieves promotion details by ID with populated targets", async () => {
      const res = await request(app)
        .get(`/api/v1/admin/discounts/${createdPromotionId}`)
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id.toString()).toBe(createdPromotionId.toString());
      expect(res.body.data.productIds.length).toBe(1);
      expect(res.body.data.productIds[0].name).toBe(testProduct.name);
    });

    test("updates promotion properties safely", async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/discounts/${createdPromotionId}`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          name: "D3 Festive Mega 30% Off",
          value: 30,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const reloaded = await ProductDiscount.findById(createdPromotionId);
      expect(reloaded.name).toBe("D3 Festive Mega 30% Off");
      expect(Number(reloaded.value.toString())).toBe(30);
    });
  });

  // =========================================================================
  // 4. LIFECYCLE STATE TRANSITIONS & PRICING ENGINE INVARIANTS
  // =========================================================================
  describe("4. Lifecycle State Transitions & Pricing Engine Safety", () => {
    let promoDoc;

    beforeEach(async () => {
      promoDoc = await ProductDiscount.create({
        name: "D3 Lifecycle Test Promo",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: mongoose.Types.Decimal128.fromString("20.00"),
        scope: DISCOUNT_SCOPES.ALL,
        status: DISCOUNT_STATUSES.ACTIVE,
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 3600000),
        fundingSource: FUNDING_SOURCES.PLATFORM,
        allowCoupons: true,
      });
    });

    test("paused promotion never applies in pricing calculations", async () => {
      // 1. Verify applies while active
      const activePrice = await pricingEngineService.calculateEffectivePrice({
        product: testProduct,
        variant: testVariant,
        activePromotions: [promoDoc],
      });
      expect(activePrice.isPromotional).toBe(true);

      // 2. Pause the promotion via endpoint
      const pauseRes = await request(app)
        .post(`/api/v1/admin/discounts/${promoDoc._id}/pause`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ reason: "Temporarily halting for inventory check" });

      expect(pauseRes.status).toBe(200);
      expect(pauseRes.body.data.status).toBe("paused");

      // 3. Pricing evaluation must strictly exclude paused promotions
      const pausedDoc = await ProductDiscount.findById(promoDoc._id);
      const pausedPrice = await pricingEngineService.calculateEffectivePrice({
        product: testProduct,
        variant: testVariant,
        activePromotions: [pausedDoc],
      });

      expect(pausedPrice.isPromotional).toBe(false);
      expect(pausedPrice.effectivePrice).toBe(pausedPrice.regularPrice);

      // 4. Resume the promotion
      const resumeRes = await request(app)
        .post(`/api/v1/admin/discounts/${promoDoc._id}/resume`)
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(resumeRes.status).toBe(200);
      expect(resumeRes.body.data.status).toBe("active");

      // 5. Applies again after resuming
      const resumedDoc = await ProductDiscount.findById(promoDoc._id);
      const resumedPrice = await pricingEngineService.calculateEffectivePrice({
        product: testProduct,
        variant: testVariant,
        activePromotions: [resumedDoc],
      });
      expect(resumedPrice.isPromotional).toBe(true);
    });

    test("cancelled and soft-deleted promotions never apply", async () => {
      // Cancel via endpoint
      const cancelRes = await request(app)
        .post(`/api/v1/admin/discounts/${promoDoc._id}/cancel`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ reason: "Promotion superseded" });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe("cancelled");

      const cancelledDoc = await ProductDiscount.findById(promoDoc._id);
      const cancelledPrice = await pricingEngineService.calculateEffectivePrice({
        product: testProduct,
        variant: testVariant,
        activePromotions: [cancelledDoc],
      });
      expect(cancelledPrice.isPromotional).toBe(false);

      // Cannot resume or edit a cancelled promotion
      const invalidResume = await request(app)
        .post(`/api/v1/admin/discounts/${promoDoc._id}/resume`)
        .set("Authorization", `Bearer ${superAdminToken}`);
      expect(invalidResume.status).toBe(400);

      // Soft delete
      const delRes = await request(app)
        .delete(`/api/v1/admin/discounts/${promoDoc._id}`)
        .set("Authorization", `Bearer ${superAdminToken}`);
      expect(delRes.status).toBe(200);

      const deletedDoc = await ProductDiscount.findById(promoDoc._id);
      expect(deletedDoc.deletedAt).not.toBeNull();
    });

    test("expired promotion never applies even if DB status is stale active", async () => {
      const expiredPromo = {
        _id: new mongoose.Types.ObjectId(),
        name: "Stale Expired Promo",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: "50.00",
        scope: DISCOUNT_SCOPES.ALL,
        status: DISCOUNT_STATUSES.ACTIVE, // Stale status in DB
        startsAt: new Date(Date.now() - 7200000),
        endsAt: new Date(Date.now() - 1000), // Ended 1 second ago
      };

      const result = await pricingEngineService.calculateEffectivePrice({
        product: testProduct,
        variant: testVariant,
        activePromotions: [expiredPromo],
      });

      expect(result.isPromotional).toBe(false);
      expect(result.effectivePrice).toBe(result.regularPrice);
    });
  });

  // =========================================================================
  // 5. PRICE PREVIEW, PRICE FLOOR & AUDITED OVERRIDE
  // =========================================================================
  describe("5. Server-side Price Preview & Audited Floor Override", () => {
    test("preview uses authoritative product prices and does not mutate database catalog", async () => {
      const initialProduct = await Product.findById(testProduct._id);
      const initialPriceStr = initialProduct.price.toString();

      const res = await request(app)
        .post("/api/v1/admin/discounts/preview")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          promotionData: {
            name: "Flash 40% Test",
            discountType: DISCOUNT_TYPES.PERCENTAGE,
            value: 40,
            scope: DISCOUNT_SCOPES.ALL,
          },
          productIds: [testProduct._id.toString()],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThan(0);

      const item = res.body.data.items[0];
      expect(item.regularPrice).toBe("1500.00");
      expect(item.effectivePrice).toBe("900.00"); // 1500 - 40% (600) = 900
      expect(item.promotionalDiscountAmount).toBe("600.00");

      // Verify Product.price in DB was NOT mutated
      const reloadedProduct = await Product.findById(testProduct._id);
      expect(reloadedProduct.price.toString()).toBe(initialPriceStr);
    });

    test("preview detects price floor violation and rejects unauthorized override", async () => {
      const res = await request(app)
        .post("/api/v1/admin/discounts/preview")
        .set("Authorization", `Bearer ${adminToken}`) // Admin has discounts:read but lacks super_admin override authority
        .send({
          promotionData: {
            name: "Violating Floor Promo",
            discountType: DISCOUNT_TYPES.PERCENTAGE,
            value: 50, // 1500 -> 750
            minSellingPrice: 1000, // Floor is 1000
            scope: DISCOUNT_SCOPES.ALL,
          },
          productIds: [testProduct._id.toString()],
          overrideFloor: true,
          overrideReason: "Attempting unauthorized override",
        });

      expect(res.status).toBe(200);
      const item = res.body.data.items[0];
      // Override is rejected because actor is not super_admin
      expect(item.floorPriceCheck.passed).toBe(false);
      expect(item.floorPriceCheck.wasOverridden).toBe(false);
      expect(item.warnings.length).toBeGreaterThan(0);
    });

    test("preview grants authorized Superadmin price floor override and writes audit log", async () => {
      const res = await request(app)
        .post("/api/v1/admin/discounts/preview")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          promotionData: {
            name: "Superadmin Authorized Floor Promo",
            discountType: DISCOUNT_TYPES.PERCENTAGE,
            value: 50, // 1500 -> 750
            minSellingPrice: 1000, // Floor is 1000
            scope: DISCOUNT_SCOPES.ALL,
          },
          productIds: [testProduct._id.toString()],
          overrideFloor: true,
          overrideReason: "Executive clearance sale approval",
        });

      expect(res.status).toBe(200);
      const item = res.body.data.items[0];
      expect(item.floorPriceCheck.passed).toBe(true);
      expect(item.floorPriceCheck.wasOverridden).toBe(true);
      expect(item.effectivePrice).toBe("750.00");

      // Audit log must have been created with reason
      const audit = await AuditLog.findOne({
        action: "PROMOTION_PREVIEW_FLOOR_OVERRIDE",
        actorId: superAdminUser._id,
      });
      expect(audit).not.toBeNull();
      expect(audit.afterState.reason).toBe("Executive clearance sale approval");
    });
  });

  // =========================================================================
  // 6. BULK TARGET ASSIGNMENT
  // =========================================================================
  describe("6. Bulk Target Assignment & Scope Management", () => {
    test("bulk assigns and updates target product identifiers", async () => {
      const promo = await ProductDiscount.create({
        name: "D3 Target Assignment Promo",
        discountType: DISCOUNT_TYPES.FIXED_AMOUNT,
        value: mongoose.Types.Decimal128.fromString("100.00"),
        scope: DISCOUNT_SCOPES.PRODUCTS,
        productIds: [],
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 86400000),
      });

      const res = await request(app)
        .post(`/api/v1/admin/discounts/${promo._id}/assign-products`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          action: "add",
          productIds: [testProduct._id.toString()],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.productIds.length).toBe(1);

      const reloaded = await ProductDiscount.findById(promo._id);
      expect(reloaded.productIds.length).toBe(1);
      expect(reloaded.productIds[0].toString()).toBe(testProduct._id.toString());
    });
  });
});
