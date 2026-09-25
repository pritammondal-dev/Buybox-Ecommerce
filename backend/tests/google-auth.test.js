const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Customer = require("../src/models/Customer");
const AuditLog = require("../src/models/AuditLog");
const RefreshToken = require("../src/models/RefreshToken");
const { hashPassword } = require("../src/utils/password");
const { ROLES, AUDIT_ACTIONS } = require("../src/constants/auth.constants");
const googleAuthService = require("../src/services/google-auth.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_google_auth_test?")
  : "mongodb://127.0.0.1:27017/buybox_google_auth_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Google OAuth / OIDC Authentication Suite", () => {
  let createdUserIds = [];

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
      await Customer.deleteMany({ userId: { $in: createdUserIds } });
      await RefreshToken.deleteMany({ userId: { $in: createdUserIds } });
    }
    await User.deleteMany({ email: { $regex: /@google-auth-test\.com$/i } });
    await mongoose.connection.close();
  });

  /* ========================================================================
     PART A: GOOGLE AUTH SERVICE (TOKEN VERIFICATION LOGIC)
     ======================================================================== */
  describe("GoogleAuthService.verifyIdToken Unit Tests", () => {
    it("rejects when ID token is missing or not a string", async () => {
      await expect(googleAuthService.verifyIdToken(null)).rejects.toMatchObject({
        statusCode: 400,
        code: "GOOGLE_TOKEN_REQUIRED",
      });

      await expect(googleAuthService.verifyIdToken("")).rejects.toMatchObject({
        statusCode: 400,
        code: "GOOGLE_TOKEN_REQUIRED",
      });
    });

    it("rejects token when verification library fails or returns empty payload", async () => {
      const spy = jest.spyOn(googleAuthService.client, "verifyIdToken").mockResolvedValueOnce({
        getPayload: () => null,
      });

      try {
        await expect(googleAuthService.verifyIdToken("mock.token.payload")).rejects.toMatchObject({
          statusCode: 401,
          code: "INVALID_GOOGLE_TOKEN",
        });
      } finally {
        spy.mockRestore();
      }
    });

    it("rejects token with untrusted issuer", async () => {
      const spy = jest.spyOn(googleAuthService.client, "verifyIdToken").mockResolvedValueOnce({
        getPayload: () => ({
          iss: "https://evil-issuer.com",
          sub: "sub-123",
          email: "user@example.com",
          email_verified: true,
          aud: googleAuthService.getClientId(),
        }),
      });

      try {
        await expect(googleAuthService.verifyIdToken("mock.token.issuer")).rejects.toMatchObject({
          statusCode: 401,
          code: "INVALID_GOOGLE_ISSUER",
        });
      } finally {
        spy.mockRestore();
      }
    });

    it("rejects expired token", async () => {
      const pastSeconds = Math.floor(Date.now() / 1000) - 300;
      const spy = jest.spyOn(googleAuthService.client, "verifyIdToken").mockResolvedValueOnce({
        getPayload: () => ({
          iss: "https://accounts.google.com",
          exp: pastSeconds,
          sub: "sub-expired",
          email: "user@example.com",
          email_verified: true,
          aud: googleAuthService.getClientId(),
        }),
      });

      try {
        await expect(googleAuthService.verifyIdToken("mock.token.expired")).rejects.toMatchObject({
          statusCode: 401,
          code: "GOOGLE_TOKEN_EXPIRED",
        });
      } finally {
        spy.mockRestore();
      }
    });

    it("rejects token when audience mismatches configured client ID", async () => {
      const configuredClientId = googleAuthService.getClientId();
      if (!configuredClientId) return; // Skip if no client ID configured

      const spy = jest.spyOn(googleAuthService.client, "verifyIdToken").mockResolvedValueOnce({
        getPayload: () => ({
          iss: "https://accounts.google.com",
          exp: Math.floor(Date.now() / 1000) + 3600,
          sub: "sub-aud",
          email: "user@example.com",
          email_verified: true,
          aud: "wrong-client-id.apps.googleusercontent.com",
        }),
      });

      try {
        await expect(googleAuthService.verifyIdToken("mock.token.aud")).rejects.toMatchObject({
          statusCode: 401,
          code: "INVALID_GOOGLE_AUDIENCE",
        });
      } finally {
        spy.mockRestore();
      }
    });

    it("rejects token missing subject (sub)", async () => {
      const spy = jest.spyOn(googleAuthService.client, "verifyIdToken").mockResolvedValueOnce({
        getPayload: () => ({
          iss: "https://accounts.google.com",
          exp: Math.floor(Date.now() / 1000) + 3600,
          email: "user@example.com",
          email_verified: true,
          aud: googleAuthService.getClientId(),
        }),
      });

      try {
        await expect(googleAuthService.verifyIdToken("mock.token.nosub")).rejects.toMatchObject({
          statusCode: 401,
          code: "INVALID_GOOGLE_SUBJECT",
        });
      } finally {
        spy.mockRestore();
      }
    });

    it("rejects token missing email address", async () => {
      const spy = jest.spyOn(googleAuthService.client, "verifyIdToken").mockResolvedValueOnce({
        getPayload: () => ({
          iss: "https://accounts.google.com",
          exp: Math.floor(Date.now() / 1000) + 3600,
          sub: "sub-noemail",
          email_verified: true,
          aud: googleAuthService.getClientId(),
        }),
      });

      try {
        await expect(googleAuthService.verifyIdToken("mock.token.noemail")).rejects.toMatchObject({
          statusCode: 400,
          code: "GOOGLE_EMAIL_MISSING",
        });
      } finally {
        spy.mockRestore();
      }
    });

    it("rejects token when Google email is not verified", async () => {
      const spy = jest.spyOn(googleAuthService.client, "verifyIdToken").mockResolvedValueOnce({
        getPayload: () => ({
          iss: "https://accounts.google.com",
          exp: Math.floor(Date.now() / 1000) + 3600,
          sub: "sub-unverified",
          email: "unverified@gmail.com",
          email_verified: false,
          aud: googleAuthService.getClientId(),
        }),
      });

      try {
        await expect(googleAuthService.verifyIdToken("mock.token.unverified")).rejects.toMatchObject({
          statusCode: 403,
          code: "GOOGLE_EMAIL_NOT_VERIFIED",
        });
      } finally {
        spy.mockRestore();
      }
    });

    it("successfully verifies valid token and returns normalized payload", async () => {
      const clientId = googleAuthService.getClientId();
      const spy = jest.spyOn(googleAuthService.client, "verifyIdToken").mockResolvedValueOnce({
        getPayload: () => ({
          iss: "https://accounts.google.com",
          exp: Math.floor(Date.now() / 1000) + 3600,
          sub: "google-valid-sub-99",
          email: "Valid.User@Gmail.COM",
          email_verified: true,
          given_name: "Valid",
          family_name: "Tester",
          picture: "https://lh3.googleusercontent.com/photo.jpg",
          aud: clientId || undefined,
        }),
      });

      try {
        const result = await googleAuthService.verifyIdToken("valid.jwt.mock");
        expect(result.sub).toBe("google-valid-sub-99");
        expect(result.email).toBe("valid.user@gmail.com"); // Lowercased
        expect(result.emailVerified).toBe(true);
        expect(result.firstName).toBe("Valid");
        expect(result.lastName).toBe("Tester");
        expect(result.picture).toBe("https://lh3.googleusercontent.com/photo.jpg");
      } finally {
        spy.mockRestore();
      }
    });
  });

  /* ========================================================================
     PART B: GOOGLE ENDPOINT INTEGRATION TESTS (POST /api/v1/auth/google)
     ======================================================================== */
  describe("POST /api/v1/auth/google End-to-End Integration", () => {
    it("1. creates a new customer account when user does not exist", async () => {
      const googleSub = `sub-new-${Date.now()}`;
      const email = `newcustomer-${Date.now()}@google-auth-test.com`;

      const spy = jest.spyOn(googleAuthService, "verifyIdToken").mockResolvedValueOnce({
        sub: googleSub,
        email,
        emailVerified: true,
        firstName: "NewGoogle",
        lastName: "Customer",
        picture: "https://photo.example.com/pic.jpg",
      });

      try {
        const res = await request(app)
          .post("/api/v1/auth/google")
          .send({ idToken: "valid.google.jwt.newcustomer" });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.user.email).toBe(email);
        expect(res.body.data.user.role).toBe(ROLES.CUSTOMER);
        expect(res.body.data.user.isEmailVerified).toBe(true);
        expect(res.body.data.accessToken).toBeDefined();

        createdUserIds.push(res.body.data.user.id);

        // Check user in database
        const dbUser = await User.findById(res.body.data.user.id);
        expect(dbUser).toBeTruthy();
        expect(dbUser.authProviders.google.id).toBe(googleSub);
        expect(dbUser.authProviders.google.email).toBe(email);
        expect(dbUser.password).toBeUndefined(); // No fake password!

        // Check customer profile created
        const profile = await Customer.findOne({ userId: dbUser._id });
        expect(profile).toBeTruthy();

        // Check cookies set
        const cookies = res.headers["set-cookie"];
        expect(cookies.some((c) => c.includes("bb_customer_session="))).toBe(true);

        // Check audit log recorded
        const audit = await AuditLog.findOne({
          action: AUDIT_ACTIONS.GOOGLE_LOGIN_SUCCESS,
          actorId: dbUser._id,
        });
        expect(audit).toBeTruthy();
        expect(audit.afterState.sub).toBe(googleSub);
      } finally {
        spy.mockRestore();
      }
    });

    it("2. authenticates existing customer with matching Google Provider ID", async () => {
      const googleSub = `sub-existing-${Date.now()}`;
      const email = `existing-google-${Date.now()}@google-auth-test.com`;

      const existingUser = await User.create({
        email,
        firstName: "Existing",
        lastName: "GoogleUser",
        role: ROLES.CUSTOMER,
        isEmailVerified: true,
        authProviders: {
          google: {
            id: googleSub,
            email,
            linkedAt: new Date(),
          },
        },
      });
      createdUserIds.push(existingUser._id);
      await Customer.create({ userId: existingUser._id });

      const spy = jest.spyOn(googleAuthService, "verifyIdToken").mockResolvedValueOnce({
        sub: googleSub,
        email,
        emailVerified: true,
        firstName: "Existing",
        lastName: "GoogleUser",
      });

      try {
        const res = await request(app)
          .post("/api/v1/auth/google")
          .send({ idToken: "valid.google.jwt.existing" });

        expect(res.status).toBe(200);
        expect(res.body.data.user.id).toBe(existingUser._id.toString());
        expect(res.body.data.user.email).toBe(email);
        expect(res.body.data.accessToken).toBeDefined();
      } finally {
        spy.mockRestore();
      }
    });

    it("3. safely links Google identity to existing verified email account", async () => {
      const email = `verified-email-${Date.now()}@google-auth-test.com`;
      const googleSub = `sub-link-${Date.now()}`;

      const existingEmailUser = await User.create({
        email,
        password: await hashPassword("Password123!"),
        firstName: "Regular",
        lastName: "EmailUser",
        role: ROLES.CUSTOMER,
        isEmailVerified: true,
      });
      createdUserIds.push(existingEmailUser._id);
      await Customer.create({ userId: existingEmailUser._id });

      const spy = jest.spyOn(googleAuthService, "verifyIdToken").mockResolvedValueOnce({
        sub: googleSub,
        email,
        emailVerified: true,
        firstName: "Regular",
        lastName: "EmailUser",
      });

      try {
        const res = await request(app)
          .post("/api/v1/auth/google")
          .send({ idToken: "valid.google.jwt.link" });

        expect(res.status).toBe(200);
        expect(res.body.data.user.id).toBe(existingEmailUser._id.toString());

        // Verify linked in DB
        const updatedUser = await User.findById(existingEmailUser._id);
        expect(updatedUser.authProviders.google.id).toBe(googleSub);
      } finally {
        spy.mockRestore();
      }
    });

    it("4. rejects auto-linking to an UNVERIFIED existing email account (Account Takeover Defense)", async () => {
      const email = `unverified-victim-${Date.now()}@google-auth-test.com`;
      const googleSub = `sub-attacker-${Date.now()}`;

      const unverifiedUser = await User.create({
        email,
        password: await hashPassword("Password123!"),
        firstName: "Unverified",
        lastName: "Target",
        role: ROLES.CUSTOMER,
        isEmailVerified: false, // NOT VERIFIED
      });
      createdUserIds.push(unverifiedUser._id);

      const spy = jest.spyOn(googleAuthService, "verifyIdToken").mockResolvedValueOnce({
        sub: googleSub,
        email,
        emailVerified: true,
        firstName: "Attacker",
        lastName: "Takeover",
      });

      try {
        const res = await request(app)
          .post("/api/v1/auth/google")
          .send({ idToken: "valid.google.jwt.takeover" });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe("ACCOUNT_LINKING_VERIFICATION_REQUIRED");

        // Verify audit log for failed login recorded
        const failedAudit = await AuditLog.findOne({
          action: AUDIT_ACTIONS.GOOGLE_LOGIN_FAILED,
          actorId: unverifiedUser._id,
        });
        expect(failedAudit).toBeTruthy();
      } finally {
        spy.mockRestore();
      }
    });

    it("5. rejects inactive customer account", async () => {
      const email = `inactive-${Date.now()}@google-auth-test.com`;
      const googleSub = `sub-inactive-${Date.now()}`;

      const inactiveUser = await User.create({
        email,
        firstName: "Banned",
        lastName: "Customer",
        role: ROLES.CUSTOMER,
        isActive: false, // Inactive
        isEmailVerified: true,
        authProviders: {
          google: {
            id: googleSub,
            email,
            linkedAt: new Date(),
          },
        },
      });
      createdUserIds.push(inactiveUser._id);

      const spy = jest.spyOn(googleAuthService, "verifyIdToken").mockResolvedValueOnce({
        sub: googleSub,
        email,
        emailVerified: true,
        firstName: "Banned",
        lastName: "Customer",
      });

      try {
        const res = await request(app)
          .post("/api/v1/auth/google")
          .send({ idToken: "valid.google.jwt.inactive" });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe("ACCOUNT_INACTIVE");
      } finally {
        spy.mockRestore();
      }
    });

    it("6. strictly protects staff accounts from authenticating through customer portal", async () => {
      const email = `staff-admin-${Date.now()}@google-auth-test.com`;
      const googleSub = `sub-admin-${Date.now()}`;

      const adminUser = await User.create({
        email,
        password: await hashPassword("AdminSecret123!"),
        firstName: "Admin",
        lastName: "Operator",
        role: ROLES.ADMIN, // Staff role
        isEmailVerified: true,
        authProviders: {
          google: {
            id: googleSub,
            email,
            linkedAt: new Date(),
          },
        },
      });
      createdUserIds.push(adminUser._id);

      const spy = jest.spyOn(googleAuthService, "verifyIdToken").mockResolvedValueOnce({
        sub: googleSub,
        email,
        emailVerified: true,
        firstName: "Admin",
        lastName: "Operator",
      });

      try {
        const res = await request(app)
          .post("/api/v1/auth/google")
          .send({ idToken: "valid.google.jwt.admin" });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe("STAFF_PORTAL_REQUIRED");
      } finally {
        spy.mockRestore();
      }
    });

    it("7. records audit log without exposing ID token or secrets", async () => {
      const email = `audit-check-${Date.now()}@google-auth-test.com`;
      const googleSub = `sub-audit-${Date.now()}`;
      const fakeToken = "super-secret-google-id-token.signature-secret";

      const spy = jest.spyOn(googleAuthService, "verifyIdToken").mockResolvedValueOnce({
        sub: googleSub,
        email,
        emailVerified: true,
        firstName: "Audit",
        lastName: "Check",
      });

      try {
        const res = await request(app)
          .post("/api/v1/auth/google")
          .send({ idToken: fakeToken });

        expect(res.status).toBe(200);
        createdUserIds.push(res.body.data.user.id);

        const logs = await AuditLog.find({
          actorId: res.body.data.user.id,
        }).lean();

        expect(logs.length).toBeGreaterThan(0);
        const logContent = JSON.stringify(logs);
        expect(logContent).not.toContain(fakeToken);
        expect(logContent).not.toContain("super-secret");
      } finally {
        spy.mockRestore();
      }
    });
  });
});
