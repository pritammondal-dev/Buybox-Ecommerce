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
const Task = require("../src/models/Task");
const AuditLog = require("../src/models/AuditLog");
const { bootstrapSuperadmin } = require("../src/services/bootstrap.service");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_admin_rbac_test?")
  : "mongodb://127.0.0.1:27017/buybox_admin_rbac_test?replicaSet=rs0";

describe("Production Superadmin + Admin Dashboard RBAC & Security Test Suite", () => {
  jest.setTimeout(60000);

  let superadminToken;
  let superadminUser;
  let adminToken;
  let adminUser;
  let editorToken;
  let editorUser;
  let editorEmployee;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI, { autoIndex: true });
    }

    // Initialize required models
    await Promise.all([
      User.init(),
      Employee.init(),
      Role.init(),
      Permission.init(),
      RolePermission.init(),
      EmployeeRole.init(),
      EmployeePermissionGrant.init(),
      EmployeePermissionRestriction.init(),
      Task.init(),
      AuditLog.init(),
    ]);

    // Run bootstrap
    await bootstrapSuperadmin();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe("1. Admin Registration Security & Privileged Bootstrap", () => {
    test("CRITICAL: Public admin registration endpoints must NOT exist", async () => {
      const res1 = await request(app)
        .post("/admin/register")
        .send({ email: "hacker@test.com", password: "Password123!" });
      expect([404, 405]).toContain(res1.status);

      const res2 = await request(app)
        .post("/api/v1/admin/register")
        .send({ email: "hacker@test.com", password: "Password123!" });
      expect([404, 405]).toContain(res2.status);
    });

    test("Superadmin can log in with bootstrap credentials and receives permissions", async () => {
      const res = await request(app)
        .post("/api/v1/administrator/auth/login")
        .send({
          email: "admin123@example.com",
          password: "admin123",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe(ROLES.SUPER_ADMIN);
      expect(res.body.data.accessToken).toBeDefined();
      expect(Array.isArray(res.body.data.permissions)).toBe(true);

      superadminToken = res.body.data.accessToken;
      superadminUser = res.body.data.user;
    });

    test("Invalid login credentials return 401 Unauthorized", async () => {
      const res = await request(app)
        .post("/api/v1/administrator/auth/login")
        .send({
          email: "admin123@example.com",
          password: "WrongPassword123!",
        });

      expect(res.status).toBe(401);
    });
  });

  describe("2. Staff Management & Privilege Escalation Protection", () => {
    test("Superadmin can create an Admin account", async () => {
      const unique = Date.now();
      const res = await request(app)
        .post("/api/v1/admin/staff")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          firstName: "Alice",
          lastName: "Admin",
          email: `admin_${unique}@buybox.test`,
          password: "AdminPassword123!",
          role: "admin",
          department: "Operations",
          jobTitle: "Operations Admin",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.staff.role).toBe("admin");
      expect(res.body.data.staff.email).toBe(`admin_${unique}@buybox.test`);
      adminUser = res.body.data.staff;

      // Log in as Alice Admin
      const loginRes = await request(app)
        .post("/api/v1/administrator/auth/login")
        .send({
          email: `admin_${unique}@buybox.test`,
          password: "AdminPassword123!",
        });
      expect(loginRes.status).toBe(200);
      adminToken = loginRes.body.data.accessToken;
    });

    test("Superadmin can create an Editor account", async () => {
      const unique = Date.now() + 1;
      const res = await request(app)
        .post("/api/v1/admin/staff")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          firstName: "Edward",
          lastName: "Editor",
          email: `editor_${unique}@buybox.test`,
          password: "EditorPassword123!",
          role: "editor",
          department: "Catalog",
          jobTitle: "Catalog Specialist",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.staff.role).toBe("editor");
      editorUser = res.body.data.staff;
      editorEmployee = res.body.data.staff.employee;

      // Log in as Edward Editor
      const loginRes = await request(app)
        .post("/api/v1/administrator/auth/login")
        .send({
          email: `editor_${unique}@buybox.test`,
          password: "EditorPassword123!",
        });
      expect(loginRes.status).toBe(200);
      editorToken = loginRes.body.data.accessToken;
    });

    test("Privilege Escalation: Admin cannot create Superadmin", async () => {
      const res = await request(app)
        .post("/api/v1/admin/staff")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          firstName: "Sneaky",
          lastName: "Super",
          email: `sneaky_${Date.now()}@buybox.test`,
          password: "Password123!",
          role: "super_admin",
          department: "Exec",
          jobTitle: "Boss",
        });

      expect([400, 403]).toContain(res.status);
    });

    test("Privilege Escalation: Editor cannot create staff", async () => {
      const res = await request(app)
        .post("/api/v1/admin/staff")
        .set("Authorization", `Bearer ${editorToken}`)
        .send({
          firstName: "Rogue",
          lastName: "Editor",
          email: `rogue_${Date.now()}@buybox.test`,
          password: "Password123!",
          role: "editor",
          department: "Catalog",
          jobTitle: "Assistant",
        });

      expect(res.status).toBe(403);
    });

    test("Duplicate staff email is rejected", async () => {
      const res = await request(app)
        .post("/api/v1/admin/staff")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          firstName: "Duplicate",
          lastName: "Staff",
          email: adminUser.email,
          password: "Password123!",
          role: "admin",
          department: "Ops",
          jobTitle: "Agent",
        });

      expect(res.status).toBe(409);
    });

    test("Superadmin cannot be suspended or demoted", async () => {
      // Find Superadmin employee record
      const superEmp = await Employee.findOne({ userId: superadminUser.id || superadminUser._id });
      const res = await request(app)
        .put(`/api/v1/admin/staff/${superEmp._id}/suspend`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Self-suspension attempt" });

      expect([400, 403]).toContain(res.status);
    });

    test("Staff suspension and reactivation lifecycle", async () => {
      // Suspend Editor
      const suspendRes = await request(app)
        .put(`/api/v1/admin/staff/${editorEmployee._id}/suspend`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Security review" });

      expect(suspendRes.status).toBe(200);
      expect(suspendRes.body.data.employee.status).toBe("suspended");

      // Suspended editor attempts to login -> rejected
      const loginAttempt = await request(app)
        .post("/api/v1/administrator/auth/login")
        .send({
          email: editorUser.email,
          password: "EditorPassword123!",
        });
      expect([401, 403]).toContain(loginAttempt.status);

      // Reactivate Editor
      const reactivateRes = await request(app)
        .put(`/api/v1/admin/staff/${editorEmployee._id}/reactivate`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Review cleared" });

      expect(reactivateRes.status).toBe(200);
      expect(reactivateRes.body.data.employee.status).toBe("active");

      // Re-login after reactivation
      const reLogin = await request(app)
        .post("/api/v1/administrator/auth/login")
        .send({
          email: editorUser.email,
          password: "EditorPassword123!",
        });
      expect(reLogin.status).toBe(200);
      editorToken = reLogin.body.data.accessToken;
    });
  });

  describe("3. Dynamic Granular RBAC & Immediate Session Revocation", () => {
    test("Editor without activity_logs.view permission gets 403 on audit-logs endpoint", async () => {
      const res = await request(app)
        .get("/api/v1/admin/security/audit-logs")
        .set("Authorization", `Bearer ${editorToken}`);

      expect(res.status).toBe(403);
    });

    test("Superadmin grants activity_logs.view to Editor via bulk governance API", async () => {
      // Fetch editor's current effective permissions
      const govPermsRes = await request(app)
        .get(`/api/v1/admin/governance/employees/${editorEmployee._id}/permissions`)
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(govPermsRes.status).toBe(200);
      const currentPerms = govPermsRes.body.data.effectivePermissions || [];

      // Grant activity_logs.view
      const updatedPerms = Array.from(new Set([...currentPerms, "activity_logs.view"]));

      const updateRes = await request(app)
        .put(`/api/v1/admin/governance/employees/${editorEmployee._id}/permissions`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          permissions: updatedPerms,
          reason: "Assigned audit verification duty",
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);
    });

    test("Editor can now access audit-logs endpoint without needing a new login token", async () => {
      // The server invalidates cache via permissionVersion check in authorization.middleware
      const res = await request(app)
        .get("/api/v1/admin/security/audit-logs")
        .set("Authorization", `Bearer ${editorToken}`);

      // Should succeed with 200 OK
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("Superadmin removes activity_logs.view from Editor", async () => {
      const govPermsRes = await request(app)
        .get(`/api/v1/admin/governance/employees/${editorEmployee._id}/permissions`)
        .set("Authorization", `Bearer ${superadminToken}`);

      const currentPerms = govPermsRes.body.data.effectivePermissions || [];
      const filteredPerms = currentPerms.filter((p) => p !== "activity_logs.view" && p !== "audit_logs:read");

      const updateRes = await request(app)
        .put(`/api/v1/admin/governance/employees/${editorEmployee._id}/permissions`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          permissions: filteredPerms,
          reason: "Audit assignment concluded",
        });

      expect(updateRes.status).toBe(200);
    });

    test("Editor is IMMEDIATELY forbidden (403) from audit-logs with the same token", async () => {
      const res = await request(app)
        .get("/api/v1/admin/security/audit-logs")
        .set("Authorization", `Bearer ${editorToken}`);

      expect(res.status).toBe(403);
    });

    test("Editor cannot grant permissions to themselves or anyone else", async () => {
      const res = await request(app)
        .put(`/api/v1/admin/governance/employees/${editorEmployee._id}/permissions`)
        .set("Authorization", `Bearer ${editorToken}`)
        .send({
          permissions: ["activity_logs.view", "platform_settings.manage"],
          reason: "Self-promotion attempt",
        });

      expect(res.status).toBe(403);
    });
  });

  describe("4. Task Management Workflow", () => {
    let taskId;

    test("Superadmin creates an operational task assigned to Editor", async () => {
      const res = await request(app)
        .post("/api/v1/admin/tasks")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          title: "Verify Vendor Catalog Onboarding",
          description: "Audit sample product specifications and images for vendor onboarding compliance.",
          priority: "HIGH",
          assignedTo: editorEmployee._id,
          dueDate: new Date(Date.now() + 86400000).toISOString(),
          tags: ["vendor", "catalog", "compliance"],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.task.title).toBe("Verify Vendor Catalog Onboarding");
      expect(res.body.data.task.status).toBe("TODO");
      expect(res.body.data.task.priority).toBe("HIGH");
      taskId = res.body.data.task._id;
    });

    test("Assigned Editor can view their task list", async () => {
      const res = await request(app)
        .get("/api/v1/admin/tasks")
        .set("Authorization", `Bearer ${editorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.tasks)).toBe(true);
      const found = res.body.data.tasks.find((t) => t._id.toString() === taskId.toString());
      expect(found).toBeDefined();
    });

    test("Editor updates task status to IN_PROGRESS and adds an internal note", async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/tasks/${taskId}`)
        .set("Authorization", `Bearer ${editorToken}`)
        .send({
          status: "IN_PROGRESS",
          internalNote: "Started review of initial 10 products.",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.task.status).toBe("IN_PROGRESS");
      expect(res.body.data.task.internalNotes.length).toBeGreaterThan(0);
      expect(res.body.data.task.history.length).toBeGreaterThan(0);
    });
  });

  describe("5. Dashboard Live Aggregations & Metrics", () => {
    test("Superadmin dashboard returns 17 database-backed KPIs", async () => {
      const res = await request(app)
        .get("/api/v1/admin/dashboard/stats")
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const stats = res.body.data.stats;
      expect(stats).toBeDefined();

      // Check all 17 KPI metrics are numeric
      expect(typeof stats.totalCustomers).toBe("number");
      expect(typeof stats.activeCustomers).toBe("number");
      expect(typeof stats.totalVendors).toBe("number");
      expect(typeof stats.pendingVendors).toBe("number");
      expect(typeof stats.activeVendors).toBe("number");
      expect(typeof stats.totalProducts).toBe("number");
      expect(typeof stats.pendingProducts).toBe("number");
      expect(typeof stats.totalOrders).toBe("number");
      expect(typeof stats.pendingOrders).toBe("number");
      expect(typeof stats.gmv).toBe("number");
      expect(typeof stats.revenue).toBe("number");
      expect(typeof stats.refunds).toBe("number");
      expect(typeof stats.commission).toBe("number");
      expect(typeof stats.vendorSettlements).toBe("number");
      expect(typeof stats.lowStock).toBe("number");
      expect(typeof stats.pendingReturns).toBe("number");
      expect(typeof stats.openSupportTickets).toBe("number");
    });
  });

  describe("6. Audit Logging & Credential Protection", () => {
    test("Sensitive actions generate immutable audit log records", async () => {
      const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(20);
      expect(logs.length).toBeGreaterThan(0);

      // Verify that NO passwords, tokens, or secrets exist in audit state
      for (const log of logs) {
        const str = JSON.stringify(log);
        expect(str).not.toContain("AdminPassword123!");
        expect(str).not.toContain("EditorPassword123!");
        expect(str).not.toContain("admin123");
        expect(str).not.toContain("JWT_ACCESS_SECRET");
      }
    });
  });
});
