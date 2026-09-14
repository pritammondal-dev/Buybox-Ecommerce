const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Employee = require("../src/models/Employee");
const Role = require("../src/models/Role");
const Permission = require("../src/models/Permission");
const RolePermission = require("../src/models/RolePermission");
const EmployeeRole = require("../src/models/EmployeeRole");
const EmployeePermissionGrant = require("../src/models/EmployeePermissionGrant");
const EmployeePermissionRestriction = require("../src/models/EmployeePermissionRestriction");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { generateAccessToken } = require("../src/services/token.service");
const {
  incrementAuthVersion,
  incrementPermissionVersion,
} = require("../src/services/authorization.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_batch1_test?")
  : "mongodb://127.0.0.1:27017/buybox_batch1_test?replicaSet=rs0";

describe("Phase 1D — Batch 1 Operational Route Authorization (PBAC)", () => {
  let createdPermissions = new Map();

  // Helper to create test user + employee profile
  async function createTestEmployee(options = {}) {
    const status = options.status || "active";
    const user = await User.create({
      firstName: "Staff",
      lastName: "Tester",
      email: `staff_${Date.now()}_${Math.random().toString(36).substring(7)}@test-batch1.com`,
      password: "Password123!",
      role: options.userRole || "manager",
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const employee = await Employee.create({
      userId: user._id,
      employeeNumber: `EMP_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`,
      jobTitle: "Operations Analyst",
      department: "Operations",
      status,
    });

    const token = generateAccessToken({
      sub: user._id.toString(),
      role: user.role,
      authVersion: user.authVersion,
      permissionVersion: user.permissionVersion,
    });

    return { user, employee, token };
  }

  // Helper to create or get permission
  async function getOrCreatePermission(slug) {
    if (createdPermissions.has(slug)) {
      return createdPermissions.get(slug);
    }
    let perm = await Permission.findOne({ slug });
    if (!perm) {
      perm = await Permission.create({
        slug,
        name: `Test Perm ${slug}`,
        module: slug.split(":")[0],
        description: `Description for ${slug}`,
        isActive: true,
      });
    }
    createdPermissions.set(slug, perm);
    return perm;
  }

  // Helper to assign a dynamic role to an employee
  async function assignRoleWithPermissions(employeeId, roleSlug, permissionSlugs) {
    let role = await Role.findOne({ slug: roleSlug });
    if (!role) {
      role = await Role.create({
        slug: roleSlug,
        name: `Role ${roleSlug}`,
        description: `Test role ${roleSlug}`,
        isActive: true,
      });
    }

    for (const slug of permissionSlugs) {
      const perm = await getOrCreatePermission(slug);
      await RolePermission.findOneAndUpdate(
        { roleId: role._id, permissionId: perm._id },
        { roleId: role._id, permissionId: perm._id },
        { upsert: true, new: true }
      );
    }

    const employeeRole = await EmployeeRole.create({
      employeeId,
      roleId: role._id,
      isActive: true,
      expiresAt: null,
    });

    return { role, employeeRole };
  }

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI, { autoIndex: true });
    }
    await Promise.all([
      User.init(),
      Employee.init(),
      Role.init(),
      Permission.init(),
      RolePermission.init(),
      EmployeeRole.init(),
      EmployeePermissionGrant.init(),
      EmployeePermissionRestriction.init(),
    ]);
  });

  afterAll(async () => {
    await Promise.all([
      User.deleteMany({ email: /@test-batch1\.com$/ }),
      Employee.deleteMany({}),
      Role.deleteMany({ slug: { $regex: /^test_batch1_/ } }),
      RolePermission.deleteMany({}),
      EmployeeRole.deleteMany({}),
      EmployeePermissionGrant.deleteMany({}),
      EmployeePermissionRestriction.deleteMany({}),
    ]);
    await mongoose.disconnect();
  });

  describe("1. Individual Batch 1 Route Permission Enforcement", () => {
    const nonExistentId = new mongoose.Types.ObjectId().toString();

    const BATCH_1_ROUTES = [
      {
        name: "Analytics Admin Overview",
        path: "/api/v1/analytics/admin/overview",
        requiredPermission: PERMISSIONS.ANALYTICS_READ,
      },
      {
        name: "Analytics Admin Top Products",
        path: "/api/v1/analytics/admin/top-products",
        requiredPermission: PERMISSIONS.ANALYTICS_READ,
      },
      {
        name: "Analytics Admin Sales Trend",
        path: "/api/v1/analytics/admin/sales-trend",
        requiredPermission: PERMISSIONS.ANALYTICS_READ,
      },
      {
        name: "Warehouses List",
        path: "/api/v1/warehouses",
        requiredPermission: PERMISSIONS.WAREHOUSES_READ,
      },
      {
        name: "Warehouse Detail",
        path: `/api/v1/warehouses/${nonExistentId}`,
        requiredPermission: PERMISSIONS.WAREHOUSES_READ,
      },
      {
        name: "Coupons List",
        path: "/api/v1/coupons",
        requiredPermission: PERMISSIONS.COUPONS_READ,
      },
      {
        name: "Coupon Detail",
        path: `/api/v1/coupons/${nonExistentId}`,
        requiredPermission: PERMISSIONS.COUPONS_READ,
      },
      {
        name: "Coupon Redemptions by Coupon",
        path: `/api/v1/coupon-redemptions/coupon/${nonExistentId}`,
        requiredPermission: PERMISSIONS.COUPONS_READ,
      },
      {
        name: "Coupon Redemptions by Customer",
        path: `/api/v1/coupon-redemptions/customer/${nonExistentId}`,
        requiredPermission: PERMISSIONS.COUPONS_READ,
      },
      {
        name: "Campaigns List",
        path: "/api/v1/campaigns",
        requiredPermission: PERMISSIONS.CAMPAIGNS_READ,
      },
      {
        name: "Campaign Detail",
        path: `/api/v1/campaigns/${nonExistentId}`,
        requiredPermission: PERMISSIONS.CAMPAIGNS_READ,
      },
      {
        name: "Campaign Performance by Campaign",
        path: `/api/v1/campaign-performance/campaign/${nonExistentId}`,
        requiredPermission: PERMISSIONS.CAMPAIGNS_READ,
      },
      {
        name: "Campaign Performance Detail",
        path: `/api/v1/campaign-performance/${nonExistentId}`,
        requiredPermission: PERMISSIONS.CAMPAIGNS_READ,
      },
      {
        name: "Tax Rules List",
        path: "/api/v1/tax/rules",
        requiredPermission: PERMISSIONS.TAX_READ,
      },
      {
        name: "Tax Rule Detail",
        path: `/api/v1/tax/rules/${nonExistentId}`,
        requiredPermission: PERMISSIONS.TAX_READ,
      },
      {
        name: "CMS Pages List",
        path: "/api/v1/cms/pages",
        requiredPermission: PERMISSIONS.SETTINGS_READ,
      },
      {
        name: "CMS Page Detail",
        path: `/api/v1/cms/pages/${nonExistentId}`,
        requiredPermission: PERMISSIONS.SETTINGS_READ,
      },
    ];

    test.each(BATCH_1_ROUTES)(
      "Route '$name' ($path) strictly enforces $requiredPermission",
      async ({ path, requiredPermission }) => {
        // 1. Unauthenticated request is rejected (401)
        const unauthRes = await request(app).get(path);
        expect(unauthRes.status).toBe(401);

        // 2. Authenticated employee WITHOUT the required permission is rejected (403)
        const { token: unauthorizedToken } = await createTestEmployee();
        // Employee has no roles or permissions
        const forbiddenRes = await request(app)
          .get(path)
          .set("Authorization", `Bearer ${unauthorizedToken}`);
        expect(forbiddenRes.status).toBe(403);
        expect(forbiddenRes.body.code).toBe("INSUFFICIENT_PERMISSIONS");

        // 3. Authenticated employee WITH the required permission passes authorization guard
        const { employee, token: authorizedToken } = await createTestEmployee();
        await assignRoleWithPermissions(
          employee._id,
          `test_batch1_role_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          [requiredPermission]
        );

        const authorizedRes = await request(app)
          .get(path)
          .set("Authorization", `Bearer ${authorizedToken}`);

        // If authorization passes, response is either 200 (success) or 404 (resource not found),
        // but NEVER 401 or 403!
        expect(authorizedRes.status).not.toBe(401);
        expect(authorizedRes.status).not.toBe(403);
      }
    );
  });

  describe("2. Dynamic PBAC Priority & Invariant Tests on Batch 1", () => {
    it("Direct Grant allows access even without role permission", async () => {
      const { user, employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.ANALYTICS_READ);

      // Create direct grant
      await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
      });

      const res = await request(app)
        .get("/api/v1/analytics/admin/overview")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("Direct Restriction overrides inherited role permission (Restriction Dominance)", async () => {
      const { user, employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.ANALYTICS_READ);

      // Assign role with analytics:read
      await assignRoleWithPermissions(
        employee._id,
        `test_batch1_override_${Date.now()}`,
        [PERMISSIONS.ANALYTICS_READ]
      );

      // Create direct restriction
      await EmployeePermissionRestriction.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
      });

      const res = await request(app)
        .get("/api/v1/analytics/admin/overview")
        .set("Authorization", `Bearer ${token}`);

      // Direct restriction wins: 403 Forbidden
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("Suspended employee cannot access Batch 1 endpoints even with active roles", async () => {
      const { employee, token } = await createTestEmployee({ status: "suspended" });
      await assignRoleWithPermissions(
        employee._id,
        `test_batch1_suspended_${Date.now()}`,
        [PERMISSIONS.ANALYTICS_READ, PERMISSIONS.WAREHOUSES_READ]
      );

      const res = await request(app)
        .get("/api/v1/warehouses")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("Terminated employee cannot access Batch 1 endpoints even with active roles", async () => {
      const { employee, token } = await createTestEmployee({ status: "terminated" });
      await assignRoleWithPermissions(
        employee._id,
        `test_batch1_terminated_${Date.now()}`,
        [PERMISSIONS.COUPONS_READ]
      );

      const res = await request(app)
        .get("/api/v1/coupons")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("Expired EmployeeRole drops permission and receives 403", async () => {
      const { employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.CAMPAIGNS_READ);
      const role = await Role.create({
        slug: `test_batch1_expired_${Date.now()}`,
        name: "Expired Role",
        isActive: true,
      });
      await RolePermission.create({ roleId: role._id, permissionId: perm._id });

      // Expired role assignment (1 day in the past)
      await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role._id,
        isActive: true,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });

      const res = await request(app)
        .get("/api/v1/campaigns")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("Multiple roles grant union of permissions across Batch 1 routes", async () => {
      const { employee, token } = await createTestEmployee();

      // Assign Role 1 with analytics:read
      await assignRoleWithPermissions(
        employee._id,
        `test_batch1_union_role1_${Date.now()}`,
        [PERMISSIONS.ANALYTICS_READ]
      );

      // Assign Role 2 with coupons:read
      await assignRoleWithPermissions(
        employee._id,
        `test_batch1_union_role2_${Date.now()}`,
        [PERMISSIONS.COUPONS_READ]
      );

      // Can access analytics endpoint (from Role 1)
      const resAnalytics = await request(app)
        .get("/api/v1/analytics/admin/overview")
        .set("Authorization", `Bearer ${token}`);
      expect(resAnalytics.status).toBe(200);

      // Can access coupons endpoint (from Role 2)
      const resCoupons = await request(app)
        .get("/api/v1/coupons")
        .set("Authorization", `Bearer ${token}`);
      expect(resCoupons.status).toBe(200);

      // Cannot access warehouses endpoint (missing permission)
      const resWarehouses = await request(app)
        .get("/api/v1/warehouses")
        .set("Authorization", `Bearer ${token}`);
      expect(resWarehouses.status).toBe(403);
    });

    it("Expired direct grant drops permission and receives 403", async () => {
      const { employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.WAREHOUSES_READ);

      // Expired direct grant (1 day in the past)
      await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });

      const res = await request(app)
        .get("/api/v1/warehouses")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("Stale permissionVersion triggers authoritative dynamic DB resolution", async () => {
      const { user, employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.TAX_READ);

      // Directly grant permission in DB and increment version
      await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
      });
      await incrementPermissionVersion(user._id);

      // Token has old permissionVersion: 1, DB has 2
      // Middleware detects stale token and resolves current DB permissions
      const res = await request(app)
        .get("/api/v1/tax/rules")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("Stale authVersion terminates session with 401 AUTH_VERSION_MISMATCH", async () => {
      const { user, token } = await createTestEmployee();
      await incrementAuthVersion(user._id);

      const res = await request(app)
        .get("/api/v1/analytics/admin/overview")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("AUTH_VERSION_MISMATCH");
    });
  });
});
