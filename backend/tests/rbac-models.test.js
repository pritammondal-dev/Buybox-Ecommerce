const mongoose = require("mongoose");
const Role = require("../src/models/Role");
const Permission = require("../src/models/Permission");
const RolePermission = require("../src/models/RolePermission");
const Employee = require("../src/models/Employee");
const EmployeeRole = require("../src/models/EmployeeRole");
const EmployeePermissionGrant = require("../src/models/EmployeePermissionGrant");
const EmployeePermissionRestriction = require("../src/models/EmployeePermissionRestriction");
const WorkAssignment = require("../src/models/WorkAssignment");
const AuditLog = require("../src/models/AuditLog");
const User = require("../src/models/User");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { seedRbac, PERMISSION_DEFINITIONS, SYSTEM_ROLES } = require("../src/seeds/rbac.seed");
const {
  migrateEmployees,
  generateDeterministicEmployeeNumber,
} = require("../src/seeds/employee-migration");

const TEST_MONGODB_URI =
  process.env.MONGODB_URI
    ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_rbac_test?")
    : "mongodb://127.0.0.1:27017/buybox_rbac_test?replicaSet=rs0";

describe("Phase 1B.1 — Dynamic RBAC/PBAC Foundation", () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI, { autoIndex: true });
    }
    // Ensure all indexes are built
    await Promise.all([
      Role.init(),
      Permission.init(),
      RolePermission.init(),
      Employee.init(),
      EmployeeRole.init(),
      EmployeePermissionGrant.init(),
      EmployeePermissionRestriction.init(),
      WorkAssignment.init(),
      AuditLog.init(),
      User.init(),
    ]);
  });

  afterAll(async () => {
    // Clean up test collections
    await Promise.all([
      Role.deleteMany({}),
      Permission.deleteMany({}),
      RolePermission.deleteMany({}),
      Employee.deleteMany({}),
      EmployeeRole.deleteMany({}),
      EmployeePermissionGrant.deleteMany({}),
      EmployeePermissionRestriction.deleteMany({}),
      WorkAssignment.deleteMany({}),
      // AuditLog has pre hooks blocking deleteMany, use raw collection drop
      mongoose.connection.collection("auditlogs").drop().catch(() => {}),
      User.deleteMany({ email: /@test-rbac\.com$/ }),
    ]);
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await Promise.all([
      Role.deleteMany({}),
      Permission.deleteMany({}),
      RolePermission.deleteMany({}),
      Employee.deleteMany({}),
      EmployeeRole.deleteMany({}),
      EmployeePermissionGrant.deleteMany({}),
      EmployeePermissionRestriction.deleteMany({}),
      WorkAssignment.deleteMany({}),
      mongoose.connection.collection("auditlogs").deleteMany({}).catch(() => {}),
      User.deleteMany({ email: /@test-rbac\.com$/ }),
    ]);
  });

  describe("1. Role Model", () => {
    it("creates a valid role and enforces unique slug and name", async () => {
      const role = await Role.create({
        name: "Catalog Editor",
        slug: "catalog_editor",
        description: "Can manage product catalog",
        isSystem: false,
        isActive: true,
      });

      expect(role._id).toBeDefined();
      expect(role.slug).toBe("catalog_editor");
      expect(role.isActive).toBe(true);
      expect(role.isSystem).toBe(false);

      // Duplicate slug rejection
      await expect(
        Role.create({
          name: "Different Name",
          slug: "catalog_editor",
        })
      ).rejects.toThrow();

      // Duplicate name rejection
      await expect(
        Role.create({
          name: "Catalog Editor",
          slug: "different_slug",
        })
      ).rejects.toThrow();
    });
  });

  describe("2. Permission Model", () => {
    it("creates a valid permission and rejects duplicate slug", async () => {
      const perm = await Permission.create({
        name: "Read Catalog",
        slug: "catalog:read",
        module: "catalog",
        description: "Read catalog items",
      });

      expect(perm._id).toBeDefined();
      expect(perm.slug).toBe("catalog:read");
      expect(perm.module).toBe("catalog");
      expect(perm.isSystem).toBe(true);

      // Duplicate slug rejection
      await expect(
        Permission.create({
          name: "Another Name",
          slug: "catalog:read",
          module: "catalog",
        })
      ).rejects.toThrow();
    });
  });

  describe("3. RolePermission Model", () => {
    it("creates role-permission mapping and rejects duplicate mappings", async () => {
      const role = await Role.create({
        name: "Support Staff",
        slug: "support_staff",
      });
      const perm = await Permission.create({
        name: "Tickets Read",
        slug: "tickets:read",
        module: "tickets",
      });

      const mapping = await RolePermission.create({
        roleId: role._id,
        permissionId: perm._id,
      });

      expect(mapping._id).toBeDefined();
      expect(mapping.roleId.toString()).toBe(role._id.toString());
      expect(mapping.permissionId.toString()).toBe(perm._id.toString());

      // Duplicate mapping rejection
      await expect(
        RolePermission.create({
          roleId: role._id,
          permissionId: perm._id,
        })
      ).rejects.toThrow();
    });
  });

  describe("4. Employee Model", () => {
    it("creates an employee linked to a User, enforcing unique userId and employeeNumber", async () => {
      const user = await User.create({
        email: "staff1@test-rbac.com",
        password: "hashedpassword123",
        firstName: "Staff",
        lastName: "One",
        role: "support",
      });

      const employee = await Employee.create({
        userId: user._id,
        employeeNumber: "EMP-001001",
        department: "Support",
        jobTitle: "Tier 1 Agent",
        status: "active",
      });

      expect(employee._id).toBeDefined();
      expect(employee.userId.toString()).toBe(user._id.toString());
      expect(employee.employeeNumber).toBe("EMP-001001");
      expect(employee.status).toBe("active");

      // Rejects duplicate userId
      await expect(
        Employee.create({
          userId: user._id,
          employeeNumber: "EMP-001002",
        })
      ).rejects.toThrow();

      // Rejects duplicate employeeNumber
      const user2 = await User.create({
        email: "staff2@test-rbac.com",
        password: "hashedpassword123",
        firstName: "Staff",
        lastName: "Two",
        role: "support",
      });

      await expect(
        Employee.create({
          userId: user2._id,
          employeeNumber: "EMP-001001",
        })
      ).rejects.toThrow();
    });

    it("rejects invalid status enum", async () => {
      const user = await User.create({
        email: "invalid-status@test-rbac.com",
        password: "hashedpassword123",
        firstName: "Test",
        lastName: "User",
        role: "support",
      });

      await expect(
        Employee.create({
          userId: user._id,
          employeeNumber: "EMP-999999",
          status: "not_a_status",
        })
      ).rejects.toThrow();
    });
  });

  describe("5. EmployeeRole Model", () => {
    it("assigns a role to an employee and rejects duplicate assignment", async () => {
      const user = await User.create({
        email: "emp-role@test-rbac.com",
        password: "hashedpassword123",
        firstName: "Role",
        lastName: "Tester",
        role: "manager",
      });
      const employee = await Employee.create({
        userId: user._id,
        employeeNumber: "EMP-002001",
      });
      const role = await Role.create({
        name: "Warehouse Lead",
        slug: "warehouse_lead",
      });

      const assignment = await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role._id,
      });

      expect(assignment._id).toBeDefined();
      expect(assignment.isActive).toBe(true);

      // Duplicate assignment rejection
      await expect(
        EmployeeRole.create({
          employeeId: employee._id,
          roleId: role._id,
        })
      ).rejects.toThrow();
    });
  });

  describe("6. EmployeePermissionGrant & Restriction Models", () => {
    it("creates additive grant and rejects duplicate grant", async () => {
      const user = await User.create({
        email: "grant@test-rbac.com",
        password: "hashedpassword123",
        firstName: "Grant",
        lastName: "User",
        role: "support",
      });
      const employee = await Employee.create({
        userId: user._id,
        employeeNumber: "EMP-003001",
      });
      const perm = await Permission.create({
        name: "Refund Override",
        slug: "orders:refund_special",
        module: "orders",
      });

      const grant = await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: perm._id,
        reason: "Temporary weekend duty",
      });

      expect(grant._id).toBeDefined();
      expect(grant.reason).toBe("Temporary weekend duty");

      // Duplicate grant rejection
      await expect(
        EmployeePermissionGrant.create({
          employeeId: employee._id,
          permissionId: perm._id,
        })
      ).rejects.toThrow();
    });

    it("creates subtractive restriction and rejects duplicate restriction", async () => {
      const user = await User.create({
        email: "restrict@test-rbac.com",
        password: "hashedpassword123",
        firstName: "Restrict",
        lastName: "User",
        role: "manager",
      });
      const employee = await Employee.create({
        userId: user._id,
        employeeNumber: "EMP-004001",
      });
      const perm = await Permission.create({
        name: "Delete Products",
        slug: "products:delete_restricted",
        module: "products",
      });

      const restriction = await EmployeePermissionRestriction.create({
        employeeId: employee._id,
        permissionId: perm._id,
        reason: "Restricted during probation",
      });

      expect(restriction._id).toBeDefined();
      expect(restriction.reason).toBe("Restricted during probation");

      // Duplicate restriction rejection
      await expect(
        EmployeePermissionRestriction.create({
          employeeId: employee._id,
          permissionId: perm._id,
        })
      ).rejects.toThrow();
    });
  });

  describe("7. WorkAssignment Model", () => {
    it("creates valid scope assignments and rejects invalid scopeType", async () => {
      const user = await User.create({
        email: "scope@test-rbac.com",
        password: "hashedpassword123",
        firstName: "Scope",
        lastName: "User",
        role: "support",
      });
      const employee = await Employee.create({
        userId: user._id,
        employeeNumber: "EMP-005001",
      });

      const assignment = await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: "support_queue",
        scopeId: "shipping_issues",
      });

      expect(assignment._id).toBeDefined();
      expect(assignment.scopeType).toBe("support_queue");

      // Duplicate scope assignment rejection
      await expect(
        WorkAssignment.create({
          employeeId: employee._id,
          scopeType: "support_queue",
          scopeId: "shipping_issues",
        })
      ).rejects.toThrow();

      // Invalid scopeType rejection
      await expect(
        WorkAssignment.create({
          employeeId: employee._id,
          scopeType: "invalid_scope_type",
          scopeId: "xyz",
        })
      ).rejects.toThrow();
    });
  });

  describe("8. AuditLog Model (Append-Only Enforcement)", () => {
    it("creates audit log record with actor, action, and states", async () => {
      const actor = await User.create({
        email: "superadmin-audit@test-rbac.com",
        password: "hashedpassword123",
        firstName: "Super",
        lastName: "Admin",
        role: "super_admin",
      });

      const auditRecord = await AuditLog.create({
        actorId: actor._id,
        action: "role_assigned",
        entityType: "EmployeeRole",
        beforeState: null,
        afterState: { role: "system_admin" },
        ipAddress: "127.0.0.1",
        userAgent: "Mozilla/5.0",
      });

      expect(auditRecord._id).toBeDefined();
      expect(auditRecord.action).toBe("role_assigned");
      expect(auditRecord.createdAt).toBeDefined();
    });

    it("rejects document and query updates (append-only protection)", async () => {
      const actor = await User.create({
        email: "actor2-audit@test-rbac.com",
        password: "hashedpassword123",
        firstName: "Super",
        lastName: "Admin",
        role: "super_admin",
      });

      const auditRecord = await AuditLog.create({
        actorId: actor._id,
        action: "employee_suspended",
        entityType: "Employee",
      });

      // Attempt document save update
      auditRecord.action = "tampered_action";
      await expect(auditRecord.save()).rejects.toThrow(
        /AuditLog records are append-only and cannot be updated/
      );

      // Attempt query update
      await expect(
        AuditLog.updateOne(
          { _id: auditRecord._id },
          { action: "tampered_via_query" }
        )
      ).rejects.toThrow(/AuditLog records are append-only and cannot be updated/);
    });

    it("rejects delete operations (immutability protection)", async () => {
      const actor = await User.create({
        email: "actor3-audit@test-rbac.com",
        password: "hashedpassword123",
        firstName: "Super",
        lastName: "Admin",
        role: "super_admin",
      });

      const auditRecord = await AuditLog.create({
        actorId: actor._id,
        action: "permission_granted",
        entityType: "EmployeePermissionGrant",
      });

      // Attempt delete query
      await expect(
        AuditLog.deleteOne({ _id: auditRecord._id })
      ).rejects.toThrow(/AuditLog records are append-only and cannot be deleted/);
    });
  });

  describe("9. RBAC Seeding Idempotency", () => {
    it("seeds all 46 permissions and 6 system roles idempotently", async () => {
      // First seed run
      const result1 = await seedRbac();
      expect(result1.permissionsSeeded).toBe(46);
      expect(result1.rolesSeeded).toBe(6);
      expect(result1.mappingsSeeded).toBeGreaterThan(50);

      const permCount1 = await Permission.countDocuments();
      const roleCount1 = await Role.countDocuments();
      const mappingCount1 = await RolePermission.countDocuments();

      expect(permCount1).toBe(46);
      expect(roleCount1).toBe(6);

      // Verify system_admin does NOT have RBAC governance permissions
      const adminRole = await Role.findOne({ slug: "system_admin" });
      const rbacPerm = await Permission.findOne({ slug: PERMISSIONS.ROLES_MANAGE });
      const adminRbacMapping = await RolePermission.findOne({
        roleId: adminRole._id,
        permissionId: rbacPerm._id,
      });
      expect(adminRbacMapping).toBeNull();

      // Verify system_super_admin DOES have RBAC governance permissions
      const superAdminRole = await Role.findOne({ slug: "system_super_admin" });
      const superAdminRbacMapping = await RolePermission.findOne({
        roleId: superAdminRole._id,
        permissionId: rbacPerm._id,
      });
      expect(superAdminRbacMapping).not.toBeNull();

      // Second seed run (verify complete idempotency)
      const result2 = await seedRbac();
      expect(result2.permissionsSeeded).toBe(46);
      expect(result2.rolesSeeded).toBe(6);

      const permCount2 = await Permission.countDocuments();
      const roleCount2 = await Role.countDocuments();
      const mappingCount2 = await RolePermission.countDocuments();

      expect(permCount2).toBe(46);
      expect(roleCount2).toBe(6);
      expect(mappingCount2).toBe(mappingCount1);
    });
  });

  describe("10. Employee Migration Idempotency", () => {
    it("migrates existing privileged users without affecting customers, vendors, or User.role", async () => {
      // Ensure system roles are seeded first
      await seedRbac();

      // Create test users across different roles
      const supportUser = await User.create({
        email: "support-mig@test-rbac.com",
        password: "hash",
        firstName: "Support",
        lastName: "User",
        role: "support",
      });

      const managerUser = await User.create({
        email: "manager-mig@test-rbac.com",
        password: "hash",
        firstName: "Manager",
        lastName: "User",
        role: "manager",
      });

      const adminUser = await User.create({
        email: "admin-mig@test-rbac.com",
        password: "hash",
        firstName: "Admin",
        lastName: "User",
        role: "admin",
      });

      const superAdminUser = await User.create({
        email: "superadmin-mig@test-rbac.com",
        password: "hash",
        firstName: "Super",
        lastName: "Admin",
        role: "super_admin",
      });

      const customerUser = await User.create({
        email: "customer-mig@test-rbac.com",
        password: "hash",
        firstName: "Customer",
        lastName: "User",
        role: "customer",
      });

      const vendorUser = await User.create({
        email: "vendor-mig@test-rbac.com",
        password: "hash",
        firstName: "Vendor",
        lastName: "User",
        role: "vendor",
      });

      // First migration run
      const result1 = await migrateEmployees();
      expect(result1.usersExamined).toBe(4);
      expect(result1.employeesCreated).toBe(4);
      expect(result1.rolesAssigned).toBe(4);

      // Verify Employee records created for privileged users
      const supportEmp = await Employee.findOne({ userId: supportUser._id });
      expect(supportEmp).not.toBeNull();
      expect(supportEmp.employeeNumber).toBe(
        generateDeterministicEmployeeNumber(supportUser._id)
      );
      expect(supportEmp.department).toBe("Customer Support");

      // Verify no Employee records created for customer or vendor
      const customerEmp = await Employee.findOne({ userId: customerUser._id });
      const vendorEmp = await Employee.findOne({ userId: vendorUser._id });
      expect(customerEmp).toBeNull();
      expect(vendorEmp).toBeNull();

      // Verify User.role is unchanged
      const freshSupport = await User.findById(supportUser._id);
      expect(freshSupport.role).toBe("support");

      // Second migration run (idempotency check)
      const result2 = await migrateEmployees();
      expect(result2.usersExamined).toBe(4);
      expect(result2.employeesCreated).toBe(0);
      expect(result2.rolesAssigned).toBe(0);

      // Verify total Employee and EmployeeRole counts remain 4
      const totalEmployees = await Employee.countDocuments();
      const totalEmployeeRoles = await EmployeeRole.countDocuments();
      expect(totalEmployees).toBe(4);
      expect(totalEmployeeRoles).toBe(4);
    });
  });
});
