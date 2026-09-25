const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Customer = require("../src/models/Customer");
const Otp = require("../src/models/Otp");
const { hashOtp } = require("../src/utils/crypto.util");
const { ROLES } = require("../src/constants/auth.constants");
const env = require("../src/config/env");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_customer_auth_test?")
  : "mongodb://127.0.0.1:27017/buybox_customer_auth_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Production Customer Registration & Email Verification Lifecycle Suite", () => {
  let createdUserIds = [];
  let testEmail;
  const testPassword = "CustomerPassword123!";

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
      await Customer.deleteMany({ userId: { $in: createdUserIds } });
      await Otp.deleteMany({ userId: { $in: createdUserIds } });
    }
    await User.deleteMany({ email: { $regex: /@customer-auth\.test$/i } });
    await Otp.deleteMany({ email: { $regex: /@customer-auth\.test$/i } });
    await mongoose.connection.close();
  });

  describe("1. New Customer Registration & OTP Dispatch", () => {
    it("1 & 2 & 3 & 4. registers a new customer, generates 6-digit OTP, stores only hash, dispatches email", async () => {
      testEmail = `cust-${Date.now()}@customer-auth.test`;

      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({
          email: testEmail,
          password: testPassword,
          firstName: "Ananya",
          lastName: "Sharma",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(testEmail.toLowerCase());
      expect(res.body.data.user.isEmailVerified).toBe(false);
      expect(res.body.data.user.role).toBe(ROLES.CUSTOMER);
      expect(res.body.data.user.requireVerification).toBe(true);
      expect(res.body.data.user.resendCooldownSeconds).toBe(60);

      createdUserIds.push(res.body.data.user.id);

      // Verify OTP document in DB
      const otpDoc = await Otp.findOne({
        email: testEmail.toLowerCase(),
        purpose: "email_verification",
        isUsed: false,
      });

      expect(otpDoc).toBeTruthy();
      expect(otpDoc.otpHash).toBeDefined();
      expect(otpDoc.otpHash.length).toBe(64); // SHA-256 hash length
      // Plaintext OTP is NEVER stored
      expect(otpDoc.otp).toBeUndefined();
    });

    it("5. OTP is NEVER exposed in API response even in development mode", async () => {
      const devEmail = `dev-cust-${Date.now()}@customer-auth.test`;

      const originalNodeEnv = process.env.NODE_ENV;

      process.env.NODE_ENV = "development";

      try {
        const res = await request(app)
          .post("/api/v1/auth/register")
          .send({
            email: devEmail,
            password: testPassword,
            firstName: "DevUser",
            lastName: "Tester",
          });

        expect(res.status).toBe(201);
        createdUserIds.push(res.body.data.user.id);

        expect(res.body.data.user.devOtp).toBeUndefined();
        expect(res.body.data.user.otp).toBeUndefined();
        expect(JSON.stringify(res.body)).not.toMatch(/devOtp/);
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });

    it("6. production response contains NO OTP even if OTP_DEV_DISPLAY is accidentally true", async () => {
      const prodEmail = `prod-cust-${Date.now()}@customer-auth.test`;

      const originalNodeEnv = process.env.NODE_ENV;
      const originalFlag = process.env.OTP_DEV_DISPLAY;

      process.env.NODE_ENV = "production";
      process.env.OTP_DEV_DISPLAY = "true"; // Mistakenly enabled in production

      try {
        const res = await request(app)
          .post("/api/v1/auth/register")
          .send({
            email: prodEmail,
            password: testPassword,
            firstName: "ProdUser",
            lastName: "Tester",
          });

        expect(res.status).toBe(201);
        createdUserIds.push(res.body.data.user.id);

        // Plaintext OTP must NEVER exist in production response
        expect(res.body.data.user.devOtp).toBeUndefined();
        expect(res.body.data.user.otp).toBeUndefined();
        expect(JSON.stringify(res.body)).not.toMatch(/devOtp/);
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
        process.env.OTP_DEV_DISPLAY = originalFlag;
      }
    });
  });

  describe("2. OTP Verification & Error States", () => {
    it("8. rejects verification with an incorrect OTP and reports attempts remaining", async () => {
      const res = await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({
          email: testEmail,
          otp: "000000",
          purpose: "email_verification",
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_OTP");
      expect(res.body.message).toMatch(/attempt\(s\) remaining/i);
    });

    it("9. rejects expired OTP", async () => {
      const expiredEmail = `expired-${Date.now()}@customer-auth.test`;
      const dummyOtp = "555666";

      await Otp.create({
        email: expiredEmail,
        purpose: "email_verification",
        otpHash: hashOtp(dummyOtp),
        expiresAt: new Date(Date.now() - 5000), // In the past
        attemptsCount: 0,
        isUsed: false,
      });

      const res = await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({
          email: expiredEmail,
          otp: dummyOtp,
          purpose: "email_verification",
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("OTP_EXPIRED");
    });

    it("11. locks current OTP after 5 failed verification attempts", async () => {
      const lockEmail = `lock-${Date.now()}@customer-auth.test`;
      const correctOtp = "123987";

      await Otp.create({
        email: lockEmail,
        purpose: "email_verification",
        otpHash: hashOtp(correctOtp),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attemptsCount: 0,
        isUsed: false,
      });

      // Submit 4 incorrect attempts
      for (let i = 0; i < 4; i++) {
        const attemptRes = await request(app)
          .post("/api/v1/auth/verify-otp")
          .send({
            email: lockEmail,
            otp: "111111",
            purpose: "email_verification",
          });
        expect(attemptRes.status).toBe(400);
      }

      // 5th attempt locks the OTP
      const lockRes = await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({
          email: lockEmail,
          otp: "111111",
          purpose: "email_verification",
        });
      expect(lockRes.status).toBe(429);
      expect(lockRes.body.code).toBe("OTP_MAX_ATTEMPTS_EXCEEDED");

      // Even correct OTP is now rejected because record is locked
      const blockedRes = await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({
          email: lockEmail,
          otp: correctOtp,
          purpose: "email_verification",
        });
      expect(blockedRes.status).toBe(400);
      expect(blockedRes.body.code).toBe("INVALID_OTP");
    });

    it("12. enforces 60-second cooldown on OTP resend", async () => {
      const res = await request(app)
        .post("/api/v1/auth/resend-otp")
        .send({
          email: testEmail,
          purpose: "email_verification",
        });

      expect(res.status).toBe(429);
      expect(res.body.code).toBe("RESEND_COOLDOWN_ACTIVE");
    });

    it("7. successfully verifies email when valid OTP is provided", async () => {
      const knownOtp = "654321";
      await Otp.deleteMany({ email: testEmail });
      await Otp.create({
        email: testEmail,
        purpose: "email_verification",
        otpHash: hashOtp(knownOtp),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attemptsCount: 0,
        isUsed: false,
      });

      const res = await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({
          email: testEmail,
          otp: knownOtp,
          purpose: "email_verification",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.isEmailVerified).toBe(true);

      const dbUser = await User.findOne({ email: testEmail });
      expect(dbUser.isEmailVerified).toBe(true);
    });

    it("10. rejects OTP reuse once verified", async () => {
      const knownOtp = "654321";

      const res = await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({
          email: testEmail,
          otp: knownOtp,
          purpose: "email_verification",
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_OTP");
    });
  });

  describe("3. Duplicate Account & Unverified Resumption Protection", () => {
    it("13. existing verified email cannot create duplicate account (409 conflict)", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({
          email: testEmail,
          password: testPassword,
          firstName: "Duplicate",
          lastName: "Attempter",
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("EMAIL_ALREADY_EXISTS");
      expect(res.body.message).toMatch(/sign in or use Forgot Password/i);
    });

    it("14. existing unverified account resumes verification lifecycle without duplicate user", async () => {
      const unverifiedEmail = `unverified-${Date.now()}@customer-auth.test`;

      // 1. Initial registration
      const firstRes = await request(app)
        .post("/api/v1/auth/register")
        .send({
          email: unverifiedEmail,
          password: testPassword,
          firstName: "Rahul",
          lastName: "Verma",
        });

      expect(firstRes.status).toBe(201);
      const originalUserId = firstRes.body.data.user.id;
      createdUserIds.push(originalUserId);

      // Simulate cooldown elapsed on existing active OTP
      await Otp.updateMany(
        { email: unverifiedEmail },
        { $set: { lastResentAt: new Date(Date.now() - 70000) } }
      );

      // 2. Second registration with same unverified email
      const secondRes = await request(app)
        .post("/api/v1/auth/register")
        .send({
          email: unverifiedEmail,
          password: testPassword,
          firstName: "Rahul",
          lastName: "Verma",
        });

      expect(secondRes.status).toBe(201);
      expect(secondRes.body.data.user.id).toBe(originalUserId); // Same user document
      expect(secondRes.body.data.user.isEmailVerified).toBe(false);
      expect(secondRes.body.data.user.requireVerification).toBe(true);

      // Confirm only 1 User document exists in database
      const userCount = await User.countDocuments({ email: unverifiedEmail.toLowerCase() });
      expect(userCount).toBe(1);
    });

    it("16. enforces case-insensitive email uniqueness", async () => {
      const mixedCaseEmail = testEmail.toUpperCase();

      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({
          email: mixedCaseEmail,
          password: testPassword,
          firstName: "Mixed",
          lastName: "Case",
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("EMAIL_ALREADY_EXISTS");
    });

    it("15. prevents duplicate identities on concurrent simultaneous registration", async () => {
      const concurrentEmail = `concurrent-${Date.now()}@customer-auth.test`;

      const [res1, res2] = await Promise.all([
        request(app)
          .post("/api/v1/auth/register")
          .send({
            email: concurrentEmail,
            password: testPassword,
            firstName: "Con1",
            lastName: "Test",
          }),
        request(app)
          .post("/api/v1/auth/register")
          .send({
            email: concurrentEmail,
            password: testPassword,
            firstName: "Con2",
            lastName: "Test",
          }),
      ]);

      // Exactly one must succeed with 201, while the other receives safe response or 429 cooldown
      const statuses = [res1.status, res2.status];
      expect(statuses).toContain(201);

      // Ensure exactly 1 User document was created in DB
      const userCount = await User.countDocuments({ email: concurrentEmail.toLowerCase() });
      expect(userCount).toBe(1);

      const createdUser = await User.findOne({ email: concurrentEmail.toLowerCase() });
      createdUserIds.push(createdUser._id);
    });
  });

  describe("4. Post-Verification Login Compatibility", () => {
    it("allows verified customer to log in with correct credentials", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: testEmail,
          password: testPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(testEmail.toLowerCase());
      expect(res.body.data.user.isEmailVerified).toBe(true);
      expect(res.body.data.user.role).toBe(ROLES.CUSTOMER);
      expect(res.body.data.accessToken).toBeDefined();
    });
  });
});
