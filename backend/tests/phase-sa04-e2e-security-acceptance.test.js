/**
 * Phase SA-04: End-to-End Security & Acceptance Verification
 *
 * Exhaustive verification suite for Superadmin Customer & Vendor Account Management:
 * 1. Reason Validation Boundary & Type Safety Matrix
 * 2. Granular RBAC/PBAC & Permission Aliasing
 * 3. Customer Lifecycle, Session Invalidation & Historical Data Integrity
 * 4. Vendor Lifecycle, Session Invalidation, Product Moderation & Settlements
 * 5. Audit Log Immutability & Credential Secrecy
 */

const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const app = require("../src/app");

const User = require("../src/models/User");
const Customer = require("../src/models/Customer");
const Vendor = require("../src/models/Vendor");
const Product = require("../src/models/Product");
const Category = require("../src/models/Category");
const Order = require("../src/models/Order");
const Address = require("../src/models/Address");
const Cart = require("../src/models/Cart");
const Employee = require("../src/models/Employee");
const JobRole = require("../src/models/JobRole");
const RefreshToken = require("../src/models/RefreshToken");
const AuditLog = require("../src/models/AuditLog");
const { VendorSettlement } = require("../src/models/VendorSettlement");

const { ROLES } = require("../src/constants/auth.constants");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { hashPassword } = require("../src/utils/password");
const { hashToken } = require("../src/utils/token-hash");
const {
  generateAccessToken,
  generateRefreshToken,
  TOKEN_CONTEXTS,
  TOKEN_AUDIENCES,
} = require("../src/services/token.service");
const { rotateRefreshToken } = require("../src/services/refresh-token.service");

