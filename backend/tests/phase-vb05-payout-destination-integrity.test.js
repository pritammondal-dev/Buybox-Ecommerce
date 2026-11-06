const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const Employee = require("../src/models/Employee");
const AuditLog = require("../src/models/AuditLog");
const VendorBankAccount = require("../src/models/VendorBankAccount");
const { VendorSettlement } = require("../src/models/VendorSettlement");
const VendorPayout = require("../src/models/VendorPayout");
const { ROLES } = require("../src/constants/auth.constants");
const { hashPassword } = require("../src/utils/password");
const {
  generateAccessToken,
  TOKEN_CONTEXTS,
  TOKEN_AUDIENCES,
} = require("../src/services/token.service");
const {
  encryptBankAccount,
  maskBankAccount,
  computeBankAccountHash,
} = require("../src/utils/bank-crypto.util");
const vendorPayoutService = require("../src/services/vendor-payout.service");
const vendorSettlementService = require("../src/services/vendor-settlement.service");

describe("Phase VB-05: Payout Integration & Destination Integrity", () => {
  jest.setTimeout(60000);

  let superadminUser;
  let superadminToken;

  let vendorAUser;
  let vendorADoc;
  let vendorAToken;

  let vendorBUser;
  let vendorBDoc;
  let vendorBToken;

  let bankAccountA1;
  let bankAccountA2;
  let bankAccountB1;

  let payableSettlementA;
  let payableSettlementB;

  const TEST_URI = process.env.MONGODB_URI
    ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_vb05_test?")
    : "mongodb://127.0.0.1:27017/buybox_vb05_test?replicaSet=rs0";

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_URI, { autoIndex: true });
    }

    const uniqueSuffix = Date.now();

    // 1. Provision Platform Superadmin
    superadminUser = await User.findOne({ role: ROLES.SUPER_ADMIN, isActive: true });
    if (!superadminUser) {
      superadminUser = await User.create({
        email: `superadmin-vb05-${uniqueSuffix}@buybox.test`,
        password: await hashPassword("SuperAdminPass123!"),
        firstName: "Super",
        lastName: "Admin",
        role: ROLES.SUPER_ADMIN,
        roles: [ROLES.SUPER_ADMIN],
        isActive: true,
        isEmailVerified: true,
      });

      await Employee.create({
        userId: superadminUser._id,
        jobTitle: "Platform Superadmin",
        department: "Finance Operations",
        employeeNumber: `EMP-VB05-${uniqueSuffix.toString().slice(-4)}`,
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

    // 2. Provision Vendor A (Approved & Active)
    vendorAUser = await User.create({
      email: `vendor-vb05-a-${uniqueSuffix}@buybox.test`,
      password: await hashPassword("VendorPass123!"),
      firstName: "VendorA",
      lastName: "Merchant",
      role: ROLES.VENDOR,
      roles: [ROLES.VENDOR],
      isActive: true,
      isEmailVerified: true,
    });

    vendorADoc = await Vendor.create({
      userId: vendorAUser._id,
      businessName: `Vendor A Enterprise ${uniqueSuffix}`,
      storeName: `Vendor A Store ${uniqueSuffix}`,
      businessSlug: `vendor-a-${uniqueSuffix}`,
      email: vendorAUser.email,
      phone: "+919876543210",
      status: "approved",
      isActive: true,
      onboardingStatus: "approved",
      commissionRate: 10,
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
        audience: TOKEN_AUDIENCES.PORTAL,
      }
    );

    // 3. Provision Vendor B (Approved & Active)
    vendorBUser = await User.create({
      email: `vendor-vb05-b-${uniqueSuffix}@buybox.test`,
      password: await hashPassword("VendorPass123!"),
      firstName: "VendorB",
      lastName: "Merchant",
      role: ROLES.VENDOR,
      roles: [ROLES.VENDOR],
      isActive: true,
      isEmailVerified: true,
    });

    vendorBDoc = await Vendor.create({
      userId: vendorBUser._id,
      businessName: `Vendor B Enterprise ${uniqueSuffix}`,
      storeName: `Vendor B Store ${uniqueSuffix}`,
      businessSlug: `vendor-b-${uniqueSuffix}`,
      email: vendorBUser.email,
      phone: "+919876543211",
      status: "approved",
      isActive: true,
      onboardingStatus: "approved",
      commissionRate: 12,
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
        audience: TOKEN_AUDIENCES.PORTAL,
      }
    );

    // 4. Provision Bank Accounts for Vendor A
    // Account A1: Approved and Active
    bankAccountA1 = await VendorBankAccount.create({
      vendorId: vendorADoc._id,
      accountHolderName: "Vendor A Trading Corp",
      bankName: "HDFC Bank",
      accountNumberEncrypted: encryptBankAccount("1111222233334444"),
      accountNumberMasked: maskBankAccount("1111222233334444"),
      accountNumberHash: computeBankAccountHash("1111222233334444", "HDFC0001234"),
      ifscCode: "HDFC0001234",
      branchName: "Koramangala Branch",
      accountType: "current",
      status: "approved",
      isActive: true,
      submittedBy: vendorAUser._id,
      reviewedBy: superadminUser._id,
      approvedAt: new Date(),
    });

    // Account A2: Approved but Inactive (backup)
    bankAccountA2 = await VendorBankAccount.create({
      vendorId: vendorADoc._id,
      accountHolderName: "Vendor A Reserve Corp",
      bankName: "State Bank of India",
      accountNumberEncrypted: encryptBankAccount("9999888877776666"),
      accountNumberMasked: maskBankAccount("9999888877776666"),
      accountNumberHash: computeBankAccountHash("9999888877776666", "SBIN0005678"),
      ifscCode: "SBIN0005678",
      branchName: "MG Road Branch",
      accountType: "current",
      status: "approved",
      isActive: false,
      submittedBy: vendorAUser._id,
      reviewedBy: superadminUser._id,
      approvedAt: new Date(),
    });

    // 5. Provision Bank Account for Vendor B (Approved & Active)
    bankAccountB1 = await VendorBankAccount.create({
      vendorId: vendorBDoc._id,
      accountHolderName: "Vendor B Global Corp",
      bankName: "ICICI Bank",
      accountNumberEncrypted: encryptBankAccount("5555666677778888"),
      accountNumberMasked: maskBankAccount("5555666677778888"),
      accountNumberHash: computeBankAccountHash("5555666677778888", "ICIC0009999"),
      ifscCode: "ICIC0009999",
      branchName: "Whitefield Branch",
      accountType: "current",
      status: "approved",
      isActive: true,
      submittedBy: vendorBUser._id,
      reviewedBy: superadminUser._id,
      approvedAt: new Date(),
    });

    // 6. Provision Settlements
    payableSettlementA = await VendorSettlement.create({
      settlementNumber: `SET-A-${uniqueSuffix}`,
      vendorId: vendorADoc._id,
      periodStart: new Date(Date.now() - 14 * 86400000),
      periodEnd: new Date(),
      currency: "INR",
      grossSales: mongoose.Types.Decimal128.fromString("20000.00"),
      platformSubsidy: mongoose.Types.Decimal128.fromString("0.00"),
      discounts: mongoose.Types.Decimal128.fromString("0.00"),
      refunds: mongoose.Types.Decimal128.fromString("0.00"),
      platformCommission: mongoose.Types.Decimal128.fromString("2000.00"),
      netPayable: mongoose.Types.Decimal128.fromString("18000.00"),
      status: "payable",
      orderIds: [],
    });

    payableSettlementB = await VendorSettlement.create({
      settlementNumber: `SET-B-${uniqueSuffix}`,
      vendorId: vendorBDoc._id,
      periodStart: new Date(Date.now() - 14 * 86400000),
      periodEnd: new Date(),
      currency: "INR",
      grossSales: mongoose.Types.Decimal128.fromString("10000.00"),
      platformSubsidy: mongoose.Types.Decimal128.fromString("0.00"),
      discounts: mongoose.Types.Decimal128.fromString("0.00"),
      refunds: mongoose.Types.Decimal128.fromString("0.00"),
      platformCommission: mongoose.Types.Decimal128.fromString("1200.00"),
      netPayable: mongoose.Types.Decimal128.fromString("8800.00"),
      status: "payable",
      orderIds: [],
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  // =========================================================================
  // GROUP A: PAYOUT ELIGIBILITY VALIDATION
  // =========================================================================
  describe("A. Payout Eligibility Validation", () => {
    it("A.1 Payout succeeds with an approved active bank account", async () => {
      const idempotencyKey = `idemp-a1-${Date.now()}`;
      const payout = await vendorPayoutService.createPayout({
        settlementId: payableSettlementA._id,
        vendorId: vendorADoc._id,
        idempotencyKey,
      });

      expect(payout).toBeDefined();
      expect(payout.status).toBe("pending");
      expect(String(payout.bankAccountId)).toBe(String(bankAccountA1._id));

      const meta = payout.metadata instanceof Map ? Object.fromEntries(payout.metadata) : payout.metadata;
      expect(meta.bankAccountId).toBe(String(bankAccountA1._id));
      expect(meta.bankName).toBe("HDFC Bank");
      expect(meta.accountNumberMasked).toBe("••••••••••••4444");
      expect(meta.ifscCode).toBe("HDFC0001234");
      expect(meta.snapshotAt).toBeDefined();
    });

    it("A.2 Payout fails when vendor has no active account configured", async () => {
      // Create vendor without any bank accounts
      const suffix = Date.now();
      const noBankUser = await User.create({
        email: `nobank-${suffix}@buybox.test`,
        password: await hashPassword("VendorPass123!"),
        firstName: "NoBank",
        lastName: "Vendor",
        role: ROLES.VENDOR,
        roles: [ROLES.VENDOR],
        isActive: true,
        isEmailVerified: true,
      });
      const noBankVendor = await Vendor.create({
        userId: noBankUser._id,
        businessName: `No Bank Vendor ${suffix}`,
        storeName: `No Bank Store ${suffix}`,
        businessSlug: `no-bank-${suffix}`,
        email: noBankUser.email,
        phone: "+919876543299",
        status: "approved",
        isActive: true,
        onboardingStatus: "approved",
      });
      const noBankSettlement = await VendorSettlement.create({
        settlementNumber: `SET-NOBANK-${suffix}`,
        vendorId: noBankVendor._id,
        periodStart: new Date(Date.now() - 7 * 86400000),
        periodEnd: new Date(),
        currency: "INR",
        grossSales: mongoose.Types.Decimal128.fromString("5000.00"),
        netPayable: mongoose.Types.Decimal128.fromString("4500.00"),
        status: "payable",
      });

      await expect(
        vendorPayoutService.createPayout({
          settlementId: noBankSettlement._id,
          vendorId: noBankVendor._id,
          idempotencyKey: `idemp-nobank-${suffix}`,
        })
      ).rejects.toThrow("Vendor has no bank account configured for payouts");
    });

    it("A.3 Payout fails for vendor whose bank account is pending approval", async () => {
      const suffix = Date.now();
      const pendingUser = await User.create({
        email: `pending-${suffix}@buybox.test`,
        password: await hashPassword("VendorPass123!"),
        firstName: "Pending",
        lastName: "Vendor",
        role: ROLES.VENDOR,
        roles: [ROLES.VENDOR],
        isActive: true,
        isEmailVerified: true,
      });
      const pendingVendor = await Vendor.create({
        userId: pendingUser._id,
        businessName: `Pending Vendor ${suffix}`,
        storeName: `Pending Store ${suffix}`,
        businessSlug: `pending-${suffix}`,
        email: pendingUser.email,
        phone: "+919876543298",
        status: "approved",
        isActive: true,
        onboardingStatus: "approved",
      });
      await VendorBankAccount.create({
        vendorId: pendingVendor._id,
        accountHolderName: "Pending Account Holder",
        bankName: "Axis Bank",
        accountNumberEncrypted: encryptBankAccount("123456789012"),
        accountNumberMasked: maskBankAccount("123456789012"),
        accountNumberHash: computeBankAccountHash("123456789012", "UTIB0001111"),
        ifscCode: "UTIB0001111",
        status: "pending",
        isActive: false,
        submittedBy: pendingUser._id,
      });
      const pendingSettlement = await VendorSettlement.create({
        settlementNumber: `SET-PENDING-${suffix}`,
        vendorId: pendingVendor._id,
        periodStart: new Date(Date.now() - 7 * 86400000),
        periodEnd: new Date(),
        currency: "INR",
        grossSales: mongoose.Types.Decimal128.fromString("3000.00"),
        netPayable: mongoose.Types.Decimal128.fromString("2700.00"),
        status: "payable",
      });

      await expect(
        vendorPayoutService.createPayout({
          settlementId: pendingSettlement._id,
          vendorId: pendingVendor._id,
          idempotencyKey: `idemp-pending-${suffix}`,
        })
      ).rejects.toThrow("Vendor bank account is pending approval");
    });

    it("A.4 Payout fails for vendor whose bank account was rejected", async () => {
      const suffix = Date.now();
      const rejUser = await User.create({
        email: `rej-${suffix}@buybox.test`,
        password: await hashPassword("VendorPass123!"),
        firstName: "Rej",
        lastName: "Vendor",
        role: ROLES.VENDOR,
        roles: [ROLES.VENDOR],
        isActive: true,
        isEmailVerified: true,
      });
      const rejVendor = await Vendor.create({
        userId: rejUser._id,
        businessName: `Rej Vendor ${suffix}`,
        storeName: `Rej Store ${suffix}`,
        businessSlug: `rej-${suffix}`,
        email: rejUser.email,
        phone: "+919876543297",
        status: "approved",
        isActive: true,
        onboardingStatus: "approved",
      });
      await VendorBankAccount.create({
        vendorId: rejVendor._id,
        accountHolderName: "Rejected Account Holder",
        bankName: "Kotak Mahindra Bank",
        accountNumberEncrypted: encryptBankAccount("987654321098"),
        accountNumberMasked: maskBankAccount("987654321098"),
        accountNumberHash: computeBankAccountHash("987654321098", "KKBK0002222"),
        ifscCode: "KKBK0002222",
        status: "rejected",
        isActive: false,
        rejectionReason: "Invalid IFSC and branch mismatch with provided name",
        submittedBy: rejUser._id,
        reviewedBy: superadminUser._id,
      });
      const rejSettlement = await VendorSettlement.create({
        settlementNumber: `SET-REJ-${suffix}`,
        vendorId: rejVendor._id,
        periodStart: new Date(Date.now() - 7 * 86400000),
        periodEnd: new Date(),
        currency: "INR",
        grossSales: mongoose.Types.Decimal128.fromString("4000.00"),
        netPayable: mongoose.Types.Decimal128.fromString("3600.00"),
        status: "payable",
      });

      await expect(
        vendorPayoutService.createPayout({
          settlementId: rejSettlement._id,
          vendorId: rejVendor._id,
          idempotencyKey: `idemp-rej-${suffix}`,
        })
      ).rejects.toThrow("Vendor bank account has been rejected");
    });

    it("A.5 Payout fails when vendor account is suspended or inactive", async () => {
      const suffix = Date.now();
      const suspUser = await User.create({
        email: `susp-${suffix}@buybox.test`,
        password: await hashPassword("VendorPass123!"),
        firstName: "Susp",
        lastName: "Vendor",
        role: ROLES.VENDOR,
        roles: [ROLES.VENDOR],
        isActive: false,
        isEmailVerified: true,
      });
      const suspVendor = await Vendor.create({
        userId: suspUser._id,
        businessName: `Suspended Vendor ${suffix}`,
        storeName: `Suspended Store ${suffix}`,
        businessSlug: `susp-${suffix}`,
        email: suspUser.email,
        phone: "+919876543296",
        status: "suspended",
        onboardingStatus: "suspended",
        isActive: false,
      });
      const suspSettlement = await VendorSettlement.create({
        settlementNumber: `SET-SUSP-${suffix}`,
        vendorId: suspVendor._id,
        periodStart: new Date(Date.now() - 7 * 86400000),
        periodEnd: new Date(),
        currency: "INR",
        grossSales: mongoose.Types.Decimal128.fromString("4000.00"),
        netPayable: mongoose.Types.Decimal128.fromString("3600.00"),
        status: "payable",
      });

      await expect(
        vendorPayoutService.createPayout({
          settlementId: suspSettlement._id,
          vendorId: suspVendor._id,
          idempotencyKey: `idemp-susp-${suffix}`,
        })
      ).rejects.toThrow("Vendor is not eligible for payouts");
    });

    it("A.6 Payout fails when requested bank account belongs to another vendor", async () => {
      // Vendor A attempts to use Vendor B's bank account in metadata
      const suffix = Date.now();
      const foreignSettlement = await VendorSettlement.create({
        settlementNumber: `SET-FOREIGN-${suffix}`,
        vendorId: vendorADoc._id,
        periodStart: new Date(Date.now() - 7 * 86400000),
        periodEnd: new Date(),
        currency: "INR",
        grossSales: mongoose.Types.Decimal128.fromString("5000.00"),
        netPayable: mongoose.Types.Decimal128.fromString("4500.00"),
        status: "payable",
      });

      await expect(
        vendorPayoutService.createPayout({
          settlementId: foreignSettlement._id,
          vendorId: vendorADoc._id,
          idempotencyKey: `idemp-foreign-${suffix}`,
          metadata: {
            bankAccountId: String(bankAccountB1._id),
          },
        })
      ).rejects.toThrow("Specified bank account does not belong to this vendor");
    });

    it("A.7 Validation failure logs immutable AuditLog without exposing sensitive bank data", async () => {
      const logs = await AuditLog.find({
        action: "PAYOUT_DESTINATION_VALIDATION_FAILED",
      }).sort({ createdAt: -1 });

      expect(logs.length).toBeGreaterThan(0);
      const latestLog = logs[0];
      expect(latestLog.entityType).toBe("vendor_payout");
      expect(latestLog.afterState.errorCode).toBeDefined();

      // Zero plaintext account numbers
      const logString = JSON.stringify(latestLog.toObject());
      expect(logString).not.toMatch(/1111222233334444/);
      expect(logString).not.toMatch(/5555666677778888/);
    });
  });

  // =========================================================================
  // GROUP B: SNAPSHOT IMMUTABILITY
  // =========================================================================
  describe("B. Snapshot Immutability Across Account Changes", () => {
    let originalPayout;
    let originalSnapshotAt;

    it("B.1 Snapshot is established at payout creation", async () => {
      const payout = await VendorPayout.findOne({ settlementId: payableSettlementA._id });
      expect(payout).toBeDefined();
      originalPayout = payout;

      const meta = payout.metadata instanceof Map ? Object.fromEntries(payout.metadata) : payout.metadata;
      expect(meta.bankAccountId).toBe(String(bankAccountA1._id));
      expect(meta.bankName).toBe("HDFC Bank");
      expect(meta.accountNumberMasked).toBe("••••••••••••4444");
      originalSnapshotAt = meta.snapshotAt;
      expect(originalSnapshotAt).toBeDefined();
    });

    it("B.2 Switching active account to Bank Account A2 does NOT alter original payout snapshot", async () => {
      // Vendor A switches active destination to Account A2
      const switchRes = await request(app)
        .patch(`/api/v1/vendors/me/bank-accounts/${bankAccountA2._id}/active`)
        .set("Authorization", `Bearer ${vendorAToken}`)
        .send({});

      expect(switchRes.status).toBe(200);
      expect(switchRes.body.data.activeAccountId).toBe(String(bankAccountA2._id));

      // Verify Account A2 is active in DB and Account A1 is inactive
      const a2 = await VendorBankAccount.findById(bankAccountA2._id);
      expect(a2.isActive).toBe(true);
      const a1 = await VendorBankAccount.findById(bankAccountA1._id);
      expect(a1.isActive).toBe(false);

      // Verify original payout STILL retains Bank Account A1 snapshot
      const refreshedPayout = await VendorPayout.findById(originalPayout._id);
      const refreshedMeta = refreshedPayout.metadata instanceof Map
        ? Object.fromEntries(refreshedPayout.metadata)
        : refreshedPayout.metadata;

      expect(refreshedMeta.bankAccountId).toBe(String(bankAccountA1._id));
      expect(refreshedMeta.bankName).toBe("HDFC Bank");
      expect(refreshedMeta.accountNumberMasked).toBe("••••••••••••4444");
      expect(refreshedMeta.snapshotAt).toBe(originalSnapshotAt);
      expect(String(refreshedPayout.bankAccountId)).toBe(String(bankAccountA1._id));
    });

    it("B.3 Editing another bank account does NOT alter original payout destination", async () => {
      // Superadmin edits Account A2 branch name
      await request(app)
        .patch(`/api/v1/admin/vendors/${vendorADoc._id}/bank-accounts/${bankAccountA2._id}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          branchName: "Central Financial District Updated",
          reason: "Administrative branch address normalization",
        });

      // Verify original payout snapshot remains completely unchanged
      const refreshedPayout = await VendorPayout.findById(originalPayout._id);
      const refreshedMeta = refreshedPayout.metadata instanceof Map
        ? Object.fromEntries(refreshedPayout.metadata)
        : refreshedPayout.metadata;

      expect(refreshedMeta.bankAccountId).toBe(String(bankAccountA1._id));
      expect(refreshedMeta.bankName).toBe("HDFC Bank");
      expect(refreshedMeta.accountNumberMasked).toBe("••••••••••••4444");
    });

    it("B.4 A newly created payout uses the newly active account (A2)", async () => {
      const suffix = Date.now();
      // Re-activate A2 if edit reset status
      await VendorBankAccount.findByIdAndUpdate(bankAccountA2._id, {
        status: "approved",
        isActive: true,
      });

      const secondSettlement = await VendorSettlement.create({
        settlementNumber: `SET-A2-${suffix}`,
        vendorId: vendorADoc._id,
        periodStart: new Date(Date.now() - 7 * 86400000),
        periodEnd: new Date(),
        currency: "INR",
        grossSales: mongoose.Types.Decimal128.fromString("8000.00"),
        netPayable: mongoose.Types.Decimal128.fromString("7200.00"),
        status: "payable",
      });

      const secondPayout = await vendorPayoutService.createPayout({
        settlementId: secondSettlement._id,
        vendorId: vendorADoc._id,
        idempotencyKey: `idemp-second-${suffix}`,
      });

      expect(secondPayout).toBeDefined();
      const meta2 = secondPayout.metadata instanceof Map
        ? Object.fromEntries(secondPayout.metadata)
        : secondPayout.metadata;

      // Must reference Account A2 (new active)
      expect(meta2.bankAccountId).toBe(String(bankAccountA2._id));
      expect(meta2.bankName).toBe("State Bank of India");
      expect(meta2.accountNumberMasked).toBe("••••••••••••6666");

      // While original payout STILL references Account A1
      const originalRefreshed = await VendorPayout.findById(originalPayout._id);
      const originalMeta = originalRefreshed.metadata instanceof Map
        ? Object.fromEntries(originalRefreshed.metadata)
        : originalRefreshed.metadata;
      expect(originalMeta.bankAccountId).toBe(String(bankAccountA1._id));
      expect(originalMeta.bankName).toBe("HDFC Bank");
    });
  });

  // =========================================================================
  // GROUP C: PROCESSING, RETRY & IDEMPOTENCY
  // =========================================================================
  describe("C. Processing, Retry & Idempotency", () => {
    let testPayout;

    beforeAll(async () => {
      const idemp = `idemp-c-${Date.now()}`;
      testPayout = await vendorPayoutService.createPayout({
        settlementId: payableSettlementB._id,
        vendorId: vendorBDoc._id,
        idempotencyKey: idemp,
      });
    });

    it("C.1 Duplicate queue delivery / idempotency check returns existing payout without duplicates", async () => {
      const duplicateCall = await vendorPayoutService.createPayout({
        settlementId: payableSettlementB._id,
        vendorId: vendorBDoc._id,
        idempotencyKey: testPayout.idempotencyKey,
      });

      expect(String(duplicateCall._id)).toBe(String(testPayout._id));
      expect(duplicateCall.payoutNumber).toBe(testPayout.payoutNumber);

      const count = await VendorPayout.countDocuments({ settlementId: payableSettlementB._id });
      expect(count).toBe(1);
    });

    it("C.2 Transition to PROCESSING logs AuditLog and sets processedAt", async () => {
      const updated = await vendorPayoutService.transitionPayoutStatus({
        payoutId: testPayout._id,
        nextStatus: "processing",
        actorId: superadminUser._id,
      });

      expect(updated.status).toBe("processing");
      expect(updated.processedAt).toBeDefined();

      const audit = await AuditLog.findOne({
        targetId: testPayout._id,
        action: "PAYOUT_PROCESSING",
      });
      expect(audit).toBeDefined();
      expect(audit.afterState.status).toBe("processing");
    });

    it("C.3 Transition to FAILED records failure reason and preserves destination snapshot", async () => {
      const failedPayout = await vendorPayoutService.transitionPayoutStatus({
        payoutId: testPayout._id,
        nextStatus: "failed",
        failureReason: "Gateway timeout during automated transfer execution",
        actorId: superadminUser._id,
      });

      expect(failedPayout.status).toBe("failed");
      expect(failedPayout.failureReason).toBe("Gateway timeout during automated transfer execution");

      // Verify destination snapshot is intact
      const meta = failedPayout.metadata instanceof Map ? Object.fromEntries(failedPayout.metadata) : failedPayout.metadata;
      expect(meta.bankAccountId).toBe(String(bankAccountB1._id));
      expect(meta.bankName).toBe("ICICI Bank");

      const failAudit = await AuditLog.findOne({
        targetId: testPayout._id,
        action: "PAYOUT_FAILED",
      });
      expect(failAudit).toBeDefined();
      expect(failAudit.reason).toContain("Gateway timeout");
    });

    it("C.4 Retry transitions back to PROCESSING, increments retryCount and retains original snapshot", async () => {
      const retriedPayout = await vendorPayoutService.retryPayout(testPayout._id, {
        actorId: superadminUser._id,
        reason: "Operational retry after gateway connectivity restored",
      });

      expect(retriedPayout.status).toBe("processing");
      expect(retriedPayout.retryCount).toBe(1);

      // Verify destination snapshot is strictly preserved
      const meta = retriedPayout.metadata instanceof Map ? Object.fromEntries(retriedPayout.metadata) : retriedPayout.metadata;
      expect(meta.bankAccountId).toBe(String(bankAccountB1._id));
      expect(meta.accountNumberMasked).toBe("••••••••••••8888");

      const retryAudit = await AuditLog.findOne({
        targetId: testPayout._id,
        action: "PAYOUT_RETRY",
      });
      expect(retryAudit).toBeDefined();
      expect(retryAudit.afterState.retryCount).toBe(1);
    });

    it("C.5 Transition to PAID completes payout and synchronizes VendorSettlement to paid", async () => {
      const providerRef = `rzp_payout_${Date.now()}`;
      const paidPayout = await vendorPayoutService.transitionPayoutStatus({
        payoutId: testPayout._id,
        nextStatus: "paid",
        providerReference: providerRef,
        actorId: superadminUser._id,
      });

      expect(paidPayout.status).toBe("paid");
      expect(paidPayout.paidAt).toBeDefined();
      expect(paidPayout.providerReference).toBe(providerRef);

      // Verify settlement is synchronized to paid
      const settlement = await VendorSettlement.findById(payableSettlementB._id);
      expect(settlement.status).toBe("paid");
      expect(settlement.paidAt).toBeDefined();

      const paidAudit = await AuditLog.findOne({
        targetId: testPayout._id,
        action: "PAYOUT_PAID",
      });
      expect(paidAudit).toBeDefined();
    });
  });

  // =========================================================================
  // GROUP D: FINANCIAL HISTORY & ADMIN INSPECTION
  // =========================================================================
  describe("D. Financial History & Administrative Inspection", () => {
    it("D.1 Completed payout retains destination snapshot after active bank account is soft-deleted", async () => {
      // Payout on Settlement B is now PAID. Deleting bank account should now be allowed (no pending in-flight payout)
      const delRes = await request(app)
        .delete(`/api/v1/admin/vendors/${vendorBDoc._id}/bank-accounts/${bankAccountB1._id}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Vendor requested decommissioning of legacy ICICI bank account" });

      expect(delRes.status).toBe(200);

      // Verify payout on Settlement B STILL retains full snapshot info
      const payoutB = await VendorPayout.findOne({ settlementId: payableSettlementB._id });
      expect(payoutB).toBeDefined();
      expect(payoutB.status).toBe("paid");

      const metaB = payoutB.metadata instanceof Map ? Object.fromEntries(payoutB.metadata) : payoutB.metadata;
      expect(metaB.bankAccountId).toBe(String(bankAccountB1._id));
      expect(metaB.bankName).toBe("ICICI Bank");
      expect(metaB.accountNumberMasked).toBe("••••••••••••8888");
      expect(metaB.ifscCode).toBe("ICIC0009999");
    });

    it("D.2 Superadmin Settlement Statement clearly distinguishes payoutDestination from currentActiveBank", async () => {
      const statementRes = await vendorSettlementService.getAdminSettlementById(payableSettlementB._id);

      expect(statementRes).toBeDefined();
      expect(statementRes.settlementNumber).toBe(payableSettlementB.settlementNumber);

      // Payout destination snapshot must be populated
      expect(statementRes.payoutDestination).toBeDefined();
      expect(statementRes.payoutDestination.bankName).toBe("ICICI Bank");
      expect(statementRes.payoutDestination.accountNumberMasked).toBe("••••••••••••8888");
      expect(statementRes.payoutDestination.status).toBe("paid");

      // Current active bank is now null because account was decommissioned
      expect(statementRes.currentActiveBank).toBeNull();

      // Payout details are present
      expect(statementRes.payout).toBeDefined();
      expect(statementRes.payout.status).toBe("paid");
    });

    it("D.3 Vendor Settlement Detail endpoint exposes payoutDestination to vendor", async () => {
      const vendorStatement = await vendorSettlementService.getMyVendorSettlementById({
        userId: vendorBUser._id,
        settlementId: payableSettlementB._id,
      });

      expect(vendorStatement).toBeDefined();
      expect(vendorStatement.payoutDestination).toBeDefined();
      expect(vendorStatement.payoutDestination.bankName).toBe("ICICI Bank");
      expect(vendorStatement.payoutDestination.accountNumberMasked).toBe("••••••••••••8888");
    });

    it("D.4 Zero plaintext account numbers exist in payout documents or audit logs", async () => {
      const allPayouts = await VendorPayout.find({}).lean();
      const allAudits = await AuditLog.find({ entityType: "vendor_payout" }).lean();

      const rawNumberA = "1111222233334444";
      const rawNumberB = "5555666677778888";
      const rawNumberA2 = "9999888877776666";

      for (const p of allPayouts) {
        const str = JSON.stringify(p);
        expect(str).not.toContain(rawNumberA);
        expect(str).not.toContain(rawNumberB);
        expect(str).not.toContain(rawNumberA2);
      }

      for (const a of allAudits) {
        const str = JSON.stringify(a);
        expect(str).not.toContain(rawNumberA);
        expect(str).not.toContain(rawNumberB);
        expect(str).not.toContain(rawNumberA2);
      }
    });

    it("D.5 Payout and settlement financial totals remain exact and uncorrupted", async () => {
      const settlementB = await VendorSettlement.findById(payableSettlementB._id);
      const payoutB = await VendorPayout.findOne({ settlementId: payableSettlementB._id });

      expect(settlementB.netPayable.toString()).toBe("8800.00");
      expect(payoutB.amount.toString()).toBe("8800.00");
      expect(settlementB.grossSales.toString()).toBe("10000.00");
      expect(settlementB.platformCommission.toString()).toBe("1200.00");
    });
  });
});
