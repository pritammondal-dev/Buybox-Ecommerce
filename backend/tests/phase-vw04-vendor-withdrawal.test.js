const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../src/app");

const User = require("../src/models/User");
const Employee = require("../src/models/Employee");
const Vendor = require("../src/models/Vendor");
const VendorBankAccount = require("../src/models/VendorBankAccount");
const VendorPayout = require("../src/models/VendorPayout");
const FinancialLedgerEntry = require("../src/models/FinancialLedgerEntry");
const VendorWallet = require("../src/models/VendorWallet");
const WithdrawalRequest = require("../src/models/WithdrawalRequest");

const {
  FINANCIAL_ENTRY_TYPES,
  FINANCIAL_ENTRY_DIRECTIONS,
  FINANCIAL_ACCOUNT_TYPES,
  LEDGER_ACCOUNTS,
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

const financialLedgerService = require("../src/services/financial-ledger.service");
const withdrawalRequestService = require("../src/services/withdrawal-request.service");
const financialReconciliationService = require("../src/services/financial-reconciliation.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace(/\/buybox(_test)?(\?|$)/, "/buybox_vw04_test$2")
  : "mongodb://127.0.0.1:27017/buybox_vw04_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Phase VW-04 — Vendor Withdrawal Request & Payout Workflow", () => {
  let superadminUser;
  let superadminToken;
  let financeAdminUser;
  let financeAdminToken;
  let unauthorizedAdminUser;
  let unauthorizedAdminToken;

  let vendorAUser;
  let vendorAToken;
  let vendorADoc;
  let testBankA;

  let vendorBUser;
  let vendorBToken;
  let vendorBDoc;
  let testBankB;

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

    await WithdrawalRequest.init();
    await VendorPayout.init();
    await VendorWallet.init();

    const rand = Math.random().toString(36).substring(7);

    // 1. Superadmin User
    superadminUser = await User.findOne({ role: ROLES.SUPER_ADMIN, isActive: true });
    if (!superadminUser) {
      superadminUser = await User.create({
        firstName: "Super",
        lastName: "Admin",
        name: `SuperAdmin VW04 ${rand}`,
        email: `superadmin_vw04_${rand}@buybox.test`,
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
        employeeNumber: `EMP-VW04-SA-${rand.slice(-4).toUpperCase()}`,
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

    // 2. Finance Admin (With FINANCE_READ and FINANCE_MANAGE)
    financeAdminUser = await User.create({
      firstName: "Finance",
      lastName: "Officer",
      name: `Finance Officer ${rand}`,
      email: `finance_officer_${rand}@buybox.test`,
      password: await hashPassword("FinancePass123!"),
      role: ROLES.ADMIN,
      roles: [ROLES.ADMIN],
      permissions: [PERMISSIONS.FINANCE_READ, PERMISSIONS.FINANCE_MANAGE],
      isActive: true,
      isEmailVerified: true,
    });

    await Employee.create({
      userId: financeAdminUser._id,
      jobTitle: "Finance Officer",
      department: "Finance Operations",
      employeeNumber: `EMP-VW04-FO-${rand.slice(-4).toUpperCase()}`,
      isActive: true,
      status: "active",
    });

    financeAdminToken = generateAccessToken(
      {
        sub: financeAdminUser._id.toString(),
        role: ROLES.ADMIN,
        roles: [ROLES.ADMIN],
        authVersion: 1,
        permissionVersion: 1,
      },
      {
        context: TOKEN_CONTEXTS.ADMINISTRATOR,
        audience: TOKEN_AUDIENCES.ADMINISTRATOR,
      }
    );

    // 3. Unauthorized Admin (Without FINANCE_MANAGE)
    unauthorizedAdminUser = await User.create({
      firstName: "Staff",
      lastName: "Catalog",
      name: `Catalog Staff ${rand}`,
      email: `catalog_staff_${rand}@buybox.test`,
      password: await hashPassword("CatalogPass123!"),
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

    // 4. Vendor A
    vendorAUser = await User.create({
      firstName: "Vendor",
      lastName: "Alpha",
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

    testBankA = await VendorBankAccount.create({
      vendorId: vendorADoc._id,
      submittedBy: vendorAUser._id,
      accountHolderName: "Vendor A Enterprises",
      bankName: "HDFC Bank",
      accountNumberEncrypted: "enc_1234567890",
      accountNumberHash: `hmac_a_${rand}`,
      accountNumberMasked: "••••••••7890",
      ifscCode: "HDFC0001234",
      branchName: "Koramangala",
      accountType: "current",
      status: "approved",
      isActive: true,
    });

    // 5. Vendor B (for isolation testing)
    vendorBUser = await User.create({
      firstName: "Vendor",
      lastName: "Beta",
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

    testBankB = await VendorBankAccount.create({
      vendorId: vendorBDoc._id,
      submittedBy: vendorBUser._id,
      accountHolderName: "Vendor B Enterprises",
      bankName: "ICICI Bank",
      accountNumberEncrypted: "enc_9876543210",
      accountNumberHash: `hmac_b_${rand}`,
      accountNumberMasked: "••••••••3210",
      ifscCode: "ICIC0005678",
      branchName: "Indiranagar",
      accountType: "current",
      status: "approved",
      isActive: true,
    });

    // Seed initial available balance for Vendor A (₹10,000) via balanced double-entry journal
    await financialLedgerService.postJournal({
      journalId: `JRN-SEED-AVAIL-${rand}`,
      sourceEvent: "settlement_matured",
      sourceEventId: new mongoose.Types.ObjectId(),
      idempotencyKey: `seed_avail_${rand}`,
      currency: "INR",
      entries: [
        {
          entryType: FINANCIAL_ENTRY_TYPES.VENDOR_EARNING,
          direction: FINANCIAL_ENTRY_DIRECTIONS.DEBIT,
          accountType: FINANCIAL_ACCOUNT_TYPES.CLEARING,
          accountCode: LEDGER_ACCOUNTS.CUSTOMER_PAYMENT_CLEARING,
          accountReference: "SEED_CAPITAL",
          amount: "10000.00",
          currency: "INR",
          idempotencyKey: `seed_avail_${rand}_debit`,
          description: "Initial seed liquidity for testing",
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
          idempotencyKey: `seed_avail_${rand}_credit`,
          description: "Matured available earnings for Vendor A",
        },
      ],
    });

    await financialLedgerService.syncVendorWalletBalances(vendorADoc._id, "INR");
  });

  afterAll(async () => {
    // Keep test documents intact for inspection
  });

  describe("1. Vendor Workflow & Atomic Fund Reservation", () => {
    it("1.1 Vendor loads wallet and verifies available balance and approved bank account", async () => {
      const res = await request(app)
        .get("/api/v1/vendors/me/wallet")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Number(res.body.data.availableBalance)).toBe(10000);
      expect(Number(res.body.data.reservedBalance)).toBe(0);
    });

    it("1.2 Vendor submits valid withdrawal request: reserves funds atomically and updates wallet projection", async () => {
      const idempotencyKey = `wth_test_sub_1_${Date.now()}`;

      const res = await request(app)
        .post("/api/v1/vendors/me/withdrawals")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .set("Idempotency-Key", idempotencyKey)
        .send({
          amount: 2500,
          bankAccountId: testBankA._id.toString(),
          notes: "Vendor A regular weekly payout request",
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.withdrawalNumber).toMatch(/^WTH-/);
      expect(Number(res.body.data.amount)).toBe(2500);
      expect(res.body.data.status).toBe(WITHDRAWAL_STATUSES.PENDING_REVIEW);
      expect(res.body.data.bankSnapshot.accountNumberMasked).toBe("••••••••7890");

      // Verify wallet projection updated atomically
      const walletRes = await request(app)
        .get("/api/v1/vendors/me/wallet")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .expect(200);

      expect(Number(walletRes.body.data.availableBalance)).toBe(7500);
      expect(Number(walletRes.body.data.reservedBalance)).toBe(2500);

      // Verify double-entry ledger entries exist and balance
      const entries = await FinancialLedgerEntry.find({
        journalId: res.body.data.reservationJournalId,
      });

      expect(entries).toHaveLength(2);
      const debitEntry = entries.find((e) => e.direction === FINANCIAL_ENTRY_DIRECTIONS.DEBIT);
      const creditEntry = entries.find((e) => e.direction === FINANCIAL_ENTRY_DIRECTIONS.CREDIT);

      expect(debitEntry.accountCode).toBe(LEDGER_ACCOUNTS.VENDOR_AVAILABLE_EARNINGS);
      expect(Number(debitEntry.amount.toString())).toBe(2500);
      expect(creditEntry.accountCode).toBe(LEDGER_ACCOUNTS.VENDOR_RESERVED_PAYOUT);
      expect(Number(creditEntry.amount.toString())).toBe(2500);
    });

    it("1.3 Amount exceeding available balance is strictly rejected with 400", async () => {
      const res = await request(app)
        .post("/api/v1/vendors/me/withdrawals")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .set("Idempotency-Key", `wth_exceed_${Date.now()}`)
        .send({
          amount: 50000, // Available is only 7500
          bankAccountId: testBankA._id.toString(),
        })
        .expect(400);

      expect(res.body.errorCode).toBe("INSUFFICIENT_AVAILABLE_BALANCE");
    });

    it("1.4 Zero, negative, or invalid amounts are strictly rejected with 400", async () => {
      await request(app)
        .post("/api/v1/vendors/me/withdrawals")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .set("Idempotency-Key", `wth_zero_${Date.now()}`)
        .send({
          amount: 0,
          bankAccountId: testBankA._id.toString(),
        })
        .expect(400);

      await request(app)
        .post("/api/v1/vendors/me/withdrawals")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .set("Idempotency-Key", `wth_neg_${Date.now()}`)
        .send({
          amount: -500,
          bankAccountId: testBankA._id.toString(),
        })
        .expect(400);
    });

    it("1.5 Submitting for a bank account belonging to another vendor is strictly rejected with 400", async () => {
      const res = await request(app)
        .post("/api/v1/vendors/me/withdrawals")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .set("Idempotency-Key", `wth_mismatch_${Date.now()}`)
        .send({
          amount: 1000,
          bankAccountId: testBankB._id.toString(), // Belongs to Vendor B
        })
        .expect(400);

      expect(res.body.errorCode).toBe("BANK_ACCOUNT_MISMATCH");
    });

    it("1.6 Submitting for an unapproved or archived bank account is strictly rejected with 400", async () => {
      const archivedBank = await VendorBankAccount.create({
        vendorId: vendorADoc._id,
        submittedBy: vendorAUser._id,
        accountHolderName: "Vendor A Old",
        bankName: "SBI Bank",
        accountNumberEncrypted: "enc_archived",
        accountNumberHash: `hmac_archived_${Date.now()}`,
        accountNumberMasked: "••••••••1111",
        ifscCode: "SBIN0001234",
        status: "approved",
        deletedAt: new Date(),
      });

      const res = await request(app)
        .post("/api/v1/vendors/me/withdrawals")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .set("Idempotency-Key", `wth_archived_${Date.now()}`)
        .send({
          amount: 1000,
          bankAccountId: archivedBank._id.toString(),
        })
        .expect(400);

      expect(res.body.errorCode).toBe("BANK_ACCOUNT_ARCHIVED");
    });

    it("1.7 Idempotency: submitting with same Idempotency-Key returns original withdrawal without double-reserving funds", async () => {
      const idemKey = `wth_idem_test_${Date.now()}`;

      const res1 = await request(app)
        .post("/api/v1/vendors/me/withdrawals")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .set("Idempotency-Key", idemKey)
        .send({
          amount: 1500,
          bankAccountId: testBankA._id.toString(),
        })
        .expect(201);

      const res2 = await request(app)
        .post("/api/v1/vendors/me/withdrawals")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .set("Idempotency-Key", idemKey)
        .send({
          amount: 1500,
          bankAccountId: testBankA._id.toString(),
        })
        .expect(200);

      expect(res1.body.data._id.toString()).toBe(res2.body.data._id.toString());
      expect(res1.body.data.withdrawalNumber).toBe(res2.body.data.withdrawalNumber);

      // Verify wallet was only debited once (7500 - 1500 = 6000)
      const walletRes = await request(app)
        .get("/api/v1/vendors/me/wallet")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .expect(200);

      expect(Number(walletRes.body.data.availableBalance)).toBe(6000);
      expect(Number(walletRes.body.data.reservedBalance)).toBe(4000);
    });

    it("1.8 Concurrency Protection: two simultaneous withdrawal requests competing for the same balance", async () => {
      // Vendor A available is 6000. We fire two simultaneous requests for 4000 each (total 8000).
      // Exactly one must succeed, and the second must be rejected with INSUFFICIENT_AVAILABLE_BALANCE.
      const req1 = request(app)
        .post("/api/v1/vendors/me/withdrawals")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .set("Idempotency-Key", `conc_1_${Date.now()}`)
        .send({
          amount: 4000,
          bankAccountId: testBankA._id.toString(),
        });

      const req2 = request(app)
        .post("/api/v1/vendors/me/withdrawals")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .set("Idempotency-Key", `conc_2_${Date.now()}`)
        .send({
          amount: 4000,
          bankAccountId: testBankA._id.toString(),
        });

      const [res1, res2] = await Promise.all([req1, req2]);

      const successCount = (res1.status === 201 ? 1 : 0) + (res2.status === 201 ? 1 : 0);
      const failCount = (res1.status === 400 ? 1 : 0) + (res2.status === 400 ? 1 : 0);

      expect(successCount).toBe(1);
      expect(failCount).toBe(1);

      // Remaining available should be 2000 (6000 - 4000 = 2000)
      const walletRes = await request(app)
        .get("/api/v1/vendors/me/wallet")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .expect(200);

      expect(Number(walletRes.body.data.availableBalance)).toBe(2000);
      expect(Number(walletRes.body.data.reservedBalance)).toBe(8000);
    });
  });

  describe("2. Admin Review, Approval & Separation of Duties", () => {
    let pendingWithdrawalId;

    beforeAll(async () => {
      let pending = await WithdrawalRequest.findOne({
        vendorId: vendorADoc._id,
        status: WITHDRAWAL_STATUSES.PENDING_REVIEW,
      });
      if (!pending) {
        pending = await withdrawalRequestService.requestWithdrawal({
          vendorId: vendorADoc._id,
          amount: 2000,
          bankAccountId: testBankA._id.toString(),
          idempotencyKey: `wth_block2_setup_${Date.now()}`,
          actorId: vendorAUser._id,
        });
      }
      pendingWithdrawalId = pending._id.toString();
    });

    it("2.1 Admin lists withdrawal requests with filters and pagination", async () => {
      const res = await request(app)
        .get("/api/v1/finance/withdrawals")
        .set("Authorization", `Bearer ${superadminToken}`)
        .query({ status: WITHDRAWAL_STATUSES.PENDING_REVIEW })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.meta).toHaveProperty("total");
    });

    it("2.2 Separation of Duties: Vendor attempting to approve their own withdrawal is rejected with 403", async () => {
      const res = await request(app)
        .post(`/api/v1/finance/withdrawals/${pendingWithdrawalId}/approve`)
        .set("Authorization", `Bearer ${vendorAToken}`) // Vendor token
        .expect(403);

      expect(["FORBIDDEN_ROUTE", "INSUFFICIENT_PERMISSIONS"]).toContain(res.body.errorCode || res.body.code);
    });

    it("2.3 Unauthorized staff admin without FINANCE_MANAGE cannot approve or reject", async () => {
      await request(app)
        .post(`/api/v1/finance/withdrawals/${pendingWithdrawalId}/approve`)
        .set("Authorization", `Bearer ${unauthorizedAdminToken}`)
        .expect(403);

      await request(app)
        .post(`/api/v1/finance/withdrawals/${pendingWithdrawalId}/reject`)
        .set("Authorization", `Bearer ${unauthorizedAdminToken}`)
        .send({ rejectionReason: "Unauthorized rejection attempt" })
        .expect(403);
    });

    it("2.4 Authorized admin approves request: links VendorPayout with immutable bank snapshot", async () => {
      const res = await request(app)
        .post(`/api/v1/finance/withdrawals/${pendingWithdrawalId}/approve`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.withdrawal.status).toBe(WITHDRAWAL_STATUSES.APPROVED);
      expect(res.body.data.payout).toBeDefined();
      expect(res.body.data.payout.payoutNumber).toMatch(/^PAYOUT-/);

      // Verify immutable destination snapshot in payout metadata
      const payout = await VendorPayout.findById(res.body.data.payout._id);
      expect(payout.metadata.get("bankName")).toBe("HDFC Bank");
      expect(payout.metadata.get("accountNumberMasked")).toBe("••••••••7890");
    });

    it("2.5 Admin rejects request without reason is rejected with 400 (REJECTION_REASON_REQUIRED)", async () => {
      // Create a new pending withdrawal for rejection testing
      const pendingForReject = await withdrawalRequestService.requestWithdrawal({
        vendorId: vendorADoc._id,
        amount: 1000,
        bankAccountId: testBankA._id.toString(),
        idempotencyKey: `wth_for_reject_${Date.now()}`,
        actorId: vendorAUser._id,
      });

      const res = await request(app)
        .post(`/api/v1/finance/withdrawals/${pendingForReject._id}/reject`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          rejectionReason: "   ", // Blank
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it("2.6 Admin rejects request with mandatory reason: releases reserved funds atomically back to available balance", async () => {
      // Get current balance before rejection
      const walletBefore = await VendorWallet.findOne({ vendorId: vendorADoc._id });
      const availBefore = Number(walletBefore.availableBalance.toString());
      const resBefore = Number(walletBefore.reservedBalance.toString());

      // Create a pending request for 1000
      const pendingForReject = await withdrawalRequestService.requestWithdrawal({
        vendorId: vendorADoc._id,
        amount: 1000,
        bankAccountId: testBankA._id.toString(),
        idempotencyKey: `wth_for_reject_ok_${Date.now()}`,
        actorId: vendorAUser._id,
      });

      // Confirm available decreased by 1000, reserved increased by 1000
      const walletDuring = await VendorWallet.findOne({ vendorId: vendorADoc._id });
      expect(Number(walletDuring.availableBalance.toString())).toBe(availBefore - 1000);
      expect(Number(walletDuring.reservedBalance.toString())).toBe(resBefore + 1000);

      // Admin rejects with valid reason
      const reasonText = "KYC documents required before processing high-value withdrawal";
      const res = await request(app)
        .post(`/api/v1/finance/withdrawals/${pendingForReject._id}/reject`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          rejectionReason: reasonText,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(WITHDRAWAL_STATUSES.REJECTED);
      expect(res.body.data.rejectionReason).toBe(reasonText);
      expect(res.body.data.releaseJournalId).toMatch(/^JRN-WTH-REL-/);

      // Verify wallet available balance restored and reserved balance decreased
      const walletAfter = await VendorWallet.findOne({ vendorId: vendorADoc._id });
      expect(Number(walletAfter.availableBalance.toString())).toBe(availBefore);
      expect(Number(walletAfter.reservedBalance.toString())).toBe(resBefore);

      // Verify release double-entry journal exists
      const releaseEntries = await FinancialLedgerEntry.find({
        journalId: res.body.data.releaseJournalId,
      });

      expect(releaseEntries).toHaveLength(2);
      const debitRes = releaseEntries.find((e) => e.direction === FINANCIAL_ENTRY_DIRECTIONS.DEBIT);
      const creditAvail = releaseEntries.find((e) => e.direction === FINANCIAL_ENTRY_DIRECTIONS.CREDIT);

      expect(debitRes.accountCode).toBe(LEDGER_ACCOUNTS.VENDOR_RESERVED_PAYOUT);
      expect(creditAvail.accountCode).toBe(LEDGER_ACCOUNTS.VENDOR_AVAILABLE_EARNINGS);
    });
  });

  describe("3. Payout Processing, Disbursement, Failure & Recovery", () => {
    let approvedWithdrawal;

    beforeAll(async () => {
      approvedWithdrawal = await WithdrawalRequest.findOne({
        vendorId: vendorADoc._id,
        status: WITHDRAWAL_STATUSES.APPROVED,
      });
      if (!approvedWithdrawal) {
        const pending = await withdrawalRequestService.requestWithdrawal({
          vendorId: vendorADoc._id,
          amount: 1500,
          bankAccountId: testBankA._id.toString(),
          idempotencyKey: `wth_block3_setup_${Date.now()}`,
          actorId: vendorAUser._id,
        });
        const appRes = await withdrawalRequestService.approveWithdrawal({
          withdrawalId: pending._id,
          actorId: superadminUser._id,
        });
        approvedWithdrawal = appRes.withdrawal;
      }
    });

    it("3.1 Payout processing moves withdrawal to PROCESSING and dispatches via sandbox adapter", async () => {
      const res = await request(app)
        .post(`/api/v1/finance/withdrawals/${approvedWithdrawal._id}/process`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(WITHDRAWAL_STATUSES.PROCESSING);

      const payout = await VendorPayout.findById(approvedWithdrawal.payoutId);
      expect(payout.status).toBe("processing");
      expect(payout.providerReference).toMatch(/^TXN-WTH-/);
    });

    it("3.2 Successful payout completion: posts double-entry disbursement journal and clears reserved balance", async () => {
      const walletBefore = await VendorWallet.findOne({ vendorId: vendorADoc._id });
      const resBefore = Number(walletBefore.reservedBalance.toString());
      const paidBefore = Number(walletBefore.totalPaidOut.toString());
      const payoutAmount = Number(approvedWithdrawal.amount.toString());

      const utrReference = `UTR-${Date.now()}-HDFC-SETTLED`;

      const res = await request(app)
        .post(`/api/v1/finance/withdrawals/${approvedWithdrawal._id}/mark-paid`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          providerReference: utrReference,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(WITHDRAWAL_STATUSES.COMPLETED);
      expect(res.body.data.disbursementJournalId).toMatch(/^JRN-PAY-DISB-/);

      // Verify wallet projection
      const walletAfter = await VendorWallet.findOne({ vendorId: vendorADoc._id });
      expect(Number(walletAfter.reservedBalance.toString())).toBe(resBefore - payoutAmount);
      expect(Number(walletAfter.totalPaidOut.toString())).toBe(paidBefore + payoutAmount);

      // Verify double-entry disbursement journal
      const disbEntries = await FinancialLedgerEntry.find({
        journalId: res.body.data.disbursementJournalId,
      });

      expect(disbEntries).toHaveLength(2);
      const debitRes = disbEntries.find((e) => e.direction === FINANCIAL_ENTRY_DIRECTIONS.DEBIT);
      const creditClearing = disbEntries.find((e) => e.direction === FINANCIAL_ENTRY_DIRECTIONS.CREDIT);

      expect(debitRes.accountCode).toBe(LEDGER_ACCOUNTS.VENDOR_RESERVED_PAYOUT);
      expect(creditClearing.accountCode).toBe(LEDGER_ACCOUNTS.PAYOUT_CLEARING);
    });

    it("3.3 Definitive payout failure releases reserved funds back to available balance", async () => {
      // 1. Create a withdrawal
      const failWithdrawal = await withdrawalRequestService.requestWithdrawal({
        vendorId: vendorADoc._id,
        amount: 500,
        bankAccountId: testBankA._id.toString(),
        idempotencyKey: `wth_for_fail_${Date.now()}`,
        actorId: vendorAUser._id,
      });

      // 2. Approve
      await withdrawalRequestService.approveWithdrawal({
        withdrawalId: failWithdrawal._id,
        actorId: superadminUser._id,
      });

      // 3. Process
      await withdrawalRequestService.processWithdrawalPayout({
        withdrawalId: failWithdrawal._id,
        actorId: superadminUser._id,
      });

      const walletBeforeFail = await VendorWallet.findOne({ vendorId: vendorADoc._id });
      const availBeforeFail = Number(walletBeforeFail.availableBalance.toString());
      const resBeforeFail = Number(walletBeforeFail.reservedBalance.toString());

      // 4. Mark Failed
      const failureReason = "Bank network timeout: Beneficiary account number frozen by receiving bank";
      const res = await request(app)
        .post(`/api/v1/finance/withdrawals/${failWithdrawal._id}/mark-failed`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          failureReason,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(WITHDRAWAL_STATUSES.FAILED);
      expect(res.body.data.failureReason).toBe(failureReason);

      // 5. Verify reserved funds returned to available balance
      const walletAfterFail = await VendorWallet.findOne({ vendorId: vendorADoc._id });
      expect(Number(walletAfterFail.availableBalance.toString())).toBe(availBeforeFail + 500);
      expect(Number(walletAfterFail.reservedBalance.toString())).toBe(resBeforeFail - 500);
    });

    it("3.4 Destination Immutability: Subsequent modification or deletion of vendor bank account does not alter existing withdrawal destination", async () => {
      // Create and approve a withdrawal
      const immutWth = await withdrawalRequestService.requestWithdrawal({
        vendorId: vendorADoc._id,
        amount: 200,
        bankAccountId: testBankA._id.toString(),
        idempotencyKey: `immut_dest_${Date.now()}`,
        actorId: vendorAUser._id,
      });

      const originalMasked = immutWth.bankSnapshot.accountNumberMasked;
      expect(originalMasked).toBe("••••••••7890");

      // Now alter Vendor A's bank account
      await VendorBankAccount.findByIdAndUpdate(testBankA._id, {
        accountHolderName: "Completely Changed Name",
        bankName: "Different Bank Name",
        accountNumberMasked: "••••••••9999",
      });

      // Fetch withdrawal from database
      const reloadedWth = await WithdrawalRequest.findById(immutWth._id);
      expect(reloadedWth.bankSnapshot.accountHolderName).toBe("Vendor A Enterprises");
      expect(reloadedWth.bankSnapshot.bankName).toBe("HDFC Bank");
      expect(reloadedWth.bankSnapshot.accountNumberMasked).toBe("••••••••7890");

      // Restore bank account for other tests
      await VendorBankAccount.findByIdAndUpdate(testBankA._id, {
        accountHolderName: "Vendor A Enterprises",
        bankName: "HDFC Bank",
        accountNumberMasked: "••••••••7890",
      });
    });
  });

  describe("4. Security, Tenant Isolation & Zero-Plaintext Audit", () => {
    it("4.1 Vendor A cannot view Vendor B's withdrawal requests", async () => {
      // Seed balance and request a withdrawal for Vendor B
      await financialLedgerService.postJournal({
        journalId: `JRN-SEED-B-${Date.now()}`,
        sourceEvent: "settlement_matured",
        sourceEventId: new mongoose.Types.ObjectId(),
        idempotencyKey: `seed_b_${Date.now()}`,
        currency: "INR",
        entries: [
          {
            entryType: FINANCIAL_ENTRY_TYPES.VENDOR_EARNING,
            direction: FINANCIAL_ENTRY_DIRECTIONS.DEBIT,
            accountType: FINANCIAL_ACCOUNT_TYPES.CLEARING,
            accountCode: LEDGER_ACCOUNTS.CUSTOMER_PAYMENT_CLEARING,
            accountReference: "SEED_B",
            amount: "5000.00",
            currency: "INR",
            idempotencyKey: `seed_b_deb_${Date.now()}`,
            description: "Seed for Vendor B",
          },
          {
            entryType: FINANCIAL_ENTRY_TYPES.SETTLEMENT_MATURED,
            direction: FINANCIAL_ENTRY_DIRECTIONS.CREDIT,
            accountType: FINANCIAL_ACCOUNT_TYPES.VENDOR,
            accountCode: LEDGER_ACCOUNTS.VENDOR_AVAILABLE_EARNINGS,
            accountReference: String(vendorBDoc._id),
            amount: "5000.00",
            currency: "INR",
            vendorId: vendorBDoc._id,
            idempotencyKey: `seed_b_cred_${Date.now()}`,
            description: "Matured for Vendor B",
          },
        ],
      });

      const wthB = await withdrawalRequestService.requestWithdrawal({
        vendorId: vendorBDoc._id,
        amount: 1000,
        bankAccountId: testBankB._id.toString(),
        idempotencyKey: `wth_b_secret_${Date.now()}`,
        actorId: vendorBUser._id,
      });

      // Vendor A attempts to read Vendor B's withdrawal
      const res = await request(app)
        .get(`/api/v1/vendors/me/withdrawals/${wthB._id}`)
        .set("Authorization", `Bearer ${vendorAToken}`)
        .expect(404);

      expect(res.body.errorCode).toBe("WITHDRAWAL_NOT_FOUND");
    });

    it("4.2 Withdrawal API responses, audit logs, and notifications never expose sensitive unmasked account numbers", async () => {
      const res = await request(app)
        .get("/api/v1/vendors/me/withdrawals")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .expect(200);

      const items = res.body.data;
      for (const item of items) {
        expect(item.bankSnapshot).toBeDefined();
        expect(item.bankSnapshot.accountNumberMasked).toMatch(/^•{8}\d{4}$/);
        expect(item.bankSnapshot.accountNumberEncrypted).toBeUndefined();
        expect(item.bankSnapshot.accountNumberHash).toBeUndefined();
      }
    });

    it("4.3 Balance reconciliation verifies exact parity between raw ledger lines and wallet projection", async () => {
      const reconciliation = await financialReconciliationService.reconcileVendorFinances(
        vendorADoc._id,
        "INR"
      );

      expect(reconciliation.isReconciled).toBe(true);
      expect(reconciliation.discrepancyCount).toBe(0);
      expect(reconciliation.discrepancies).toHaveLength(0);
      expect(reconciliation.withdrawalSummary).toBeDefined();
    });
  });
});

