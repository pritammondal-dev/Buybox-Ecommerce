const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Employee = require("../src/models/Employee");
const JobRole = require("../src/models/JobRole");
const AuditLog = require("../src/models/AuditLog");
const Role = require("../src/models/Role");
const Permission = require("../src/models/Permission");
const RolePermission = require("../src/models/RolePermission");
const EmployeeRole = require("../src/models/EmployeeRole");
const { bootstrapSuperadmin } = require("../src/services/bootstrap.service");

describe("Part 1 — Admin Foundation, RBAC & Dynamic Job Role Authority Test Suite", () => {
  jest.setTimeout(60000);

  let superadminToken = "";
  let superadminUser = null;
  let superadminRole = null;
  let editorRole = null;
  let adminRole = null;
  let managerRole = null;
  let staffRole = null;

  let editorUser = null;
  let editorToken = "";
  let adminUser = null;
  let adminToken = "";
  let testStaffUser = null;
  let testStaffEmployee = null;

  beforeAll(async () => {
    const TEST_URI = process.env.MONGODB_URI
      ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_admin_rbac_test?")
      : "mongodb://127.0.0.1:27017/buybox_admin_rbac_test?replicaSet=rs0";

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_URI, { autoIndex: true });
    }

    await Promise.all([
      User.init(),
      Employee.init(),
      JobRole.init(),
      AuditLog.init(),
      Role.init(),
      Permission.init(),
      RolePermission.init(),
      EmployeeRole.init(),
    ]);

    // 1. Run bootstrap to ensure clean, initialized environment
    await User.deleteMany({ role: "super_admin" });
    await bootstrapSuperadmin();

    // 2. Log in as Superadmin
    const superadminLogin = await request(app)
      .post("/api/v1/administrator/auth/login")
      .send({
        email: "admin123@example.com",
        password: "admin123",
      });

    expect(superadminLogin.status).toBe(200);
    superadminToken = superadminLogin.body.data.accessToken;
    superadminUser = superadminLogin.body.data.user;

    // 3. Fetch all initial Job Roles
    const rolesRes = await request(app)
      .get("/api/v1/admin/job-roles")
      .set("Authorization", `Bearer ${superadminToken}`);

    expect(rolesRes.status).toBe(200);
    const roles = rolesRes.body.data.roles;

    superadminRole = roles.find((r) => r.slug === "superadmin");
    editorRole = roles.find((r) => r.slug === "editor");
    adminRole = roles.find((r) => r.slug === "admin");
    managerRole = roles.find((r) => r.slug === "manager");
    staffRole = roles.find((r) => r.slug === "staff");

    expect(superadminRole).toBeDefined();
    expect(superadminRole.tier).toBe(1);
    expect(superadminRole.isSuperadminRole).toBe(true);

    // 4. Create an Editor and an Admin for authority tests
    const unique = Date.now();
    const createEditorRes = await request(app)
      .post("/api/v1/admin/staff")
      .set("Authorization", `Bearer ${superadminToken}`)
      .send({
        firstName: "Edward",
        lastName: "Editor",
        email: `edward_test_${unique}@buybox.test`,
        password: "EditorPassword123!",
        role: "editor",
        jobRoleId: editorRole._id,
        department: "Catalog & Content",
        jobTitle: "Senior Editor",
      });

    expect(createEditorRes.status).toBe(201);
    editorUser = createEditorRes.body.data.staff;

    const editorLogin = await request(app)
      .post("/api/v1/administrator/auth/login")
      .send({
        email: `edward_test_${unique}@buybox.test`,
        password: "EditorPassword123!",
      });

    expect(editorLogin.status).toBe(200);
    editorToken = editorLogin.body.data.accessToken;

    const createAdminRes = await request(app)
      .post("/api/v1/admin/staff")
      .set("Authorization", `Bearer ${superadminToken}`)
      .send({
        firstName: "Arthur",
        lastName: "Admin",
        email: `arthur_test_${unique}@buybox.test`,
        password: "AdminPassword123!",
        role: "admin",
        jobRoleId: adminRole._id,
        department: "Marketplace Operations",
        jobTitle: "Operations Administrator",
      });

    expect(createAdminRes.status).toBe(201);
    adminUser = createAdminRes.body.data.staff;

    const adminLogin = await request(app)
      .post("/api/v1/administrator/auth/login")
      .send({
        email: `arthur_test_${unique}@buybox.test`,
        password: "AdminPassword123!",
      });

    expect(adminLogin.status).toBe(200);
    adminToken = adminLogin.body.data.accessToken;
  });

  /* =========================================================================
     1. EXACTLY ONE ACTIVE SUPERADMIN INVARIANT
     ========================================================================= */
  describe("1. Exactly One Active Superadmin Invariant", () => {
    test("Pre-save invariant & unique index block creating a second active Superadmin", async () => {
      let duplicateError = null;
      try {
        await User.create({
          email: `duplicate_super_${Date.now()}@buybox.test`,
          password: "HashedPassword123!",
          firstName: "Duplicate",
          lastName: "Superadmin",
          role: "super_admin",
          isActive: true,
        });
      } catch (err) {
        duplicateError = err;
      }

      expect(duplicateError).not.toBeNull();
      expect(
        duplicateError.message.includes("INVARIANT_VIOLATION") ||
          duplicateError.code === 11000
      ).toBe(true);
    });

    test("Staff provisioning endpoint rejects attempts to create a super_admin", async () => {
      const res = await request(app)
        .post("/api/v1/admin/staff")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          firstName: "Fake",
          lastName: "Super",
          email: `fake_super_${Date.now()}@buybox.test`,
          password: "Password123!",
          role: "super_admin",
          department: "Executive",
        });

      expect([400, 403]).toContain(res.status);
    });

    test("Active superadmin count in database is exactly 1", async () => {
      const count = await User.countDocuments({
        role: "super_admin",
        isActive: true,
      });
      expect(count).toBe(1);
    });
  });

  /* =========================================================================
     2. DYNAMIC JOB ROLE CRUD & PROTECTION
     ========================================================================= */
  describe("2. Dynamic Job Role CRUD & System Role Protection", () => {
    let customRoleId = "";
    const uniqueSuffix = Date.now();
    const customRoleName = `Warehouse Lead ${uniqueSuffix}`;
    const customRoleSlug = `warehouse-lead-${uniqueSuffix}`;

    test("Superadmin can create a custom Job Role with permissions and managementScope", async () => {
      const res = await request(app)
        .post("/api/v1/admin/job-roles")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          name: customRoleName,
          slug: customRoleSlug,
          description: "Leads warehouse fulfillment teams",
          tier: 4,
          permissions: [
            "inventory.view",
            "inventory.adjust",
            "warehouses.view",
            "shipping.view",
          ],
          managementScope: [staffRole._id],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role.name).toBe(customRoleName);
      expect(res.body.data.role.slug).toBe(customRoleSlug);
      expect(res.body.data.role.tier).toBeGreaterThanOrEqual(4);
      expect(res.body.data.role.isSystemRole).toBe(false);
      customRoleId = res.body.data.role._id;
    });

    test("Non-superadmin (Editor/Admin) cannot create a Job Role (403 Forbidden)", async () => {
      const res = await request(app)
        .post("/api/v1/admin/job-roles")
        .set("Authorization", `Bearer ${editorToken}`)
        .send({
          name: `Unauthorized Role ${uniqueSuffix}`,
          slug: `unauthorized-role-${uniqueSuffix}`,
          tier: 5,
        });

      expect(res.status).toBe(403);
    });

    test("Duplicate Job Role name or slug is rejected (409 Conflict)", async () => {
      const res = await request(app)
        .post("/api/v1/admin/job-roles")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          name: customRoleName,
          slug: customRoleSlug,
          tier: 4,
        });

      expect(res.status).toBe(409);
    });

    test("Superadmin cannot deactivate Superadmin Job Role", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/job-roles/${superadminRole._id}/deactivate`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe("CANNOT_DEACTIVATE_SUPERADMIN_ROLE");
    });

    test("Superadmin can update custom Job Role permissions and managementScope", async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/job-roles/${customRoleId}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          description: "Updated description for Warehouse Lead",
          permissions: [
            "inventory.view",
            "inventory.adjust",
            "inventory.transfer",
            "warehouses.view",
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.role.description).toBe(
        "Updated description for Warehouse Lead"
      );
      expect(res.body.data.role.permissions).toContain("inventory.transfer");
    });
  });

  /* =========================================================================
     3. DRAGGABLE HIERARCHY & REORDER API
     ========================================================================= */
  describe("3. Draggable Hierarchy & Reorder API", () => {
    test("Incomplete or partial role hierarchy reorder is rejected (400)", async () => {
      const res = await request(app)
        .patch("/api/v1/admin/job-roles/reorder")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          orderedIds: [superadminRole._id, editorRole._id], // missing admin, manager, staff
        });

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe("INCOMPLETE_HIERARCHY");
    });

    test("Attempting to displace Superadmin from Tier 1 is rejected (400)", async () => {
      // Trying to put Editor at Tier 1 and Superadmin at Tier 2
      const allRolesRes = await request(app)
        .get("/api/v1/admin/job-roles")
        .set("Authorization", `Bearer ${superadminToken}`);

      const allActiveRoleIds = allRolesRes.body.data.roles
        .filter((r) => r.isActive)
        .map((r) => r._id);

      // Swap position 0 and 1
      const swapped = [...allActiveRoleIds];
      const temp = swapped[0];
      swapped[0] = swapped[1];
      swapped[1] = temp;

      const res = await request(app)
        .patch("/api/v1/admin/job-roles/reorder")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ orderedIds: swapped });

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe("SUPERADMIN_TIER_IMMUTABLE");
    });

    test("Superadmin can dynamically reorder hierarchy: Superadmin (1) -> Editor (2) -> Admin (3)", async () => {
      const allRolesRes = await request(app)
        .get("/api/v1/admin/job-roles")
        .set("Authorization", `Bearer ${superadminToken}`);

      const roles = allRolesRes.body.data.roles.filter((r) => r.isActive);
      const superadminId = roles.find((r) => r.slug === "superadmin")._id;
      const editorId = roles.find((r) => r.slug === "editor")._id;
      const adminId = roles.find((r) => r.slug === "admin")._id;
      const otherIds = roles
        .filter((r) => !["superadmin", "editor", "admin"].includes(r.slug))
        .map((r) => r._id);

      const reorderedList = [superadminId, editorId, adminId, ...otherIds];

      const res = await request(app)
        .patch("/api/v1/admin/job-roles/reorder")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ orderedIds: reorderedList });

      expect(res.status).toBe(200);
      const updatedRoles = res.body.data.roles;

      const updatedEditor = updatedRoles.find((r) => r._id === editorId);
      const updatedAdmin = updatedRoles.find((r) => r._id === adminId);

      expect(updatedEditor.tier).toBe(2);
      expect(updatedAdmin.tier).toBe(3);
      expect(updatedEditor.tier).toBeLessThan(updatedAdmin.tier);
    });

    test("Audit log records JOB_ROLE_REORDERED with before and after hierarchy", async () => {
      const audit = await AuditLog.findOne({ action: "JOB_ROLE_REORDERED" })
        .sort({ createdAt: -1 })
        .lean();

      expect(audit).toBeDefined();
      expect(audit.entityType).toBe("job_role");
      expect(audit.afterState).toBeDefined();
      expect(Array.isArray(audit.afterState.hierarchy)).toBe(true);
    });
  });

  /* =========================================================================
     4. TWO-LAYER AUTHORIZATION (HIERARCHY + PERMISSION + MANAGEMENT SCOPE)
     ========================================================================= */
  describe("4. Two-Layer Authorization (Hierarchy + Permission + Scope)", () => {
    beforeAll(async () => {
      // Configure Editor JobRole with employee.create permission and scope over Admin
      await request(app)
        .patch(`/api/v1/admin/job-roles/${editorRole._id}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          permissions: [
            ...(editorRole.permissions || []),
            "employee.create",
            "employee.assign_role",
            "staff.create",
          ],
          managementScope: [adminRole._id],
        });
    });

    test("Editor (Tier 2) with employee.create and Admin in managementScope CAN create an Admin (Tier 3)", async () => {
      const unique = Date.now() + 50;
      const res = await request(app)
        .post("/api/v1/admin/staff")
        .set("Authorization", `Bearer ${editorToken}`)
        .send({
          firstName: "Subordinate",
          lastName: "Admin",
          email: `sub_admin_${unique}@buybox.test`,
          password: "AdminPassword123!",
          role: "admin",
          jobRoleId: adminRole._id,
          department: "Operations",
          jobTitle: "Junior Admin",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.staff.role).toBe("admin");
    });

    test("Editor (Tier 2) CANNOT create another Editor (Same-tier: 403 Forbidden)", async () => {
      const unique = Date.now() + 60;
      const res = await request(app)
        .post("/api/v1/admin/staff")
        .set("Authorization", `Bearer ${editorToken}`)
        .send({
          firstName: "Peer",
          lastName: "Editor",
          email: `peer_editor_${unique}@buybox.test`,
          password: "EditorPassword123!",
          role: "editor",
          jobRoleId: editorRole._id,
          department: "Catalog",
          jobTitle: "Peer Editor",
        });

      expect(res.status).toBe(403);
    });

    test("Admin (Tier 3) CANNOT create or manage an Editor (Tier 2) (Lower authority managing higher: 403 Forbidden)", async () => {
      const unique = Date.now() + 70;
      const res = await request(app)
        .post("/api/v1/admin/staff")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          firstName: "Illegal",
          lastName: "Superior",
          email: `superior_${unique}@buybox.test`,
          password: "EditorPassword123!",
          role: "editor",
          jobRoleId: editorRole._id,
          department: "Catalog",
          jobTitle: "Senior Editor",
        });

      expect(res.status).toBe(403);
    });

    test("Editor (Tier 2) CANNOT create Superadmin (Tier 1) (400 or 403)", async () => {
      const unique = Date.now() + 80;
      const res = await request(app)
        .post("/api/v1/admin/staff")
        .set("Authorization", `Bearer ${editorToken}`)
        .send({
          firstName: "Escalated",
          lastName: "Super",
          email: `escalate_${unique}@buybox.test`,
          password: "SuperPassword123!",
          role: "super_admin",
          jobRoleId: superadminRole._id,
          department: "Executive",
        });

      expect([400, 403]).toContain(res.status);
    });
  });

  /* =========================================================================
     5. PROMOTION, DEMOTION & PRE-FLIGHT DIFF
     ========================================================================= */
  describe("5. Promotion, Demotion & Pre-Flight Diff", () => {
    beforeAll(async () => {
      // Create a test staff member with Staff JobRole (Tier 5)
      const unique = Date.now() + 90;
      const createRes = await request(app)
        .post("/api/v1/admin/staff")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          firstName: "Sammy",
          lastName: "Staff",
          email: `sammy_staff_${unique}@buybox.test`,
          password: "StaffPassword123!",
          role: "editor",
          jobRoleId: staffRole._id,
          department: "Support",
          jobTitle: "Support Agent",
        });

      expect(createRes.status).toBe(201);
      testStaffUser = createRes.body.data.staff;
      testStaffEmployee = createRes.body.data.staff.employee;
    });

    test("Pre-flight role preview returns diff: oldTier, newTier, and permission differences", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/staff/${testStaffEmployee.id}/role-preview`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          newRoleId: adminRole._id,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.oldTier).toBe(res.body.data.oldRole.tier);
      expect(res.body.data.newTier).toBe(res.body.data.newRole.tier);
      expect(res.body.data.oldTier).toBeGreaterThan(res.body.data.newTier);
      expect(res.body.data.changeType).toBe("PROMOTION");
      expect(res.body.data.permissionsDiff).toBeDefined();
      expect(Array.isArray(res.body.data.permissionsDiff.added)).toBe(true);
      expect(res.body.data.allowed).toBe(true);
    });

    test("Superadmin promotes employee from Staff (Tier 5) to Admin (Tier 3)", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/staff/${testStaffEmployee.id}/change-role`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          newRoleId: adminRole._id,
          reason: "Demonstrated exemplary operations management capabilities",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.actionType).toBe("EMPLOYEE_PROMOTED");
      expect(res.body.data.employee.tier).toBe(adminRole.tier);

      // Verify audit event
      const audit = await AuditLog.findOne({
        targetId: testStaffEmployee.id,
        action: "EMPLOYEE_PROMOTED",
      }).lean();

      expect(audit).toBeDefined();
      expect(audit.afterState.tier).toBe(adminRole.tier);
    });

    test("Promoting demoted employee updates effective permissions immediately", async () => {
      const updatedStaff = await request(app)
        .get(`/api/v1/admin/staff/${testStaffUser.id}`)
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(updatedStaff.status).toBe(200);
      expect(updatedStaff.body.data.staff.employee.jobRoleId).toBe(adminRole._id);
      expect(updatedStaff.body.data.staff.employee.jobRole.tier).toBe(adminRole.tier);
    });
  });

  /* =========================================================================
     6. ROLE DEACTIVATION & ATOMIC EMPLOYEE MIGRATION
     ========================================================================= */
  describe("6. Role Deactivation & Atomic Employee Migration", () => {
    let temporaryRole = null;
    let tempEmployee = null;

    beforeAll(async () => {
      // Create a temporary role and assign an employee to it
      const tempSuffix = Date.now() + 500;
      const createRoleRes = await request(app)
        .post("/api/v1/admin/job-roles")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          name: `Temporary Role ${tempSuffix}`,
          slug: `temp-role-${tempSuffix}`,
          tier: 4,
          permissions: ["tasks.view"],
          managementScope: [staffRole._id],
        });

      expect(createRoleRes.status).toBe(201);
      temporaryRole = createRoleRes.body.data.role;

      const createStaffRes = await request(app)
        .post("/api/v1/admin/staff")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          firstName: "Temp",
          lastName: "Worker",
          email: `temp_worker_${Date.now()}@buybox.test`,
          password: "Password123!",
          role: "editor",
          jobRoleId: temporaryRole._id,
          department: "Logistics",
        });

      expect(createStaffRes.status).toBe(201);
      tempEmployee = createStaffRes.body.data.staff.employee;
    });

    test("Deactivating a role with assigned employees without replacement role is rejected (400)", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/job-roles/${temporaryRole._id}/deactivate`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe("REPLACEMENT_ROLE_REQUIRED");
    });

    test("Migration preview shows affected employees and permissions diff", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/job-roles/${temporaryRole._id}/migrate-preview`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          replacementRoleId: staffRole._id,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.employeeCount).toBe(1);
      expect(res.body.data.replacementRole.id).toBe(staffRole._id);
    });

    test("Atomic role deactivation with replacement role migrates employees and updates state", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/job-roles/${temporaryRole._id}/deactivate`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          replacementRoleId: staffRole._id,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.migratedEmployeesCount).toBe(1);

      // Verify employee now references replacement role
      const empInDb = await Employee.findById(tempEmployee.id).lean();
      expect(empInDb.jobRoleId.toString()).toBe(staffRole._id.toString());

      // Verify role is inactive
      const roleInDb = await JobRole.findById(temporaryRole._id).lean();
      expect(roleInDb.isActive).toBe(false);

      // Verify audit events
      const migrationAudit = await AuditLog.findOne({
        action: "ROLE_EMPLOYEE_MIGRATION",
        targetId: temporaryRole._id,
      }).lean();
      expect(migrationAudit).toBeDefined();

      const deactivationAudit = await AuditLog.findOne({
        action: "JOB_ROLE_DEACTIVATED",
        targetId: temporaryRole._id,
      }).lean();
      expect(deactivationAudit).toBeDefined();
    });
  });

  /* =========================================================================
     7. SUPERADMIN TRANSFER FLOW
     ========================================================================= */
  describe("7. Superadmin Transfer Flow", () => {
    let successorUser = null;

    beforeAll(async () => {
      const unique = Date.now() + 200;
      const res = await request(app)
        .post("/api/v1/admin/staff")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          firstName: "Successor",
          lastName: "Executive",
          email: `successor_${unique}@buybox.test`,
          password: "SuccessorPassword123!",
          role: "admin",
          jobRoleId: adminRole._id,
          department: "Executive",
          jobTitle: "VP Operations",
        });

      expect(res.status).toBe(201);
      successorUser = res.body.data.staff;
    });

    test("Non-superadmin cannot invoke Superadmin transfer (403 Forbidden)", async () => {
      const res = await request(app)
        .post("/api/v1/admin/governance/superadmin/transfer")
        .set("Authorization", `Bearer ${editorToken}`)
        .send({
          targetUserId: successorUser.id,
          replacementRoleId: adminRole._id,
          confirmText: "TRANSFER_SUPERADMIN",
        });

      expect(res.status).toBe(403);
    });

    test("Transfer without exact confirmText is rejected (400)", async () => {
      const res = await request(app)
        .post("/api/v1/admin/governance/superadmin/transfer")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          targetUserId: successorUser.id,
          replacementRoleId: adminRole._id,
          confirmText: "WRONG_TEXT",
        });

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe("CONFIRMATION_REQUIRED");
    });

    test("Superadmin transfers platform authority atomically to successor", async () => {
      const res = await request(app)
        .post("/api/v1/admin/governance/superadmin/transfer")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          targetUserId: successorUser.id,
          replacementRoleId: adminRole._id,
          confirmText: "TRANSFER_SUPERADMIN",
          password: "admin123",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.newSuperadmin.id).toBe(successorUser.id);

      // Verify in Database: Exactly 1 active Superadmin
      const activeSuperadmins = await User.find({
        role: "super_admin",
        isActive: true,
      }).lean();
      expect(activeSuperadmins.length).toBe(1);
      expect(activeSuperadmins[0]._id.toString()).toBe(successorUser.id.toString());

      // Verify outgoing Superadmin was demoted
      const formerSuperadmin = await User.findById(superadminUser.id).lean();
      expect(formerSuperadmin.role).toBe("admin");

      // Verify audit log
      const transferAudit = await AuditLog.findOne({
        action: "SUPERADMIN_TRANSFERRED",
      }).lean();
      expect(transferAudit).toBeDefined();

      // Log in as new Superadmin to verify new credentials have full platform authority
      const successorLogin = await request(app)
        .post("/api/v1/administrator/auth/login")
        .send({
          email: successorUser.email,
          password: "SuccessorPassword123!",
        });

      expect(successorLogin.status).toBe(200);
      expect(successorLogin.body.data.user.role).toBe("super_admin");

      // Rotate back to bootstrap superadmin for clean teardown
      const restoreRes = await request(app)
        .post("/api/v1/admin/governance/superadmin/transfer")
        .set(
          "Authorization",
          `Bearer ${successorLogin.body.data.accessToken}`
        )
        .send({
          targetUserId: superadminUser.id,
          replacementRoleId: adminRole._id,
          confirmText: "TRANSFER_SUPERADMIN",
          password: "SuccessorPassword123!",
        });

      expect(restoreRes.status).toBe(200);
      const restored = await User.findById(superadminUser.id).lean();
      expect(restored.role).toBe("super_admin");

      // Re-login as restored bootstrap superadmin to get fresh token for subsequent tests
      const restoredLogin = await request(app)
        .post("/api/v1/administrator/auth/login")
        .send({
          email: "admin123@example.com",
          password: "admin123",
        });

      expect(restoredLogin.status).toBe(200);
      superadminToken = restoredLogin.body.data.accessToken;
    });
  });

  /* =========================================================================
     8. IDOR & BOLA AUTHORIZATION TESTS
     ========================================================================= */
  describe("8. IDOR & BOLA Security Tests", () => {
    test("Staff cannot modify or downgrade Superadmin account", async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/staff/${superadminUser.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          role: "editor",
          status: "suspended",
        });

      expect([400, 403]).toContain(res.status);
    });

    test("Manipulated invalid ObjectId in job-roles endpoints returns 400 safe error", async () => {
      const res = await request(app)
        .get("/api/v1/admin/job-roles/not-a-valid-id-12345")
        .set("Authorization", `Bearer ${superadminToken}`);

      // Should handle slug lookup gracefully or return 404/400 without crashing
      expect([400, 404]).toContain(res.status);
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });
});
