const request = require("supertest");
const mongoose = require("mongoose");
const express = require("express");

const {
  PERMISSIONS,
  ALIAS_MAP,
  resolvePermissionAliases,
  SECTION5_CATALOG,
} = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const {
  CANONICAL_PERMISSIONS_49,
  ROLE_PERMISSIONS,
} = require("../src/constants/role-permissions.constants");
const {
  requirePermissions,
  requireRoles,
} = require("../src/middlewares/authorization.middleware");
const {
  getEffectivePermissions,
} = require("../src/services/authorization.service");
const {
  updateEmployeePermissionsBulk,
} = require("../src/services/governance.service");

// Models
const User = require("../src/models/User");
const Employee = require("../src/models/Employee");
const JobRole = require("../src/models/JobRole");
const Role = require("../src/models/Role");
const Permission = require("../src/models/Permission");
const EmployeePermissionGrant = require("../src/models/EmployeePermissionGrant");
const EmployeePermissionRestriction = require("../src/models/EmployeePermissionRestriction");

// Routes
const digitalDownloadRoutes = require("../src/routes/digital-download.routes");
const credentialRoutes = require("../src/routes/credential.routes");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_e7_test?")
  : "mongodb://127.0.0.1:27017/buybox_e7_test?replicaSet=rs0";

