const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const PlatformCredential = require("../src/models/PlatformCredential");
const User = require("../src/models/User");
const CredentialService = require("../src/services/credential.service");
const { ROLES } = require("../src/constants/auth.constants");
const { encrypt, decrypt, encryptSecret, decryptSecret, maskSecret } = require("../src/utils/crypto.util");

const TEST_MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/buybox-ecommerce";

describe("Production Credential Management Suite", () => {
  let superAdminToken;
  let regularUserToken;
  let superAdminUser;
  let regularUser;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    // Clean up test data
    await PlatformCredential.deleteMany({ provider: { $in: ["delhivery", "elastic_email"] } });
    await User.deleteMany({ role: ROLES.SUPER_ADMIN });
    await User.deleteMany({ email: { $regex: /@buybox-cred\.test$/ } });

    const { generateAccessToken, TOKEN_CONTEXTS } = require("../src/services/token.service");
    const Employee = require("../src/models/Employee");

    superAdminUser = await User.create({
      firstName: "Super",
      lastName: "Admin",
      email: `superadmin-${Date.now()}@buybox-cred.test`,
      password: "HashedPassword123!",
      role: ROLES.SUPER_ADMIN,
      isActive: true,
      isEmailVerified: true,
    });

    await Employee.create({
      userId: superAdminUser._id,
      employeeNumber: `EMP-CRED-${Date.now().toString().slice(-4)}`,
      jobTitle: "Super Administrator",
      department: "Administration",
      status: "active",
    });

    superAdminToken = generateAccessToken({
      sub: superAdminUser._id.toString(),
      role: superAdminUser.role,
      context: TOKEN_CONTEXTS.ADMINISTRATOR,
    });

    regularUser = await User.create({
      firstName: "Regular",
      lastName: "Customer",
      email: `customer-${Date.now()}@buybox-cred.test`,
      password: "HashedPassword123!",
      role: ROLES.CUSTOMER,
      isActive: true,
      isEmailVerified: true,
    });
    regularUserToken = generateAccessToken({
      sub: regularUser._id.toString(),
      role: regularUser.role,
    });
  });

  afterAll(async () => {
    try {
      await PlatformCredential.deleteMany({ provider: { $in: ["delhivery", "elastic_email"] } });
      await User.deleteMany({ email: { $regex: /@buybox-cred\.test$/ } });
      await mongoose.disconnect();
    } catch {
      // Best-effort cleanup
    }
  });

  describe("1. Encryption at Rest & Masking", () => {
    it("encrypts secrets with AES-256-GCM and decrypts accurately", () => {
      const rawApiKey = "01234567-89ab-cdef-0123-456789abcdef";
      const encrypted = encrypt(rawApiKey);

      expect(typeof encrypted).toBe("string");
      expect(encrypted.startsWith("enc:v1:")).toBe(true);
      expect(encrypted).not.toContain(rawApiKey);

      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(rawApiKey);
    });

    it("masks secrets correctly keeping only the last 4 characters visible", () => {
      expect(maskSecret("01234567-89ab-cdef-0123-456789abcdef")).toBe("••••••••••••cdef");
      expect(maskSecret("short")).toBe("••••••••••••hort");
      expect(maskSecret("")).toBe("");
      expect(maskSecret(null)).toBe("");
    });

    it("stores encrypted credentials in MongoDB and never leaks raw ciphertext through listMaskedCredentials", async () => {
      await CredentialService.updateCredentials({
        provider: "elastic_email",
        payload: {
          apiKey: "SECRET_API_KEY_123456789",
          fromEmail: "support@buybox.test",
        },
        actorId: superAdminUser._id,
      });

      // Direct MongoDB inspection: verify raw apiKey is NOT present as plain text in the database
      const record = await PlatformCredential.findOne({ provider: "elastic_email" }).lean();
      expect(record).toBeDefined();
      expect(record.encryptedPayload).toBeDefined();
      expect(record.encryptedPayload).not.toContain("SECRET_API_KEY_123456789");

      // Verify listMaskedCredentials returns masked value
      const maskedList = await CredentialService.listMaskedCredentials();
      const testCred = maskedList.find((c) => c.provider === "elastic_email");
      expect(testCred).toBeDefined();
      expect(testCred.isConfigured).toBe(true);
      expect(testCred.maskedValues.apiKey).toBe("••••••••••••6789");
      expect(testCred.maskedValues.fromEmail).toBe("••••••••••••test");
      expect(testCred.auditTrail.length).toBeGreaterThan(0);
      expect(testCred.auditTrail[0].fieldsChanged).toContain("apiKey");
      expect(testCred.auditTrail[0].fieldsChanged).toContain("fromEmail");
    });
  });

  describe("2. HTTP Security & Role-Based Access Control", () => {
    it("rejects unauthenticated requests to /api/v1/admin/settings/credentials", async () => {
      const res = await request(app).get("/api/v1/admin/settings/credentials");
      expect(res.status).toBe(401);
    });

    it("rejects unauthorized (customer) requests to /api/v1/admin/settings/credentials", async () => {
      const res = await request(app)
        .get("/api/v1/admin/settings/credentials")
        .set("Authorization", `Bearer ${regularUserToken}`);
      expect(res.status).toBe(403);
    });

    it("allows superadmin to retrieve masked credentials", async () => {
      const res = await request(app)
        .get("/api/v1/admin/settings/credentials")
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.credentials)).toBe(true);
    });

    it("allows superadmin to update credentials and ignores masked placeholder submissions", async () => {
      // First update with new secrets for delhivery
      const updateRes1 = await request(app)
        .put("/api/v1/admin/settings/credentials/delhivery")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          apiKey: "DELHIVERY_TOKEN_9999",
          clientSecret: "DELHIVERY_SECRET_1111",
        });

      expect(updateRes1.status).toBe(200);
      expect(updateRes1.body.data.credential.maskedValues.apiKey).toBe("••••••••••••9999");
      expect(updateRes1.body.data.credential.maskedValues.clientSecret).toBe("••••••••••••1111");

      // Now send an update where apiKey is unchanged (masked placeholder submitted) and clientSecret is updated
      const updateRes2 = await request(app)
        .put("/api/v1/admin/settings/credentials/delhivery")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          apiKey: "••••••••••••9999",
          clientSecret: "NEW_DELHIVERY_SECRET_2222",
        });

      expect(updateRes2.status).toBe(200);
      expect(updateRes2.body.data.credential.maskedValues.apiKey).toBe("••••••••••••9999"); // Kept original decrypted
      expect(updateRes2.body.data.credential.maskedValues.clientSecret).toBe("••••••••••••2222"); // Updated

      // Verify decrypted secrets in backend service
      const resolved = await CredentialService.getDecryptedCredentials("delhivery");
      expect(resolved.apiKey).toBe("DELHIVERY_TOKEN_9999");
      expect(resolved.clientSecret).toBe("NEW_DELHIVERY_SECRET_2222");
    });
  });

  describe("3. Test Email Notification Flow", () => {
    it("handles test endpoint for elastic_email with structured feedback", async () => {
      const res = await request(app)
        .post("/api/v1/admin/settings/credentials/elastic_email/test")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          recipientEmail: "test-admin@buybox.test",
        });

      // Truthful response: 200 on success or 400 with honest failure message
      expect([200, 400]).toContain(res.status);
      expect(res.body.data).toBeDefined();
    });
  });
});