describe("Phase SA-04: End-to-End Security & Acceptance Verification", () => {
  jest.setTimeout(60000);

  let superadminUser;
  let superadminToken;
  let unauthorizedCustomerUser;
  let unauthorizedCustomerToken;
  let testCategory;

  const TEST_URI = process.env.MONGODB_URI
    ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_sa04_test?")
    : "mongodb://127.0.0.1:27017/buybox_sa04_test?replicaSet=rs0";

  /**
   * Helper to create an Employee staff account with a custom scoped JobRole
   */
  const createScopedStaff = async ({ name, slug, permissions }) => {
    const suffix = `${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
    const jobRole = await JobRole.create({
      name: `${name}_${suffix}`,
      slug: `${slug}_${suffix}`,
      tier: 1,
      isActive: true,
      permissions,
    });

    const staffUser = await User.create({
      email: `staff_${suffix}@buybox.test`,
      password: await hashPassword("StaffPass123!"),
      firstName: "Scoped",
      lastName: "Staff",
      role: "admin",
      roles: ["admin"],
      isActive: true,
      isEmailVerified: true,
      authVersion: 1,
    });

    const employee = await Employee.create({
      userId: staffUser._id,
      employeeNumber: `EMP-${suffix}`,
      jobRoleId: jobRole._id,
      status: "active",
    });

    const token = generateAccessToken(
      {
        sub: staffUser._id.toString(),
        role: staffUser.role,
        roles: staffUser.roles,
        authVersion: 1,
        permissionVersion: 1,
      },
      {
        context: TOKEN_CONTEXTS.ADMINISTRATOR,
        audience: TOKEN_AUDIENCES.ADMINISTRATOR,
      }
    );

    return { staffUser, jobRole, employee, token };
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_URI, { autoIndex: true });
    }

    // Single-Superadmin clean state
    await User.deleteMany({ role: ROLES.SUPER_ADMIN });

    const uniqueSuffix = Date.now();

    // 1. Provision Platform Superadmin
    superadminUser = await User.create({
      email: `superadmin-sa04-${uniqueSuffix}@buybox.test`,
      password: await hashPassword("SuperAdminPass123!"),
      firstName: "Platform",
      lastName: "Superadmin",
      role: ROLES.SUPER_ADMIN,
      roles: [ROLES.SUPER_ADMIN],
      isActive: true,
      isEmailVerified: true,
    });

    await Employee.create({
      userId: superadminUser._id,
      employeeNumber: `EMP-SA04-${uniqueSuffix}`,
      jobTitle: "Superadmin",
      department: "Platform Governance",
      status: "active",
    });

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
      email: `unauth-cust-${uniqueSuffix}@buybox.test`,
      password: await hashPassword("CustPass123!"),
      firstName: "Unauthorized",
      lastName: "Customer",
      role: ROLES.CUSTOMER,
      roles: [ROLES.CUSTOMER],
      isActive: true,
      isEmailVerified: true,
    });

    await Customer.create({
      userId: unauthorizedCustomerUser._id,
      isActive: true,
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

    // 3. Shared Category Fixture
    testCategory = await Category.create({
      name: `Category SA04 ${uniqueSuffix}`,
      slug: `cat-sa04-${uniqueSuffix}`,
    });
  });

  afterAll(async () => {
    // Preserve database for post-test inspection
  });

  // =========================================================================
  // SUITE 1: REASON VALIDATION BOUNDARY & TYPE SAFETY MATRIX
  // =========================================================================
  describe("1. Reason Validation Boundary & Zero-Mutation Matrix", () => {
    let targetCustUser;

    beforeEach(async () => {
      const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      targetCustUser = await User.create({
        email: `boundary-cust-${suffix}@buybox.test`,
        password: await hashPassword("Password123!"),
        firstName: "Boundary",
        lastName: "Customer",
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER],
        isActive: true,
        isEmailVerified: true,
        authVersion: 1,
      });

      await Customer.create({
        userId: targetCustUser._id,
        isActive: true,
      });
    });

    it("1.1 Rejects missing reason with 400 Bad Request and causes zero state mutation", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/customers/${targetCustUser._id}/suspend`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);

      const unchanged = await User.findById(targetCustUser._id);
      expect(unchanged.isActive).toBe(true);
      expect(unchanged.authVersion).toBe(1);
    });

    it("1.2 Rejects empty string reason with 400 Bad Request and causes zero state mutation", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/customers/${targetCustUser._id}/suspend`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "" });

      expect(res.status).toBe(400);

      const unchanged = await User.findById(targetCustUser._id);
      expect(unchanged.isActive).toBe(true);
    });

    it("1.3 Rejects whitespace-only reason with 400 Bad Request and causes zero state mutation", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/customers/${targetCustUser._id}/suspend`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "             " });

      expect(res.status).toBe(400);

      const unchanged = await User.findById(targetCustUser._id);
      expect(unchanged.isActive).toBe(true);
    });

    it("1.4 Rejects reason with fewer than 10 characters (length 9) with 400 Bad Request", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/customers/${targetCustUser._id}/suspend`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "123456789" });

      expect(res.status).toBe(400);

      const unchanged = await User.findById(targetCustUser._id);
      expect(unchanged.isActive).toBe(true);
    });

    it("1.5 Rejects non-string reason (number or object) with 400 Bad Request", async () => {
      const resNum = await request(app)
        .post(`/api/v1/admin/customers/${targetCustUser._id}/suspend`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: 9876543210 });

      expect(resNum.status).toBe(400);

      const resObj = await request(app)
        .post(`/api/v1/admin/customers/${targetCustUser._id}/suspend`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: { text: "Disciplinary action for fraud" } });

      expect(resObj.status).toBe(400);
    });

    it("1.6 Rejects reason exceeding 500 characters (length 501) with 400 Bad Request", async () => {
      const overReason = "A".repeat(501);
      const res = await request(app)
        .post(`/api/v1/admin/customers/${targetCustUser._id}/suspend`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: overReason });

      expect(res.status).toBe(400);

      const unchanged = await User.findById(targetCustUser._id);
      expect(unchanged.isActive).toBe(true);
    });

    it("1.7 Accepts reason with exactly 10 characters and applies mutation with AuditLog", async () => {
      const exact10 = "1234567890";
      const res = await request(app)
        .post(`/api/v1/admin/customers/${targetCustUser._id}/suspend`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: exact10 });

      expect(res.status).toBe(200);

      const updated = await User.findById(targetCustUser._id);
      expect(updated.isActive).toBe(false);

      const log = await AuditLog.findOne({
        targetId: targetCustUser._id,
        action: "customer.suspended",
      }).sort({ createdAt: -1 });

      expect(log).not.toBeNull();
      expect(log.reason).toBe(exact10);
    });

    it("1.8 Accepts reason with exactly 500 characters and applies mutation with AuditLog", async () => {
      // First reactivate
      await request(app)
        .post(`/api/v1/admin/customers/${targetCustUser._id}/reactivate`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Reactivating account before test 1.8" });

      const exact500 = "B".repeat(500);
      const res = await request(app)
        .post(`/api/v1/admin/customers/${targetCustUser._id}/suspend`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: exact500 });

      expect(res.status).toBe(200);

      const updated = await User.findById(targetCustUser._id);
      expect(updated.isActive).toBe(false);

      const log = await AuditLog.findOne({
        targetId: targetCustUser._id,
        action: "customer.suspended",
      }).sort({ createdAt: -1 });

      expect(log).not.toBeNull();
      expect(log.reason).toBe(exact500);
    });
  });

  // =========================================================================
  // SUITE 2: AUTHORITATIVE GRANULAR RBAC/PBAC & PERMISSION ALIASING
  // =========================================================================
  describe("2. Authoritative Granular RBAC/PBAC & Permission Aliasing", () => {
    let targetCustomer;
    let targetVendorUser;
    let targetVendorDoc;

    beforeEach(async () => {
      const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

      targetCustomer = await User.create({
        email: `rbac-target-cust-${suffix}@buybox.test`,
        password: await hashPassword("TargetCust123!"),
        firstName: "Target",
        lastName: "Customer",
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER],
        isActive: true,
        isEmailVerified: true,
        authVersion: 1,
      });
      await Customer.create({ userId: targetCustomer._id, isActive: true });

      targetVendorUser = await User.create({
        email: `rbac-target-vnd-${suffix}@buybox.test`,
        password: await hashPassword("TargetVnd123!"),
        firstName: "Target",
        lastName: "Vendor",
        role: ROLES.VENDOR,
        roles: [ROLES.VENDOR],
        isActive: true,
        isEmailVerified: true,
        authVersion: 1,
      });

      targetVendorDoc = await Vendor.create({
        userId: targetVendorUser._id,
        businessName: `RBAC Vendor ${suffix}`,
        businessSlug: `rbac-vendor-${suffix}`,
        onboardingStatus: "approved",
        isActive: true,
      });
    });

    it("2.1 Unauthenticated calls to customer or vendor admin endpoints return 401", async () => {
      const resCust = await request(app).get(`/api/v1/admin/customers/${targetCustomer._id}`);
      expect(resCust.status).toBe(401);

      const resVnd = await request(app).get(`/api/v1/admin/vendors/${targetVendorDoc._id}`);
      expect(resVnd.status).toBe(401);
    });

    it("2.2 Customer role attempting to call administrative endpoints returns 403", async () => {
      const resCust = await request(app)
        .post(`/api/v1/admin/customers/${targetCustomer._id}/suspend`)
        .set("Authorization", `Bearer ${unauthorizedCustomerToken}`)
        .send({ reason: "Customer attempting administrative suspension" });

      expect(resCust.status).toBe(403);

      const resVnd = await request(app)
        .post(`/api/v1/admin/vendors/${targetVendorDoc._id}/suspend`)
        .set("Authorization", `Bearer ${unauthorizedCustomerToken}`)
        .send({ reason: "Customer attempting vendor suspension" });

      expect(resVnd.status).toBe(403);
    });

    it("2.3 Staff with customers.view only can inspect but cannot mutate (suspend, reset, edit, delete return 403)", async () => {
      const { token: viewOnlyToken } = await createScopedStaff({
        name: "Customer Viewer",
        slug: "cust-viewer",
        permissions: [PERMISSIONS.CUSTOMERS_VIEW],
      });

      // View allowed
      const viewRes = await request(app)
        .get(`/api/v1/admin/customers/${targetCustomer._id}`)
        .set("Authorization", `Bearer ${viewOnlyToken}`);
      expect(viewRes.status).toBe(200);

      // Suspend blocked
      const suspRes = await request(app)
        .post(`/api/v1/admin/customers/${targetCustomer._id}/suspend`)
        .set("Authorization", `Bearer ${viewOnlyToken}`)
        .send({ reason: "Viewer attempting to suspend customer" });
      expect(suspRes.status).toBe(403);

      // Reset password blocked
      const resetRes = await request(app)
        .post(`/api/v1/admin/customers/${targetCustomer._id}/reset-password`)
        .set("Authorization", `Bearer ${viewOnlyToken}`)
        .send({ newPassword: "NewSecretPass123!", reason: "Viewer attempting password reset" });
      expect(resetRes.status).toBe(403);

      // Edit blocked
      const editRes = await request(app)
        .patch(`/api/v1/admin/customers/${targetCustomer._id}`)
        .set("Authorization", `Bearer ${viewOnlyToken}`)
        .send({ firstName: "HackedName", reason: "Viewer attempting profile edit" });
      expect(editRes.status).toBe(403);

      // Delete blocked
      const delRes = await request(app)
        .delete(`/api/v1/admin/customers/${targetCustomer._id}`)
        .set("Authorization", `Bearer ${viewOnlyToken}`)
        .send({ reason: "Viewer attempting soft deactivation" });
      expect(delRes.status).toBe(403);
    });

    it("2.4 Staff with customers.suspend only can suspend/reactivate but cannot reset password or delete", async () => {
      const { token: suspOnlyToken } = await createScopedStaff({
        name: "Customer Moderator",
        slug: "cust-moderator",
        permissions: [PERMISSIONS.CUSTOMERS_SUSPEND],
      });

      // Suspend allowed
      const suspRes = await request(app)
        .post(`/api/v1/admin/customers/${targetCustomer._id}/suspend`)
        .set("Authorization", `Bearer ${suspOnlyToken}`)
        .send({ reason: "Authorized suspension by moderator" });
      expect(suspRes.status).toBe(200);

      // Reactivate allowed
      const reactRes = await request(app)
        .post(`/api/v1/admin/customers/${targetCustomer._id}/reactivate`)
        .set("Authorization", `Bearer ${suspOnlyToken}`)
        .send({ reason: "Authorized reactivation by moderator" });
      expect(reactRes.status).toBe(200);

      // Reset password blocked
      const resetRes = await request(app)
        .post(`/api/v1/admin/customers/${targetCustomer._id}/reset-password`)
        .set("Authorization", `Bearer ${suspOnlyToken}`)
        .send({ newPassword: "NewSecretPass123!", reason: "Moderator attempting password reset" });
      expect(resetRes.status).toBe(403);

      // Delete blocked
      const delRes = await request(app)
        .delete(`/api/v1/admin/customers/${targetCustomer._id}`)
        .set("Authorization", `Bearer ${suspOnlyToken}`)
        .send({ reason: "Moderator attempting deactivation" });
      expect(delRes.status).toBe(403);
    });

    it("2.5 Staff with macro permission users:manage can execute all customer actions", async () => {
      const { token: userManagerToken } = await createScopedStaff({
        name: "User Operations Manager",
        slug: "user-ops-mgr",
        permissions: ["users:manage", PERMISSIONS.CUSTOMERS_VIEW],
      });

      // Edit allowed
      const editRes = await request(app)
        .patch(`/api/v1/admin/customers/${targetCustomer._id}`)
        .set("Authorization", `Bearer ${userManagerToken}`)
        .send({ firstName: "ManagerEdited", reason: "Manager verified profile update" });
      expect(editRes.status).toBe(200);

      // Suspend allowed
      const suspRes = await request(app)
        .post(`/api/v1/admin/customers/${targetCustomer._id}/suspend`)
        .set("Authorization", `Bearer ${userManagerToken}`)
        .send({ reason: "Manager suspended customer for SLA review" });
      expect(suspRes.status).toBe(200);

      // Reactivate allowed
      const reactRes = await request(app)
        .post(`/api/v1/admin/customers/${targetCustomer._id}/reactivate`)
        .set("Authorization", `Bearer ${userManagerToken}`)
        .send({ reason: "Manager restored customer access" });
      expect(reactRes.status).toBe(200);

      // Reset password allowed
      const resetRes = await request(app)
        .post(`/api/v1/admin/customers/${targetCustomer._id}/reset-password`)
        .set("Authorization", `Bearer ${userManagerToken}`)
        .send({ newPassword: "ManagerResetPass123!", reason: "Manager performed password recovery" });
      expect(resetRes.status).toBe(200);

      // Delete allowed
      const delRes = await request(app)
        .delete(`/api/v1/admin/customers/${targetCustomer._id}`)
        .set("Authorization", `Bearer ${userManagerToken}`)
        .send({ reason: "Manager processed account deletion" });
      expect(delRes.status).toBe(200);
    });

    it("2.6 Staff with vendors.suspend only can suspend/reactivate but cannot reset password or delete vendor", async () => {
      const { token: vndSuspToken } = await createScopedStaff({
        name: "Vendor Compliance Specialist",
        slug: "vnd-compliance",
        permissions: [PERMISSIONS.VENDORS_SUSPEND, PERMISSIONS.VENDORS_READ],
      });

      // Suspend allowed
      const suspRes = await request(app)
        .post(`/api/v1/admin/vendors/${targetVendorDoc._id}/suspend`)
        .set("Authorization", `Bearer ${vndSuspToken}`)
        .send({ reason: "Compliance officer suspended store" });
      expect(suspRes.status).toBe(200);

      // Reactivate allowed
      const reactRes = await request(app)
        .post(`/api/v1/admin/vendors/${targetVendorDoc._id}/reactivate`)
        .set("Authorization", `Bearer ${vndSuspToken}`)
        .send({ reason: "Compliance documents re-verified" });
      expect(reactRes.status).toBe(200);

      // Reset password blocked
      const resetRes = await request(app)
        .post(`/api/v1/admin/vendors/${targetVendorDoc._id}/reset-password`)
        .set("Authorization", `Bearer ${vndSuspToken}`)
        .send({ newPassword: "CompliancePass123!", reason: "Compliance attempting reset" });
      expect(resetRes.status).toBe(403);

      // Delete blocked
      const delRes = await request(app)
        .delete(`/api/v1/admin/vendors/${targetVendorDoc._id}`)
        .set("Authorization", `Bearer ${vndSuspToken}`)
        .send({ reason: "Compliance attempting delete" });
      expect(delRes.status).toBe(403);
    });

    it("2.7 Staff with macro permission vendors:manage can execute all vendor actions", async () => {
      const { token: vndManagerToken } = await createScopedStaff({
        name: "Vendor Operations Director",
        slug: "vnd-ops-dir",
        permissions: ["vendors:manage", PERMISSIONS.VENDORS_READ],
      });

      // Edit allowed
      const editRes = await request(app)
        .patch(`/api/v1/admin/vendors/${targetVendorDoc._id}`)
        .set("Authorization", `Bearer ${vndManagerToken}`)
        .send({ businessName: "Director Updated Store", reason: "Operations director approved rebranding" });
      expect(editRes.status).toBe(200);

      // Suspend allowed
      const suspRes = await request(app)
        .post(`/api/v1/admin/vendors/${targetVendorDoc._id}/suspend`)
        .set("Authorization", `Bearer ${vndManagerToken}`)
        .send({ reason: "Director temporary store shutdown" });
      expect(suspRes.status).toBe(200);

      // Reactivate allowed
      const reactRes = await request(app)
        .post(`/api/v1/admin/vendors/${targetVendorDoc._id}/reactivate`)
        .set("Authorization", `Bearer ${vndManagerToken}`)
        .send({ reason: "Director authorized reopening" });
      expect(reactRes.status).toBe(200);

      // Reset password allowed
      const resetRes = await request(app)
        .post(`/api/v1/admin/vendors/${targetVendorDoc._id}/reset-password`)
        .set("Authorization", `Bearer ${vndManagerToken}`)
        .send({ newPassword: "DirectorVendorPass123!", reason: "Director authorized credential rotation" });
      expect(resetRes.status).toBe(200);

      // Delete allowed
      const delRes = await request(app)
        .delete(`/api/v1/admin/vendors/${targetVendorDoc._id}`)
        .set("Authorization", `Bearer ${vndManagerToken}`)
        .send({ reason: "Director authorized merchant deactivation" });
      expect(delRes.status).toBe(200);
    });

    it("2.8 Self-protection prevents administrators from suspending or deactivating their own account", async () => {
      // Superadmin attempting self-suspension
      const selfSusp = await request(app)
        .post(`/api/v1/admin/customers/${superadminUser._id}/suspend`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Superadmin mistakenly suspending self" });

      expect(selfSusp.status).toBe(400);
      expect(selfSusp.body.code).toBe("CANNOT_SUSPEND_SELF");

      // Superadmin attempting self-deletion
      const selfDel = await request(app)
        .delete(`/api/v1/admin/customers/${superadminUser._id}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Superadmin mistakenly deleting self" });

      expect(selfDel.status).toBe(400);
      expect(selfDel.body.code).toBe("CANNOT_DELETE_SELF");
    });
  });

  // =========================================================================
  // SUITE 3: CUSTOMER LIFECYCLE, SESSION REVOCATION & DATA INTEGRITY
  // =========================================================================
  describe("3. Customer Lifecycle, Session Invalidation & Data Integrity", () => {
    let customerUser;
    let customerProfile;
    let customerAccessToken;
    let customerRefreshToken;

    beforeEach(async () => {
      const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

      customerUser = await User.create({
        email: `cust-life-${suffix}@buybox.test`,
        password: await hashPassword("CustomerSecret123!"),
        firstName: "Alice",
        lastName: "E2E",
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER],
        isActive: true,
        isEmailVerified: true,
        authVersion: 1,
      });

      customerProfile = await Customer.create({
        userId: customerUser._id,
        phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
        isActive: true,
      });

      customerAccessToken = generateAccessToken(
        {
          sub: customerUser._id.toString(),
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

      const rawRefresh = generateRefreshToken(
        { sub: customerUser._id.toString() },
        { context: TOKEN_CONTEXTS.CUSTOMER }
      );
      customerRefreshToken = rawRefresh;

      await RefreshToken.create({
        userId: customerUser._id,
        tokenHash: hashToken(rawRefresh),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
    });

    it("3.1 Suspension synchronizes User, increments authVersion, revokes tokens, and prevents subsequent access", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/customers/${customerUser._id}/suspend`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Suspending customer due to confirmed chargeback dispute" });

      expect(res.status).toBe(200);

      const updatedUser = await User.findById(customerUser._id);
      expect(updatedUser.isActive).toBe(false);
      expect(updatedUser.authVersion).toBe(2);

      const updatedCust = await Customer.findOne({ userId: customerUser._id });
      expect(updatedCust.isActive).toBe(false);

      // Access with previously issued token is rejected with 401
      const cartAccess = await request(app)
        .get("/api/v1/cart")
        .set("Authorization", `Bearer ${customerAccessToken}`);
      expect(cartAccess.status).toBe(401);

      // Refresh token rotation is rejected
      await expect(
        rotateRefreshToken({
          refreshToken: customerRefreshToken,
          expectedContext: "customer",
        })
      ).rejects.toThrow();

      // Audit log accurately captures the event
      const log = await AuditLog.findOne({
        targetId: customerUser._id,
        action: "customer.suspended",
      });
      expect(log).not.toBeNull();
      expect(log.actorId.toString()).toBe(superadminUser._id.toString());
      expect(log.reason).toContain("confirmed chargeback dispute");
    });

    it("3.2 Reactivation restores account state, bumps authVersion, and keeps old sessions revoked", async () => {
      // Suspend first
      await request(app)
        .post(`/api/v1/admin/customers/${customerUser._id}/suspend`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Suspension for compliance check" });

      const reactRes = await request(app)
        .post(`/api/v1/admin/customers/${customerUser._id}/reactivate`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Compliance documentation verified satisfactorily" });

      expect(reactRes.status).toBe(200);

      const updatedUser = await User.findById(customerUser._id);
      expect(updatedUser.isActive).toBe(true);
      expect(updatedUser.authVersion).toBe(3);

      // Old token remains invalid because authVersion was bumped
      const cartAccess = await request(app)
        .get("/api/v1/cart")
        .set("Authorization", `Bearer ${customerAccessToken}`);
      expect(cartAccess.status).toBe(401);
    });

    it("3.3 Profile edit enforces strict allowlist, mandates reason, and rejects injection of protected fields", async () => {
      const uniquePhone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;

      // Valid allowlist edit
      const validEdit = await request(app)
        .patch(`/api/v1/admin/customers/${customerUser._id}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          firstName: "Alicia",
          lastName: "Wonder",
          phone: uniquePhone,
          reason: "Customer verified legal name change request",
        });

      expect(validEdit.status).toBe(200);
      expect(validEdit.body.data.firstName).toBe("Alicia");
      expect(validEdit.body.data.lastName).toBe("Wonder");

      // Injection of system fields (role, password, email) is rejected with 400
      const hackAttempt = await request(app)
        .patch(`/api/v1/admin/customers/${customerUser._id}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          role: "super_admin",
          reason: "Attempted privilege escalation injection",
        });

      expect(hackAttempt.status).toBe(400);

      const unchangedUser = await User.findById(customerUser._id);
      expect(unchangedUser.role).toBe(ROLES.CUSTOMER);
    });

    it("3.4 Password reset applies bcrypt hash (>=12 rounds), invalidates prior sessions, and leaks zero secrets", async () => {
      const newSecret = "ComplexPassword2026!#";

      const resetRes = await request(app)
        .post(`/api/v1/admin/customers/${customerUser._id}/reset-password`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          newPassword: newSecret,
          reason: "Customer reported compromised credentials via helpdesk",
        });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);

      // Verify zero credentials in response envelope
      expect(resetRes.body.password).toBeUndefined();
      expect(resetRes.body.passwordHash).toBeUndefined();
      expect(resetRes.body.data.password).toBeUndefined();

      const userAfter = await User.findById(customerUser._id).select("+password");
      expect(userAfter.authVersion).toBe(2);

      // Verify bcrypt hash matches new password
      const isNewMatch = await bcrypt.compare(newSecret, userAfter.password);
      expect(isNewMatch).toBe(true);

      // Old password must fail
      const isOldMatch = await bcrypt.compare("CustomerSecret123!", userAfter.password);
      expect(isOldMatch).toBe(false);

      // Verify no password in audit log
      const auditLog = await AuditLog.findOne({
        targetId: customerUser._id,
        action: "customer.password_reset",
      });
      expect(auditLog).not.toBeNull();
      expect(JSON.stringify(auditLog)).not.toContain(newSecret);
    });

    it("3.5 Customer soft-deactivation sets deletedAt, clears active cart, and preserves historical orders and addresses", async () => {
      // 1. Create active shopping cart
      await Cart.create({
        customerId: customerUser._id,
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            productVariantId: new mongoose.Types.ObjectId(),
            quantity: 1,
            unitPrice: 100,
            priceSnapshot: 100,
            currency: "INR",
          },
        ],
      });

      // 2. Create historical completed order
      const ordSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      const historicalOrder = await Order.create({
        orderNumber: `ORD-E2E-${ordSuffix}`,
        customerId: customerUser._id,
        currency: "INR",
        status: "delivered",
        paymentStatus: "paid",
        fulfillmentStatus: "fulfilled",
        subtotal: 750,
        discountTotal: 0,
        taxTotal: 0,
        shippingTotal: 0,
        grandTotal: 750,
        shippingAddress: {
          fullName: "Alice E2E",
          phone: "+919876543210",
          addressLine1: "789 Park Avenue",
          city: "Bengaluru",
          state: "Karnataka",
          postalCode: "560001",
          country: "IN",
        },
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            productVariantId: new mongoose.Types.ObjectId(),
            vendorId: new mongoose.Types.ObjectId(),
            productName: "Historical E2E Item",
            sku: `SKU-E2E-${ordSuffix}`,
            quantity: 1,
            unitPrice: 750,
            discountTotal: 0,
            taxTotal: 0,
            lineTotal: 750,
            currency: "INR",
          },
        ],
      });

      // 3. Create saved delivery address
      const savedAddress = await Address.create({
        userId: customerUser._id,
        firstName: "Alice",
        lastName: "E2E",
        phone: "+919876543210",
        addressLine1: "789 Park Avenue",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "IN",
      });

      // 4. Execute soft-deactivation
      const delRes = await request(app)
        .delete(`/api/v1/admin/customers/${customerUser._id}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Customer requested permanent account erasure under privacy policy" });

      expect(delRes.status).toBe(200);

      // Verify User & Customer soft-deleted
      const userAfter = await User.findById(customerUser._id);
      expect(userAfter.isActive).toBe(false);
      expect(userAfter.deletedAt).not.toBeNull();
      expect(userAfter.authVersion).toBe(2);

      const custAfter = await Customer.findOne({ userId: customerUser._id });
      expect(custAfter.isActive).toBe(false);
      expect(custAfter.deletedAt).not.toBeNull();

      // Verify cart was purged
      const activeCart = await Cart.findOne({ customerId: customerUser._id });
      expect(activeCart).toBeNull();

      // Verify historical order and address remain intact
      const preservedOrder = await Order.findById(historicalOrder._id);
      expect(preservedOrder).not.toBeNull();
      expect(preservedOrder.customerId.toString()).toBe(customerUser._id.toString());

      const preservedAddress = await Address.findById(savedAddress._id);
      expect(preservedAddress).not.toBeNull();

      // Repeated deactivation returns 400
      const repeatDel = await request(app)
        .delete(`/api/v1/admin/customers/${customerUser._id}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Repeated customer deactivation attempt" });

      expect(repeatDel.status).toBe(400);
      expect(repeatDel.body.code).toBe("ACCOUNT_ALREADY_DEACTIVATED");
    });
  });

  // =========================================================================
  // SUITE 4: VENDOR LIFECYCLE, PRODUCT MODERATION & SETTLEMENTS
  // =========================================================================
  describe("4. Vendor Lifecycle, Product Moderation & Settlements", () => {
    let vendorUser;
    let vendorDoc;
    let vendorAccessToken;
    let vendorRefreshToken;

    beforeEach(async () => {
      const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

      vendorUser = await User.create({
        email: `vnd-life-${suffix}@buybox.test`,
        password: await hashPassword("VendorSecret2026!"),
        firstName: "Vikram",
        lastName: "Patel",
        role: ROLES.VENDOR,
        roles: [ROLES.VENDOR],
        isActive: true,
        isEmailVerified: true,
        authVersion: 1,
      });

      vendorDoc = await Vendor.create({
        userId: vendorUser._id,
        businessName: `Vikram Enterprises ${suffix}`,
        businessSlug: `vikram-enterprises-${suffix}`,
        onboardingStatus: "approved",
        isActive: true,
      });

      vendorAccessToken = generateAccessToken(
        {
          sub: vendorUser._id.toString(),
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

      const rawRefresh = generateRefreshToken(
        { sub: vendorUser._id.toString() },
        { context: TOKEN_CONTEXTS.VENDOR }
      );
      vendorRefreshToken = rawRefresh;

      await RefreshToken.create({
        userId: vendorUser._id,
        tokenHash: hashToken(rawRefresh),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
    });

    it("4.1 Suspension invalidates sessions, unpublishes all vendor products, and preserves seller ledger", async () => {
      const pSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

      // Create active product
      const product = await Product.create({
        name: "Active Seller Product",
        slug: `active-seller-product-${pSuffix}`,
        sku: `SKU-ACT-${pSuffix}`,
        vendorId: vendorDoc._id,
        categoryId: testCategory._id,
        price: 499,
        status: "active",
        isStoreVisible: true,
      });

      // Create historical settlement
      const settlement = await VendorSettlement.create({
        vendorId: vendorDoc._id,
        settlementNumber: `SETTLE-${pSuffix}`,
        periodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        periodEnd: new Date(),
        currency: "INR",
        grossSales: 5000,
        platformSubsidy: 0,
        discounts: 0,
        refunds: 0,
        platformCommission: 500,
        netPayable: 4500,
        status: "payable",
      });

      const res = await request(app)
        .post(`/api/v1/admin/vendors/${vendorDoc._id}/suspend`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Suspended vendor due to high counterfeit dispute rate" });

      expect(res.status).toBe(200);

      // Verify Vendor and User state
      const updatedVendor = await Vendor.findById(vendorDoc._id);
      expect(updatedVendor.onboardingStatus).toBe("suspended");
      expect(updatedVendor.isActive).toBe(false);

      const updatedUser = await User.findById(vendorUser._id);
      expect(updatedUser.isActive).toBe(false);
      expect(updatedUser.authVersion).toBe(2);

      // Product must be hidden from storefront
      const updatedProd = await Product.findById(product._id);
      expect(updatedProd.isStoreVisible).toBe(false);

      // Previous vendor access token must fail
      const profileAccess = await request(app)
        .get("/api/v1/vendors/me/profile")
        .set("Authorization", `Bearer ${vendorAccessToken}`);
      expect(profileAccess.status).toBe(401);

      // Settlement must remain preserved
      const preservedSettle = await VendorSettlement.findById(settlement._id);
      expect(preservedSettle).not.toBeNull();
      expect(preservedSettle.vendorId.toString()).toBe(vendorDoc._id.toString());
    });

    it("4.2 Reactivation restores store visibility ONLY for active products; draft products stay hidden", async () => {
      // Suspend first
      await request(app)
        .post(`/api/v1/admin/vendors/${vendorDoc._id}/suspend`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Temporary suspension for audit" });

      const pSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

      // Active product (was hidden during suspension)
      const activeProd = await Product.create({
        name: "Approved Active Product",
        slug: `appr-active-prod-${pSuffix}`,
        sku: `SKU-APP-${pSuffix}`,
        vendorId: vendorDoc._id,
        categoryId: testCategory._id,
        price: 299,
        status: "active",
        isStoreVisible: false,
      });

      // Draft product (unmoderated)
      const draftProd = await Product.create({
        name: "Unapproved Draft Product",
        slug: `unappr-draft-prod-${pSuffix}`,
        sku: `SKU-DFT-${pSuffix}`,
        vendorId: vendorDoc._id,
        categoryId: testCategory._id,
        price: 399,
        status: "draft",
        isStoreVisible: false,
      });

      // Reactivate
      const reactRes = await request(app)
        .post(`/api/v1/admin/vendors/${vendorDoc._id}/reactivate`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Audit cleared and compliance standards verified" });

      expect(reactRes.status).toBe(200);

      // Active product must be restored to visible
      const checkedActive = await Product.findById(activeProd._id);
      expect(checkedActive.isStoreVisible).toBe(true);

      // Draft product must remain hidden
      const checkedDraft = await Product.findById(draftProd._id);
      expect(checkedDraft.isStoreVisible).toBe(false);
    });

    it("4.3 Reactivation transition guards: rejected or pending vendors cannot bypass onboarding", async () => {
      const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

      const rejectedVendor = await Vendor.create({
        userId: new mongoose.Types.ObjectId(),
        businessName: `Rejected Onboarding ${suffix}`,
        businessSlug: `rejected-onboard-${suffix}`,
        onboardingStatus: "rejected",
        isActive: false,
      });

      const res = await request(app)
        .post(`/api/v1/admin/vendors/${rejectedVendor._id}/reactivate`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Attempting to reactivate un-onboarded merchant" });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_TRANSITION");
    });

    it("4.4 Vendor password reset hashes securely, bumps authVersion, and invalidates merchant console sessions", async () => {
      const newVendorSecret = "VendorNewPassSecure2026!#";

      const resetRes = await request(app)
        .post(`/api/v1/admin/vendors/${vendorDoc._id}/reset-password`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          newPassword: newVendorSecret,
          reason: "Vendor account password reset requested by verified business owner",
        });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);

      const userAfter = await User.findById(vendorUser._id).select("+password");
      expect(userAfter.authVersion).toBe(2);

      const isMatch = await bcrypt.compare(newVendorSecret, userAfter.password);
      expect(isMatch).toBe(true);

      // Audit log must not contain password
      const audit = await AuditLog.findOne({
        targetId: vendorDoc._id,
        action: "vendor.password_reset",
      });
      expect(audit).not.toBeNull();
      expect(JSON.stringify(audit)).not.toContain(newVendorSecret);
    });

    it("4.5 Vendor soft-deactivation sets deletedAt, hides products, and preserves seller orders", async () => {
      const pSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

      const product = await Product.create({
        name: "Deactivated Vendor Item",
        slug: `deact-vendor-item-${pSuffix}`,
        sku: `SKU-DVI-${pSuffix}`,
        vendorId: vendorDoc._id,
        categoryId: testCategory._id,
        price: 199,
        status: "active",
        isStoreVisible: true,
      });

      const order = await Order.create({
        orderNumber: `ORD-DEACT-${pSuffix}`,
        customerId: new mongoose.Types.ObjectId(),
        currency: "INR",
        status: "processing",
        paymentStatus: "paid",
        fulfillmentStatus: "unfulfilled",
        subtotal: 199,
        discountTotal: 0,
        taxTotal: 0,
        shippingTotal: 0,
        grandTotal: 199,
        shippingAddress: {
          fullName: "Customer Buyer",
          phone: "+919876543210",
          addressLine1: "100 Market St",
          city: "Bengaluru",
          state: "Karnataka",
          postalCode: "560001",
          country: "IN",
        },
        items: [
          {
            productName: "Deactivated Vendor Item",
            vendorId: vendorDoc._id,
            productId: product._id,
            productVariantId: new mongoose.Types.ObjectId(),
            sku: `SKU-DVI-ITEM-${pSuffix}`,
            quantity: 1,
            unitPrice: 199,
            discountTotal: 0,
            taxTotal: 0,
            lineTotal: 199,
            currency: "INR",
          },
        ],
      });

      const delRes = await request(app)
        .delete(`/api/v1/admin/vendors/${vendorDoc._id}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Merchant voluntarily closed business and terminated contract" });

      expect(delRes.status).toBe(200);

      // Verify soft-deactivation
      const vendorAfter = await Vendor.findById(vendorDoc._id);
      expect(vendorAfter.deletedAt).not.toBeNull();
      expect(vendorAfter.isActive).toBe(false);
      expect(vendorAfter.onboardingStatus).toBe("inactive");

      const userAfter = await User.findById(vendorUser._id);
      expect(userAfter.deletedAt).not.toBeNull();
      expect(userAfter.isActive).toBe(false);
      expect(userAfter.authVersion).toBe(2);

      // Product hidden
      const productAfter = await Product.findById(product._id);
      expect(productAfter.isStoreVisible).toBe(false);

      // Order preserved
      const orderAfter = await Order.findById(order._id);
      expect(orderAfter).not.toBeNull();
      expect(orderAfter.items[0].vendorId.toString()).toBe(vendorDoc._id.toString());

      // Repeated deactivation returns 400
      const repeatDel = await request(app)
        .delete(`/api/v1/admin/vendors/${vendorDoc._id}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Repeated vendor deactivation attempt" });

      expect(repeatDel.status).toBe(400);
      expect(repeatDel.body.code).toBe("VENDOR_ALREADY_DEACTIVATED");
    });
  });

  // =========================================================================
  // SUITE 5: AUDIT LOG IMMUTABILITY & CREDENTIAL SECRECY
  // =========================================================================
  describe("5. Audit Log Immutability & Credential Secrecy", () => {
    it("5.1 Audit log records across all mutations never contain plaintext passwords or password hashes", async () => {
      const logs = await AuditLog.find({
        action: { $in: ["customer.password_reset", "vendor.password_reset"] },
      }).lean();

      expect(logs.length).toBeGreaterThan(0);

      for (const log of logs) {
        const serialized = JSON.stringify(log);
        expect(serialized).not.toContain("ComplexPassword2026!#");
        expect(serialized).not.toContain("VendorNewPassSecure2026!#");
        expect(log.afterState?.password).toBeUndefined();
        expect(log.beforeState?.password).toBeUndefined();
        expect(log.reason).toBeDefined();
        expect(log.actorId).toBeDefined();
        expect(log.targetId).toBeDefined();
      }
    });

    it("5.2 Audit log entries contain complete forensic metadata (actorId, targetId, action, reason, timestamps)", async () => {
      const allActionLogs = await AuditLog.find({
        action: {
          $in: [
            "customer.suspended",
            "customer.reactivated",
            "customer.password_reset",
            "customer.deleted",
            "vendor.suspended",
            "vendor.reactivated",
            "vendor.password_reset",
            "vendor.deleted",
          ],
        },
      }).lean();

      expect(allActionLogs.length).toBeGreaterThan(5);

      for (const log of allActionLogs) {
        expect(log.actorId).toBeDefined();
        expect(log.targetId).toBeDefined();
        expect(log.action).toBeDefined();
        expect(log.reason).toBeDefined();
        expect(log.reason.length).toBeGreaterThanOrEqual(10);
        expect(log.createdAt).toBeDefined();
      }
    });
  });
});
