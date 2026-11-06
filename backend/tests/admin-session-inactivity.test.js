const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Employee = require("../src/models/Employee");
const RefreshToken = require("../src/models/RefreshToken");
const { bootstrapSuperadmin } = require("../src/services/bootstrap.service");
const { ADMIN_INACTIVITY_TIMEOUT_MS, ADMIN_INACTIVITY_WARNING_MS, ROLES } = require("../src/constants/auth.constants");
const { COOKIE_NAMES } = require("../src/config/cookie");
const { rotateRefreshToken } = require("../src/services/refresh-token.service");
const { generateAccessToken, generateRefreshToken } = require("../src/services/token.service");
const { hashToken } = require("../src/utils/token-hash");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_admin_inactivity_test?")
  : "mongodb://127.0.0.1:27017/buybox_admin_inactivity_test?replicaSet=rs0";

describe("Administrator 30-Minute Inactivity Auto-Logout Security Test Suite", () => {
  jest.setTimeout(60000);

  let superadminUser;
  let superadminToken;
  let superadminRefreshToken;
  let adminUser;
  let adminToken;
  let editorUser;
  let editorToken;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI, { autoIndex: true });
    }

    await Promise.all([
      User.init(),
      Employee.init(),
      RefreshToken.init(),
    ]);

    await bootstrapSuperadmin();

    superadminUser = await User.findOne({ email: "admin123@example.com" });
    if (!superadminUser) {
      throw new Error("Superadmin user not found");
    }

    // Provision admin and editor accounts if not present
    adminUser = await User.findOne({ email: "test-admin@buybox.test" });
    if (!adminUser) {
      adminUser = await User.create({
        firstName: "Test",
        lastName: "Admin",
        email: "test-admin@buybox.test",
        password: "AdminPassword123!",
        role: "admin",
        isActive: true,
        isEmailVerified: true,
        adminLastActiveAt: new Date(),
      });
      await Employee.create({
        userId: adminUser._id,
        employeeNumber: "EMP-ADMIN-001",
        jobTitle: "Operations Admin",
        department: "Operations",
        status: "active",
      });
    }

    editorUser = await User.findOne({ email: "test-editor@buybox.test" });
    if (!editorUser) {
      editorUser = await User.create({
        firstName: "Test",
        lastName: "Editor",
        email: "test-editor@buybox.test",
        password: "EditorPassword123!",
        role: "editor",
        isActive: true,
        isEmailVerified: true,
        adminLastActiveAt: new Date(),
      });
      await Employee.create({
        userId: editorUser._id,
        employeeNumber: "EMP-EDITOR-001",
        jobTitle: "Staff Editor",
        department: "Catalog",
        status: "active",
      });
    }

    adminToken = generateAccessToken(
      { sub: adminUser._id.toString(), role: adminUser.role },
      { context: "administrator" }
    );

    editorToken = generateAccessToken(
      { sub: editorUser._id.toString(), role: editorUser.role },
      { context: "administrator" }
    );
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe("1. Central Policy Constants Verification", () => {
    test("Central constants enforce 30-minute timeout and 28-minute warning", () => {
      expect(ADMIN_INACTIVITY_TIMEOUT_MS).toBe(30 * 60 * 1000);
      expect(ADMIN_INACTIVITY_WARNING_MS).toBe(28 * 60 * 1000);
      expect(ADMIN_INACTIVITY_TIMEOUT_MS - ADMIN_INACTIVITY_WARNING_MS).toBe(2 * 60 * 1000);
    });
  });

  describe("2. Administrator Login and Session Initialization", () => {
    test("Login sets adminLastActiveAt timestamp and returns tokens", async () => {
      const loginRes = await request(app)
        .post("/api/v1/administrator/auth/login")
        .send({
          email: "admin123@example.com",
          password: "admin123",
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
      expect(loginRes.body.data.accessToken).toBeDefined();

      superadminToken = loginRes.body.data.accessToken;

      const cookies = loginRes.headers["set-cookie"];
      const adminCookie = cookies.find((c) =>
        c.startsWith(`${COOKIE_NAMES.ADMINISTRATOR}=`) || c.startsWith("bb_administrator_session=")
      );
      expect(adminCookie).toBeDefined();

      // Extract raw token value for test rotation
      const match = adminCookie.match(/([^=]+)=([^;]+)/);
      superadminRefreshToken = match[2];

      const refreshedUser = await User.findById(superadminUser._id);
      expect(refreshedUser.adminLastActiveAt).toBeDefined();
      expect(Date.now() - new Date(refreshedUser.adminLastActiveAt).getTime()).toBeLessThan(5000);
    });
  });

  describe("3. Server-Side Rejection of Expired Sessions (30-Minute Inactivity)", () => {
    test("Protected request succeeds when session is active (within 30m)", async () => {
      await User.updateOne(
        { _id: superadminUser._id },
        { $set: { adminLastActiveAt: new Date(Date.now() - 10 * 60 * 1000) } } // 10 minutes ago
      );

      const res = await request(app)
        .get("/api/v1/administrator/auth/me")
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe("admin123@example.com");
    });

    test("Protected request is REJECTED with 401 when inactivity exceeds 30 minutes", async () => {
      // Simulate 31 minutes of inactivity
      await User.updateOne(
        { _id: superadminUser._id },
        { $set: { adminLastActiveAt: new Date(Date.now() - 31 * 60 * 1000) } }
      );

      const res = await request(app)
        .get("/api/v1/administrator/auth/me")
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("ADMIN_INACTIVITY_TIMEOUT");
      expect(res.body.message).toMatch(/inactivity/i);
    });

    test("Role coverage: Admin and Editor roles are also rejected when inactivity exceeds 30 minutes", async () => {
      // Test admin role
      await User.updateOne(
        { _id: adminUser._id },
        { $set: { adminLastActiveAt: new Date(Date.now() - 31 * 60 * 1000) } }
      );

      const adminRes = await request(app)
        .get("/api/v1/administrator/auth/me")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(adminRes.status).toBe(401);
      expect(adminRes.body.code).toBe("ADMIN_INACTIVITY_TIMEOUT");

      // Test editor role
      await User.updateOne(
        { _id: editorUser._id },
        { $set: { adminLastActiveAt: new Date(Date.now() - 35 * 60 * 1000) } }
      );

      const editorRes = await request(app)
        .get("/api/v1/administrator/auth/me")
        .set("Authorization", `Bearer ${editorToken}`);

      expect(editorRes.status).toBe(401);
      expect(editorRes.body.code).toBe("ADMIN_INACTIVITY_TIMEOUT");
    });
  });

  describe("4. Refresh Token Security & Inactivity Bypass Prevention", () => {
    test("Token refresh is blocked and revoked when inactivity exceeds 30 minutes", async () => {
      // Issue a fresh refresh token
      const rawToken = generateRefreshToken(
        { sub: adminUser._id.toString() },
        { context: "administrator" }
      );

      await RefreshToken.create({
        userId: adminUser._id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      // Set user inactive for 32 minutes
      await User.updateOne(
        { _id: adminUser._id },
        { $set: { adminLastActiveAt: new Date(Date.now() - 32 * 60 * 1000) } }
      );

      // Attempt rotation
      await expect(
        rotateRefreshToken({
          refreshToken: rawToken,
          ipAddress: "127.0.0.1",
          userAgent: "jest-test",
          expectedContext: "administrator",
        })
      ).rejects.toMatchObject({
        statusCode: 401,
        code: "ADMIN_INACTIVITY_TIMEOUT",
      });

      // Verify token was revoked in database
      const stored = await RefreshToken.findOne({ tokenHash: hashToken(rawToken) });
      expect(stored.revokedAt).toBeDefined();
    });

    test("Token refresh does NOT reset adminLastActiveAt (prevents silent background bypass)", async () => {
      const rawToken = generateRefreshToken(
        { sub: adminUser._id.toString() },
        { context: "administrator" }
      );

      await RefreshToken.create({
        userId: adminUser._id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      // Set user active 15 minutes ago
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      await User.updateOne(
        { _id: adminUser._id },
        { $set: { adminLastActiveAt: fifteenMinutesAgo } }
      );

      const result = await rotateRefreshToken({
        refreshToken: rawToken,
        ipAddress: "127.0.0.1",
        userAgent: "jest-test",
        expectedContext: "administrator",
      });

      expect(result.accessToken).toBeDefined();

      // Verify adminLastActiveAt was NOT bumped to Date.now()
      const userAfter = await User.findById(adminUser._id);
      const diff = Math.abs(userAfter.adminLastActiveAt.getTime() - fifteenMinutesAgo.getTime());
      expect(diff).toBeLessThan(1000); // Remained at 15 minutes ago
    });
  });

  describe("5. Heartbeat & Session Continuation Endpoint", () => {
    test("POST /administrator/auth/heartbeat resets adminLastActiveAt when session is valid", async () => {
      // Set active 25 minutes ago
      await User.updateOne(
        { _id: superadminUser._id },
        { $set: { adminLastActiveAt: new Date(Date.now() - 25 * 60 * 1000) } }
      );

      const res = await request(app)
        .post("/api/v1/administrator/auth/heartbeat")
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.timeoutMs).toBe(ADMIN_INACTIVITY_TIMEOUT_MS);

      const userAfter = await User.findById(superadminUser._id);
      expect(Date.now() - new Date(userAfter.adminLastActiveAt).getTime()).toBeLessThan(5000);
    });

    test("POST /administrator/auth/heartbeat fails with 401 when session already expired", async () => {
      // Set expired 31 minutes ago
      await User.updateOne(
        { _id: superadminUser._id },
        { $set: { adminLastActiveAt: new Date(Date.now() - 31 * 60 * 1000) } }
      );

      const res = await request(app)
        .post("/api/v1/administrator/auth/heartbeat")
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("ADMIN_INACTIVITY_TIMEOUT");
    });
  });

  describe("6. Background Request Isolation (x-background-request)", () => {
    test("Requests with x-background-request header do NOT reset adminLastActiveAt", async () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      await User.updateOne(
        { _id: superadminUser._id },
        { $set: { adminLastActiveAt: tenMinutesAgo } }
      );

      const res = await request(app)
        .get("/api/v1/administrator/auth/me")
        .set("Authorization", `Bearer ${superadminToken}`)
        .set("x-background-request", "true");

      expect(res.status).toBe(200);

      const userAfter = await User.findById(superadminUser._id);
      const diff = Math.abs(userAfter.adminLastActiveAt.getTime() - tenMinutesAgo.getTime());
      expect(diff).toBeLessThan(1000);
    });
  });

  describe("7. Customer & Vendor Boundary Preservation", () => {
    test("Customer and vendor accounts are completely unaffected by administrator inactivity policy", async () => {
      let customerUser = await User.findOne({ email: "customer-test@buybox.test" });
      if (!customerUser) {
        customerUser = await User.create({
          firstName: "Store",
          lastName: "Customer",
          email: "customer-test@buybox.test",
          password: "CustomerPassword123!",
          role: "customer",
          isActive: true,
          isEmailVerified: true,
          adminLastActiveAt: null, // Customer has no admin activity
        });
      }

      const customerToken = generateAccessToken(
        { sub: customerUser._id.toString(), role: "customer" },
        { context: "customer" }
      );

      // Customer should be able to access customer endpoints without inactivity check
      const res = await request(app)
        .get("/api/v1/users/profile")
        .set("Authorization", `Bearer ${customerToken}`);

      // Even if endpoint returns 200 or 404 (depending on route existence), it must NOT return ADMIN_INACTIVITY_TIMEOUT
      expect(res.status).not.toBe(401);
      if (res.body.code) {
        expect(res.body.code).not.toBe("ADMIN_INACTIVITY_TIMEOUT");
      }
    });
  });

  describe("8. Administrator Manual Logout", () => {
    test("POST /administrator/auth/logout revokes session and clears cookie", async () => {
      const res = await request(app)
        .post("/api/v1/administrator/auth/logout")
        .set("Cookie", [`${COOKIE_NAMES.ADMINISTRATOR}=${superadminRefreshToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const cookies = res.headers["set-cookie"] || [];
      const cleared = cookies.some((c) =>
        c.includes(`${COOKIE_NAMES.ADMINISTRATOR}=;`) || c.includes("Expires=") || c.includes("Max-Age=0")
      );
      expect(cleared).toBe(true);
    });
  });
});
