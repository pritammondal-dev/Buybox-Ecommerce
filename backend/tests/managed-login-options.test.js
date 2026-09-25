const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Customer = require("../src/models/Customer");
const Otp = require("../src/models/Otp");
const RefreshToken = require("../src/models/RefreshToken");
const AuthenticationPolicy = require("../src/models/AuthenticationPolicy");
const AuditLog = require("../src/models/AuditLog");
const { hashOtp } = require("../src/utils/crypto.util");
const { hashPassword } = require("../src/utils/password");
const { ROLES, OTP_PURPOSES } = require("../src/constants/auth.constants");
const {
  generateAccessToken,
  TOKEN_CONTEXTS,
  TOKEN_AUDIENCES,
} = require("../src/services/token.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_managed_login_test?")
  : "mongodb://127.0.0.1:27017/buybox_managed_login_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Superadmin Managed User Login Options & Customer Enforcement Suite", () => {
  let superadminUser;
  let superadminToken;
  let customerUser;
  let customerToken;
  let vendorUser;
  let vendorToken;
  let createdUserIds = [];

  const customerPassword = "ValidPassword123!";
  const customerEmail = `managed-cust-${Date.now()}@managed-auth.test`;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI, { autoIndex: true });
    }

    // 1. Create Superadmin User & Token
    superadminUser = await User.create({
      email: `superadmin-${Date.now()}@managed-auth.test`,
      password: await hashPassword("SuperAdminPass123!"),
      firstName: "Super",
      lastName: "Admin",
      role: ROLES.SUPER_ADMIN,
      isEmailVerified: true,
      isActive: true,
    });
    createdUserIds.push(superadminUser._id);

    superadminToken = generateAccessToken(
      {
        sub: superadminUser._id.toString(),
        role: ROLES.SUPER_ADMIN,
        authVersion: 1,
        permissionVersion: 1,
      },
      {
        context: TOKEN_CONTEXTS.ADMINISTRATOR,
        audience: TOKEN_AUDIENCES.ADMINISTRATOR,
      }
    );

    // 2. Create Customer User & Token
    customerUser = await User.create({
      email: customerEmail,
      password: await hashPassword(customerPassword),
      firstName: "Test",
      lastName: "Customer",
      role: ROLES.CUSTOMER,
      isEmailVerified: true,
      isActive: true,
    });
    createdUserIds.push(customerUser._id);
    await Customer.create({ userId: customerUser._id });

    customerToken = generateAccessToken(
      {
        sub: customerUser._id.toString(),
        role: ROLES.CUSTOMER,
        authVersion: 1,
        permissionVersion: 1,
      },
      {
        context: TOKEN_CONTEXTS.CUSTOMER,
        audience: TOKEN_AUDIENCES.CUSTOMER,
      }
    );

    // 3. Create Vendor User & Token
    vendorUser = await User.create({
      email: `vendor-${Date.now()}@managed-auth.test`,
      password: await hashPassword("VendorPass123!"),
      firstName: "Vendor",
      lastName: "User",
      role: ROLES.VENDOR,
      isEmailVerified: true,
      isActive: true,
    });
    createdUserIds.push(vendorUser._id);

    vendorToken = generateAccessToken(
      {
        sub: vendorUser._id.toString(),
        role: ROLES.VENDOR,
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
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
      await Customer.deleteMany({ userId: { $in: createdUserIds } });
      await Otp.deleteMany({ userId: { $in: createdUserIds } });
      await RefreshToken.deleteMany({ userId: { $in: createdUserIds } });
    }
    await User.deleteMany({ email: { $regex: /@managed-auth\.test$/i } });
    await Otp.deleteMany({ email: { $regex: /@managed-auth\.test$/i } });
    await AuthenticationPolicy.deleteMany({});
    await mongoose.connection.close();
  });

  /* ========================================================================
     1. PUBLIC CUSTOMER LOGIN METHODS ENDPOINT
     ======================================================================== */
  describe("1. Public Customer Login Methods Discovery (GET /api/v1/auth/login-methods)", () => {
    it("returns client-safe effective availability flags without authentication", async () => {
      const res = await request(app).get("/api/v1/auth/login-methods");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.emailPassword).toBe("boolean");
      expect(typeof res.body.data.emailOtp).toBe("boolean");
      expect(typeof res.body.data.mobileOtp).toBe("boolean");
      expect(typeof res.body.data.google).toBe("boolean");

      // Zero private secrets or provider stack traces leaked
      expect(res.body.data.systemStatus).toBeUndefined();
      expect(res.body.data.apiKey).toBeUndefined();
      expect(res.body.data.clientSecret).toBeUndefined();
    });
  });

  /* ========================================================================
     2. ADMIN RBAC & AUTHORIZATION BOUNDARIES
     ======================================================================== */
  describe("2. Admin RBAC & Authorization Boundaries", () => {
    it("allows authorized Superadmin to read login methods policy with live readiness", async () => {
      const res = await request(app)
        .get("/api/v1/admin/authentication/login-methods")
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.customerLogin).toBeDefined();

      const { emailPassword, emailOtp, mobileOtp, google } = res.body.data.customerLogin;

      // Each method has policy, systemStatus, and effectiveEnabled
      expect(emailPassword).toHaveProperty("enabled");
      expect(emailPassword).toHaveProperty("systemStatus");
      expect(emailPassword).toHaveProperty("effectiveEnabled");
      expect(emailPassword.systemStatus).toBe("READY");

      expect(mobileOtp).toHaveProperty("systemStatus");
      expect(mobileOtp.systemStatus).toBe("NOT_CONFIGURED");
      expect(mobileOtp.effectiveEnabled).toBe(false);

      expect(google).toHaveProperty("systemStatus");
      expect(emailOtp).toHaveProperty("systemStatus");
    });

    it("rejects unauthenticated request with 401", async () => {
      const res = await request(app).get("/api/v1/admin/authentication/login-methods");
      expect(res.status).toBe(401);
    });

    it("rejects customer token with 403 (TOKEN_CONTEXT boundary)", async () => {
      const res = await request(app)
        .get("/api/v1/admin/authentication/login-methods")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });

    it("rejects vendor token with 403 (TOKEN_CONTEXT boundary)", async () => {
      const res = await request(app)
        .get("/api/v1/admin/authentication/login-methods")
        .set("Authorization", `Bearer ${vendorToken}`);

      expect(res.status).toBe(403);
    });
  });

  /* ========================================================================
     3. POLICY UPDATE VALIDATION & INVARIANT SAFETY
     ======================================================================== */
  describe("3. Policy Update Validation & Invariant Safety", () => {
    it("rejects update if customer attempts to PATCH policy (403)", async () => {
      const res = await request(app)
        .patch("/api/v1/admin/authentication/login-methods")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ emailPassword: true });

      expect(res.status).toBe(403);
    });

    it("rejects update if vendor attempts to PATCH policy (403)", async () => {
      const res = await request(app)
        .patch("/api/v1/admin/authentication/login-methods")
        .set("Authorization", `Bearer ${vendorToken}`)
        .send({ emailPassword: true });

      expect(res.status).toBe(403);
    });

    it("rejects empty update payload (400)", async () => {
      const res = await request(app)
        .patch("/api/v1/admin/authentication/login-methods")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it("rejects submission of server-controlled fields like systemStatus (400)", async () => {
      const res = await request(app)
        .patch("/api/v1/admin/authentication/login-methods")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          emailPassword: true,
          systemStatus: "READY",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/server-calculated|Unknown|Unrecognized/i);
    });

    it("rejects submission of arbitrary unknown fields (400)", async () => {
      const res = await request(app)
        .patch("/api/v1/admin/authentication/login-methods")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          emailPassword: true,
          arbitraryHackField: true,
        });

      expect(res.status).toBe(400);
    });

    it("CRITICAL INVARIANT: Rejects update if it would disable ALL effective customer login methods (400)", async () => {
      // Attempt to turn OFF all methods
      const res = await request(app)
        .patch("/api/v1/admin/authentication/login-methods")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          emailPassword: false,
          emailOtp: false,
          mobileOtp: false,
          google: false,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("NO_USABLE_AUTH_METHOD");
      expect(res.body.message).toBe("At least one usable customer login method must remain enabled.");
    });
  });

  /* ========================================================================
     4. EFFECTIVE AVAILABILITY COMPUTATION & POLICY VS READINESS
     ======================================================================== */
  describe("4. Effective Availability: Policy vs System Readiness", () => {
    it("Superadmin ON + System NOT_CONFIGURED (mobileOtp) results in effectiveEnabled = false", async () => {
      // Attempt to enable Mobile OTP in policy
      const res = await request(app)
        .patch("/api/v1/admin/authentication/login-methods")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          emailPassword: true, // Keep emailPassword on so invariant passes
          mobileOtp: true,
        });

      expect(res.status).toBe(200);
      const mobileStatus = res.body.data.customerLogin.mobileOtp;

      expect(mobileStatus.enabled).toBe(true);
      expect(mobileStatus.systemStatus).toBe("NOT_CONFIGURED");
      // MUST NOT be available to customers because provider is missing
      expect(mobileStatus.effectiveEnabled).toBe(false);
      expect(mobileStatus.reason).toBe("SMS provider is not configured.");
    });

    it("Superadmin OFF + System READY results in effectiveEnabled = false", async () => {
      // Enable Google (assuming configured) or EmailPassword, then turn Google OFF
      const res = await request(app)
        .patch("/api/v1/admin/authentication/login-methods")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          emailPassword: true,
          google: false,
        });

      expect(res.status).toBe(200);
      const googleStatus = res.body.data.customerLogin.google;
      expect(googleStatus.enabled).toBe(false);
      expect(googleStatus.effectiveEnabled).toBe(false);
    });
  });

  /* ========================================================================
     5. CUSTOMER AUTHENTICATION API ENFORCEMENT
     ======================================================================== */
  describe("5. Customer Authentication Endpoint Policy Enforcement", () => {
    it("allows email + password login when emailPassword is effectively enabled", async () => {
      // Ensure emailPassword is ON
      await request(app)
        .patch("/api/v1/admin/authentication/login-methods")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ emailPassword: true });

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: customerEmail, password: customerPassword });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
    });

    it("rejects email + password login with 403 AUTH_METHOD_DISABLED when emailPassword is disabled", async () => {
      // In order to disable emailPassword, at least one other usable method must be effective.
      // If Google is configured, we enable Google, then disable emailPassword.
      const readinessRes = await request(app)
        .get("/api/v1/admin/authentication/login-methods")
        .set("Authorization", `Bearer ${superadminToken}`);

      const googleReady = readinessRes.body.data.customerLogin.google.systemStatus === "READY";

      if (googleReady) {
        // Enable Google first
        await request(app)
          .patch("/api/v1/admin/authentication/login-methods")
          .set("Authorization", `Bearer ${superadminToken}`)
          .send({ google: true });

        // Disable emailPassword
        const patchRes = await request(app)
          .patch("/api/v1/admin/authentication/login-methods")
          .set("Authorization", `Bearer ${superadminToken}`)
          .send({ emailPassword: false, google: true });

        expect(patchRes.status).toBe(200);

        // Attempt customer login via email + password
        const res = await request(app)
          .post("/api/v1/auth/login")
          .send({ email: customerEmail, password: customerPassword });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe("AUTH_METHOD_DISABLED");

        // Restore emailPassword to true
        await request(app)
          .patch("/api/v1/admin/authentication/login-methods")
          .set("Authorization", `Bearer ${superadminToken}`)
          .send({ emailPassword: true });
      } else {
        // If Google is not configured, invariant correctly prevents disabling emailPassword alone
        const patchRes = await request(app)
          .patch("/api/v1/admin/authentication/login-methods")
          .set("Authorization", `Bearer ${superadminToken}`)
          .send({ emailPassword: false });

        expect(patchRes.status).toBe(400);
        expect(patchRes.body.code).toBe("NO_USABLE_AUTH_METHOD");
      }
    });

    it("rejects phone OTP login initiation when mobileOtp is disabled/not-configured (403)", async () => {
      // Ensure mobileOtp policy is OFF
      await request(app)
        .patch("/api/v1/admin/authentication/login-methods")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ mobileOtp: false });

      const res = await request(app)
        .post("/api/v1/auth/login/phone-otp/request")
        .send({ phone: "+919876543210" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("AUTH_METHOD_DISABLED");
    });

    it("rejects Google authentication when Google login is disabled in policy (403)", async () => {
      // Disable Google login
      await request(app)
        .patch("/api/v1/admin/authentication/login-methods")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ google: false, emailPassword: true });

      const res = await request(app)
        .post("/api/v1/auth/google")
        .send({ idToken: "dummy-disabled-google-token" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("AUTH_METHOD_DISABLED");
    });
  });

  /* ========================================================================
     6. STALE FLOW PROTECTION
     ======================================================================== */
  describe("6. Stale OTP Flow Protection", () => {
    it("rejects OTP verification if login method was disabled after OTP was requested", async () => {
      const knownOtp = "789123";
      const testEmail = `stale-flow-${Date.now()}@managed-auth.test`;

      const user = await User.create({
        email: testEmail,
        firstName: "Stale",
        lastName: "Tester",
        role: ROLES.CUSTOMER,
        isEmailVerified: true,
        isActive: true,
      });
      createdUserIds.push(user._id);

      // Create valid OTP in database
      await Otp.create({
        email: testEmail,
        purpose: OTP_PURPOSES.LOGIN_EMAIL_OTP,
        otpHash: hashOtp(knownOtp),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attemptsCount: 0,
        isUsed: false,
      });

      // Explicitly turn OFF Email OTP in policy
      await request(app)
        .patch("/api/v1/admin/authentication/login-methods")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ emailOtp: false, emailPassword: true });

      // Customer now attempts to submit OTP
      const res = await request(app)
        .post("/api/v1/auth/login/email-otp/verify")
        .send({
          email: testEmail,
          otp: knownOtp,
        });

      // Must fail closed with 403 AUTH_METHOD_DISABLED
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("AUTH_METHOD_DISABLED");

      // Verify no refresh token session created in DB
      const createdSession = await RefreshToken.findOne({ userId: user._id });
      expect(createdSession).toBeNull();
    });
  });

  /* ========================================================================
     7. SESSION PRESERVATION
     ======================================================================== */
  describe("7. Session Preservation on Policy Updates", () => {
    it("policy changes do NOT invalidate existing authenticated customer sessions", async () => {
      // 1. Customer signs in using password
      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: customerEmail, password: customerPassword });

      expect(loginRes.status).toBe(200);
      const cookies = loginRes.headers["set-cookie"];
      expect(cookies).toBeDefined();

      // 2. Superadmin updates policy
      const patchRes = await request(app)
        .patch("/api/v1/admin/authentication/login-methods")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          registration: {
            requirePhoneVerification: false,
          },
        });
      expect(patchRes.status).toBe(200);

      // 3. Customer uses their session to refresh token
      const refreshRes = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", cookies);

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.success).toBe(true);
      expect(refreshRes.body.data.accessToken).toBeDefined();
    });
  });

  /* ========================================================================
     8. AUDIT LOGGING OF POLICY EVENTS
     ======================================================================== */
  describe("8. Comprehensive Audit Logging", () => {
    it("records AUTH_POLICY_UPDATED and toggle action in AuditLog", async () => {
      const res = await request(app)
        .patch("/api/v1/admin/authentication/login-methods")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          emailPassword: true,
          google: true,
        });

      expect(res.status).toBe(200);

      const logs = await AuditLog.find({
        entityType: "AuthenticationPolicy",
        actorId: superadminUser._id,
      })
        .sort({ createdAt: -1 })
        .limit(5);

      expect(logs.length).toBeGreaterThan(0);
      const policyLog = logs.find((l) => l.action === "AUTH_POLICY_UPDATED");
      expect(policyLog).toBeDefined();
      expect(policyLog.actorId.toString()).toBe(superadminUser._id.toString());
    });
  });
});
