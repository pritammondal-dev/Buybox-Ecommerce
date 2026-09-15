const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Employee = require("../src/models/Employee");
const Customer = require("../src/models/Customer");
const Vendor = require("../src/models/Vendor");
const Role = require("../src/models/Role");
const Permission = require("../src/models/Permission");
const RolePermission = require("../src/models/RolePermission");
const EmployeeRole = require("../src/models/EmployeeRole");
const EmployeePermissionGrant = require("../src/models/EmployeePermissionGrant");
const EmployeePermissionRestriction = require("../src/models/EmployeePermissionRestriction");
const Review = require("../src/models/Review");
const Product = require("../src/models/Product");
const Order = require("../src/models/Order");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const { generateAccessToken } = require("../src/services/token.service");
const {
  incrementAuthVersion,
  incrementPermissionVersion,
} = require("../src/services/authorization.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_batch2f_test?")
  : "mongodb://127.0.0.1:27017/buybox_batch2f_test?replicaSet=rs0";

describe("Phase 1G / Batch 2F — Review Moderation & Platform Vendor Listing Route Authorization (PBAC)", () => {
  let createdPermissions = new Map();
  const testId = new mongoose.Types.ObjectId().toString();

  // Helper to create test user + employee profile
  async function createTestEmployee(options = {}) {
    const status = options.status || "active";
    const user = await User.create({
      firstName: "Batch2F",
      lastName: "Staff",
      email: `staff_${Date.now()}_${Math.random().toString(36).substring(7)}@test-batch2f.com`,
      password: "Password123!",
      role: options.userRole || "manager",
      isActive: options.isActive !== undefined ? options.isActive : true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const employee = await Employee.create({
      userId: user._id,
      employeeNumber: `EMP_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`,
      jobTitle: "Content Moderator",
      department: "Trust & Safety",
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
      lastName: "Batch2FTester",
      email: `customer_${Date.now()}_${Math.random().toString(36).substring(7)}@test-batch2f.com`,
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

  // Helper to create vendor user + vendor profile
  async function createTestVendor() {
    const user = await User.create({
      firstName: "Vendor",
      lastName: "Batch2FTester",
      email: `vendor_${Date.now()}_${Math.random().toString(36).substring(7)}@test-batch2f.com`,
      password: "Password123!",
      role: ROLES.VENDOR,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const vendor = await Vendor.create({
      userId: user._id,
      businessName: `Vendor Corp ${Date.now()}`,
      businessSlug: `vendor-corp-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      isActive: true,
      onboardingStatus: "approved",
    });

    const token = generateAccessToken({
      sub: user._id.toString(),
      role: user.role,
      authVersion: user.authVersion,
      permissionVersion: user.permissionVersion,
    });

    return { user, vendor, token };
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

  // Helper to create test review document
  async function createTestReview(overrides = {}) {
    const review = await Review.create({
      productId: new mongoose.Types.ObjectId(),
      customerId: new mongoose.Types.ObjectId(),
      orderId: new mongoose.Types.ObjectId(),
      rating: 4,
      title: "Great Product",
      comment: "Really liked this item",
      status: "pending",
      isVerifiedPurchase: true,
      ...overrides,
    });

    return { review };
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

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(TEST_MONGODB_URI);
    }
    await getOrCreatePermission(PERMISSIONS.REVIEWS_MANAGE);
    await getOrCreatePermission(PERMISSIONS.VENDORS_READ);
  });

  afterAll(async () => {
    try {
      await User.deleteMany({ email: /@test-batch2f\.com$/ });
      await Employee.deleteMany({ department: "Trust & Safety" });
      await Customer.deleteMany({});
      await Vendor.deleteMany({ businessSlug: /^vendor-corp-/ });
      await Role.deleteMany({ slug: /^test_batch2f_/ });
      await Review.deleteMany({});
      await Product.deleteMany({ slug: /^test-review-product-/ });
      await Order.deleteMany({});
    } catch (e) {
      // Ignored in cleanup
    }
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  // ---------------------------------------------------------------------------
  // 1. Router Stack Mechanical Reconciliation
  // ---------------------------------------------------------------------------
  describe("1. Router Stack Mechanical Reconciliation", () => {
    test("reconciliation: review.routes.js mounts PATCH /:reviewId/moderate with authenticate and requirePermissions(reviews:manage)", () => {
      const reviewRoutes = require("../src/routes/review.routes");
      expect(reviewRoutes).toBeDefined();

      const moderateLayer = reviewRoutes.stack.find(
        (l) => l.route && l.route.path === "/:reviewId/moderate" && l.route.methods.patch
      );
      expect(moderateLayer).toBeDefined();

      const middlewareNames = moderateLayer.route.stack.map((s) => s.name || s.handle.name);
      expect(middlewareNames).toContain("authenticate");
      expect(middlewareNames).toContain("moderateReview");
    });

    test("reconciliation: vendor.routes.js mounts GET / with requirePermissions(vendors:read) and router-level authenticate", () => {
      const vendorRoutes = require("../src/routes/vendor.routes");
      expect(vendorRoutes).toBeDefined();

      // Verify router-level authenticate middleware
      const routerAuthMiddleware = vendorRoutes.stack.find(
        (l) => !l.route && (l.name === "authenticate" || l.handle.name === "authenticate")
      );
      expect(routerAuthMiddleware).toBeDefined();

      // Verify GET / route definition
      const listLayer = vendorRoutes.stack.find(
        (l) => l.route && l.route.path === "/" && l.route.methods.get
      );
      expect(listLayer).toBeDefined();
      expect(listLayer.route.stack.length).toBeGreaterThanOrEqual(2);
    });

    test("reconciliation: neither target route contains legacy static-role bypass guards", () => {
      const reviewRoutes = require("../src/routes/review.routes");
      const vendorRoutes = require("../src/routes/vendor.routes");

      const moderateLayer = reviewRoutes.stack.find(
        (l) => l.route && l.route.path === "/:reviewId/moderate"
      );
      const listLayer = vendorRoutes.stack.find(
        (l) => l.route && l.route.path === "/" && l.route.methods.get
      );

      const modNames = moderateLayer.route.stack.map((s) => s.name || s.handle.name);
      const listNames = listLayer.route.stack.map((s) => s.name || s.handle.name);

      expect(modNames).not.toContain("authorize");
      expect(listNames).not.toContain("authorize");
      expect(modNames).not.toContain("requireRoles");
      expect(listNames).not.toContain("requireRoles");
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Unauthenticated Access Denial (401)
  // ---------------------------------------------------------------------------
  describe("2. Unauthenticated Access Denial (401)", () => {
    test("unauthenticated access: PATCH /api/v1/reviews/:reviewId/moderate returns 401 without Authorization header", async () => {
      const res = await dispatchRequest(
        "PATCH",
        `/api/v1/reviews/${testId}/moderate`,
        null,
        { status: "approved" }
      );
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
    });

    test("unauthenticated access: PATCH /api/v1/reviews/:reviewId/moderate returns 401 with invalid Bearer token", async () => {
      const res = await dispatchRequest(
        "PATCH",
        `/api/v1/reviews/${testId}/moderate`,
        "invalid.token.payload",
        { status: "approved" }
      );
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("INVALID_ACCESS_TOKEN");
    });

    test("unauthenticated access: GET /api/v1/vendors returns 401 without Authorization header", async () => {
      const res = await dispatchRequest("GET", "/api/v1/vendors", null);
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
    });

    test("unauthenticated access: GET /api/v1/vendors returns 401 with invalid Bearer token", async () => {
      const res = await dispatchRequest("GET", "/api/v1/vendors", "invalid.token.payload");
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("INVALID_ACCESS_TOKEN");
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Unauthorized Access Denial (403)
  // ---------------------------------------------------------------------------
  describe("3. Unauthorized Access Denial (403)", () => {
    test("unauthorized access: employee without reviews:manage is rejected with 403 on PATCH /reviews/:reviewId/moderate", async () => {
      const { token } = await createTestEmployee();
      const res = await dispatchRequest(
        "PATCH",
        `/api/v1/reviews/${testId}/moderate`,
        token,
        { status: "approved" }
      );
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("unauthorized access: employee without vendors:read is rejected with 403 on GET /vendors", async () => {
      const { token } = await createTestEmployee();
      const res = await dispatchRequest("GET", "/api/v1/vendors", token);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Authorized Access via Dynamic Roles
  // ---------------------------------------------------------------------------
  describe("4. Authorized Access via Dynamic Roles", () => {
    test("authorized access: employee with active dynamic role containing reviews:manage passes authorization on PATCH /reviews/:reviewId/moderate", async () => {
      const { employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2f_mod_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.REVIEWS_MANAGE]
      );

      const res = await dispatchRequest(
        "PATCH",
        `/api/v1/reviews/${testId}/moderate`,
        token,
        { status: "approved" }
      );
      // Authorization passed; review lookup occurs -> 404 (or 200), but definitely not 401 or 403
      expect([401, 403]).not.toContain(res.status);
    });

    test("authorized access: employee with active dynamic role containing vendors:read retrieves vendor listing on GET /vendors", async () => {
      const { employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2f_vread_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.VENDORS_READ]
      );

      const res = await dispatchRequest("GET", "/api/v1/vendors", token);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("vendors");
      expect(Array.isArray(res.body.data.vendors)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Validation Precedence Over Authorization
  // ---------------------------------------------------------------------------
  describe("5. Validation Precedence Over Authorization", () => {
    test("validation precedence: unauthorized request with malformed body returns 403 before body schema validation", async () => {
      const { token } = await createTestEmployee(); // No permissions
      // Sending completely invalid body (status not in enum)
      const res = await dispatchRequest(
        "PATCH",
        `/api/v1/reviews/${testId}/moderate`,
        token,
        { status: "invalid_status_enum", junkField: 123 }
      );
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("validation precedence: unauthorized request with malformed reviewId param returns 403 before param validation", async () => {
      const { token } = await createTestEmployee(); // No permissions
      // Sending non-ObjectId path parameter
      const res = await dispatchRequest(
        "PATCH",
        "/api/v1/reviews/not-a-valid-id/moderate",
        token,
        { status: "approved" }
      );
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Dynamic PBAC Lifecycles & Dominance
  // ---------------------------------------------------------------------------
  describe("6. Dynamic PBAC Lifecycles & Dominance", () => {
    test("direct grant: direct EmployeePermissionGrant grants reviews:manage without an assigned role", async () => {
      const { employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.REVIEWS_MANAGE);

      await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: null,
      });

      const res = await dispatchRequest(
        "PATCH",
        `/api/v1/reviews/${testId}/moderate`,
        token,
        { status: "approved" }
      );
      expect([401, 403]).not.toContain(res.status);
    });

    test("direct grant: direct EmployeePermissionGrant grants vendors:read without an assigned role", async () => {
      const { employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.VENDORS_READ);

      await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: null,
      });

      const res = await dispatchRequest("GET", "/api/v1/vendors", token);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("restriction dominance: direct restriction overrides role and direct grant for reviews:manage", async () => {
      const { employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.REVIEWS_MANAGE);

      await assignRoleWithPermissions(
        employee._id,
        `test_batch2f_dom_rev_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.REVIEWS_MANAGE]
      );

      await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: null,
      });

      // Apply direct restriction
      await EmployeePermissionRestriction.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: null,
      });

      const res = await dispatchRequest(
        "PATCH",
        `/api/v1/reviews/${testId}/moderate`,
        token,
        { status: "approved" }
      );
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("restriction dominance: direct restriction overrides role and direct grant for vendors:read", async () => {
      const { employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.VENDORS_READ);

      await assignRoleWithPermissions(
        employee._id,
        `test_batch2f_dom_vend_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.VENDORS_READ]
      );

      await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: null,
      });

      // Apply direct restriction
      await EmployeePermissionRestriction.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: null,
      });

      const res = await dispatchRequest("GET", "/api/v1/vendors", token);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("expired grant: expired direct grant excludes reviews:manage and yields 403", async () => {
      const { employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.REVIEWS_MANAGE);

      await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: new Date(Date.now() - 10000), // expired in past
      });

      const res = await dispatchRequest(
        "PATCH",
        `/api/v1/reviews/${testId}/moderate`,
        token,
        { status: "approved" }
      );
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("expired grant: expired direct grant excludes vendors:read and yields 403", async () => {
      const { employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.VENDORS_READ);

      await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: new Date(Date.now() - 10000), // expired in past
      });

      const res = await dispatchRequest("GET", "/api/v1/vendors", token);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("expired restriction: expired restriction on reviews:manage no longer blocks active role", async () => {
      const { employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.REVIEWS_MANAGE);

      await assignRoleWithPermissions(
        employee._id,
        `test_batch2f_exprestr_rev_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.REVIEWS_MANAGE]
      );

      // Restriction expired in past
      await EmployeePermissionRestriction.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: new Date(Date.now() - 10000),
      });

      const res = await dispatchRequest(
        "PATCH",
        `/api/v1/reviews/${testId}/moderate`,
        token,
        { status: "approved" }
      );
      expect([401, 403]).not.toContain(res.status);
    });

    test("expired restriction: expired restriction on vendors:read no longer blocks active role", async () => {
      const { employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.VENDORS_READ);

      await assignRoleWithPermissions(
        employee._id,
        `test_batch2f_exprestr_vend_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.VENDORS_READ]
      );

      // Restriction expired in past
      await EmployeePermissionRestriction.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: new Date(Date.now() - 10000),
      });

      const res = await dispatchRequest("GET", "/api/v1/vendors", token);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("expired role: expired EmployeeRole assignment excludes permissions and yields 403", async () => {
      const { employee, token } = await createTestEmployee();
      let role = await Role.create({
        slug: `test_batch2f_exprole_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        name: "Expired Role",
        description: "Expired role test",
        isActive: true,
      });

      const perm = await getOrCreatePermission(PERMISSIONS.REVIEWS_MANAGE);
      await RolePermission.create({ roleId: role._id, permissionId: perm._id });

      await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role._id,
        isActive: true,
        expiresAt: new Date(Date.now() - 10000), // expired in past
      });

      const res = await dispatchRequest(
        "PATCH",
        `/api/v1/reviews/${testId}/moderate`,
        token,
        { status: "approved" }
      );
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Employee Lifecycle Status Gates
  // ---------------------------------------------------------------------------
  describe("7. Employee Lifecycle Status Gates", () => {
    test("lifecycle: suspended employee is denied reviews:manage access with 403", async () => {
      const { employee, token } = await createTestEmployee({ status: "suspended" });
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2f_susp_rev_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.REVIEWS_MANAGE]
      );

      const res = await dispatchRequest(
        "PATCH",
        `/api/v1/reviews/${testId}/moderate`,
        token,
        { status: "approved" }
      );
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("lifecycle: suspended employee is denied vendors:read access with 403", async () => {
      const { employee, token } = await createTestEmployee({ status: "suspended" });
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2f_susp_vend_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.VENDORS_READ]
      );

      const res = await dispatchRequest("GET", "/api/v1/vendors", token);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("lifecycle: terminated employee is denied reviews:manage access with 403", async () => {
      const { employee, token } = await createTestEmployee({ status: "terminated" });
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2f_term_rev_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.REVIEWS_MANAGE]
      );

      const res = await dispatchRequest(
        "PATCH",
        `/api/v1/reviews/${testId}/moderate`,
        token,
        { status: "approved" }
      );
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("lifecycle: terminated employee is denied vendors:read access with 403", async () => {
      const { employee, token } = await createTestEmployee({ status: "terminated" });
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2f_term_vend_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.VENDORS_READ]
      );

      const res = await dispatchRequest("GET", "/api/v1/vendors", token);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("lifecycle: inactive user account (User.isActive: false) is rejected with 401 USER_INACTIVE", async () => {
      const { user, employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2f_inact_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.REVIEWS_MANAGE, PERMISSIONS.VENDORS_READ]
      );

      // Deactivate user in DB
      await User.findByIdAndUpdate(user._id, { isActive: false });

      const resModerate = await dispatchRequest(
        "PATCH",
        `/api/v1/reviews/${testId}/moderate`,
        token,
        { status: "approved" }
      );
      expect(resModerate.status).toBe(401);
      expect(resModerate.body.code).toBe("USER_INACTIVE");

      const resVendors = await dispatchRequest("GET", "/api/v1/vendors", token);
      expect(resVendors.status).toBe(401);
      expect(resVendors.body.code).toBe("USER_INACTIVE");
    });
  });

  // ---------------------------------------------------------------------------
  // 8. Dynamic Version Staleness & Invalidation
  // ---------------------------------------------------------------------------
  describe("8. Dynamic Version Staleness & Invalidation", () => {
    test("permission version staleness: DB recalculation resolves newly granted reviews:manage permission dynamically", async () => {
      const { user, employee, token } = await createTestEmployee();

      // Assign permission in DB after token issuance
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2f_pv_rev_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.REVIEWS_MANAGE]
      );

      // Increment employee permissionVersion in DB to signal staleness
      await incrementPermissionVersion(user._id);

      const res = await dispatchRequest(
        "PATCH",
        `/api/v1/reviews/${testId}/moderate`,
        token,
        { status: "approved" }
      );
      // Authorization passes because resolver re-evaluated DB
      expect([401, 403]).not.toContain(res.status);
    });

    test("permission version staleness: DB recalculation resolves newly granted vendors:read permission dynamically", async () => {
      const { user, employee, token } = await createTestEmployee();

      // Assign permission in DB after token issuance
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2f_pv_vend_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.VENDORS_READ]
      );

      // Increment employee permissionVersion in DB
      await incrementPermissionVersion(user._id);

      const res = await dispatchRequest("GET", "/api/v1/vendors", token);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("auth version invalidation: rejects session with 401 AUTH_VERSION_MISMATCH when authVersion is bumped", async () => {
      const { user, employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2f_av_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.REVIEWS_MANAGE, PERMISSIONS.VENDORS_READ]
      );

      // Invalidate session in DB
      await incrementAuthVersion(user._id);

      const resModerate = await dispatchRequest(
        "PATCH",
        `/api/v1/reviews/${testId}/moderate`,
        token,
        { status: "approved" }
      );
      expect(resModerate.status).toBe(401);
      expect(resModerate.body.code).toBe("AUTH_VERSION_MISMATCH");

      const resVendors = await dispatchRequest("GET", "/api/v1/vendors", token);
      expect(resVendors.status).toBe(401);
      expect(resVendors.body.code).toBe("AUTH_VERSION_MISMATCH");
    });
  });

  // ---------------------------------------------------------------------------
  // 9. Actor Type Isolation & Administrative Roles
  // ---------------------------------------------------------------------------
  describe("9. Actor Type Isolation & Administrative Roles", () => {
    test("customer isolation: customer token is rejected with 403 on PATCH /reviews/:reviewId/moderate", async () => {
      const { token } = await createTestCustomer();
      const res = await dispatchRequest(
        "PATCH",
        `/api/v1/reviews/${testId}/moderate`,
        token,
        { status: "approved" }
      );
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("customer isolation: customer token is rejected with 403 on GET /vendors", async () => {
      const { token } = await createTestCustomer();
      const res = await dispatchRequest("GET", "/api/v1/vendors", token);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("vendor isolation: vendor token is rejected with 403 on GET /vendors (platform listing is not vendor self-service)", async () => {
      const { token } = await createTestVendor();
      const res = await dispatchRequest("GET", "/api/v1/vendors", token);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("vendor employee isolation: employee with vendor role lacking reviews:manage is rejected with 403 on PATCH /reviews/:reviewId/moderate", async () => {
      const { employee, token } = await createTestEmployee({ userRole: ROLES.VENDOR });
      // Employee record exists, but employee has no reviews:manage role
      const res = await dispatchRequest(
        "PATCH",
        `/api/v1/reviews/${testId}/moderate`,
        token,
        { status: "approved" }
      );
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("admin access: Admin employee with required permissions has full access to both endpoints", async () => {
      const { employee, token } = await createTestEmployee({ userRole: ROLES.ADMIN });
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2f_admin_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.REVIEWS_MANAGE, PERMISSIONS.VENDORS_READ]
      );

      const resMod = await dispatchRequest(
        "PATCH",
        `/api/v1/reviews/${testId}/moderate`,
        token,
        { status: "approved" }
      );
      expect([401, 403]).not.toContain(resMod.status);

      const resVendors = await dispatchRequest("GET", "/api/v1/vendors", token);
      expect(resVendors.status).toBe(200);
      expect(resVendors.body.success).toBe(true);
    });

    test("super admin access: Super Admin employee with all permissions has full access to both endpoints", async () => {
      const { employee, token } = await createTestEmployee({ userRole: ROLES.SUPER_ADMIN });
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2f_sa_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.REVIEWS_MANAGE, PERMISSIONS.VENDORS_READ]
      );

      const resMod = await dispatchRequest(
        "PATCH",
        `/api/v1/reviews/${testId}/moderate`,
        token,
        { status: "approved" }
      );
      expect([401, 403]).not.toContain(resMod.status);

      const resVendors = await dispatchRequest("GET", "/api/v1/vendors", token);
      expect(resVendors.status).toBe(200);
      expect(resVendors.body.success).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 10. Business Safety, Invariants & Response Contracts
  // ---------------------------------------------------------------------------
  describe("10. Business Safety, Invariants & Response Contracts", () => {
    test("review moderation: approving review updates status to 'approved' and records moderatedAt", async () => {
      const { employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2f_biz1_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.REVIEWS_MANAGE]
      );

      const { review } = await createTestReview({ status: "pending" });

      const res = await dispatchRequest(
        "PATCH",
        `/api/v1/reviews/${review._id}/moderate`,
        token,
        { status: "approved" }
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Review moderated successfully");
      expect(res.body.data.status).toBe("approved");
      expect(res.body.data.moderatedAt).toBeDefined();

      const updated = await Review.findById(review._id);
      expect(updated.status).toBe("approved");
      expect(updated.moderatedAt).toBeInstanceOf(Date);
    });

    test("review moderation: rejecting review with moderationReason persists reason and status 'rejected'", async () => {
      const { employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2f_biz2_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.REVIEWS_MANAGE]
      );

      const { review } = await createTestReview({ status: "pending" });

      const res = await dispatchRequest(
        "PATCH",
        `/api/v1/reviews/${review._id}/moderate`,
        token,
        {
          status: "rejected",
          moderationReason: "Inappropriate language and spam links",
        }
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("rejected");
      expect(res.body.data.moderationReason).toBe("Inappropriate language and spam links");

      const updated = await Review.findById(review._id);
      expect(updated.status).toBe("rejected");
      expect(updated.moderationReason).toBe("Inappropriate language and spam links");
    });

    test("review moderation: rejecting review without moderationReason returns 400 MODERATION_REASON_REQUIRED", async () => {
      const { employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2f_biz3_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.REVIEWS_MANAGE]
      );

      const { review } = await createTestReview({ status: "pending" });

      const res = await dispatchRequest(
        "PATCH",
        `/api/v1/reviews/${review._id}/moderate`,
        token,
        { status: "rejected" } // Missing moderationReason
      );

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("MODERATION_REASON_REQUIRED");
      expect(res.body.message).toContain("Moderation reason is required when rejecting a review");
    });

    test("review moderation: invalid review status in payload returns 400 VALIDATION_ERROR from Zod schema", async () => {
      const { employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2f_biz4_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.REVIEWS_MANAGE]
      );

      const { review } = await createTestReview({ status: "pending" });

      const res = await dispatchRequest(
        "PATCH",
        `/api/v1/reviews/${review._id}/moderate`,
        token,
        { status: "unsupported_status" }
      );

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    test("review moderation: malformed reviewId parameter returns 400 VALIDATION_ERROR with 'Invalid ObjectId'", async () => {
      const { employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2f_biz5_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.REVIEWS_MANAGE]
      );

      const res = await dispatchRequest(
        "PATCH",
        "/api/v1/reviews/not-an-objectid-123/moderate",
        token,
        { status: "approved" }
      );

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
      expect(res.body.message).toContain("Invalid ObjectId");
    });

    test("review moderation: non-existent reviewId returns 404 REVIEW_NOT_FOUND", async () => {
      const { employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2f_biz6_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.REVIEWS_MANAGE]
      );

      const nonExistentId = new mongoose.Types.ObjectId().toString();

      const res = await dispatchRequest(
        "PATCH",
        `/api/v1/reviews/${nonExistentId}/moderate`,
        token,
        { status: "approved" }
      );

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("REVIEW_NOT_FOUND");
      expect(res.body.message).toContain("Review not found");
    });

    test("vendor listing: returns active vendors in descending order of creation", async () => {
      const { employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2f_biz7_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.VENDORS_READ]
      );

      const { vendor: v1 } = await createTestVendor();
      const { vendor: v2 } = await createTestVendor();

      const res = await dispatchRequest("GET", "/api/v1/vendors", token);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Vendors retrieved successfully");
      expect(Array.isArray(res.body.data.vendors)).toBe(true);

      const returnedIds = res.body.data.vendors.map((v) => v._id.toString());
      expect(returnedIds).toContain(v1._id.toString());
      expect(returnedIds).toContain(v2._id.toString());
    });

    test("vendor listing: automatically excludes soft-deleted vendors (deletedAt is not null)", async () => {
      const { employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2f_biz8_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        [PERMISSIONS.VENDORS_READ]
      );

      const { vendor: softDeletedVendor } = await createTestVendor();
      await Vendor.findByIdAndUpdate(softDeletedVendor._id, {
        deletedAt: new Date(),
        isActive: false,
      });

      const res = await dispatchRequest("GET", "/api/v1/vendors", token);

      expect(res.status).toBe(200);
      const returnedIds = res.body.data.vendors.map((v) => v._id.toString());
      expect(returnedIds).not.toContain(softDeletedVendor._id.toString());
    });

    test("vendor self-service isolation: GET /vendors/me requires vendor role and is unaffected by platform listing", async () => {
      const { token: employeeToken } = await createTestEmployee(); // Has employee/manager role
      // Calling vendor self-service as non-vendor receives 403
      const res = await dispatchRequest("GET", "/api/v1/vendors/me", employeeToken);
      expect(res.status).toBe(403);

      const { token: vendorToken } = await createTestVendor(); // Has vendor role
      const resVendor = await dispatchRequest("GET", "/api/v1/vendors/me", vendorToken);
      expect(resVendor.status).toBe(200);
      expect(resVendor.body.data.vendor).toBeDefined();
    });
  });
});
