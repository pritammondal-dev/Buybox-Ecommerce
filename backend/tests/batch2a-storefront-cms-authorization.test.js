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
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const { generateAccessToken } = require("../src/services/token.service");
const {
  incrementAuthVersion,
  incrementPermissionVersion,
} = require("../src/services/authorization.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_batch2a_test?")
  : "mongodb://127.0.0.1:27017/buybox_batch2a_test?replicaSet=rs0";

describe("Phase 1G / Batch 2A — Storefront & CMS Operational Route Authorization (PBAC)", () => {
  let createdPermissions = new Map();
  const testId = new mongoose.Types.ObjectId().toString();

  // Helper to create test user + employee profile
  async function createTestEmployee(options = {}) {
    const status = options.status || "active";
    const user = await User.create({
      firstName: "Batch2A",
      lastName: "Staff",
      email: `staff_${Date.now()}_${Math.random().toString(36).substring(7)}@test-batch2a.com`,
      password: "Password123!",
      role: options.userRole || "manager",
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const employee = await Employee.create({
      userId: user._id,
      employeeNumber: `EMP_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`,
      jobTitle: "Content Operations Specialist",
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

  // Helper to create customer user
  async function createTestCustomer() {
    const user = await User.create({
      firstName: "Customer",
      lastName: "Tester",
      email: `customer_${Date.now()}_${Math.random().toString(36).substring(7)}@test-batch2a.com`,
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
      lastName: "Tester",
      email: `vendor_${Date.now()}_${Math.random().toString(36).substring(7)}@test-batch2a.com`,
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
  function dispatchRequest(method, path, token = null) {
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
      case "PUT":
        req = request(app).put(path);
        break;
      default:
        throw new Error(`Unsupported method ${method}`);
    }

    if (token) {
      req.set("Authorization", `Bearer ${token}`);
    }
    return req;
  }

  // Canonical Batch 2A Route Registry: Exactly 61 Endpoints
  const BATCH_2A_ROUTES = [
    // 1. Storefront Announcement Bars (5)
    { name: "Create Announcement Bar", method: "POST", path: "/api/v1/storefront/announcement-bars", requiredPermission: PERMISSIONS.SETTINGS_MANAGE },
    { name: "List Announcement Bars (Admin)", method: "GET", path: "/api/v1/storefront/announcement-bars", requiredPermission: PERMISSIONS.SETTINGS_READ },
    { name: "Get Announcement Bar by ID", method: "GET", path: `/api/v1/storefront/announcement-bars/${testId}`, requiredPermission: PERMISSIONS.SETTINGS_READ },
    { name: "Update Announcement Bar", method: "PATCH", path: `/api/v1/storefront/announcement-bars/${testId}`, requiredPermission: PERMISSIONS.SETTINGS_MANAGE },
    { name: "Delete Announcement Bar", method: "DELETE", path: `/api/v1/storefront/announcement-bars/${testId}`, requiredPermission: PERMISSIONS.SETTINGS_MANAGE },

    // 2. Storefront Banners (5)
    { name: "Create Banner", method: "POST", path: "/api/v1/storefront/banners", requiredPermission: PERMISSIONS.SETTINGS_MANAGE },
    { name: "List Banners (Admin)", method: "GET", path: "/api/v1/storefront/banners", requiredPermission: PERMISSIONS.SETTINGS_READ },
    { name: "Get Banner by ID", method: "GET", path: `/api/v1/storefront/banners/${testId}`, requiredPermission: PERMISSIONS.SETTINGS_READ },
    { name: "Update Banner", method: "PATCH", path: `/api/v1/storefront/banners/${testId}`, requiredPermission: PERMISSIONS.SETTINGS_MANAGE },
    { name: "Delete Banner", method: "DELETE", path: `/api/v1/storefront/banners/${testId}`, requiredPermission: PERMISSIONS.SETTINGS_MANAGE },

    // 3. Storefront Content Blocks (5)
    { name: "Create Content Block", method: "POST", path: "/api/v1/storefront/content-blocks", requiredPermission: PERMISSIONS.SETTINGS_MANAGE },
    { name: "List Content Blocks (Admin)", method: "GET", path: "/api/v1/storefront/content-blocks", requiredPermission: PERMISSIONS.SETTINGS_READ },
    { name: "Get Content Block by ID", method: "GET", path: `/api/v1/storefront/content-blocks/${testId}`, requiredPermission: PERMISSIONS.SETTINGS_READ },
    { name: "Update Content Block", method: "PATCH", path: `/api/v1/storefront/content-blocks/${testId}`, requiredPermission: PERMISSIONS.SETTINGS_MANAGE },
    { name: "Delete Content Block", method: "DELETE", path: `/api/v1/storefront/content-blocks/${testId}`, requiredPermission: PERMISSIONS.SETTINGS_MANAGE },

    // 4. Storefront Homepages (6)
    { name: "Create Homepage", method: "POST", path: "/api/v1/storefront/homepages", requiredPermission: PERMISSIONS.SETTINGS_MANAGE },
    { name: "List Homepages (Admin)", method: "GET", path: "/api/v1/storefront/homepages", requiredPermission: PERMISSIONS.SETTINGS_READ },
    { name: "Get Homepage by Key", method: "GET", path: "/api/v1/storefront/homepages/key/main-home", requiredPermission: PERMISSIONS.SETTINGS_READ },
    { name: "Get Homepage by ID", method: "GET", path: `/api/v1/storefront/homepages/${testId}`, requiredPermission: PERMISSIONS.SETTINGS_READ },
    { name: "Update Homepage", method: "PATCH", path: `/api/v1/storefront/homepages/${testId}`, requiredPermission: PERMISSIONS.SETTINGS_MANAGE },
    { name: "Delete Homepage", method: "DELETE", path: `/api/v1/storefront/homepages/${testId}`, requiredPermission: PERMISSIONS.SETTINGS_MANAGE },

    // 5. Storefront Media (5)
    { name: "Create Media", method: "POST", path: "/api/v1/storefront/media", requiredPermission: PERMISSIONS.SETTINGS_MANAGE },
    { name: "List Media (Admin)", method: "GET", path: "/api/v1/storefront/media", requiredPermission: PERMISSIONS.SETTINGS_READ },
    { name: "Get Media by ID", method: "GET", path: `/api/v1/storefront/media/${testId}`, requiredPermission: PERMISSIONS.SETTINGS_READ },
    { name: "Update Media", method: "PATCH", path: `/api/v1/storefront/media/${testId}`, requiredPermission: PERMISSIONS.SETTINGS_MANAGE },
    { name: "Delete Media", method: "DELETE", path: `/api/v1/storefront/media/${testId}`, requiredPermission: PERMISSIONS.SETTINGS_MANAGE },

    // 6. Storefront Navigation Menus (5)
    { name: "Create Menu", method: "POST", path: "/api/v1/storefront/menus", requiredPermission: PERMISSIONS.SETTINGS_MANAGE },
    { name: "List Menus (Admin)", method: "GET", path: "/api/v1/storefront/menus", requiredPermission: PERMISSIONS.SETTINGS_READ },
    { name: "Get Menu by ID", method: "GET", path: `/api/v1/storefront/menus/${testId}`, requiredPermission: PERMISSIONS.SETTINGS_READ },
    { name: "Update Menu", method: "PATCH", path: `/api/v1/storefront/menus/${testId}`, requiredPermission: PERMISSIONS.SETTINGS_MANAGE },
    { name: "Delete Menu", method: "DELETE", path: `/api/v1/storefront/menus/${testId}`, requiredPermission: PERMISSIONS.SETTINGS_MANAGE },

    // 7. Storefront Publications (7)
    { name: "Create Publication", method: "POST", path: "/api/v1/storefront/publications", requiredPermission: PERMISSIONS.SETTINGS_MANAGE },
    { name: "List Publications (Admin)", method: "GET", path: "/api/v1/storefront/publications", requiredPermission: PERMISSIONS.SETTINGS_READ },
    { name: "Get Publication by ID", method: "GET", path: `/api/v1/storefront/publications/${testId}`, requiredPermission: PERMISSIONS.SETTINGS_READ },
    { name: "Get Publication by Resource", method: "GET", path: `/api/v1/storefront/publications/resource/banner/${testId}`, requiredPermission: PERMISSIONS.SETTINGS_READ },
    { name: "Publish Resource Publication", method: "POST", path: `/api/v1/storefront/publications/resource/banner/${testId}/publish`, requiredPermission: PERMISSIONS.SETTINGS_MANAGE },
    { name: "Unpublish Resource Publication", method: "POST", path: `/api/v1/storefront/publications/resource/banner/${testId}/unpublish`, requiredPermission: PERMISSIONS.SETTINGS_MANAGE },
    { name: "Preview Resource Publication", method: "POST", path: `/api/v1/storefront/publications/resource/banner/${testId}/preview`, requiredPermission: PERMISSIONS.SETTINGS_MANAGE },

    // 8. Storefront Redirects (5)
    { name: "Create Redirect", method: "POST", path: "/api/v1/storefront/redirects", requiredPermission: PERMISSIONS.SETTINGS_MANAGE },
    { name: "List Redirects (Admin)", method: "GET", path: "/api/v1/storefront/redirects", requiredPermission: PERMISSIONS.SETTINGS_READ },
    { name: "Get Redirect by ID", method: "GET", path: `/api/v1/storefront/redirects/${testId}`, requiredPermission: PERMISSIONS.SETTINGS_READ },
    { name: "Update Redirect", method: "PATCH", path: `/api/v1/storefront/redirects/${testId}`, requiredPermission: PERMISSIONS.SETTINGS_MANAGE },
    { name: "Delete Redirect", method: "DELETE", path: `/api/v1/storefront/redirects/${testId}`, requiredPermission: PERMISSIONS.SETTINGS_MANAGE },

    // 9. Storefront Sections (6)
    { name: "Create Section", method: "POST", path: "/api/v1/storefront/sections", requiredPermission: PERMISSIONS.SETTINGS_MANAGE },
    { name: "List Sections (Admin)", method: "GET", path: "/api/v1/storefront/sections", requiredPermission: PERMISSIONS.SETTINGS_READ },
    { name: "Get Section by Key", method: "GET", path: "/api/v1/storefront/sections/key/featured-section", requiredPermission: PERMISSIONS.SETTINGS_READ },
    { name: "Get Section by ID", method: "GET", path: `/api/v1/storefront/sections/${testId}`, requiredPermission: PERMISSIONS.SETTINGS_READ },
    { name: "Update Section", method: "PATCH", path: `/api/v1/storefront/sections/${testId}`, requiredPermission: PERMISSIONS.SETTINGS_MANAGE },
    { name: "Delete Section", method: "DELETE", path: `/api/v1/storefront/sections/${testId}`, requiredPermission: PERMISSIONS.SETTINGS_MANAGE },

    // 10. Storefront SEO (3)
    { name: "Get SEO by ID", method: "GET", path: `/api/v1/storefront/seo/${testId}`, requiredPermission: PERMISSIONS.SETTINGS_READ },
    { name: "Create SEO Config", method: "POST", path: "/api/v1/storefront/seo", requiredPermission: PERMISSIONS.SETTINGS_MANAGE },
    { name: "Update SEO Config", method: "PATCH", path: `/api/v1/storefront/seo/${testId}`, requiredPermission: PERMISSIONS.SETTINGS_MANAGE },

    // 11. Storefront Settings (3)
    { name: "Get Storefront Settings by ID", method: "GET", path: `/api/v1/storefront/settings/${testId}`, requiredPermission: PERMISSIONS.SETTINGS_READ },
    { name: "Create Storefront Settings", method: "POST", path: "/api/v1/storefront/settings", requiredPermission: PERMISSIONS.SETTINGS_MANAGE },
    { name: "Update Storefront Settings", method: "PATCH", path: `/api/v1/storefront/settings/${testId}`, requiredPermission: PERMISSIONS.SETTINGS_MANAGE },

    // 12. CMS Page Mutations (6)
    { name: "Create CMS Page", method: "POST", path: "/api/v1/cms/pages", requiredPermission: PERMISSIONS.SETTINGS_MANAGE },
    { name: "Update CMS Page", method: "PATCH", path: `/api/v1/cms/pages/${testId}`, requiredPermission: PERMISSIONS.SETTINGS_MANAGE },
    { name: "Publish CMS Page", method: "PATCH", path: `/api/v1/cms/pages/${testId}/publish`, requiredPermission: PERMISSIONS.SETTINGS_MANAGE },
    { name: "Unpublish CMS Page", method: "PATCH", path: `/api/v1/cms/pages/${testId}/unpublish`, requiredPermission: PERMISSIONS.SETTINGS_MANAGE },
    { name: "Archive CMS Page", method: "PATCH", path: `/api/v1/cms/pages/${testId}/archive`, requiredPermission: PERMISSIONS.SETTINGS_MANAGE },
    { name: "Delete CMS Page", method: "DELETE", path: `/api/v1/cms/pages/${testId}`, requiredPermission: PERMISSIONS.SETTINGS_MANAGE },
  ];

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
    ]);
  });

  afterAll(async () => {
    await Promise.all([
      User.deleteMany({ email: /@test-batch2a\.com$/ }),
      Employee.deleteMany({ jobTitle: "Content Operations Specialist" }),
      Role.deleteMany({ slug: { $regex: /^test_batch2a_/ } }),
      RolePermission.deleteMany({}),
      EmployeeRole.deleteMany({}),
      EmployeePermissionGrant.deleteMany({}),
      EmployeePermissionRestriction.deleteMany({}),
    ]);
    await mongoose.disconnect();
  });

  describe("1. Migration Scope Invariant: Exactly 61 Endpoints", () => {
    test("Batch 2A registry contains exactly 61 production endpoints (55 Storefront + 6 CMS Mutations)", () => {
      expect(BATCH_2A_ROUTES).toHaveLength(61);

      const storefrontRoutes = BATCH_2A_ROUTES.filter((r) =>
        r.path.startsWith("/api/v1/storefront/")
      );
      expect(storefrontRoutes).toHaveLength(55);

      const cmsRoutes = BATCH_2A_ROUTES.filter((r) =>
        r.path.startsWith("/api/v1/cms/")
      );
      expect(cmsRoutes).toHaveLength(6);
    });

    test("mechanically reconciles BATCH_2A_ROUTES against actual Express router stacks", () => {
      const routerConfigs = [
        { prefix: "/api/v1/storefront/announcement-bars", router: require("../src/routes/storefront-announcement-bar.routes") },
        { prefix: "/api/v1/storefront/banners", router: require("../src/routes/storefront-banner.routes") },
        { prefix: "/api/v1/storefront/content-blocks", router: require("../src/routes/storefront-content-block.routes") },
        { prefix: "/api/v1/storefront/homepages", router: require("../src/routes/storefront-homepage.routes") },
        { prefix: "/api/v1/storefront/media", router: require("../src/routes/storefront-media.routes") },
        { prefix: "/api/v1/storefront/menus", router: require("../src/routes/storefront-menu.routes") },
        { prefix: "/api/v1/storefront/publications", router: require("../src/routes/storefront-publication.routes") },
        { prefix: "/api/v1/storefront/redirects", router: require("../src/routes/storefront-redirect.routes") },
        { prefix: "/api/v1/storefront/sections", router: require("../src/routes/storefront-section.routes") },
        { prefix: "/api/v1/storefront/seo", router: require("../src/routes/storefront-seo.routes") },
        { prefix: "/api/v1/storefront/settings", router: require("../src/routes/storefront-settings.routes") },
        { prefix: "/api/v1/cms/pages", router: require("../src/routes/cms-page.routes") },
      ];

      const actualProtectedRoutes = [];

      for (const { prefix, router } of routerConfigs) {
        let routerHasAuth = false;
        for (const layer of router.stack) {
          if (!layer.route) {
            if (layer.name === "authenticate") routerHasAuth = true;
            continue;
          }

          const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase());
          let hasAuth = routerHasAuth;
          for (const s of layer.route.stack) {
            if (s.name === "authenticate" || s.handle.toString().includes("verifyToken")) {
              hasAuth = true;
            }
          }

          // Skip public unauthenticated routes
          if (!hasAuth) continue;

          // Skip Batch 1 CMS GET routes (handled in Batch 1)
          if (prefix === "/api/v1/cms/pages" && methods.includes("GET")) continue;

          const routePath = layer.route.path === "/" ? prefix : `${prefix}${layer.route.path}`;
          for (const method of methods) {
            actualProtectedRoutes.push({ method, fullPath: routePath });
          }
        }
      }

      // Assert actual registered route count is exactly 61
      expect(actualProtectedRoutes).toHaveLength(61);

      // Verify every actual registered route matches an entry in BATCH_2A_ROUTES
      for (const actual of actualProtectedRoutes) {
        const regexStr = "^" + actual.fullPath.replace(/\/:[a-zA-Z0-9_-]+/g, "/[^/]+") + "$";
        const rx = new RegExp(regexStr);
        const match = BATCH_2A_ROUTES.find(
          (tr) => tr.method === actual.method && rx.test(tr.path)
        );
        expect(match).toBeDefined();
      }
    });
  });

  describe("2. Systematic Route Authorization Enforcement on All 61 Endpoints", () => {
    test.each(BATCH_2A_ROUTES)(
      "$method $path ($name) enforces authentication and $requiredPermission",
      async ({ method, path, requiredPermission }) => {
        // 1. Unauthenticated request rejected with 401
        const unauthRes = await dispatchRequest(method, path);
        expect(unauthRes.status).toBe(401);
        expect(unauthRes.body.code).toBe("AUTHENTICATION_REQUIRED");

        // 2. Authenticated employee WITHOUT required permission rejected with 403
        const { token: unauthorizedToken } = await createTestEmployee();
        const forbiddenRes = await dispatchRequest(method, path, unauthorizedToken);
        expect(forbiddenRes.status).toBe(403);
        expect(forbiddenRes.body.code).toBe("INSUFFICIENT_PERMISSIONS");

        // 3. Authenticated employee WITH dynamic role granting permission passes authorization guard
        const { employee, token: authorizedToken } = await createTestEmployee();
        await assignRoleWithPermissions(
          employee._id,
          `test_batch2a_role_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          [requiredPermission]
        );

        const authorizedRes = await dispatchRequest(method, path, authorizedToken);
        // Authorization succeeds: status is never 401 or 403
        expect(authorizedRes.status).not.toBe(401);
        expect(authorizedRes.status).not.toBe(403);
      }
    );
  });

  describe("3. Dynamic PBAC Priority & Invariant Tests on Storefront & CMS Operations", () => {
    it("Direct Grant allows access even without role permission", async () => {
      const { employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.SETTINGS_READ);

      await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
      });

      const res = await request(app)
        .get("/api/v1/storefront/announcement-bars")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });

    it("Direct Restriction overrides inherited role permission (Restriction Dominance)", async () => {
      const { employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.SETTINGS_READ);

      await assignRoleWithPermissions(
        employee._id,
        `test_batch2a_override_${Date.now()}`,
        [PERMISSIONS.SETTINGS_READ]
      );

      await EmployeePermissionRestriction.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
      });

      const res = await request(app)
        .get("/api/v1/storefront/banners")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("Multiple active roles union permissions across settings:read and settings:manage", async () => {
      const { employee, token } = await createTestEmployee();

      // Role 1 gives settings:read
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2a_union1_${Date.now()}`,
        [PERMISSIONS.SETTINGS_READ]
      );

      // Role 2 gives settings:manage
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2a_union2_${Date.now()}`,
        [PERMISSIONS.SETTINGS_MANAGE]
      );

      // Read operation succeeds
      const resRead = await request(app)
        .get("/api/v1/storefront/content-blocks")
        .set("Authorization", `Bearer ${token}`);
      expect(resRead.status).not.toBe(401);
      expect(resRead.status).not.toBe(403);

      // Manage operation passes authorization guard
      const resManage = await request(app)
        .post("/api/v1/storefront/content-blocks")
        .set("Authorization", `Bearer ${token}`)
        .send({});
      expect(resManage.status).not.toBe(401);
      expect(resManage.status).not.toBe(403);
    });

    it("Expired role assignment drops permission and receives 403", async () => {
      const { employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.SETTINGS_READ);
      const role = await Role.create({
        slug: `test_batch2a_expired_role_${Date.now()}`,
        name: "Expired Content Role",
        isActive: true,
      });
      await RolePermission.create({ roleId: role._id, permissionId: perm._id });

      await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role._id,
        isActive: true,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // yesterday
      });

      const res = await request(app)
        .get("/api/v1/storefront/media")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("Expired direct grant drops permission and receives 403", async () => {
      const { employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.SETTINGS_MANAGE);

      await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });

      const res = await request(app)
        .post("/api/v1/storefront/media")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("Suspended employee receives 403 even with active role permissions", async () => {
      const { employee, token } = await createTestEmployee({ status: "suspended" });
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2a_susp_${Date.now()}`,
        [PERMISSIONS.SETTINGS_READ, PERMISSIONS.SETTINGS_MANAGE]
      );

      const res = await request(app)
        .get("/api/v1/storefront/menus")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("Terminated employee receives 403 even with active role permissions", async () => {
      const { employee, token } = await createTestEmployee({ status: "terminated" });
      await assignRoleWithPermissions(
        employee._id,
        `test_batch2a_term_${Date.now()}`,
        [PERMISSIONS.SETTINGS_READ]
      );

      const res = await request(app)
        .get("/api/v1/storefront/redirects")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("Stale permissionVersion triggers authoritative dynamic DB resolution", async () => {
      const { user, employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.SETTINGS_READ);

      await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
      });
      await incrementPermissionVersion(user._id);

      // Token has stale version; middleware detects and resolves fresh DB permissions
      const res = await request(app)
        .get("/api/v1/storefront/sections")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });

    it("Stale authVersion terminates session with 401 AUTH_VERSION_MISMATCH", async () => {
      const { user, token } = await createTestEmployee();
      await incrementAuthVersion(user._id);

      const res = await request(app)
        .get("/api/v1/storefront/seo/some-seo-id")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("AUTH_VERSION_MISMATCH");
    });

    it("Customer token cannot access platform storefront or CMS admin routes", async () => {
      const { token: customerToken } = await createTestCustomer();

      const resStorefront = await request(app)
        .get("/api/v1/storefront/settings/some-setting-id")
        .set("Authorization", `Bearer ${customerToken}`);
      expect(resStorefront.status).toBe(403);
      expect(resStorefront.body.code).toBe("INSUFFICIENT_PERMISSIONS");

      const resCms = await request(app)
        .post("/api/v1/cms/pages")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({});
      expect(resCms.status).toBe(403);
      expect(resCms.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("Vendor token cannot access platform storefront or CMS admin routes", async () => {
      const { token: vendorToken } = await createTestVendor();

      const resStorefront = await request(app)
        .get("/api/v1/storefront/announcement-bars")
        .set("Authorization", `Bearer ${vendorToken}`);
      expect(resStorefront.status).toBe(403);
      expect(resStorefront.body.code).toBe("INSUFFICIENT_PERMISSIONS");

      const resCms = await request(app)
        .post("/api/v1/cms/pages")
        .set("Authorization", `Bearer ${vendorToken}`)
        .send({});
      expect(resCms.status).toBe(403);
      expect(resCms.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });
  });

  describe("4. Public Storefront Routes Preservation (No Authentication Required)", () => {
    const PUBLIC_STOREFRONT_ROUTES = [
      { name: "Public Active Announcement Bars", method: "GET", path: "/api/v1/storefront/announcement-bars/active" },
      { name: "Public Active Banners", method: "GET", path: "/api/v1/storefront/banners/active" },
      { name: "Public Active Content Blocks", method: "GET", path: "/api/v1/storefront/content-blocks/active" },
      { name: "Public Content Block by Key", method: "GET", path: "/api/v1/storefront/content-blocks/key/promo-header" },
      { name: "Public Active Homepage", method: "GET", path: "/api/v1/storefront/homepages/active/main" },
      { name: "Public Active Media", method: "GET", path: "/api/v1/storefront/media/active" },
      { name: "Public Active Menu", method: "GET", path: "/api/v1/storefront/menus/active/main-nav" },
      { name: "Public Publication Preview", method: "GET", path: "/api/v1/storefront/publications/preview/sample-token" },
      { name: "Public Redirect Resolve", method: "GET", path: "/api/v1/storefront/redirects/resolve?path=/old-deals" },
      { name: "Public Active Sections", method: "GET", path: "/api/v1/storefront/sections/active" },
      { name: "Public Active Section by Key", method: "GET", path: "/api/v1/storefront/sections/active/hero" },
      { name: "Public Global SEO", method: "GET", path: "/api/v1/storefront/seo" },
      { name: "Public Storefront Settings", method: "GET", path: "/api/v1/storefront/settings" },
      { name: "Public Published CMS Page by Slug", method: "GET", path: "/api/v1/cms/pages/published/about-us" },
    ];

    test.each(PUBLIC_STOREFRONT_ROUTES)(
      "Public route '$name' ($path) does not require authentication",
      async ({ method, path }) => {
        const res = await dispatchRequest(method, path);
        // Public routes must NEVER return 401 or 403
        expect(res.status).not.toBe(401);
        expect(res.status).not.toBe(403);
      }
    );
  });
});
