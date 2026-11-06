const mongoose = require("mongoose");
const User = require("../src/models/User");
const Customer = require("../src/models/Customer");
const Vendor = require("../src/models/Vendor");
const Category = require("../src/models/Category");
const Brand = require("../src/models/Brand");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Warehouse = require("../src/models/Warehouse");
const Order = require("../src/models/Order");
const ReturnRequest = require("../src/models/ReturnRequest");
const { VendorSettlement } = require("../src/models/VendorSettlement");
const FinancialLedgerEntry = require("../src/models/FinancialLedgerEntry");
const {
  FINANCIAL_ENTRY_TYPES,
  FINANCIAL_ENTRY_DIRECTIONS,
  FINANCIAL_ACCOUNT_TYPES,
} = require("../src/constants/finance.constants");

const vendorSettlementService = require("../src/services/vendor-settlement.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace(/\/buybox(_test)?(\?|$)/, "/buybox_d6_test$2")
  : "mongodb://127.0.0.1:27017/buybox_d6_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Phase D6 — Vendor Settlement & Platform Promotion Subsidy Accounting Integration", () => {
  let testCategory;
  let testBrand;
  let testWarehouse;
  let testVendor;
  let vendorUser;
  let customerUser;
  let customerDoc;
  let productA;
  let variantA;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    const rand = Math.random().toString(36).substring(7);

    testCategory = await Category.create({
      name: `D6 Cat ${rand}`,
      slug: `d6-cat-${rand}`,
      isActive: true,
    });

    testBrand = await Brand.create({
      name: `D6 Brand ${rand}`,
      slug: `d6-brand-${rand}`,
      isActive: true,
    });

    testWarehouse = await Warehouse.create({
      name: `D6 Hub ${rand}`,
      code: `WH-D6-${rand}`.toUpperCase(),
      address: {
        addressLine1: "500 Logistics Park",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "IN",
      },
      isActive: true,
    });

    vendorUser = await User.create({
      firstName: "D6",
      lastName: "Vendor",
      name: `D6 Vendor ${rand}`,
      email: `d6-vendor-${rand}@example.com`,
      password: "Password123!",
      role: "vendor",
      isActive: true,
    });

    testVendor = await Vendor.create({
      userId: vendorUser._id,
      storeName: `D6 Store ${rand}`,
      businessName: `D6 Merchant Pvt Ltd ${rand}`,
      businessSlug: `d6-biz-${rand}`,
      isActive: true,
      onboardingStatus: "approved",
      commissionRate: mongoose.Types.Decimal128.fromString("0.10"),
    });

    customerUser = await User.create({
      firstName: "D6",
      lastName: "Buyer",
      name: `D6 Buyer ${rand}`,
      email: `d6-buyer-${rand}@example.com`,
      password: "Password123!",
      role: "customer",
      isActive: true,
    });

    customerDoc = await Customer.create({
      userId: customerUser._id,
      isActive: true,
    });

    const randProd = Math.random().toString(36).substring(7);
    const prodSku = `D6-SKU-${randProd}`.toUpperCase();

    const productService = require("../src/services/product.service");
    productA = await productService.createProduct({
      data: {
        name: `D6 Product ${randProd}`,
        slug: `d6-product-${randProd}`,
        sku: prodSku,
        categoryId: testCategory._id.toString(),
        brandId: testBrand._id.toString(),
        price: "1000.00",
        compareAtPrice: "1200.00",
        stockQuantity: 100,
        warehouseId: testWarehouse._id.toString(),
        productType: "simple",
      },
      userId: vendorUser._id.toString(),
      actor: vendorUser,
    });

    variantA = await ProductVariant.findOne({ productId: productA._id, isDefault: true });
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await Order.deleteMany({ customerId: customerDoc._id });
      await VendorSettlement.deleteMany({ vendorId: testVendor._id });
      await mongoose.disconnect();
    }
  });

  function createTestOrderDoc({
    orderNumber = `ORD-D6-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    items = [],
    paymentStatus = "paid",
    status = "delivered",
    deliveredAt = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
  }) {
    const defaultAddress = {
      fullName: "D6 Buyer",
      phone: "9876543210",
      addressLine1: "123 High Street",
      city: "Bengaluru",
      state: "Karnataka",
      postalCode: "560001",
      country: "IN",
    };

    const processedItems = items.map((item) => ({
      productId: productA._id,
      productVariantId: variantA._id,
      productName: productA.name,
      sku: variantA.sku,
      vendorId: testVendor._id,
      currency: "INR",
      fulfillmentStatus: "delivered",
      inventoryStatus: "deducted",
      discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
      taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
      ...item,
    }));

    const subtotalNum = processedItems.reduce(
      (sum, item) => sum + Number(item.lineTotal?.toString() || 0),
      0
    );

    return Order.create({
      orderNumber,
      customerId: customerDoc._id,
      shippingAddress: defaultAddress,
      billingAddress: defaultAddress,
      items: processedItems,
      subtotal: mongoose.Types.Decimal128.fromString(subtotalNum.toFixed(2)),
      grandTotal: mongoose.Types.Decimal128.fromString(subtotalNum.toFixed(2)),
      paymentStatus,
      status,
      deliveredAt,
      currency: "INR",
    });
  }

  describe("1. Platform-Funded Promotion Subsidy Calculation", () => {
    let orderPlatform;

    beforeEach(async () => {
      // Clear past orders for test vendor
      await Order.deleteMany({ "items.vendorId": testVendor._id });

      orderPlatform = await createTestOrderDoc({
        items: [
          {
            quantity: 2,
            regularPrice: mongoose.Types.Decimal128.fromString("1000.00"),
            effectivePrice: mongoose.Types.Decimal128.fromString("800.00"),
            unitPrice: mongoose.Types.Decimal128.fromString("800.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("1600.00"),
            isPromotional: true,
            fundingSource: "platform",
            promotionName: "Mega Sale 20% Off",
            promotionDiscountAmount: mongoose.Types.Decimal128.fromString("200.00"),
            promotionDiscountPercentage: 20,
          },
        ],
      });
    });

    test("1.1. calculateVendorEligibleSettlement accurately computes platform subsidy and vendor earnings", async () => {
      const calc = await vendorSettlementService.calculateVendorEligibleSettlement({
        vendorId: testVendor._id,
      });

      expect(calc.grossSales).toBe(1600);
      expect(calc.platformSubsidy).toBe(400);
      expect(calc.discounts).toBe(0);
      expect(calc.refunds).toBe(0);

      // Contractual commission base is regular gross eligible sales: 1600 + 400 = 2000
      // 10% commission on 2000 is 200
      expect(calc.platformCommission).toBe(200);

      // Net payable: 1600 (customer payment) + 400 (platform subsidy) - 200 (commission) = 1800
      expect(calc.netPayable).toBe(1800);
      expect(calc.eligibleOrders.length).toBe(1);
    });

    test("1.2. generateEligibleSettlements creates settlement document with platformSubsidy and balanced FinancialLedger entries", async () => {
      const settlements = await vendorSettlementService.generateEligibleSettlements({
        vendorId: testVendor._id,
      });

      expect(settlements.length).toBe(1);
      const settlement = settlements[0];

      expect(Number(settlement.grossSales.toString())).toBe(1600);
      expect(Number(settlement.platformSubsidy.toString())).toBe(400);
      expect(Number(settlement.platformCommission.toString())).toBe(200);
      expect(Number(settlement.netPayable.toString())).toBe(1800);

      // Verify FinancialLedger entries
      const entries = await FinancialLedgerEntry.find({ settlementId: settlement._id });
      expect(entries.length).toBe(2);

      const vendorCredit = entries.find(
        (e) => e.accountType === FINANCIAL_ACCOUNT_TYPES.VENDOR && e.direction === FINANCIAL_ENTRY_DIRECTIONS.CREDIT
      );
      expect(vendorCredit).toBeDefined();
      expect(vendorCredit.entryType).toBe(FINANCIAL_ENTRY_TYPES.PROMOTION_SUBSIDY);
      expect(Number(vendorCredit.amount.toString())).toBe(400);
      expect(vendorCredit.vendorId.toString()).toBe(testVendor._id.toString());
      expect(vendorCredit.orderId.toString()).toBe(orderPlatform._id.toString());

      const platformDebit = entries.find(
        (e) => e.accountType === FINANCIAL_ACCOUNT_TYPES.PLATFORM && e.direction === FINANCIAL_ENTRY_DIRECTIONS.DEBIT
      );
      expect(platformDebit).toBeDefined();
      expect(platformDebit.entryType).toBe(FINANCIAL_ENTRY_TYPES.PROMOTION_SUBSIDY);
      expect(Number(platformDebit.amount.toString())).toBe(400);

      // Verify order item is tagged with settlementId
      const refreshedOrder = await Order.findById(orderPlatform._id);
      expect(refreshedOrder.items[0].settlementId.toString()).toBe(settlement._id.toString());
    });

    test("1.3. Idempotent re-run does not recreate settlement or duplicate ledger credits", async () => {
      // First run: generates 1 settlement
      const firstRun = await vendorSettlementService.generateEligibleSettlements({
        vendorId: testVendor._id,
      });
      expect(firstRun.length).toBe(1);

      // Re-run settlement generation immediately
      const secondRun = await vendorSettlementService.generateEligibleSettlements({
        vendorId: testVendor._id,
      });

      expect(secondRun.length).toBe(0);

      const allEntries = await FinancialLedgerEntry.find({ orderId: orderPlatform._id });
      expect(allEntries.length).toBe(2); // Only the initial 2 entries exist
    });
  });

  describe("2. Vendor-Funded Promotion Settlement", () => {
    let orderVendorFunded;

    beforeEach(async () => {
      await Order.deleteMany({ "items.vendorId": testVendor._id });

      orderVendorFunded = await createTestOrderDoc({
        items: [
          {
            quantity: 1,
            regularPrice: mongoose.Types.Decimal128.fromString("1000.00"),
            effectivePrice: mongoose.Types.Decimal128.fromString("800.00"),
            unitPrice: mongoose.Types.Decimal128.fromString("800.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("800.00"),
            isPromotional: true,
            fundingSource: "vendor",
            promotionName: "Vendor Clearance 20% Off",
            promotionDiscountAmount: mongoose.Types.Decimal128.fromString("200.00"),
            promotionDiscountPercentage: 20,
          },
        ],
      });
    });

    test("2.1. Vendor bears the discount; zero platform subsidy issued", async () => {
      const calc = await vendorSettlementService.calculateVendorEligibleSettlement({
        vendorId: testVendor._id,
      });

      expect(calc.grossSales).toBe(800);
      expect(calc.platformSubsidy).toBe(0); // No platform subsidy!
      // Commission is 10% of 800 = 80
      expect(calc.platformCommission).toBe(80);
      // Net payable: 800 - 80 = 720
      expect(calc.netPayable).toBe(720);

      const settlements = await vendorSettlementService.generateEligibleSettlements({
        vendorId: testVendor._id,
      });

      expect(settlements.length).toBe(1);
      expect(Number(settlements[0].platformSubsidy.toString())).toBe(0);
      expect(Number(settlements[0].netPayable.toString())).toBe(720);

      // Verify NO subsidy ledger entries created for vendor-funded order
      const entries = await FinancialLedgerEntry.find({ settlementId: settlements[0]._id });
      expect(entries.length).toBe(0);
    });
  });

  describe("3. Ineligible & Unpaid Order Protection", () => {
    beforeEach(async () => {
      await Order.deleteMany({ "items.vendorId": testVendor._id });
    });

    test("3.1. Unpaid or cancelled orders do not generate settlements or subsidies", async () => {
      // Unpaid order
      await createTestOrderDoc({
        items: [
          {
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("800.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("800.00"),
            isPromotional: true,
            fundingSource: "platform",
            promotionDiscountAmount: mongoose.Types.Decimal128.fromString("200.00"),
          },
        ],
        paymentStatus: "failed",
      });

      // Recent order (inside 7-day return window)
      await createTestOrderDoc({
        items: [
          {
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("800.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("800.00"),
            isPromotional: true,
            fundingSource: "platform",
            promotionDiscountAmount: mongoose.Types.Decimal128.fromString("200.00"),
          },
        ],
        paymentStatus: "paid",
        deliveredAt: new Date(), // Just delivered today
      });

      const calc = await vendorSettlementService.calculateVendorEligibleSettlement({
        vendorId: testVendor._id,
      });

      expect(calc.eligibleOrders.length).toBe(0);
      expect(calc.netPayable).toBe(0);
    });
  });

  describe("4. Returns & Partial Refund Subsidy Reversal", () => {
    beforeEach(async () => {
      await Order.deleteMany({ "items.vendorId": testVendor._id });
    });

    test("4.1. Returning a platform-subsidized unit reverses customer payment and platform subsidy proportionally", async () => {
      const orderWithReturn = await createTestOrderDoc({
        items: [
          {
            quantity: 2,
            regularPrice: mongoose.Types.Decimal128.fromString("1000.00"),
            effectivePrice: mongoose.Types.Decimal128.fromString("800.00"),
            unitPrice: mongoose.Types.Decimal128.fromString("800.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("1600.00"),
            isPromotional: true,
            fundingSource: "platform",
            promotionDiscountAmount: mongoose.Types.Decimal128.fromString("200.00"),
          },
        ],
        paymentStatus: "partially_refunded",
      });

      // Customer returned 1 of the 2 units
      await ReturnRequest.create({
        returnNumber: `RET-D6-${Date.now()}`,
        orderId: orderWithReturn._id,
        customerId: customerDoc._id,
        vendorId: testVendor._id,
        status: "refunded",
        items: [
          {
            productId: productA._id,
            productVariantId: variantA._id,
            vendorId: testVendor._id,
            name: productA.name,
            sku: variantA.sku,
            reason: "defective",
            condition: "unopened",
            quantity: 1,
            itemPrice: mongoose.Types.Decimal128.fromString("800.00"),
          },
        ],
      });

      const calc = await vendorSettlementService.calculateVendorEligibleSettlement({
        vendorId: testVendor._id,
      });

      // Gross sales = 1600 (original 2 units)
      expect(calc.grossSales).toBe(1600);
      // Refunds = 800 (1 unit returned)
      expect(calc.refunds).toBe(800);
      // Platform subsidy was 400 (2 * 200), reversed 200 for 1 returned unit = 200 net subsidy
      expect(calc.platformSubsidy).toBe(200);

      // Commission base on retained 1 unit: (1600 - 800) + 200 = 1000
      // 10% commission on 1000 = 100
      expect(calc.platformCommission).toBe(100);

      // Net payable for 1 retained unit: 1600 + 200 - 800 - 100 = 900
      expect(calc.netPayable).toBe(900);
    });
  });

  describe("5. Mixed Promoted and Legacy Orders Compatibility", () => {
    beforeEach(async () => {
      await Order.deleteMany({ "items.vendorId": testVendor._id });
    });

    test("5.1. Legacy order lines without promotion metadata calculate without errors", async () => {
      await createTestOrderDoc({
        items: [
          {
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("1000.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("1000.00"),
            isPromotional: false,
          },
        ],
      });

      const calc = await vendorSettlementService.calculateVendorEligibleSettlement({
        vendorId: testVendor._id,
      });

      expect(calc.grossSales).toBe(1000);
      expect(calc.platformSubsidy).toBe(0);
      expect(calc.platformCommission).toBe(100);
      expect(calc.netPayable).toBe(900);
    });
  });

  describe("6. Promotion Subsidy Observability & Reconciliation Service", () => {
    let reconVendor;
    let reconUser;

    beforeAll(async () => {
      const rand = Math.random().toString(36).substring(7);
      reconUser = await User.create({
        firstName: "Recon",
        lastName: "Vendor",
        name: `Recon Vendor ${rand}`,
        email: `recon-vendor-${rand}@example.com`,
        password: "Password123!",
        role: "vendor",
        isActive: true,
      });

      reconVendor = await Vendor.create({
        userId: reconUser._id,
        storeName: `Recon Store ${rand}`,
        businessName: `Recon Merchant Pvt Ltd ${rand}`,
        businessSlug: `recon-biz-${rand}`,
        isActive: true,
        onboardingStatus: "approved",
        commissionRate: mongoose.Types.Decimal128.fromString("0.10"),
      });
    });

    test("6.1. getPromotionSubsidyReconciliation audits and verifies subsidy ledger invariants", async () => {
      // Create one platform-funded order for reconVendor and settle it
      await createTestOrderDoc({
        items: [
          {
            vendorId: reconVendor._id,
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("800.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("800.00"),
            isPromotional: true,
            fundingSource: "platform",
            promotionDiscountAmount: mongoose.Types.Decimal128.fromString("200.00"),
          },
        ],
      });

      const settlements = await vendorSettlementService.generateEligibleSettlements({
        vendorId: reconVendor._id,
      });

      expect(settlements.length).toBe(1);

      const recon = await vendorSettlementService.getPromotionSubsidyReconciliation({
        vendorId: reconVendor._id.toString(),
      });

      expect(recon.platformDiscountTotal).toBe(200);
      expect(recon.platformSubsidiesSettled).toBe(200);
      expect(recon.subsidyLedgerCredits).toBe(recon.platformSubsidiesSettled);
      expect(recon.reconciliationDifference).toBe(0);
      expect(recon.isReconciled).toBe(true);
    });
  });
});
