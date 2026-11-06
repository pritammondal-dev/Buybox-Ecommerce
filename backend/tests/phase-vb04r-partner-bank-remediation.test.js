const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../src/app");
const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const PartnerBank = require("../src/models/PartnerBank");
const { VendorBankAccount } = require("../src/models/VendorBankAccount");
const AuditLog = require("../src/models/AuditLog");
const { ROLES } = require("../src/constants/auth.constants");
const { hashPassword } = require("../src/utils/password");
const {
  generateAccessToken,
  TOKEN_CONTEXTS,
  TOKEN_AUDIENCES,
} = require("../src/services/token.service");
const { seedDefaultPartnerBanks } = require("../src/services/partner-bank.service");

describe("Phase VB-04R: Approval Defect Remediation & Partner Bank Directory", () => {
  jest.setTimeout(30000);

  let superadminUser;
  let superadminToken;
  let regularVendorUser;
  let regularVendorToken;
  let vendorDoc;
  let testPartnerBank;

  const TEST_URI = process.env.MONGODB_URI
    ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_vb04r_test?")
    : "mongodb://127.0.0.1:27017/buybox_vb04r_test?replicaSet=rs0";

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_URI, { autoIndex: true });
    }

    // 1. Provision Superadmin
    superadminUser = await User.findOne({ role: ROLES.SUPER_ADMIN, isActive: true });
    if (!superadminUser) {
      superadminUser = await User.create({
        firstName: "Compliance",
        lastName: "Superadmin",
        email: `superadmin.vb04r.${Date.now()}@example.com`,
        password: await hashPassword("SuperAdminPass123!"),
        role: ROLES.SUPER_ADMIN,
        roles: [ROLES.SUPER_ADMIN],
        isEmailVerified: true,
        isActive: true,
      });
    }
    superadminToken = generateAccessToken(
      {
        sub: superadminUser._id.toString(),
        userId: superadminUser._id.toString(),
        role: ROLES.SUPER_ADMIN,
        email: superadminUser.email,
      },
      {
        context: TOKEN_CONTEXTS.ADMINISTRATOR,
        audience: TOKEN_AUDIENCES.ADMINISTRATOR,
      }
    );

    // 2. Provision Vendor & User
    regularVendorUser = await User.create({
      firstName: "Merchant",
      lastName: "Owner",
      email: `merchant.vb04r.${Date.now()}@example.com`,
      password: await hashPassword("VendorPass123!"),
      role: ROLES.VENDOR,
      roles: [ROLES.VENDOR],
      isEmailVerified: true,
      isActive: true,
    });
    regularVendorToken = generateAccessToken(
      {
        sub: regularVendorUser._id.toString(),
        userId: regularVendorUser._id.toString(),
        role: ROLES.VENDOR,
        email: regularVendorUser.email,
      },
      {
        context: TOKEN_CONTEXTS.PORTAL,
        audience: TOKEN_AUDIENCES.PORTAL,
      }
    );

    vendorDoc = await Vendor.create({
      userId: regularVendorUser._id,
      businessName: "VB04R Merchant Store",
      businessSlug: `vb04r-merchant-store-${Date.now()}`,
      businessEmail: regularVendorUser.email,
      phone: "+919876543210",
      taxId: "27AABCV1234F1Z5",
      onboardingStatus: "approved",
      isActive: true,
    });

    // 3. Seed Default Partner Banks
    await seedDefaultPartnerBanks();

    testPartnerBank = await PartnerBank.findOne({ code: "HDFC" });
  });

  afterAll(async () => {
    if (regularVendorUser?._id) {
      await User.deleteMany({ _id: regularVendorUser._id });
    }
    if (vendorDoc?._id) {
      await Vendor.deleteMany({ _id: vendorDoc._id });
      await VendorBankAccount.deleteMany({ vendorId: vendorDoc._id });
    }
    await PartnerBank.deleteMany({ code: { $in: ["TESTBANK", "CUSTOM99"] } });
    await mongoose.connection.close();
  });

  describe("1. Priority P0: Bank Application Approval Validation", () => {
    let pendingAccountId;

    beforeEach(async () => {
      // Create a fresh pending bank account application
      const res = await request(app)
        .post("/api/v1/vendors/me/bank-accounts")
        .set("Authorization", `Bearer ${regularVendorToken}`)
        .send({
          partnerBankId: testPartnerBank._id.toString(),
          accountHolderName: "VB04R Merchant Store",
          accountNumber: "123456789012",
          confirmAccountNumber: "123456789012",
          ifscCode: "HDFC0001234",
          country: "IN",
          state: "Maharashtra",
          accountType: "current",
        });

      expect(res.status).toBe(201);
      pendingAccountId = res.body.data.account.id;
    });

    afterEach(async () => {
      await VendorBankAccount.deleteMany({ vendorId: vendorDoc._id });
    });

    test("P0.1: Superadmin approval succeeds with string reason note", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/vendors/bank-accounts/${pendingAccountId}/approve`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          reason: "Approved after verifying passbook and GST registration",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.account.status).toBe("approved");

      // Verify audit log
      const audit = await AuditLog.findOne({
        targetId: pendingAccountId,
        action: "vendor_bank_account.approved",
      });
      expect(audit).toBeDefined();
      expect(audit.reason).toContain("passbook and GST");
    });

    test("P0.2: Superadmin approval succeeds with empty / omitted reason payload", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/vendors/bank-accounts/${pendingAccountId}/approve`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.account.status).toBe("approved");
    });

    test("P0.3: Non-string object reason payload is safely rejected with 400 (not silently accepted)", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/vendors/bank-accounts/${pendingAccountId}/approve`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          reason: { nested: "object" },
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/string/i);
    });

    test("P0.4: Rejection requires valid string reason (min 10 chars)", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/vendors/bank-accounts/${pendingAccountId}/reject`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          reason: "Too short",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test("P0.5: Unauthorized user cannot approve applications", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/vendors/bank-accounts/${pendingAccountId}/approve`)
        .set("Authorization", `Bearer ${regularVendorToken}`)
        .send({
          reason: "Unauthorized attempt",
        });

      expect(res.status).toBe(403);
    });
  });

  describe("2. Partner Bank Directory Management", () => {
    let createdBankId;

    test("2.1: Superadmin creates a partner bank", async () => {
      const res = await request(app)
        .post("/api/v1/admin/partner-banks")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          name: "Test Commercial Bank",
          code: "TESTBANK",
          aliases: ["TCB", "Test Bank"],
          countries: ["IN"],
          supportedStates: ["Maharashtra", "Karnataka", "Delhi"],
          routingSystem: "IFSC",
          ifscPrefix: "TEST",
          isActive: true,
          isEligibleForNewApplications: true,
          displayOrder: 25,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.bank.code).toBe("TESTBANK");
      createdBankId = res.body.data.bank.id;

      // Verify audit log
      const audit = await AuditLog.findOne({
        targetId: createdBankId,
        action: "partner_bank.created",
      });
      expect(audit).toBeDefined();
    });

    test("2.2: Duplicate bank code is rejected with 400", async () => {
      const res = await request(app)
        .post("/api/v1/admin/partner-banks")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          name: "Another Bank with Same Code",
          code: "TESTBANK",
          countries: ["IN"],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already exists/i);
    });

    test("2.3: Search matches canonical name and aliases", async () => {
      const res = await request(app)
        .get("/api/v1/partner-banks?search=Housing")
        .expect(200);

      expect(res.body.data.items.length).toBeGreaterThan(0);
      expect(res.body.data.items[0].code).toBe("HDFC");
    });

    test("2.4: Superadmin disables partner bank for new applications", async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/partner-banks/${createdBankId}/status`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          isEligibleForNewApplications: false,
          reason: "Temporarily suspended due to API maintenance",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.bank.isEligibleForNewApplications).toBe(false);

      // Verify audit log
      const audit = await AuditLog.findOne({
        targetId: createdBankId,
        action: "partner_bank.disabled",
      });
      expect(audit).toBeDefined();
    });

    test("2.5: Vendor cannot select an ineligible/disabled partner bank", async () => {
      const res = await request(app)
        .post("/api/v1/vendors/me/bank-accounts")
        .set("Authorization", `Bearer ${regularVendorToken}`)
        .send({
          partnerBankId: createdBankId,
          accountHolderName: "VB04R Merchant Store",
          accountNumber: "998877665544",
          confirmAccountNumber: "998877665544",
          ifscCode: "TEST0001234",
          country: "IN",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not eligible for new applications/i);
    });

    test("2.6: Vendors cannot create partner banks", async () => {
      const res = await request(app)
        .post("/api/v1/admin/partner-banks")
        .set("Authorization", `Bearer ${regularVendorToken}`)
        .send({
          name: "Hacker Bank",
          code: "HACK",
        });

      expect(res.status).toBe(403);
    });
  });

  describe("3. Application Form Fields: Country, State, Optional Branch", () => {
    test("3.1: Vendor creates account with partnerBankId, country, state, and omitted branch", async () => {
      const res = await request(app)
        .post("/api/v1/vendors/me/bank-accounts")
        .set("Authorization", `Bearer ${regularVendorToken}`)
        .send({
          partnerBankId: testPartnerBank._id.toString(),
          accountHolderName: "VB04R Merchant Store",
          accountNumber: "556677889900",
          confirmAccountNumber: "556677889900",
          ifscCode: "HDFC0005678",
          country: "IN",
          state: "Maharashtra",
          // branchName intentionally omitted
        });

      expect(res.status).toBe(201);
      const acc = res.body.data.account;
      expect(acc.branchName).toBeNull();
      expect(acc.country).toBe("IN");
      expect(acc.state).toBe("Maharashtra");
      expect(acc.bankName).toBe("HDFC Bank");
    });

    test("3.2: Empty branchName string is stored as null without rejection", async () => {
      const res = await request(app)
        .post("/api/v1/vendors/me/bank-accounts")
        .set("Authorization", `Bearer ${regularVendorToken}`)
        .send({
          partnerBankId: testPartnerBank._id.toString(),
          accountHolderName: "VB04R Merchant Store",
          accountNumber: "112233445566",
          confirmAccountNumber: "112233445566",
          ifscCode: "HDFC0009999",
          country: "IN",
          branchName: "",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.account.branchName).toBeNull();
    });

    test("3.3: Invalid partner bank ID is rejected", async () => {
      const res = await request(app)
        .post("/api/v1/vendors/me/bank-accounts")
        .set("Authorization", `Bearer ${regularVendorToken}`)
        .send({
          partnerBankId: "666666666666666666666666",
          accountHolderName: "VB04R Merchant Store",
          accountNumber: "445566778899",
          confirmAccountNumber: "445566778899",
          ifscCode: "HDFC0001234",
          country: "IN",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/partner bank not found/i);
    });
  });

  describe("4. Existing Workflows, Resubmission & Payout Safety", () => {
    let rejectedAccountId;

    beforeEach(async () => {
      await VendorBankAccount.deleteMany({ vendorId: vendorDoc._id });
    });

    test("4.1: Legacy bank account without partnerBankId remains readable", async () => {
      const { computeBankAccountHash, encryptBankAccount, maskBankAccount } = require("../src/utils/bank-crypto.util");
      const legacy = await VendorBankAccount.create({
        vendorId: vendorDoc._id,
        accountHolderName: "Legacy Account Holder",
        bankName: "Legacy Pre-Migration Bank",
        accountNumberEncrypted: encryptBankAccount("999888777666"),
        accountNumberMasked: maskBankAccount("999888777666"),
        accountNumberHash: computeBankAccountHash("999888777666", "SBIN0001234"),
        ifscCode: "SBIN0001234",
        status: "approved",
        isActive: false,
        submittedBy: regularVendorUser._id,
      });

      const res = await request(app)
        .get("/api/v1/vendors/me/bank-accounts")
        .set("Authorization", `Bearer ${regularVendorToken}`)
        .expect(200);

      const found = res.body.data.accounts.find((a) => a.id === legacy._id.toString());
      expect(found).toBeDefined();
      expect(found.bankName).toBe("Legacy Pre-Migration Bank");
      expect(found.partnerBankId).toBeNull();

      await VendorBankAccount.deleteOne({ _id: legacy._id });
    });

    test("4.2: Resubmission uses partnerBankId and updates status to pending", async () => {
      // 1. Create account
      const createRes = await request(app)
        .post("/api/v1/vendors/me/bank-accounts")
        .set("Authorization", `Bearer ${regularVendorToken}`)
        .send({
          partnerBankId: testPartnerBank._id.toString(),
          accountHolderName: "VB04R Merchant Store",
          accountNumber: "778899001122",
          confirmAccountNumber: "778899001122",
          ifscCode: "HDFC0001122",
          country: "IN",
        });
      expect(createRes.status).toBe(201);
      rejectedAccountId = createRes.body.data.account.id;

      // 2. Reject it with admin
      const rejectRes = await request(app)
        .post(`/api/v1/admin/vendors/bank-accounts/${rejectedAccountId}/reject`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          reason: "Account holder name mismatch on passbook verification",
        });
      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.data.account.status).toBe("rejected");

      // 3. Resubmit with corrected details and SBI partner bank
      const sbiBank = await PartnerBank.findOne({ code: "SBIN" });
      const resubmitRes = await request(app)
        .post(`/api/v1/vendors/me/bank-accounts/${rejectedAccountId}/resubmit`)
        .set("Authorization", `Bearer ${regularVendorToken}`)
        .send({
          partnerBankId: sbiBank._id.toString(),
          accountHolderName: "VB04R Merchant Store Corrected",
          accountNumber: "778899001122",
          confirmAccountNumber: "778899001122",
          ifscCode: "SBIN0001122",
          country: "IN",
          state: "Delhi",
        });

      expect(resubmitRes.status).toBe(200);
      expect(resubmitRes.body.data.account.status).toBe("pending");
      expect(resubmitRes.body.data.account.bankName).toBe("State Bank of India");
      expect(resubmitRes.body.data.account.state).toBe("Delhi");
    });

    test("4.3: Superadmin administratively creates bank account with partner bank", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/vendors/${vendorDoc._id}/bank-accounts`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          partnerBankId: testPartnerBank._id.toString(),
          accountHolderName: "Admin Created Merchant Bank",
          accountNumber: "334455667788",
          confirmAccountNumber: "334455667788",
          ifscCode: "HDFC0003344",
          country: "IN",
          state: "Karnataka",
          reason: "Created during onboard compliance verification call",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.account.bankName).toBe("HDFC Bank");
      expect(res.body.data.account.state).toBe("Karnataka");
    });

    test("4.4: 3-account limit remains strictly enforced", async () => {
      // Create 3 accounts
      for (let i = 1; i <= 3; i++) {
        await request(app)
          .post("/api/v1/vendors/me/bank-accounts")
          .set("Authorization", `Bearer ${regularVendorToken}`)
          .send({
            partnerBankId: testPartnerBank._id.toString(),
            accountHolderName: `Account Holder ${i}`,
            accountNumber: `99112233445${i}`,
            confirmAccountNumber: `99112233445${i}`,
            ifscCode: `HDFC000100${i}`,
            country: "IN",
          });
      }

      // Attempt 4th
      const res = await request(app)
        .post("/api/v1/vendors/me/bank-accounts")
        .set("Authorization", `Bearer ${regularVendorToken}`)
        .send({
          partnerBankId: testPartnerBank._id.toString(),
          accountHolderName: "Exceeded Limit Bank",
          accountNumber: "991122334499",
          confirmAccountNumber: "991122334499",
          ifscCode: "HDFC0009999",
          country: "IN",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/limit of 3/i);
    });

    test("4.5: Disabling partner bank does not alter or delete existing accounts", async () => {
      // Create an account with HDFC first
      await request(app)
        .post("/api/v1/vendors/me/bank-accounts")
        .set("Authorization", `Bearer ${regularVendorToken}`)
        .send({
          partnerBankId: testPartnerBank._id.toString(),
          accountHolderName: "VB04R Existing Merchant",
          accountNumber: "889900112233",
          confirmAccountNumber: "889900112233",
          ifscCode: "HDFC0008899",
          country: "IN",
        });

      // Disable HDFC
      await request(app)
        .patch(`/api/v1/admin/partner-banks/${testPartnerBank._id}/status`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          isEligibleForNewApplications: false,
          reason: "Temporary partner review",
        });

      // Query vendor's accounts
      const res = await request(app)
        .get("/api/v1/vendors/me/bank-accounts")
        .set("Authorization", `Bearer ${regularVendorToken}`)
        .expect(200);

      // Existing accounts still exist and retain their bankName
      expect(res.body.data.accounts.length).toBeGreaterThan(0);
      const hdfcAcc = res.body.data.accounts.find((a) => a.bankName === "HDFC Bank");
      expect(hdfcAcc).toBeDefined();

      // Re-enable HDFC
      await request(app)
        .patch(`/api/v1/admin/partner-banks/${testPartnerBank._id}/status`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          isEligibleForNewApplications: true,
          isActive: true,
        });
    });
  });
});
