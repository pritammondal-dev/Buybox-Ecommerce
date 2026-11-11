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
} = require("../src/constants/role-permissions.constants");
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
const credentialRoutes = require("../src/routes/credential.routes");
const digitalDownloadRoutes = require("../src/routes/digital-download.routes");
const orderRoutes = require("../src/routes/order.routes");
const cmsEventRoutes = require("../src/routes/cms-event.routes");
const governanceRoutes = require("../src/routes/governance.routes");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_e7a_test?")
  : "mongodb://127.0.0.1:27017/buybox_e7a_test?replicaSet=rs0";

describe("Phase E7A — End-to-End Role & Permission Acceptance Audit Suite", () => {
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

    app.use("/api/v1/credentials", credentialRoutes);
    app.use("/api/v1/digital-downloads", digitalDownloadRoutes);
    app.use("/api/v1/orders", orderRoutes);
    app.use("/api/v1/cms/events", cmsEventRoutes);
    app.use("/api/v1/admin/governance", governanceRoutes);

    // Standard test error handler
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

  describe("1. Permission Model & Over-Granting Prevention Audit", () => {
    it("preserves exactly 49 canonical permissions in CANONICAL_PERMISSIONS_49", () => {
      expect(CANONICAL_PERMISSIONS_49).toHaveLength(49);
      expect(new Set(CANONICAL_PERMISSIONS_49).size).toBe(49);
    });

    it("prevents privilege expansion: narrow permissions do NOT satisfy broad permissions", () => {
      // 1. cms.events.manage must NOT satisfy settings:manage (credential & platform configuration)
      const settingsManageAliases = resolvePermissionAliases("settings:manage");
      expect(settingsManageAliases).not.toContain("cms.events.manage");
      expect(settingsManageAliases).not.toContain("cms.create");
      expect(settingsManageAliases).not.toContain("cms.edit");

      // But broad settings:manage DOES satisfy cms.events.manage
      const cmsEventAliases = resolvePermissionAliases("cms.events.manage");
      expect(cmsEventAliases).toContain("settings:manage");

      // 2. attributes.view must NOT satisfy products:read (digital download licenses & catalog export)
      const productsReadAliases = resolvePermissionAliases("products:read");
      expect(productsReadAliases).not.toContain("attributes.view");
      expect(productsReadAliases).not.toContain("categories.view");
      expect(productsReadAliases).not.toContain("brands.view");

      // But broad products:read DOES satisfy attributes.view
      const attributesViewAliases = resolvePermissionAliases("attributes.view");
      expect(attributesViewAliases).toContain("products:read");

      // 3. returns.view must NOT satisfy orders:read (viewing full customer orders)
      const ordersReadAliases = resolvePermissionAliases("orders:read");
      expect(ordersReadAliases).not.toContain("returns.view");
      expect(ordersReadAliases).not.toContain("orders.export");

      // But broad orders:read DOES satisfy returns.view
      const returnsViewAliases = resolvePermissionAliases("returns.view");
      expect(returnsViewAliases).toContain("orders:read");

      // 4. refunds.create must NOT satisfy finance:manage (approving vendor payouts & settlements)
      const financeManageAliases = resolvePermissionAliases("finance:manage");
      expect(financeManageAliases).not.toContain("refunds.create");
      expect(financeManageAliases).not.toContain("refunds.approve");

      // But broad finance:manage DOES satisfy refunds.create
      const refundsCreateAliases = resolvePermissionAliases("refunds.create");
      expect(refundsCreateAliases).toContain("finance:manage");
    });
  });

  describe("2. End-to-End Multi-Role Authorization Matrix", () => {
    let superAdminUser;
    let eventSpecialistUser;
    let eventSpecialistEmployee;
    let attributeSpecialistUser;
    let attributeSpecialistEmployee;

    beforeAll(async () => {
      await User.deleteMany({ email: /@test-e7a-auth\.com$/ });
      await JobRole.deleteMany({ slug: /e7a-role-/ });

      // 1. Superadmin User
      superAdminUser = await User.findOne({ role: ROLES.SUPER_ADMIN, isActive: true });
      if (!superAdminUser) {
        superAdminUser = await User.create({
          firstName: "Platform",
          lastName: "Superadmin",
          email: `superadmin_${Date.now()}@test-e7a-auth.com`,
          password: "SuperSecretPassword123!",
          role: ROLES.SUPER_ADMIN,
          isActive: true,
        });
      }

      // 2. Event Specialist User (Only cms.events.manage)
      eventSpecialistUser = await User.create({
        firstName: "Event",
        lastName: "Specialist",
        email: `event_spec_${Date.now()}@test-e7a-auth.com`,
        password: "Password123!",
        role: ROLES.EDITOR,
        isActive: true,
      });
      const eventRole = await JobRole.create({
        name: `Event Specialist Role ${Date.now()}`,
        slug: `e7a-role-event-${Date.now()}`,
        tier: 4,
        permissions: ["cms.events.manage", "cms.events.view"],
        isActive: true,
      });
      eventSpecialistEmployee = await Employee.create({
        userId: eventSpecialistUser._id,
        employeeNumber: `EMP_EV_${Date.now()}`,
        status: "active",
        jobRoleId: eventRole._id,
      });

      // 3. Attribute Specialist User (Only attributes.view)
      attributeSpecialistUser = await User.create({
        firstName: "Attribute",
        lastName: "Specialist",
        email: `attr_spec_${Date.now()}@test-e7a-auth.com`,
        password: "Password123!",
        role: ROLES.ADMIN,
        isActive: true,
      });
      const attrRole = await JobRole.create({
        name: `Attribute Specialist Role ${Date.now()}`,
        slug: `e7a-role-attr-${Date.now()}`,
        tier: 4,
        permissions: ["attributes.view"],
        isActive: true,
      });
      attributeSpecialistEmployee = await Employee.create({
        userId: attributeSpecialistUser._id,
        employeeNumber: `EMP_ATTR_${Date.now()}`,
        status: "active",
        jobRoleId: attrRole._id,
      });
    });

    afterAll(async () => {
      await User.deleteMany({ email: /@test-e7a-auth\.com$/ });
      await JobRole.deleteMany({ slug: /e7a-role-/ });
      await Employee.deleteMany({
        _id: { $in: [eventSpecialistEmployee?._id, attributeSpecialistEmployee?._id] },
      });
    });

    it("Superadmin: unconditionally authorized across all administrative endpoints", async () => {
      const saAuth = {
        id: superAdminUser._id.toString(),
        role: ROLES.SUPER_ADMIN,
        isPermissionFresh: true,
      };

      // Credentials GET
      const credRes = await request(app)
        .get("/api/v1/credentials")
        .set("x-test-user", JSON.stringify(saAuth));
      expect(credRes.status).toBe(200);

      // Digital Downloads Admin All
      const ddRes = await request(app)
        .get("/api/v1/digital-downloads/admin/all")
        .set("x-test-user", JSON.stringify(saAuth));
      expect(ddRes.status).toBe(200);
    });

    it("Event Specialist: authorized on CMS events but denied on Credentials (403)", async () => {
      const eventAuth = {
        id: eventSpecialistUser._id.toString(),
        role: ROLES.ADMIN,
        roles: [ROLES.ADMIN],
        isPermissionFresh: true,
      };

      // CMS Events Admin List
      const eventRes = await request(app)
        .get("/api/v1/cms/events")
        .set("x-test-user", JSON.stringify(eventAuth));
      expect(eventRes.status).toBe(200);

      // Mutating Credentials requires SETTINGS_MANAGE -> MUST BE FORBIDDEN
      const credRes = await request(app)
        .put("/api/v1/credentials/stripe")
        .set("x-test-user", JSON.stringify(eventAuth))
        .send({ apiKey: "malicious_overwrite" });

      expect(credRes.status).toBe(403);
      expect(credRes.body.errorCode).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("Attribute Specialist: denied access to Digital Downloads license records (403)", async () => {
      const attrAuth = {
        id: attributeSpecialistUser._id.toString(),
        role: ROLES.ADMIN,
        isPermissionFresh: true,
      };

      // Digital Downloads requires PRODUCTS_READ -> MUST BE FORBIDDEN
      const ddRes = await request(app)
        .get("/api/v1/digital-downloads/admin/all")
        .set("x-test-user", JSON.stringify(attrAuth));

      expect(ddRes.status).toBe(403);
      expect(ddRes.body.errorCode).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("Vendor: strictly denied access to platform admin and governance endpoints (403)", async () => {
      const vendorAuth = {
        id: new mongoose.Types.ObjectId().toString(),
        role: ROLES.VENDOR,
        roles: [ROLES.VENDOR],
        isPermissionFresh: true,
      };

      // Admin Orders
      const orderRes = await request(app)
        .get("/api/v1/orders/admin")
        .set("x-test-user", JSON.stringify(vendorAuth));
      expect(orderRes.status).toBe(403);
      expect(orderRes.body.errorCode).toBe("INSUFFICIENT_ROLE");

      // Credentials
      const credRes = await request(app)
        .get("/api/v1/credentials")
        .set("x-test-user", JSON.stringify(vendorAuth));
      expect(credRes.status).toBe(403);
      expect(credRes.body.errorCode).toBe("INSUFFICIENT_ROLE");

      // Governance
      const govRes = await request(app)
        .get("/api/v1/admin/governance/employees")
        .set("x-test-user", JSON.stringify(vendorAuth));
      expect(govRes.status).toBe(403);
      expect(["INSUFFICIENT_ROLE", "INSUFFICIENT_PERMISSIONS"]).toContain(govRes.body.errorCode);
    });

    it("Customer: strictly denied access to all administrative endpoints (403)", async () => {
      const customerAuth = {
        id: new mongoose.Types.ObjectId().toString(),
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER],
        isPermissionFresh: true,
      };

      const ddRes = await request(app)
        .get("/api/v1/digital-downloads/admin/all")
        .set("x-test-user", JSON.stringify(customerAuth));
      expect(ddRes.status).toBe(403);
      expect(ddRes.body.errorCode).toBe("INSUFFICIENT_ROLE");

      const credRes = await request(app)
        .get("/api/v1/credentials")
        .set("x-test-user", JSON.stringify(customerAuth));
      expect(credRes.status).toBe(403);
      expect(credRes.body.errorCode).toBe("INSUFFICIENT_ROLE");
    });
  });

  describe("3. Dynamic Precedence: Restriction Overrides Inherited JobRole Grants", () => {
    let testStaffUser;
    let testStaffEmployee;
    let baseJobRole;
    let superAdminActor;

    beforeEach(async () => {
      await User.deleteMany({ email: /@test-e7a-prec\.com$/ });
      await JobRole.deleteMany({ slug: /e7a-prec-role/ });
      await EmployeePermissionGrant.deleteMany({});
      await EmployeePermissionRestriction.deleteMany({});

      superAdminActor = await User.findOne({ role: ROLES.SUPER_ADMIN, isActive: true });
      if (!superAdminActor) {
        superAdminActor = await User.create({
          firstName: "Super",
          lastName: "Actor",
          email: `sa_actor_${Date.now()}@test-e7a-prec.com`,
          password: "SecretPassword123!",
          role: ROLES.SUPER_ADMIN,
          isActive: true,
        });
      }

      // Role granting inventory.view, inventory.manage, warehouses.view
      baseJobRole = await JobRole.create({
        name: `Precedence Test Role ${Date.now()}`,
        slug: `e7a-prec-role-${Date.now()}`,
        tier: 3,
        permissions: ["inventory.view", "inventory.manage", "warehouses.view"],
        isActive: true,
      });

      testStaffUser = await User.create({
        firstName: "Precedence",
        lastName: "Tester",
        email: `prec_staff_${Date.now()}@test-e7a-prec.com`,
        password: "StaffPassword123!",
        role: ROLES.ADMIN,
        isActive: true,
      });

      testStaffEmployee = await Employee.create({
        userId: testStaffUser._id,
        employeeNumber: `EMP_PREC_${Date.now()}`,
        status: "active",
        jobRoleId: baseJobRole._id,
      });
    });

    afterEach(async () => {
      await User.deleteMany({ email: /@test-e7a-prec\.com$/ });
      await JobRole.deleteMany({ _id: baseJobRole?._id });
      if (testStaffEmployee) {
        await Employee.deleteOne({ _id: testStaffEmployee._id });
      }
      await EmployeePermissionGrant.deleteMany({});
      await EmployeePermissionRestriction.deleteMany({});
    });

    it("verifies explicit restriction strictly overrides inherited JobRole permission", async () => {
      // 1. Initially has all 3 permissions from JobRole
      const permsInitial = await getEffectivePermissions(testStaffUser._id);
      expect(permsInitial).toContain("inventory.view");
      expect(permsInitial).toContain("inventory.manage");
      expect(permsInitial).toContain("warehouses.view");

      // 2. Superadmin restricts 'inventory.manage' via bulk update
      await updateEmployeePermissionsBulk({
        employeeId: testStaffEmployee._id,
        permissionSlugs: ["inventory.view", "warehouses.view"],
        actorId: superAdminActor._id,
      });

      // 3. Effective permissions MUST exclude inventory.manage
      const permsAfterRestriction = await getEffectivePermissions(testStaffUser._id);
      expect(permsAfterRestriction).toContain("inventory.view");
      expect(permsAfterRestriction).toContain("warehouses.view");
      expect(permsAfterRestriction).not.toContain("inventory.manage");

      // 4. Verify EmployeePermissionRestriction document is active in database
      const restrictionDoc = await EmployeePermissionRestriction.findOne({
        employeeId: testStaffEmployee._id,
        isActive: true,
      }).populate("permissionId");

      expect(restrictionDoc).toBeDefined();
      expect(restrictionDoc.permissionId.slug).toBe("inventory.manage");
    });

    it("verifies suspended employee status unconditionally clears all permissions", async () => {
      testStaffEmployee.status = "suspended";
      await testStaffEmployee.save();

      const perms = await getEffectivePermissions(testStaffUser._id);
      expect(perms).toEqual([]);
    });
  });
});
