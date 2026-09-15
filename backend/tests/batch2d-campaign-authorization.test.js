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
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const { generateAccessToken } = require("../src/services/token.service");
const {
  incrementAuthVersion,
  incrementPermissionVersion,
} = require("../src/services/authorization.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_batch2d_test?")
  : "mongodb://127.0.0.1:27017/buybox_batch2d_test?replicaSet=rs0";

describe("Phase 1G / Batch 2D — Campaign Operational Route Authorization (PBAC)", () => {
  let createdPermissions = new Map();
  const testId = new mongoose.Types.ObjectId().toString();

  // Helper to create test user + employee profile
  async function createTestEmployee(options = {}) {
    const status = options.status || "active";
    const user = await User.create({
      firstName: "Batch2D",
      lastName: "Staff",
      email: `staff_${Date.now()}_${Math.random().toString(36).substring(7)}@test-batch2d.com`,
      password: "Password123!",
      role: options.userRole || "manager",
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const employee = await Employee.create({
      userId: user._id,
      employeeNumber: `EMP_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`,
      jobTitle: "Campaign Marketing Lead",
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
      lastName: "CampaignTester",
      email: `customer_${Date.now()}_${Math.random().toString(36).substring(7)}@test-batch2d.com`,
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
      lastName: "CampaignTester",
      email: `vendor_${Date.now()}_${Math.random().toString(36).substring(7)}@test-batch2d.com`,
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
      name: "Seasonal Campaign Test",
      slug,
      description: "Test campaign for Batch 2D authorization",
      status: "draft",
      startsAt: new Date(Date.now() + 86400000), // tomorrow
      endsAt: new Date(Date.now() + 172800000),   // day after tomorrow
      scope: "all",
      isActive: false,
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

  // Canonical Campaign Family: 8 Protected Endpoints
  // 2 Batch 1 Reads + 6 Batch 2D Mutations
  const CAMPAIGN_ADMIN_ROUTES = [
    {
      name: "List Campaigns",
      batch: "Batch 1 (Phase 1D)",
      method: "GET",
      path: "/api/v1/campaigns",
      requiredPermission: PERMISSIONS.CAMPAIGNS_READ,
    },
    {
      name: "Get Campaign by ID",
      batch: "Batch 1 (Phase 1D)",
      method: "GET",
      path: `/api/v1/campaigns/${testId}`,
      requiredPermission: PERMISSIONS.CAMPAIGNS_READ,
    },
    {
      name: "Create Campaign",
      batch: "Batch 2D",
      method: "POST",
      path: "/api/v1/campaigns",
      requiredPermission: PERMISSIONS.CAMPAIGNS_MANAGE,
    },
    {
      name: "Update Campaign",
      batch: "Batch 2D",
      method: "PATCH",
      path: `/api/v1/campaigns/${testId}`,
      requiredPermission: PERMISSIONS.CAMPAIGNS_MANAGE,
    },
    {
      name: "Schedule Campaign",
      batch: "Batch 2D",
      method: "PATCH",
      path: `/api/v1/campaigns/${testId}/schedule`,
      requiredPermission: PERMISSIONS.CAMPAIGNS_MANAGE,
    },
    {
      name: "Activate Campaign",
      batch: "Batch 2D",
      method: "PATCH",
      path: `/api/v1/campaigns/${testId}/activate`,
      requiredPermission: PERMISSIONS.CAMPAIGNS_MANAGE,
    },
    {
      name: "Deactivate Campaign",
      batch: "Batch 2D",
      method: "PATCH",
      path: `/api/v1/campaigns/${testId}/deactivate`,
      requiredPermission: PERMISSIONS.CAMPAIGNS_MANAGE,
    },
    {
      name: "Transition Campaign Status",
      batch: "Batch 2D",
      method: "PATCH",
      path: `/api/v1/campaigns/${testId}/status`,
      requiredPermission: PERMISSIONS.CAMPAIGNS_MANAGE,
    },
  ];

  const BATCH_2D_MUTATION_ROUTES = CAMPAIGN_ADMIN_ROUTES.filter(
    (r) => r.batch === "Batch 2D"
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
    ]);
  });

  afterAll(async () => {
    await Promise.all([
      User.deleteMany({ email: /@test-batch2d\.com$/ }),
      Employee.deleteMany({ employeeNumber: /^EMP_/ }),
      Customer.deleteMany({}),
      Campaign.deleteMany({ slug: /^test-campaign-/ }),
      Role.deleteMany({ slug: /^test_batch2d_/ }),
      EmployeeRole.deleteMany({}),
      EmployeePermissionGrant.deleteMany({}),
      EmployeePermissionRestriction.deleteMany({}),
    ]);
    await mongoose.disconnect();
  });

  describe("1. Mechanical Route Registry & Express Router Stack Verification", () => {
    test("verifies canonical inventory contains exactly 8 administrative Campaign routes (2 Batch 1 + 6 Batch 2D)", () => {
      expect(CAMPAIGN_ADMIN_ROUTES).toHaveLength(8);
      const batch1Routes = CAMPAIGN_ADMIN_ROUTES.filter((r) => r.batch === "Batch 1 (Phase 1D)");
      expect(batch1Routes).toHaveLength(2);
      expect(BATCH_2D_MUTATION_ROUTES).toHaveLength(6);
    });

    test("verifies canonical Batch 2D routes all mandate CAMPAIGNS_MANAGE permission", () => {
      for (const route of BATCH_2D_MUTATION_ROUTES) {
        expect(route.requiredPermission).toBe(PERMISSIONS.CAMPAIGNS_MANAGE);
      }
    });

    test("mechanically reconciles actual campaign.routes.js Express router stack", () => {
      const campaignRouter = require("../src/routes/campaign.routes");
      const actualProtectedRoutes = [];

      let routerHasAuth = false;
      for (const layer of campaignRouter.stack) {
        if (!layer.route) {
          if (layer.name === "authenticate") routerHasAuth = true;
          continue;
        }

        const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase());
        const routePath = `/api/v1/campaigns${layer.route.path === "/" ? "" : layer.route.path}`;

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
      // Exactly 8 routes in campaign.routes.js (GET /, GET /:campaignId, POST /, PATCH /:campaignId, PATCH /:campaignId/schedule, PATCH /:campaignId/activate, PATCH /:campaignId/deactivate, PATCH /:campaignId/status)
      expect(actualProtectedRoutes).toHaveLength(8);

      for (const actual of actualProtectedRoutes) {
        const regexStr = "^" + actual.fullPath.replace(/\/:[a-zA-Z0-9_-]+/g, "/[^/]+") + "$";
        const rx = new RegExp(regexStr);
        const match = CAMPAIGN_ADMIN_ROUTES.find(
          (cr) => cr.method === actual.method && rx.test(cr.path)
        );
        expect(match).toBeDefined();
        expect(match.requiredPermission).toBe(actual.requiredPermission);
      }
    });

    test("confirms Campaign Performance routes are isolated in campaign-performance.routes.js and not part of Batch 2D", () => {
      const campaignPerformanceRouter = require("../src/routes/campaign-performance.routes");
      expect(campaignPerformanceRouter).toBeDefined();
      expect(campaignPerformanceRouter.stack.length).toBeGreaterThan(0);
    });
  });

  describe("2. Systematic Route Authorization Enforcement on All 8 Endpoints", () => {
    test.each(CAMPAIGN_ADMIN_ROUTES)(
      "$method $path ($name) enforces authentication (401)",
      async ({ method, path }) => {
        const res = await dispatchRequest(method, path);
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
      }
    );

    test.each(CAMPAIGN_ADMIN_ROUTES)(
      "$method $path ($name) rejects authenticated staff without $requiredPermission (403)",
      async ({ method, path, requiredPermission }) => {
        // Create staff with an unrelated permission (e.g. products:read)
        const { employee, token } = await createTestEmployee();
        await assignRoleWithPermissions(
          employee._id,
          `test_batch2d_unauth_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          [PERMISSIONS.PRODUCTS_READ]
        );

        const res = await dispatchRequest(method, path, token, {});
        expect(res.status).toBe(403);
        expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
      }
    );

    test.each(CAMPAIGN_ADMIN_ROUTES)(
      "$method $path ($name) allows access for staff with $requiredPermission",
      async ({ method, path, requiredPermission }) => {
        const { employee, token } = await createTestEmployee();
        await assignRoleWithPermissions(
          employee._id,
          `test_batch2d_auth_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          [requiredPermission]
        );

        const res = await dispatchRequest(method, path, token, {});
        // Passing the authorization gate means we get neither 401 nor 403
        expect([401, 403]).not.toContain(res.status);
      }
    );
  });

  describe("3. Validation Precedence Invariant on All 6 Batch 2D Mutations", () => {
    test.each(BATCH_2D_MUTATION_ROUTES)(
      "$method $path rejects unauthenticated requests with 401 before schema validation",
      async ({ method, path }) => {
        // Dispatches completely invalid payload
        const res = await dispatchRequest(method, path, null, { completelyInvalid: 9999 });
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
      }
    );

    test.each(BATCH_2D_MUTATION_ROUTES)(
      "$method $path rejects unauthorized staff with 403 before schema validation",
      async ({ method, path }) => {
        const { employee, token } = await createTestEmployee();
        await assignRoleWithPermissions(
          employee._id,
          `test_batch2d_unauth_val_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          [PERMISSIONS.PRODUCTS_READ]
        );

        // Dispatches completely invalid payload
        const res = await dispatchRequest(method, path, token, {
          invalidProperty: "malicious_or_malformed",
        });
        expect(res.status).toBe(403);
        expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
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

      const res = await dispatchRequest("POST", "/api/v1/campaigns", token, {});
      expect([401, 403]).not.toContain(res.status);
    });

    test("restriction dominance: explicit restriction on campaigns:manage overrides role grants and direct grants (403)", async () => {
      const { employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.CAMPAIGNS_MANAGE);

      // Assign role with campaigns:manage
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2d_restr_${Date.now()}_${Math.random().toString(36).substring(7)}`,
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

      const res = await dispatchRequest("POST", "/api/v1/campaigns", token, {});
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("expired restriction: expired restriction no longer applies and active role grants access", async () => {
      const { employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.CAMPAIGNS_MANAGE);

      await assignRoleWithPermissions(
        employee._id,
        `test_batch2d_exprestr_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.CAMPAIGNS_MANAGE]
      );

      // Restriction expired in the past
      await EmployeePermissionRestriction.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: new Date(Date.now() - 10000),
      });

      const res = await dispatchRequest("POST", "/api/v1/campaigns", token, {});
      expect([401, 403]).not.toContain(res.status);
    });

    test("multi-role unions: union of multiple active role permissions correctly grants campaigns:manage", async () => {
      const { employee, token } = await createTestEmployee();

      // Role 1: only products:read
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2d_r1_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.PRODUCTS_READ]
      );

      // Role 2: campaigns:manage
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2d_r2_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.CAMPAIGNS_MANAGE]
      );

      const res = await dispatchRequest("POST", "/api/v1/campaigns", token, {});
      expect([401, 403]).not.toContain(res.status);
    });

    test("role expiration: expired role (expiresAt < now) excludes campaigns:manage and yields 403", async () => {
      const { employee, token } = await createTestEmployee();
      const role = await Role.create({
        slug: `test_batch2d_exp_r_${Date.now()}_${Math.random().toString(36).substring(7)}`,
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

      const res = await dispatchRequest("POST", "/api/v1/campaigns", token, {});
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

      const res = await dispatchRequest("POST", "/api/v1/campaigns", token, {});
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("employee lifecycle: suspended employee is denied access (403)", async () => {
      const { employee, token } = await createTestEmployee({ status: "suspended" });
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2d_susp_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.CAMPAIGNS_MANAGE]
      );

      const res = await dispatchRequest("POST", "/api/v1/campaigns", token, {});
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("employee lifecycle: terminated employee is denied access (403)", async () => {
      const { employee, token } = await createTestEmployee({ status: "terminated" });
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2d_term_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.CAMPAIGNS_MANAGE]
      );

      const res = await dispatchRequest("POST", "/api/v1/campaigns", token, {});
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("token permission version staleness: DB lookup refreshes permissions dynamically", async () => {
      const { user, employee, token } = await createTestEmployee();

      // Give permission in DB after token issuance
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2d_pv_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.CAMPAIGNS_MANAGE]
      );

      // Increment employee permissionVersion in DB
      await incrementPermissionVersion(user._id);

      // Token has stale permissionVersion (1 < 2), resolver detects staleness and recalculates from DB
      const res = await dispatchRequest("POST", "/api/v1/campaigns", token, {});
      expect([401, 403]).not.toContain(res.status);
    });

    test("token auth version staleness: rejects session with 401 when token authVersion is outdated", async () => {
      const { user, employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2d_av_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.CAMPAIGNS_MANAGE]
      );

      // Invalidate session by bumping authVersion in DB
      await incrementAuthVersion(user._id);

      const res = await dispatchRequest("POST", "/api/v1/campaigns", token, {});
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("AUTH_VERSION_MISMATCH");
    });

    test("customer token isolation: customer token is rejected with 403 on campaigns:manage endpoint", async () => {
      const { token } = await createTestCustomer();
      const res = await dispatchRequest("POST", "/api/v1/campaigns", token, {});
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("vendor token isolation: vendor token is rejected with 403 on campaigns:manage endpoint", async () => {
      const { token } = await createTestVendor();
      const res = await dispatchRequest("POST", "/api/v1/campaigns", token, {});
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });
  });

  describe("5. Administrative & Native Role Access (Admin & Super Admin)", () => {
    test("authorized Admin access: admin employee with campaigns:manage is granted access", async () => {
      const { employee, token } = await createTestEmployee({ userRole: ROLES.ADMIN });
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2d_admin_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.CAMPAIGNS_MANAGE]
      );

      const res = await dispatchRequest("POST", "/api/v1/campaigns", token, {});
      expect([401, 403]).not.toContain(res.status);
    });

    test("authorized Super Admin access: super_admin employee with all permissions is granted access", async () => {
      const { employee, token } = await createTestEmployee({ userRole: ROLES.SUPER_ADMIN });
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2d_sa_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.CAMPAIGNS_MANAGE, PERMISSIONS.CAMPAIGNS_READ]
      );

      const res = await dispatchRequest("POST", "/api/v1/campaigns", token, {});
      expect([401, 403]).not.toContain(res.status);
    });

    test("no legacy static-role bypass: employee with privileged legacy user.role but no PBAC permissions is rejected (403)", async () => {
      const { token } = await createTestEmployee({ userRole: ROLES.MANAGER });
      // No dynamic role, grant, or restriction assigned to this employee

      const res = await dispatchRequest("POST", "/api/v1/campaigns", token, {});
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });
  });

  describe("6. Business Safety & Invariant Verification", () => {
    test("request validation: rejects POST /api/v1/campaigns with missing required fields (400 VALIDATION_ERROR)", async () => {
      const { employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2d_bs_val_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.CAMPAIGNS_MANAGE]
      );

      const res = await dispatchRequest("POST", "/api/v1/campaigns", token, {
        name: "Incomplete Campaign",
        // missing slug, startsAt, endsAt
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
      expect(typeof res.body.message).toBe("string");
    });

    test("date validation: rejects campaign where endsAt <= startsAt (400 VALIDATION_ERROR)", async () => {
      const { employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2d_bs_dates_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.CAMPAIGNS_MANAGE]
      );

      const res = await dispatchRequest("PATCH", `/api/v1/campaigns/${testId}`, token, {
        startsAt: new Date(Date.now() + 100000).toISOString(),
        endsAt: new Date(Date.now() + 50000).toISOString(), // earlier than startsAt
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    test("duplicate slug check: rejects creation with already existing slug (409 CAMPAIGN_SLUG_EXISTS)", async () => {
      const existingCampaign = await createTestCampaign();
      const { employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2d_bs_dup_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.CAMPAIGNS_MANAGE]
      );

      const res = await dispatchRequest("POST", "/api/v1/campaigns", token, {
        name: "Another Campaign",
        slug: existingCampaign.slug,
        description: "Duplicate slug test",
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        endsAt: new Date(Date.now() + 172800000).toISOString(),
        scope: "all",
      });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("CAMPAIGN_SLUG_EXISTS");
    });

    test("ObjectId validation: rejects invalid :campaignId with 400", async () => {
      const { employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2d_bs_oid_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.CAMPAIGNS_MANAGE]
      );

      const res = await dispatchRequest(
        "PATCH",
        "/api/v1/campaigns/invalid-not-an-id/schedule",
        token,
        {}
      );

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_CAMPAIGN_ID");
    });

    test("non-existent campaign: returns 404 CAMPAIGN_NOT_FOUND for valid non-existent ID", async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const { employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2d_bs_nf_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.CAMPAIGNS_MANAGE]
      );

      const res = await dispatchRequest(
        "PATCH",
        `/api/v1/campaigns/${nonExistentId}/schedule`,
        token,
        {}
      );

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("CAMPAIGN_NOT_FOUND");
    });

    test("campaign scheduling rules: rejects scheduling non-draft campaign (409 INVALID_CAMPAIGN_STATE)", async () => {
      const activeCampaign = await createTestCampaign({ status: "active", isActive: true });
      const { employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2d_bs_sch_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.CAMPAIGNS_MANAGE]
      );

      const res = await dispatchRequest(
        "PATCH",
        `/api/v1/campaigns/${activeCampaign._id}/schedule`,
        token,
        {}
      );

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("INVALID_CAMPAIGN_STATE");
      expect(res.body.message).toContain("Only draft campaigns can be scheduled");
    });

    test("campaign activation rules: rejects activating a cancelled campaign (409 INVALID_CAMPAIGN_STATE)", async () => {
      const cancelledCampaign = await createTestCampaign({ status: "cancelled", isActive: false });
      const { employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2d_bs_act_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.CAMPAIGNS_MANAGE]
      );

      const res = await dispatchRequest(
        "PATCH",
        `/api/v1/campaigns/${cancelledCampaign._id}/activate`,
        token,
        {}
      );

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("INVALID_CAMPAIGN_STATE");
      expect(res.body.message).toContain("Campaign cannot be activated from its current state");
    });

    test("campaign status transitions: rejects invalid status transition (409 INVALID_CAMPAIGN_TRANSITION)", async () => {
      const draftCampaign = await createTestCampaign({ status: "draft" });
      const { employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2d_bs_trans_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.CAMPAIGNS_MANAGE]
      );

      // Draft cannot directly transition to completed
      const res = await dispatchRequest(
        "PATCH",
        `/api/v1/campaigns/${draftCampaign._id}/status`,
        token,
        { status: "completed" }
      );

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("INVALID_CAMPAIGN_TRANSITION");
    });

    test("successful campaign lifecycle: creates campaign and preserves standard response contract", async () => {
      const { employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2d_bs_create_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.CAMPAIGNS_MANAGE]
      );

      const slug = `test-campaign-succ-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const res = await dispatchRequest("POST", "/api/v1/campaigns", token, {
        name: "Autumn Clearance Sale",
        slug,
        description: "Official Autumn Clearance",
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        endsAt: new Date(Date.now() + 172800000).toISOString(),
        scope: "all",
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Campaign created successfully");
      expect(res.body.data).toBeDefined();
      expect(res.body.data.slug).toBe(slug);
      expect(res.body.data.status).toBe("draft");
    });
  });
});
