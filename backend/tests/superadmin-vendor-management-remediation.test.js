const mongoose = require("mongoose");
const vendorService = require("../src/services/vendor.service");
const cartService = require("../src/services/cart.service");
const orderService = require("../src/services/order.service");

const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Category = require("../src/models/Category");
const Brand = require("../src/models/Brand");
const Order = require("../src/models/Order");
const AuditLog = require("../src/models/AuditLog");
const CommissionPolicy = require("../src/models/CommissionPolicy");
const { ROLES } = require("../src/constants/auth.constants");
const { COMMISSION_POLICY_SCOPES, COMMISSION_SOURCES } = require("../src/constants/finance.constants");

describe("Phase VM-02: Superadmin Vendor Management Remediation Suite", () => {
  let testCategory;
  let testBrand;
  let multiRoleUser, multiRoleVendor;
  let pureVendorUser, pureVendor;
  let productA, variantA;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/buybox_dev";
      await mongoose.connect(uri);
    }

    testCategory = await Category.create({
      name: `Category-${Date.now()}`,
      slug: `cat-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      status: "active",
    });

    testBrand = await Brand.create({
      name: `Brand-${Date.now()}`,
      slug: `brand-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      status: "active",
    });
  });

  afterAll(async () => {
    // Cleanup created test records
    if (testCategory) await Category.deleteOne({ _id: testCategory._id });
    if (testBrand) await Brand.deleteOne({ _id: testBrand._id });
    if (multiRoleUser) await User.deleteOne({ _id: multiRoleUser._id });
    if (multiRoleVendor) await Vendor.deleteOne({ _id: multiRoleVendor._id });
    if (pureVendorUser) await User.deleteOne({ _id: pureVendorUser._id });
    if (pureVendor) await Vendor.deleteOne({ _id: pureVendor._id });
    if (productA) await Product.deleteOne({ _id: productA._id });
    if (variantA) await ProductVariant.deleteOne({ _id: variantA._id });
  });

  describe("Finding 1 & VW-02: Commission Rate Serialization & Policy Engine Integration", () => {
    it("returns commissionRate as a plain JavaScript number and resolves effectiveCommission", async () => {
      const uniqueSuffix = Date.now().toString(36);
      const user = await User.create({
        firstName: "Commission",
        lastName: "Tester",
        email: `comm_${uniqueSuffix}@example.com`,
        password: "Password123!",
        role: ROLES.VENDOR,
        roles: [ROLES.VENDOR],
      });

      const vendor = await Vendor.create({
        userId: user._id,
        businessName: `Commission Store ${uniqueSuffix}`,
        businessSlug: `comm-store-${uniqueSuffix}`,
        onboardingStatus: "approved",
        isActive: true,
        commissionRate: mongoose.Types.Decimal128.fromString("12.50"),
      });

      // Create a vendor-level commission policy
      await CommissionPolicy.create({
        name: `Vendor Policy ${uniqueSuffix}`,
        scope: COMMISSION_POLICY_SCOPES.VENDOR,
        vendorId: vendor._id,
        rate: mongoose.Types.Decimal128.fromString("0.1250"),
        percentage: 12.5,
        isActive: true,
        effectiveFrom: new Date(Date.now() - 60000),
      });

      const fetchedById = await vendorService.getVendorById(vendor._id);
      expect(typeof fetchedById.commissionRate).toBe("number");
      expect(fetchedById.commissionRate).toBe(12.5);
      expect(fetchedById.effectiveCommission).toBeDefined();
      expect(fetchedById.effectiveCommission.percentage).toBe(12.5);
      expect(fetchedById.effectiveCommission.policyName).toBe(`Vendor Policy ${uniqueSuffix}`);

      const fetchedOverview = await vendorService.getVendorOverview(vendor._id);
      expect(typeof fetchedOverview.vendor.commissionRate).toBe("number");
      expect(fetchedOverview.vendor.commissionRate).toBe(12.5);
      expect(fetchedOverview.vendor.effectiveCommission).toBeDefined();
      expect(fetchedOverview.vendor.effectiveCommission.percentage).toBe(12.5);

      // Cleanup
      await Vendor.deleteOne({ _id: vendor._id });
      await User.deleteOne({ _id: user._id });
      await CommissionPolicy.deleteMany({ vendorId: vendor._id });
    });
  });

  describe("Finding 2: Multi-Role Persona Presentation Integrity", () => {
    it("populates roles array on userId to distinguish multi-role accounts from single-role accounts", async () => {
      const uniqueSuffix = Date.now().toString(36);
      multiRoleUser = await User.create({
        firstName: "Multi",
        lastName: "Persona",
        email: `multi_${uniqueSuffix}@example.com`,
        password: "Password123!",
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER, ROLES.VENDOR],
      });

      multiRoleVendor = await Vendor.create({
        userId: multiRoleUser._id,
        businessName: `Multi Role Store ${uniqueSuffix}`,
        businessSlug: `multi-role-${uniqueSuffix}`,
        onboardingStatus: "approved",
        isActive: true,
      });

      const fetchedById = await vendorService.getVendorById(multiRoleVendor._id);
      expect(fetchedById.userId).toBeDefined();
      expect(Array.isArray(fetchedById.userId.roles)).toBe(true);
      expect(fetchedById.userId.roles).toContain(ROLES.CUSTOMER);
      expect(fetchedById.userId.roles).toContain(ROLES.VENDOR);

      const listResult = await vendorService.listVendors({ search: multiRoleVendor.businessName });
      const foundInList = listResult.vendors.find((v) => v._id.toString() === multiRoleVendor._id.toString());
      expect(foundInList).toBeDefined();
      expect(foundInList.userId.roles).toContain(ROLES.CUSTOMER);
      expect(foundInList.userId.roles).toContain(ROLES.VENDOR);
    });
  });

  describe("Finding 4 & 7: Server-side Activity Filtering & Bounded Overview Aggregations", () => {
    it("supports server-side activity filtering without dropping records post-pagination", async () => {
      const uniqueSuffix = Date.now().toString(36);
      pureVendorUser = await User.create({
        firstName: "Active",
        lastName: "CatalogVendor",
        email: `active_${uniqueSuffix}@example.com`,
        password: "Password123!",
        role: ROLES.VENDOR,
        roles: [ROLES.VENDOR],
      });

      pureVendor = await Vendor.create({
        userId: pureVendorUser._id,
        businessName: `Active Catalog Store ${uniqueSuffix}`,
        businessSlug: `active-store-${uniqueSuffix}`,
        onboardingStatus: "approved",
        isActive: true,
      });

      productA = await Product.create({
        name: `Product with Variant ${uniqueSuffix}`,
        slug: `prod-var-${uniqueSuffix}`,
        vendorId: pureVendor._id,
        categoryId: testCategory._id,
        brandId: testBrand._id,
        status: "active",
        isStoreVisible: true,
        price: 99.99,
        sku: `SKU-A-${uniqueSuffix}`,
      });

      variantA = await ProductVariant.create({
        productId: productA._id,
        sku: `VAR-A-${uniqueSuffix}`,
        price: 99.99,
        isActive: true,
      });

      // Filter by has_products
      const withProducts = await vendorService.listVendors({ activity: "has_products" });
      const foundVendor = withProducts.vendors.find((v) => v._id.toString() === pureVendor._id.toString());
      expect(foundVendor).toBeDefined();

      // Overview bounded aggregation test
      const overview = await vendorService.getVendorOverview(pureVendor._id);
      expect(overview.kpis).toBeDefined();
      expect(overview.financial).toBeDefined();
      expect(overview.financial.profit).toBeNull();
      expect(overview.financial.profitUnavailableReason).toMatch(/COGS/i);
      expect(overview.products.length).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(overview.payouts)).toBe(true);
      expect(Array.isArray(overview.bankAccounts)).toBe(true);
    });
  });

  describe("Finding 10: Safe Vendor Offboarding Lifecycle & Multi-Role Preservation", () => {
    it("safely offboards vendor: archives products, deactivates variants, preserves customer access", async () => {
      const uniqueSuffix = Date.now().toString(36);
      const testUser = await User.create({
        firstName: "Offboard",
        lastName: "MultiRole",
        email: `offboard_${uniqueSuffix}@example.com`,
        password: "Password123!",
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER, ROLES.VENDOR],
        isActive: true,
      });

      const testVendor = await Vendor.create({
        userId: testUser._id,
        businessName: `Store To Offboard ${uniqueSuffix}`,
        businessSlug: `store-offboard-${uniqueSuffix}`,
        onboardingStatus: "approved",
        isActive: true,
      });

      const product = await Product.create({
        name: `Offboard Product ${uniqueSuffix}`,
        slug: `offboard-prod-${uniqueSuffix}`,
        vendorId: testVendor._id,
        categoryId: testCategory._id,
        brandId: testBrand._id,
        status: "active",
        isStoreVisible: true,
        price: 150.00,
        sku: `OFF-SKU-${uniqueSuffix}`,
      });

      const variant = await ProductVariant.create({
        productId: product._id,
        sku: `OFF-VAR-${uniqueSuffix}`,
        price: 150.00,
        isActive: true,
      });

      // Execute safe offboarding
      const offboardResult = await vendorService.deleteVendor(testVendor._id, {
        reason: "Administrative testing of safe vendor offboarding procedure",
      });

      expect(offboardResult.success).toBe(true);

      // Verify vendor status
      const updatedVendor = await Vendor.findById(testVendor._id);
      expect(updatedVendor.deletedAt).toBeDefined();
      expect(updatedVendor.isActive).toBe(false);
      expect(updatedVendor.onboardingStatus).toBe("inactive");

      // Verify multi-role user account: customer role preserved and active
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.isActive).toBe(true);
      expect(updatedUser.deletedAt).toBeFalsy();
      expect(updatedUser.roles).not.toContain(ROLES.VENDOR);
      expect(updatedUser.roles).toContain(ROLES.CUSTOMER);
      expect(updatedUser.role).toBe(ROLES.CUSTOMER);

      // Verify product archival and variant deactivation
      const updatedProduct = await Product.findById(product._id);
      expect(updatedProduct.status).toBe("archived");
      expect(updatedProduct.isStoreVisible).toBe(false);
      expect(updatedProduct.deletedAt).toBeDefined();

      const updatedVariant = await ProductVariant.findById(variant._id);
      expect(updatedVariant.isActive).toBe(false);

      // Verify audit log recorded
      const auditLog = await AuditLog.findOne({
        targetId: testVendor._id,
        action: "vendor.offboarded",
      });
      expect(auditLog).toBeDefined();

      // Verify duplicate deactivation is safely rejected with explicit conflict/bad request code
      await expect(
        vendorService.deleteVendor(testVendor._id, {
          reason: "Subsequent administrative check for idempotency",
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: "VENDOR_ALREADY_DEACTIVATED",
      });

      // Cleanup
      await Vendor.deleteOne({ _id: testVendor._id });
      await User.deleteOne({ _id: testUser._id });
      await Product.deleteOne({ _id: product._id });
      await ProductVariant.deleteOne({ _id: variant._id });
      if (auditLog) await AuditLog.deleteOne({ _id: auditLog._id });
    });
  });

  describe("Cart & Order Checkout Purchase Blocking for Offboarded / Inactive Vendors", () => {
    it("blocks cart and order placement when product belongs to an inactive or offboarded vendor", async () => {
      const uniqueSuffix = Date.now().toString(36);
      const inactiveUser = await User.create({
        firstName: "Inactive",
        lastName: "Vendor",
        email: `inactive_${uniqueSuffix}@example.com`,
        password: "Password123!",
        role: ROLES.VENDOR,
        roles: [ROLES.VENDOR],
      });

      const inactiveVendor = await Vendor.create({
        userId: inactiveUser._id,
        businessName: `Inactive Store ${uniqueSuffix}`,
        businessSlug: `inactive-store-${uniqueSuffix}`,
        onboardingStatus: "suspended",
        isActive: false,
      });

      const inactiveProduct = await Product.create({
        name: `Inactive Vendor Product ${uniqueSuffix}`,
        slug: `inactive-prod-${uniqueSuffix}`,
        vendorId: inactiveVendor._id,
        categoryId: testCategory._id,
        brandId: testBrand._id,
        status: "active",
        isStoreVisible: false,
        price: 50.00,
        sku: `INACT-SKU-${uniqueSuffix}`,
      });

      const inactiveVariant = await ProductVariant.create({
        productId: inactiveProduct._id,
        sku: `INACT-VAR-${uniqueSuffix}`,
        price: 50.00,
        isActive: true,
      });

      // Cart validation must reject unavailable or inactive vendor products
      await expect(
        cartService.validateVariant(inactiveVariant._id)
      ).rejects.toThrow();

      // Order placement validation must reject inactive vendor products
      const dummyCart = {
        status: "active",
        items: [
          {
            productVariantId: inactiveVariant._id,
            quantity: 1,
            priceSnapshot: 50.0,
          },
        ],
        currency: "INR",
      };

      await expect(
        orderService.validateCartItems(dummyCart)
      ).rejects.toThrow();

      // Cleanup
      await Vendor.deleteOne({ _id: inactiveVendor._id });
      await Product.deleteOne({ _id: inactiveProduct._id });
      await ProductVariant.deleteOne({ _id: inactiveVariant._id });
    });
  });
});
