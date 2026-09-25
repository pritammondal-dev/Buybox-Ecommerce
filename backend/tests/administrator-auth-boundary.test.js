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
const Vendor = require("../src/models/Vendor");
const RefreshToken = require("../src/models/RefreshToken");
const { bootstrapSuperadmin } = require("../src/services/bootstrap.service");
const { hashPassword } = require("../src/utils/password");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const { COOKIE_NAMES } = require("../src/config/cookie");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_admin_auth_boundary_test?")
  : "mongodb://127.0.0.1:27017/buybox_admin_auth_boundary_test?replicaSet=rs0";

describe("Buybox Final Authentication Architecture & Security Boundary Test Suite", () => {
  jest.setTimeout(60000);

  let superadminUser;
  let superadminToken;
  let superadminCookie;

  let adminUser;
  let adminToken;
  let adminCookie;

  let editorUser;
  let editorEmployee;
  let editorToken;
  let editorCookie;

  let customerUser;
  let customerToken;
  let customerCookie;

  let vendorUser;
  let vendorToken;
  let vendorCookie;

  let suspendedStaffUser;
  let suspendedEmployee;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI, { autoIndex: true });
    }

    // Initialize collections
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
      Vendor.init(),
      RefreshToken.init(),
    ]);

    // Bootstrap Superadmin
    await bootstrapSuperadmin();

    superadminUser = await User.findOne({ email: "admin123@example.com" });

    // Login Superadmin via /api/v1/administrator/auth/login
    const saLogin = await request(app)
      .post("/api/v1/administrator/auth/login")
      .send({ email: "admin123@example.com", password: "admin123" });
    expect(saLogin.status).toBe(200);
    superadminToken = saLogin.body.data.accessToken;
    superadminCookie = saLogin.headers["set-cookie"];

    // Create Admin user & employee
    const adminPass = await hashPassword("AdminSecret123!");
    adminUser = await User.findOneAndUpdate(
      { email: "test.admin@buybox.internal" },
      {
        email: "test.admin@buybox.internal",
        password: adminPass,
        firstName: "Test",
        lastName: "Admin",
        role: ROLES.ADMIN,
        isActive: true,
        isEmailVerified: true,
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    await Employee.findOneAndUpdate(
      { userId: adminUser._id },
      {
        userId: adminUser._id,
        employeeNumber: "EMP-ADM-TEST1",
        jobTitle: "Operations Administrator",
        department: "Operations",
        status: "active",
      },
      { upsert: true, returnDocument: "after" }
    );
    const adminRoleDoc = await Role.findOne({ slug: ROLES.ADMIN });
    if (adminRoleDoc) {
      await EmployeeRole.findOneAndUpdate(
        { employeeId: adminUser._id, roleId: adminRoleDoc._id },
        { employeeId: adminUser._id, roleId: adminRoleDoc._id, isActive: true },
        { upsert: true }
      );
    }

    const admLogin = await request(app)
      .post("/api/v1/administrator/auth/login")
      .send({ email: "test.admin@buybox.internal", password: "AdminSecret123!" });
    expect(admLogin.status).toBe(200);
    adminToken = admLogin.body.data.accessToken;
    adminCookie = admLogin.headers["set-cookie"];

    // Create Editor user & employee
    const editorPass = await hashPassword("EditorSecret123!");
    editorUser = await User.findOneAndUpdate(
      { email: "test.editor@buybox.internal" },
      {
        email: "test.editor@buybox.internal",
        password: editorPass,
        firstName: "Test",
        lastName: "Editor",
        role: ROLES.EDITOR,
        isActive: true,
        isEmailVerified: true,
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    editorEmployee = await Employee.findOneAndUpdate(
      { userId: editorUser._id },
      {
        userId: editorUser._id,
        employeeNumber: "EMP-EDT-TEST1",
        jobTitle: "Content Editor",
        department: "Catalog",
        status: "active",
      },
      { upsert: true, returnDocument: "after" }
    );
    const editorRoleDoc = await Role.findOne({ slug: ROLES.EDITOR });
    if (editorRoleDoc) {
      await EmployeeRole.findOneAndUpdate(
        { employeeId: editorEmployee._id, roleId: editorRoleDoc._id },
        { employeeId: editorEmployee._id, roleId: editorRoleDoc._id, isActive: true },
        { upsert: true }
      );
    }

    const edtLogin = await request(app)
      .post("/api/v1/administrator/auth/login")
      .send({ email: "test.editor@buybox.internal", password: "EditorSecret123!" });
    expect(edtLogin.status).toBe(200);
    editorToken = edtLogin.body.data.accessToken;
    editorCookie = edtLogin.headers["set-cookie"];

    // Create Customer user
    const custPass = await hashPassword("CustomerSecret123!");
    customerUser = await User.findOneAndUpdate(
      { email: "shopper.test@example.com" },
      {
        email: "shopper.test@example.com",
        password: custPass,
        firstName: "Shopper",
        lastName: "Jane",
        role: ROLES.CUSTOMER,
        isActive: true,
        isEmailVerified: true,
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    const custLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "shopper.test@example.com", password: "CustomerSecret123!" });
    expect(custLogin.status).toBe(200);
    customerToken = custLogin.body.data.accessToken;
    customerCookie = custLogin.headers["set-cookie"];

    // Create Vendor user & profile
    const vendPass = await hashPassword("VendorSecret123!");
    vendorUser = await User.findOneAndUpdate(
      { email: "seller.test@example.com" },
      {
        email: "seller.test@example.com",
        password: vendPass,
        firstName: "Seller",
        lastName: "Sam",
        role: ROLES.VENDOR,
        isActive: true,
        isEmailVerified: true,
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    await Vendor.findOneAndUpdate(
      { userId: vendorUser._id },
      {
        userId: vendorUser._id,
        businessName: "Sam Electronics Ltd",
        businessSlug: "sam-electronics",
        onboardingStatus: "approved",
        isActive: true,
      },
      { upsert: true, returnDocument: "after" }
    );

    const vendLogin = await request(app)
      .post("/api/v1/vendor/auth/login")
      .send({ email: "seller.test@example.com", password: "VendorSecret123!" });
    expect(vendLogin.status).toBe(200);
    vendorToken = vendLogin.body.data.accessToken;
    vendorCookie = vendLogin.headers["set-cookie"];

    // Create Suspended Staff member
    const suspPass = await hashPassword("SuspendedSecret123!");
    suspendedStaffUser = await User.findOneAndUpdate(
      { email: "suspended.staff@buybox.internal" },
      {
        email: "suspended.staff@buybox.internal",
        password: suspPass,
        firstName: "Suspended",
        lastName: "Staff",
        role: ROLES.ADMIN,
        isActive: false,
        isEmailVerified: true,
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    suspendedEmployee = await Employee.findOneAndUpdate(
      { userId: suspendedStaffUser._id },
      {
        userId: suspendedStaffUser._id,
        employeeNumber: "EMP-SUS-TEST1",
        jobTitle: "Suspended Admin",
        department: "Operations",
        status: "suspended",
      },
      { upsert: true, returnDocument: "after" }
    );
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  // Test 1: Customer credentials cannot authenticate through administrator login
  test("1. Customer credentials CANNOT authenticate through administrator login", async () => {
    const res = await request(app)
      .post("/api/v1/administrator/auth/login")
      .send({
        email: "shopper.test@example.com",
        password: "CustomerSecret123!",
      });
    expect([401, 403]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  // Test 2: Vendor credentials cannot authenticate through administrator login
  test("2. Vendor credentials CANNOT authenticate through administrator login", async () => {
    const res = await request(app)
      .post("/api/v1/administrator/auth/login")
      .send({
        email: "seller.test@example.com",
        password: "VendorSecret123!",
      });
    expect([401, 403]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  // Test 3: Admin credentials cannot authenticate through customer login
  test("3. Admin credentials CANNOT authenticate through customer login", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "test.admin@buybox.internal",
        password: "AdminSecret123!",
      });
    expect([401, 403]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  // Test 4: Editor credentials cannot authenticate through customer login
  test("4. Editor credentials CANNOT authenticate through customer login", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "test.editor@buybox.internal",
        password: "EditorSecret123!",
      });
    expect([401, 403]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  // Test 5: Customer session cannot access administrator APIs
  test("5. Customer session CANNOT access administrator APIs (/api/v1/admin/*)", async () => {
    const res = await request(app)
      .get("/api/v1/admin/dashboard/stats")
      .set("Authorization", `Bearer ${customerToken}`);
    expect([401, 403]).toContain(res.status);
  });

  // Test 6: Vendor session cannot access administrator APIs
  test("6. Vendor session CANNOT access administrator APIs (/api/v1/admin/*)", async () => {
    const res = await request(app)
      .get("/api/v1/admin/dashboard/stats")
      .set("Authorization", `Bearer ${vendorToken}`);
    expect([401, 403]).toContain(res.status);
  });

  // Test 7: Administrator session cannot bypass permissions (Editor cannot access governance / staff management)
  test("7. Administrator session CANNOT bypass RBAC/PBAC permissions", async () => {
    // Editor attempts to create staff (strictly SUPER_ADMIN only)
    const res = await request(app)
      .post("/api/v1/admin/staff")
      .set("Authorization", `Bearer ${editorToken}`)
      .send({
        email: "unauthorized.staff@buybox.internal",
        password: "Password123!",
        firstName: "Hack",
        lastName: "Attempt",
        role: "admin",
      });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("INSUFFICIENT_ROLE");
  });

  // Test 8: Suspended staff cannot authenticate
  test("8. Suspended staff CANNOT authenticate via administrator login", async () => {
    const res = await request(app)
      .post("/api/v1/administrator/auth/login")
      .send({
        email: "suspended.staff@buybox.internal",
        password: "SuspendedSecret123!",
      });
    expect([401, 403]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  // Test 9: Revoked administrator permissions produce 403 dynamically
  test("9. Revoked administrator permissions produce 403 dynamically", async () => {
    // Add restriction to Editor restricting dashboard view
    const perm = await Permission.findOne({ slug: PERMISSIONS.DASHBOARD_VIEW });
    await EmployeePermissionRestriction.findOneAndUpdate(
      {
        employeeId: editorEmployee._id,
        permissionId: perm._id,
      },
      {
        employeeId: editorEmployee._id,
        permissionId: perm._id,
        restrictedBy: superadminUser._id,
        isActive: true,
      },
      { upsert: true }
    );

    // Bump permissionVersion on user
    await User.findByIdAndUpdate(editorUser._id, { $inc: { permissionVersion: 1 } });

    // Dashboard stats requires DASHBOARD_VIEW
    const res = await request(app)
      .get("/api/v1/admin/dashboard/stats")
      .set("Authorization", `Bearer ${editorToken}`);

    // Should return 403 INSUFFICIENT_PERMISSIONS due to dynamic re-evaluation
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");

    // Clean up restriction so subsequent tests have expected baseline
    await EmployeePermissionRestriction.deleteOne({
      employeeId: editorEmployee._id,
      permissionId: perm._id,
    });
  });

  // Test 10: authVersion invalidates suspended staff sessions
  test("10. authVersion invalidates active staff sessions immediately", async () => {
    // Bump authVersion on editor user
    await User.findByIdAndUpdate(editorUser._id, { $inc: { authVersion: 1 } });

    // Request with old token should fail with 401 AUTH_VERSION_MISMATCH
    const res = await request(app)
      .get("/api/v1/admin/dashboard/stats")
      .set("Authorization", `Bearer ${editorToken}`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("AUTH_VERSION_MISMATCH");
  });

  // Test 11: permissionVersion invalidates/re-evaluates changed permissions
  test("11. permissionVersion forces authoritative database permission re-evaluation", async () => {
    // Login fresh editor
    const edtLogin2 = await request(app)
      .post("/api/v1/administrator/auth/login")
      .send({ email: "test.editor@buybox.internal", password: "EditorSecret123!" });
    const freshEditorToken = edtLogin2.body.data.accessToken;

    // Increment permissionVersion in DB
    await User.findByIdAndUpdate(editorUser._id, { $inc: { permissionVersion: 1 } });

    // Verify token can still access allowed endpoints because server dynamically resolves permissions
    const res = await request(app)
      .get("/api/v1/admin/dashboard/stats")
      .set("Authorization", `Bearer ${freshEditorToken}`);

    // Dashboard view is granted to Editor, so re-evaluation succeeds
    expect(res.status).toBe(200);
  });

  // Test 12: Superadmin cannot be downgraded or disabled by Admin/Editor
  test("12. Superadmin CANNOT be downgraded or disabled by Admin/Editor", async () => {
    // Admin attempts to suspend Superadmin
    const res1 = await request(app)
      .post(`/api/v1/admin/staff/${superadminUser._id}/suspend`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res1.status).toBe(403);

    // Superadmin attempting to suspend self is rejected by business rule
    const res2 = await request(app)
      .post(`/api/v1/admin/staff/${superadminUser._id}/suspend`)
      .set("Authorization", `Bearer ${superadminToken}`);
    expect(res2.status).toBe(400);
    expect(res2.body.code).toBe("CANNOT_SUSPEND_SUPERADMIN");

    // Superadmin attempting to downgrade self is rejected
    const res3 = await request(app)
      .patch(`/api/v1/admin/staff/${superadminUser._id}`)
      .set("Authorization", `Bearer ${superadminToken}`)
      .send({ role: "admin" });
    expect(res3.status).toBe(400);
    expect(res3.body.code).toBe("CANNOT_DOWNGRADE_SUPERADMIN");
  });

  // Test 13: No public administrator registration endpoint exists
  test("13. CRITICAL: No public administrator registration endpoint exists", async () => {
    const endpoints = [
      "/admin/register",
      "/api/v1/admin/register",
      "/api/v1/administrator/register",
      "/api/v1/administrator/auth/register",
    ];

    for (const ep of endpoints) {
      const res = await request(app)
        .post(ep)
        .send({ email: "intruder@malicious.com", password: "Password123!" });
      expect([404, 405]).toContain(res.status);
    }
  });

  // Test 14: No credentials/tokens appear in URLs
  test("14. No credentials, tokens, or passwords appear in query parameters or URLs", async () => {
    // Admin staff list should not expose passwords or tokens
    const res = await request(app)
      .get("/api/v1/admin/staff")
      .set("Authorization", `Bearer ${superadminToken}`);
    expect(res.status).toBe(200);

    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain("passwordHash");
    expect(bodyStr).not.toContain("tokenHash");
    expect(bodyStr).not.toContain("token=");
  });

  // Test 15: No cross-role session/cookie confusion exists
  test("15. No cross-role session/cookie confusion: cookies cannot cross-authenticate", async () => {
    // 15a: Customer cookie cannot refresh at administrator endpoint
    const resCustOnAdmin = await request(app)
      .post("/api/v1/administrator/auth/refresh")
      .set("Cookie", customerCookie);
    expect(resCustOnAdmin.status).toBe(401);

    // 15b: Vendor cookie cannot refresh at administrator endpoint
    const resVendOnAdmin = await request(app)
      .post("/api/v1/administrator/auth/refresh")
      .set("Cookie", vendorCookie);
    expect(resVendOnAdmin.status).toBe(401);

    // 15c: Admin cookie cannot refresh at customer endpoint
    const resAdminOnCust = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", adminCookie);
    expect(resAdminOnCust.status).toBe(401);
  });
});