describe("Phase E7 — Complete Role & Permission Reconciliation Suite", () => {
  let app;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
      });
    }

    app = express();
    app.use(express.json());

    // Inject simulated authenticated session
    app.use((req, res, next) => {
      const authHeader = req.headers["x-test-user"];
      if (authHeader) {
        req.user = JSON.parse(authHeader);
      }
      next();
    });

    app.use("/api/v1/digital-downloads", digitalDownloadRoutes);
    app.use("/api/v1/credentials", credentialRoutes);

    // Standard error handler
    app.use((err, req, res, next) => {
      res.status(err.statusCode || 500).json({
        success: false,
        errorCode: err.code || err.errorCode || "INTERNAL_ERROR",
        message: err.message,
      });
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe("1. Canonical Permission Inventory & Counts", () => {
    it("preserves exact 49 canonical permissions in CANONICAL_PERMISSIONS_49", () => {
      expect(CANONICAL_PERMISSIONS_49).toBeDefined();
      expect(Array.isArray(CANONICAL_PERMISSIONS_49)).toBe(true);
      expect(CANONICAL_PERMISSIONS_49.length).toBe(49);
      expect(new Set(CANONICAL_PERMISSIONS_49).size).toBe(49);
    });

    it("verifies SECTION5_CATALOG covers all core functional categories", () => {
      const categories = SECTION5_CATALOG.map((c) => c.category);
      expect(categories).toContain("Dashboard");
      expect(categories).toContain("Customers");
      expect(categories).toContain("Vendors");
      expect(categories).toContain("Products");
      expect(categories).toContain("Categories");
      expect(categories).toContain("Brands");
      expect(categories).toContain("Attributes");
      expect(categories).toContain("Inventory");
      expect(categories).toContain("Warehouses");
      expect(categories).toContain("Orders");
      expect(categories).toContain("Returns");
      expect(categories).toContain("Refunds");
      expect(categories).toContain("Payments");
      expect(categories).toContain("Settlements");
      expect(categories).toContain("Shipping");
      expect(categories).toContain("Campaigns");
      expect(categories).toContain("Coupons");
      expect(categories).toContain("Discounts");
      expect(categories).toContain("CMS");
      expect(categories).toContain("Tax");
      expect(categories).toContain("Reviews");
      expect(categories).toContain("Support");
      expect(categories).toContain("Analytics");
      expect(categories).toContain("Tasks");
      expect(categories).toContain("Activity Logs");
      expect(categories).toContain("Staff");
      expect(categories).toContain("Job Roles");
      expect(categories).toContain("Employee Governance");
      expect(categories).toContain("Permissions");
      expect(categories).toContain("Platform Settings");
      expect(categories).toContain("Platform Credentials");
    });

    it("verifies alias resolution and over-granting boundary safety", () => {
      // Attributes: attributes.view can be satisfied by products:read
      const attrAliases = resolvePermissionAliases("attributes.view");
      expect(attrAliases).toContain("products:read");
      // Over-granting prevention: having attributes.view must NOT satisfy products:read
      expect(resolvePermissionAliases("products:read")).not.toContain("attributes.view");

      // Tax: tax.view and tax:read are direct 1-to-1 synonyms
      const taxAliases = resolvePermissionAliases("tax.view");
      expect(taxAliases).toContain("tax:read");
      expect(resolvePermissionAliases("tax:read")).toContain("tax.view");

      // Discounts: discounts.view and discounts:read are direct 1-to-1 synonyms
      const discountAliases = resolvePermissionAliases("discounts.view");
      expect(discountAliases).toContain("discounts:read");

      // CMS Special Events: cms.events.manage can be satisfied by settings:manage
      const cmsEventsAliases = resolvePermissionAliases("cms.events.manage");
      expect(cmsEventsAliases).toContain("settings:manage");
      // Over-granting prevention: having cms.events.manage must NOT satisfy settings:manage (credentials/platform settings)
      expect(resolvePermissionAliases("settings:manage")).not.toContain("cms.events.manage");
    });
  });

  describe("2. Endpoint Guarding & Access Separation", () => {
    let restrictedUser;
    let readOnlyUser;

    beforeAll(async () => {
      // User with only orders:read
      restrictedUser = await User.create({
        firstName: "Restricted",
        lastName: "Staff",
        email: `restricted_${Date.now()}@test-e7-sec.com`,
        password: "Password123!",
        role: ROLES.ADMIN,
        isActive: true,
      });
      const restrictedRole = await JobRole.create({
        name: `Restricted Role ${Date.now()}`,
        slug: `restricted-role-${Date.now()}`,
        tier: 4,
        permissions: ["orders:read"],
        isActive: true,
      });
      await Employee.create({
        userId: restrictedUser._id,
        employeeNumber: `EMP_REST_${Date.now()}`,
        status: "active",
        jobRoleId: restrictedRole._id,
      });

      // User with only products:read and settings:read
      readOnlyUser = await User.create({
        firstName: "ReadOnly",
        lastName: "Staff",
        email: `readonly_${Date.now()}@test-e7-sec.com`,
        password: "Password123!",
        role: ROLES.ADMIN,
        isActive: true,
      });
      const readOnlyRole = await JobRole.create({
        name: `ReadOnly Role ${Date.now()}`,
        slug: `readonly-role-${Date.now()}`,
        tier: 4,
        permissions: [PERMISSIONS.PRODUCTS_READ, PERMISSIONS.SETTINGS_READ],
        isActive: true,
      });
      await Employee.create({
        userId: readOnlyUser._id,
        employeeNumber: `EMP_RO_${Date.now()}`,
        status: "active",
        jobRoleId: readOnlyRole._id,
      });
    });

    describe("Digital Downloads Admin Endpoints", () => {
      it("denies unauthenticated request to /admin/all with 401", async () => {
        const res = await request(app).get("/api/v1/digital-downloads/admin/all");
        expect(res.status).toBe(401);
      });

      it("denies customer access to /admin/all with 403 INSUFFICIENT_ROLE", async () => {
        const customer = {
          id: new mongoose.Types.ObjectId().toString(),
          role: ROLES.CUSTOMER,
          roles: [ROLES.CUSTOMER],
          isPermissionFresh: true,
        };
        const res = await request(app)
          .get("/api/v1/digital-downloads/admin/all")
          .set("x-test-user", JSON.stringify(customer));

        expect(res.status).toBe(403);
        expect(res.body.errorCode).toBe("INSUFFICIENT_ROLE");
      });

      it("denies admin user without PRODUCTS_READ permission on /admin/all (403)", async () => {
        const adminWithoutPerm = {
          id: restrictedUser._id.toString(),
          role: ROLES.ADMIN,
          roles: [ROLES.ADMIN],
          isPermissionFresh: true,
        };
        const res = await request(app)
          .get("/api/v1/digital-downloads/admin/all")
          .set("x-test-user", JSON.stringify(adminWithoutPerm));

        expect(res.status).toBe(403);
        expect(res.body.errorCode).toBe("INSUFFICIENT_PERMISSIONS");
      });

      it("denies admin user without PRODUCTS_UPDATE from revoking entitlement (403)", async () => {
        const adminReadOnly = {
          id: readOnlyUser._id.toString(),
          role: ROLES.ADMIN,
          roles: [ROLES.ADMIN],
          isPermissionFresh: true,
        };
        const res = await request(app)
          .post(`/api/v1/digital-downloads/admin/${new mongoose.Types.ObjectId()}/revoke`)
          .set("x-test-user", JSON.stringify(adminReadOnly));

        expect(res.status).toBe(403);
        expect(res.body.errorCode).toBe("INSUFFICIENT_PERMISSIONS");
      });
    });

    describe("Credentials Read vs. Manage Separation", () => {
      it("allows staff with SETTINGS_READ to access GET / credentials list", async () => {
        const staffReadOnly = {
          id: readOnlyUser._id.toString(),
          role: ROLES.ADMIN,
          roles: [ROLES.ADMIN],
          isPermissionFresh: true,
        };
        const res = await request(app)
          .get("/api/v1/credentials")
          .set("x-test-user", JSON.stringify(staffReadOnly));

        expect(res.status).toBe(200);
      });

      it("denies staff with only SETTINGS_READ from mutating credentials on PUT (403)", async () => {
        const staffReadOnly = {
          id: readOnlyUser._id.toString(),
          role: ROLES.ADMIN,
          roles: [ROLES.ADMIN],
          isPermissionFresh: true,
        };
        const res = await request(app)
          .put("/api/v1/credentials/stripe")
          .set("x-test-user", JSON.stringify(staffReadOnly))
          .send({ apiKey: "test_secret_key" });

        expect(res.status).toBe(403);
        expect(res.body.errorCode).toBe("INSUFFICIENT_PERMISSIONS");
      });

      it("denies customer access to GET / credentials with 403 INSUFFICIENT_ROLE", async () => {
        const customer = {
          id: new mongoose.Types.ObjectId().toString(),
          role: ROLES.CUSTOMER,
          roles: [ROLES.CUSTOMER],
          isPermissionFresh: true,
        };
        const res = await request(app)
          .get("/api/v1/credentials")
          .set("x-test-user", JSON.stringify(customer));

        expect(res.status).toBe(403);
        expect(res.body.errorCode).toBe("INSUFFICIENT_ROLE");
      });
    });
  });

  describe("3. Superadmin Platform Authority Invariant", () => {
    let superAdminUser;

    beforeEach(async () => {
      await User.deleteMany({
        $or: [{ email: /@test-e7-sa\.com$/ }, { role: ROLES.SUPER_ADMIN }],
      });

      superAdminUser = await User.create({
        firstName: "Super",
        lastName: "Admin",
        email: `superadmin_${Date.now()}@test-e7-sa.com`,
        password: "SuperSecretPassword123!",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
      });
    });

    afterEach(async () => {
      await User.deleteMany({
        $or: [{ email: /@test-e7-sa\.com$/ }, { role: ROLES.SUPER_ADMIN }],
      });
    });

    it("Superadmin unconditionally resolves all system permissions", async () => {
      const perms = await getEffectivePermissions(superAdminUser._id);
      expect(perms).toBeDefined();
      expect(perms.length).toBeGreaterThanOrEqual(49);
      expect(perms).toContain(PERMISSIONS.SETTINGS_MANAGE);
      expect(perms).toContain(PERMISSIONS.PRODUCTS_READ);
      expect(perms).toContain(PERMISSIONS.ORDERS_READ);
    });

    it("rejects attempt to modify Superadmin permissions via updateEmployeePermissionsBulk (400)", async () => {
      const superAdminEmployee = await Employee.create({
        userId: superAdminUser._id,
        employeeNumber: `EMP_SA_${Date.now()}`,
        status: "active",
        jobTitle: "Superadmin",
      });

      await expect(
        updateEmployeePermissionsBulk({
          employeeId: superAdminEmployee._id,
          permissionSlugs: ["products.view"],
          actorId: superAdminUser._id,
        })
      ).rejects.toThrow("Cannot modify Superadmin permissions");

      await Employee.deleteOne({ _id: superAdminEmployee._id });
    });
  });

  describe("4. JobRole Inheritance & Dynamic Bulk Permission Reconciliation", () => {
    let testJobRole;
    let employeeUser;
    let employeeProfile;
    let superAdminActor;

    beforeEach(async () => {
      await User.deleteMany({ email: /@test-e7-jobrole\.com$/ });
      await JobRole.deleteMany({ slug: /e7-custom-role/ });
      await EmployeePermissionGrant.deleteMany({});
      await EmployeePermissionRestriction.deleteMany({});

      superAdminActor = await User.create({
        firstName: "Governance",
        lastName: "Actor",
        email: `gov_actor_${Date.now()}@test-e7-jobrole.com`,
        password: "ActorPassword123!",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
      });

      // Create a dynamic Job Role with base permissions
      testJobRole = await JobRole.create({
        name: `E7 Inventory Specialist ${Date.now()}`,
        slug: `e7-custom-role-${Date.now()}`,
        tier: 3,
        permissions: [
          "inventory.view",
          "inventory.manage",
          "warehouses.view",
          "orders.view",
        ],
        isActive: true,
      });

      // Create an employee linked to the JobRole
      employeeUser = await User.create({
        firstName: "Specialist",
        lastName: "Jane",
        email: `specialist_${Date.now()}@test-e7-jobrole.com`,
        password: "JanePassword123!",
        role: ROLES.ADMIN,
        isActive: true,
      });

      employeeProfile = await Employee.create({
        userId: employeeUser._id,
        employeeNumber: `EMP_${Date.now()}`,
        status: "active",
        jobTitle: "Inventory Specialist",
        jobRoleId: testJobRole._id,
      });
    });

    afterEach(async () => {
      await User.deleteMany({ email: /@test-e7-jobrole\.com$/ });
      await JobRole.deleteMany({ _id: testJobRole?._id });
      if (employeeProfile) {
        await Employee.deleteOne({ _id: employeeProfile._id });
      }
      await EmployeePermissionGrant.deleteMany({});
      await EmployeePermissionRestriction.deleteMany({});
    });

    it("employee inherits base permissions from active JobRole", async () => {
      const effective = await getEffectivePermissions(employeeUser._id);
      expect(effective).toContain("inventory.view");
      expect(effective).toContain("inventory.manage");
      expect(effective).toContain("warehouses.view");
      expect(effective).toContain("orders.view");
      expect(effective).not.toContain("cms.publish");
    });

    it("bulk update strips unselected JobRole permission by creating an EmployeePermissionRestriction", async () => {
      // Superadmin unchecks 'orders.view', keeping 'inventory.view', 'inventory.manage', 'warehouses.view'
      // And adds 'customers.view'
      const requestedSlugs = [
        "inventory.view",
        "inventory.manage",
        "warehouses.view",
        "customers.view",
      ];

      const result = await updateEmployeePermissionsBulk({
        employeeId: employeeProfile._id,
        permissionSlugs: requestedSlugs,
        actorId: superAdminActor._id,
      });

      // Verify restriction was created for 'orders.view'
      const restrictions = await EmployeePermissionRestriction.find({
        employeeId: employeeProfile._id,
        isActive: true,
      }).populate("permissionId");

      const restrictedSlugs = restrictions.map((r) => r.permissionId?.slug);
      expect(restrictedSlugs).toContain("orders.view");

      // Verify grant was created for 'customers.view'
      const grants = await EmployeePermissionGrant.find({
        employeeId: employeeProfile._id,
        isActive: true,
      }).populate("permissionId");

      const grantedSlugs = grants.map((g) => g.permissionId?.slug);
      expect(grantedSlugs).toContain("customers.view");

      // Effective permissions must NOT contain 'orders.view'
      const freshEffective = await getEffectivePermissions(employeeUser._id);
      expect(freshEffective).not.toContain("orders.view");
      expect(freshEffective).toContain("inventory.view");
      expect(freshEffective).toContain("customers.view");
    });

    it("bulk update increments target user's permissionVersion for instant session invalidation", async () => {
      const userBefore = await User.findById(employeeUser._id).lean();
      const initialVersion = userBefore.permissionVersion || 1;

      await updateEmployeePermissionsBulk({
        employeeId: employeeProfile._id,
        permissionSlugs: ["inventory.view"],
        actorId: superAdminActor._id,
      });

      const userAfter = await User.findById(employeeUser._id).lean();
      expect(userAfter.permissionVersion).toBe(initialVersion + 1);
    });
  });
});
