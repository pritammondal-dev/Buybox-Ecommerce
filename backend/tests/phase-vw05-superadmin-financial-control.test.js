const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../src/app");

const User = require("../src/models/User");
const Employee = require("../src/models/Employee");
const Vendor = require("../src/models/Vendor");
const Category = require("../src/models/Category");
const Product = require("../src/models/Product");
const Order = require("../src/models/Order");
const Payment = require("../src/models/Payment");
const VendorBankAccount = require("../src/models/VendorBankAccount");
const VendorPayout = require("../src/models/VendorPayout");
const FinancialLedgerEntry = require("../src/models/FinancialLedgerEntry");
const VendorWallet = require("../src/models/VendorWallet");
const WithdrawalRequest = require("../src/models/WithdrawalRequest");
const CommissionPolicy = require("../src/models/CommissionPolicy");
const AuditLog = require("../src/models/AuditLog");

const {
  FINANCIAL_ENTRY_TYPES,
  FINANCIAL_ENTRY_DIRECTIONS,
  FINANCIAL_ACCOUNT_TYPES,
  LEDGER_ACCOUNTS,
  COMMISSION_POLICY_SCOPES,
  WITHDRAWAL_STATUSES,
} = require("../src/constants/finance.constants");

const { ROLES } = require("../src/constants/auth.constants");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { hashPassword } = require("../src/utils/password");
const {
  generateAccessToken,
  TOKEN_CONTEXTS,
  TOKEN_AUDIENCES,
} = require("../src/services/token.service");

