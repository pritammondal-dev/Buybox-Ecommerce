const mongoose = require("mongoose");
const User = require("../src/models/User");
const Employee = require("../src/models/Employee");
const Role = require("../src/models/Role");
const Permission = require("../src/models/Permission");
const RolePermission = require("../src/models/RolePermission");
const EmployeeRole = require("../src/models/EmployeeRole");
const EmployeePermissionGrant = require("../src/models/EmployeePermissionGrant");
const EmployeePermissionRestriction = require("../src/models/EmployeePermissionRestriction");
const {
  ROLE_PERMISSIONS,
  GOVERNANCE_PERMISSIONS,
  OPERATIONAL_PERMISSIONS,
} = require("../src/constants/role-permissions.constants");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const {
  getEffectivePermissions,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  incrementAuthVersion,
  incrementPermissionVersion,
  verifyTokenVersions,
  isRecordActiveAndNotExpired,
} = require("../src/services/authorization.service");
const { generateAccessToken } = require("../src/services/token.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_auth_test?")
  : "mongodb://127.0.0.1:27017/buybox_auth_test?replicaSet=rs0";

describe("Phase 1C — Effective Permission Resolver & Versioned Authorization", () => {
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
      User.deleteMany({ email: /@test-auth-resolver\.com$/ }),
      Employee.deleteMany({}),
      Role.deleteMany({ slug: { $regex: /^test_/ } }),
      Permission.deleteMany({ slug: { $regex: /^test:/ } }),
      RolePermission.deleteMany({}),
      EmployeeRole.deleteMany({}),
      EmployeePermissionGrant.deleteMany({}),
      EmployeePermissionRestriction.deleteMany({}),
    ]);
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await Promise.all([
      User.deleteMany({ email: /@test-auth-resolver\.com$/ }),
      Employee.deleteMany({}),
      Role.deleteMany({ slug: { $regex: /^test_/ } }),
      Permission.deleteMany({ slug: { $regex: /^test:/ } }),
      RolePermission.deleteMany({}),
      EmployeeRole.deleteMany({}),
      EmployeePermissionGrant.deleteMany({}),
      EmployeePermissionRestriction.deleteMany({}),
    ]);
  });

  // Helper to create test user & employee
  const createTestUserAndEmployee = async (
    userRole = "admin",
    employeeStatus = "active",
  ) => {
    const user = await User.create({
      firstName: "Test",
      lastName: "Resolver",
      email: `user_${Date.now()}_${Math.random().toString(36).substring(7)}@test-auth-resolver.com`,
      password: "Password123!",
      role: userRole,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const employee = await Employee.create({
      userId: user._id,
      employeeNumber: `EMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      status: employeeStatus,
      workEmail: `work_${Date.now()}@test-auth-resolver.com`,
    });

    return { user, employee };
  };

  // Helper to create test permissions
  const createPermissions = async (slugs) => {
    const permissions = [];
    for (const slug of slugs) {
      const p = await Permission.create({
        name: `Perm ${slug}`,
        slug,
        module: "test",
        action: "view",
        isActive: true,
      });
      permissions.push(p);
    }
    return permissions;
  };

  // Helper to create test role with permissions
  const createRoleWithPermissions = async (roleSlug, permissions) => {
    const role = await Role.create({
      name: `Role ${roleSlug}`,
      slug: roleSlug,
      isActive: true,
    });

    for (const p of permissions) {
      await RolePermission.create({
        roleId: role._id,
        permissionId: p._id,
      });
    }

    return role;
  };

  describe("1. Pure Expiration & Active Helper (isRecordActiveAndNotExpired)", () => {
    it("evaluates active and non-expired records correctly", () => {
      const now = new Date("2026-09-14T12:00:00Z");
      expect(isRecordActiveAndNotExpired(null, now)).toBe(false);
      expect(isRecordActiveAndNotExpired({ isActive: false }, now)).toBe(false);
      expect(
        isRecordActiveAndNotExpired({ isActive: true, expiresAt: null }, now),
      ).toBe(true);
      expect(
        isRecordActiveAndNotExpired(
          { isActive: true, expiresAt: new Date("2026-09-14T12:00:01Z") },
          now,
        ),
      ).toBe(true);
      expect(
        isRecordActiveAndNotExpired(
          { isActive: true, expiresAt: new Date("2026-09-14T12:00:00Z") },
          now,
        ),
      ).toBe(false);
      expect(
        isRecordActiveAndNotExpired(
          { isActive: true, expiresAt: new Date("2026-09-14T11:59:59Z") },
          now,
        ),
      ).toBe(false);
    });
  });

  describe("2. Effective Permission Resolver — Core Cases (A through E)", () => {
    it("Case A: Single Role — inherits all active permissions from assigned role", async () => {
      const { user, employee } = await createTestUserAndEmployee();
      const [p1, p2] = await createPermissions([
        "test:order:view",
        "test:order:edit",
      ]);
      const role = await createRoleWithPermissions("test_order_manager", [
        p1,
        p2,
      ]);

      await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role._id,
        isActive: true,
      });

      const effective = await getEffectivePermissions(user._id);
      expect(effective).toEqual(["test:order:edit", "test:order:view"]);
    });

    it("Case B: Direct Grant — combines role permissions with active direct grant", async () => {
      const { user, employee } = await createTestUserAndEmployee();
      const [p1, p2, p3] = await createPermissions([
        "test:order:view",
        "test:order:edit",
        "test:refund:process",
      ]);
      const role = await createRoleWithPermissions("test_order_manager", [
        p1,
        p2,
      ]);

      await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role._id,
        isActive: true,
      });

      await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: p3._id,
        reason: "Temporary holiday coverage",
        isActive: true,
      });

      const effective = await getEffectivePermissions(user._id);
      expect(effective).toEqual([
        "test:order:edit",
        "test:order:view",
        "test:refund:process",
      ]);
    });

    it("Case C: Direct Restriction overrides inherited role permission (Restriction Dominance)", async () => {
      const { user, employee } = await createTestUserAndEmployee();
      const [p1] = await createPermissions(["test:order:delete"]);
      const role = await createRoleWithPermissions("test_order_admin", [p1]);

      await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role._id,
        isActive: true,
      });

      await EmployeePermissionRestriction.create({
        employeeId: employee._id,
        permissionId: p1._id,
        reason: "Probation restriction on deletions",
        isActive: true,
      });

      const effective = await getEffectivePermissions(user._id);
      expect(effective).toEqual([]);
    });

    it("Case D: Direct Restriction on multi-permission role — removes only restricted permission", async () => {
      const { user, employee } = await createTestUserAndEmployee();
      const [p1, p2, p3] = await createPermissions([
        "test:user:view",
        "test:user:edit",
        "test:user:delete",
      ]);
      const role = await createRoleWithPermissions("test_user_admin", [
        p1,
        p2,
        p3,
      ]);

      await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role._id,
        isActive: true,
      });

      await EmployeePermissionRestriction.create({
        employeeId: employee._id,
        permissionId: p3._id, // restrict delete
        reason: "Cannot delete user accounts",
        isActive: true,
      });

      const effective = await getEffectivePermissions(user._id);
      expect(effective).toEqual(["test:user:edit", "test:user:view"]);
    });

    it("Case E: Direct Restriction overrides multiple roles providing the same permission", async () => {
      const { user, employee } = await createTestUserAndEmployee();
      const [p1, p2, p3] = await createPermissions([
        "test:report:export",
        "test:order:view",
        "test:inventory:view",
      ]);

      const role1 = await createRoleWithPermissions("test_role_1", [p1, p2]);
      const role2 = await createRoleWithPermissions("test_role_2", [p1, p3]);

      await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role1._id,
        isActive: true,
      });

      await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role2._id,
        isActive: true,
      });

      // Both role1 and role2 grant test:report:export
      // Also direct grant it to test restriction dominance over direct grant as well!
      await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: p1._id,
        isActive: true,
      });

      // Direct restriction on test:report:export
      await EmployeePermissionRestriction.create({
        employeeId: employee._id,
        permissionId: p1._id,
        isActive: true,
      });

      const effective = await getEffectivePermissions(user._id);
      expect(effective).toEqual(["test:inventory:view", "test:order:view"]);
      expect(effective).not.toContain("test:report:export");
    });
  });

  describe("3. Multi-Role Union, Overlaps, and Revocation", () => {
    it("correctly unions multiple active roles without duplicates", async () => {
      const { user, employee } = await createTestUserAndEmployee();
      const [p1, p2, p3] = await createPermissions([
        "test:a",
        "test:b",
        "test:c",
      ]);

      const role1 = await createRoleWithPermissions("test_r1", [p1, p2]);
      const role2 = await createRoleWithPermissions("test_r2", [p2, p3]);

      await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role1._id,
        isActive: true,
      });
      await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role2._id,
        isActive: true,
      });

      const effective = await getEffectivePermissions(user._id);
      expect(effective).toEqual(["test:a", "test:b", "test:c"]);
    });

    it("removes permissions when an EmployeeRole is deactivated or removed", async () => {
      const { user, employee } = await createTestUserAndEmployee();
      const [p1, p2, p3] = await createPermissions([
        "test:a",
        "test:b",
        "test:c",
      ]);

      const role1 = await createRoleWithPermissions("test_r1", [p1, p2]);
      const role2 = await createRoleWithPermissions("test_r2", [p3]);

      await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role1._id,
        isActive: true,
      });
      const er2 = await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role2._id,
        isActive: true,
      });

      let effective = await getEffectivePermissions(user._id);
      expect(effective).toEqual(["test:a", "test:b", "test:c"]);

      // Deactivate role 2
      await EmployeeRole.findByIdAndUpdate(er2._id, { isActive: false });

      effective = await getEffectivePermissions(user._id);
      expect(effective).toEqual(["test:a", "test:b"]);
    });
  });

  describe("4. Expiration Handling", () => {
    it("excludes expired EmployeeRole assignments", async () => {
      const { user, employee } = await createTestUserAndEmployee();
      const [p1] = await createPermissions(["test:expired:role"]);
      const role = await createRoleWithPermissions("test_expired_role", [p1]);

      const now = new Date("2026-09-14T12:00:00Z");

      await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role._id,
        isActive: true,
        expiresAt: new Date("2026-09-14T11:00:00Z"), // 1 hour ago
      });

      const effective = await getEffectivePermissions(user._id, { now });
      expect(effective).toEqual([]);
    });

    it("includes non-expired future EmployeeRole assignments", async () => {
      const { user, employee } = await createTestUserAndEmployee();
      const [p1] = await createPermissions(["test:valid:role"]);
      const role = await createRoleWithPermissions("test_valid_role", [p1]);

      const now = new Date("2026-09-14T12:00:00Z");

      await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role._id,
        isActive: true,
        expiresAt: new Date("2026-09-14T13:00:00Z"), // 1 hour in future
      });

      const effective = await getEffectivePermissions(user._id, { now });
      expect(effective).toEqual(["test:valid:role"]);
    });

    it("excludes expired EmployeePermissionGrant", async () => {
      const { user, employee } = await createTestUserAndEmployee();
      const [p1] = await createPermissions(["test:expired:grant"]);

      const now = new Date("2026-09-14T12:00:00Z");

      await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: p1._id,
        isActive: true,
        expiresAt: new Date("2026-09-14T11:59:59Z"),
      });

      const effective = await getEffectivePermissions(user._id, { now });
      expect(effective).toEqual([]);
    });

    it("re-enables permission when an EmployeePermissionRestriction expires", async () => {
      const { user, employee } = await createTestUserAndEmployee();
      const [p1] = await createPermissions(["test:temp:restriction"]);
      const role = await createRoleWithPermissions("test_perm_role", [p1]);

      const now = new Date("2026-09-14T12:00:00Z");

      await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role._id,
        isActive: true,
      });

      // Restriction expired 1 minute ago
      await EmployeePermissionRestriction.create({
        employeeId: employee._id,
        permissionId: p1._id,
        isActive: true,
        expiresAt: new Date("2026-09-14T11:59:00Z"),
      });

      const effective = await getEffectivePermissions(user._id, { now });
      expect(effective).toEqual(["test:temp:restriction"]);
    });
  });

  describe("5. Active Flags & Soft Invalidation", () => {
    it("excludes permissions from deactivated Role (role.isActive = false)", async () => {
      const { user, employee } = await createTestUserAndEmployee();
      const [p1] = await createPermissions(["test:inactive:role"]);
      const role = await createRoleWithPermissions("test_inactive_r", [p1]);

      await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role._id,
        isActive: true,
      });

      await Role.findByIdAndUpdate(role._id, { isActive: false });

      const effective = await getEffectivePermissions(user._id);
      expect(effective).toEqual([]);
    });

    it("excludes deactivated Permission (permission.isActive = false)", async () => {
      const { user, employee } = await createTestUserAndEmployee();
      const [p1] = await createPermissions(["test:inactive:perm"]);
      const role = await createRoleWithPermissions("test_active_r", [p1]);

      await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role._id,
        isActive: true,
      });

      await Permission.findByIdAndUpdate(p1._id, { isActive: false });

      const effective = await getEffectivePermissions(user._id);
      expect(effective).toEqual([]);
    });

    it("ignores deactivated restriction (restriction.isActive = false)", async () => {
      const { user, employee } = await createTestUserAndEmployee();
      const [p1] = await createPermissions(["test:disabled:restriction"]);
      const role = await createRoleWithPermissions("test_disabled_r", [p1]);

      await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role._id,
        isActive: true,
      });

      await EmployeePermissionRestriction.create({
        employeeId: employee._id,
        permissionId: p1._id,
        isActive: false, // deactivated restriction
      });

      const effective = await getEffectivePermissions(user._id);
      expect(effective).toEqual(["test:disabled:restriction"]);
    });
  });

  describe("6. Employee Status Gating", () => {
    it("returns empty array for suspended employee even with active roles and grants", async () => {
      const { user, employee } = await createTestUserAndEmployee(
        "admin",
        "suspended",
      );
      const [p1, p2] = await createPermissions(["test:p1", "test:p2"]);
      const role = await createRoleWithPermissions("test_suspended_role", [p1]);

      await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role._id,
        isActive: true,
      });
      await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: p2._id,
        isActive: true,
      });

      const effective = await getEffectivePermissions(user._id);
      expect(effective).toEqual([]);
    });

    it("returns empty array for terminated employee even with active roles and grants", async () => {
      const { user, employee } = await createTestUserAndEmployee(
        "admin",
        "terminated",
      );
      const [p1] = await createPermissions(["test:p1"]);
      const role = await createRoleWithPermissions("test_term_role", [p1]);

      await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role._id,
        isActive: true,
      });

      const effective = await getEffectivePermissions(user._id);
      expect(effective).toEqual([]);
    });

    it("restores permissions when a suspended employee is reactivated", async () => {
      const { user, employee } = await createTestUserAndEmployee(
        "admin",
        "suspended",
      );
      const [p1] = await createPermissions(["test:p1"]);
      const role = await createRoleWithPermissions("test_reactivate_role", [
        p1,
      ]);

      await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role._id,
        isActive: true,
      });

      expect(await getEffectivePermissions(user._id)).toEqual([]);

      await Employee.findByIdAndUpdate(employee._id, { status: "active" });

      expect(await getEffectivePermissions(user._id)).toEqual(["test:p1"]);
    });
  });

  describe("7. Customer & Vendor Compatibility (No Employee Document)", () => {
    it("returns ROLE_PERMISSIONS for customer without an Employee profile", async () => {
      const user = await User.create({
        firstName: "Customer",
        lastName: "User",
        email: `cust_${Date.now()}@test-auth-resolver.com`,
        password: "Password123!",
        role: "customer",
        isActive: true,
      });

      const effective = await getEffectivePermissions(user._id);
      const expected = [...new Set(ROLE_PERMISSIONS.customer || [])].sort();
      expect(effective).toEqual(expected);
    });

    it("returns ROLE_PERMISSIONS for vendor without an Employee profile", async () => {
      const user = await User.create({
        firstName: "Vendor",
        lastName: "User",
        email: `vend_${Date.now()}@test-auth-resolver.com`,
        password: "Password123!",
        role: "vendor",
        isActive: true,
      });

      const effective = await getEffectivePermissions(user._id);
      const expected = [...new Set(ROLE_PERMISSIONS.vendor || [])].sort();
      expect(effective).toEqual(expected);
    });

    it("returns empty array for staff/admin user without an Employee profile", async () => {
      const user = await User.create({
        firstName: "Admin",
        lastName: "User",
        email: `admin_${Date.now()}@test-auth-resolver.com`,
        password: "Password123!",
        role: "admin",
        isActive: true,
      });

      const effective = await getEffectivePermissions(user._id);
      expect(effective).toEqual([]);
    });
  });

  describe("8. Inactive & Non-Existent User Handling", () => {
    it("returns empty array for inactive user (isActive: false)", async () => {
      const { user, employee } = await createTestUserAndEmployee();
      const [p1] = await createPermissions(["test:inactive:user"]);
      const role = await createRoleWithPermissions("test_user_r", [p1]);

      await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role._id,
        isActive: true,
      });

      await User.findByIdAndUpdate(user._id, { isActive: false });

      const effective = await getEffectivePermissions(user._id);
      expect(effective).toEqual([]);
    });

    it("returns empty array for non-existent userId", async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const effective = await getEffectivePermissions(nonExistentId);
      expect(effective).toEqual([]);
    });

    it("returns empty array for null/undefined userId", async () => {
      expect(await getEffectivePermissions(null)).toEqual([]);
      expect(await getEffectivePermissions(undefined)).toEqual([]);
    });
  });

  describe("9. Convenience Checkers (hasPermission, hasAnyPermission, hasAllPermissions)", () => {
    it("evaluates hasPermission correctly", async () => {
      const { user, employee } = await createTestUserAndEmployee();
      const [p1] = await createPermissions(["test:order:read"]);
      const role = await createRoleWithPermissions("test_checker_r", [p1]);

      await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role._id,
        isActive: true,
      });

      expect(await hasPermission(user._id, "test:order:read")).toBe(true);
      expect(await hasPermission(user._id, "test:order:write")).toBe(false);
      expect(await hasPermission(user._id, null)).toBe(false);
    });

    it("evaluates hasAnyPermission correctly", async () => {
      const { user, employee } = await createTestUserAndEmployee();
      const [p1] = await createPermissions(["test:order:read"]);
      const role = await createRoleWithPermissions("test_checker_r2", [p1]);

      await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role._id,
        isActive: true,
      });

      expect(
        await hasAnyPermission(user._id, [
          "test:order:read",
          "test:order:delete",
        ]),
      ).toBe(true);
      expect(
        await hasAnyPermission(user._id, [
          "test:order:delete",
          "test:order:create",
        ]),
      ).toBe(false);
      expect(await hasAnyPermission(user._id, [])).toBe(false);
    });

    it("evaluates hasAllPermissions correctly", async () => {
      const { user, employee } = await createTestUserAndEmployee();
      const [p1, p2] = await createPermissions([
        "test:order:read",
        "test:order:write",
      ]);
      const role = await createRoleWithPermissions("test_checker_r3", [p1, p2]);

      await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role._id,
        isActive: true,
      });

      expect(
        await hasAllPermissions(user._id, [
          "test:order:read",
          "test:order:write",
        ]),
      ).toBe(true);
      expect(
        await hasAllPermissions(user._id, [
          "test:order:read",
          "test:order:delete",
        ]),
      ).toBe(false);
      expect(await hasAllPermissions(user._id, [])).toBe(false);
    });
  });

  describe("10. Versioned Invalidation and Token Verification", () => {
    it("atomically increments authVersion", async () => {
      const { user } = await createTestUserAndEmployee();
      expect(user.authVersion).toBe(1);

      const res1 = await incrementAuthVersion(user._id);
      expect(res1.authVersion).toBe(2);

      const refreshed = await User.findById(user._id);
      expect(refreshed.authVersion).toBe(2);

      const res2 = await incrementAuthVersion(user._id);
      expect(res2.authVersion).toBe(3);
    });

    it("atomically increments permissionVersion", async () => {
      const { user } = await createTestUserAndEmployee();
      expect(user.permissionVersion).toBe(1);

      const res1 = await incrementPermissionVersion(user._id);
      expect(res1.permissionVersion).toBe(2);

      const refreshed = await User.findById(user._id);
      expect(refreshed.permissionVersion).toBe(2);
    });

    it("verifyTokenVersions identifies valid, stale, and invalid sessions", () => {
      const user = {
        _id: "user123",
        isActive: true,
        authVersion: 2,
        permissionVersion: 3,
      };

      // Exact match
      expect(
        verifyTokenVersions(user, { authVersion: 2, permissionVersion: 3 }),
      ).toEqual({
        isAuthValid: true,
        isPermissionFresh: true,
        reason: null,
      });

      // authVersion mismatch -> invalid session (forced logout)
      expect(
        verifyTokenVersions(user, { authVersion: 1, permissionVersion: 3 }),
      ).toEqual({
        isAuthValid: false,
        isPermissionFresh: false,
        reason: "AUTH_VERSION_MISMATCH",
      });

      // permissionVersion mismatch -> auth is valid, but cached permissions are stale
      expect(
        verifyTokenVersions(user, { authVersion: 2, permissionVersion: 2 }),
      ).toEqual({
        isAuthValid: true,
        isPermissionFresh: false,
        reason: "PERMISSION_VERSION_STALE",
      });

      // Inactive user -> invalid session
      expect(
        verifyTokenVersions(
          { ...user, isActive: false },
          { authVersion: 2, permissionVersion: 3 },
        ),
      ).toEqual({
        isAuthValid: false,
        isPermissionFresh: false,
        reason: "USER_INACTIVE",
      });

      // User not found
      expect(
        verifyTokenVersions(null, { authVersion: 2, permissionVersion: 3 }),
      ).toEqual({
        isAuthValid: false,
        isPermissionFresh: false,
        reason: "USER_NOT_FOUND",
      });

      // Legacy token fallback (missing versions in tokenPayload defaults to 1)
      const legacyUser = {
        _id: "u1",
        isActive: true,
        authVersion: 1,
        permissionVersion: 1,
      };
      expect(verifyTokenVersions(legacyUser, {})).toEqual({
        isAuthValid: true,
        isPermissionFresh: true,
        reason: null,
      });
    });

    it("generateAccessToken embeds authVersion and permissionVersion in JWT", () => {
      const token = generateAccessToken({
        sub: "user_test_123",
        role: "admin",
        authVersion: 4,
        permissionVersion: 7,
      });

      expect(typeof token).toBe("string");
      const jwt = require("jsonwebtoken");
      const decoded = jwt.decode(token);
      expect(decoded.sub).toBe("user_test_123");
      expect(decoded.authVersion).toBe(4);
      expect(decoded.permissionVersion).toBe(7);
    });
  });

  describe("11. Middleware Integration & Stale-Version Security Invariants", () => {
    const express = require("express");
    const request = require("supertest");
    const authenticate = require("../src/middlewares/authentication.middleware");
    const {
      requirePermissions,
      requireRoles,
    } = require("../src/middlewares/authorization.middleware");
    const errorHandler = require("../src/middlewares/error.middleware");

    let testApp;

    beforeAll(() => {
      testApp = express();
      testApp.use(express.json());

      testApp.get(
        "/test/protected-perm",
        authenticate,
        requirePermissions("test:sensitive:action"),
        (req, res) =>
          res.status(200).json({ success: true, user: req.user, auth: req.auth }),
      );

      testApp.get(
        "/test/governance-perm",
        authenticate,
        requirePermissions("roles:manage"),
        (req, res) =>
          res.status(200).json({ success: true, user: req.user, auth: req.auth }),
      );

      testApp.get(
        "/test/protected-role",
        authenticate,
        requireRoles("admin"),
        (req, res) => res.status(200).json({ success: true, user: req.user }),
      );

      testApp.use(errorHandler);
    });

    it("1. Matching authVersion is accepted by authentication middleware", async () => {
      const { user, employee } = await createTestUserAndEmployee();
      const [perm] = await createPermissions(["test:sensitive:action"]);
      const role = await createRoleWithPermissions("test_sec_r1", [perm]);
      await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role._id,
        isActive: true,
      });

      const token = generateAccessToken({
        sub: user._id.toString(),
        role: "admin",
        authVersion: user.authVersion,
        permissionVersion: user.permissionVersion,
      });

      const res = await request(testApp)
        .get("/test/protected-perm")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("2. Stale authVersion is rejected with 401 AUTH_VERSION_MISMATCH (session invalidation)", async () => {
      const { user } = await createTestUserAndEmployee();

      const token = generateAccessToken({
        sub: user._id.toString(),
        role: "admin",
        authVersion: 1,
        permissionVersion: 1,
      });

      await incrementAuthVersion(user._id); // DB becomes 2

      const res = await request(testApp)
        .get("/test/protected-perm")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("AUTH_VERSION_MISMATCH");
    });

    it("3. Matching permissionVersion is considered fresh (isPermissionFresh === true)", async () => {
      const { user, employee } = await createTestUserAndEmployee();
      const [perm] = await createPermissions(["test:sensitive:action"]);
      const role = await createRoleWithPermissions("test_sec_r2", [perm]);
      await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role._id,
        isActive: true,
      });

      const token = generateAccessToken({
        sub: user._id.toString(),
        role: "admin",
        authVersion: user.authVersion,
        permissionVersion: user.permissionVersion,
      });

      const res = await request(testApp)
        .get("/test/protected-perm")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.isPermissionFresh).toBe(true);
    });

    it("4. Stale permissionVersion is detected (isPermissionFresh === false)", async () => {
      const { user, employee } = await createTestUserAndEmployee();
      const [perm] = await createPermissions(["test:sensitive:action"]);
      const role = await createRoleWithPermissions("test_sec_r3", [perm]);
      await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role._id,
        isActive: true,
      });

      const token = generateAccessToken({
        sub: user._id.toString(),
        role: "admin",
        authVersion: user.authVersion,
        permissionVersion: 1,
      });

      await incrementPermissionVersion(user._id); // DB becomes 2

      const res = await request(testApp)
        .get("/test/protected-perm")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.isPermissionFresh).toBe(false);
    });

    it("5. Stale permissionVersion cannot cause an old permission decision to be accepted when revoked in DB", async () => {
      const { user, employee } = await createTestUserAndEmployee();
      const [perm] = await createPermissions(["test:sensitive:action"]);
      const role = await createRoleWithPermissions("test_sec_r4", [perm]);
      const empRole = await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role._id,
        isActive: true,
      });

      const token = generateAccessToken({
        sub: user._id.toString(),
        role: "admin",
        authVersion: 1,
        permissionVersion: 1,
      });

      // Revoke role and increment permissionVersion
      await EmployeeRole.findByIdAndUpdate(empRole._id, { isActive: false });
      await incrementPermissionVersion(user._id);

      const res = await request(testApp)
        .get("/test/protected-perm")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("6. Current permissions are resolved from the database when permission state is stale", async () => {
      const { user, employee } = await createTestUserAndEmployee();
      const [perm] = await createPermissions(["test:sensitive:action"]);

      const token = generateAccessToken({
        sub: user._id.toString(),
        role: "admin",
        authVersion: 1,
        permissionVersion: 1,
      });

      // Directly grant permission and increment version in DB
      await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
      });
      await incrementPermissionVersion(user._id);

      const res = await request(testApp)
        .get("/test/protected-perm")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.isPermissionFresh).toBe(false);
    });

    it("7. Direct restrictions still win after a stale-version refresh", async () => {
      const { user, employee } = await createTestUserAndEmployee();
      const [perm] = await createPermissions(["test:sensitive:action"]);
      const role = await createRoleWithPermissions("test_sec_r5", [perm]);
      await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role._id,
        isActive: true,
      });

      const token = generateAccessToken({
        sub: user._id.toString(),
        role: "admin",
        authVersion: 1,
        permissionVersion: 1,
      });

      // Add direct restriction and increment version
      await EmployeePermissionRestriction.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
      });
      await incrementPermissionVersion(user._id);

      const res = await request(testApp)
        .get("/test/protected-perm")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("8. Suspended employee receives no privileged permissions even with stale token", async () => {
      const { user, employee } = await createTestUserAndEmployee();
      const [perm] = await createPermissions(["test:sensitive:action"]);
      const role = await createRoleWithPermissions("test_sec_r6", [perm]);
      await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role._id,
        isActive: true,
      });

      const token = generateAccessToken({
        sub: user._id.toString(),
        role: "admin",
        authVersion: 1,
        permissionVersion: 1,
      });

      await Employee.findByIdAndUpdate(employee._id, { status: "suspended" });
      await incrementPermissionVersion(user._id);

      const res = await request(testApp)
        .get("/test/protected-perm")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("9. Customer/vendor legacy authorization continues working", async () => {
      const customerUser = await User.create({
        firstName: "Cust",
        lastName: "Legacy",
        email: `cust_${Date.now()}@test-auth-resolver.com`,
        password: "Password123!",
        role: "customer",
        isActive: true,
      });

      const customerToken = generateAccessToken({
        sub: customerUser._id.toString(),
        role: "customer",
      });

      const res = await request(testApp)
        .get("/test/protected-perm")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("10. Existing requireRoles routes remain regression-safe", async () => {
      const adminToken = generateAccessToken({
        sub: new mongoose.Types.ObjectId().toString(),
        role: "admin",
      });

      const res = await request(testApp)
        .get("/test/protected-role")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const customerToken = generateAccessToken({
        sub: new mongoose.Types.ObjectId().toString(),
        role: "customer",
      });

      const resForbidden = await request(testApp)
        .get("/test/protected-role")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(resForbidden.status).toBe(403);
      expect(resForbidden.body.code).toBe("INSUFFICIENT_ROLE");
    });
  });

  describe("12. Phase 1D — Legacy Fallback Correction & Governance Segregation", () => {
    const express = require("express");
    const request = require("supertest");
    const authenticate = require("../src/middlewares/authentication.middleware");
    const {
      requirePermissions,
    } = require("../src/middlewares/authorization.middleware");
    const errorHandler = require("../src/middlewares/error.middleware");
    const { ROLES } = require("../src/constants/auth.constants");

    let testApp;

    beforeAll(() => {
      testApp = express();
      testApp.use(express.json());

      testApp.get(
        "/test/governance-perm",
        authenticate,
        requirePermissions("roles:manage"),
        (req, res) =>
          res.status(200).json({ success: true, user: req.user, auth: req.auth }),
      );

      testApp.use(errorHandler);
    });

    it("1. Legacy admin fallback contains strictly the 37 operational permissions", () => {
      const adminPerms = ROLE_PERMISSIONS[ROLES.ADMIN];
      expect(adminPerms).toHaveLength(37);

      // Verify that every governance permission is strictly absent
      expect(adminPerms).not.toContain(PERMISSIONS.ROLES_MANAGE);
      expect(adminPerms).not.toContain(PERMISSIONS.PERMISSIONS_MANAGE);
      expect(adminPerms).not.toContain(PERMISSIONS.EMPLOYEES_MANAGE);
      expect(adminPerms).not.toContain(PERMISSIONS.WORK_ASSIGNMENTS_MANAGE);
      expect(adminPerms).not.toContain(PERMISSIONS.AUDIT_LOGS_READ);
      expect(adminPerms).not.toContain(PERMISSIONS.ROLES_READ);
      expect(adminPerms).not.toContain(PERMISSIONS.PERMISSIONS_READ);
      expect(adminPerms).not.toContain(PERMISSIONS.EMPLOYEES_READ);
      expect(adminPerms).not.toContain(PERMISSIONS.WORK_ASSIGNMENTS_READ);

      // Verify all 9 governance permissions are excluded
      for (const govPerm of GOVERNANCE_PERMISSIONS) {
        expect(adminPerms).not.toContain(govPerm);
      }
    });

    it("2. Legacy super_admin fallback retains all 46 permissions (operational + governance)", () => {
      const superAdminPerms = ROLE_PERMISSIONS[ROLES.SUPER_ADMIN];
      expect(superAdminPerms).toHaveLength(46);

      // Verify every governance permission is present
      for (const govPerm of GOVERNANCE_PERMISSIONS) {
        expect(superAdminPerms).toContain(govPerm);
      }
    });

    it("3. Legacy admin caller without Employee profile is rejected on governance endpoints", async () => {
      const legacyAdminUser = await User.create({
        firstName: "Legacy",
        lastName: "Admin",
        email: `legacy_admin_${Date.now()}@test-auth-resolver.com`,
        password: "Password123!",
        role: "admin",
        isActive: true,
      });

      const token = generateAccessToken({
        sub: legacyAdminUser._id.toString(),
        role: "admin",
        authVersion: 1,
        permissionVersion: 1,
      });

      const res = await request(testApp)
        .get("/test/governance-perm")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("4. Legacy super_admin caller without Employee profile succeeds on governance endpoints", async () => {
      const legacySuperAdminUser = await User.create({
        firstName: "Legacy",
        lastName: "SuperAdmin",
        email: `legacy_superadmin_${Date.now()}@test-auth-resolver.com`,
        password: "Password123!",
        role: "super_admin",
        isActive: true,
      });

      const token = generateAccessToken({
        sub: legacySuperAdminUser._id.toString(),
        role: "super_admin",
        authVersion: 1,
        permissionVersion: 1,
      });

      const res = await request(testApp)
        .get("/test/governance-perm")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.auth.isPlatformActor).toBe(true);
      expect(res.body.auth.effectivePermissions).toContain("roles:manage");
    });

    it("5. Dynamic seed system_admin role is operational-only and system_super_admin has all permissions", () => {
      const { SYSTEM_ROLES } = require("../src/seeds/rbac.seed");
      const systemAdmin = SYSTEM_ROLES.find((r) => r.slug === "system_admin");
      const systemSuperAdmin = SYSTEM_ROLES.find((r) => r.slug === "system_super_admin");

      expect(systemAdmin).toBeDefined();
      expect(systemAdmin.permissions).toHaveLength(37);
      for (const govPerm of GOVERNANCE_PERMISSIONS) {
        expect(systemAdmin.permissions).not.toContain(govPerm);
      }

      expect(systemSuperAdmin).toBeDefined();
      expect(systemSuperAdmin.permissions).toHaveLength(46);
      for (const govPerm of GOVERNANCE_PERMISSIONS) {
        expect(systemSuperAdmin.permissions).toContain(govPerm);
      }
    });

    it("6. Customer and vendor static permissions remain unchanged", () => {
      expect(ROLE_PERMISSIONS[ROLES.CUSTOMER]).toEqual([
        PERMISSIONS.PRODUCTS_READ,
        PERMISSIONS.ORDERS_READ,
        PERMISSIONS.REVIEWS_READ,
      ]);

      expect(ROLE_PERMISSIONS[ROLES.VENDOR]).toContain(PERMISSIONS.PRODUCTS_READ);
      expect(ROLE_PERMISSIONS[ROLES.VENDOR]).toContain(PERMISSIONS.PRODUCTS_CREATE);
      expect(ROLE_PERMISSIONS[ROLES.VENDOR]).toContain(PERMISSIONS.PRODUCTS_UPDATE);
      expect(ROLE_PERMISSIONS[ROLES.VENDOR]).toContain(PERMISSIONS.INVENTORY_READ);
      expect(ROLE_PERMISSIONS[ROLES.VENDOR]).toContain(PERMISSIONS.INVENTORY_MANAGE);
      expect(ROLE_PERMISSIONS[ROLES.VENDOR]).toContain(PERMISSIONS.ORDERS_READ);
      expect(ROLE_PERMISSIONS[ROLES.VENDOR]).toContain(PERMISSIONS.REVIEWS_READ);
      expect(ROLE_PERMISSIONS[ROLES.VENDOR]).toContain(PERMISSIONS.REVIEWS_MANAGE);
      expect(ROLE_PERMISSIONS[ROLES.VENDOR]).toContain(PERMISSIONS.SHIPMENTS_READ_OWN);
      expect(ROLE_PERMISSIONS[ROLES.VENDOR]).toContain(PERMISSIONS.SHIPMENTS_MANAGE_OWN);
      expect(ROLE_PERMISSIONS[ROLES.VENDOR]).toContain(PERMISSIONS.ANALYTICS_READ_OWN);
    });
  });
});
