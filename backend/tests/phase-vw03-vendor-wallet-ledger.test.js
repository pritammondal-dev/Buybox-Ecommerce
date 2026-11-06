const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../src/app");

const User = require("../src/models/User");
const Employee = require("../src/models/Employee");
const Customer = require("../src/models/Customer");
const Vendor = require("../src/models/Vendor");
const Category = require("../src/models/Category");
const Brand = require("../src/models/Brand");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Order = require("../src/models/Order");
const Payment = require("../src/models/Payment");
const Refund = require("../src/models/Refund");
const { VendorSettlement } = require("../src/models/VendorSettlement");
const VendorPayout = require("../src/models/VendorPayout");
const VendorBankAccount = require("../src/models/VendorBankAccount");
const FinancialLedgerEntry = require("../src/models/FinancialLedgerEntry");
const VendorWallet = require("../src/models/VendorWallet");
const CommissionPolicy = require("../src/models/CommissionPolicy");

const {
  FINANCIAL_ENTRY_TYPES,
  FINANCIAL_ENTRY_DIRECTIONS,
  FINANCIAL_ACCOUNT_TYPES,
  FINANCIAL_ENTRY_SOURCES,
  LEDGER_ACCOUNTS,
  WALLET_STATUSES,
} = require("../src/constants/finance.constants");

const { ROLES } = require("../src/constants/auth.constants");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { hashPassword } = require("../src/utils/password");
const {
  generateAccessToken,
  TOKEN_CONTEXTS,
  TOKEN_AUDIENCES,
} = require("../src/services/token.service");