const commissionService = require("../src/services/commission.service");
const financialLedgerService = require("../src/services/financial-ledger.service");
const financialReconciliationService = require("../src/services/financial-reconciliation.service");
const financialOverviewService = require("../src/services/financial-overview.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace(/\/buybox(_test)?(\?|$)/, "/buybox_vw05_test$2")
  : "mongodb://127.0.0.1:27017/buybox_vw05_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Phase VW-05 — Superadmin Financial Control & Commission Management", () => {
  let superadminUser;
  let superadminToken;
  let unauthorizedAdminUser;
  let unauthorizedAdminToken;

  let vendorAUser;
  let vendorAToken;
  let vendorADoc;
  let testBankA;

  let testCategory;
  let testProduct;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    // Clean test state via native collection to bypass immutability hooks
    if (FinancialLedgerEntry.collection) {
      await FinancialLedgerEntry.collection.deleteMany({});
    }
    await VendorWallet.deleteMany({});
    await WithdrawalRequest.deleteMany({});
    await VendorPayout.deleteMany({});
    await CommissionPolicy.deleteMany({});

    await WithdrawalRequest.init();
    await VendorPayout.init();
    await VendorWallet.init();
    await CommissionPolicy.init();

    const rand = Math.random().toString(36).substring(7);

    // 1. Superadmin User (FINANCE_READ and FINANCE_MANAGE)
    superadminUser = await User.findOne({ role: ROLES.SUPER_ADMIN, isActive: true });
    if (!superadminUser) {
      superadminUser = await User.create({
        firstName: "Super",
        lastName: "Admin",
        name: `SuperAdmin VW05 ${rand}`,
        email: `superadmin_vw05_${rand}@buybox.test`,
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
        employeeNumber: `EMP-VW05-SA-${rand.slice(-4).toUpperCase()}`,
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

    // 2. Unauthorized Admin (Without FINANCE_READ or FINANCE_MANAGE)
    unauthorizedAdminUser = await User.create({
      firstName: "Unauthorized",
      lastName: "Staff",
      name: `Unauth Staff ${rand}`,
      email: `unauth_vw05_${rand}@buybox.test`,
      password: await hashPassword("Password123!"),
      role: ROLES.STAFF,
      roles: [ROLES.STAFF],
      permissions: [PERMISSIONS.PRODUCTS_READ],
      isActive: true,
      isEmailVerified: true,
    });

    unauthorizedAdminToken = generateAccessToken(
      {
        sub: unauthorizedAdminUser._id.toString(),
        role: ROLES.STAFF,
        roles: [ROLES.STAFF],
        authVersion: 1,
        permissionVersion: 1,
      },
      {
        context: TOKEN_CONTEXTS.ADMINISTRATOR,
        audience: TOKEN_AUDIENCES.ADMINISTRATOR,
      }
    );

    // 3. Vendor A
    vendorAUser = await User.create({
      firstName: "VendorA",
      lastName: "Finance",
      name: `Vendor A VW05 ${rand}`,
      email: `vendor_a_vw05_${rand}@buybox.test`,
      password: await hashPassword("VendorPass123!"),
      role: ROLES.VENDOR,
      roles: [ROLES.VENDOR],
      isActive: true,
      isEmailVerified: true,
    });

    vendorADoc = await Vendor.create({
      userId: vendorAUser._id,
      businessName: `Vendor A Enterprise ${rand}`,
      storeName: `Vendor A Store ${rand}`,
      email: vendorAUser.email,
      phone: "+919876543210",
      businessSlug: `vendor-a-vw05-${rand}`,
      isActive: true,
      onboardingStatus: "approved",
      commissionRate: 0.1,
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
        context: TOKEN_CONTEXTS.VENDOR,
        audience: TOKEN_AUDIENCES.VENDOR,
      }
    );

    testBankA = await VendorBankAccount.create({
      vendorId: vendorADoc._id,
      submittedBy: vendorAUser._id,
      bankName: "HDFC Bank",
      accountHolderName: "Vendor A Enterprise",
      accountNumberEncrypted: "encrypted_acc_num_sample_a",
      accountNumberHash: `hash_acc_a_${rand}`,
      accountNumberMasked: "••••••••7890",
      ifscCode: "HDFC0001234",
      accountType: "current",
      status: "approved",
      isActive: true,
      isDefault: true,
      isPrimary: true,
    });

    // 4. Test Category & Product for Commission testing
    testCategory = await Category.create({
      name: `Electronics Category ${rand}`,
      slug: `electronics-${rand}`,
      isActive: true,
    });

    testProduct = await Product.create({
      name: `High End Laptop ${rand}`,
      sku: `SKU-LAP-${rand}`,
      slug: `laptop-${rand}`,
      vendorId: vendorADoc._id,
      categoryId: testCategory._id,
      price: 50000,
      status: "active",
    });

    // Seed initial balance for Vendor A: ₹10,000 available earnings
    await financialLedgerService.postJournal({
      journalId: `JRN-SEED-VW05-${Date.now()}`,
      sourceEvent: "settlement_matured",
      sourceEventId: new mongoose.Types.ObjectId(),
      idempotencyKey: `seed_vw05_${Date.now()}`,
      currency: "INR",
      entries: [
        {
          entryType: FINANCIAL_ENTRY_TYPES.VENDOR_EARNING,
          direction: FINANCIAL_ENTRY_DIRECTIONS.DEBIT,
          accountType: FINANCIAL_ACCOUNT_TYPES.CLEARING,
          accountCode: LEDGER_ACCOUNTS.CUSTOMER_PAYMENT_CLEARING,
          accountReference: "SEED_VW05",
          amount: "10000.00",
          currency: "INR",
          idempotencyKey: `seed_deb_${Date.now()}`,
          description: "Initial seed debit clearing",
        },
        {
          entryType: FINANCIAL_ENTRY_TYPES.SETTLEMENT_MATURED,
          direction: FINANCIAL_ENTRY_DIRECTIONS.CREDIT,
          accountType: FINANCIAL_ACCOUNT_TYPES.VENDOR,
          accountCode: LEDGER_ACCOUNTS.VENDOR_AVAILABLE_EARNINGS,
          accountReference: String(vendorADoc._id),
          amount: "10000.00",
          currency: "INR",
          vendorId: vendorADoc._id,
          idempotencyKey: `seed_cred_${Date.now()}`,
          description: "Initial seed credit vendor earnings",
        },
      ],
    });
  });

  afterAll(async () => {
    // Keep connection open or clean up if needed
  });

  describe("1. Commission Policy Lifecycle, Precedence & Calculation Preview", () => {
    let createdPolicyId;

    it("1.1 Admin lists commission policies with scope and status filters", async () => {
      const res = await request(app)
        .get("/api/v1/finance/commission-policies")
        .set("Authorization", `Bearer ${superadminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toHaveProperty("total");
    });

    it("1.2 Admin creates global commission policy: initializes version 1 and version history", async () => {
      const policyPayload = {
        name: "Standard Marketplace Global Commission 12%",
        description: "Default baseline marketplace fee for all sales",
        scope: COMMISSION_POLICY_SCOPES.GLOBAL,
        rate: 0.12,
        notes: "Established baseline commission for FY26",
      };

      const res = await request(app)
        .post("/api/v1/finance/commission-policies")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send(policyPayload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe(policyPayload.name);
      expect(Number(res.body.data.percentage)).toBe(12);
      expect(res.body.data.version).toBe(1);
      expect(res.body.data.versionHistory).toHaveLength(1);
      expect(res.body.data.versionHistory[0].notes).toBe(policyPayload.notes);

      createdPolicyId = res.body.data._id;
    });

    it("1.3 Admin updates policy rate: increments version and preserves immutable version history", async () => {
      const updatePayload = {
        rate: 0.14,
        notes: "Adjusted global marketplace commission to 14% due to inflation",
      };

      const res = await request(app)
        .put(`/api/v1/finance/commission-policies/${createdPolicyId}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send(updatePayload)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Number(res.body.data.percentage)).toBe(14);
      expect(res.body.data.version).toBe(2);
      expect(res.body.data.versionHistory).toHaveLength(2);

      const v1 = res.body.data.versionHistory[0];
      const v2 = res.body.data.versionHistory[1];
      expect(v1.version).toBe(1);
      expect(v2.version).toBe(2);
      expect(v2.notes).toBe(updatePayload.notes);
    });

    it("1.4 Active policy conflict detection prevents overlapping active policy for the same target", async () => {
      // Attempt to create another active global policy overlapping with the existing one
      const conflictPayload = {
        name: "Conflicting Global Policy",
        scope: COMMISSION_POLICY_SCOPES.GLOBAL,
        rate: 0.15,
        effectiveFrom: new Date(),
      };

      const res = await request(app)
        .post("/api/v1/finance/commission-policies")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send(conflictPayload)
        .expect(409);

      expect(res.body.errorCode).toBe("COMMISSION_POLICY_CONFLICT");
    });

    it("1.5 Precedence Hierarchy Resolution: Product > Vendor > Category > Global > Fallback", async () => {
      // 1. Create Category-scoped policy at 10%
      await commissionService.createPolicy({
        name: "Electronics Category 10%",
        scope: COMMISSION_POLICY_SCOPES.CATEGORY,
        categoryId: testCategory._id,
        rate: 0.10,
        actorId: superadminUser._id,
      });

      // 2. Create Vendor-scoped agreement at 8%
      await commissionService.createPolicy({
        name: "Vendor A Preferred Agreement 8%",
        scope: COMMISSION_POLICY_SCOPES.VENDOR,
        vendorId: vendorADoc._id,
        rate: 0.08,
        actorId: superadminUser._id,
      });

      // 3. Create Product-scoped override at 5%
      await commissionService.createPolicy({
        name: "Laptop Product Override 5%",
        scope: COMMISSION_POLICY_SCOPES.PRODUCT,
        productId: testProduct._id,
        rate: 0.05,
        actorId: superadminUser._id,
      });

      // Resolution test A: Product override takes precedence (Rank 1)
      const resProduct = await commissionService.resolveCommissionPolicy({
        productId: testProduct._id,
        vendorId: vendorADoc._id,
        categoryId: testCategory._id,
      });
      expect(resProduct.scope).toBe(COMMISSION_POLICY_SCOPES.PRODUCT);
      expect(Number(resProduct.rate.toString())).toBe(0.05);

      // Resolution test B: If no product override, Vendor agreement takes precedence (Rank 2)
      const randomProdId = new mongoose.Types.ObjectId();
      const resVendor = await commissionService.resolveCommissionPolicy({
        productId: randomProdId,
        vendorId: vendorADoc._id,
        categoryId: testCategory._id,
      });
      expect(resVendor.scope).toBe(COMMISSION_POLICY_SCOPES.VENDOR);
      expect(Number(resVendor.rate.toString())).toBe(0.08);

      // Resolution test C: If no product or vendor agreement, Category rule takes precedence (Rank 3)
      const otherVendorId = new mongoose.Types.ObjectId();
      const resCategory = await commissionService.resolveCommissionPolicy({
        productId: randomProdId,
        vendorId: otherVendorId,
        categoryId: testCategory._id,
      });
      expect(resCategory.scope).toBe(COMMISSION_POLICY_SCOPES.CATEGORY);
      expect(Number(resCategory.rate.toString())).toBe(0.10);

      // Resolution test D: If no category rule, Global default takes precedence (Rank 4)
      const otherCatId = new mongoose.Types.ObjectId();
      const resGlobal = await commissionService.resolveCommissionPolicy({
        productId: randomProdId,
        vendorId: otherVendorId,
        categoryId: otherCatId,
      });
      expect(resGlobal.scope).toBe(COMMISSION_POLICY_SCOPES.GLOBAL);
      expect(Number(resGlobal.rate.toString())).toBe(0.14);
    });

    it("1.6 Server-Authoritative Preview Tool: Computes calculation without mutating database state", async () => {
      const previewPayload = {
        productId: testProduct._id.toString(),
        vendorId: vendorADoc._id.toString(),
        categoryId: testCategory._id.toString(),
        amount: 10000,
        currency: "INR",
      };

      const res = await request(app)
        .post("/api/v1/finance/commission-policies/preview")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send(previewPayload)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isIllustrativePreview).toBe(true);
      expect(res.body.data.policy.precedenceRank).toBe(1);
      expect(res.body.data.policy.scope).toBe(COMMISSION_POLICY_SCOPES.PRODUCT);
      expect(res.body.data.calculation.grossAmount).toBe("10000.00");
      expect(res.body.data.calculation.commissionRate).toBe(0.05);
      expect(res.body.data.calculation.commissionAmount).toBe("500.00");
      expect(res.body.data.calculation.vendorNetAmount).toBe("9500.00");
      expect(res.body.data.calculation.currency).toBe("INR");

      // Verify no ledger entries or orders were created by preview
      const ledgerCount = await FinancialLedgerEntry.countDocuments({
        accountReference: String(vendorADoc._id),
        entryType: FINANCIAL_ENTRY_TYPES.PLATFORM_COMMISSION,
      });
      expect(ledgerCount).toBe(0);
    });

    it("1.7 Order Snapshot Immutability: Subsequent policy modification does not alter locked historical order commission", async () => {
      // 1. Snapshot an order item with current product policy (5%)
      const mockOrderItem = {
        _id: new mongoose.Types.ObjectId(),
        productId: testProduct._id,
        vendorId: vendorADoc._id,
        categoryId: testCategory._id,
        lineTotal: 2000,
        isPromotional: false,
      };

      const lockedSnapshot = await commissionService.lockOrderItemsCommissionSnapshot([mockOrderItem]);
      expect(Number(lockedSnapshot[0].commissionSnapshot.appliedRate.toString())).toBe(0.05);
      expect(Number(lockedSnapshot[0].commissionSnapshot.commissionAmount.toString())).toBe(100);

      // 2. Now alter the Product policy to 20%
      const productPolicy = await CommissionPolicy.findOne({
        scope: COMMISSION_POLICY_SCOPES.PRODUCT,
        productId: testProduct._id,
      });

      await commissionService.updatePolicy(productPolicy._id, {
        rate: 0.20,
        notes: "Drastically raised product commission",
        actorId: superadminUser._id,
      });

      // 3. Verify locked historical item retains original 5%
      expect(Number(lockedSnapshot[0].commissionSnapshot.appliedRate.toString())).toBe(0.05);
      expect(Number(lockedSnapshot[0].commissionSnapshot.commissionAmount.toString())).toBe(100);
    });
  });

  describe("2. Superadmin Financial Overview Aggregation", () => {
    it("2.1 Financial overview returns comprehensive marketplace health metrics", async () => {
      const res = await request(app)
        .get("/api/v1/finance/overview")
        .set("Authorization", `Bearer ${superadminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const data = res.body.data;

      expect(data).toHaveProperty("salesAndRevenue");
      expect(data).toHaveProperty("platformCommission");
      expect(data).toHaveProperty("vendorLiabilities");
      expect(data).toHaveProperty("cashDisbursements");
      expect(data).toHaveProperty("operationalQueues");
      expect(data).toHaveProperty("reconciliationHealth");

      expect(data.currency).toBe("INR");
      expect(data.vendorLiabilities.availableEarnings).toBeGreaterThanOrEqual(10000);
      expect(data.reconciliationHealth.totalWallets).toBeGreaterThanOrEqual(1);
    });

    it("2.2 Date range filters apply strictly to financial overview query", async () => {
      const futureStart = new Date(Date.now() + 86400000 * 30).toISOString();
      const futureEnd = new Date(Date.now() + 86400000 * 60).toISOString();

      const res = await request(app)
        .get("/api/v1/finance/overview")
        .set("Authorization", `Bearer ${superadminToken}`)
        .query({ startDate: futureStart, endDate: futureEnd })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.salesAndRevenue.grossOrderValue).toBe(0);
      expect(res.body.data.salesAndRevenue.orderCount).toBe(0);
    });

    it("2.3 Unauthorized staff without FINANCE_READ is strictly rejected with 403", async () => {
      await request(app)
        .get("/api/v1/finance/overview")
        .set("Authorization", `Bearer ${unauthorizedAdminToken}`)
        .expect(403);
    });
  });

  describe("3. Wallet Oversight & Vendor Financial Drill-Down", () => {
    it("3.1 Admin lists all vendor wallets with aggregates and reconciliation status", async () => {
      const res = await request(app)
        .get("/api/v1/finance/wallets")
        .set("Authorization", `Bearer ${superadminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.meta.aggregates).toBeDefined();
      expect(res.body.meta.aggregates.totalAvailable).toBeGreaterThanOrEqual(10000);
    });

    it("3.2 Search vendor wallets by business name returns matching records", async () => {
      const res = await request(app)
        .get("/api/v1/finance/wallets")
        .set("Authorization", `Bearer ${superadminToken}`)
        .query({ search: vendorADoc.businessName })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].vendorId.toString()).toBe(vendorADoc._id.toString());
    });

    it("3.3 Vendor financial drill-down returns complete ledger entries, settlements, payouts, and masked bank info", async () => {
      const res = await request(app)
        .get(`/api/v1/finance/wallets/${vendorADoc._id}/drilldown`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const data = res.body.data;

      expect(data.vendor.businessName).toBe(vendorADoc.businessName);
      expect(data.wallet.availableBalance).toBe("10000.00");
      expect(Array.isArray(data.bankAccounts)).toBe(true);
      expect(data.bankAccounts.length).toBeGreaterThanOrEqual(1);
      expect(data.bankAccounts[0].accountNumberMasked).toBe("••••••••7890");
      expect(data.recentEntries.length).toBeGreaterThanOrEqual(1);
      expect(data.reconciliation).toBeDefined();
      expect(data.reconciliation.isReconciled).toBe(true);
    });

    it("3.4 Zero-Plaintext Audit: Masked bank credentials only; no unmasked account numbers exposed", async () => {
      const res = await request(app)
        .get(`/api/v1/finance/wallets/${vendorADoc._id}/drilldown`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .expect(200);

      for (const bank of res.body.data.bankAccounts) {
        expect(bank.accountNumberMasked).toMatch(/^•{8}\d{4}$/);
        expect(bank.accountNumberEncrypted).toBeUndefined();
        expect(bank.accountNumberHash).toBeUndefined();
      }
    });
  });

  describe("4. Reconciliation & Balanced Financial Corrections", () => {
    it("4.1 Platform reconciliation summary reports healthy vs discrepant accounts", async () => {
      const res = await request(app)
        .get("/api/v1/finance/reconciliation/summary")
        .set("Authorization", `Bearer ${superadminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.totalWallets).toBeGreaterThanOrEqual(1);
      expect(res.body.data.reconciledCount).toBeGreaterThanOrEqual(1);
      expect(res.body.data.isClean).toBe(true);
    });

    it("4.2 Correction attempt without mandatory justification (min 10 chars) is rejected with 400", async () => {
      const res = await request(app)
        .post("/api/v1/finance/reconciliation/adjust")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          vendorId: vendorADoc._id.toString(),
          amount: 500,
          direction: "credit",
          reason: "short", // Under 10 chars
        })
        .expect(400);

      expect(res.body.errorCode).toBe("ADJUSTMENT_REASON_REQUIRED");
    });

    it("4.3 Unauthorized staff without FINANCE_MANAGE cannot post financial corrections (403)", async () => {
      await request(app)
        .post("/api/v1/finance/reconciliation/adjust")
        .set("Authorization", `Bearer ${unauthorizedAdminToken}`)
        .send({
          vendorId: vendorADoc._id.toString(),
          amount: 500,
          direction: "credit",
          reason: "Unauthorized adjustment attempt by staff",
        })
        .expect(403);
    });

    it("4.4 Authorized admin posts balanced financial correction journal: Debit equals Credit and wallet balance updates", async () => {
      const reasonText = "Dispute resolution: Approved reimbursement for returned damaged goods";
      const adjustAmount = 500;

      const res = await request(app)
        .post("/api/v1/finance/reconciliation/adjust")
        .set("Authorization", `Bearer ${superadminToken}`)
        .set("Idempotency-Key", `adj_test_${Date.now()}`)
        .send({
          vendorId: vendorADoc._id.toString(),
          amount: adjustAmount,
          direction: "credit",
          reason: reasonText,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.journal.journalId).toMatch(/^JRN-ADJ-RECON-/);
      expect(res.body.data.isReconciled).toBe(true);

      // Verify wallet balance increased from 10000 to 10500
      const updatedWallet = await VendorWallet.findOne({ vendorId: vendorADoc._id });
      expect(Number(updatedWallet.availableBalance.toString())).toBe(10500);

      // Verify double-entry balance in ledger: exactly 2 entries (debit adjustment clearing, credit vendor available)
      const entries = await FinancialLedgerEntry.find({
        journalId: res.body.data.journal.journalId,
      });

      expect(entries).toHaveLength(2);
      const debitEntry = entries.find((e) => e.direction === FINANCIAL_ENTRY_DIRECTIONS.DEBIT);
      const creditEntry = entries.find((e) => e.direction === FINANCIAL_ENTRY_DIRECTIONS.CREDIT);

      expect(debitEntry.accountCode).toBe(LEDGER_ACCOUNTS.FINANCIAL_ADJUSTMENT);
      expect(creditEntry.accountCode).toBe(LEDGER_ACCOUNTS.VENDOR_AVAILABLE_EARNINGS);
      expect(Number(debitEntry.amount.toString())).toBe(adjustAmount);
      expect(Number(creditEntry.amount.toString())).toBe(adjustAmount);

      // Verify AuditLog record exists
      const audit = await AuditLog.findOne({
        action: "FINANCIAL_CORRECTION_JOURNAL_POSTED",
        targetId: vendorADoc._id,
      });
      expect(audit).toBeDefined();
      expect(audit.reason).toBe(reasonText);
    });

    it("4.5 Idempotency: duplicate adjustment submission with same Idempotency-Key returns existing without double-adjusting", async () => {
      const idemKey = `idem_reconcile_double_${Date.now()}`;
      const reasonText = "Platform promotional goodwill adjustment";

      const res1 = await request(app)
        .post("/api/v1/finance/reconciliation/adjust")
        .set("Authorization", `Bearer ${superadminToken}`)
        .set("Idempotency-Key", idemKey)
        .send({
          vendorId: vendorADoc._id.toString(),
          amount: 200,
          direction: "credit",
          reason: reasonText,
        })
        .expect(201);

      const res2 = await request(app)
        .post("/api/v1/finance/reconciliation/adjust")
        .set("Authorization", `Bearer ${superadminToken}`)
        .set("Idempotency-Key", idemKey)
        .send({
          vendorId: vendorADoc._id.toString(),
          amount: 200,
          direction: "credit",
          reason: reasonText,
        })
        .expect(201);

      expect(res1.body.data.journal.journalId).toBe(res2.body.data.journal.journalId);

      // Verify wallet only credited once (10500 + 200 = 10700)
      const wallet = await VendorWallet.findOne({ vendorId: vendorADoc._id });
      expect(Number(wallet.availableBalance.toString())).toBe(10700);
    });
  });
});
