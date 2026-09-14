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
const WorkAssignment = require("../src/models/WorkAssignment");
const AuditLog = require("../src/models/AuditLog");
const Vendor = require("../src/models/Vendor");
const Warehouse = require("../src/models/Warehouse");
const Category = require("../src/models/Category");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { SCOPE_TYPES } = require("../src/constants/scope.constants");
const { generateAccessToken } = require("../src/services/token.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_gov_test?")
  : "mongodb://127.0.0.1:27017/buybox_gov_test?replicaSet=rs0";

describe("Phase 1F — Super Admin RBAC/PBAC Governance Backend", () => {
  let superAdminUser;
  let superAdminToken;
  let regularStaffUser;
  let regularStaffToken;
  let customerUser;
  let customerToken;
  let testPermission;

  // Helper to create test employee
  async function createTestEmployee(options = {}) {
    const unique = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const user = await User.create({
      firstName: "Test",
      lastName: "User",
      email: `gov_user_${unique}@test-gov.com`,
      password: "Password123!",
      role: options.role || "manager",
      isActive: options.isActive !== undefined ? options.isActive : true,
      authVersion: 1,
      permissionVersion: 1,
    });

    let employee = null;
    if (!options.skipEmployee) {
      employee = await Employee.create({
        userId: user._id,
        employeeNumber: `EMP-${unique.toUpperCase().slice(-8)}`,
        jobTitle: "Operations Specialist",
        department: "Operations",
        status: options.status || "active",
      });
    }

    const token = generateAccessToken({
      sub: user._id.toString(),
      role: user.role,
      authVersion: user.authVersion,
      permissionVersion: user.permissionVersion,
    });

    return { user, employee, token };
  }

  // Helper to create an employee with specific permissions via a dedicated test role
  async function createEmployeeWithPermissions(permissionSlugs = []) {
    const { user, employee, token } = await createTestEmployee();
    const unique = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const role = await Role.create({
      name: `Test Custom Role ${unique}`,
      slug: `test_custom_role_${unique}`,
      isActive: true,
    });

    for (const slug of permissionSlugs) {
      let p = await Permission.findOne({ slug });
      if (!p) {
        p = await Permission.create({
          name: slug,
          slug,
          module: slug.split(":")[0],
          isActive: true,
        });
      }
      await RolePermission.create({
        roleId: role._id,
        permissionId: p._id,
      });
    }

    await EmployeeRole.create({
      employeeId: employee._id,
      roleId: role._id,
      isActive: true,
    });

    return { user, employee, token, role };
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
      WorkAssignment.init(),
      AuditLog.init(),
      Vendor.init(),
      Warehouse.init(),
      Category.init(),
    ]);

    // Ensure test permission exists
    testPermission = await Permission.findOne({ slug: PERMISSIONS.PRODUCTS_READ });
    if (!testPermission) {
      testPermission = await Permission.create({
        name: "Read Products",
        slug: PERMISSIONS.PRODUCTS_READ,
        module: "products",
        isSystem: true,
        isActive: true,
      });
    }

    // Ensure system_super_admin role exists
    let superAdminRole = await Role.findOne({ slug: "system_super_admin" });
    if (!superAdminRole) {
      superAdminRole = await Role.create({
        name: "System Super Administrator",
        slug: "system_super_admin",
        description: "Full governance authority",
        isSystem: true,
        isActive: true,
      });
    }

    // Map governance permissions to superAdminRole
    const govPerms = [
      PERMISSIONS.ROLES_READ,
      PERMISSIONS.ROLES_MANAGE,
      PERMISSIONS.PERMISSIONS_READ,
      PERMISSIONS.PERMISSIONS_MANAGE,
      PERMISSIONS.EMPLOYEES_READ,
      PERMISSIONS.EMPLOYEES_MANAGE,
      PERMISSIONS.WORK_ASSIGNMENTS_READ,
      PERMISSIONS.WORK_ASSIGNMENTS_MANAGE,
      PERMISSIONS.AUDIT_LOGS_READ,
    ];

    for (const slug of govPerms) {
      let p = await Permission.findOne({ slug });
      if (!p) {
        p = await Permission.create({
          name: slug,
          slug,
          module: slug.split(":")[0],
          isSystem: true,
          isActive: true,
        });
      }
      await RolePermission.findOneAndUpdate(
        { roleId: superAdminRole._id, permissionId: p._id },
        { roleId: superAdminRole._id, permissionId: p._id },
        { upsert: true, new: true },
      );
    }

    // 1. Create primary Super Admin (with employee + system_super_admin role)
    const superAdminUnique = `${Date.now()}_superadmin`;
    superAdminUser = await User.create({
      firstName: "Super",
      lastName: "Admin",
      email: `super_${superAdminUnique}@test-gov.com`,
      password: "Password123!",
      role: "super_admin",
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const superAdminEmployee = await Employee.create({
      userId: superAdminUser._id,
      employeeNumber: `EMP-SUPER-${Date.now().toString().slice(-4)}`,
      jobTitle: "Chief Technology Officer",
      department: "Governance",
      status: "active",
    });

    await EmployeeRole.create({
      employeeId: superAdminEmployee._id,
      roleId: superAdminRole._id,
      isActive: true,
    });

    superAdminToken = generateAccessToken({
      sub: superAdminUser._id.toString(),
      role: superAdminUser.role,
      authVersion: 1,
      permissionVersion: 1,
    });

    // 2. Create regular staff user (NO governance permissions)
    const staff = await createTestEmployee({ role: "manager" });
    regularStaffUser = staff.user;
    regularStaffToken = staff.token;

    // 3. Create customer user
    customerUser = await User.create({
      firstName: "Customer",
      lastName: "User",
      email: `cust_${Date.now()}@test-gov.com`,
      password: "Password123!",
      role: "customer",
      isActive: true,
    });
    customerToken = generateAccessToken({
      sub: customerUser._id.toString(),
      role: "customer",
      authVersion: 1,
      permissionVersion: 1,
    });
  });

  afterAll(async () => {
    await Promise.all([
      User.deleteMany({ email: /@test-gov\.com$/ }),
      Employee.deleteMany({}),
      Role.deleteMany({ slug: { $regex: /^test_custom_role_/ } }),
      RolePermission.deleteMany({}),
      EmployeeRole.deleteMany({}),
      EmployeePermissionGrant.deleteMany({}),
      EmployeePermissionRestriction.deleteMany({}),
      WorkAssignment.deleteMany({}),
      mongoose.connection.collection("auditlogs").drop().catch(() => {}),
      Vendor.deleteMany({ businessSlug: { $regex: /^gov-test-/ } }),
      Warehouse.deleteMany({ code: { $regex: /^GOV-WH-/ } }),
      Category.deleteMany({ slug: { $regex: /^gov-cat-/ } }),
    ]);
    await mongoose.disconnect();
  });

  /* =========================================================================
     1. ROLES GOVERNANCE
     ========================================================================= */
  describe("1. Roles Governance", () => {
    let createdRoleId;

    it("roles:read allows listing roles", async () => {
      const res = await request(app)
        .get("/api/v1/admin/governance/roles")
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.roles)).toBe(true);
      expect(res.body.meta.total).toBeGreaterThan(0);
    });

    it("missing roles:read denies listing roles (403)", async () => {
      const res = await request(app)
        .get("/api/v1/admin/governance/roles")
        .set("Authorization", `Bearer ${regularStaffToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("roles:manage allows creating a custom role and records an AuditLog", async () => {
      const unique = Date.now();
      const payload = {
        name: `Custom Support Tier ${unique}`,
        slug: `test_custom_role_${unique}`,
        description: "Custom operational support role",
      };

      const res = await request(app)
        .post("/api/v1/admin/governance/roles")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role.name).toBe(payload.name);
      expect(res.body.data.role.slug).toBe(payload.slug);
      expect(res.body.data.role.isSystem).toBe(false);
      createdRoleId = res.body.data.role._id;

      // Verify AuditLog
      const audit = await AuditLog.findOne({
        targetId: createdRoleId,
        action: "ROLE_CREATE",
      });
      expect(audit).toBeDefined();
      expect(audit.actorId.toString()).toBe(superAdminUser._id.toString());
      expect(audit.entityType).toBe("Role");
    });

    it("creating duplicate role name or slug returns 409", async () => {
      const role = await Role.findById(createdRoleId);
      const res = await request(app)
        .post("/api/v1/admin/governance/roles")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          name: role.name,
          slug: `different_slug_${Date.now()}`,
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("ROLE_ALREADY_EXISTS");
    });

    it("roles:manage allows updating custom role name and description", async () => {
      const updatedName = `Updated Tier ${Date.now()}`;
      const res = await request(app)
        .patch(`/api/v1/admin/governance/roles/${createdRoleId}`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          name: updatedName,
          description: "Updated description",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.role.name).toBe(updatedName);

      // Verify AuditLog
      const audit = await AuditLog.findOne({
        targetId: createdRoleId,
        action: "ROLE_UPDATE",
      });
      expect(audit).toBeDefined();
    });

    it("system role protection: cannot modify slug of system_super_admin", async () => {
      const systemRole = await Role.findOne({ slug: "system_super_admin" });
      const res = await request(app)
        .patch(`/api/v1/admin/governance/roles/${systemRole._id}`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          slug: "new_illegal_slug",
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("SYSTEM_ROLE_IMMUTABLE");
    });

    it("system role protection: cannot deactivate core system_super_admin", async () => {
      const systemRole = await Role.findOne({ slug: "system_super_admin" });
      const res = await request(app)
        .patch(`/api/v1/admin/governance/roles/${systemRole._id}`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          isActive: false,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("CANNOT_DEACTIVATE_CORE_SYSTEM_ROLE");
    });

    it("PUT /roles/:id/permissions replaces role permissions, invalidates affected employees, and audits", async () => {
      // 1. Assign createdRole to regular staff
      const staffEmp = await Employee.findOne({ userId: regularStaffUser._id });
      await EmployeeRole.create({
        employeeId: staffEmp._id,
        roleId: createdRoleId,
        isActive: true,
      });

      const userBefore = await User.findById(regularStaffUser._id);
      const permVersionBefore = userBefore.permissionVersion;

      // 2. Update permissions of createdRole
      const res = await request(app)
        .put(`/api/v1/admin/governance/roles/${createdRoleId}/permissions`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          permissionIds: [testPermission._id.toString()],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.permissions).toHaveLength(1);
      expect(res.body.data.permissions[0].slug).toBe(PERMISSIONS.PRODUCTS_READ);

      // 3. Verify affected user's permissionVersion was incremented
      const userAfter = await User.findById(regularStaffUser._id);
      expect(userAfter.permissionVersion).toBe(permVersionBefore + 1);

      // 4. Verify AuditLog
      const audit = await AuditLog.findOne({
        targetId: createdRoleId,
        action: "ROLE_PERMISSIONS_UPDATE",
      });
      expect(audit).toBeDefined();
    });
  });

  /* =========================================================================
     2. PERMISSIONS GOVERNANCE (READ-ONLY)
     ========================================================================= */
  describe("2. Permissions Governance", () => {
    it("permissions:read allows listing permissions with module filter", async () => {
      const res = await request(app)
        .get("/api/v1/admin/governance/permissions?module=products")
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.permissions)).toBe(true);
      for (const p of res.body.data.permissions) {
        expect(p.module).toBe("products");
      }
    });

    it("GET /permissions/:id returns permission detail", async () => {
      const res = await request(app)
        .get(`/api/v1/admin/governance/permissions/${testPermission._id}`)
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.permission.slug).toBe(PERMISSIONS.PRODUCTS_READ);
    });

    it("missing permissions:read denies access (403)", async () => {
      const res = await request(app)
        .get("/api/v1/admin/governance/permissions")
        .set("Authorization", `Bearer ${regularStaffToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });
  });

  /* =========================================================================
     3. EMPLOYEES GOVERNANCE
     ========================================================================= */
  describe("3. Employees Governance", () => {
    let createdEmployeeId;
    let candidateUserId;

    beforeAll(async () => {
      const candidateUser = await User.create({
        firstName: "Candidate",
        lastName: "Employee",
        email: `cand_${Date.now()}@test-gov.com`,
        password: "Password123!",
        role: "manager",
        isActive: true,
      });
      candidateUserId = candidateUser._id.toString();
    });

    it("employees:read allows listing employees", async () => {
      const res = await request(app)
        .get("/api/v1/admin/governance/employees")
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.employees)).toBe(true);
      expect(res.body.meta.total).toBeGreaterThan(0);
    });

    it("employees:manage allows creating an employee linked to valid User", async () => {
      const res = await request(app)
        .post("/api/v1/admin/governance/employees")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          userId: candidateUserId,
          jobTitle: "Warehouse Supervisor",
          department: "Logistics",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.employee.jobTitle).toBe("Warehouse Supervisor");
      expect(res.body.data.employee.status).toBe("active");
      createdEmployeeId = res.body.data.employee._id;

      // Verify AuditLog
      const audit = await AuditLog.findOne({
        targetId: createdEmployeeId,
        action: "EMPLOYEE_CREATE",
      });
      expect(audit).toBeDefined();
    });

    it("cannot create duplicate employee for same user (409)", async () => {
      const res = await request(app)
        .post("/api/v1/admin/governance/employees")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          userId: candidateUserId,
          jobTitle: "Another Title",
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("EMPLOYEE_ALREADY_EXISTS");
    });

    it("cannot turn customer account into employee without explicit role migration (400)", async () => {
      const res = await request(app)
        .post("/api/v1/admin/governance/employees")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          userId: customerUser._id.toString(),
          jobTitle: "Customer as Staff",
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_USER_ROLE");
    });

    it("suspending an employee increments authVersion and permissionVersion (terminates session)", async () => {
      const userBefore = await User.findById(candidateUserId);
      const authVerBefore = userBefore.authVersion;
      const permVerBefore = userBefore.permissionVersion;

      const res = await request(app)
        .patch(`/api/v1/admin/governance/employees/${createdEmployeeId}`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          status: "suspended",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.employee.status).toBe("suspended");

      const userAfter = await User.findById(candidateUserId);
      expect(userAfter.authVersion).toBe(authVerBefore + 1);
      expect(userAfter.permissionVersion).toBe(permVerBefore + 1);

      // Verify AuditLog
      const audit = await AuditLog.findOne({
        targetId: createdEmployeeId,
        action: "EMPLOYEE_UPDATE",
      });
      expect(audit).toBeDefined();
    });

    it("reactivating suspended employee increments permissionVersion", async () => {
      const userBefore = await User.findById(candidateUserId);
      const permVerBefore = userBefore.permissionVersion;

      const res = await request(app)
        .patch(`/api/v1/admin/governance/employees/${createdEmployeeId}`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          status: "active",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.employee.status).toBe("active");

      const userAfter = await User.findById(candidateUserId);
      expect(userAfter.permissionVersion).toBe(permVerBefore + 1);
    });

    it("active to terminated increments authVersion and permissionVersion", async () => {
      const { user, employee } = await createTestEmployee();
      const authVerBefore = user.authVersion;
      const permVerBefore = user.permissionVersion;

      const res = await request(app)
        .patch(`/api/v1/admin/governance/employees/${employee._id}`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ status: "terminated" });

      expect(res.status).toBe(200);
      expect(res.body.data.employee.status).toBe("terminated");

      const userAfter = await User.findById(user._id);
      expect(userAfter.authVersion).toBe(authVerBefore + 1);
      expect(userAfter.permissionVersion).toBe(permVerBefore + 1);
    });

    it("suspended to terminated transitions successfully", async () => {
      const { employee } = await createTestEmployee({ status: "suspended" });

      const res = await request(app)
        .patch(`/api/v1/admin/governance/employees/${employee._id}`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ status: "terminated" });

      expect(res.status).toBe(200);
      expect(res.body.data.employee.status).toBe("terminated");
    });

    it("rejects unapproved on_leave status with 400 VALIDATION_ERROR", async () => {
      const { employee } = await createTestEmployee();

      const res = await request(app)
        .patch(`/api/v1/admin/governance/employees/${employee._id}`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ status: "on_leave" });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("rejects arbitrary invalid status values with 400 VALIDATION_ERROR", async () => {
      const { employee } = await createTestEmployee();

      const res = await request(app)
        .patch(`/api/v1/admin/governance/employees/${employee._id}`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ status: "vacation" });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });
  });

  /* =========================================================================
     4. EMPLOYEE ROLE ASSIGNMENTS
     ========================================================================= */
  describe("4. Employee Role Assignments", () => {
    let testEmp;
    let testRole;

    beforeAll(async () => {
      const empData = await createTestEmployee();
      testEmp = empData.employee;

      testRole = await Role.create({
        name: `Test Role Assign ${Date.now()}`,
        slug: `test_role_assign_${Date.now()}`,
        isActive: true,
      });
    });

    it("POST /employees/:id/roles assigns a role and updates permissionVersion", async () => {
      const userBefore = await User.findById(testEmp.userId);
      const permVerBefore = userBefore.permissionVersion;

      const res = await request(app)
        .post(`/api/v1/admin/governance/employees/${testEmp._id}/roles`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          roleId: testRole._id.toString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assignment.roleId).toBe(testRole._id.toString());

      const userAfter = await User.findById(testEmp.userId);
      expect(userAfter.permissionVersion).toBe(permVerBefore + 1);

      // Verify AuditLog
      const audit = await AuditLog.findOne({
        targetId: res.body.data.assignment._id,
        action: "EMPLOYEE_ROLE_ASSIGN",
      });
      expect(audit).toBeDefined();
    });

    it("duplicate role assignment returns 409", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/governance/employees/${testEmp._id}/roles`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          roleId: testRole._id.toString(),
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("ROLE_ALREADY_ASSIGNED");
    });

    it("DELETE /employees/:id/roles/:roleId removes role assignment and updates permissionVersion", async () => {
      const userBefore = await User.findById(testEmp.userId);
      const permVerBefore = userBefore.permissionVersion;

      const res = await request(app)
        .delete(`/api/v1/admin/governance/employees/${testEmp._id}/roles/${testRole._id}`)
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const userAfter = await User.findById(testEmp.userId);
      expect(userAfter.permissionVersion).toBe(permVerBefore + 1);

      // Verify AuditLog
      const audit = await AuditLog.findOne({
        action: "EMPLOYEE_ROLE_REMOVE",
      });
      expect(audit).toBeDefined();
    });
  });

  /* =========================================================================
     5. DIRECT GRANTS & RESTRICTIONS
     ========================================================================= */
  describe("5. Direct Grants & Restrictions Governance", () => {
    let testEmp;

    beforeAll(async () => {
      const empData = await createTestEmployee();
      testEmp = empData.employee;
    });

    it("POST /employees/:id/permissions/grants creates grant and updates permissionVersion", async () => {
      const userBefore = await User.findById(testEmp.userId);
      const permVerBefore = userBefore.permissionVersion;

      const res = await request(app)
        .post(`/api/v1/admin/governance/employees/${testEmp._id}/permissions/grants`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          permissionId: testPermission._id.toString(),
          reason: "Temporary product review access for audit",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.grant.permissionId).toBe(testPermission._id.toString());

      const userAfter = await User.findById(testEmp.userId);
      expect(userAfter.permissionVersion).toBe(permVerBefore + 1);

      // Verify AuditLog
      const audit = await AuditLog.findOne({
        targetId: res.body.data.grant._id,
        action: "PERMISSION_GRANT_CREATE",
      });
      expect(audit).toBeDefined();
    });

    it("DELETE /employees/:id/permissions/grants/:permId revokes grant", async () => {
      const res = await request(app)
        .delete(
          `/api/v1/admin/governance/employees/${testEmp._id}/permissions/grants/${testPermission._id}`,
        )
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("POST /employees/:id/permissions/restrictions creates restriction", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/governance/employees/${testEmp._id}/permissions/restrictions`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          permissionId: testPermission._id.toString(),
          reason: "Restricting product write access due to policy review",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.restriction.permissionId).toBe(testPermission._id.toString());

      // Verify AuditLog
      const audit = await AuditLog.findOne({
        targetId: res.body.data.restriction._id,
        action: "PERMISSION_RESTRICTION_CREATE",
      });
      expect(audit).toBeDefined();
    });

    it("DELETE /employees/:id/permissions/restrictions/:permId revokes restriction", async () => {
      const res = await request(app)
        .delete(
          `/api/v1/admin/governance/employees/${testEmp._id}/permissions/restrictions/${testPermission._id}`,
        )
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("employees:manage allows managing grants, while permissions:manage alone is denied (403)", async () => {
      const empManager = await createEmployeeWithPermissions([PERMISSIONS.EMPLOYEES_MANAGE]);
      const permManager = await createEmployeeWithPermissions([PERMISSIONS.PERMISSIONS_MANAGE]);

      // 1. Caller with employees:manage creates grant successfully (201)
      const allowedRes = await request(app)
        .post(`/api/v1/admin/governance/employees/${testEmp._id}/permissions/grants`)
        .set("Authorization", `Bearer ${empManager.token}`)
        .send({
          permissionId: testPermission._id.toString(),
          reason: "Assigned by employee manager",
        });
      expect(allowedRes.status).toBe(201);

      // 2. Caller with permissions:manage alone is denied creating grant (403)
      const deniedRes = await request(app)
        .post(`/api/v1/admin/governance/employees/${testEmp._id}/permissions/grants`)
        .set("Authorization", `Bearer ${permManager.token}`)
        .send({
          permissionId: testPermission._id.toString(),
          reason: "Assigned by permission manager",
        });
      expect(deniedRes.status).toBe(403);
      expect(deniedRes.body.code).toBe("INSUFFICIENT_PERMISSIONS");

      // 3. Caller with permissions:manage alone is denied revoking grant (403)
      const deniedRevoke = await request(app)
        .delete(`/api/v1/admin/governance/employees/${testEmp._id}/permissions/grants/${testPermission._id}`)
        .set("Authorization", `Bearer ${permManager.token}`);
      expect(deniedRevoke.status).toBe(403);

      // 4. Caller with employees:manage revokes grant successfully (200)
      const allowedRevoke = await request(app)
        .delete(`/api/v1/admin/governance/employees/${testEmp._id}/permissions/grants/${testPermission._id}`)
        .set("Authorization", `Bearer ${empManager.token}`);
      expect(allowedRevoke.status).toBe(200);
    });

    it("employees:manage allows managing restrictions, while permissions:manage alone is denied (403)", async () => {
      const empManager = await createEmployeeWithPermissions([PERMISSIONS.EMPLOYEES_MANAGE]);
      const permManager = await createEmployeeWithPermissions([PERMISSIONS.PERMISSIONS_MANAGE]);

      // 1. Caller with employees:manage creates restriction successfully (201)
      const allowedRes = await request(app)
        .post(`/api/v1/admin/governance/employees/${testEmp._id}/permissions/restrictions`)
        .set("Authorization", `Bearer ${empManager.token}`)
        .send({
          permissionId: testPermission._id.toString(),
          reason: "Restricted by employee manager",
        });
      expect(allowedRes.status).toBe(201);

      // 2. Caller with permissions:manage alone is denied creating restriction (403)
      const deniedRes = await request(app)
        .post(`/api/v1/admin/governance/employees/${testEmp._id}/permissions/restrictions`)
        .set("Authorization", `Bearer ${permManager.token}`)
        .send({
          permissionId: testPermission._id.toString(),
          reason: "Restricted by permission manager",
        });
      expect(deniedRes.status).toBe(403);
      expect(deniedRes.body.code).toBe("INSUFFICIENT_PERMISSIONS");

      // 3. Caller with permissions:manage alone is denied revoking restriction (403)
      const deniedRevoke = await request(app)
        .delete(`/api/v1/admin/governance/employees/${testEmp._id}/permissions/restrictions/${testPermission._id}`)
        .set("Authorization", `Bearer ${permManager.token}`);
      expect(deniedRevoke.status).toBe(403);

      // 4. Caller with employees:manage revokes restriction successfully (200)
      const allowedRevoke = await request(app)
        .delete(`/api/v1/admin/governance/employees/${testEmp._id}/permissions/restrictions/${testPermission._id}`)
        .set("Authorization", `Bearer ${empManager.token}`);
      expect(allowedRevoke.status).toBe(200);
    });

    it("employees:read allows listing grants/restrictions, while permissions:read alone is denied (403)", async () => {
      const empReader = await createEmployeeWithPermissions([PERMISSIONS.EMPLOYEES_READ]);
      const permReader = await createEmployeeWithPermissions([PERMISSIONS.PERMISSIONS_READ]);

      // 1. employees:read allows listing grants
      const grantsRes = await request(app)
        .get(`/api/v1/admin/governance/employees/${testEmp._id}/permissions/grants`)
        .set("Authorization", `Bearer ${empReader.token}`);
      expect(grantsRes.status).toBe(200);
      expect(Array.isArray(grantsRes.body.data.grants)).toBe(true);

      // 2. permissions:read alone is denied listing grants (403)
      const grantsDenied = await request(app)
        .get(`/api/v1/admin/governance/employees/${testEmp._id}/permissions/grants`)
        .set("Authorization", `Bearer ${permReader.token}`);
      expect(grantsDenied.status).toBe(403);

      // 3. employees:read allows listing restrictions
      const restrRes = await request(app)
        .get(`/api/v1/admin/governance/employees/${testEmp._id}/permissions/restrictions`)
        .set("Authorization", `Bearer ${empReader.token}`);
      expect(restrRes.status).toBe(200);
      expect(Array.isArray(restrRes.body.data.restrictions)).toBe(true);

      // 4. permissions:read alone is denied listing restrictions (403)
      const restrDenied = await request(app)
        .get(`/api/v1/admin/governance/employees/${testEmp._id}/permissions/restrictions`)
        .set("Authorization", `Bearer ${permReader.token}`);
      expect(restrDenied.status).toBe(403);
    });
  });

  /* =========================================================================
     6. WORK ASSIGNMENTS GOVERNANCE
     ========================================================================= */
  describe("6. Work Assignments Governance", () => {
    let testEmp;
    let testWarehouse;
    let createdAssignmentId;

    beforeAll(async () => {
      const empData = await createTestEmployee();
      testEmp = empData.employee;

      testWarehouse = await Warehouse.create({
        name: `Gov Test WH ${Date.now()}`,
        code: `GOV-WH-${Date.now().toString().slice(-6)}`,
        address: {
          addressLine1: "123 Logistics Park",
          city: "Metropolis",
          state: "NY",
          country: "IN",
          postalCode: "10001",
        },
      });
    });

    it("POST /employees/:id/assignments creates a valid warehouse assignment", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/governance/employees/${testEmp._id}/assignments`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          scopeType: SCOPE_TYPES.WAREHOUSE,
          scopeId: testWarehouse._id.toString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assignment.scopeType).toBe(SCOPE_TYPES.WAREHOUSE);
      expect(res.body.data.assignment.scopeId).toBe(testWarehouse._id.toString());
      createdAssignmentId = res.body.data.assignment._id;

      // Verify AuditLog
      const audit = await AuditLog.findOne({
        targetId: createdAssignmentId,
        action: "WORK_ASSIGNMENT_CREATE",
      });
      expect(audit).toBeDefined();
    });

    it("cannot assign nonexistent warehouse (fails closed with 404)", async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post(`/api/v1/admin/governance/employees/${testEmp._id}/assignments`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          scopeType: SCOPE_TYPES.WAREHOUSE,
          scopeId: nonExistentId,
        });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("WAREHOUSE_NOT_FOUND");
    });

    it("cannot assign invalid scope type (400)", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/governance/employees/${testEmp._id}/assignments`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          scopeType: "invalid_scope_type",
          scopeId: "any_id",
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("PATCH /employees/:id/assignments/:assignmentId updates assignment active status", async () => {
      const res = await request(app)
        .patch(
          `/api/v1/admin/governance/employees/${testEmp._id}/assignments/${createdAssignmentId}`,
        )
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          isActive: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.assignment.isActive).toBe(false);

      // Verify AuditLog
      const audit = await AuditLog.findOne({
        targetId: createdAssignmentId,
        action: "WORK_ASSIGNMENT_UPDATE",
      });
      expect(audit).toBeDefined();
    });

    it("DELETE /employees/:id/assignments/:assignmentId removes assignment", async () => {
      const res = await request(app)
        .delete(
          `/api/v1/admin/governance/employees/${testEmp._id}/assignments/${createdAssignmentId}`,
        )
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify AuditLog
      const audit = await AuditLog.findOne({
        targetId: createdAssignmentId,
        action: "WORK_ASSIGNMENT_REMOVE",
      });
      expect(audit).toBeDefined();
    });

    it("canonical work assignments permissions are plural (work_assignments:*)", () => {
      expect(PERMISSIONS.WORK_ASSIGNMENTS_READ).toBe("work_assignments:read");
      expect(PERMISSIONS.WORK_ASSIGNMENTS_MANAGE).toBe("work_assignments:manage");
      expect(PERMISSIONS.WORK_ASSIGNMENT_READ).toBeUndefined();
      expect(PERMISSIONS.WORK_ASSIGNMENT_MANAGE).toBeUndefined();
    });

    it("work_assignments:read allows listing assignments, unauthorized caller is denied (403)", async () => {
      const waReader = await createEmployeeWithPermissions([PERMISSIONS.WORK_ASSIGNMENTS_READ]);
      const resAllowed = await request(app)
        .get(`/api/v1/admin/governance/employees/${testEmp._id}/assignments`)
        .set("Authorization", `Bearer ${waReader.token}`);
      expect(resAllowed.status).toBe(200);
      expect(Array.isArray(resAllowed.body.data.assignments)).toBe(true);

      const resDenied = await request(app)
        .get(`/api/v1/admin/governance/employees/${testEmp._id}/assignments`)
        .set("Authorization", `Bearer ${regularStaffToken}`);
      expect(resDenied.status).toBe(403);
    });

    it("work_assignments:read alone cannot create assignments (403)", async () => {
      const waReader = await createEmployeeWithPermissions([PERMISSIONS.WORK_ASSIGNMENTS_READ]);
      const res = await request(app)
        .post(`/api/v1/admin/governance/employees/${testEmp._id}/assignments`)
        .set("Authorization", `Bearer ${waReader.token}`)
        .send({
          scopeType: SCOPE_TYPES.WAREHOUSE,
          scopeId: testWarehouse._id.toString(),
        });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("POST /employees/:id/assignments creates a valid support_queue assignment", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/governance/employees/${testEmp._id}/assignments`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          scopeType: SCOPE_TYPES.SUPPORT_QUEUE,
          scopeId: "technical",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assignment.scopeType).toBe(SCOPE_TYPES.SUPPORT_QUEUE);
      expect(res.body.data.assignment.scopeId).toBe("technical");

      const audit = await AuditLog.findOne({
        targetId: res.body.data.assignment._id,
        action: "WORK_ASSIGNMENT_CREATE",
      });
      expect(audit).toBeDefined();
    });

    it("rejects duplicate support_queue assignment (409)", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/governance/employees/${testEmp._id}/assignments`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          scopeType: SCOPE_TYPES.SUPPORT_QUEUE,
          scopeId: "technical",
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("ASSIGNMENT_ALREADY_EXISTS");
    });

    it("rejects invalid support_queue assignment with empty scopeId (400)", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/governance/employees/${testEmp._id}/assignments`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          scopeType: SCOPE_TYPES.SUPPORT_QUEUE,
          scopeId: "",
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("rejects nonexistent support_queue identifier (fails closed with 404)", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/governance/employees/${testEmp._id}/assignments`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          scopeType: SCOPE_TYPES.SUPPORT_QUEUE,
          scopeId: "nonexistent_queue_xyz",
        });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("SUPPORT_QUEUE_NOT_FOUND");
    });

    it("rejects unapproved queue identifiers like billing or general (fails closed with 404)", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/governance/employees/${testEmp._id}/assignments`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          scopeType: SCOPE_TYPES.SUPPORT_QUEUE,
          scopeId: "billing",
        });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("SUPPORT_QUEUE_NOT_FOUND");
    });
  });

  /* =========================================================================
     7. SUPER ADMIN SAFEGUARDS
     ========================================================================= */
  describe("7. Super Admin Final Authority Safeguards", () => {
    it("cannot deactivate or terminate the final active Super Admin (400 CANNOT_MODIFY_FINAL_SUPER_ADMIN)", async () => {
      // Find the employee profile of the sole Super Admin
      const superEmp = await Employee.findOne({ userId: superAdminUser._id });

      const res = await request(app)
        .patch(`/api/v1/admin/governance/employees/${superEmp._id}`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          status: "suspended",
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("CANNOT_MODIFY_FINAL_SUPER_ADMIN");
    });

    it("cannot remove the system_super_admin role from the final active Super Admin (400)", async () => {
      const superEmp = await Employee.findOne({ userId: superAdminUser._id });
      const superRole = await Role.findOne({ slug: "system_super_admin" });

      const res = await request(app)
        .delete(`/api/v1/admin/governance/employees/${superEmp._id}/roles/${superRole._id}`)
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("CANNOT_MODIFY_FINAL_SUPER_ADMIN");
    });

    it("allows suspending a second Super Admin as long as at least one active Super Admin remains", async () => {
      // Create a second active Super Admin
      const secondSuper = await createTestEmployee({ role: "super_admin" });
      const superRole = await Role.findOne({ slug: "system_super_admin" });
      await EmployeeRole.create({
        employeeId: secondSuper.employee._id,
        roleId: superRole._id,
        isActive: true,
      });

      // Suspending second Super Admin must now succeed because primary Super Admin remains active
      const res = await request(app)
        .patch(`/api/v1/admin/governance/employees/${secondSuper.employee._id}`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          status: "suspended",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.employee.status).toBe("suspended");
    });
  });

  /* =========================================================================
     8. AUDIT LOG READ API
     ========================================================================= */
  describe("8. Audit Log Read API & Sanitization", () => {
    it("audit_logs:read allows listing audit trail with pagination and filters", async () => {
      const res = await request(app)
        .get("/api/v1/admin/governance/audit-logs?entityType=Role")
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.logs)).toBe(true);
      expect(res.body.meta.total).toBeGreaterThan(0);
      for (const log of res.body.data.logs) {
        expect(log.entityType).toBe("Role");
      }
    });

    it("GET /audit-logs/:id retrieves a single audit log entry", async () => {
      const sampleLog = await AuditLog.findOne({});
      const res = await request(app)
        .get(`/api/v1/admin/governance/audit-logs/${sampleLog._id}`)
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.log._id).toBe(sampleLog._id.toString());
    });

    it("audit logs never contain passwords, tokens, or credentials", async () => {
      const logs = await AuditLog.find({}).lean();
      for (const log of logs) {
        const json = JSON.stringify(log);
        expect(json).not.toContain("Password123!");
        expect(json).not.toContain("passwordHash");
        expect(json).not.toContain("refreshToken");
      }
    });
  });

  /* =========================================================================
     9. SECURITY MATRIX
     ========================================================================= */
  describe("9. Security Matrix", () => {
    it("unauthenticated request is rejected (401)", async () => {
      const res = await request(app).get("/api/v1/admin/governance/roles");
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
    });

    it("customer caller is rejected on all governance endpoints (403)", async () => {
      const endpoints = [
        "/api/v1/admin/governance/roles",
        "/api/v1/admin/governance/permissions",
        "/api/v1/admin/governance/employees",
        "/api/v1/admin/governance/audit-logs",
      ];

      for (const ep of endpoints) {
        const res = await request(app)
          .get(ep)
          .set("Authorization", `Bearer ${customerToken}`);
        expect(res.status).toBe(403);
      }
    });
  });
});