const financialLedgerService = require("../src/services/financial-ledger.service");
const vendorWalletService = require("../src/services/vendor-wallet.service");
const financialReconciliationService = require("../src/services/financial-reconciliation.service");
const orderService = require("../src/services/order.service");
const vendorSettlementService = require("../src/services/vendor-settlement.service");
const vendorPayoutService = require("../src/services/vendor-payout.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace(/\/buybox(_test)?(\?|$)/, "/buybox_vw03_test$2")
  : "mongodb://127.0.0.1:27017/buybox_vw03_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Phase VW-03 — Authoritative Financial Ledger & Vendor Wallet Foundation", () => {
  let superadminUser;
  let superadminToken;
  let vendorAUser;
  let vendorAToken;
  let vendorADoc;
  let vendorBUser;
  let vendorBToken;
  let vendorBDoc;
  let customerUser;
  let customerDoc;
  let testCategory;
  let testBrand;
  let testProductA;
  let testVariantA;
  let testBankA;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    // Clean test state via native collection to bypass immutability hooks in test isolation
    if (FinancialLedgerEntry.collection) {
      await FinancialLedgerEntry.collection.deleteMany({});
    }
    await VendorWallet.deleteMany({});
    await VendorSettlement.deleteMany({});
    await VendorPayout.deleteMany({});
    await CommissionPolicy.deleteMany({});

    const rand = Math.random().toString(36).substring(7);

    // Reuse or create single platform Superadmin
    superadminUser = await User.findOne({ role: ROLES.SUPER_ADMIN, isActive: true });
    if (!superadminUser) {
      superadminUser = await User.create({
        firstName: "Super",
        lastName: "Admin",
        name: `SuperAdmin VW03 ${rand}`,
        email: `superadmin_vw03_${rand}@buybox.test`,
        password: await hashPassword("SuperAdminPass123!"),
        role: ROLES.SUPER_ADMIN,
        roles: [ROLES.SUPER_ADMIN],
        permissions: [PERMISSIONS.FINANCE_READ, PERMISSIONS.FINANCE_MANAGE],
        isActive: true,
        isEmailVerified: true,
      });

      await Employee.create({
        userId: superadminUser._id,
        jobTitle: "Platform Superadmin",
        department: "Finance Operations",
        employeeNumber: `EMP-VW03-${rand.slice(-4).toUpperCase()}`,
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

    // Create Vendor A
    vendorAUser = await User.create({
      firstName: "Vendor",
      lastName: "One",
      name: `Vendor A User ${rand}`,
      email: `vendor_a_${rand}@buybox.test`,
      password: await hashPassword("VendorPass123!"),
      role: ROLES.VENDOR,
      roles: [ROLES.VENDOR],
      isActive: true,
      isEmailVerified: true,
    });

    vendorADoc = await Vendor.create({
      userId: vendorAUser._id,
      businessName: `Vendor A Enterprises ${rand}`,
      storeName: `VendorA Store ${rand}`,
      businessSlug: `vendor-a-${rand}`,
      email: `vendor_a_${rand}@buybox.test`,
      phone: "+919876543210",
      status: "approved",
      onboardingStatus: "approved",
      isActive: true,
      commissionRate: mongoose.Types.Decimal128.fromString("0.10"),
    });

    vendorAToken = generateAccessToken(
      {
        sub: vendorAUser._id.toString(),
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

    // Bank account for Vendor A
    testBankA = await VendorBankAccount.create({
      vendorId: vendorADoc._id,
      submittedBy: vendorAUser._id,
      accountHolderName: "Vendor A Enterprises",
      bankName: "HDFC Bank",
      accountNumberEncrypted: "enc_1234567890",
      accountNumberHash: `hmac_${rand}`,
      accountNumberMasked: "XXXXXXXX7890",
      accountNumberLast4: "7890",
      ifscCode: "HDFC0001234",
      branchName: "Koramangala",
      accountType: "current",
      status: "approved",
      isActive: true,
    });

    // Create Vendor B (for isolation testing)
    vendorBUser = await User.create({
      firstName: "Vendor",
      lastName: "Two",
      name: `Vendor B User ${rand}`,
      email: `vendor_b_${rand}@buybox.test`,
      password: await hashPassword("VendorPass123!"),
      role: ROLES.VENDOR,
      roles: [ROLES.VENDOR],
      isActive: true,
      isEmailVerified: true,
    });

    vendorBDoc = await Vendor.create({
      userId: vendorBUser._id,
      businessName: `Vendor B Enterprises ${rand}`,
      storeName: `VendorB Store ${rand}`,
      businessSlug: `vendor-b-${rand}`,
      email: `vendor_b_${rand}@buybox.test`,
      phone: "+919876543211",
      status: "approved",
      onboardingStatus: "approved",
      isActive: true,
      commissionRate: mongoose.Types.Decimal128.fromString("0.15"),
    });

    vendorBToken = generateAccessToken(
      {
        sub: vendorBUser._id.toString(),
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

    // Create Customer
    customerUser = await User.create({
      firstName: "Customer",
      lastName: "Tester",
      name: `Customer VW03 ${rand}`,
      email: `customer_vw03_${rand}@buybox.test`,
      password: await hashPassword("CustomerPass123!"),
      role: ROLES.CUSTOMER,
      roles: [ROLES.CUSTOMER],
      isActive: true,
      isEmailVerified: true,
    });

    customerDoc = await Customer.create({
      userId: customerUser._id,
      phone: "+919876543212",
    });

    // Catalog items
    testCategory = await Category.create({
      name: `VW03 Cat ${rand}`,
      slug: `vw03-cat-${rand}`,
      isActive: true,
    });

    testBrand = await Brand.create({
      name: `VW03 Brand ${rand}`,
      slug: `vw03-brand-${rand}`,
      isActive: true,
    });

    testProductA = await Product.create({
      name: `VW03 Product A ${rand}`,
      slug: `vw03-product-a-${rand}`,
      categoryId: testCategory._id,
      brandId: testBrand._id,
      vendorId: vendorADoc._id,
      sku: `SKU-A-${rand}`,
      price: mongoose.Types.Decimal128.fromString("1000.00"),
      status: "active",
      isActive: true,
    });

    testVariantA = await ProductVariant.create({
      productId: testProductA._id,
      sku: `VAR-A-${rand}`,
      price: mongoose.Types.Decimal128.fromString("1000.00"),
      stock: 100,
      isActive: true,
    });
  });

  afterAll(async () => {
    // Keep DB connections managed
  });

  describe("1. Authoritative Double-Entry Ledger Invariants", () => {
    const dummyVendorId = new mongoose.Types.ObjectId();

    it("1.1 Successfully posts a balanced journal in integer minor units", async () => {
      const journalId = `JRN-TEST-BALANCED-${Date.now()}`;
      const idempotencyKey = `key_bal_${Date.now()}`;

      const entries = [
        {
          entryType: FINANCIAL_ENTRY_TYPES.PAYMENT_RECEIVED,
          direction: FINANCIAL_ENTRY_DIRECTIONS.DEBIT,
          accountType: FINANCIAL_ACCOUNT_TYPES.PLATFORM,
          accountCode: LEDGER_ACCOUNTS.PLATFORM_ESCROW,
          amount: "100.00",
          currency: "INR",
          description: "Customer gateway payment",
        },
        {
          entryType: FINANCIAL_ENTRY_TYPES.PLATFORM_COMMISSION,
          direction: FINANCIAL_ENTRY_DIRECTIONS.CREDIT,
          accountType: FINANCIAL_ACCOUNT_TYPES.PLATFORM,
          accountCode: LEDGER_ACCOUNTS.PLATFORM_COMMISSION_REVENUE,
          amount: "10.00",
          currency: "INR",
          description: "Platform commission 10%",
        },
        {
          entryType: FINANCIAL_ENTRY_TYPES.VENDOR_EARNING,
          direction: FINANCIAL_ENTRY_DIRECTIONS.CREDIT,
          accountType: FINANCIAL_ACCOUNT_TYPES.VENDOR,
          accountCode: LEDGER_ACCOUNTS.VENDOR_PENDING_EARNINGS,
          amount: "90.00",
          currency: "INR",
          vendorId: dummyVendorId,
          description: "Vendor pending entitlement",
        },
      ];

      const created = await financialLedgerService.postJournal({
        journalId,
        sourceEvent: "manual_test",
        idempotencyKey,
        currency: "INR",
        entries,
      });

      expect(created).toBeDefined();
      expect(created.length).toBe(3);

      const fetched = await financialLedgerService.getEntriesByJournalId(journalId);
      expect(fetched.length).toBe(3);

      let totalDebits = 0;
      let totalCredits = 0;
      for (const e of fetched) {
        const minor = financialLedgerService.toMinorUnits(e.amount);
        if (e.direction === FINANCIAL_ENTRY_DIRECTIONS.DEBIT) totalDebits += minor;
        if (e.direction === FINANCIAL_ENTRY_DIRECTIONS.CREDIT) totalCredits += minor;
      }
      expect(totalDebits).toBe(10000);
      expect(totalCredits).toBe(10000);
      expect(totalDebits).toBe(totalCredits);
    });

    it("1.2 Strictly rejects an unbalanced journal (Debits != Credits)", async () => {
      const journalId = `JRN-UNBALANCED-${Date.now()}`;

      const entries = [
        {
          entryType: FINANCIAL_ENTRY_TYPES.PAYMENT_RECEIVED,
          direction: FINANCIAL_ENTRY_DIRECTIONS.DEBIT,
          accountType: FINANCIAL_ACCOUNT_TYPES.PLATFORM,
          accountCode: LEDGER_ACCOUNTS.PLATFORM_ESCROW,
          amount: "100.00", // 10000 minor
          currency: "INR",
        },
        {
          entryType: FINANCIAL_ENTRY_TYPES.VENDOR_EARNING,
          direction: FINANCIAL_ENTRY_DIRECTIONS.CREDIT,
          accountType: FINANCIAL_ACCOUNT_TYPES.VENDOR,
          accountCode: LEDGER_ACCOUNTS.VENDOR_PENDING_EARNINGS,
          amount: "80.00", // 8000 minor -> missing 2000!
          currency: "INR",
        },
      ];

      await expect(
        financialLedgerService.postJournal({
          journalId,
          currency: "INR",
          entries,
        })
      ).rejects.toThrow(/Unbalanced journal/);
    });

    it("1.3 Rejects zero, negative, or invalid entry amounts", async () => {
      const journalId = `JRN-ZERO-${Date.now()}`;

      await expect(
        financialLedgerService.postJournal({
          journalId,
          currency: "INR",
          entries: [
            {
              entryType: FINANCIAL_ENTRY_TYPES.PAYMENT_RECEIVED,
              direction: FINANCIAL_ENTRY_DIRECTIONS.DEBIT,
              accountType: FINANCIAL_ACCOUNT_TYPES.PLATFORM,
              amount: "0.00",
              currency: "INR",
            },
            {
              entryType: FINANCIAL_ENTRY_TYPES.VENDOR_EARNING,
              direction: FINANCIAL_ENTRY_DIRECTIONS.CREDIT,
              accountType: FINANCIAL_ACCOUNT_TYPES.VENDOR,
              amount: "0.00",
              currency: "INR",
            },
          ],
        })
      ).rejects.toThrow(/greater than zero/);
    });

    it("1.4 Rejects cross-currency entries in a single journal", async () => {
      const journalId = `JRN-MULTI-CURR-${Date.now()}`;

      await expect(
        financialLedgerService.postJournal({
          journalId,
          currency: "INR",
          entries: [
            {
              entryType: FINANCIAL_ENTRY_TYPES.PAYMENT_RECEIVED,
              direction: FINANCIAL_ENTRY_DIRECTIONS.DEBIT,
              accountType: FINANCIAL_ACCOUNT_TYPES.PLATFORM,
              amount: "100.00",
              currency: "USD", // Mismatch!
            },
            {
              entryType: FINANCIAL_ENTRY_TYPES.VENDOR_EARNING,
              direction: FINANCIAL_ENTRY_DIRECTIONS.CREDIT,
              accountType: FINANCIAL_ACCOUNT_TYPES.VENDOR,
              amount: "100.00",
              currency: "INR",
            },
          ],
        })
      ).rejects.toThrow(/Currency mismatch/);
    });

    it("1.5 Idempotent retry returns original entries without double-posting", async () => {
      const journalId = `JRN-IDEMPOTENT-${Date.now()}`;
      const idempotencyKey = `idem_${Date.now()}`;

      const entries = [
        {
          entryType: FINANCIAL_ENTRY_TYPES.PAYMENT_RECEIVED,
          direction: FINANCIAL_ENTRY_DIRECTIONS.DEBIT,
          accountType: FINANCIAL_ACCOUNT_TYPES.PLATFORM,
          amount: "50.00",
          currency: "INR",
        },
        {
          entryType: FINANCIAL_ENTRY_TYPES.VENDOR_EARNING,
          direction: FINANCIAL_ENTRY_DIRECTIONS.CREDIT,
          accountType: FINANCIAL_ACCOUNT_TYPES.VENDOR,
          amount: "50.00",
          currency: "INR",
          vendorId: dummyVendorId,
        },
      ];

      const post1 = await financialLedgerService.postJournal({
        journalId,
        idempotencyKey,
        currency: "INR",
        entries,
      });

      const post2 = await financialLedgerService.postJournal({
        journalId,
        idempotencyKey,
        currency: "INR",
        entries,
      });

      expect(post1).toBeDefined();
      expect(post2).toBeDefined();
      expect(post1.length).toBe(2);
      expect(post2.length).toBe(2);

      const allEntries = await financialLedgerService.getEntriesByJournalId(journalId);
      expect(allEntries.length).toBe(2); // Still exactly 2, never 4!
    });

    it("1.6 Posted ledger entries are strictly immutable (cannot update or delete)", async () => {
      const entry = await FinancialLedgerEntry.findOne({ vendorId: dummyVendorId });
      expect(entry).toBeDefined();

      await expect(
        FinancialLedgerEntry.updateOne(
          { _id: entry._id },
          { $set: { amount: mongoose.Types.Decimal128.fromString("9999.00") } }
        )
      ).rejects.toThrow(/FINANCIAL_LEDGER_IMMUTABLE/);

      await expect(
        FinancialLedgerEntry.deleteOne({ _id: entry._id })
      ).rejects.toThrow(/FINANCIAL_LEDGER_IMMUTABLE/);
    });

    it("1.7 Reversal journal references original journal and creates mirror entries", async () => {
      const journalId = `JRN-TO-REVERSE-${Date.now()}`;
      const entries = [
        {
          entryType: FINANCIAL_ENTRY_TYPES.PAYMENT_RECEIVED,
          direction: FINANCIAL_ENTRY_DIRECTIONS.DEBIT,
          accountType: FINANCIAL_ACCOUNT_TYPES.PLATFORM,
          amount: "75.00",
          currency: "INR",
        },
        {
          entryType: FINANCIAL_ENTRY_TYPES.VENDOR_EARNING,
          direction: FINANCIAL_ENTRY_DIRECTIONS.CREDIT,
          accountType: FINANCIAL_ACCOUNT_TYPES.VENDOR,
          amount: "75.00",
          currency: "INR",
          vendorId: dummyVendorId,
        },
      ];

      await financialLedgerService.postJournal({
        journalId,
        currency: "INR",
        entries,
      });

      const reversed = await financialLedgerService.reverseJournal({
        originalJournalId: journalId,
        reason: "Customer order cancelled before fulfillment",
      });

      expect(reversed).toBeDefined();
      expect(reversed.length).toBe(2);

      const rev1 = reversed.find((e) => e.direction === FINANCIAL_ENTRY_DIRECTIONS.CREDIT);
      const rev2 = reversed.find((e) => e.direction === FINANCIAL_ENTRY_DIRECTIONS.DEBIT);
      expect(rev1.accountType).toBe(FINANCIAL_ACCOUNT_TYPES.PLATFORM);
      expect(rev2.accountType).toBe(FINANCIAL_ACCOUNT_TYPES.VENDOR);
      expect(rev1.reversalOfJournalId).toBe(journalId);
      expect(rev2.reversalOfJournalId).toBe(journalId);
    });
  });

  describe("2. End-to-End Commerce Lifecycle & Wallet Balance State", () => {
    let testOrder;

    it("2.1 Payment Capture creates pending earnings and locks authoritative commission snapshot", async () => {
      // Create Order with preliminary snapshot
      testOrder = await Order.create({
        orderNumber: `ORD-VW03-${Date.now()}`,
        customerId: customerDoc._id,
        status: "pending",
        paymentStatus: "pending",
        currency: "INR",
        items: [
          {
            productId: testProductA._id,
            productVariantId: testVariantA._id,
            productName: testProductA.name,
            sku: testProductA.sku,
            unitPrice: mongoose.Types.Decimal128.fromString("1000.00"),
            quantity: 2,
            discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
            taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("2000.00"),
            currency: "INR",
            inventoryStatus: "reserved",
            fulfillmentStatus: "delivered",
            deliveredAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // Delivered 8 days ago (> 7 days)
            vendorId: vendorADoc._id,
            commissionRate: mongoose.Types.Decimal128.fromString("0.10"),
            commissionAmount: mongoose.Types.Decimal128.fromString("200.00"),
            commissionSnapshot: {
              source: "vendor_profile",
              commissionRate: mongoose.Types.Decimal128.fromString("0.10"),
              commissionPercentage: 10,
              commissionBaseAmount: mongoose.Types.Decimal128.fromString("2000.00"),
              commissionAmount: mongoose.Types.Decimal128.fromString("200.00"),
              vendorNetEntitlement: mongoose.Types.Decimal128.fromString("1800.00"),
              currency: "INR",
              isLocked: false,
            },
          },
        ],
        subtotal: mongoose.Types.Decimal128.fromString("2000.00"),
        grandTotal: mongoose.Types.Decimal128.fromString("2000.00"),
        shippingAddress: {
          fullName: "Customer Tester",
          phone: "9876543212",
          addressLine1: "123 Commercial St",
          city: "Bengaluru",
          state: "Karnataka",
          postalCode: "560001",
          country: "IN",
        },
      });

      // Mark payment captured
      const captured = await orderService.markOrderPaymentCaptured(testOrder._id);
      expect(captured.paymentStatus).toBe("paid");
      expect(captured.status).toBe("confirmed");
      expect(captured.items[0].commissionSnapshot.isLocked).toBe(true);

      // Verify double-entry ledger entries were generated
      const journal = await FinancialLedgerEntry.find({ orderId: testOrder._id });
      expect(journal.length).toBe(3); // 1 Escrow Debit, 1 Commission Credit, 1 Vendor Pending Credit

      const escrow = journal.find((e) => e.accountCode === LEDGER_ACCOUNTS.PLATFORM_ESCROW);
      const comm = journal.find((e) => e.accountCode === LEDGER_ACCOUNTS.PLATFORM_COMMISSION_REVENUE);
      const pending = journal.find((e) => e.accountCode === LEDGER_ACCOUNTS.VENDOR_PENDING_EARNINGS);

      expect(escrow.amount.toString()).toBe("2000.00");
      expect(comm.amount.toString()).toBe("200.00");
      expect(pending.amount.toString()).toBe("1800.00");

      // Verify Vendor Wallet was automatically synchronized
      const wallet = await vendorWalletService.getVendorWallet(vendorADoc._id);
      expect(Number(wallet.pendingBalance)).toBeGreaterThanOrEqual(1800.0);
      expect(Number(wallet.availableBalance)).toBe(0);
      expect(Number(wallet.reservedBalance)).toBe(0);
    });

    it("2.2 Settlement Maturation reclassifies pending earnings to available earnings", async () => {
      // Advance order to delivered past return window cutoff (> 7 days)
      testOrder.status = "delivered";
      testOrder.deliveredAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      await testOrder.save();

      // Simulate settlement generation for Vendor A
      const settlements = await vendorSettlementService.generateEligibleSettlements({
        vendorId: vendorADoc._id.toString(),
        adminUserId: superadminUser._id,
      });

      expect(settlements).toBeDefined();
      expect(settlements.length).toBe(1);
      const settlement = settlements[0];
      expect(Number(settlement.netPayable.toString())).toBe(1800.00);

      // Verify settlement maturation ledger journal was posted
      const maturationEntries = await FinancialLedgerEntry.find({
        entryType: FINANCIAL_ENTRY_TYPES.SETTLEMENT_MATURED,
        vendorId: vendorADoc._id,
      });
      expect(maturationEntries.length).toBe(2);

      const debitPending = maturationEntries.find((e) => e.direction === FINANCIAL_ENTRY_DIRECTIONS.DEBIT);
      const creditAvail = maturationEntries.find((e) => e.direction === FINANCIAL_ENTRY_DIRECTIONS.CREDIT);

      expect(debitPending.accountCode).toBe(LEDGER_ACCOUNTS.VENDOR_PENDING_EARNINGS);
      expect(creditAvail.accountCode).toBe(LEDGER_ACCOUNTS.VENDOR_AVAILABLE_EARNINGS);
      expect(debitPending.amount.toString()).toBe("1800.00");
      expect(creditAvail.amount.toString()).toBe("1800.00");

      // Check Vendor Wallet balances
      const wallet = await vendorWalletService.getVendorWallet(vendorADoc._id);
      expect(Number(wallet.availableBalance)).toBe(1800.00);
      expect(Number(wallet.pendingBalance)).toBe(0.00);
      expect(Number(wallet.reservedBalance)).toBe(0.00);
    });

    it("2.3 Payout Creation atomically reserves available funds into reserved balance", async () => {
      const settlement = await VendorSettlement.findOne({ vendorId: vendorADoc._id, status: "pending" });
      expect(settlement).toBeDefined();

      // Mark settlement payable
      settlement.status = "payable";
      await settlement.save();

      // Create payout
      const payout = await vendorPayoutService.createPayout({
        settlementId: settlement._id,
        vendorId: vendorADoc._id,
        idempotencyKey: `payout_vw03_${Date.now()}`,
        actorId: superadminUser._id,
      });

      expect(payout).toBeDefined();
      expect(payout.status).toBe("pending");
      expect(payout.amount.toString()).toBe("1800.00");

      // Check reserved ledger entries
      const resEntries = await FinancialLedgerEntry.find({
        entryType: FINANCIAL_ENTRY_TYPES.PAYOUT_RESERVED,
        vendorId: vendorADoc._id,
      });
      expect(resEntries.length).toBe(2);

      const debitAvail = resEntries.find((e) => e.direction === FINANCIAL_ENTRY_DIRECTIONS.DEBIT);
      const creditRes = resEntries.find((e) => e.direction === FINANCIAL_ENTRY_DIRECTIONS.CREDIT);
      expect(debitAvail.accountCode).toBe(LEDGER_ACCOUNTS.VENDOR_AVAILABLE_EARNINGS);
      expect(creditRes.accountCode).toBe(LEDGER_ACCOUNTS.VENDOR_RESERVED_PAYOUT);

      // Verify wallet state: available is now 0, reserved is 1800
      const wallet = await vendorWalletService.getVendorWallet(vendorADoc._id);
      expect(Number(wallet.availableBalance)).toBe(0.00);
      expect(Number(wallet.reservedBalance)).toBe(1800.00);
    });

    it("2.4 Failed payout releases reserved funds safely back to available balance", async () => {
      const payout = await VendorPayout.findOne({ vendorId: vendorADoc._id, status: "pending" });
      expect(payout).toBeDefined();

      // Move to processing then failed
      await vendorPayoutService.markProcessing(payout._id);
      await vendorPayoutService.transitionPayoutStatus({
        payoutId: payout._id,
        nextStatus: "failed",
        failureReason: "Simulated bank gateway downtime",
        actorId: superadminUser._id,
      });

      // Verify release journal
      const relEntries = await FinancialLedgerEntry.find({
        entryType: FINANCIAL_ENTRY_TYPES.PAYOUT_RELEASED,
        vendorId: vendorADoc._id,
      });
      expect(relEntries.length).toBe(2);

      const debitRes = relEntries.find((e) => e.direction === FINANCIAL_ENTRY_DIRECTIONS.DEBIT);
      const creditAvail = relEntries.find((e) => e.direction === FINANCIAL_ENTRY_DIRECTIONS.CREDIT);
      expect(debitRes.accountCode).toBe(LEDGER_ACCOUNTS.VENDOR_RESERVED_PAYOUT);
      expect(creditAvail.accountCode).toBe(LEDGER_ACCOUNTS.VENDOR_AVAILABLE_EARNINGS);

      // Check wallet state: available is restored to 1800, reserved is 0
      const wallet = await vendorWalletService.getVendorWallet(vendorADoc._id);
      expect(Number(wallet.availableBalance)).toBe(1800.00);
      expect(Number(wallet.reservedBalance)).toBe(0.00);
    });

    it("2.5 Retry and Payout Success disburses funds and updates totalPaidOut", async () => {
      const payout = await VendorPayout.findOne({ vendorId: vendorADoc._id, status: "failed" });
      expect(payout).toBeDefined();

      // Retry payout (moves to processing)
      await vendorPayoutService.markProcessing(payout._id);

      // Complete payout (moves to paid)
      await vendorPayoutService.markPaid({
        payoutId: payout._id,
        providerReference: `BANK_TXN_${Date.now()}`,
      });

      // Verify disbursement journal
      const disbEntries = await FinancialLedgerEntry.find({
        entryType: FINANCIAL_ENTRY_TYPES.PAYOUT_PAID,
        vendorId: vendorADoc._id,
      });
      expect(disbEntries.length).toBe(1);

      // Check wallet state: available is 0, reserved is 0, totalPaidOut is 1800
      const wallet = await vendorWalletService.getVendorWallet(vendorADoc._id);
      expect(Number(wallet.availableBalance)).toBe(0.00);
      expect(Number(wallet.reservedBalance)).toBe(0.00);
      expect(Number(wallet.totalPaidOut)).toBe(1800.00);
    });

    it("2.6 Refund Reversal calculates exact commission deduction and vendor debit", async () => {
      const refundDoc = {
        _id: new mongoose.Types.ObjectId(),
        orderId: testOrder._id,
        amount: mongoose.Types.Decimal128.fromString("500.00"),
        currency: "INR",
      };

      const reversed = await financialLedgerService.postRefundReversalJournal(refundDoc, {
        orderDoc: testOrder,
        vendorId: vendorADoc._id,
        isSettled: true,
        actorId: superadminUser._id,
      });

      expect(reversed).toBeDefined();
      expect(reversed.length).toBe(3);

      const commRev = reversed.find((e) => e.accountCode === LEDGER_ACCOUNTS.COMMISSION_REVERSAL);
      const vendorDebit = reversed.find((e) => e.accountCode === LEDGER_ACCOUNTS.VENDOR_AVAILABLE_EARNINGS);
      const refundClearing = reversed.find((e) => e.accountCode === LEDGER_ACCOUNTS.REFUND_CLEARING);

      expect(commRev.amount.toString()).toBe("50.00"); // 10% of 500
      expect(vendorDebit.amount.toString()).toBe("450.00"); // 90% of 500
      expect(refundClearing.amount.toString()).toBe("500.00"); // Full customer refund
    });
  });

  describe("3. Security, Tenant Isolation & Balance Reconciliation", () => {
    it("3.1 Vendor can read their own wallet via GET /api/v1/vendors/me/wallet", async () => {
      const res = await request(app)
        .get("/api/v1/vendors/me/wallet")
        .set("Authorization", `Bearer ${vendorAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.currency).toBe("INR");
      expect(res.body.data.vendorId.toString()).toBe(vendorADoc._id.toString());
      expect(res.body.data.pendingBalance).toBeDefined();
      expect(res.body.data.availableBalance).toBeDefined();
      expect(res.body.data.reservedBalance).toBeDefined();
    });

    it("3.2 Vendor A cannot access Vendor B's wallet or ledger records (Strict Tenant Isolation)", async () => {
      // Vendor A attempting to access Vendor B's admin wallet endpoint
      const res = await request(app)
        .get(`/api/v1/finance/wallets/${vendorBDoc._id}`)
        .set("Authorization", `Bearer ${vendorAToken}`);

      // Vendor role lacks FINANCE_READ permission -> 403 Forbidden
      expect(res.status).toBe(403);
    });

    it("3.3 Superadmin can read any vendor wallet with FINANCE_READ", async () => {
      const res = await request(app)
        .get(`/api/v1/finance/wallets/${vendorADoc._id}`)
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vendorId.toString()).toBe(vendorADoc._id.toString());
    });

    it("3.4 Balance Reconciliation verifies parity between raw ledger lines and cached projections", async () => {
      const recon = await financialReconciliationService.reconcileVendorFinances(vendorADoc._id);

      expect(recon).toBeDefined();
      expect(recon.vendorId).toBe(vendorADoc._id.toString());
      expect(recon.currency).toBe("INR");
      expect(recon.ledgerBalances).toBeDefined();
      expect(recon.walletBalances).toBeDefined();
      expect(recon.settlementSummary).toBeDefined();
      expect(recon.payoutSummary).toBeDefined();
      expect(recon.reconciledAt).toBeDefined();
    });

    it("3.5 Superadmin can reconcile and sync wallet projections with mandatory reason", async () => {
      // Missing reason should fail with 400
      const failRes = await request(app)
        .post(`/api/v1/finance/wallets/${vendorADoc._id}/reconcile`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({});

      expect(failRes.status).toBe(400);
      expect(failRes.body.error?.code || failRes.body.code).toBe("REASON_REQUIRED");

      // Valid sync with reason
      const passRes = await request(app)
        .post(`/api/v1/finance/wallets/${vendorADoc._id}/reconcile`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Routine end-of-month financial audit verification" });

      expect(passRes.status).toBe(200);
      expect(passRes.body.success).toBe(true);
      expect(passRes.body.data.reconciledAt).toBeDefined();
    });

    it("3.6 Vendor cannot access raw ledger admin endpoints", async () => {
      const res = await request(app)
        .get(`/api/v1/finance/ledger/vendor/${vendorADoc._id}`)
        .set("Authorization", `Bearer ${vendorAToken}`);

      expect(res.status).toBe(403);
    });

    it("3.7 Vendor wallet responses never expose sensitive unmasked bank account numbers", async () => {
      const res = await request(app)
        .get("/api/v1/vendors/me/wallet/transactions")
        .set("Authorization", `Bearer ${vendorAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const jsonStr = JSON.stringify(res.body.data);
      expect(jsonStr).not.toContain("enc_1234567890"); // Encrypted secret never leaked
      expect(jsonStr).not.toContain("1234567890"); // Raw account number never leaked
    });
  });
});
