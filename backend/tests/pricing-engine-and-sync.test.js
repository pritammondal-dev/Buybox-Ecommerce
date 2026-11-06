const mongoose = require("mongoose");
const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const Category = require("../src/models/Category");
const Brand = require("../src/models/Brand");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Warehouse = require("../src/models/Warehouse");
const Inventory = require("../src/models/Inventory");
const AuditLog = require("../src/models/AuditLog");
const ProductDiscount = require("../src/models/ProductDiscount");

const productService = require("../src/services/product.service");
const productVariantService = require("../src/services/product-variant.service");
const bulkImportExportService = require("../src/services/bulk-import-export.service");
const pricingEngineService = require("../src/services/pricing-engine.service");

const {
  DISCOUNT_TYPES,
  DISCOUNT_STATUSES,
  DISCOUNT_SCOPES,
  FUNDING_SOURCES,
} = require("../src/constants/promotion.constants");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace(/\/buybox(_test)?(\?|$)/, "/buybox_d2_test$2")
  : "mongodb://127.0.0.1:27017/buybox_d2_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Phase D2 — Dynamic Discount Pricing Engine & Price Synchronization", () => {
  let testCategory;
  let testBrand;
  let testWarehouse;
  let testVendor;
  let vendorUser;
  let superAdminUser;
  let regularStaffUser;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    const rand = Math.random().toString(36).substring(7);

    // Setup Category & Brand
    testCategory = await Category.create({
      name: `D2 Category ${rand}`,
      slug: `d2-cat-${rand}`,
      isActive: true,
    });

    testBrand = await Brand.create({
      name: `D2 Brand ${rand}`,
      slug: `d2-brand-${rand}`,
      isActive: true,
    });

    testWarehouse = await Warehouse.create({
      name: `D2 Hub ${rand}`,
      code: `D2-WH-${rand}`,
      address: {
        addressLine1: "100 Logistics Way",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "IN",
      },
      isActive: true,
    });

    // Setup Users: Vendor, Superadmin, Regular Staff
    vendorUser = await User.create({
      firstName: "D2",
      lastName: "Vendor",
      email: `vendor_${rand}@d2-test.com`,
      password: "Password123!",
      role: "vendor",
      isActive: true,
    });

    testVendor = await Vendor.create({
      userId: vendorUser._id,
      businessName: `D2 Store ${rand}`,
      businessSlug: `d2-store-${rand}`,
      isActive: true,
      onboardingStatus: "approved",
    });

    superAdminUser = await User.create({
      firstName: "D2",
      lastName: "SuperAdmin",
      email: `superadmin_${rand}@d2-test.com`,
      password: "Password123!",
      role: "super_admin",
      isActive: true,
    });

    regularStaffUser = await User.create({
      firstName: "D2",
      lastName: "Staff",
      email: `staff_${rand}@d2-test.com`,
      password: "Password123!",
      role: "editor",
      isActive: true,
    });
  });

  afterAll(async () => {
    try {
      await User.deleteMany({ email: /@d2-test\.com$/ });
      await Vendor.deleteMany({ businessSlug: /^d2-store-/ });
      await Category.deleteMany({ slug: /^d2-cat-/ });
      await Brand.deleteMany({ slug: /^d2-brand-/ });
      await Warehouse.deleteMany({ code: /^D2-WH-/ });
      await Product.deleteMany({ sku: /^D2-/ });
      await ProductVariant.deleteMany({ sku: /^D2-/ });
      await ProductDiscount.deleteMany({ name: /^D2 Promo/ });
      await AuditLog.deleteMany({ action: "PROMOTION_PRICE_FLOOR_OVERRIDE" });
    } catch (err) {
      // Ignore cleanup error
    }
  });

  // =========================================================================
  // 1. PRICING ENGINE CORE & BUSINESS RULES
  // =========================================================================
  describe("1. Pricing Engine Core & Business Rules", () => {
    test("rejects invalid, negative, or malformed monetary values", () => {
      expect(() => pricingEngineService.decimalToMinorUnits("invalid")).toThrow();
      expect(() => pricingEngineService.decimalToMinorUnits(null)).toThrow();
      expect(() => pricingEngineService.decimalToMinorUnits("")).toThrow();
      expect(() => pricingEngineService.minorUnitsToDecimalString(Infinity)).toThrow();
      expect(() => pricingEngineService.minorUnitsToDecimalString(10.5)).toThrow();
    });

    test("converts decimals to minor units and back without floating-point error", () => {
      expect(pricingEngineService.decimalToMinorUnits("1299.00")).toBe(129900);
      expect(pricingEngineService.decimalToMinorUnits("1299.99")).toBe(129999);
      expect(pricingEngineService.decimalToMinorUnits("0.05")).toBe(5);
      expect(pricingEngineService.decimalToMinorUnits(299)).toBe(29900);
      expect(pricingEngineService.minorUnitsToDecimalString(129900)).toBe("1299.00");
      expect(pricingEngineService.minorUnitsToDecimalString(5)).toBe("0.05");
      expect(pricingEngineService.minorUnitsToDecimalString(0)).toBe("0.00");
    });

    test("returns regular price unchanged when no promotions apply", async () => {
      const mockProduct = {
        _id: new mongoose.Types.ObjectId(),
        sku: "D2-REG-001",
        price: mongoose.Types.Decimal128.fromString("1499.00"),
        compareAtPrice: mongoose.Types.Decimal128.fromString("1999.00"),
        currency: "INR",
      };

      const result = await pricingEngineService.calculateEffectivePrice({
        product: mockProduct,
        activePromotions: [],
      });

      expect(result.isPromotional).toBe(false);
      expect(result.regularPrice).toBe("1499.00");
      expect(result.effectivePrice).toBe("1499.00");
      expect(result.compareAtPrice).toBe("1999.00");
      expect(result.promotionalDiscountAmount).toBe("0.00");
      expect(result.discountPercentage).toBe(0);
      expect(result.promotion).toBeNull();
      expect(result.fundingSource).toBeNull();
      expect(result.allowCoupons).toBe(true);
    });

    test("applies a valid percentage discount deterministically", async () => {
      const mockProduct = {
        _id: new mongoose.Types.ObjectId(),
        sku: "D2-PCT-001",
        price: mongoose.Types.Decimal128.fromString("1000.00"),
        compareAtPrice: mongoose.Types.Decimal128.fromString("2000.00"),
        currency: "INR",
      };

      const promo = {
        _id: new mongoose.Types.ObjectId(),
        name: "Festive 20% Off",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: "20.00",
        scope: DISCOUNT_SCOPES.ALL,
        status: DISCOUNT_STATUSES.ACTIVE,
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 3600000),
        fundingSource: FUNDING_SOURCES.PLATFORM,
        allowCoupons: true,
        priority: 10,
      };

      const result = await pricingEngineService.calculateEffectivePrice({
        product: mockProduct,
        activePromotions: [promo],
      });

      expect(result.isPromotional).toBe(true);
      expect(result.regularPrice).toBe("1000.00");
      expect(result.effectivePrice).toBe("800.00");
      expect(result.promotionalDiscountAmount).toBe("200.00");
      expect(result.discountPercentage).toBe(20);
      expect(result.fundingSource).toBe("platform");
      expect(result.allowCoupons).toBe(true);
      expect(result.promotion.name).toBe("Festive 20% Off");
    });

    test("applies a valid fixed-amount discount", async () => {
      const mockProduct = {
        _id: new mongoose.Types.ObjectId(),
        sku: "D2-FIX-001",
        price: mongoose.Types.Decimal128.fromString("1500.00"),
        currency: "INR",
      };

      const promo = {
        _id: new mongoose.Types.ObjectId(),
        name: "Flat 300 Off",
        discountType: DISCOUNT_TYPES.FIXED_AMOUNT,
        value: "300.00",
        scope: DISCOUNT_SCOPES.ALL,
        status: DISCOUNT_STATUSES.ACTIVE,
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 3600000),
        fundingSource: FUNDING_SOURCES.VENDOR,
        allowCoupons: false,
        priority: 5,
      };

      const result = await pricingEngineService.calculateEffectivePrice({
        product: mockProduct,
        activePromotions: [promo],
      });

      expect(result.isPromotional).toBe(true);
      expect(result.regularPrice).toBe("1500.00");
      expect(result.effectivePrice).toBe("1200.00");
      expect(result.promotionalDiscountAmount).toBe("300.00");
      expect(result.fundingSource).toBe("vendor");
      expect(result.allowCoupons).toBe(false);
    });

    test("evaluates startsAt <= evaluationTime < endsAt boundary conditions strictly", async () => {
      const mockProduct = {
        _id: new mongoose.Types.ObjectId(),
        sku: "D2-TIME-001",
        price: mongoose.Types.Decimal128.fromString("1000.00"),
      };

      const t1 = new Date("2026-10-26T10:00:00.000Z");
      const t2 = new Date("2026-10-26T12:00:00.000Z");

      const promo = {
        _id: new mongoose.Types.ObjectId(),
        name: "Flash Sale",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: "50.00",
        scope: DISCOUNT_SCOPES.ALL,
        status: DISCOUNT_STATUSES.ACTIVE,
        startsAt: t1,
        endsAt: t2,
      };

      // Exactly at startsAt -> Active
      const resAtStart = await pricingEngineService.calculateEffectivePrice({
        product: mockProduct,
        asOfDate: t1,
        activePromotions: [promo],
      });
      expect(resAtStart.isPromotional).toBe(true);

      // In middle of window -> Active
      const resMid = await pricingEngineService.calculateEffectivePrice({
        product: mockProduct,
        asOfDate: new Date("2026-10-26T11:00:00.000Z"),
        activePromotions: [promo],
      });
      expect(resMid.isPromotional).toBe(true);

      // Exactly at endsAt -> Ineligible (expired)
      const resAtEnd = await pricingEngineService.calculateEffectivePrice({
        product: mockProduct,
        asOfDate: t2,
        activePromotions: [promo],
      });
      expect(resAtEnd.isPromotional).toBe(false);
      expect(resAtEnd.effectivePrice).toBe("1000.00");

      // Before startsAt -> Ineligible (future/scheduled)
      const resBefore = await pricingEngineService.calculateEffectivePrice({
        product: mockProduct,
        asOfDate: new Date("2026-10-26T09:59:59.999Z"),
        activePromotions: [promo],
      });
      expect(resBefore.isPromotional).toBe(false);
    });

    test("does not invent missing MRP or artificially inflate compareAtPrice", async () => {
      const mockProductWithoutCap = {
        _id: new mongoose.Types.ObjectId(),
        sku: "D2-NOMRP-001",
        price: mongoose.Types.Decimal128.fromString("899.00"),
        compareAtPrice: null,
      };

      const promo = {
        _id: new mongoose.Types.ObjectId(),
        name: "Promo 10%",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: "10.00",
        scope: DISCOUNT_SCOPES.ALL,
        status: DISCOUNT_STATUSES.ACTIVE,
        startsAt: new Date(Date.now() - 10000),
        endsAt: new Date(Date.now() + 10000),
      };

      const result = await pricingEngineService.calculateEffectivePrice({
        product: mockProductWithoutCap,
        activePromotions: [promo],
      });

      expect(result.compareAtPrice).toBeNull();
      expect(result.mrpDiscountPercentage).toBeNull();
      expect(result.promotionalDiscountAmount).toBe("89.90");
      expect(result.effectivePrice).toBe("809.10");
    });

    test("never overwrites Product.price or ProductVariant.price (Regular-Price Invariant)", async () => {
      const p = await Product.create({
        name: "Invariant Product",
        slug: `inv-prod-${Date.now()}`,
        sku: `D2-INV-${Date.now()}`,
        categoryId: testCategory._id,
        vendorId: testVendor._id,
        price: mongoose.Types.Decimal128.fromString("2500.00"),
        compareAtPrice: mongoose.Types.Decimal128.fromString("3000.00"),
        productType: "simple",
      });

      const v = await ProductVariant.create({
        productId: p._id,
        sku: `${p.sku}-DEF`,
        price: mongoose.Types.Decimal128.fromString("2500.00"),
        compareAtPrice: mongoose.Types.Decimal128.fromString("3000.00"),
        isDefault: true,
        isActive: true,
      });

      const promo = {
        _id: new mongoose.Types.ObjectId(),
        name: "Mega 50% Off",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: "50.00",
        scope: DISCOUNT_SCOPES.ALL,
        status: DISCOUNT_STATUSES.ACTIVE,
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 3600000),
      };

      const pricing = await pricingEngineService.calculateEffectivePrice({
        product: p,
        variant: v,
        activePromotions: [promo],
      });

      expect(pricing.effectivePrice).toBe("1250.00");

      // Verify DB documents were NEVER mutated
      const reloadedP = await Product.findById(p._id);
      const reloadedV = await ProductVariant.findById(v._id);
      expect(Number(reloadedP.price.toString())).toBe(2500);
      expect(Number(reloadedV.price.toString())).toBe(2500);
    });

    test("respects maxDiscountAmount cap", async () => {
      const mockProduct = {
        _id: new mongoose.Types.ObjectId(),
        sku: "D2-CAP-001",
        price: mongoose.Types.Decimal128.fromString("10000.00"),
      };

      const promoWithCap = {
        _id: new mongoose.Types.ObjectId(),
        name: "50% with 1000 cap",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: "50.00", // Would be 5000 off without cap
        maxDiscountAmount: mongoose.Types.Decimal128.fromString("1000.00"),
        scope: DISCOUNT_SCOPES.ALL,
        status: DISCOUNT_STATUSES.ACTIVE,
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 3600000),
      };

      const result = await pricingEngineService.calculateEffectivePrice({
        product: mockProduct,
        activePromotions: [promoWithCap],
      });

      expect(result.promotionalDiscountAmount).toBe("1000.00");
      expect(result.effectivePrice).toBe("9000.00");
      expect(result.discountPercentage).toBe(10); // 1000 off 10000 = 10%
    });

    test("resolves conflicting promotions deterministically (priority -> savings -> startsAt -> id)", async () => {
      const mockProduct = {
        _id: new mongoose.Types.ObjectId(),
        sku: "D2-CONFLICT-001",
        price: mongoose.Types.Decimal128.fromString("2000.00"),
      };

      const promoLowPriority = {
        _id: new mongoose.Types.ObjectId("671d00000000000000000001"),
        name: "Promo Low Priority (High Discount)",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: "50.00", // 1000 off
        priority: 5,
        scope: DISCOUNT_SCOPES.ALL,
        status: DISCOUNT_STATUSES.ACTIVE,
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 3600000),
      };

      const promoHighPriority = {
        _id: new mongoose.Types.ObjectId("671d00000000000000000002"),
        name: "Promo High Priority (Lower Discount)",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: "20.00", // 400 off
        priority: 15,
        scope: DISCOUNT_SCOPES.ALL,
        status: DISCOUNT_STATUSES.ACTIVE,
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 3600000),
      };

      // High priority must win even with lower discount
      const result = await pricingEngineService.calculateEffectivePrice({
        product: mockProduct,
        activePromotions: [promoLowPriority, promoHighPriority],
      });

      expect(result.promotion.name).toBe("Promo High Priority (Lower Discount)");
      expect(result.effectivePrice).toBe("1600.00");

      // Same priority: Higher savings wins
      const promoSamePriorityHigherSavings = {
        _id: new mongoose.Types.ObjectId("671d00000000000000000003"),
        name: "Promo Equal Priority Higher Savings",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: "30.00", // 600 off
        priority: 15,
        scope: DISCOUNT_SCOPES.ALL,
        status: DISCOUNT_STATUSES.ACTIVE,
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 3600000),
      };

      const resultTieBreak = await pricingEngineService.calculateEffectivePrice({
        product: mockProduct,
        activePromotions: [promoHighPriority, promoSamePriorityHigherSavings],
      });

      expect(resultTieBreak.promotion.name).toBe("Promo Equal Priority Higher Savings");
      expect(resultTieBreak.effectivePrice).toBe("1400.00");
    });

    test("evaluates category and brand scopes correctly", async () => {
      const catA = new mongoose.Types.ObjectId();
      const catB = new mongoose.Types.ObjectId();

      const prodCatA = {
        _id: new mongoose.Types.ObjectId(),
        sku: "D2-CAT-A",
        categoryId: catA,
        price: mongoose.Types.Decimal128.fromString("1000.00"),
      };

      const promoForCatB = {
        _id: new mongoose.Types.ObjectId(),
        name: "Cat B Only Promo",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: "25.00",
        scope: DISCOUNT_SCOPES.CATEGORIES,
        categoryIds: [catB],
        status: DISCOUNT_STATUSES.ACTIVE,
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 3600000),
      };

      const resultIneligible = await pricingEngineService.calculateEffectivePrice({
        product: prodCatA,
        activePromotions: [promoForCatB],
      });
      expect(resultIneligible.isPromotional).toBe(false);

      const promoForCatA = {
        _id: new mongoose.Types.ObjectId(),
        name: "Cat A Promo",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: "25.00",
        scope: DISCOUNT_SCOPES.CATEGORIES,
        categoryIds: [catA],
        status: DISCOUNT_STATUSES.ACTIVE,
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 3600000),
      };

      const resultEligible = await pricingEngineService.calculateEffectivePrice({
        product: prodCatA,
        activePromotions: [promoForCatA],
      });
      expect(resultEligible.isPromotional).toBe(true);
      expect(resultEligible.effectivePrice).toBe("750.00");
    });
  });

  // =========================================================================
  // 2. PRICE FLOOR PROTECTION & PERMISSION OVERRIDE
  // =========================================================================
  describe("2. Price Floor Protection & Superadmin Override Safety", () => {
    test("rejects promotion when effective price falls below minSellingPrice floor", async () => {
      const mockProduct = {
        _id: new mongoose.Types.ObjectId(),
        sku: "D2-FLOOR-001",
        price: mongoose.Types.Decimal128.fromString("1000.00"),
      };

      const promoWithFloor = {
        _id: new mongoose.Types.ObjectId(),
        name: "Excessive Discount",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: "60.00", // Would result in 400.00
        minSellingPrice: mongoose.Types.Decimal128.fromString("600.00"), // Floor is 600.00
        scope: DISCOUNT_SCOPES.ALL,
        status: DISCOUNT_STATUSES.ACTIVE,
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 3600000),
      };

      // Without override -> floor violation disqualifies promotion
      const result = await pricingEngineService.calculateEffectivePrice({
        product: mockProduct,
        activePromotions: [promoWithFloor],
        overrideFloor: false,
      });

      expect(result.isPromotional).toBe(false);
      expect(result.effectivePrice).toBe("1000.00");
    });

    test("rejects price floor override if actor lacks super_admin permission", async () => {
      const mockProduct = {
        _id: new mongoose.Types.ObjectId(),
        sku: "D2-FLOOR-002",
        price: mongoose.Types.Decimal128.fromString("1000.00"),
      };

      const promoWithFloor = {
        _id: new mongoose.Types.ObjectId(),
        name: "Floor Promo",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: "60.00",
        minSellingPrice: mongoose.Types.Decimal128.fromString("600.00"),
        scope: DISCOUNT_SCOPES.ALL,
        status: DISCOUNT_STATUSES.ACTIVE,
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 3600000),
      };

      const resultUnauthorized = await pricingEngineService.calculateEffectivePrice({
        product: mockProduct,
        activePromotions: [promoWithFloor],
        actor: regularStaffUser, // staff role lacks override permission
        overrideFloor: true,
      });

      expect(resultUnauthorized.isPromotional).toBe(false);
      expect(resultUnauthorized.effectivePrice).toBe("1000.00");
    });

    test("permits and audits price floor override when authorized by super_admin", async () => {
      const mockProduct = {
        _id: new mongoose.Types.ObjectId(),
        sku: "D2-FLOOR-003",
        price: mongoose.Types.Decimal128.fromString("1000.00"),
      };

      const promoWithFloor = {
        _id: new mongoose.Types.ObjectId(),
        name: "Audited Superadmin Promo",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: "60.00",
        minSellingPrice: mongoose.Types.Decimal128.fromString("600.00"),
        scope: DISCOUNT_SCOPES.ALL,
        status: DISCOUNT_STATUSES.ACTIVE,
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 3600000),
      };

      const resultAuthorized = await pricingEngineService.calculateEffectivePrice({
        product: mockProduct,
        activePromotions: [promoWithFloor],
        actor: superAdminUser,
        overrideFloor: true,
      });

      expect(resultAuthorized.isPromotional).toBe(true);
      expect(resultAuthorized.effectivePrice).toBe("400.00");
      expect(resultAuthorized.floorPriceCheck.passed).toBe(true);
      expect(resultAuthorized.floorPriceCheck.wasOverridden).toBe(true);
      expect(resultAuthorized.floorPriceCheck.floorPrice).toBe("600.00");

      // Verify audit log entry was created
      const audit = await AuditLog.findOne({
        action: "PROMOTION_PRICE_FLOOR_OVERRIDE",
        actorId: superAdminUser._id,
      });
      expect(audit).not.toBeNull();
      expect(audit.entityType).toBe("product_discount");
    });
  });

  // =========================================================================
  // 3. DEFECT A: SIMPLE PRODUCT COMPAREATPRICE SYNCHRONIZATION
  // =========================================================================
  describe("3. Defect A Verification: Simple-product compareAtPrice synchronization", () => {
    test("synchronizes compareAtPrice to canonical default variant when updating simple product", async () => {
      const rand = Math.random().toString(36).substring(7);

      const createdProduct = await productService.createProduct({
        data: {
          name: `Simple Sync Test ${rand}`,
          slug: `d2-simp-${rand}`,
          sku: `D2-SIMP-${rand}`,
          productType: "simple",
          categoryId: testCategory._id.toString(),
          brandId: testBrand._id.toString(),
          price: 1200,
          compareAtPrice: 1500,
          stockQuantity: 10,
        },
        actor: vendorUser,
        userId: vendorUser._id,
      });

      // Confirm initial sync
      let defaultVariant = await ProductVariant.findOne({
        productId: createdProduct._id,
        isDefault: true,
      });
      expect(Number(defaultVariant.price.toString())).toBe(1200);
      expect(Number(defaultVariant.compareAtPrice.toString())).toBe(1500);

      // Update simple product with new price AND compareAtPrice
      await productService.updateProduct({
        id: createdProduct._id.toString(),
        data: {
          price: 1100,
          compareAtPrice: 1600,
        },
        actor: vendorUser,
      });

      // Reload default variant and verify compareAtPrice was synchronized
      defaultVariant = await ProductVariant.findOne({
        productId: createdProduct._id,
        isDefault: true,
      });

      expect(Number(defaultVariant.price.toString())).toBe(1100);
      expect(Number(defaultVariant.compareAtPrice.toString())).toBe(1600);
    });
  });

  // =========================================================================
  // 4. DEFECT B: PARENT-PRODUCT PRICE & REFERENCE-PRICE SYNCHRONIZATION
  // =========================================================================
  describe("4. Defect B Verification: Variable-product parent price & compareAtPrice synchronization", () => {
    test("syncParentProductPrice synchronizes both lowest price and corresponding compareAtPrice", async () => {
      const rand = Math.random().toString(36).substring(7);

      const varProduct = await Product.create({
        name: `Variable Sync Test ${rand}`,
        slug: `var-sync-${rand}`,
        sku: `D2-VAR-${rand}`,
        categoryId: testCategory._id,
        vendorId: testVendor._id,
        productType: "variable",
        price: mongoose.Types.Decimal128.fromString("9999.00"),
        compareAtPrice: null,
      });

      // Create variant 1: Price 2000, compareAtPrice 2500
      await ProductVariant.create({
        productId: varProduct._id,
        sku: `${varProduct.sku}-V1`,
        price: mongoose.Types.Decimal128.fromString("2000.00"),
        compareAtPrice: mongoose.Types.Decimal128.fromString("2500.00"),
        isActive: true,
      });

      // Create variant 2 (cheaper): Price 1500, compareAtPrice 2200
      await ProductVariant.create({
        productId: varProduct._id,
        sku: `${varProduct.sku}-V2`,
        price: mongoose.Types.Decimal128.fromString("1500.00"),
        compareAtPrice: mongoose.Types.Decimal128.fromString("2200.00"),
        isActive: true,
      });

      // Trigger synchronization
      await productVariantService.syncParentProductPrice(varProduct._id);

      // Verify parent product adopted lowest variant price (1500) and its compareAtPrice (2200)
      const syncedParent = await Product.findById(varProduct._id);
      expect(Number(syncedParent.price.toString())).toBe(1500);
      expect(Number(syncedParent.compareAtPrice.toString())).toBe(2200);
    });
  });

  // =========================================================================
  // 5. DEFECT C: BULK UPDATE PARENT PRICE SYNCHRONIZATION
  // =========================================================================
  describe("5. Defect C Verification: Bulk price-update synchronization", () => {
    test("synchronizes parent price and compareAtPrice when bulk updating variant prices", async () => {
      const rand = Math.random().toString(36).substring(7);

      const varProduct = await Product.create({
        name: `Bulk Sync Test ${rand}`,
        slug: `bulk-sync-${rand}`,
        sku: `D2-BULK-${rand}`,
        categoryId: testCategory._id,
        vendorId: testVendor._id,
        productType: "variable",
        price: mongoose.Types.Decimal128.fromString("5000.00"),
        compareAtPrice: mongoose.Types.Decimal128.fromString("6000.00"),
      });

      const v1 = await ProductVariant.create({
        productId: varProduct._id,
        sku: `${varProduct.sku}-V1`,
        price: mongoose.Types.Decimal128.fromString("3000.00"),
        compareAtPrice: mongoose.Types.Decimal128.fromString("3500.00"),
        isActive: true,
      });

      const v2 = await ProductVariant.create({
        productId: varProduct._id,
        sku: `${varProduct.sku}-V2`,
        price: mongoose.Types.Decimal128.fromString("4000.00"),
        compareAtPrice: mongoose.Types.Decimal128.fromString("4500.00"),
        isActive: true,
      });

      // Bulk update: Lower V1 price to 1800 and compareAtPrice to 2400
      const bulkPayload = [
        {
          sku: v1.sku,
          price: 1800,
          compareAtPrice: 2400,
        },
      ];

      const bulkResult = await bulkImportExportService.bulkUpdatePricesAndStock({
        updates: bulkPayload,
        vendorId: testVendor._id,
        actor: vendorUser,
      });

      expect(bulkResult.updatedCount).toBe(1);
      expect(bulkResult.failedCount).toBe(0);

      // Verify parent was automatically synchronized by the bulk update flow
      const reloadedParent = await Product.findById(varProduct._id);
      expect(Number(reloadedParent.price.toString())).toBe(1800);
      expect(Number(reloadedParent.compareAtPrice.toString())).toBe(2400);
    });
  });
});
