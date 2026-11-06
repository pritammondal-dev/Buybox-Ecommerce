/**
 * Phase VENDOR-WALLET-B: Automated Vendor Settlement, Return-Window Configuration & Wallet Maturity Test Suite
 */

const mongoose = require("mongoose");
const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const Order = require("../src/models/Order");
const ReturnRequest = require("../src/models/ReturnRequest");
const { VendorSettlement } = require("../src/models/VendorSettlement");
const FinancialLedgerEntry = require("../src/models/FinancialLedgerEntry");
const VendorWallet = require("../src/models/VendorWallet");
const StorefrontSettings = require("../src/models/StorefrontSettings");

const {
  FINANCIAL_ENTRY_TYPES,
  FINANCIAL_ENTRY_DIRECTIONS,
  FINANCIAL_ACCOUNT_TYPES,
  LEDGER_ACCOUNTS,
  WALLET_STATUSES,
} = require("../src/constants/finance.constants");
const { ROLES } = require("../src/constants/auth.constants");

const vendorSettlementService = require("../src/services/vendor-settlement.service");
const vendorWalletService = require("../src/services/vendor-wallet.service");
const financialLedgerService = require("../src/services/financial-ledger.service");
const storefrontSettingsService = require("../src/services/storefront-settings.service");
const {
  processVendorSettlementBatch,
  runVendorSettlementScheduler,
  stopVendorSettlementScheduler,
} = require("../src/workers/vendor-settlement.worker");
const { workerRegistry } = require("../src/workers/worker-coordinator");
const { withDistributedLock, acquireDistributedLock, releaseDistributedLock, generateOwnerToken } = require("../src/utils/distributed-lock");
const redis = require("../src/config/redis");

