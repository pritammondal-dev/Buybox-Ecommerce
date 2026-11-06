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
  decryptBankAccount,
  maskBankAccount,
  computeBankAccountHash,
} = require("../src/utils/bank-crypto.util");
const vendorPayoutService = require("../src/services/vendor-payout.service");

describe("Phase VB-02: Vendor Bank Account Management — Backend Foundation & Account Lifecycle", () => {
  jest.setTimeout(60000);

  let superadminUser;
  let superadminToken;
  let unauthorizedCustomerUser;
  let unauthorizedCustomerToken;

  let vendorAUser;
  let vendorADoc;
  let vendorAToken;

  let vendorBUser;
  let vendorBDoc;
  let vendorBToken;

  const TEST_URI = process.env.MONGODB_URI
    ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_vb02_test?")
    : "mongodb://127.0.0.1:27017/buybox_vb02_test?replicaSet=rs0";

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_URI, { autoIndex: true });
    }

    const uniqueSuffix = Date.now();

    // 1. Provision or reuse Platform Super Administrator
    superadminUser = await User.findOne({ role: ROLES.SUPER_ADMIN, isActive: true });
    if (!superadminUser) {
      superadminUser = await User.create({
        email: `superadmin-vb02-${uniqueSuffix}@buybox.test`,
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
        employeeNumber: `EMP-VB02-${uniqueSuffix.toString().slice(-4)}`,
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

    // 2. Provision Unauthorized Customer User
    unauthorizedCustomerUser = await User.create({
      email: `unauth-cust-vb02-${uniqueSuffix}@buybox.test`,
      password: await hashPassword("CustPass123!"),
      firstName: "Unauthorized",
      lastName: "Customer",
      role: ROLES.CUSTOMER,
      roles: [ROLES.CUSTOMER],
      isActive: true,
      isEmailVerified: true,
    });

    unauthorizedCustomerToken = generateAccessToken(
      {
        sub: unauthorizedCustomerUser._id.toString(),
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER],
        authVersion: 1,
        permissionVersion: 1,
      },
      {
        context: TOKEN_CONTEXTS.CUSTOMER,
        audience: TOKEN_AUDIENCES.CUSTOMER,
      }
    );

    // 3. Provision Vendor A
    vendorAUser = await User.create({
      email: `vendor-a-vb02-${uniqueSuffix}@buybox.test`,
      password: await hashPassword("VendorSecret123!"),
      firstName: "VendorA",
      lastName: "Merchant",
      role: ROLES.VENDOR,
      roles: [ROLES.VENDOR],
      isActive: true,
      isEmailVerified: true,
      authVersion: 1,
    });

    vendorADoc = await Vendor.create({
      userId: vendorAUser._id,
      businessName: `Store Alpha ${uniqueSuffix}`,
      businessSlug: `store-alpha-${uniqueSuffix}`,
      onboardingStatus: "approved",
      isActive: true,
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

    // 4. Provision Vendor B
    vendorBUser = await User.create({
      email: `vendor-b-vb02-${uniqueSuffix}@buybox.test`,
      password: await hashPassword("VendorSecret123!"),
      firstName: "VendorB",
      lastName: "Merchant",
      role: ROLES.VENDOR,
      roles: [ROLES.VENDOR],
      isActive: true,
      isEmailVerified: true,
      authVersion: 1,
    });

    vendorBDoc = await Vendor.create({
      userId: vendorBUser._id,
      businessName: `Store Beta ${uniqueSuffix}`,
      businessSlug: `store-beta-${uniqueSuffix}`,
      onboardingStatus: "approved",
      isActive: true,
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
        context: TOKEN_CONTEXTS.VENDOR,
        audience: TOKEN_AUDIENCES.VENDOR,
      }
    );
  });

  afterAll(async () => {
    // Keep test database intact
  });

  // =========================================================================
  // SUITE 1: MODEL & CRYPTOGRAPHY FOUNDATION
  // =========================================================================
  describe("1. VendorBankAccount Model & Cryptography Foundation", () => {
    it("1.1 enforces AES-256-GCM encryption at rest and deterministic blind HMAC index", async () => {
      const rawAccount = "12345678901234";
      const ifsc = "HDFC0001234";

      const encrypted = encryptBankAccount(rawAccount);
      expect(encrypted).toMatch(/^enc:v1:[a-f0-9]{24}:[a-f0-9]{32}:[a-f0-9]+$/);

      const decrypted = decryptBankAccount(encrypted);
      expect(decrypted).toBe(rawAccount);

      const masked = maskBankAccount(rawAccount);
      expect(masked).toBe("••••••••••••1234");

      const hash1 = computeBankAccountHash(rawAccount, ifsc);
      const hash2 = computeBankAccountHash(" 1234-5678-901234 ", "hdfc0001234");
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it("1.2 validates IFSC code schema format and rejects invalid codes", async () => {
      const invalidAccount = new VendorBankAccount({
        vendorId: vendorADoc._id,
        accountHolderName: "Alpha Merchant",
        bankName: "HDFC Bank",
        accountNumberEncrypted: encryptBankAccount("1234567890"),
        accountNumberMasked: "••••••••••••7890",
        accountNumberHash: "testhash123",
        ifscCode: "INVALID_IFSC",
        submittedBy: vendorAUser._id,
      });

      let error = null;
      try {
        await invalidAccount.validate();
      } catch (err) {
        error = err;
      }
      expect(error).not.toBeNull();
      expect(error.errors.ifscCode).toBeDefined();
    });

    it("1.3 scrubs encrypted and hash fields on default toJSON serialization", async () => {
      const doc = new VendorBankAccount({
        vendorId: vendorADoc._id,
        accountHolderName: "Alpha Merchant",
        bankName: "HDFC Bank",
        accountNumberEncrypted: encryptBankAccount("987654321098"),
        accountNumberMasked: "••••••••••••1098",
        accountNumberHash: "deadbeefcafebabe12345678",
        ifscCode: "HDFC0001234",
        submittedBy: vendorAUser._id,
      });

      const json = doc.toJSON();
      expect(json.accountNumberEncrypted).toBeUndefined();
      expect(json.accountNumberHash).toBeUndefined();
      expect(json.accountNumberMasked).toBe("••••••••••••1098");
    });
  });

  // =========================================================================
  // SUITE 2: THREE-ACCOUNT LIMIT & DUPLICATE PREVENTION
  // =========================================================================
  describe("2. Three-Account Limit & Duplicate Account Prevention", () => {
    let createdAccountIds = [];

    beforeEach(async () => {
      // Clean accounts for Vendor A before this suite
      await VendorBankAccount.deleteMany({ vendorId: vendorADoc._id });
      createdAccountIds = [];
    });

    it("2.1 permits adding up to 3 bank accounts and blocks a 4th account with 400 BANK_ACCOUNT_LIMIT_EXCEEDED", async () => {
      const accountsToCreate = [
        {
          accountHolderName: "Store Alpha Primary",
          bankName: "HDFC Bank",
          accountNumber: "100000000001",
          confirmAccountNumber: "100000000001",
          ifscCode: "HDFC0001111",
          accountType: "current",
        },
        {
          accountHolderName: "Store Alpha Secondary",
          bankName: "ICICI Bank",
          accountNumber: "200000000002",
          confirmAccountNumber: "200000000002",
          ifscCode: "ICIC0002222",
          accountType: "current",
        },
        {
          accountHolderName: "Store Alpha Tertiary",
          bankName: "Axis Bank",
          accountNumber: "300000000003",
          confirmAccountNumber: "300000000003",
          ifscCode: "UTIB0003333",
          accountType: "savings",
        },
      ];

      for (const payload of accountsToCreate) {
        const res = await request(app)
          .post("/api/v1/vendors/me/bank-accounts")
          .set("Authorization", `Bearer ${vendorAToken}`)
          .send(payload);

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.account.accountNumberMasked).toBeDefined();
        createdAccountIds.push(res.body.data.account.id || res.body.data.account._id);
      }

      const count = await VendorBankAccount.countDocuments({
        vendorId: vendorADoc._id,
        deletedAt: null,
      });
      expect(count).toBe(3);

      // Attempting to submit a 4th account
      const fourthRes = await request(app)
        .post("/api/v1/vendors/me/bank-accounts")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .send({
          accountHolderName: "Store Alpha Fourth",
          bankName: "State Bank of India",
          accountNumber: "400000000004",
          confirmAccountNumber: "400000000004",
          ifscCode: "SBIN0004444",
          accountType: "current",
        });

      expect(fourthRes.status).toBe(400);
      expect(fourthRes.body.errorCode).toBe("BANK_ACCOUNT_LIMIT_EXCEEDED");
    });

    it("2.2 prevents duplicate bank account numbers for the same vendor with 409 DUPLICATE_BANK_ACCOUNT", async () => {
      const payload = {
        accountHolderName: "Store Alpha Account",
        bankName: "HDFC Bank",
        accountNumber: "555555555555",
        confirmAccountNumber: "555555555555",
        ifscCode: "HDFC0005555",
        accountType: "current",
      };

      const firstRes = await request(app)
        .post("/api/v1/vendors/me/bank-accounts")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .send(payload);

      expect(firstRes.status).toBe(201);

      // Submit identical account + IFSC
      const dupRes = await request(app)
        .post("/api/v1/vendors/me/bank-accounts")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .send(payload);

      expect(dupRes.status).toBe(409);
      expect(dupRes.body.errorCode).toBe("DUPLICATE_BANK_ACCOUNT");
    });
  });

  // =========================================================================
  // SUITE 3: VENDOR SELF-SERVICE WORKFLOW
  // =========================================================================
  describe("3. Vendor Self-Service Workflow & Active Account Switching", () => {
    let account1Id;
    let account2Id;

    beforeEach(async () => {
      await VendorBankAccount.deleteMany({ vendorId: vendorADoc._id });

      // Create two bank accounts for Vendor A
      const acc1 = await request(app)
        .post("/api/v1/vendors/me/bank-accounts")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .send({
          accountHolderName: "Alpha Operations",
          bankName: "HDFC Bank",
          accountNumber: "111122223333",
          confirmAccountNumber: "111122223333",
          ifscCode: "HDFC0001234",
          accountType: "current",
        });

      account1Id = acc1.body.data.account.id || acc1.body.data.account._id;

      const acc2 = await request(app)
        .post("/api/v1/vendors/me/bank-accounts")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .send({
          accountHolderName: "Alpha Secondary",
          bankName: "ICICI Bank",
          accountNumber: "444455556666",
          confirmAccountNumber: "444455556666",
          ifscCode: "ICIC0004321",
          accountType: "current",
        });

      account2Id = acc2.body.data.account.id || acc2.body.data.account._id;
    });

    it("3.1 rejects mismatched confirmAccountNumber with 400 Bad Request", async () => {
      const res = await request(app)
        .post("/api/v1/vendors/me/bank-accounts")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .send({
          accountHolderName: "Mismatch Account",
          bankName: "HDFC Bank",
          accountNumber: "123456789012",
          confirmAccountNumber: "999999999999",
          ifscCode: "HDFC0001234",
          accountType: "current",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("do not match");
    });

    it("3.2 lists own bank accounts with masked presentation only", async () => {
      const res = await request(app)
        .get("/api/v1/vendors/me/bank-accounts")
        .set("Authorization", `Bearer ${vendorAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.accounts).toHaveLength(2);
      expect(res.body.data.accounts[0].accountNumberMasked).toMatch(/^••••••••••••\d{4}$/);
      expect(res.body.data.accounts[0].accountNumberEncrypted).toBeUndefined();
    });

    it("3.3 prevents activating an unapproved bank account with 400 ACCOUNT_NOT_ELIGIBLE_FOR_ACTIVATION", async () => {
      const res = await request(app)
        .patch(`/api/v1/vendors/me/bank-accounts/${account1Id}/active`)
        .set("Authorization", `Bearer ${vendorAToken}`);

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe("ACCOUNT_NOT_ELIGIBLE_FOR_ACTIVATION");
    });

    it("3.4 atomically switches active payout destination among approved accounts", async () => {
      // Approve both accounts administratively
      await VendorBankAccount.updateOne({ _id: account1Id }, { status: "approved" });
      await VendorBankAccount.updateOne({ _id: account2Id }, { status: "approved" });

      // 1. Vendor activates account 1
      const activate1 = await request(app)
        .patch(`/api/v1/vendors/me/bank-accounts/${account1Id}/active`)
        .set("Authorization", `Bearer ${vendorAToken}`);

      expect(activate1.status).toBe(200);

      let doc1 = await VendorBankAccount.findById(account1Id);
      let doc2 = await VendorBankAccount.findById(account2Id);
      expect(doc1.isActive).toBe(true);
      expect(doc2.isActive).toBe(false);

      // 2. Vendor switches to account 2
      const activate2 = await request(app)
        .patch(`/api/v1/vendors/me/bank-accounts/${account2Id}/active`)
        .set("Authorization", `Bearer ${vendorAToken}`);

      expect(activate2.status).toBe(200);

      doc1 = await VendorBankAccount.findById(account1Id);
      doc2 = await VendorBankAccount.findById(account2Id);
      expect(doc1.isActive).toBe(false);
      expect(doc2.isActive).toBe(true);
    });

    it("3.5 isolates cross-vendor access: Vendor B cannot switch or view Vendor A accounts", async () => {
      const res = await request(app)
        .patch(`/api/v1/vendors/me/bank-accounts/${account1Id}/active`)
        .set("Authorization", `Bearer ${vendorBToken}`);

      expect(res.status).toBe(404);
    });

    it("3.6 allows resubmitting corrected details for a rejected bank account", async () => {
      // Reject account 1 first
      await VendorBankAccount.updateOne(
        { _id: account1Id },
        { status: "rejected", rejectionReason: "Incorrect account holder name on cheque" }
      );

      const resubmitRes = await request(app)
        .post(`/api/v1/vendors/me/bank-accounts/${account1Id}/resubmit`)
        .set("Authorization", `Bearer ${vendorAToken}`)
        .send({
          accountHolderName: "Alpha Operations Corrected Ltd",
          bankName: "HDFC Bank",
          accountNumber: "111122223333",
          confirmAccountNumber: "111122223333",
          ifscCode: "HDFC0001234",
          accountType: "current",
          submissionReason: "Corrected legal name per bank passbook",
        });

      expect(resubmitRes.status).toBe(200);
      expect(resubmitRes.body.data.account.status).toBe("pending");
      expect(resubmitRes.body.data.account.rejectionReason).toBeNull();
      expect(resubmitRes.body.data.account.version).toBeGreaterThan(1);
    });
  });

  // =========================================================================
  // SUITE 4: REVIEWER QUEUE & APPROVAL/REJECTION WORKFLOW
  // =========================================================================
  describe("4. Reviewer Queue & Approval/Rejection Workflow", () => {
    let testAccountId;

    beforeEach(async () => {
      await VendorBankAccount.deleteMany({ vendorId: vendorADoc._id });

      const sub = await request(app)
        .post("/api/v1/vendors/me/bank-accounts")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .send({
          accountHolderName: "Alpha Review Test",
          bankName: "Kotak Mahindra Bank",
          accountNumber: "777788889999",
          confirmAccountNumber: "777788889999",
          ifscCode: "KKBK0001234",
          accountType: "current",
        });

      testAccountId = sub.body.data.account.id || sub.body.data.account._id;
    });

    it("4.1 reviewer lists pending applications across all vendors in review queue", async () => {
      const res = await request(app)
        .get("/api/v1/admin/vendors/bank-accounts/applications")
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    });

    it("4.2 rejects unauthorized customer from accessing review queue with 403 Forbidden", async () => {
      const res = await request(app)
        .get("/api/v1/admin/vendors/bank-accounts/applications")
        .set("Authorization", `Bearer ${unauthorizedCustomerToken}`);

      expect(res.status).toBe(403);
    });

    it("4.3 approves application and auto-activates if vendor has zero active accounts", async () => {
      const approveRes = await request(app)
        .post(`/api/v1/admin/vendors/${vendorADoc._id}/bank-accounts/${testAccountId}/approve`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Verified cancelled cheque and IFSC validity" });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.account.status).toBe("approved");
      expect(approveRes.body.data.account.isActive).toBe(true); // Auto-activated because no active account existed
    });

    it("4.4 mandates minimum 10-character reason for rejection and revokes active state", async () => {
      // First approve and make active
      await VendorBankAccount.updateOne(
        { _id: testAccountId },
        { status: "approved", isActive: true }
      );

      // Rejection with short reason should fail
      const shortFail = await request(app)
        .post(`/api/v1/admin/vendors/${vendorADoc._id}/bank-accounts/${testAccountId}/reject`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "bad" });

      expect(shortFail.status).toBe(400);

      // Valid rejection
      const validReject = await request(app)
        .post(`/api/v1/admin/vendors/${vendorADoc._id}/bank-accounts/${testAccountId}/reject`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Account name does not match vendor registered entity name" });

      expect(validReject.status).toBe(200);
      expect(validReject.body.data.account.status).toBe("rejected");
      expect(validReject.body.data.account.isActive).toBe(false); // Active state revoked
    });
  });

  // =========================================================================
  // SUITE 5: SUPERADMIN MANAGEMENT & PRIVILEGED UNMASKING
  // =========================================================================
  describe("5. Superadmin Management Controls & Privileged Access", () => {
    let adminCreatedId;

    it("5.1 Superadmin adds bank account administratively with autoApprove and setActive", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/vendors/${vendorADoc._id}/bank-accounts`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          accountHolderName: "Alpha Admin Provisioned",
          bankName: "Yes Bank",
          accountNumber: "888899990000",
          confirmAccountNumber: "888899990000",
          ifscCode: "YESB0001234",
          accountType: "current",
          autoApprove: true,
          setActive: true,
          reason: "Direct onboarding provisioned by financial operations lead",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.account.status).toBe("approved");
      expect(res.body.data.account.isActive).toBe(true);
      adminCreatedId = res.body.data.account.id || res.body.data.account._id;
    });

    it("5.2 Superadmin privileged unmasking requires mandatory reason and logs immutable AuditLog", async () => {
      // Attempt unmask without reason
      const failRes = await request(app)
        .post(`/api/v1/admin/vendors/${vendorADoc._id}/bank-accounts/${adminCreatedId}/unmask`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({});

      expect(failRes.status).toBe(400);

      // Valid unmask
      const unmaskRes = await request(app)
        .post(`/api/v1/admin/vendors/${vendorADoc._id}/bank-accounts/${adminCreatedId}/unmask`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Mandatory compliance inspection for anti-money laundering review" });

      expect(unmaskRes.status).toBe(200);
      expect(unmaskRes.body.data.accountNumber).toBe("888899990000");

      // Verify AuditLog written
      const audit = await AuditLog.findOne({
        targetId: adminCreatedId,
        action: "vendor_bank_account.unmasked_view",
      });
      expect(audit).not.toBeNull();
      expect(audit.reason).toContain("anti-money laundering review");
    });

    it("5.3 Superadmin editing critical fields (accountNumber) resets status to pending", async () => {
      const editRes = await request(app)
        .patch(`/api/v1/admin/vendors/${vendorADoc._id}/bank-accounts/${adminCreatedId}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          accountNumber: "888899991111",
          confirmAccountNumber: "888899991111",
          reason: "Vendor requested correction of transposed account number digit",
        });

      expect(editRes.status).toBe(200);
      expect(editRes.body.data.account.status).toBe("pending");
      expect(editRes.body.data.account.isActive).toBe(false);
    });

    it("5.4 Superadmin toggles status and soft-deletes eligible account with reason", async () => {
      // Re-approve first
      await VendorBankAccount.updateOne({ _id: adminCreatedId }, { status: "approved" });

      // Toggle status
      const statusRes = await request(app)
        .patch(`/api/v1/admin/vendors/${vendorADoc._id}/bank-accounts/${adminCreatedId}/status`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          isActive: true,
          reason: "Re-activating verified account destination",
        });

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.account.isActive).toBe(true);

      // Soft delete
      const delRes = await request(app)
        .delete(`/api/v1/admin/vendors/${vendorADoc._id}/bank-accounts/${adminCreatedId}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Vendor closed bank branch and decommissioned account" });

      expect(delRes.status).toBe(200);

      const deletedDoc = await VendorBankAccount.findById(adminCreatedId);
      expect(deletedDoc.deletedAt).not.toBeNull();
      expect(deletedDoc.isActive).toBe(false);
    });
  });

  // =========================================================================
  // SUITE 6: AUDIT LOG SANITIZATION INTEGRITY
  // =========================================================================
  describe("6. Audit Log Sanitization & Plaintext Exclusion", () => {
    it("6.1 guarantees AuditLog records never store plaintext account numbers", async () => {
      const rawSecretNumber = "998877665544";

      await request(app)
        .post("/api/v1/vendors/me/bank-accounts")
        .set("Authorization", `Bearer ${vendorAToken}`)
        .send({
          accountHolderName: "Alpha Audit Secret Test",
          bankName: "HDFC Bank",
          accountNumber: rawSecretNumber,
          confirmAccountNumber: rawSecretNumber,
          ifscCode: "HDFC0009999",
          accountType: "savings",
        });

      // Find audit logs
      const auditLogs = await AuditLog.find({
        entityType: "VendorBankAccount",
      }).lean();

      for (const log of auditLogs) {
        const serialized = JSON.stringify(log);
        expect(serialized).not.toContain(rawSecretNumber);
        if (log.afterState) {
          expect(log.afterState.accountNumber).toBeUndefined();
          expect(log.afterState.rawAccountNumber).toBeUndefined();
          expect(log.afterState.accountNumberEncrypted).toBeUndefined();
        }
      }
    });
  });

  // =========================================================================
  // SUITE 7: SETTLEMENT & IN-FLIGHT PAYOUT COMPATIBILITY
  // =========================================================================
  describe("7. Settlement & In-Flight Payout Immutability", () => {
    let settlementDoc;
    let bankAccount1;
    let bankAccount2;

    beforeEach(async () => {
      await VendorBankAccount.deleteMany({ vendorId: vendorBDoc._id });

      // Create and approve bank account 1
      bankAccount1 = await VendorBankAccount.create({
        vendorId: vendorBDoc._id,
        accountHolderName: "Beta Merchant Payout 1",
        bankName: "HDFC Bank",
        accountNumberEncrypted: encryptBankAccount("111100001111"),
        accountNumberMasked: "••••••••••••1111",
        accountNumberHash: computeBankAccountHash("111100001111", "HDFC0001111"),
        ifscCode: "HDFC0001111",
        status: "approved",
        isActive: true,
        submittedBy: vendorBUser._id,
      });

      // Create and approve bank account 2 (standby)
      bankAccount2 = await VendorBankAccount.create({
        vendorId: vendorBDoc._id,
        accountHolderName: "Beta Merchant Payout 2",
        bankName: "ICICI Bank",
        accountNumberEncrypted: encryptBankAccount("222200002222"),
        accountNumberMasked: "••••••••••••2222",
        accountNumberHash: computeBankAccountHash("222200002222", "ICIC0002222"),
        ifscCode: "ICIC0002222",
        status: "approved",
        isActive: false,
        submittedBy: vendorBUser._id,
      });

      // Create a payable settlement for Vendor B
      settlementDoc = await VendorSettlement.create({
        settlementNumber: `SET-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        vendorId: vendorBDoc._id,
        periodStart: new Date(Date.now() - 14 * 86400000),
        periodEnd: new Date(),
        grossSales: mongoose.Types.Decimal128.fromString("15000.00"),
        platformSubsidy: mongoose.Types.Decimal128.fromString("0.00"),
        discounts: mongoose.Types.Decimal128.fromString("0.00"),
        refunds: mongoose.Types.Decimal128.fromString("0.00"),
        platformCommission: mongoose.Types.Decimal128.fromString("1500.00"),
        netPayable: mongoose.Types.Decimal128.fromString("13500.00"),
        status: "payable",
        currency: "INR",
        orderIds: [],
      });
    });

    it("7.1 creates payout with destination snapshot and switching accounts does NOT alter existing in-flight payout", async () => {
      const idempotencyKey = `idemp-${Date.now()}-${Math.random()}`;

      // Create payout
      const payout = await vendorPayoutService.createPayout({
        settlementId: settlementDoc._id,
        vendorId: vendorBDoc._id,
        provider: "razorpay",
        idempotencyKey,
      });

      expect(payout).toBeDefined();
      expect(payout.status).toBe("pending");

      // Verify metadata captured Bank Account 1
      const meta = payout.metadata ? (payout.metadata instanceof Map ? Object.fromEntries(payout.metadata) : payout.metadata) : {};
      expect(meta.bankAccountId).toBe(String(bankAccount1._id));
      expect(meta.accountNumberMasked).toBe("••••••••••••1111");

      // Now Vendor B switches active account to Bank Account 2
      await request(app)
        .patch(`/api/v1/vendors/me/bank-accounts/${bankAccount2._id}/active`)
        .set("Authorization", `Bearer ${vendorBToken}`);

      const b2 = await VendorBankAccount.findById(bankAccount2._id);
      expect(b2.isActive).toBe(true);

      // Verify in-flight payout still references Bank Account 1 snapshot
      const refreshedPayout = await VendorPayout.findById(payout._id);
      const refreshedMeta = refreshedPayout.metadata instanceof Map
        ? Object.fromEntries(refreshedPayout.metadata)
        : refreshedPayout.metadata;

      expect(refreshedMeta.bankAccountId).toBe(String(bankAccount1._id));
      expect(refreshedMeta.accountNumberMasked).toBe("••••••••••••1111");
    });

    it("7.2 blocks deletion of bank account linked to an in-flight payout", async () => {
      const idempotencyKey = `idemp-del-${Date.now()}-${Math.random()}`;

      await vendorPayoutService.createPayout({
        settlementId: settlementDoc._id,
        vendorId: vendorBDoc._id,
        provider: "razorpay",
        idempotencyKey,
      });

      // Attempt to soft-delete Bank Account 1 while payout is pending
      const delRes = await request(app)
        .delete(`/api/v1/admin/vendors/${vendorBDoc._id}/bank-accounts/${bankAccount1._id}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Attempting to delete active destination during pending disbursement" });

      expect(delRes.status).toBe(400);
      expect(delRes.body.errorCode).toBe("CANNOT_DELETE_ACTIVE_PAYOUT_ACCOUNT");
    });
  });
});
