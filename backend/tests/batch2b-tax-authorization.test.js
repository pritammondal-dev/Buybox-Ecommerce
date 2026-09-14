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
const TaxRule = require("../src/models/TaxRule");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const { generateAccessToken } = require("../src/services/token.service");
const {
  incrementAuthVersion,
  incrementPermissionVersion,
} = require("../src/services/authorization.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_batch2b_test?")
  : "mongodb://127.0.0.1:27017/buybox_batch2b_test?replicaSet=rs0";

describe("Phase 1G / Batch 2B — Tax Rule Operational Route Authorization (PBAC)", () => {
  let createdPermissions = new Map();
  const testId = new mongoose.Types.ObjectId().toString();

  // Helper to create test user + employee profile
  async function createTestEmployee(options = {}) {
    const status = options.status || "active";
    const user = await User.create({
      firstName: "Batch2B",
      lastName: "Staff",
      email: `staff_${Date.now()}_${Math.random().toString(36).substring(7)}@test-batch2b.com`,
      password: "Password123!",
      role: options.userRole || "manager",
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const employee = await Employee.create({
      userId: user._id,
      employeeNumber: `EMP_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`,
      jobTitle: "Tax Compliance Specialist",
      department: "Finance",
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

  // Helper to create customer user
  async function createTestCustomer() {
    const user = await User.create({
      firstName: "Customer",
      lastName: "TaxTester",
      email: `customer_${Date.now()}_${Math.random().toString(36).substring(7)}@test-batch2b.com`,
      password: "Password123!",
      role: ROLES.CUSTOMER,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const token = generateAccessToken({
      sub: user._id.toString(),
      role: user.role,
      authVersion: user.authVersion,
      permissionVersion: user.permissionVersion,
    });

    return { user, token };
  }

  // Helper to create vendor user
  async function createTestVendor() {
    const user = await User.create({
      firstName: "Vendor",
      lastName: "TaxTester",
      email: `vendor_${Date.now()}_${Math.random().toString(36).substring(7)}@test-batch2b.com`,
      password: "Password123!",
      role: ROLES.VENDOR,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const token = generateAccessToken({
      sub: user._id.toString(),
      role: user.role,
      authVersion: user.authVersion,
      permissionVersion: user.permissionVersion,
    });

    return { user, token };
  }

  // Helper to get or create permission
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

  // Helper to dispatch HTTP request by method
  function dispatchRequest(method, path, token = null, body = null) {
    let req;
    switch (method.toUpperCase()) {
      case "GET":
        req = request(app).get(path);
        break;
      case "POST":
        req = request(app).post(path);
        break;
      case "PUT":
        req = request(app).put(path);
        break;
      case "PATCH":
        req = request(app).patch(path);
        break;
      case "DELETE":
        req = request(app).delete(path);
        break;
      default:
        throw new Error(`Unsupported method ${method}`);
    }

    if (token) {
      req.set("Authorization", `Bearer ${token}`);
    }
    if (body) {
      req.send(body);
    }
    return req;
  }

  // Canonical Tax Rule Family: 5 Protected Endpoints (2 Batch 1 Reads + 3 Batch 2B Mutations)
  const TAX_RULE_PROTECTED_ROUTES = [
    {
      name: "List Tax Rules (Admin)",
      batch: "Batch 1 (Phase 1D)",
      method: "GET",
      path: "/api/v1/tax/rules",
      requiredPermission: PERMISSIONS.TAX_READ,
    },
    {
      name: "Get Tax Rule by ID",
      batch: "Batch 1 (Phase 1D)",
      method: "GET",
      path: `/api/v1/tax/rules/${testId}`,
      requiredPermission: PERMISSIONS.TAX_READ,
    },
    {
      name: "Create Tax Rule",
      batch: "Batch 2B",
      method: "POST",
      path: "/api/v1/tax/rules",
      requiredPermission: PERMISSIONS.TAX_MANAGE,
    },
    {
      name: "Update Tax Rule",
      batch: "Batch 2B",
      method: "PUT",
      path: `/api/v1/tax/rules/${testId}`,
      requiredPermission: PERMISSIONS.TAX_MANAGE,
    },
    {
      name: "Delete Tax Rule",
      batch: "Batch 2B",
      method: "DELETE",
      path: `/api/v1/tax/rules/${testId}`,
      requiredPermission: PERMISSIONS.TAX_MANAGE,
    },
  ];

  const BATCH_2B_MUTATION_ROUTES = TAX_RULE_PROTECTED_ROUTES.filter(
    (r) => r.batch === "Batch 2B"
  );

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
      TaxRule.init(),
    ]);
  });

  afterAll(async () => {
    await Promise.all([
      User.deleteMany({ email: /@test-batch2b\.com$/ }),
      Employee.deleteMany({ jobTitle: "Tax Compliance Specialist" }),
      Role.deleteMany({ slug: { $regex: /^test_batch2b_/ } }),
      RolePermission.deleteMany({}),
      EmployeeRole.deleteMany({}),
      EmployeePermissionGrant.deleteMany({}),
      EmployeePermissionRestriction.deleteMany({}),
      TaxRule.deleteMany({ name: /^Batch2B_/ }),
    ]);
    await mongoose.disconnect();
  });

  describe("1. Scope & Mechanical Route Registry Reconciliation", () => {
    test("Batch 2B migration backlog contains exactly 3 Tax Rule mutation endpoints", () => {
      expect(BATCH_2B_MUTATION_ROUTES).toHaveLength(3);
      expect(BATCH_2B_MUTATION_ROUTES.map((r) => `${r.method} ${r.path}`)).toEqual([
        "POST /api/v1/tax/rules",
        `PUT /api/v1/tax/rules/${testId}`,
        `DELETE /api/v1/tax/rules/${testId}`,
      ]);
    });

    test("The full protected Tax Rule family contains exactly 5 endpoints (2 Batch 1 reads + 3 Batch 2B mutations)", () => {
      expect(TAX_RULE_PROTECTED_ROUTES).toHaveLength(5);
      const readRoutes = TAX_RULE_PROTECTED_ROUTES.filter(
        (r) => r.requiredPermission === PERMISSIONS.TAX_READ
      );
      expect(readRoutes).toHaveLength(2);
      const mutationRoutes = TAX_RULE_PROTECTED_ROUTES.filter(
        (r) => r.requiredPermission === PERMISSIONS.TAX_MANAGE
      );
      expect(mutationRoutes).toHaveLength(3);
    });

    test("mechanically reconciles actual tax.routes.js Express router stack against the canonical registry", () => {
      const taxRouter = require("../src/routes/tax.routes");
      const actualProtectedRoutes = [];

      let routerHasAuth = false;
      for (const layer of taxRouter.stack) {
        if (!layer.route) {
          if (layer.name === "authenticate") routerHasAuth = true;
          continue;
        }

        // Skip non-admin customer quote endpoint (/preview)
        if (layer.route.path === "/preview") continue;

        const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase());
        const routePath = `/api/v1/tax${layer.route.path}`;

        for (const method of methods) {
          const expectedPerm =
            method === "GET" ? PERMISSIONS.TAX_READ : PERMISSIONS.TAX_MANAGE;
          actualProtectedRoutes.push({
            method,
            fullPath: routePath,
            requiredPermission: expectedPerm,
          });
        }
      }

      // Assert exactly 5 protected endpoints in tax.routes.js
      expect(actualProtectedRoutes).toHaveLength(5);

      // Verify every actual route matches an entry in TAX_RULE_PROTECTED_ROUTES
      for (const actual of actualProtectedRoutes) {
        const regexStr = "^" + actual.fullPath.replace(/\/:[a-zA-Z0-9_-]+/g, "/[^/]+") + "$";
        const rx = new RegExp(regexStr);
        const match = TAX_RULE_PROTECTED_ROUTES.find(
          (tr) => tr.method === actual.method && rx.test(tr.path)
        );
        expect(match).toBeDefined();
        expect(match.requiredPermission).toBe(actual.requiredPermission);
      }
    });
  });

  describe("2. Systematic Route Authorization Enforcement on All 5 Endpoints", () => {
    test.each(TAX_RULE_PROTECTED_ROUTES)(
      "$method $path ($name) enforces authentication (401)",
      async ({ method, path }) => {
        const res = await dispatchRequest(method, path);
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
      }
    );

    test.each(TAX_RULE_PROTECTED_ROUTES)(
      "$method $path ($name) rejects authenticated staff without $requiredPermission (403)",
      async ({ method, path, requiredPermission }) => {
        // Create staff with an unrelated permission (e.g. products:read)
        const { employee, token } = await createTestEmployee();
        await assignRoleWithPermissions(
          employee._id,
          `test_batch2b_unauth_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          [PERMISSIONS.PRODUCTS_READ]
        );

        // Dispatches request with empty body or dummy data to prove auth check occurs BEFORE schema validation
        const res = await dispatchRequest(method, path, token, {});
        expect(res.status).toBe(403);
        expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
      }
    );

    test.each(TAX_RULE_PROTECTED_ROUTES)(
      "$method $path ($name) authorizes staff with dynamic role granting $requiredPermission",
      async ({ method, path, requiredPermission }) => {
        const { employee, token } = await createTestEmployee();
        await assignRoleWithPermissions(
          employee._id,
          `test_batch2b_auth_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          [requiredPermission]
        );

        let body = null;
        if (method === "POST") {
          body = {
            name: `Batch2B_Rule_${Date.now()}`,
            country: "US",
            rate: 7.5,
          };
        } else if (method === "PUT") {
          body = {
            name: `Batch2B_Rule_Update_${Date.now()}`,
          };
        }

        const res = await dispatchRequest(method, path, token, body);
        // Should pass authorization.
        // Status code is 200, 201, or 404 (if resource ID was random testId not in DB)
        // It MUST NEVER be 401 or 403!
        expect([200, 201, 404]).toContain(res.status);
        expect(res.status).not.toBe(401);
        expect(res.status).not.toBe(403);
      }
    );
  });

  describe("3. Dynamic PBAC Priority & Invariant Tests on Tax Rule Operations", () => {
    test("1. Direct Grant for tax:read authorizes read access without role assignment", async () => {
      const { user, employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.TAX_READ);

      await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: perm._id,
        grantedBy: user._id,
        expiresAt: null,
      });

      const res = await dispatchRequest("GET", "/api/v1/tax/rules", token);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("2. Direct Grant for tax:manage authorizes mutation access without role assignment", async () => {
      const { user, employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.TAX_MANAGE);

      await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: perm._id,
        grantedBy: user._id,
        expiresAt: null,
      });

      const res = await dispatchRequest("POST", "/api/v1/tax/rules", token, {
        name: `Batch2B_DirectGrant_${Date.now()}`,
        country: "CA",
        rate: 5.0,
      });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    test("3. Direct Restriction overrides role permission for tax:read (Restriction Dominance)", async () => {
      const { user, employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2b_restr_read_${Date.now()}`,
        [PERMISSIONS.TAX_READ]
      );

      const perm = await getOrCreatePermission(PERMISSIONS.TAX_READ);
      await EmployeePermissionRestriction.create({
        employeeId: employee._id,
        permissionId: perm._id,
        restrictedBy: user._id,
        reason: "Compliance audit block",
        expiresAt: null,
      });

      const res = await dispatchRequest("GET", "/api/v1/tax/rules", token);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("4. Direct Restriction overrides role permission for tax:manage (Restriction Dominance)", async () => {
      const { user, employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2b_restr_manage_${Date.now()}`,
        [PERMISSIONS.TAX_MANAGE]
      );

      const perm = await getOrCreatePermission(PERMISSIONS.TAX_MANAGE);
      await EmployeePermissionRestriction.create({
        employeeId: employee._id,
        permissionId: perm._id,
        restrictedBy: user._id,
        reason: "Mutation moratorium",
        expiresAt: null,
      });

      const res = await dispatchRequest("POST", "/api/v1/tax/rules", token, {
        name: `Batch2B_Blocked_${Date.now()}`,
        country: "US",
        rate: 8.0,
      });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("5. Multiple active roles union permissions across tax:read and tax:manage", async () => {
      const { employee, token } = await createTestEmployee();

      // Role 1 provides tax:read
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2b_role_read_${Date.now()}`,
        [PERMISSIONS.TAX_READ]
      );
      // Role 2 provides tax:manage
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2b_role_manage_${Date.now()}`,
        [PERMISSIONS.TAX_MANAGE]
      );

      // Both read and mutation should succeed
      const readRes = await dispatchRequest("GET", "/api/v1/tax/rules", token);
      expect(readRes.status).toBe(200);

      const mutRes = await dispatchRequest("POST", "/api/v1/tax/rules", token, {
        name: `Batch2B_Union_${Date.now()}`,
        country: "GB",
        rate: 20.0,
      });
      expect(mutRes.status).toBe(201);
    });

    test("6. Expired role assignment drops permission and yields 403", async () => {
      const { employee, token } = await createTestEmployee();
      const role = await Role.create({
        slug: `test_batch2b_expired_role_${Date.now()}`,
        name: "Expired Role",
        description: "Expired",
        isActive: true,
      });

      const perm = await getOrCreatePermission(PERMISSIONS.TAX_READ);
      await RolePermission.create({ roleId: role._id, permissionId: perm._id });

      // Expired 10 seconds ago
      await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role._id,
        isActive: true,
        expiresAt: new Date(Date.now() - 10000),
      });

      const res = await dispatchRequest("GET", "/api/v1/tax/rules", token);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("7. Expired direct grant drops permission and yields 403", async () => {
      const { user, employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.TAX_MANAGE);

      // Expired 5 seconds ago
      await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: perm._id,
        grantedBy: user._id,
        expiresAt: new Date(Date.now() - 5000),
      });

      const res = await dispatchRequest("POST", "/api/v1/tax/rules", token, {
        name: `Batch2B_ExpiredGrant_${Date.now()}`,
        country: "US",
        rate: 6.0,
      });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("8. Suspended employee receives 403 even with active role permissions", async () => {
      const { employee, token } = await createTestEmployee({ status: "suspended" });
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2b_suspended_${Date.now()}`,
        [PERMISSIONS.TAX_READ]
      );

      const res = await dispatchRequest("GET", "/api/v1/tax/rules", token);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("9. Terminated employee receives 403 even with active role permissions", async () => {
      const { employee, token } = await createTestEmployee({ status: "terminated" });
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2b_terminated_${Date.now()}`,
        [PERMISSIONS.TAX_READ]
      );

      const res = await dispatchRequest("GET", "/api/v1/tax/rules", token);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("10. Stale permissionVersion triggers authoritative dynamic DB resolution", async () => {
      const { user, employee, token: staleToken } = await createTestEmployee();
      // Initially no role assigned. Now assign role with tax:read and increment user's permissionVersion in DB
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2b_fresh_perm_${Date.now()}`,
        [PERMISSIONS.TAX_READ]
      );

      // Increment DB version so the token's permissionVersion (1) is stale compared to DB (2)
      await incrementPermissionVersion(user._id);

      // Request with stale token forces authorization middleware to dynamically fetch authoritative DB permissions
      const res = await dispatchRequest("GET", "/api/v1/tax/rules", staleToken);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("11. Stale authVersion terminates session with 401 AUTH_VERSION_MISMATCH", async () => {
      const { user, employee, token: staleToken } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2b_stale_auth_${Date.now()}`,
        [PERMISSIONS.TAX_READ]
      );

      // Invalidate session by incrementing authVersion in DB
      await incrementAuthVersion(user._id);

      const res = await dispatchRequest("GET", "/api/v1/tax/rules", staleToken);
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("AUTH_VERSION_MISMATCH");
    });

    test("12. Customer token cannot access protected Tax Rule routes (403)", async () => {
      const { token } = await createTestCustomer();

      const readRes = await dispatchRequest("GET", "/api/v1/tax/rules", token);
      expect(readRes.status).toBe(403);
      expect(readRes.body.code).toBe("INSUFFICIENT_PERMISSIONS");

      const mutRes = await dispatchRequest("POST", "/api/v1/tax/rules", token, {
        name: "Customer Attempt",
        country: "US",
        rate: 5.0,
      });
      expect(mutRes.status).toBe(403);
      expect(mutRes.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("13. Vendor token cannot access protected Tax Rule routes (403)", async () => {
      const { token } = await createTestVendor();

      const readRes = await dispatchRequest("GET", "/api/v1/tax/rules", token);
      expect(readRes.status).toBe(403);
      expect(readRes.body.code).toBe("INSUFFICIENT_PERMISSIONS");

      const mutRes = await dispatchRequest("POST", "/api/v1/tax/rules", token, {
        name: "Vendor Attempt",
        country: "US",
        rate: 5.0,
      });
      expect(mutRes.status).toBe(403);
      expect(mutRes.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });
  });

  describe("4. Customer Tax Preview Quote Endpoint (POST /api/v1/tax/preview)", () => {
    test("rejects unauthenticated requests with 401", async () => {
      const res = await dispatchRequest("POST", "/api/v1/tax/preview", null, {});
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
    });

    test("allows customer tokens without admin permissions (does not return 403)", async () => {
      const { token } = await createTestCustomer();
      // Empty body will trigger 400 validation error, but NOT 403 INSUFFICIENT_PERMISSIONS
      const res = await dispatchRequest("POST", "/api/v1/tax/preview", token, {});
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
      expect(res.status).toBe(400); // Validation error proves authentication passed and route is accessible to customer
    });
  });
});
