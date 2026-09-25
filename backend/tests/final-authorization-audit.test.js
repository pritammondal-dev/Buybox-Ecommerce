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
const Warehouse = require("../src/models/Warehouse");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const { generateAccessToken, TOKEN_CONTEXTS } = require("../src/services/token.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_final_auth_audit_test?")
  : "mongodb://127.0.0.1:27017/buybox_final_auth_audit_test?replicaSet=rs0";

jest.setTimeout(30000);

describe("Phase E — Final Authorization & Security Audit", () => {
  let createdPermissions = new Map();
  let testWarehouse;

  async function getOrCreatePermission(slug) {
    if (createdPermissions.has(slug)) {
      return createdPermissions.get(slug);
    }
    let perm = await Permission.findOne({ slug });
    if (!perm) {
      perm = await Permission.create({
        slug,
        name: `Perm ${slug}`,
        module: slug.split(":")[0],
        description: `Description for ${slug}`,
        isActive: true,
      });
    }
    createdPermissions.set(slug, perm);
    return perm;
  }

  async function createTestEmployee(options = {}) {
    const status = options.status || "active";
    if (options.userRole === "super_admin" || options.userRole === ROLES.SUPER_ADMIN) {
      await User.deleteMany({ role: "super_admin" });
    }
    const user = await User.create({
      firstName: "Audit",
      lastName: "Staff",
      email: `audit_staff_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`,
      password: "Password123!",
      role: options.userRole || "manager",
      isActive: options.isActive !== undefined ? options.isActive : true,
      authVersion: options.authVersion || 1,
      permissionVersion: options.permissionVersion || 1,
    });

    const employee = await Employee.create({
      userId: user._id,
      employeeNumber: `EMP_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`,
      jobTitle: "Security Auditor",
      department: "Security",
      status,
    });

    if (options.permissions && options.permissions.length > 0) {
      const suffix = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const role = await Role.create({
        slug: `audit_role_${suffix}`,
        name: `Audit Staff Role ${suffix}`,
        isActive: true,
      });

      for (const slug of options.permissions) {
        const perm = await getOrCreatePermission(slug);
        await RolePermission.create({
          roleId: role._id,
          permissionId: perm._id,
        });
      }

      await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role._id,
        isActive: true,
      });
    }

    const token = generateAccessToken({
      sub: user._id.toString(),
      role: user.role,
      context: TOKEN_CONTEXTS.ADMINISTRATOR,
      authVersion: user.authVersion,
      permissionVersion: user.permissionVersion,
    });

    return { user, employee, token };
  }

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    testWarehouse = await Warehouse.create({
      name: `WH Audit ${Date.now()}`,
      code: `WHAUDIT_${Date.now()}`,
      address: {
        addressLine1: "789 Audit Way",
        city: "Bangalore",
        state: "KA",
        postalCode: "560001",
        country: "IN",
      },
      isActive: true,
    });
  });

  afterAll(async () => {
    try {
      await Warehouse.deleteMany({ _id: testWarehouse._id });
    } catch (e) {
      // Ignored
    }
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  describe("1. authVersion Invalidation Security Guarantee", () => {
    test("token with stale authVersion is rejected with 401", async () => {
      const { user, token } = await createTestEmployee({
        permissions: [PERMISSIONS.WAREHOUSES_READ],
      });

      // Increment authVersion in database to simulate password change or remote logout
      await User.findByIdAndUpdate(user._id, { $inc: { authVersion: 1 } });

      const res = await request(app)
        .get("/api/v1/warehouses")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect([
        "AUTH_VERSION_MISMATCH",
        "AUTHENTICATION_REQUIRED",
        "INVALID_TOKEN",
        "SESSION_EXPIRED",
      ]).toContain(res.body.code);
    });
  });

  describe("2. Dynamic PBAC: Direct Grants & Restrictions (Restriction Dominance)", () => {
    test("direct grant affords access even if role does NOT include the permission", async () => {
      const { employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.WAREHOUSES_READ);

      await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: null,
      });

      const res = await request(app)
        .get("/api/v1/warehouses")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("direct restriction strictly denies access even if permission is in role AND granted directly (Restriction strictly dominates)", async () => {
      const { employee, token } = await createTestEmployee({
        permissions: [PERMISSIONS.WAREHOUSES_READ],
      });
      const perm = await getOrCreatePermission(PERMISSIONS.WAREHOUSES_READ);

      // Add direct grant
      await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: null,
      });

      // Add direct restriction
      await EmployeePermissionRestriction.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: null,
      });

      const res = await request(app)
        .get("/api/v1/warehouses")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });
  });

  describe("3. Status Gating: Suspended or Terminated Employees", () => {
    test("suspended employee profile fails closed with 403", async () => {
      const { token } = await createTestEmployee({
        permissions: [PERMISSIONS.WAREHOUSES_READ],
        status: "suspended",
      });

      const res = await request(app)
        .get("/api/v1/warehouses")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    test("terminated employee profile fails closed with 403", async () => {
      const { token } = await createTestEmployee({
        permissions: [PERMISSIONS.WAREHOUSES_READ],
        status: "terminated",
      });

      const res = await request(app)
        .get("/api/v1/warehouses")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  describe("4. Super Admin Governance & Safeguards", () => {
    test("Super Admin operates without requiring individual work assignments", async () => {
      const { token } = await createTestEmployee({
        permissions: [PERMISSIONS.WAREHOUSES_READ],
        userRole: ROLES.SUPER_ADMIN,
      });

      const res = await request(app)
        .get(`/api/v1/warehouses/${testWarehouse._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("Super Admin cannot bypass ObjectId validation (fails closed with 400)", async () => {
      const { token } = await createTestEmployee({
        permissions: [PERMISSIONS.WAREHOUSES_READ],
        userRole: ROLES.SUPER_ADMIN,
      });

      const res = await request(app)
        .get("/api/v1/warehouses/invalid-object-id-123")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_OBJECT_ID");
    });
  });
});
