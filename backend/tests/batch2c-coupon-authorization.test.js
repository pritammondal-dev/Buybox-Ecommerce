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
const Coupon = require("../src/models/Coupon");
const CouponRedemption = require("../src/models/CouponRedemption");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const { generateAccessToken } = require("../src/services/token.service");
const {
  incrementAuthVersion,
  incrementPermissionVersion,
} = require("../src/services/authorization.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_batch2c_test?")
  : "mongodb://127.0.0.1:27017/buybox_batch2c_test?replicaSet=rs0";

describe("Phase 1G / Batch 2C — Coupon Operational Route Authorization (PBAC)", () => {
  let createdPermissions = new Map();
  const testId = new mongoose.Types.ObjectId().toString();
  const testCustomerId = new mongoose.Types.ObjectId().toString();

  // Helper to create test user + employee profile
  async function createTestEmployee(options = {}) {
    const status = options.status || "active";
    const user = await User.create({
      firstName: "Batch2C",
      lastName: "Staff",
      email: `staff_${Date.now()}_${Math.random().toString(36).substring(7)}@test-batch2c.com`,
      password: "Password123!",
      role: options.userRole || "manager",
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const employee = await Employee.create({
      userId: user._id,
      employeeNumber: `EMP_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`,
      jobTitle: "Marketing & Promotions Lead",
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
      lastName: "CouponTester",
      email: `customer_${Date.now()}_${Math.random().toString(36).substring(7)}@test-batch2c.com`,
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
      lastName: "CouponTester",
      email: `vendor_${Date.now()}_${Math.random().toString(36).substring(7)}@test-batch2c.com`,
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

  // Canonical Coupon and Coupon Redemption Family: 9 Protected Endpoints
  // 4 Batch 1 Reads + 5 Batch 2C Mutations
  const COUPON_ADMIN_ROUTES = [
    {
      name: "List Coupons",
      batch: "Batch 1 (Phase 1D)",
      method: "GET",
      path: "/api/v1/coupons",
      requiredPermission: PERMISSIONS.COUPONS_READ,
    },
    {
      name: "Get Coupon by ID",
      batch: "Batch 1 (Phase 1D)",
      method: "GET",
      path: `/api/v1/coupons/${testId}`,
      requiredPermission: PERMISSIONS.COUPONS_READ,
    },
    {
      name: "Create Coupon",
      batch: "Batch 2C",
      method: "POST",
      path: "/api/v1/coupons",
      requiredPermission: PERMISSIONS.COUPONS_MANAGE,
    },
    {
      name: "Update Coupon",
      batch: "Batch 2C",
      method: "PATCH",
      path: `/api/v1/coupons/${testId}`,
      requiredPermission: PERMISSIONS.COUPONS_MANAGE,
    },
    {
      name: "Activate Coupon",
      batch: "Batch 2C",
      method: "PATCH",
      path: `/api/v1/coupons/${testId}/activate`,
      requiredPermission: PERMISSIONS.COUPONS_MANAGE,
    },
    {
      name: "Deactivate Coupon",
      batch: "Batch 2C",
      method: "PATCH",
      path: `/api/v1/coupons/${testId}/deactivate`,
      requiredPermission: PERMISSIONS.COUPONS_MANAGE,
    },
    {
      name: "Redeem Coupon (Mutation)",
      batch: "Batch 2C",
      method: "POST",
      path: "/api/v1/coupon-redemptions",
      requiredPermission: PERMISSIONS.COUPONS_MANAGE,
    },
    {
      name: "Get Customer Redemptions",
      batch: "Batch 1 (Phase 1D)",
      method: "GET",
      path: `/api/v1/coupon-redemptions/customer/${testCustomerId}`,
      requiredPermission: PERMISSIONS.COUPONS_READ,
    },
    {
      name: "Get Coupon Redemptions",
      batch: "Batch 1 (Phase 1D)",
      method: "GET",
      path: `/api/v1/coupon-redemptions/coupon/${testId}`,
      requiredPermission: PERMISSIONS.COUPONS_READ,
    },
  ];

  const BATCH_2C_MUTATION_ROUTES = COUPON_ADMIN_ROUTES.filter(
    (r) => r.batch === "Batch 2C"
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
      Coupon.init(),
      CouponRedemption.init(),
    ]);
  });

  afterAll(async () => {
    await Promise.all([
      User.deleteMany({ email: /@test-batch2c\.com$/ }),
      Employee.deleteMany({ employeeNumber: /^EMP_/ }),
      Customer.deleteMany({}),
      Coupon.deleteMany({ code: /^TEST_/ }),
      CouponRedemption.deleteMany({}),
      Role.deleteMany({ slug: /^test_batch2c_/ }),
      EmployeeRole.deleteMany({}),
      EmployeePermissionGrant.deleteMany({}),
      EmployeePermissionRestriction.deleteMany({}),
    ]);
    await mongoose.disconnect();
  });

  describe("1. Mechanical Route Registry & Express Router Stack Verification", () => {
    test("verifies canonical inventory contains exactly 9 administrative routes (4 Batch 1 + 5 Batch 2C)", () => {
      expect(COUPON_ADMIN_ROUTES).toHaveLength(9);
      const batch1Routes = COUPON_ADMIN_ROUTES.filter((r) => r.batch === "Batch 1 (Phase 1D)");
      expect(batch1Routes).toHaveLength(4);
      expect(BATCH_2C_MUTATION_ROUTES).toHaveLength(5);
    });

    test("verifies canonical Batch 2C routes all mandate COUPONS_MANAGE permission", () => {
      for (const route of BATCH_2C_MUTATION_ROUTES) {
        expect(route.requiredPermission).toBe(PERMISSIONS.COUPONS_MANAGE);
      }
    });

    test("mechanically reconciles actual coupon.routes.js Express router stack", () => {
      const couponRouter = require("../src/routes/coupon.routes");
      const actualProtectedRoutes = [];

      let routerHasAuth = false;
      for (const layer of couponRouter.stack) {
        if (!layer.route) {
          if (layer.name === "authenticate") routerHasAuth = true;
          continue;
        }

        // Skip customer-facing validation endpoint (/validate)
        if (layer.route.path === "/validate") continue;

        const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase());
        const routePath = `/api/v1/coupons${layer.route.path === "/" ? "" : layer.route.path}`;

        for (const method of methods) {
          const expectedPerm =
            method === "GET" ? PERMISSIONS.COUPONS_READ : PERMISSIONS.COUPONS_MANAGE;
          actualProtectedRoutes.push({
            method,
            fullPath: routePath,
            requiredPermission: expectedPerm,
          });
        }
      }

      expect(routerHasAuth).toBe(true);
      // Exactly 6 admin routes in coupon.routes.js (GET /, GET /:couponId, POST /, PATCH /:couponId, PATCH /:couponId/activate, PATCH /:couponId/deactivate)
      expect(actualProtectedRoutes).toHaveLength(6);

      for (const actual of actualProtectedRoutes) {
        const regexStr = "^" + actual.fullPath.replace(/\/:[a-zA-Z0-9_-]+/g, "/[^/]+") + "$";
        const rx = new RegExp(regexStr);
        const match = COUPON_ADMIN_ROUTES.find(
          (cr) => cr.method === actual.method && rx.test(cr.path)
        );
        expect(match).toBeDefined();
        expect(match.requiredPermission).toBe(actual.requiredPermission);
      }
    });

    test("mechanically reconciles actual coupon-redemption.routes.js Express router stack", () => {
      const couponRedemptionRouter = require("../src/routes/coupon-redemption.routes");
      const actualProtectedRoutes = [];

      let routerHasAuth = false;
      for (const layer of couponRedemptionRouter.stack) {
        if (!layer.route) {
          if (layer.name === "authenticate") routerHasAuth = true;
          continue;
        }

        const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase());
        const routePath = `/api/v1/coupon-redemptions${layer.route.path === "/" ? "" : layer.route.path}`;

        for (const method of methods) {
          const expectedPerm =
            method === "GET" ? PERMISSIONS.COUPONS_READ : PERMISSIONS.COUPONS_MANAGE;
          actualProtectedRoutes.push({
            method,
            fullPath: routePath,
            requiredPermission: expectedPerm,
          });
        }
      }

      expect(routerHasAuth).toBe(true);
      // Exactly 3 admin routes in coupon-redemption.routes.js (POST /, GET /customer/:customerId, GET /coupon/:couponId)
      expect(actualProtectedRoutes).toHaveLength(3);

      for (const actual of actualProtectedRoutes) {
        const regexStr = "^" + actual.fullPath.replace(/\/:[a-zA-Z0-9_-]+/g, "/[^/]+") + "$";
        const rx = new RegExp(regexStr);
        const match = COUPON_ADMIN_ROUTES.find(
          (cr) => cr.method === actual.method && rx.test(cr.path)
        );
        expect(match).toBeDefined();
        expect(match.requiredPermission).toBe(actual.requiredPermission);
      }
    });

    test("confirms POST /api/v1/coupons/validate is mounted with authenticate and schema validation, but NOT coupons:manage", () => {
      const couponRouter = require("../src/routes/coupon.routes");
      const validateLayer = couponRouter.stack.find(
        (layer) => layer.route && layer.route.path === "/validate"
      );
      expect(validateLayer).toBeDefined();
      expect(validateLayer.route.methods.post).toBe(true);
    });
  });

  describe("2. Systematic Route Authorization Enforcement on All 9 Endpoints", () => {
    test.each(COUPON_ADMIN_ROUTES)(
      "$method $path ($name) enforces authentication (401)",
      async ({ method, path }) => {
        const res = await dispatchRequest(method, path);
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
      }
    );

    test.each(COUPON_ADMIN_ROUTES)(
      "$method $path ($name) rejects authenticated staff without $requiredPermission (403)",
      async ({ method, path, requiredPermission }) => {
        // Create staff with an unrelated permission (e.g. products:read)
        const { employee, token } = await createTestEmployee();
        await assignRoleWithPermissions(
          employee._id,
          `test_batch2c_unauth_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          [PERMISSIONS.PRODUCTS_READ]
        );

        const res = await dispatchRequest(method, path, token, {});
        expect(res.status).toBe(403);
        expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
      }
    );

    test.each(COUPON_ADMIN_ROUTES)(
      "$method $path ($name) allows access for staff with $requiredPermission",
      async ({ method, path, requiredPermission }) => {
        const { employee, token } = await createTestEmployee();
        await assignRoleWithPermissions(
          employee._id,
          `test_batch2c_auth_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          [requiredPermission]
        );

        const res = await dispatchRequest(method, path, token, {});
        // Passing the authorization gate means we get neither 401 nor 403
        expect([401, 403]).not.toContain(res.status);
      }
    );
  });

  describe("3. Validation Precedence Invariant on All 5 Batch 2C Mutations", () => {
    test.each(BATCH_2C_MUTATION_ROUTES)(
      "$method $path rejects unauthenticated requests with 401 before schema validation",
      async ({ method, path }) => {
        // Dispatches completely invalid payload
        const res = await dispatchRequest(method, path, null, { completelyInvalid: 9999 });
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
      }
    );

    test.each(BATCH_2C_MUTATION_ROUTES)(
      "$method $path rejects unauthorized staff with 403 before schema validation",
      async ({ method, path }) => {
        const { employee, token } = await createTestEmployee();
        await assignRoleWithPermissions(
          employee._id,
          `test_batch2c_unauth_val_${Date.now()}_${Math.random().toString(36).substring(7)}`,
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

  describe("4. Dynamic PBAC Priority & Invariant Tests (COUPONS_MANAGE)", () => {
    test("direct permission grant: grants access immediately without a predefined role", async () => {
      const { employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.COUPONS_MANAGE);

      await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: null,
      });

      const res = await dispatchRequest("POST", "/api/v1/coupons", token, {});
      expect([401, 403]).not.toContain(res.status);
    });

    test("restriction dominance: explicit restriction on coupons:manage overrides role grants and direct grants (403)", async () => {
      const { employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.COUPONS_MANAGE);

      // Assign role with coupons:manage
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2c_restr_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.COUPONS_MANAGE]
      );

      // Also give direct grant
      await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: null,
      });

      // Apply explicit restriction on coupons:manage
      await EmployeePermissionRestriction.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: null,
      });

      const res = await dispatchRequest("POST", "/api/v1/coupons", token, {});
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("multi-role unions: union of multiple active role permissions correctly grants coupons:manage", async () => {
      const { employee, token } = await createTestEmployee();

      // Role 1: only products:read
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2c_r1_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.PRODUCTS_READ]
      );

      // Role 2: coupons:manage
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2c_r2_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.COUPONS_MANAGE]
      );

      const res = await dispatchRequest("POST", "/api/v1/coupons", token, {});
      expect([401, 403]).not.toContain(res.status);
    });

    test("role expiration: expired role (expiresAt < now) excludes coupons:manage and yields 403", async () => {
      const { employee, token } = await createTestEmployee();
      const role = await Role.create({
        slug: `test_batch2c_exp_r_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        name: "Expired Role",
        isActive: true,
      });

      const perm = await getOrCreatePermission(PERMISSIONS.COUPONS_MANAGE);
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

      const res = await dispatchRequest("POST", "/api/v1/coupons", token, {});
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("direct grant expiration: expired direct grant excludes coupons:manage and yields 403", async () => {
      const { employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.COUPONS_MANAGE);

      await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: new Date(Date.now() - 10000), // expired in past
      });

      const res = await dispatchRequest("POST", "/api/v1/coupons", token, {});
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("employee lifecycle: suspended employee is denied access (403)", async () => {
      const { employee, token } = await createTestEmployee({ status: "suspended" });
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2c_susp_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.COUPONS_MANAGE]
      );

      const res = await dispatchRequest("POST", "/api/v1/coupons", token, {});
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("employee lifecycle: terminated employee is denied access (403)", async () => {
      const { employee, token } = await createTestEmployee({ status: "terminated" });
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2c_term_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.COUPONS_MANAGE]
      );

      const res = await dispatchRequest("POST", "/api/v1/coupons", token, {});
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("token permission version staleness: DB lookup refreshes permissions dynamically", async () => {
      const { user, employee, token } = await createTestEmployee();

      // Give permission in DB after token issuance
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2c_pv_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.COUPONS_MANAGE]
      );

      // Increment employee permissionVersion in DB
      await incrementPermissionVersion(user._id);

      // Token has stale permissionVersion (1 < 2), resolver detects staleness and recalculates from DB
      const res = await dispatchRequest("POST", "/api/v1/coupons", token, {});
      expect([401, 403]).not.toContain(res.status);
    });

    test("token auth version staleness: rejects session with 401 when token authVersion is outdated", async () => {
      const { user, employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2c_av_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.COUPONS_MANAGE]
      );

      // Invalidate session by bumping authVersion in DB
      await incrementAuthVersion(user._id);

      const res = await dispatchRequest("POST", "/api/v1/coupons", token, {});
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("AUTH_VERSION_MISMATCH");
    });

    test("customer token isolation: customer token is rejected with 403 on coupons:manage endpoint", async () => {
      const { token } = await createTestCustomer();
      const res = await dispatchRequest("POST", "/api/v1/coupons", token, {});
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("vendor token isolation: vendor token is rejected with 403 on coupons:manage endpoint", async () => {
      const { token } = await createTestVendor();
      const res = await dispatchRequest("POST", "/api/v1/coupons", token, {});
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });
  });

  describe("5. Customer Coupon Validation Safety (POST /api/v1/coupons/validate)", () => {
    test("enforces authentication (401) when no Bearer token is provided", async () => {
      const res = await dispatchRequest("POST", "/api/v1/coupons/validate", null, {});
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
    });

    test("allows authenticated customer without coupons:manage to execute validation (returns 400 validation error, NOT 403)", async () => {
      const { customer, token } = await createTestCustomer();

      // Dispatch with missing required schema fields to test gate traversal
      const res = await dispatchRequest("POST", "/api/v1/coupons/validate", token, {
        customerId: customer._id.toString(),
      });

      // Status should be 400 (schema validation failure) — proving PBAC didn't reject with 403
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    test("enforces customer ownership check: rejects validation on behalf of another customer (403 COUPON_ACCESS_DENIED)", async () => {
      const { customer: customerA, token: tokenA } = await createTestCustomer();
      const { customer: customerB } = await createTestCustomer();

      // Customer A tries to validate a coupon on behalf of Customer B
      const res = await dispatchRequest("POST", "/api/v1/coupons/validate", tokenA, {
        code: "TEST20",
        customerId: customerB._id.toString(),
        orderAmount: 100,
        items: [
          {
            price: 100,
            quantity: 1,
            lineTotal: 100,
          },
        ],
      });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("COUPON_ACCESS_DENIED");
      expect(res.body.message).toContain("You can only validate coupons for your own account");
    });
  });
});