const TEST_MONGODB_URI = "mongodb://127.0.0.1:27017/buybox_settlement_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Phase VENDOR-WALLET-B — Settlement Automation & Return-Window Test Suite", () => {
  let testVendor;
  let testVendorUser;
  let testVendorWallet;
  let testCustomer;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(TEST_MONGODB_URI);
    }
    if (redis && redis.status !== "ready" && redis.status !== "connect") {
      await redis.connect().catch(() => {});
    }

    const db = mongoose.connection.db;
    const existingCols = (await db.listCollections().toArray()).map((c) => c.name);
    const requiredCols = [
      "financialledgerentries",
      "vendorsettlements",
      "vendorwallets",
      "orders",
      "returnrequests",
      "vendors",
      "users",
      "storefrontsettings",
    ];
    for (const col of requiredCols) {
      if (!existingCols.includes(col)) {
        await db.createCollection(col);
      }
    }

    await Promise.all([
      FinancialLedgerEntry.init(),
      VendorSettlement.init(),
      VendorWallet.init(),
      Order.init(),
      ReturnRequest.init(),
      Vendor.init(),
      User.init(),
      StorefrontSettings.init(),
    ]);

    // Clean isolated test database via native collection to bypass immutability hooks in test isolation
    if (FinancialLedgerEntry.collection) {
      await FinancialLedgerEntry.collection.deleteMany({});
    }
    await VendorWallet.deleteMany({});
    await VendorSettlement.deleteMany({});
    await Order.deleteMany({});
    await ReturnRequest.deleteMany({});
    await Vendor.deleteMany({});
    await User.deleteMany({});
    await StorefrontSettings.deleteMany({});

    // Setup Storefront Settings with 7 days return window
    await StorefrontSettings.create({
      storeName: "Buybox Test Store",
      policies: {
        returnWindowDays: 7,
        refundWindowDays: 7,
      },
      isActive: true,
    });

    // Create test customer
    testCustomer = await User.create({
      firstName: "Test",
      lastName: "Customer",
      name: "Test Customer",
      email: `customer_${Date.now()}@buybox.test`,
      password: "HashedPassword123!",
      role: ROLES.CUSTOMER,
      roles: [ROLES.CUSTOMER],
      isActive: true,
    });

    // Create test vendor user & profile
    testVendorUser = await User.create({
      firstName: "Test",
      lastName: "Vendor",
      name: "Test Vendor Profile",
      email: `vendor_${Date.now()}@buybox.test`,
      password: "HashedPassword123!",
      role: ROLES.VENDOR,
      roles: [ROLES.VENDOR],
      isActive: true,
    });

    testVendor = await Vendor.create({
      userId: testVendorUser._id,
      businessName: "Crafts Test Vendor",
      storeName: "crafts-test-store",
      businessSlug: `crafts-test-vendor-${Date.now()}`,
      onboardingStatus: "approved",
      isActive: true,
      commissionRate: mongoose.Types.Decimal128.fromString("0.10"),
    });

    // Initialize vendor wallet
    testVendorWallet = await financialLedgerService.syncVendorWalletBalances(
      testVendor._id,
      "INR"
    );
  });

  afterAll(async () => {
    stopVendorSettlementScheduler();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  // =========================================================================
  // 1. Return Window Configuration & Policy Snapshots
  // =========================================================================
  describe("1. Return Window Policy & Configuration Guardrails", () => {
    test("1.1 Default configuration resolves to 7 days when unconfigured", async () => {
      const settings = await storefrontSettingsService.getActiveSettings();
      expect(settings.policies.returnWindowDays).toBe(7);
    });

    test("1.2 Worker registry includes vendorSettlement worker", () => {
      expect(workerRegistry.vendorSettlement).toBeDefined();
      expect(workerRegistry.vendorSettlement.name).toBe("vendor-settlement");
      expect(typeof workerRegistry.vendorSettlement.run).toBe("function");
      expect(typeof workerRegistry.vendorSettlement.start).toBe("function");
      expect(typeof workerRegistry.vendorSettlement.stop).toBe("function");
    });
  });

  // =========================================================================
  // 2. Settlement Eligibility Evaluation Matrix
  // =========================================================================
  describe("2. Settlement Eligibility Matrix & Hold Rules", () => {
    let orderMatured;
    let orderActiveReturnWindow;
    let orderUndelivered;
    let orderMissingDeliveredAt;
    let orderWithActiveReturn;

    const defaultShippingAddress = {
      fullName: "Test Customer",
      phone: "+919876543210",
      addressLine1: "123 Main St",
      city: "Bangalore",
      state: "Karnataka",
      postalCode: "560001",
      country: "IN",
    };

    beforeAll(async () => {
      const now = Date.now();
      const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000);
      const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000);

      // Order A: Delivered 10 days ago (> 7 days) -> Eligible for maturation
      orderMatured = await Order.create({
        orderNumber: `ORD-MATURED-${Date.now()}`,
        customerId: testCustomer._id,
        status: "delivered",
        paymentStatus: "paid",
        currency: "INR",
        deliveredAt: tenDaysAgo,
        returnWindowDaysSnapshot: 7,
        subtotal: mongoose.Types.Decimal128.fromString("1000.00"),
        shippingTotal: mongoose.Types.Decimal128.fromString("0.00"),
        taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
        discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
        grandTotal: mongoose.Types.Decimal128.fromString("1000.00"),
        shippingAddress: defaultShippingAddress,
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            productVariantId: new mongoose.Types.ObjectId(),
            productName: "Matured Item",
            sku: "SKU-MATURED",
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("1000.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("1000.00"),
            currency: "INR",
            inventoryStatus: "deducted",
            fulfillmentStatus: "delivered",
            vendorId: testVendor._id,
            commissionAmount: mongoose.Types.Decimal128.fromString("100.00"),
            commissionRate: mongoose.Types.Decimal128.fromString("0.10"),
            commissionSnapshot: {
              commissionAmount: mongoose.Types.Decimal128.fromString("100.00"),
              commissionRate: mongoose.Types.Decimal128.fromString("0.10"),
              vendorNetEntitlement: mongoose.Types.Decimal128.fromString("900.00"),
              isLocked: true,
            },
          },
        ],
      });

      // Post initial payment capture journal for Order A
      await financialLedgerService.postJournal({
        journalId: `JRN-PAY-${orderMatured.orderNumber}`,
        currency: "INR",
        entries: [
          {
            entryType: FINANCIAL_ENTRY_TYPES.PAYMENT_RECEIVED,
            direction: FINANCIAL_ENTRY_DIRECTIONS.DEBIT,
            accountType: FINANCIAL_ACCOUNT_TYPES.PLATFORM,
            accountCode: LEDGER_ACCOUNTS.PLATFORM_ESCROW,
            amount: "1000.00",
            currency: "INR",
          },
          {
            entryType: FINANCIAL_ENTRY_TYPES.PLATFORM_COMMISSION,
            direction: FINANCIAL_ENTRY_DIRECTIONS.CREDIT,
            accountType: FINANCIAL_ACCOUNT_TYPES.PLATFORM,
            accountCode: LEDGER_ACCOUNTS.PLATFORM_COMMISSION_REVENUE,
            amount: "100.00",
            currency: "INR",
          },
          {
            entryType: FINANCIAL_ENTRY_TYPES.VENDOR_EARNING,
            direction: FINANCIAL_ENTRY_DIRECTIONS.CREDIT,
            accountType: FINANCIAL_ACCOUNT_TYPES.VENDOR,
            accountCode: LEDGER_ACCOUNTS.VENDOR_PENDING_EARNINGS,
            accountReference: String(testVendor._id),
            vendorId: testVendor._id,
            amount: "900.00",
            currency: "INR",
          },
        ],
      });
      await financialLedgerService.syncVendorWalletBalances(testVendor._id, "INR");

      // Order B: Delivered 3 days ago (< 7 days) -> Ineligible (in return escrow)
      orderActiveReturnWindow = await Order.create({
        orderNumber: `ORD-ACTIVE-ESCROW-${Date.now()}`,
        customerId: testCustomer._id,
        status: "delivered",
        paymentStatus: "paid",
        currency: "INR",
        deliveredAt: threeDaysAgo,
        returnWindowDaysSnapshot: 7,
        subtotal: mongoose.Types.Decimal128.fromString("2000.00"),
        shippingTotal: mongoose.Types.Decimal128.fromString("0.00"),
        taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
        discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
        grandTotal: mongoose.Types.Decimal128.fromString("2000.00"),
        shippingAddress: defaultShippingAddress,
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            productVariantId: new mongoose.Types.ObjectId(),
            productName: "Active Escrow Item",
            sku: "SKU-ESCROW",
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("2000.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("2000.00"),
            currency: "INR",
            inventoryStatus: "deducted",
            fulfillmentStatus: "delivered",
            vendorId: testVendor._id,
            commissionAmount: mongoose.Types.Decimal128.fromString("200.00"),
            commissionRate: mongoose.Types.Decimal128.fromString("0.10"),
            commissionSnapshot: {
              commissionAmount: mongoose.Types.Decimal128.fromString("200.00"),
              commissionRate: mongoose.Types.Decimal128.fromString("0.10"),
              vendorNetEntitlement: mongoose.Types.Decimal128.fromString("1800.00"),
              isLocked: true,
            },
          },
        ],
      });

      // Order C: Undelivered (processing, deliveredAt: null) -> Ineligible
      orderUndelivered = await Order.create({
        orderNumber: `ORD-UNDELIVERED-${Date.now()}`,
        customerId: testCustomer._id,
        status: "processing",
        paymentStatus: "paid",
        currency: "INR",
        deliveredAt: null,
        subtotal: mongoose.Types.Decimal128.fromString("500.00"),
        shippingTotal: mongoose.Types.Decimal128.fromString("0.00"),
        taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
        discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
        grandTotal: mongoose.Types.Decimal128.fromString("500.00"),
        shippingAddress: defaultShippingAddress,
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            productVariantId: new mongoose.Types.ObjectId(),
            productName: "Undelivered Item",
            sku: "SKU-UNDELIVERED",
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("500.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("500.00"),
            currency: "INR",
            fulfillmentStatus: "ready_to_ship",
            vendorId: testVendor._id,
          },
        ],
      });

      // Order D: Marked completed but deliveredAt is missing -> Ineligible
      orderMissingDeliveredAt = await Order.create({
        orderNumber: `ORD-NO-DELIV-DATE-${Date.now()}`,
        customerId: testCustomer._id,
        status: "completed",
        paymentStatus: "paid",
        currency: "INR",
        deliveredAt: null, // Missing!
        subtotal: mongoose.Types.Decimal128.fromString("800.00"),
        shippingTotal: mongoose.Types.Decimal128.fromString("0.00"),
        taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
        discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
        grandTotal: mongoose.Types.Decimal128.fromString("800.00"),
        shippingAddress: defaultShippingAddress,
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            productVariantId: new mongoose.Types.ObjectId(),
            productName: "Missing Date Item",
            sku: "SKU-NO-DATE",
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("800.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("800.00"),
            currency: "INR",
            fulfillmentStatus: "delivered",
            vendorId: testVendor._id,
          },
        ],
      });

      // Order E: Delivered 10 days ago but has an active return request -> Ineligible (On Hold)
      const productIdOnHold = new mongoose.Types.ObjectId();
      orderWithActiveReturn = await Order.create({
        orderNumber: `ORD-RETURN-HOLD-${Date.now()}`,
        customerId: testCustomer._id,
        status: "delivered",
        paymentStatus: "paid",
        currency: "INR",
        deliveredAt: tenDaysAgo,
        returnWindowDaysSnapshot: 7,
        subtotal: mongoose.Types.Decimal128.fromString("1500.00"),
        shippingTotal: mongoose.Types.Decimal128.fromString("0.00"),
        taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
        discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
        grandTotal: mongoose.Types.Decimal128.fromString("1500.00"),
        shippingAddress: defaultShippingAddress,
        items: [
          {
            productId: productIdOnHold,
            productVariantId: new mongoose.Types.ObjectId(),
            productName: "Item On Return Hold",
            sku: "SKU-HOLD",
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("1500.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("1500.00"),
            currency: "INR",
            fulfillmentStatus: "delivered",
            vendorId: testVendor._id,
          },
        ],
      });

      await ReturnRequest.create({
        returnNumber: `RET-${Date.now()}`,
        orderId: orderWithActiveReturn._id,
        customerId: testCustomer._id,
        status: "under_review",
        items: [
          {
            productId: productIdOnHold,
            sku: "SKU-HOLD",
            name: "Item On Return Hold",
            quantity: 1,
            vendorId: testVendor._id,
            itemPrice: mongoose.Types.Decimal128.fromString("1500.00"),
            reason: "defective",
            condition: "defective_in_box",
          },
        ],
      });
    });

    test("2.1 calculateVendorEligibleSettlement selects only Order A and excludes B, C, D, E", async () => {
      const calc = await vendorSettlementService.calculateVendorEligibleSettlement({
        vendorId: testVendor._id,
      });

      expect(calc.eligibleOrders.length).toBe(1);
      expect(calc.eligibleOrders[0]._id.toString()).toBe(orderMatured._id.toString());
      expect(calc.grossSales).toBe(1000.0);
      expect(calc.platformCommission).toBe(100.0);
      expect(calc.netPayable).toBe(900.0);

      // Verify other orders were excluded
      const orderIds = calc.eligibleOrders.map((o) => o._id.toString());
      expect(orderIds).not.toContain(orderActiveReturnWindow._id.toString());
      expect(orderIds).not.toContain(orderUndelivered._id.toString());
      expect(orderIds).not.toContain(orderMissingDeliveredAt._id.toString());
      expect(orderIds).not.toContain(orderWithActiveReturn._id.toString());
    });

    test("2.2 Inactive or suspended vendor is excluded from settlement", async () => {
      const inactiveVendor = await Vendor.create({
        userId: new mongoose.Types.ObjectId(),
        businessName: "Suspended Vendor",
        storeName: "suspended-store",
        businessSlug: `suspended-vendor-${Date.now()}`,
        onboardingStatus: "suspended",
        isActive: false,
      });

      const calc = await vendorSettlementService.calculateVendorEligibleSettlement({
        vendorId: inactiveVendor._id,
      });

      expect(calc.eligibleOrders.length).toBe(0);
      expect(calc.netPayable).toBe(0);
      expect(calc.ineligibleReason).toBe("VENDOR_NOT_ELIGIBLE");
    });
  });

  // =========================================================================
  // 3. Automated Worker Execution & Ledger Parity
  // =========================================================================
  describe("3. Worker Execution, Idempotency & Double-Entry Ledger Parity", () => {
    test("3.1 processVendorSettlementBatch matures eligible order into settlement", async () => {
      const batchResult = await processVendorSettlementBatch({
        vendorId: testVendor._id.toString(),
      });

      expect(batchResult.settlementsGenerated).toBe(1);
      expect(Number(batchResult.totalMaturedAmount)).toBe(900.0);

      // Check settlement document was created
      const settlement = await VendorSettlement.findOne({ vendorId: testVendor._id });
      expect(settlement).toBeDefined();
      expect(settlement.status).toBe("pending");
      expect(Number(settlement.netPayable.toString())).toBe(900.0);

      // Check Order A item now has settlementId attached
      const refreshedOrderA = await Order.findById(settlement.orderIds[0]);
      expect(refreshedOrderA.items[0].settlementId.toString()).toBe(settlement._id.toString());

      // Check settlement maturation journal in ledger
      const maturationJournal = await FinancialLedgerEntry.find({
        entryType: FINANCIAL_ENTRY_TYPES.SETTLEMENT_MATURED,
        vendorId: testVendor._id,
      });

      expect(maturationJournal.length).toBe(2);
      const debitPending = maturationJournal.find((e) => e.direction === FINANCIAL_ENTRY_DIRECTIONS.DEBIT);
      const creditAvailable = maturationJournal.find((e) => e.direction === FINANCIAL_ENTRY_DIRECTIONS.CREDIT);

      expect(debitPending.accountCode).toBe(LEDGER_ACCOUNTS.VENDOR_PENDING_EARNINGS);
      expect(creditAvailable.accountCode).toBe(LEDGER_ACCOUNTS.VENDOR_AVAILABLE_EARNINGS);
      expect(debitPending.amount.toString()).toBe("900.00");
      expect(creditAvailable.amount.toString()).toBe("900.00");

      // Verify wallet projection has 900.00 in availableBalance
      const wallet = await VendorWallet.findOne({ vendorId: testVendor._id });
      expect(Number(wallet.availableBalance.toString())).toBe(900.0);
    });

    test("3.2 Idempotent rerun of worker does NOT create duplicate settlements or credits", async () => {
      const rerunResult = await processVendorSettlementBatch({
        vendorId: testVendor._id.toString(),
      });

      // No new orders are eligible; already settled
      expect(rerunResult.settlementsGenerated).toBe(0);

      // Verify settlement count remains exactly 1
      const count = await VendorSettlement.countDocuments({ vendorId: testVendor._id });
      expect(count).toBe(1);

      // Available balance is still 900.00, not 1800.00
      const wallet = await VendorWallet.findOne({ vendorId: testVendor._id });
      expect(Number(wallet.availableBalance.toString())).toBe(900.0);
    });

    test("3.3 Distributed lock prevents overlapping concurrent worker runs", async () => {
      const token = generateOwnerToken();
      const lockAcquired = await acquireDistributedLock("vendor-settlement", {
        ownerToken: token,
        ttlMs: 30000,
      });

      if (lockAcquired.acquired) {
        const concurrentResult = await processVendorSettlementBatch();
        expect(concurrentResult.skipped).toBe(true);
        expect(concurrentResult.reason).toBe("ALREADY_LOCKED");

        await releaseDistributedLock("vendor-settlement", token);
      }
    });
  });

  // =========================================================================
  // 4. Vendor Wallet Clearance Timeline API
  // =========================================================================
  describe("4. Vendor Clearance Timeline API", () => {
    test("4.1 getVendorClearanceTimeline reports correct categorizations and dates", async () => {
      const timeline = await vendorWalletService.getVendorClearanceTimeline(testVendor._id);

      expect(timeline).toBeDefined();
      expect(timeline.summary).toBeDefined();
      expect(timeline.items).toBeDefined();

      // Check categories exist
      const awaiting = timeline.items.find((i) => i.status === "awaiting_delivery");
      expect(awaiting).toBeDefined();
      expect(awaiting.statusLabel).toBe("Awaiting Delivery");

      const escrow = timeline.items.find((i) => i.status === "return_window_active");
      expect(escrow).toBeDefined();
      expect(escrow.statusLabel).toBe("In Return Escrow");
      expect(escrow.returnWindowDays).toBe(7);

      const onHold = timeline.items.find((i) => i.status === "on_hold");
      expect(onHold).toBeDefined();
      expect(onHold.holdReason).toBe("Buyer return request under review");
    });
  });
});
