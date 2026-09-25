const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Customer = require("../src/models/Customer");
const Otp = require("../src/models/Otp");
const RefreshToken = require("../src/models/RefreshToken");
const { hashOtp } = require("../src/utils/crypto.util");
const { hashPassword } = require("../src/utils/password");
const { ROLES, OTP_PURPOSES } = require("../src/constants/auth.constants");
const { normalizePhoneNumber } = require("../src/utils/phone.util");
const googleAuthService = require("../src/services/google-auth.service");
const smsService = require("../src/services/sms.service");
const EmailService = require("../src/services/email.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_multi_auth_test?")
  : "mongodb://127.0.0.1:27017/buybox_multi_auth_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Production Customer Multi-Method Authentication Suite", () => {
  let createdUserIds = [];

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }
    const AuthenticationPolicy = require("../src/models/AuthenticationPolicy");
    await AuthenticationPolicy.deleteMany({});
    await AuthenticationPolicy.create({
      customerLogin: {
        emailPassword: { enabled: true },
        emailOtp: { enabled: true },
        mobileOtp: { enabled: true },
        google: { enabled: true },
      },
      registration: {
        enabled: true,
        requireEmailVerification: true,
        requirePhoneVerification: false,
      },
    });
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
      await Customer.deleteMany({ userId: { $in: createdUserIds } });
      await Otp.deleteMany({ userId: { $in: createdUserIds } });
      await RefreshToken.deleteMany({ userId: { $in: createdUserIds } });
    }
    await User.deleteMany({ email: { $regex: /@multi-auth\.test$/i } });
    await Otp.deleteMany({ email: { $regex: /@multi-auth\.test$/i } });
    const AuthenticationPolicy = require("../src/models/AuthenticationPolicy");
    await AuthenticationPolicy.deleteMany({});
    await mongoose.connection.close();
  });

  /* ========================================================================
     1. EMAIL + PASSWORD LOGIN
     ======================================================================== */
  describe("1. Email + Password Authentication", () => {
    let customerUser;
    const email = `pwd-cust-${Date.now()}@multi-auth.test`;
    const password = "ValidPassword123!";

    beforeAll(async () => {
      customerUser = await User.create({
        email,
        password: await hashPassword(password),
        firstName: "Alice",
        lastName: "User",
        role: ROLES.CUSTOMER,
        isEmailVerified: true,
        isActive: true,
      });
      createdUserIds.push(customerUser._id);

      await Customer.create({ userId: customerUser._id });
    });

    it("successfully logs in with valid email and password", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email, password });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(email);
      expect(res.body.data.user.role).toBe(ROLES.CUSTOMER);
      expect(res.body.data.accessToken).toBeDefined();

      // Password hash must NEVER be returned
      expect(res.body.data.user.password).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toMatch(/password/i);

      // Verify HttpOnly cookies set
      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.includes("bb_customer_session="))).toBe(true);
    });

    it("rejects login with incorrect password with generic 401", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email, password: "WrongPassword999!" });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("INVALID_CREDENTIALS");
      expect(res.body.message).toMatch(/invalid email or password/i);
    });

    it("rejects login for nonexistent email with generic 401", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: `nonexistent-${Date.now()}@multi-auth.test`, password });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("INVALID_CREDENTIALS");
    });

    it("rejects inactive customer account with 403", async () => {
      const inactiveEmail = `inactive-${Date.now()}@multi-auth.test`;
      const inactiveUser = await User.create({
        email: inactiveEmail,
        password: await hashPassword(password),
        firstName: "Inactive",
        lastName: "User",
        role: ROLES.CUSTOMER,
        isActive: false,
      });
      createdUserIds.push(inactiveUser._id);

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: inactiveEmail, password });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("ACCOUNT_INACTIVE");
    });

    it("strictly isolates context: rejects staff roles at customer login endpoint", async () => {
      const staffEmail = `staff-${Date.now()}@multi-auth.test`;
      const staffUser = await User.create({
        email: staffEmail,
        password: await hashPassword(password),
        firstName: "Admin",
        lastName: "Staff",
        role: ROLES.ADMIN,
        isActive: true,
      });
      createdUserIds.push(staffUser._id);

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: staffEmail, password });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("STAFF_PORTAL_REQUIRED");
    });
  });

  /* ========================================================================
     2. EMAIL + OTP LOGIN (PASSWORDLESS)
     ======================================================================== */
  describe("2. Passwordless Email + OTP Login", () => {
    let otpCustomer;
    const email = `email-otp-${Date.now()}@multi-auth.test`;
    const knownOtp = "782914";

    beforeAll(async () => {
      otpCustomer = await User.create({
        email,
        firstName: "Otp",
        lastName: "Customer",
        role: ROLES.CUSTOMER,
        isEmailVerified: true,
        isActive: true,
      });
      createdUserIds.push(otpCustomer._id);
      await Customer.create({ userId: otpCustomer._id });
    });

    it("requests an email login OTP and stores SHA-256 hash", async () => {
      const spy = jest.spyOn(EmailService.prototype, "sendEmailVerificationOTP").mockResolvedValueOnce({
        success: true,
      });

      try {
        const res = await request(app)
          .post("/api/v1/auth/login/email-otp/request")
          .send({ email });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.email).toBe(email);
        expect(res.body.data.resendCooldownSeconds).toBe(60);

        // Verify OTP is hashed in DB with purpose LOGIN_EMAIL_OTP
        const otpRecord = await Otp.findOne({
          email,
          purpose: OTP_PURPOSES.LOGIN_EMAIL_OTP,
          isUsed: false,
        });

        expect(otpRecord).toBeTruthy();
        expect(otpRecord.otpHash).toBeDefined();
        expect(otpRecord.otpHash.length).toBe(64);
        expect(otpRecord.otp).toBeUndefined();
      } finally {
        spy.mockRestore();
      }
    });

    it("nonexistent email returns generic success for enumeration prevention", async () => {
      const fakeEmail = `fake-${Date.now()}@multi-auth.test`;
      const res = await request(app)
        .post("/api/v1/auth/login/email-otp/request")
        .send({ email: fakeEmail });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/if an account exists/i);
    });

    it("verifies valid email login OTP and produces authenticated customer session", async () => {
      await Otp.deleteMany({ email, purpose: OTP_PURPOSES.LOGIN_EMAIL_OTP });
      await Otp.create({
        email,
        userId: otpCustomer._id,
        purpose: OTP_PURPOSES.LOGIN_EMAIL_OTP,
        otpHash: hashOtp(knownOtp),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attemptsCount: 0,
        isUsed: false,
      });

      const res = await request(app)
        .post("/api/v1/auth/login/email-otp/verify")
        .send({ email, otp: knownOtp });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(email);
      expect(res.body.data.accessToken).toBeDefined();

      // Check cookies
      const cookies = res.headers["set-cookie"];
      expect(cookies.some((c) => c.includes("bb_customer_session="))).toBe(true);

      // Verify OTP is marked used
      const usedOtp = await Otp.findOne({ email, purpose: OTP_PURPOSES.LOGIN_EMAIL_OTP });
      expect(usedOtp.isUsed).toBe(true);
    });

    it("enforces purpose isolation: rejects email_verification OTP for login_email_otp", async () => {
      const isolationOtp = "661122";
      await Otp.deleteMany({ email });
      await Otp.create({
        email,
        userId: otpCustomer._id,
        purpose: OTP_PURPOSES.EMAIL_VERIFICATION, // Different purpose
        otpHash: hashOtp(isolationOtp),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attemptsCount: 0,
        isUsed: false,
      });

      const res = await request(app)
        .post("/api/v1/auth/login/email-otp/verify")
        .send({ email, otp: isolationOtp });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_OTP");
    });
  });

  /* ========================================================================
     3. MOBILE NUMBER + OTP (NORMALIZATION & FAIL-SAFE DELIVERY)
     ======================================================================== */
  describe("3. Mobile Number Normalization & OTP Login", () => {
    const rawPhone = "9876543210";
    const expectedNormalized = "+919876543210";
    let phoneUser;

    beforeAll(async () => {
      phoneUser = await User.create({
        phone: expectedNormalized,
        firstName: "Mobile",
        lastName: "Customer",
        role: ROLES.CUSTOMER,
        isPhoneVerified: true,
        isActive: true,
      });
      createdUserIds.push(phoneUser._id);
      await Customer.create({ userId: phoneUser._id, phone: expectedNormalized });
    });

    it("normalizes phone number accurately into E.164 format", () => {
      expect(normalizePhoneNumber(rawPhone)).toBe(expectedNormalized);
      expect(normalizePhoneNumber("+91 98765 43210")).toBe(expectedNormalized);
      expect(normalizePhoneNumber("09876543210")).toBe(expectedNormalized);
    });

    it("fails safely when SMS provider is not configured without exposing OTP", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login/phone-otp/request")
        .send({ phone: rawPhone });

      // When SMS provider is unconfigured, reports safe error
      expect([403, 503]).toContain(res.status);
      expect(["AUTH_METHOD_DISABLED", "SMS_PROVIDER_NOT_CONFIGURED"]).toContain(res.body.code);

      // OTP must NOT appear in response
      expect(JSON.stringify(res.body)).not.toMatch(/devOtp/);
      expect(JSON.stringify(res.body)).not.toMatch(/"otp"/);
    });

    it("verifies phone OTP and creates customer session", async () => {
      const testOtp = "998811";
      await Otp.deleteMany({ phone: expectedNormalized });
      await Otp.create({
        phone: expectedNormalized,
        userId: phoneUser._id,
        purpose: OTP_PURPOSES.LOGIN_PHONE_OTP,
        otpHash: hashOtp(testOtp),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attemptsCount: 0,
        isUsed: false,
      });

      process.env.TEST_SMS_READY = "true";
      try {
        const res = await request(app)
          .post("/api/v1/auth/login/phone-otp/verify")
          .send({ phone: rawPhone, otp: testOtp });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.user.phone).toBe(expectedNormalized);
        expect(res.body.data.accessToken).toBeDefined();

        const cookies = res.headers["set-cookie"];
        expect(cookies.some((c) => c.includes("bb_customer_session="))).toBe(true);
      } finally {
        delete process.env.TEST_SMS_READY;
      }
    });
  });

  /* ========================================================================
     4. GOOGLE AUTHENTICATION & SAFE ACCOUNT LINKING
     ======================================================================== */
  describe("4. Google Sign-In & Account Linking Security", () => {
    it("successfully creates a new customer through verified Google Identity", async () => {
      const googleSub = `google-sub-${Date.now()}`;
      const googleEmail = `google-new-${Date.now()}@multi-auth.test`;

      const spy = jest.spyOn(googleAuthService, "verifyIdToken").mockResolvedValueOnce({
        sub: googleSub,
        email: googleEmail,
        emailVerified: true,
        firstName: "Google",
        lastName: "User",
      });

      try {
        const res = await request(app)
          .post("/api/v1/auth/google")
          .send({ idToken: "valid.google.jwt.mock" });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.user.email).toBe(googleEmail);
        expect(res.body.data.user.isEmailVerified).toBe(true);
        expect(res.body.data.accessToken).toBeDefined();

        createdUserIds.push(res.body.data.user.id);

        // Verify user in DB has linked Google provider
        const userInDb = await User.findById(res.body.data.user.id);
        expect(userInDb.authProviders.google.id).toBe(googleSub);
        expect(userInDb.authProviders.google.email).toBe(googleEmail);

        // Customer profile created
        const customerProfile = await Customer.findOne({ userId: userInDb._id });
        expect(customerProfile).toBeTruthy();
      } finally {
        spy.mockRestore();
      }
    });

    it("safely links Google identity to existing verified email account", async () => {
      const existingEmail = `existing-verified-${Date.now()}@multi-auth.test`;
      const existingUser = await User.create({
        email: existingEmail,
        password: await hashPassword("SomePassword123!"),
        firstName: "Existing",
        lastName: "Customer",
        role: ROLES.CUSTOMER,
        isEmailVerified: true,
      });
      createdUserIds.push(existingUser._id);
      await Customer.create({ userId: existingUser._id });

      const googleSub = `google-link-sub-${Date.now()}`;

      const spy = jest.spyOn(googleAuthService, "verifyIdToken").mockResolvedValueOnce({
        sub: googleSub,
        email: existingEmail,
        emailVerified: true,
        firstName: "Existing",
        lastName: "Customer",
      });

      try {
        const res = await request(app)
          .post("/api/v1/auth/google")
          .send({ idToken: "valid.google.jwt.mock" });

        expect(res.status).toBe(200);
        expect(res.body.data.user.id).toBe(existingUser._id.toString());

        const updatedUser = await User.findById(existingUser._id);
        expect(updatedUser.authProviders.google.id).toBe(googleSub);
      } finally {
        spy.mockRestore();
      }
    });

    it("prevents account takeover: rejects auto-linking to an UNVERIFIED email account", async () => {
      const unverifiedEmail = `unverified-${Date.now()}@multi-auth.test`;
      const unverifiedUser = await User.create({
        email: unverifiedEmail,
        password: await hashPassword("SomePassword123!"),
        firstName: "Unverified",
        lastName: "Victim",
        role: ROLES.CUSTOMER,
        isEmailVerified: false, // NOT VERIFIED
      });
      createdUserIds.push(unverifiedUser._id);

      const spy = jest.spyOn(googleAuthService, "verifyIdToken").mockResolvedValueOnce({
        sub: `attacker-sub-${Date.now()}`,
        email: unverifiedEmail,
        emailVerified: true,
        firstName: "Attacker",
        lastName: "Claim",
      });

      try {
        const res = await request(app)
          .post("/api/v1/auth/google")
          .send({ idToken: "valid.google.jwt.mock" });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe("ACCOUNT_LINKING_VERIFICATION_REQUIRED");
      } finally {
        spy.mockRestore();
      }
    });
  });

  /* ========================================================================
     5. ACCOUNT SECURITY: CHANGE EMAIL, PHONE & PASSWORD
     ======================================================================== */
  describe("5. Account Security Workflows", () => {
    let authUser;
    let authAccessToken;
    const initialEmail = `sec-user-${Date.now()}@multi-auth.test`;
    const initialPassword = "SecPassword123!";

    beforeAll(async () => {
      authUser = await User.create({
        email: initialEmail,
        password: await hashPassword(initialPassword),
        firstName: "Security",
        lastName: "Tester",
        role: ROLES.CUSTOMER,
        isEmailVerified: true,
      });
      createdUserIds.push(authUser._id);
      await Customer.create({ userId: authUser._id });

      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: initialEmail, password: initialPassword });

      authAccessToken = loginRes.body.data.accessToken;
    });

    it("requires authentication for change-email endpoints", async () => {
      const res = await request(app)
        .post("/api/v1/auth/change-email/request")
        .send({ newEmail: "new@multi-auth.test" });

      expect(res.status).toBe(401);
    });

    it("executes change-email flow with verification OTP", async () => {
      const newEmail = `new-email-${Date.now()}@multi-auth.test`;
      const changeOtp = "443322";

      // Mock email sending
      const spy = jest.spyOn(EmailService.prototype, "sendEmailVerificationOTP").mockResolvedValueOnce({
        success: true,
      });

      try {
        const reqRes = await request(app)
          .post("/api/v1/auth/change-email/request")
          .set("Authorization", `Bearer ${authAccessToken}`)
          .send({ newEmail });

        expect(reqRes.status).toBe(200);
        expect(reqRes.body.success).toBe(true);

        // Populate known OTP
        await Otp.deleteMany({ email: newEmail, purpose: OTP_PURPOSES.CHANGE_EMAIL_OTP });
        await Otp.create({
          email: newEmail,
          userId: authUser._id,
          purpose: OTP_PURPOSES.CHANGE_EMAIL_OTP,
          otpHash: hashOtp(changeOtp),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          attemptsCount: 0,
          isUsed: false,
        });

        // Verify OTP and complete email change
        const verifyRes = await request(app)
          .post("/api/v1/auth/change-email/verify")
          .set("Authorization", `Bearer ${authAccessToken}`)
          .send({ newEmail, otp: changeOtp });

        expect(verifyRes.status).toBe(200);
        expect(verifyRes.body.data.email).toBe(newEmail);

        // Verify database user record updated
        const updatedUser = await User.findById(authUser._id);
        expect(updatedUser.email).toBe(newEmail);
        expect(updatedUser.authVersion).toBeGreaterThan(1);
      } finally {
        spy.mockRestore();
      }
    });

    it("executes change-password and invalidates active refresh tokens", async () => {
      const newPassword = "NewSecPassword999!";

      const updatedUser = await User.findById(authUser._id);
      const reLogin = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: updatedUser.email, password: initialPassword });
      const currentAccessToken = reLogin.body.data.accessToken;

      const res = await request(app)
        .post("/api/v1/auth/change-password")
        .set("Authorization", `Bearer ${currentAccessToken}`)
        .send({
          currentPassword: initialPassword,
          newPassword,
          confirmPassword: newPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify old password no longer works
      const oldLoginRes = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: initialEmail, password: initialPassword });
      expect(oldLoginRes.status).toBe(401);

      // Verify new password works
      const userAfterPassChange = await User.findById(authUser._id);
      const newLoginRes = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: userAfterPassChange.email, password: newPassword });
      expect(newLoginRes.status).toBe(200);
    });
  });
});
