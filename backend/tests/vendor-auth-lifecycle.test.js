const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const Otp = require("../src/models/Otp");
const PasswordResetToken = require("../src/models/PasswordResetToken");
const RefreshToken = require("../src/models/RefreshToken");
const { hashPassword } = require("../src/utils/password");
const { hashOtp } = require("../src/utils/crypto.util");
const { hashToken } = require("../src/utils/token-hash");
const { generateAccessToken } = require("../src/services/token.service");
const { ROLES } = require("../src/constants/auth.constants");

describe("Production Vendor Authentication & Lifecycle Integration Suite", () => {
  let createdUserIds = [];
  let createdVendorIds = [];
  let testEmail;
  let testPassword = "VendorPassword123!";

  const TEST_MONGODB_URI = process.env.MONGODB_URI
    ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_vendor_auth_test?")
    : "mongodb://127.0.0.1:27017/buybox_vendor_auth_test?replicaSet=rs0";

  jest.setTimeout(60000);

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
      await Vendor.deleteMany({ userId: { $in: createdUserIds } });
      await Otp.deleteMany({ userId: { $in: createdUserIds } });
      await PasswordResetToken.deleteMany({ userId: { $in: createdUserIds } });
      await RefreshToken.deleteMany({ userId: { $in: createdUserIds } });
    }
    if (createdVendorIds.length > 0) {
      await Vendor.deleteMany({ _id: { $in: createdVendorIds } });
    }
    await mongoose.connection.close();
  });

  describe("1. Vendor Registration & Email Verification OTP Dispatch", () => {
    it("registers a new vendor and automatically creates an active verification OTP", async () => {
      testEmail = `merchant-auth-${Date.now()}@example.com`;
      const res = await request(app)
        .post("/api/v1/vendors/register")
        .send({
          email: testEmail,
          password: testPassword,
          firstName: "Vikram",
          lastName: "Merchant",
          businessName: "Vikram Retail Group",
          businessSlug: `vikram-retail-${Date.now()}`,
          phone: "+919876543210",
          supportEmail: "support@example.com",
          businessAddress: {
            addressLine1: "123 Market St",
            city: "Mumbai",
            state: "Maharashtra",
            postalCode: "400001",
            country: "IN",
          },
          taxInformation: {
            taxId: "27AAAAA0000A1Z5",
            taxType: "GSTIN",
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(testEmail);
      expect(res.body.data.user.isEmailVerified).toBe(false);
      expect(res.body.data.user.requireVerification).toBe(true);
      expect(res.body.data.vendor.onboardingStatus).toBe("pending");
      expect(res.body.data.vendor.isActive).toBe(false);

      createdUserIds.push(res.body.data.user.id);
      createdVendorIds.push(res.body.data.vendor.id);

      // Verify OTP document was persisted in DB with hash
      const otpDoc = await Otp.findOne({
        email: testEmail,
        purpose: "email_verification",
        isUsed: false,
      });

      expect(otpDoc).toBeTruthy();
      expect(otpDoc.otpHash).toBeDefined();
      expect(otpDoc.otpHash.length).toBe(64); // SHA-256 hash length
    });

    it("rejects duplicate email registration with 409", async () => {
      const verifiedEmail = `verified-vendor-${Date.now()}@example.com`;
      const verifiedUser = await User.create({
        email: verifiedEmail,
        password: await hashPassword(testPassword),
        firstName: "Verified",
        lastName: "Vendor",
        role: ROLES.VENDOR,
        isEmailVerified: true,
      });
      createdUserIds.push(verifiedUser._id);

      const res = await request(app)
        .post("/api/v1/vendors/register")
        .send({
          email: verifiedEmail,
          password: testPassword,
          firstName: "Duplicate",
          lastName: "User",
          businessName: "Duplicate Corp",
          businessSlug: `duplicate-corp-${Date.now()}`,
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("EMAIL_ALREADY_EXISTS");
    });

    it("resumes verification for existing unverified vendor when cooldown has elapsed", async () => {
      // Simulate cooldown elapsed on existing active OTP
      await Otp.updateMany(
        { email: testEmail },
        { $set: { lastResentAt: new Date(Date.now() - 70000) } }
      );

      const res = await request(app)
        .post("/api/v1/vendors/register")
        .send({
          email: testEmail,
          password: testPassword,
          firstName: "Vikram",
          lastName: "Merchant",
          businessName: "Vikram Retail Group",
          businessSlug: `vikram-retail-resumed-${Date.now()}`,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(testEmail);
      expect(res.body.data.user.isEmailVerified).toBe(false);
      expect(res.body.data.user.requireVerification).toBe(true);
      expect(res.body.data.vendor).toBeDefined();
    });

    it("vendor registration response NEVER exposes OTP even in development mode", async () => {
      const devEmail = `dev-vendor-${Date.now()}@example.com`;
      const originalNodeEnv = process.env.NODE_ENV;

      process.env.NODE_ENV = "development";

      try {
        const res = await request(app)
          .post("/api/v1/vendors/register")
          .send({
            email: devEmail,
            password: testPassword,
            firstName: "DevVendor",
            lastName: "Tester",
            businessName: "Dev Vendor Store",
            businessSlug: `dev-vendor-${Date.now()}`,
          });

        expect(res.status).toBe(201);
        createdUserIds.push(res.body.data.user.id);
        createdVendorIds.push(res.body.data.vendor.id);

        expect(res.body.data.vendor.devOtp).toBeUndefined();
        expect(res.body.data.user.devOtp).toBeUndefined();
        expect(JSON.stringify(res.body)).not.toMatch(/devOtp/);
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });

    it("production vendor registration contains NO devOtp even if OTP_DEV_DISPLAY is accidentally true", async () => {
      const prodEmail = `prod-vendor-${Date.now()}@example.com`;
      const originalNodeEnv = process.env.NODE_ENV;
      const originalFlag = process.env.OTP_DEV_DISPLAY;

      process.env.NODE_ENV = "production";
      process.env.OTP_DEV_DISPLAY = "true"; // Accidentally enabled in production

      try {
        const res = await request(app)
          .post("/api/v1/vendors/register")
          .send({
            email: prodEmail,
            password: testPassword,
            firstName: "ProdVendor",
            lastName: "Tester",
            businessName: "Prod Vendor Store",
            businessSlug: `prod-vendor-${Date.now()}`,
          });

        expect(res.status).toBe(201);
        createdUserIds.push(res.body.data.user.id);
        createdVendorIds.push(res.body.data.vendor.id);

        expect(res.body.data.vendor.devOtp).toBeUndefined();
        expect(res.body.data.user.devOtp).toBeUndefined();
        expect(JSON.stringify(res.body)).not.toMatch(/devOtp/);
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
        process.env.OTP_DEV_DISPLAY = originalFlag;
      }
    });
  });

  describe("2. OTP Email Verification & Cooldown Guards", () => {
    it("rejects verification with an incorrect OTP and decrements attempts", async () => {
      const res = await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({
          email: testEmail,
          otp: "000000",
          purpose: "email_verification",
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_OTP");
      expect(res.body.message).toMatch(/Invalid verification code/i);
    });

    it("enforces resend cooldown when requested immediately after registration", async () => {
      const res = await request(app)
        .post("/api/v1/auth/resend-otp")
        .send({
          email: testEmail,
          purpose: "email_verification",
        });

      expect(res.status).toBe(429);
      expect(res.body.code).toBe("RESEND_COOLDOWN_ACTIVE");
    });

    it("successfully verifies email when valid OTP is provided", async () => {
      // Create a deterministic OTP directly for test verification
      const testOtp = "789123";
      await Otp.deleteMany({ email: testEmail });
      await Otp.create({
        email: testEmail,
        purpose: "email_verification",
        otpHash: hashOtp(testOtp),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attemptsCount: 0,
        resendCount: 0,
        isUsed: false,
      });

      const res = await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({
          email: testEmail,
          otp: testOtp,
          purpose: "email_verification",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.isEmailVerified).toBe(true);

      // Verify User record updated
      const updatedUser = await User.findOne({ email: testEmail });
      expect(updatedUser.isEmailVerified).toBe(true);
    });
  });

  describe("3. Vendor Login & Onboarding State Reporting", () => {
    it("returns isEmailVerified = true and vendor onboardingStatus on login", async () => {
      const res = await request(app)
        .post("/api/v1/vendor/auth/login")
        .send({
          email: testEmail,
          password: testPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.isEmailVerified).toBe(true);
      expect(res.body.data.user.role).toBe(ROLES.VENDOR);
      expect(res.body.data.user.vendor).toBeDefined();
      expect(res.body.data.user.vendor.onboardingStatus).toBe("pending");
      expect(res.body.data.accessToken).toBeDefined();
    });

    it("blocks operational dashboard access for pending onboarding vendor with 403", async () => {
      const user = await User.findOne({ email: testEmail });
      const vendorToken = generateAccessToken({
        sub: user._id.toString(),
        id: user._id.toString(),
        role: ROLES.VENDOR,
        roles: [ROLES.VENDOR],
      });

      const res = await request(app)
        .get("/api/v1/vendors/me/dashboard")
        .set("Authorization", `Bearer ${vendorToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("VENDOR_ONBOARDING_NOT_APPROVED");
    });
  });

  describe("4. Forgot Password & Reset Lifecycle", () => {
    it("returns generic 200 message for non-existing email to prevent enumeration", async () => {
      const res = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send({
          email: "nonexistent-merchant@nowhere.com",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("generates single-use reset token and permits password reset", async () => {
      const forgotRes = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send({
          email: testEmail,
        });

      expect(forgotRes.status).toBe(200);

      // Verify token created
      const user = await User.findOne({ email: testEmail });
      const tokenDoc = await PasswordResetToken.findOne({
        userId: user._id,
        usedAt: null,
      });

      expect(tokenDoc).toBeTruthy();

      // Seed a unique random token to execute reset
      const crypto = require("crypto");
      const plainResetToken = crypto.randomBytes(32).toString("hex");
      await PasswordResetToken.deleteMany({ tokenHash: hashToken(plainResetToken) });
      await PasswordResetToken.create({
        userId: user._id,
        tokenHash: hashToken(plainResetToken),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      const newPassword = "BrandNewVendorPassword456!";
      const resetRes = await request(app)
        .post("/api/v1/auth/reset-password")
        .send({
          token: plainResetToken,
          newPassword,
        });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);

      // Old password should fail
      const failedLogin = await request(app)
        .post("/api/v1/vendor/auth/login")
        .send({
          email: testEmail,
          password: testPassword,
        });
      expect(failedLogin.status).toBe(401);

      // New password should succeed
      const successfulLogin = await request(app)
        .post("/api/v1/vendor/auth/login")
        .send({
          email: testEmail,
          password: newPassword,
        });
      expect(successfulLogin.status).toBe(200);
      testPassword = newPassword;
    });
  });

  describe("5. Authenticated Change Password & Session Invalidation", () => {
    it("rejects password change when current password is wrong", async () => {
      const user = await User.findOne({ email: testEmail });
      const token = generateAccessToken({
        sub: user._id.toString(),
        id: user._id.toString(),
        role: ROLES.VENDOR,
        roles: [ROLES.VENDOR],
      });

      const res = await request(app)
        .post("/api/v1/auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({
          currentPassword: "WrongCurrentPassword123!",
          newPassword: "UpdatedVendorPassword789!",
          confirmPassword: "UpdatedVendorPassword789!",
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_CURRENT_PASSWORD");
    });

    it("rejects password change when new password matches current password", async () => {
      const user = await User.findOne({ email: testEmail });
      const token = generateAccessToken({
        sub: user._id.toString(),
        id: user._id.toString(),
        role: ROLES.VENDOR,
        roles: [ROLES.VENDOR],
      });

      const res = await request(app)
        .post("/api/v1/auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({
          currentPassword: testPassword,
          newPassword: testPassword,
          confirmPassword: testPassword,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("PASSWORD_SAME_AS_OLD");
    });

    it("successfully changes password when current password is verified", async () => {
      const user = await User.findOne({ email: testEmail });
      const initialAuthVersion = user.authVersion || 1;
      const token = generateAccessToken({
        sub: user._id.toString(),
        id: user._id.toString(),
        role: ROLES.VENDOR,
        roles: [ROLES.VENDOR],
      });

      const finalPassword = "FinalSecureVendorPassword999!";
      const res = await request(app)
        .post("/api/v1/auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({
          currentPassword: testPassword,
          newPassword: finalPassword,
          confirmPassword: finalPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const refreshedUser = await User.findById(user._id);
      expect(refreshedUser.authVersion).toBeGreaterThan(initialAuthVersion);

      // Verify sign in works with new password
      const loginRes = await request(app)
        .post("/api/v1/vendor/auth/login")
        .send({
          email: testEmail,
          password: finalPassword,
        });
      expect(loginRes.status).toBe(200);
    });
  });
});
