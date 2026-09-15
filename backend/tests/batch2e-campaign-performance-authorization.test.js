const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Employee = require("../src/models/Employee");
const Customer = require("../src/models/Customer");
const Role = require("../src/models/Role");
const Permission = require("../src/models/Permission");
const RolePermission = require("../src/models/RolePermission");
const EmployeeRole = require("../src/models/EmployeeRole");
const EmployeePermissionGrant = require("../src/models/EmployeePermissionGrant");
const EmployeePermissionRestriction = require("../src/models/EmployeePermissionRestriction");
const Campaign = require("../src/models/Campaign");
const CampaignPerformance = require("../src/models/CampaignPerformance");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const { generateAccessToken } = require("../src/services/token.service");
const {
  incrementAuthVersion,
  incrementPermissionVersion,
} = require("../src/services/authorization.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_batch2e_test?")
  : "mongodb://127.0.0.1:27017/buybox_batch2e_test?replicaSet=rs0";

describe("Phase 1G / Batch 2E — Campaign Performance Operational Route Authorization (PBAC)", () => {
  let createdPermissions = new Map();
  const testId = new mongoose.Types.ObjectId().toString();

  // Helper to create test user + employee profile
  async function createTestEmployee(options = {}) {
    const status = options.status || "active";
    const user = await User.create({
      firstName: "Batch2E",
      lastName: "Staff",
      email: `staff_${Date.now()}_${Math.random().toString(36).substring(7)}@test-batch2e.com`,
      password: "Password123!",
      role: options.userRole || "manager",
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const employee = await Employee.create({
      userId: user._id,
      employeeNumber: `EMP_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`,
      jobTitle: "Performance Marketing Analyst",
      department: "Marketing",
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

  // Helper to create customer user + customer profile
  async function createTestCustomer() {
    const user = await User.create({
      firstName: "Customer",
      lastName: "PerfTester",
      email: `customer_${Date.now()}_${Math.random().toString(36).substring(7)}@test-batch2e.com`,
      password: "Password123!",
      role: ROLES.CUSTOMER,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const customer = await Customer.create({
      userId: user._id,
      isActive: true,
    });

    const token = generateAccessToken({
      sub: user._id.toString(),
      role: user.role,
      authVersion: user.authVersion,
      permissionVersion: user.permissionVersion,
    });

    return { user, customer, token };
  }

  // Helper to create vendor user
  async function createTestVendor() {
    const user = await User.create({
      firstName: "Vendor",
      lastName: "PerfTester",
      email: `vendor_${Date.now()}_${Math.random().toString(36).substring(7)}@test-batch2e.com`,
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

  // Helper to assign dynamic role to employee
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

  // Helper to create sample Campaign document
  async function createTestCampaign(overrides = {}) {
    const slug = `test-campaign-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    return Campaign.create({
      name: "Campaign For Performance Test",
      slug,
      description: "Test campaign for performance metrics",
      status: "active",
      startsAt: new Date(Date.now() - 86400000), // yesterday
      endsAt: new Date(Date.now() + 86400000),   // tomorrow
      scope: "all",
      isActive: true,
      ...overrides,
    });
  }

  // Helper to create sample CampaignPerformance document
  async function createTestPerformance(overrides = {}) {
    let campaignId = overrides.campaignId;
    if (!campaignId) {
      const campaign = await createTestCampaign();
      campaignId = campaign._id;
    }

    const date = overrides.date ? new Date(overrides.date) : new Date();
    date.setUTCHours(0, 0, 0, 0);

    return CampaignPerformance.create({
      campaignId,
      date,
      impressions: 100,
      redemptions: 10,
      orders: 5,
      unitsSold: 8,
      grossRevenue: "500.00",
      discountAmount: "50.00",
      netRevenue: "450.00",
      currency: "INR",
      ...overrides,
    });
  }

  // Helper to dispatch HTTP request
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

  // Canonical Campaign Performance Family: 4 Protected Endpoints
  // 2 Batch 1 Reads + 2 Batch 2E Mutations
  const CAMPAIGN_PERFORMANCE_ROUTES = [
    {
      name: "Get Campaign Performance by Campaign",
      batch: "Batch 1 (Phase 1D)",
      method: "GET",
      path: `/api/v1/campaign-performance/campaign/${testId}`,
      requiredPermission: PERMISSIONS.CAMPAIGNS_READ,
    },
    {
      name: "Record Daily Performance",
      batch: "Batch 2E",
      method: "POST",
      path: `/api/v1/campaign-performance/campaign/${testId}`,
      requiredPermission: PERMISSIONS.CAMPAIGNS_MANAGE,
    },
    {
      name: "Get Campaign Performance by ID",
      batch: "Batch 1 (Phase 1D)",
      method: "GET",
      path: `/api/v1/campaign-performance/${testId}`,
      requiredPermission: PERMISSIONS.CAMPAIGNS_READ,
    },
    {
      name: "Increment Daily Performance",
      batch: "Batch 2E",
      method: "PATCH",
      path: `/api/v1/campaign-performance/${testId}/increment`,
      requiredPermission: PERMISSIONS.CAMPAIGNS_MANAGE,
    },
  ];

  const BATCH_2E_MUTATION_ROUTES = CAMPAIGN_PERFORMANCE_ROUTES.filter(
    (r) => r.batch === "Batch 2E"
  );

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI, { autoIndex: true });
    }
    await Promise.all([
      User.init(),
      Employee.init(),
      Customer.init(),
      Role.init(),
      Permission.init(),
      RolePermission.init(),
      EmployeeRole.init(),
      EmployeePermissionGrant.init(),
      EmployeePermissionRestriction.init(),
      Campaign.init(),
      CampaignPerformance.init(),
    ]);
  });

  afterAll(async () => {
    await Promise.all([
      User.deleteMany({ email: /@test-batch2e\.com$/ }),
      Employee.deleteMany({ employeeNumber: /^EMP_/ }),
      Customer.deleteMany({}),
      Campaign.deleteMany({ slug: /^test-campaign-/ }),
      CampaignPerformance.deleteMany({}),
      Role.deleteMany({ slug: /^test_batch2e_/ }),
      EmployeeRole.deleteMany({}),
      EmployeePermissionGrant.deleteMany({}),
      EmployeePermissionRestriction.deleteMany({}),
    ]);
    await mongoose.disconnect();
  });

  describe("1. Mechanical Route Registry & Express Router Stack Verification", () => {
    test("verifies canonical inventory contains exactly 4 administrative routes (2 Batch 1 + 2 Batch 2E)", () => {
      expect(CAMPAIGN_PERFORMANCE_ROUTES).toHaveLength(4);
      const batch1Routes = CAMPAIGN_PERFORMANCE_ROUTES.filter(
        (r) => r.batch === "Batch 1 (Phase 1D)"
      );
      expect(batch1Routes).toHaveLength(2);
      expect(BATCH_2E_MUTATION_ROUTES).toHaveLength(2);
    });

    test("verifies canonical Batch 2E routes all mandate CAMPAIGNS_MANAGE permission", () => {
      for (const route of BATCH_2E_MUTATION_ROUTES) {
        expect(route.requiredPermission).toBe(PERMISSIONS.CAMPAIGNS_MANAGE);
      }
    });

    test("mechanically reconciles actual campaign-performance.routes.js Express router stack", () => {
      const campaignPerformanceRouter = require("../src/routes/campaign-performance.routes");
      const actualProtectedRoutes = [];

      let routerHasAuth = false;
      for (const layer of campaignPerformanceRouter.stack) {
        if (!layer.route) {
          if (layer.name === "authenticate") routerHasAuth = true;
          continue;
        }

        const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase());
        const routePath = `/api/v1/campaign-performance${layer.route.path === "/" ? "" : layer.route.path}`;

        for (const method of methods) {
          const expectedPerm =
            method === "GET" ? PERMISSIONS.CAMPAIGNS_READ : PERMISSIONS.CAMPAIGNS_MANAGE;
          actualProtectedRoutes.push({
            method,
            fullPath: routePath,
            requiredPermission: expectedPerm,
          });
        }
      }

      expect(routerHasAuth).toBe(true);
      // Exactly 4 routes in campaign-performance.routes.js
      expect(actualProtectedRoutes).toHaveLength(4);

      for (const actual of actualProtectedRoutes) {
        const regexStr = "^" + actual.fullPath.replace(/\/:[a-zA-Z0-9_-]+/g, "/[^/]+") + "$";
        const rx = new RegExp(regexStr);
        const match = CAMPAIGN_PERFORMANCE_ROUTES.find(
          (cr) => cr.method === actual.method && rx.test(cr.path)
        );
        expect(match).toBeDefined();
        expect(match.requiredPermission).toBe(actual.requiredPermission);
      }
    });
  });

  describe("2. Systematic Route Authorization Enforcement on All 4 Endpoints", () => {
    test.each(CAMPAIGN_PERFORMANCE_ROUTES)(
      "$method $path ($name) enforces authentication (401)",
      async ({ method, path }) => {
        const res = await dispatchRequest(method, path);
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
      }
    );

    test.each(CAMPAIGN_PERFORMANCE_ROUTES)(
      "$method $path ($name) rejects authenticated staff without $requiredPermission (403)",
      async ({ method, path, requiredPermission }) => {
        // Create staff with an unrelated permission (e.g. products:read)
        const { employee, token } = await createTestEmployee();
        await assignRoleWithPermissions(
          employee._id,
          `test_batch2e_unauth_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          [PERMISSIONS.PRODUCTS_READ]
        );

        const res = await dispatchRequest(method, path, token, {});
        expect(res.status).toBe(403);
        expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
      }
    );

    test.each(CAMPAIGN_PERFORMANCE_ROUTES)(
      "$method $path ($name) allows access for staff with $requiredPermission",
      async ({ method, path, requiredPermission }) => {
        const { employee, token } = await createTestEmployee();
        await assignRoleWithPermissions(
          employee._id,
          `test_batch2e_auth_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          [requiredPermission]
        );

        const res = await dispatchRequest(method, path, token, {});
        // Passing the authorization gate means we get neither 401 nor 403
        expect([401, 403]).not.toContain(res.status);
      }
    );
  });

  describe("3. Middleware Precedence Invariant on Both Batch 2E Mutations", () => {
    test.each(BATCH_2E_MUTATION_ROUTES)(
      "$method $path rejects unauthenticated requests with 401 before schema validation",
      async ({ method }) => {
        // Send request with an invalid param AND invalid body
        const invalidParamPath = method === "POST"
          ? "/api/v1/campaign-performance/campaign/not-a-valid-id"
          : "/api/v1/campaign-performance/not-a-valid-id/increment";

        const res = await dispatchRequest(method, invalidParamPath, null, { completelyInvalid: 9999 });
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
      }
    );

    test.each(BATCH_2E_MUTATION_ROUTES)(
      "$method $path rejects unauthorized staff with 403 before schema validation",
      async ({ method }) => {
        const { employee, token } = await createTestEmployee();
        await assignRoleWithPermissions(
          employee._id,
          `test_batch2e_unauth_val_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          [PERMISSIONS.PRODUCTS_READ]
        );

        // Send request with an invalid param AND invalid body
        const invalidParamPath = method === "POST"
          ? "/api/v1/campaign-performance/campaign/not-a-valid-id"
          : "/api/v1/campaign-performance/not-a-valid-id/increment";

        const res = await dispatchRequest(method, invalidParamPath, token, {
          invalidProperty: "malicious_or_malformed",
        });
        expect(res.status).toBe(403);
        expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
      }
    );

    test.each(BATCH_2E_MUTATION_ROUTES)(
      "$method $path reaches schema validation when staff has required permission",
      async ({ method }) => {
        const { employee, token } = await createTestEmployee();
        await assignRoleWithPermissions(
          employee._id,
          `test_batch2e_auth_val_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          [PERMISSIONS.CAMPAIGNS_MANAGE]
        );

        // Send request with invalid ObjectId param to verify it triggers validator (400) rather than PBAC rejection (403)
        const invalidParamPath = method === "POST"
          ? "/api/v1/campaign-performance/campaign/not-a-valid-id"
          : "/api/v1/campaign-performance/not-a-valid-id/increment";

        const res = await dispatchRequest(method, invalidParamPath, token, {});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("VALIDATION_ERROR");
        expect(res.body.message).toContain("Invalid ObjectId");
      }
    );
  });

  describe("4. Dynamic PBAC Priority & Invariant Tests (CAMPAIGNS_MANAGE)", () => {
    test("direct permission grant: grants access immediately without a predefined role", async () => {
      const { employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.CAMPAIGNS_MANAGE);

      await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: null,
      });

      const res = await dispatchRequest(
        "POST",
        `/api/v1/campaign-performance/campaign/${testId}`,
        token,
        {}
      );
      expect([401, 403]).not.toContain(res.status);
    });

    test("restriction dominance: explicit restriction on campaigns:manage overrides role grants and direct grants (403)", async () => {
      const { employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.CAMPAIGNS_MANAGE);

      // Assign role with campaigns:manage
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2e_restr_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.CAMPAIGNS_MANAGE]
      );

      // Also give direct grant
      await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: null,
      });

      // Apply explicit restriction on campaigns:manage
      await EmployeePermissionRestriction.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: null,
      });

      const res = await dispatchRequest(
        "POST",
        `/api/v1/campaign-performance/campaign/${testId}`,
        token,
        {}
      );
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("expired restriction: expired restriction no longer applies and active role grants access", async () => {
      const { employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.CAMPAIGNS_MANAGE);

      await assignRoleWithPermissions(
        employee._id,
        `test_batch2e_exprestr_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.CAMPAIGNS_MANAGE]
      );

      // Restriction expired in the past
      await EmployeePermissionRestriction.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: new Date(Date.now() - 10000),
      });

      const res = await dispatchRequest(
        "POST",
        `/api/v1/campaign-performance/campaign/${testId}`,
        token,
        {}
      );
      expect([401, 403]).not.toContain(res.status);
    });

    test("multi-role unions: union of multiple active role permissions correctly grants campaigns:manage", async () => {
      const { employee, token } = await createTestEmployee();

      // Role 1: only products:read
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2e_r1_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.PRODUCTS_READ]
      );

      // Role 2: campaigns:manage
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2e_r2_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.CAMPAIGNS_MANAGE]
      );

      const res = await dispatchRequest(
        "POST",
        `/api/v1/campaign-performance/campaign/${testId}`,
        token,
        {}
      );
      expect([401, 403]).not.toContain(res.status);
    });

    test("role expiration: expired role (expiresAt < now) excludes campaigns:manage and yields 403", async () => {
      const { employee, token } = await createTestEmployee();
      const role = await Role.create({
        slug: `test_batch2e_exp_r_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        name: "Expired Role",
        isActive: true,
      });

      const perm = await getOrCreatePermission(PERMISSIONS.CAMPAIGNS_MANAGE);
      await RolePermission.create({
        roleId: role._id,
        permissionId: perm._id,
      });

      await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role._id,
        isActive: true,
        expiresAt: new Date(Date.now() - 10000), // expired in past
      });

      const res = await dispatchRequest(
        "POST",
        `/api/v1/campaign-performance/campaign/${testId}`,
        token,
        {}
      );
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("direct grant expiration: expired direct grant excludes campaigns:manage and yields 403", async () => {
      const { employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.CAMPAIGNS_MANAGE);

      await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: new Date(Date.now() - 10000), // expired in past
      });

      const res = await dispatchRequest(
        "POST",
        `/api/v1/campaign-performance/campaign/${testId}`,
        token,
        {}
      );
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("employee lifecycle: suspended employee is denied access (403)", async () => {
      const { employee, token } = await createTestEmployee({ status: "suspended" });
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2e_susp_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.CAMPAIGNS_MANAGE]
      );

      const res = await dispatchRequest(
        "POST",
        `/api/v1/campaign-performance/campaign/${testId}`,
        token,
        {}
      );
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("employee lifecycle: terminated employee is denied access (403)", async () => {
      const { employee, token } = await createTestEmployee({ status: "terminated" });
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2e_term_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.CAMPAIGNS_MANAGE]
      );

      const res = await dispatchRequest(
        "POST",
        `/api/v1/campaign-performance/campaign/${testId}`,
        token,
        {}
      );
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("token permission version staleness: DB lookup refreshes permissions dynamically", async () => {
      const { user, employee, token } = await createTestEmployee();

      // Give permission in DB after token issuance
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2e_pv_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.CAMPAIGNS_MANAGE]
      );

      // Increment employee permissionVersion in DB
      await incrementPermissionVersion(user._id);

      // Token has stale permissionVersion (1 < 2), resolver detects staleness and recalculates from DB
      const res = await dispatchRequest(
        "POST",
        `/api/v1/campaign-performance/campaign/${testId}`,
        token,
        {}
      );
      expect([401, 403]).not.toContain(res.status);
    });

    test("token auth version staleness: rejects session with 401 when token authVersion is outdated", async () => {
      const { user, employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2e_av_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.CAMPAIGNS_MANAGE]
      );

      // Invalidate session by bumping authVersion in DB
      await incrementAuthVersion(user._id);

      const res = await dispatchRequest(
        "POST",
        `/api/v1/campaign-performance/campaign/${testId}`,
        token,
        {}
      );
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("AUTH_VERSION_MISMATCH");
    });

    test("customer token isolation: customer token is rejected with 403 on campaigns:manage endpoint", async () => {
      const { token } = await createTestCustomer();
      const res = await dispatchRequest(
        "POST",
        `/api/v1/campaign-performance/campaign/${testId}`,
        token,
        {}
      );
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("vendor token isolation: vendor token is rejected with 403 on campaigns:manage endpoint", async () => {
      const { token } = await createTestVendor();
      const res = await dispatchRequest(
        "POST",
        `/api/v1/campaign-performance/campaign/${testId}`,
        token,
        {}
      );
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });
  });

  describe("5. Administrative & Native Role Access (Admin & Super Admin)", () => {
    test("authorized Admin access: admin employee with campaigns:manage is granted access", async () => {
      const { employee, token } = await createTestEmployee({ userRole: ROLES.ADMIN });
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2e_admin_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.CAMPAIGNS_MANAGE]
      );

      const res = await dispatchRequest(
        "POST",
        `/api/v1/campaign-performance/campaign/${testId}`,
        token,
        {}
      );
      expect([401, 403]).not.toContain(res.status);
    });

    test("authorized Super Admin access: super_admin employee with all permissions is granted access", async () => {
      const { employee, token } = await createTestEmployee({ userRole: ROLES.SUPER_ADMIN });
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2e_sa_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.CAMPAIGNS_MANAGE, PERMISSIONS.CAMPAIGNS_READ]
      );

      const res = await dispatchRequest(
        "POST",
        `/api/v1/campaign-performance/campaign/${testId}`,
        token,
        {}
      );
      expect([401, 403]).not.toContain(res.status);
    });

    test("no legacy static-role bypass: employee with privileged legacy user.role but no PBAC permissions is rejected (403)", async () => {
      const { token } = await createTestEmployee({ userRole: ROLES.MANAGER });
      // No dynamic role, grant, or restriction assigned to this employee

      const res = await dispatchRequest(
        "POST",
        `/api/v1/campaign-performance/campaign/${testId}`,
        token,
        {}
      );
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });
  });

  describe("6. Business Safety & Invariant Verification", () => {
    test("invalid campaignId param: rejects POST /campaign/:campaignId with 400 when ID is invalid", async () => {
      const { employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2e_bs_cid_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.CAMPAIGNS_MANAGE]
      );

      const res = await dispatchRequest(
        "POST",
        "/api/v1/campaign-performance/campaign/invalid-id-format",
        token,
        {}
      );

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
      expect(res.body.message).toContain("Invalid ObjectId");
    });

    test("invalid performanceId param: rejects PATCH /:performanceId/increment with 400 when ID is invalid", async () => {
      const { employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2e_bs_pid_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.CAMPAIGNS_MANAGE]
      );

      const res = await dispatchRequest(
        "PATCH",
        "/api/v1/campaign-performance/invalid-id-format/increment",
        token,
        { impressions: 10 }
      );

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
      expect(res.body.message).toContain("Invalid ObjectId");
    });

    test("missing campaign: rejects recording performance for non-existent campaign with 404 CAMPAIGN_NOT_FOUND", async () => {
      const nonExistentCampaignId = new mongoose.Types.ObjectId().toString();
      const { employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2e_bs_nocamp_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.CAMPAIGNS_MANAGE]
      );

      const res = await dispatchRequest(
        "POST",
        `/api/v1/campaign-performance/campaign/${nonExistentCampaignId}`,
        token,
        {
          impressions: 10,
          currency: "INR",
        }
      );

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("CAMPAIGN_NOT_FOUND");
    });

    test("missing performance record: rejects incrementing non-existent performance with 404 CAMPAIGN_PERFORMANCE_NOT_FOUND", async () => {
      const nonExistentPerformanceId = new mongoose.Types.ObjectId().toString();
      const { employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2e_bs_noperf_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.CAMPAIGNS_MANAGE]
      );

      const res = await dispatchRequest(
        "PATCH",
        `/api/v1/campaign-performance/${nonExistentPerformanceId}/increment`,
        token,
        {
          impressions: 5,
        }
      );

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("CAMPAIGN_PERFORMANCE_NOT_FOUND");
    });

    test("invalid increment payload: rejects negative increment numbers (400 VALIDATION_ERROR)", async () => {
      const { employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2e_bs_neginc_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.CAMPAIGNS_MANAGE]
      );

      const res = await dispatchRequest(
        "PATCH",
        `/api/v1/campaign-performance/${testId}/increment`,
        token,
        {
          impressions: -5,
        }
      );

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    test("invalid record payload: rejects invalid currency format (400 VALIDATION_ERROR)", async () => {
      const { employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2e_bs_curr_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.CAMPAIGNS_MANAGE]
      );

      const res = await dispatchRequest(
        "POST",
        `/api/v1/campaign-performance/campaign/${testId}`,
        token,
        {
          currency: "TOOLONGINR",
        }
      );

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    test("valid authorized creation: records daily performance successfully (201)", async () => {
      const campaign = await createTestCampaign();
      const { employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2e_bs_create_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.CAMPAIGNS_MANAGE]
      );

      const res = await dispatchRequest(
        "POST",
        `/api/v1/campaign-performance/campaign/${campaign._id}`,
        token,
        {
          date: new Date().toISOString(),
          currency: "INR",
          impressions: 150,
          redemptions: 12,
          orders: 6,
          unitsSold: 9,
          grossRevenue: "600.00",
          discountAmount: "60.00",
          netRevenue: "540.00",
        }
      );

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Campaign performance recorded successfully");
      expect(res.body.data).toBeDefined();
      expect(res.body.data.campaignId).toBe(campaign._id.toString());
      expect(res.body.data.impressions).toBe(150);
    });

    test("duplicate daily performance resolution: returns existing record idempotently without error", async () => {
      const campaign = await createTestCampaign();
      const performanceDate = new Date();
      performanceDate.setUTCHours(0, 0, 0, 0);

      // Create initial performance record
      const initial = await createTestPerformance({
        campaignId: campaign._id,
        date: performanceDate,
        impressions: 200,
      });

      const { employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2e_bs_dup_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.CAMPAIGNS_MANAGE]
      );

      // Submit record with identical campaign and date
      const res = await dispatchRequest(
        "POST",
        `/api/v1/campaign-performance/campaign/${campaign._id}`,
        token,
        {
          date: performanceDate.toISOString(),
          currency: "INR",
          impressions: 300,
        }
      );

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(initial._id.toString());
      expect(res.body.data.impressions).toBe(200); // Existing untouched
    });

    test("valid authorized increment: increments daily metrics successfully (200)", async () => {
      const performance = await createTestPerformance({
        impressions: 100,
        orders: 10,
        unitsSold: 15,
        redemptions: 5,
      });

      const { employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2e_bs_inc_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.CAMPAIGNS_MANAGE]
      );

      const res = await dispatchRequest(
        "PATCH",
        `/api/v1/campaign-performance/${performance._id}/increment`,
        token,
        {
          impressions: 25,
          orders: 2,
          unitsSold: 3,
          redemptions: 1,
        }
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Campaign performance updated successfully");
      expect(res.body.data).toBeDefined();
      expect(res.body.data._id).toBe(performance._id.toString());
      expect(res.body.data.impressions).toBe(125);
      expect(res.body.data.orders).toBe(12);
      expect(res.body.data.unitsSold).toBe(18);
      expect(res.body.data.redemptions).toBe(6);
    });
  });
});
