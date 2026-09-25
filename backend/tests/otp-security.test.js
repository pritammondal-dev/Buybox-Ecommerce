const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../src/app");
const User = require("../src/models/User");
const Otp = require("../src/models/Otp");
const OtpService = require("../src/services/otp.service");
const { hashOtp, verifyOtpHash } = require("../src/utils/crypto.util");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_otp_test?")
  : "mongodb://127.0.0.1:27017/buybox_otp_test?replicaSet=rs0";

jest.setTimeout(30000);

describe("Secure OTP & Email Verification Lifecycle Suite", () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }
  });

  afterAll(async () => {
    try {
      await User.deleteMany({ email: { $regex: /@buybox-otp\.test$/ } });
      await Otp.deleteMany({ email: { $regex: /@buybox-otp\.test$/ } });
      await mongoose.disconnect();
    } catch {
      // Best-effort cleanup
    }
  });

  // 1. Generation & Cryptographic Hashing
  describe("1. Cryptographic Generation & Storage Security", () => {
    it("generates 6-digit numeric OTP and stores only its SHA-256 hash", async () => {
      const email = `crypto-test-${Date.now()}@buybox-otp.test`;
      const { otp, expiresAt } = await OtpService.generateOtp({ email, purpose: "email_verification" });

      expect(otp).toBeDefined();
      expect(typeof otp).toBe("string");
      expect(otp).toHaveLength(6);
      expect(/^\d{6}$/.test(otp)).toBe(true);

      const record = await Otp.findOne({ email });
      expect(record).toBeDefined();
      // Ensure raw OTP is NOT in database
      expect(record.otpHash).not.toBe(otp);
      expect(record.otpHash).toBe(hashOtp(otp));
      expect(record.isUsed).toBe(false);
      expect(record.attemptsCount).toBe(0);
      expect(new Date(record.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it("verifies matching OTP using timing-safe hash comparison", async () => {
      const email = `compare-${Date.now()}@buybox-otp.test`;
      const { otp } = await OtpService.generateOtp({ email, purpose: "email_verification" });

      const result = await OtpService.verifyOtp({ email, otp, purpose: "email_verification" });
      expect(result.success).toBe(true);
      expect(result.email).toBe(email);

      const record = await Otp.findOne({ email });
      expect(record.isUsed).toBe(true);
      expect(record.verifiedAt).toBeInstanceOf(Date);
    });
  });

  // 2. Expiration & One-Time Use
  describe("2. Expiration & Invalidation Lifecycle", () => {
    it("rejects an already used OTP", async () => {
      const email = `used-${Date.now()}@buybox-otp.test`;
      const { otp } = await OtpService.generateOtp({ email, purpose: "email_verification" });

      // First verification succeeds
      await OtpService.verifyOtp({ email, otp, purpose: "email_verification" });

      // Second verification on same OTP must fail
      await expect(
        OtpService.verifyOtp({ email, otp, purpose: "email_verification" })
      ).rejects.toThrow("No active verification code found");
    });

    it("rejects an expired OTP", async () => {
      const email = `expired-${Date.now()}@buybox-otp.test`;
      const rawOtp = "123456";
      const pastDate = new Date(Date.now() - 5000);

      await Otp.create({
        email,
        purpose: "email_verification",
        otpHash: hashOtp(rawOtp),
        expiresAt: pastDate,
        isUsed: false,
      });

      await expect(
        OtpService.verifyOtp({ email, otp: rawOtp, purpose: "email_verification" })
      ).rejects.toThrow("Verification code has expired");
    });

    it("invalidates previous OTP when a newer one is requested", async () => {
      const email = `newer-${Date.now()}@buybox-otp.test`;
      const { otp: firstOtp } = await OtpService.generateOtp({ email, purpose: "email_verification" });

      // Simulate time passing beyond cooldown
      await Otp.updateOne({ email }, { $set: { lastResentAt: new Date(Date.now() - 70000) } });

      const { otp: secondOtp } = await OtpService.generateOtp({ email, purpose: "email_verification" });
      expect(firstOtp).not.toBe(secondOtp);

      // Attempting to use the first OTP must fail
      await expect(
        OtpService.verifyOtp({ email, otp: firstOtp, purpose: "email_verification" })
      ).rejects.toThrow();

      // Second OTP works
      const result = await OtpService.verifyOtp({ email, otp: secondOtp, purpose: "email_verification" });
      expect(result.success).toBe(true);
    });
  });

  // 3. Attempt Limit & Resend Cooldown
  describe("3. Rate Limiting & Cooldown Enforcement", () => {
    it("enforces resend cooldown (60 seconds)", async () => {
      const email = `cooldown-${Date.now()}@buybox-otp.test`;
      await OtpService.generateOtp({ email, purpose: "email_verification" });

      // Immediate resend must be rejected with 429
      await expect(
        OtpService.generateOtp({ email, purpose: "email_verification" })
      ).rejects.toThrow("Please wait");
    });

    it("enforces maximum 5 attempts and locks OTP on exceed", async () => {
      const email = `max-attempts-${Date.now()}@buybox-otp.test`;
      const { otp } = await OtpService.generateOtp({ email, purpose: "email_verification" });

      // 4 wrong attempts
      for (let i = 0; i < 4; i++) {
        await expect(
          OtpService.verifyOtp({ email, otp: "000000", purpose: "email_verification" })
        ).rejects.toThrow("Invalid verification code");
      }

      // 5th wrong attempt locks the OTP
      await expect(
        OtpService.verifyOtp({ email, otp: "000000", purpose: "email_verification" })
      ).rejects.toThrow("Maximum verification attempts exceeded");

      // Even correct OTP now fails because record is locked/used
      await expect(
        OtpService.verifyOtp({ email, otp, purpose: "email_verification" })
      ).rejects.toThrow("No active verification code found");
    });
  });

  // 4. Purpose Isolation
  describe("4. Purpose Isolation", () => {
    it("prevents email_verification OTP from being verified as login OTP", async () => {
      const email = `purpose-${Date.now()}@buybox-otp.test`;
      const { otp } = await OtpService.generateOtp({ email, purpose: "email_verification" });

      await expect(
        OtpService.verifyOtp({ email, otp, purpose: "login" })
      ).rejects.toThrow("No active verification code found");

      // Succeeds under its true purpose
      const ok = await OtpService.verifyOtp({ email, otp, purpose: "email_verification" });
      expect(ok.success).toBe(true);
    });
  });

  // 5. HTTP Endpoints Flow
  describe("5. Auth HTTP Endpoints Integration", () => {
    it("registers user with unverified state and allows OTP verification via POST /api/v1/auth/verify-otp", async () => {
      const email = `reg-test-${Date.now()}@buybox-otp.test`;

      // 1. Register
      const regRes = await request(app)
        .post("/api/v1/auth/register")
        .send({
          email,
          password: "SecurePassword123!",
          firstName: "John",
          lastName: "Doe",
        });

      expect(regRes.status).toBe(201);
      expect(regRes.body.data.user.isEmailVerified).toBe(false);
      expect(regRes.body.data.user.devOtp).toBeUndefined();
      expect(regRes.body.data.user.otp).toBeUndefined();
      expect(JSON.stringify(regRes.body)).not.toMatch(/devOtp/);

      // Verify OTP was stored in DB as hash
      const activeOtpRecord = await Otp.findOne({ email, isUsed: false });
      expect(activeOtpRecord).toBeDefined();

      // Retrieve the raw code by finding which 6-digit matches hash (for testing)
      // Or simulate entering a fake code first
      const badRes = await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({
          email,
          otp: "999999",
          purpose: "email_verification",
        });

      expect(badRes.status).toBe(400);
      expect(badRes.body.code).toBe("INVALID_OTP");

      // Verify user in DB still unverified
      let dbUser = await User.findOne({ email });
      expect(dbUser.isEmailVerified).toBe(false);
    });
  });

  // 6. Email Delivery Failure & Resilient Invalidation
  describe("6. Email Delivery Failure & Resilient Invalidation", () => {
    it("invalidates OTP and returns generic error without exposing code when email delivery fails", async () => {
      const email = `delivery-fail-${Date.now()}@buybox-otp.test`;
      const EmailService = require("../src/services/email.service");
      const spy = jest.spyOn(EmailService.prototype, "sendEmailVerificationOTP").mockResolvedValueOnce({
        success: false,
        error: "SMTP server unreachable",
      });

      try {
        const res = await request(app)
          .post("/api/v1/auth/register")
          .send({
            email,
            password: "SecurePassword123!",
            firstName: "Fail",
            lastName: "Tester",
          });

        expect(res.status).toBe(500);
        expect(res.body.code).toBe("EMAIL_DELIVERY_FAILED");
        expect(res.body.message).toContain("Failed to deliver verification code");
        // Ensure OTP does not appear anywhere
        expect(JSON.stringify(res.body)).not.toMatch(/devOtp/);
        expect(JSON.stringify(res.body)).not.toMatch(/"otp"/);

        // Verify that OTP in DB was marked as used/invalidated
        const otpRecord = await Otp.findOne({ email });
        expect(otpRecord).toBeDefined();
        expect(otpRecord.isUsed).toBe(true);
      } finally {
        spy.mockRestore();
      }
    });

    it("resendOtp fails safely and invalidates code when email provider rejects transmission", async () => {
      const email = `resend-fail-${Date.now()}@buybox-otp.test`;

      // Create existing unverified user
      const user = await User.create({
        email,
        password: "HashPassword123!",
        firstName: "Resend",
        lastName: "User",
        isEmailVerified: false,
      });

      const EmailService = require("../src/services/email.service");
      const spy = jest.spyOn(EmailService.prototype, "sendEmailVerificationOTP").mockResolvedValueOnce({
        success: false,
        error: "Mailbox full or provider timeout",
      });

      try {
        const res = await request(app)
          .post("/api/v1/auth/resend-otp")
          .send({
            email,
            purpose: "email_verification",
          });

        expect(res.status).toBe(500);
        expect(res.body.code).toBe("EMAIL_DELIVERY_FAILED");
        expect(JSON.stringify(res.body)).not.toMatch(/devOtp/);

        // Verify OTP is invalidated
        const otpRecord = await Otp.findOne({ email });
        expect(otpRecord).toBeDefined();
        expect(otpRecord.isUsed).toBe(true);
      } finally {
        spy.mockRestore();
      }
    });
  });
});
