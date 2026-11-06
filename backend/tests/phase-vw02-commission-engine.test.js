const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../src/app");
const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const Employee = require("../src/models/Employee");
const Category = require("../src/models/Category");
const Brand = require("../src/models/Brand");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Warehouse = require("../src/models/Warehouse");
const Order = require("../src/models/Order");
const ReturnRequest = require("../src/models/ReturnRequest");
const CommissionPolicy = require("../src/models/CommissionPolicy");
const { VendorSettlement } = require("../src/models/VendorSettlement");
const commissionService = require("../src/services/commission.service");
const orderService = require("../src/services/order.service");
const vendorSettlementService = require("../src/services/vendor-settlement.service");
const { ROLES } = require("../src/constants/auth.constants");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { COMMISSION_POLICY_SCOPES, COMMISSION_SOURCES } = require("../src/constants/finance.constants");
const { hashPassword } = require("../src/utils/password");
const {
  generateAccessToken,
  TOKEN_CONTEXTS,
  TOKEN_AUDIENCES,
} = require("../src/services/token.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace(/\/buybox(_test)?(\?|$)/, "/buybox_vw02_test$2")
  : "mongodb://127.0.0.1:27017/buybox_vw02_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Phase VW-02 — Commission Engine & Immutable Order-Time Snapshotting", () => {
  let superadminUser;
  let superadminToken;
  let regularVendorUser;
  let regularVendorDoc;
  let regularVendorToken;
  let customVendorUser;
  let customVendorDoc;
  let testCategory;
  let testBrand;
  let testWarehouse;
  let testProductA;
  let testVariantA;
  let testProductB;
  let testVariantB;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI, { autoIndex: true });
    }

    await CommissionPolicy.deleteMany({});

    const rand = Math.random().toString(36).substring(7);

    // 1. Superadmin User (Respect single active superadmin invariant)
    superadminUser = await User.findOne({ role: ROLES.SUPER_ADMIN, isActive: true });
    if (!superadminUser) {
      superadminUser = await User.create({
        firstName: "Admin",
        lastName: "Super",
        name: `Super Admin ${rand}`,
        email: `superadmin-vw02-${rand}@buybox.test`,
        password: await hashPassword("SuperAdminPass123!"),
        role: ROLES.SUPER_ADMIN,
        roles: [ROLES.SUPER_ADMIN],
        isActive: true,
        isEmailVerified: true,
        permissions: [PERMISSIONS.FINANCE_MANAGE, PERMISSIONS.FINANCE_READ],
      });

      await Employee.create({
        userId: superadminUser._id,
        jobTitle: "Platform Superadmin",
        department: "Finance Operations",
        employeeNumber: `EMP-VW02-${rand.slice(-4).toUpperCase()}`,
        isActive: true,
        status: "active",
      });
    }

    superadminToken = generateAccessToken(
      {
        sub: superadminUser._id.toString(),
        role: ROLES.SUPER_ADMIN,
        roles: [ROLES.SUPER_ADMIN],
        authVersion: 1,
        permissionVersion: 1,
      },
      {
        context: TOKEN_CONTEXTS.ADMINISTRATOR,
        audience: TOKEN_AUDIENCES.ADMINISTRATOR,
      }
    );

    // 2. Regular Vendor (uses standard / category / global rates)
    regularVendorUser = await User.create({
      firstName: "Regular",
      lastName: "Vendor",
      name: `Regular Vendor ${rand}`,
      email: `reg-vendor-vw02-${rand}@buybox.test`,
      password: await hashPassword("VendorPass123!"),
      role: ROLES.VENDOR,
      roles: [ROLES.VENDOR],
      isActive: true,
      isEmailVerified: true,
    });
    regularVendorDoc = await Vendor.create({
      userId: regularVendorUser._id,
      storeName: `RegStore ${rand}`,
      businessName: `Reg Merchant ${rand}`,
      businessSlug: `reg-biz-${rand}`,
      email: regularVendorUser.email,
      phone: "+919876543210",
      isActive: true,
      status: "approved",
      onboardingStatus: "approved",
      commissionRate: mongoose.Types.Decimal128.fromString("0.00"), // no profile agreement
    });
    regularVendorToken = generateAccessToken(
      {
        sub: regularVendorUser._id.toString(),
        role: ROLES.VENDOR,
        roles: [ROLES.VENDOR],
        authVersion: 1,
        permissionVersion: 1,
      },
      {
        context: TOKEN_CONTEXTS.PORTAL,
        audience: TOKEN_AUDIENCES.VENDOR,
      }
    );

    // 3. Custom Vendor with profile agreement (15%)
    customVendorUser = await User.create({
      firstName: "Custom",
      lastName: "Vendor",
      name: `Custom Vendor ${rand}`,
      email: `custom-vendor-vw02-${rand}@buybox.test`,
      password: await hashPassword("VendorPass123!"),
      role: ROLES.VENDOR,
      roles: [ROLES.VENDOR],
      isActive: true,
      isEmailVerified: true,
    });
    customVendorDoc = await Vendor.create({
      userId: customVendorUser._id,
      storeName: `CustomStore ${rand}`,
      businessName: `Custom Merchant ${rand}`,
      businessSlug: `custom-biz-${rand}`,
      email: customVendorUser.email,
      phone: "+919876543211",
      isActive: true,
      status: "approved",
      onboardingStatus: "approved",
      commissionRate: mongoose.Types.Decimal128.fromString("0.15"), // 15% custom profile agreement
    });

    // 4. Category & Catalog Setup
    testCategory = await Category.create({
      name: `Electronics ${rand}`,
      slug: `electronics-${rand}`,
      isActive: true,
    });

    testBrand = await Brand.create({
      name: `BrandX ${rand}`,
      slug: `brandx-${rand}`,
      isActive: true,
    });

    testWarehouse = await Warehouse.create({
      name: `VW02 Hub ${rand}`,
      code: `WH-VW02-${rand}`.toUpperCase(),
      address: {
        addressLine1: "100 Logistics Hub",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "IN",
      },
      isActive: true,
    });

    testProductA = await Product.create({
      name: `Flagship Headphones ${rand}`,
      slug: `headphones-${rand}`,
      sku: `SKU-HP-ROOT-${rand}`.toUpperCase(),
      price: mongoose.Types.Decimal128.fromString("1000.00"),
      brandId: testBrand._id,
      categoryId: testCategory._id,
      vendorId: regularVendorDoc._id,
      status: "active",
      isActive: true,
    });

    testVariantA = await ProductVariant.create({
      productId: testProductA._id,
      sku: `SKU-HP-${rand}`.toUpperCase(),
      price: mongoose.Types.Decimal128.fromString("1000.00"),
      stock: 100,
      isActive: true,
    });

    testProductB = await Product.create({
      name: `Wireless Mouse ${rand}`,
      slug: `mouse-${rand}`,
      sku: `SKU-MS-ROOT-${rand}`.toUpperCase(),
      price: mongoose.Types.Decimal128.fromString("500.00"),
      brandId: testBrand._id,
      categoryId: testCategory._id,
      vendorId: regularVendorDoc._id,
      status: "active",
      isActive: true,
    });

    testVariantB = await ProductVariant.create({
      productId: testProductB._id,
      sku: `SKU-MS-${rand}`.toUpperCase(),
      price: mongoose.Types.Decimal128.fromString("500.00"),
      stock: 100,
      isActive: true,
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe("1. Centralized Commission Policy Management (CRUD & Validation)", () => {
    it("1.1 Superadmin can create a Global commission policy (e.g. 10%)", async () => {
      const res = await request(app)
        .post("/api/v1/finance/commission-policies")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          name: "Global Default 10%",
          description: "Marketplace base rate",
          scope: COMMISSION_POLICY_SCOPES.GLOBAL,
          rate: 0.10,
          notes: "Approved platform base rate",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.scope).toBe(COMMISSION_POLICY_SCOPES.GLOBAL);
      expect(res.body.data.percentage).toBe(10);
      expect(res.body.data.priority).toBe(10);
      expect(res.body.data.version).toBe(1);
    });

    it("1.2 Superadmin can create a Category commission policy (e.g. 12% for Electronics)", async () => {
      const res = await request(app)
        .post("/api/v1/finance/commission-policies")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          name: "Electronics Category 12%",
          scope: COMMISSION_POLICY_SCOPES.CATEGORY,
          categoryId: testCategory._id.toString(),
          rate: 0.12,
          percentage: 12.0,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.scope).toBe(COMMISSION_POLICY_SCOPES.CATEGORY);
      expect(res.body.data.categoryId).toBe(testCategory._id.toString());
      expect(res.body.data.priority).toBe(20);
    });

    it("1.3 Superadmin can create a Vendor agreement policy (e.g. 8% negotiated rate)", async () => {
      const res = await request(app)
        .post("/api/v1/finance/commission-policies")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          name: "Regular Vendor Negotiated 8%",
          scope: COMMISSION_POLICY_SCOPES.VENDOR,
          vendorId: regularVendorDoc._id.toString(),
          rate: 0.08,
          percentage: 8.0,
          notes: "Annual volume tier agreement",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.scope).toBe(COMMISSION_POLICY_SCOPES.VENDOR);
      expect(res.body.data.priority).toBe(30);
    });

    it("1.4 Superadmin can create a Product override policy (e.g. 5% promotional override for ProductA)", async () => {
      const res = await request(app)
        .post("/api/v1/finance/commission-policies")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          name: "Flagship Headphones Special 5%",
          scope: COMMISSION_POLICY_SCOPES.PRODUCT,
          productId: testProductA._id.toString(),
          rate: 0.05,
          percentage: 5.0,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.scope).toBe(COMMISSION_POLICY_SCOPES.PRODUCT);
      expect(res.body.data.priority).toBe(40);
    });

    it("1.5 Rejects invalid commission rates (< 0 or > 1.0)", async () => {
      const negativeRes = await request(app)
        .post("/api/v1/finance/commission-policies")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          name: "Invalid Negative",
          scope: COMMISSION_POLICY_SCOPES.GLOBAL,
          rate: -0.05,
        });
      expect(negativeRes.status).toBe(400);

      const tooHighRes = await request(app)
        .post("/api/v1/finance/commission-policies")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          name: "Invalid Too High",
          scope: COMMISSION_POLICY_SCOPES.GLOBAL,
          rate: 1.50,
        });
      expect(tooHighRes.status).toBe(400);
    });

    it("1.6 Rejects missing required target ID for scoped policy", async () => {
      const res = await request(app)
        .post("/api/v1/finance/commission-policies")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          name: "Missing Target",
          scope: COMMISSION_POLICY_SCOPES.CATEGORY,
          rate: 0.15,
        });
      expect(res.status).toBe(422);
      expect(res.body.code || res.body.errorCode).toBe("CATEGORY_ID_REQUIRED");
    });

    it("1.7 Prevents conflicting active policies covering the same target simultaneously", async () => {
      const res = await request(app)
        .post("/api/v1/finance/commission-policies")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          name: "Duplicate Product Override",
          scope: COMMISSION_POLICY_SCOPES.PRODUCT,
          productId: testProductA._id.toString(),
          rate: 0.07,
        });
      expect(res.status).toBe(409);
      expect(res.body.code || res.body.errorCode).toBe("COMMISSION_POLICY_CONFLICT");
    });

    it("1.8 Preserves version history when updating policy rate", async () => {
      const productPolicy = await CommissionPolicy.findOne({
        scope: COMMISSION_POLICY_SCOPES.PRODUCT,
        productId: testProductA._id,
      });

      const res = await request(app)
        .put(`/api/v1/finance/commission-policies/${productPolicy._id}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          rate: 0.06,
          percentage: 6.0,
          notes: "Updated override rate to 6%",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.version).toBe(2);
      expect(res.body.data.percentage).toBe(6);
      expect(res.body.data.versionHistory.length).toBe(2);
      expect(res.body.data.versionHistory[0].version).toBe(1);
    });

    it("1.9 Unauthorized users (vendors or non-admin) cannot manage commission policies", async () => {
      const res = await request(app)
        .post("/api/v1/finance/commission-policies")
        .set("Authorization", `Bearer ${regularVendorToken}`)
        .send({
          name: "Illegal Vendor Policy",
          scope: COMMISSION_POLICY_SCOPES.GLOBAL,
          rate: 0.01,
        });
      expect(res.status).toBe(403);
    });
  });

  describe("2. Precedence Hierarchy Resolution", () => {
    it("2.1 Priority 1: Product override wins over vendor, category, and global", async () => {
      const resolved = await commissionService.resolveCommissionPolicy({
        productId: testProductA._id,
        vendorId: regularVendorDoc._id,
        categoryId: testCategory._id,
      });

      expect(resolved.source).toBe(COMMISSION_SOURCES.PRODUCT);
      expect(Number(resolved.rate.toString())).toBe(0.06); // 6% product override
      expect(resolved.priority).toBe(40);
    });

    it("2.2 Priority 2: Vendor agreement policy wins over category and global when no product override exists", async () => {
      const resolved = await commissionService.resolveCommissionPolicy({
        productId: testProductB._id, // Product B has no product override
        vendorId: regularVendorDoc._id, // Has 8% vendor policy
        categoryId: testCategory._id,
      });

      expect(resolved.source).toBe(COMMISSION_SOURCES.VENDOR);
      expect(Number(resolved.rate.toString())).toBe(0.08); // 8% vendor agreement
      expect(resolved.priority).toBe(30);
    });

    it("2.3 Priority 2b: Vendor profile agreement (vendor.commissionRate) is honored if no vendor policy exists", async () => {
      const resolved = await commissionService.resolveCommissionPolicy({
        productId: testProductB._id,
        vendorId: customVendorDoc._id, // Has 0.15 (15%) on vendor.commissionRate
        categoryId: testCategory._id,
      });

      expect(resolved.source).toBe(COMMISSION_SOURCES.VENDOR_PROFILE);
      expect(Number(resolved.rate.toString())).toBe(0.15); // 15% vendor profile agreement honored
      expect(resolved.priority).toBe(30);
    });

    it("2.4 Priority 3: Category rule applies when vendor has no agreement and product has no override", async () => {
      // Create a third vendor with 0 commission rate and no policy
      const rand = Math.random().toString(36).substring(7);
      const neutralVendor = await Vendor.create({
        userId: new mongoose.Types.ObjectId(),
        storeName: `Neutral Store ${rand}`,
        businessName: `Neutral Merchant ${rand}`,
        businessSlug: `neutral-${rand}`,
        isActive: true,
        onboardingStatus: "approved",
        commissionRate: mongoose.Types.Decimal128.fromString("0.00"),
      });

      const resolved = await commissionService.resolveCommissionPolicy({
        productId: testProductB._id,
        vendorId: neutralVendor._id,
        categoryId: testCategory._id, // Electronics has 12%
      });

      expect(resolved.source).toBe(COMMISSION_SOURCES.CATEGORY);
      expect(Number(resolved.rate.toString())).toBe(0.12); // 12% category rule
      expect(resolved.priority).toBe(20);
    });

    it("2.5 Priority 4: Global default policy applies when category, vendor, and product have no rules", async () => {
      const rand = Math.random().toString(36).substring(7);
      const otherCat = await Category.create({ name: `Other ${rand}`, slug: `other-${rand}`, isActive: true });
      const otherVendor = await Vendor.create({
        userId: new mongoose.Types.ObjectId(),
        storeName: `Other Store ${rand}`,
        businessName: `Other Merchant ${rand}`,
        businessSlug: `other-${rand}`,
        isActive: true,
        onboardingStatus: "approved",
        commissionRate: mongoose.Types.Decimal128.fromString("0.00"),
      });

      const resolved = await commissionService.resolveCommissionPolicy({
        productId: new mongoose.Types.ObjectId(),
        vendorId: otherVendor._id,
        categoryId: otherCat._id,
      });

      expect(resolved.source).toBe(COMMISSION_SOURCES.GLOBAL);
      expect(Number(resolved.rate.toString())).toBe(0.10); // 10% global default
      expect(resolved.priority).toBe(10);
    });
  });

  describe("3. Order-Time Snapshot Creation & Payment Capture Locking", () => {
    let testOrder;

    it("3.1 Order creation generates preliminary commission preview with isLocked: false", async () => {
      const orderItems = [
        {
          productId: testProductA._id,
          productVariantId: testVariantA._id,
          vendorId: regularVendorDoc._id,
          categoryId: testCategory._id,
          sku: testVariantA.sku,
          productName: testProductA.name,
          quantity: 2,
          unitPrice: mongoose.Types.Decimal128.fromString("1000.00"),
          lineTotal: mongoose.Types.Decimal128.fromString("2000.00"),
          discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
          taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
          currency: "INR",
          fulfillmentStatus: "unfulfilled",
          inventoryStatus: "reserved",
        },
      ];

      const previewItems = await commissionService.computeOrderItemsCommissionPreview({
        orderItems,
      });

      expect(previewItems[0].commissionSnapshot).toBeDefined();
      expect(previewItems[0].commissionSnapshot.isLocked).toBe(false);
      expect(Number(previewItems[0].commissionSnapshot.commissionRate.toString())).toBe(0.06);
      expect(Number(previewItems[0].commissionSnapshot.calculationBase.toString())).toBe(2000.00);
      expect(Number(previewItems[0].commissionSnapshot.commissionAmount.toString())).toBe(120.00); // 6% of 2000 = 120
      expect(Number(previewItems[0].commissionSnapshot.vendorNetEntitlement.toString())).toBe(1880.00);

      // Create actual Order document
      testOrder = await Order.create({
        orderNumber: `ORD-VW02-${Date.now()}`,
        customerId: new mongoose.Types.ObjectId(),
        status: "pending",
        paymentStatus: "pending",
        currency: "INR",
        items: previewItems,
        subtotal: mongoose.Types.Decimal128.fromString("2000.00"),
        grandTotal: mongoose.Types.Decimal128.fromString("2000.00"),
        shippingAddress: {
          fullName: "Customer Test",
          addressLine1: "123 Test Road",
          city: "Bengaluru",
          state: "Karnataka",
          postalCode: "560001",
          country: "IN",
          phone: "9876543210",
        },
      });

      expect(testOrder.items[0].commissionSnapshot.isLocked).toBe(false);
    });

    it("3.2 Payment capture permanently locks the commission snapshot (isLocked: true)", async () => {
      await orderService.markOrderPaymentCaptured(testOrder._id);

      const refreshedOrder = await Order.findById(testOrder._id);
      expect(refreshedOrder.paymentStatus).toBe("paid");
      expect(refreshedOrder.status).toBe("confirmed");

      const itemSnapshot = refreshedOrder.items[0].commissionSnapshot;
      expect(itemSnapshot.isLocked).toBe(true);
      expect(itemSnapshot.calculatedAt).toBeDefined();
      expect(Number(itemSnapshot.commissionRate.toString())).toBe(0.06);
      expect(Number(itemSnapshot.commissionAmount.toString())).toBe(120.00);
      expect(Number(itemSnapshot.vendorNetEntitlement.toString())).toBe(1880.00);
    });

    it("3.3 Historical Immutability: Subsequent rate changes DO NOT alter the stored order snapshot", async () => {
      // Modify product override policy from 6% to 25%
      const productPolicy = await CommissionPolicy.findOne({
        scope: COMMISSION_POLICY_SCOPES.PRODUCT,
        productId: testProductA._id,
      });

      await commissionService.updatePolicy(productPolicy._id, {
        rate: 0.25,
        percentage: 25.0,
        notes: "Major rate hike to 25%",
        actorId: superadminUser._id,
      });

      // Also change vendor's profile agreement
      regularVendorDoc.commissionRate = mongoose.Types.Decimal128.fromString("0.30");
      await regularVendorDoc.save();

      // Lock method executed again (idempotent path)
      const refreshedOrder = await Order.findById(testOrder._id);
      await commissionService.lockOrderItemsCommissionSnapshot(refreshedOrder);

      const lockedSnapshot = refreshedOrder.items[0].commissionSnapshot;
      expect(lockedSnapshot.isLocked).toBe(true);
      // Original 6% rate and ₹120 amount MUST remain 100% intact!
      expect(Number(lockedSnapshot.commissionRate.toString())).toBe(0.06);
      expect(Number(lockedSnapshot.commissionAmount.toString())).toBe(120.00);
      expect(Number(lockedSnapshot.vendorNetEntitlement.toString())).toBe(1880.00);
    });
  });

  describe("4. Financial Precision & Exact Reconciliation", () => {
    it("4.1 Handles fractional commission rates (e.g. 12.375%) with zero floating-point drift", async () => {
      const item = {
        productId: new mongoose.Types.ObjectId(),
        vendorId: new mongoose.Types.ObjectId(),
        lineTotal: mongoose.Types.Decimal128.fromString("1337.50"),
        discountTotal: mongoose.Types.Decimal128.fromString("37.50"),
        currency: "INR",
      };

      const resolvedPolicy = {
        policyId: new mongoose.Types.ObjectId(),
        policyVersion: 1,
        policyName: "Fractional Rate 12.375%",
        source: COMMISSION_SOURCES.GLOBAL,
        rate: mongoose.Types.Decimal128.fromString("0.12375"),
        percentage: 12.375,
      };

      const snapshot = await commissionService.calculateItemCommission({
        item,
        resolvedPolicy,
      });

      const base = Number(snapshot.calculationBase.toString()); // 1337.50 - 37.50 = 1300.00
      const commission = Number(snapshot.commissionAmount.toString()); // round(130000 * 0.12375) / 100 = 160.88
      const vendorNet = Number(snapshot.vendorNetEntitlement.toString()); // 1300.00 - 160.88 = 1139.12

      expect(base).toBe(1300.00);
      expect(commission).toBe(160.88);
      expect(vendorNet).toBe(1139.12);

      // Exact mathematical invariant: commission + vendorNet === base
      const sumMinor = Math.round(commission * 100) + Math.round(vendorNet * 100);
      const baseMinor = Math.round(base * 100);
      expect(sumMinor).toBe(baseMinor);
    });
  });

  describe("5. Settlement Integration with Immutable Snapshots", () => {
    it("5.1 Settlement calculation consumes stored immutable snapshots rather than current dynamic rates", async () => {
      const rand = Math.random().toString(36).substring(7);

      const vendor = await Vendor.create({
        userId: new mongoose.Types.ObjectId(),
        storeName: `Snapshot Vendor ${rand}`,
        businessName: `Snapshot Merchant ${rand}`,
        businessSlug: `snap-biz-${rand}`,
        isActive: true,
        onboardingStatus: "approved",
        commissionRate: mongoose.Types.Decimal128.fromString("0.10"), // Originally 10%
      });

      // Create an order delivered 8 days ago (eligible for settlement)
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

      const orderItem = {
        productId: new mongoose.Types.ObjectId(),
        productVariantId: new mongoose.Types.ObjectId(),
        sku: `SKU-SNAP-${rand}`.toUpperCase(),
        vendorId: vendor._id,
        productName: "Test Item with 10% Snapshot",
        quantity: 1,
        unitPrice: mongoose.Types.Decimal128.fromString("5000.00"),
        lineTotal: mongoose.Types.Decimal128.fromString("5000.00"),
        discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
        taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
        currency: "INR",
        fulfillmentStatus: "delivered",
        inventoryStatus: "deducted",
        commissionRate: mongoose.Types.Decimal128.fromString("0.10"),
        commissionAmount: mongoose.Types.Decimal128.fromString("500.00"),
        commissionSnapshot: {
          policyId: null,
          policyVersion: 1,
          policyName: "Initial 10% Agreement",
          source: "vendor_profile",
          commissionRate: mongoose.Types.Decimal128.fromString("0.10"),
          commissionPercentage: 10.0,
          calculationBase: mongoose.Types.Decimal128.fromString("5000.00"),
          commissionAmount: mongoose.Types.Decimal128.fromString("500.00"),
          vendorNetEntitlement: mongoose.Types.Decimal128.fromString("4500.00"),
          currency: "INR",
          calculatedAt: eightDaysAgo,
          calculationVersion: 1,
          isLocked: true,
        },
      };

      await Order.create({
        orderNumber: `ORD-SNAP-${rand}`.toUpperCase(),
        customerId: new mongoose.Types.ObjectId(),
        status: "delivered",
        paymentStatus: "paid",
        deliveredAt: eightDaysAgo,
        currency: "INR",
        items: [orderItem],
        subtotal: mongoose.Types.Decimal128.fromString("5000.00"),
        grandTotal: mongoose.Types.Decimal128.fromString("5000.00"),
        shippingAddress: {
          fullName: "Buyer Test",
          addressLine1: "123 Street",
          city: "Bengaluru",
          state: "Karnataka",
          postalCode: "560001",
          country: "IN",
          phone: "9876543210",
        },
      });

      // NOW: Change the vendor's commissionRate from 10% to 30% today!
      vendor.commissionRate = mongoose.Types.Decimal128.fromString("0.30");
      await vendor.save();

      // Run settlement calculation
      const settlementCalc = await vendorSettlementService.calculateVendorEligibleSettlement({
        vendorId: vendor._id,
      });

      expect(settlementCalc.hasItemSnapshots).toBe(true);
      expect(settlementCalc.grossSales).toBe(5000.00);
      // The settlement commission MUST read the stored 10% snapshot (₹500.00), NOT today's 30% (₹1500.00)!
      expect(settlementCalc.platformCommission).toBe(500.00);
      expect(settlementCalc.netPayable).toBe(4500.00);
    });

    it("5.2 Legacy orders without snapshots calculate gracefully using vendor rate or legacy fallback", async () => {
      const rand = Math.random().toString(36).substring(7);

      const vendor = await Vendor.create({
        userId: new mongoose.Types.ObjectId(),
        storeName: `Legacy Vendor ${rand}`,
        businessName: `Legacy Merchant ${rand}`,
        businessSlug: `leg-biz-${rand}`,
        isActive: true,
        onboardingStatus: "approved",
        commissionRate: mongoose.Types.Decimal128.fromString("0.15"), // 15%
      });

      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

      // Legacy order with NO commissionSnapshot and NO commissionAmount
      const legacyItem = {
        productId: new mongoose.Types.ObjectId(),
        productVariantId: new mongoose.Types.ObjectId(),
        sku: `SKU-LEG-${rand}`.toUpperCase(),
        vendorId: vendor._id,
        productName: "Legacy Pre-VW02 Item",
        quantity: 1,
        unitPrice: mongoose.Types.Decimal128.fromString("2000.00"),
        lineTotal: mongoose.Types.Decimal128.fromString("2000.00"),
        discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
        taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
        currency: "INR",
        fulfillmentStatus: "delivered",
        inventoryStatus: "deducted",
      };

      await Order.create({
        orderNumber: `ORD-LEG-${rand}`.toUpperCase(),
        customerId: new mongoose.Types.ObjectId(),
        status: "delivered",
        paymentStatus: "paid",
        deliveredAt: eightDaysAgo,
        currency: "INR",
        items: [legacyItem],
        subtotal: mongoose.Types.Decimal128.fromString("2000.00"),
        grandTotal: mongoose.Types.Decimal128.fromString("2000.00"),
        shippingAddress: {
          fullName: "Buyer Test",
          addressLine1: "123 Street",
          city: "Bengaluru",
          state: "Karnataka",
          postalCode: "560001",
          country: "IN",
          phone: "9876543210",
        },
      });

      const settlementCalc = await vendorSettlementService.calculateVendorEligibleSettlement({
        vendorId: vendor._id,
      });

      expect(settlementCalc.hasItemSnapshots).toBe(false);
      expect(settlementCalc.grossSales).toBe(2000.00);
      expect(settlementCalc.platformCommission).toBe(300.00); // 15% of 2000 = 300
      expect(settlementCalc.netPayable).toBe(1700.00);
    });
  });

  describe("6. Refund & Commission Reversal Foundations", () => {
    it("6.1 Calculates exact proportional commission reversal for item returns", async () => {
      const orderItem = {
        orderId: new mongoose.Types.ObjectId(),
        _id: new mongoose.Types.ObjectId(),
        unitPrice: mongoose.Types.Decimal128.fromString("1000.00"),
        commissionSnapshot: {
          policyId: new mongoose.Types.ObjectId(),
          commissionRate: mongoose.Types.Decimal128.fromString("0.12"), // 12% rate
        },
      };

      // Return 1 unit with refundAmount = ₹1000.00
      const reversal = commissionService.calculateCommissionReversal({
        orderItem,
        refundedQuantity: 1,
        refundedAmount: "1000.00",
      });

      expect(Number(reversal.appliedRate.toString())).toBe(0.12);
      expect(Number(reversal.refundAmount.toString())).toBe(1000.00);
      expect(Number(reversal.reversedCommissionAmount.toString())).toBe(120.00); // 12% of 1000 = 120
      expect(Number(reversal.vendorNetAdjustment.toString())).toBe(880.00); // Net debit against vendor = 880

      // Invariant: reversedCommission + vendorNetAdjustment === refundAmount
      const sumMinor = Math.round(Number(reversal.reversedCommissionAmount.toString()) * 100) +
                       Math.round(Number(reversal.vendorNetAdjustment.toString()) * 100);
      const refundMinor = Math.round(Number(reversal.refundAmount.toString()) * 100);
      expect(sumMinor).toBe(refundMinor);
    });
  });
});
