const mongoose = require("mongoose");
const User = require("../src/models/User");
const Employee = require("../src/models/Employee");
const JobRole = require("../src/models/JobRole");
const Permission = require("../src/models/Permission");
const EmployeePermissionGrant = require("../src/models/EmployeePermissionGrant");
const EmployeePermissionRestriction = require("../src/models/EmployeePermissionRestriction");
const {
  PERMISSIONS,
  SECTION5_CATALOG,
  ALIAS_MAP,
  resolvePermissionAliases,
} = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const {
  getEffectivePermissions,
  incrementPermissionVersion,
  verifyTokenVersions,
} = require("../src/services/authorization.service");
const {
  updateEmployeePermissionsBulk,
  listPermissions,
} = require("../src/services/governance.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_rbac01_test?")
  : "mongodb://127.0.0.1:27017/buybox_rbac01_test?replicaSet=rs0";

jest.setTimeout(30000);

describe("Phase RBAC-01: Superadmin Role & Permission Synchronization", () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
      });
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe("1. Canonical Permission Catalog Completeness & Integrity", () => {
    it("exports SECTION5_CATALOG with all 35 distinct platform categories", () => {
      expect(Array.isArray(SECTION5_CATALOG)).toBe(true);
      expect(SECTION5_CATALOG.length).toBeGreaterThanOrEqual(30);

      const categoryNames = SECTION5_CATALOG.map((c) => c.category);
      expect(categoryNames).toContain("Dashboard");
      expect(categoryNames).toContain("Customers");
      expect(categoryNames).toContain("Vendors");
      expect(categoryNames).toContain("Vendor Bank Accounts");
      expect(categoryNames).toContain("Vendor KYC & Compliance");
      expect(categoryNames).toContain("Products");
      expect(categoryNames).toContain("Categories");
      expect(categoryNames).toContain("Brands");
      expect(categoryNames).toContain("Attributes");
      expect(categoryNames).toContain("Inventory");
      expect(categoryNames).toContain("Warehouses");
      expect(categoryNames).toContain("Orders");
      expect(categoryNames).toContain("Returns");
      expect(categoryNames).toContain("Refunds");
      expect(categoryNames).toContain("Payments");
      expect(categoryNames).toContain("Settlements");
      expect(categoryNames).toContain("Finance");
      expect(categoryNames).toContain("Shipping");
      expect(categoryNames).toContain("Campaigns");
      expect(categoryNames).toContain("Coupons");
      expect(categoryNames).toContain("Discounts");
      expect(categoryNames).toContain("CMS");
      expect(categoryNames).toContain("Tax");
      expect(categoryNames).toContain("Reviews");
      expect(categoryNames).toContain("Support");
      expect(categoryNames).toContain("Analytics");
      expect(categoryNames).toContain("Tasks");
      expect(categoryNames).toContain("Activity Logs");
      expect(categoryNames).toContain("Staff");
      expect(categoryNames).toContain("Job Roles");
      expect(categoryNames).toContain("Employee Governance");
      expect(categoryNames).toContain("Permissions");
      expect(categoryNames).toContain("Platform Settings");
      expect(categoryNames).toContain("Platform Credentials");
      expect(categoryNames).toContain("Authentication Methods");
    });

    it("ensures all permission slugs across SECTION5_CATALOG are unique and well-formatted", () => {
      const allSlugs = [];
      SECTION5_CATALOG.forEach((cat) => {
        expect(cat.permissions.length).toBeGreaterThan(0);
        cat.permissions.forEach((p) => {
          expect(p.slug).toBeDefined();
          expect(typeof p.slug).toBe("string");
          expect(p.name).toBeDefined();
          expect(p.description).toBeDefined();
          allSlugs.push(p.slug);
        });
      });

      const uniqueSlugs = new Set(allSlugs);
      expect(uniqueSlugs.size).toBe(allSlugs.length);
      expect(allSlugs.length).toBeGreaterThanOrEqual(80);
    });

    it("verifies bidirectional alias resolution for legacy colon and Section 5 dot permissions", () => {
      // 1. Finance & Settlements
      expect(resolvePermissionAliases("finance.view")).toContain("finance:read");
      expect(resolvePermissionAliases("finance:read")).toContain("finance.view");
      expect(resolvePermissionAliases("finance:read")).toContain("settlements.view");
      expect(resolvePermissionAliases("finance:manage")).toContain("finance.manage");
      expect(resolvePermissionAliases("finance:manage")).toContain("settlements.manage");

      // 2. Customers
      expect(resolvePermissionAliases("customers.view")).toContain("users:read");
      expect(resolvePermissionAliases("users:read")).toContain("customers.view");
      expect(resolvePermissionAliases("users:manage")).toContain("customers.edit");
      expect(resolvePermissionAliases("users:manage")).toContain("customers.suspend");

      // 3. Vendors & Bank Accounts
      expect(resolvePermissionAliases("vendors.bank_accounts.view")).toContain("vendors:manage");
      expect(resolvePermissionAliases("vendors.kyc.view")).toContain("vendors:read");

      // 4. Products & Catalog
      expect(resolvePermissionAliases("products.view")).toContain("products:read");
      expect(resolvePermissionAliases("products:read")).toContain("products.view");

      // 5. Authentication & Settings
      expect(resolvePermissionAliases("authentication.login_methods.read")).toContain("settings:read");
      expect(resolvePermissionAliases("authentication.login_methods.manage")).toContain("settings:manage");
    });
  });

  describe("2. Governance Service Permission Catalog Query API", () => {
    it("returns structured catalog when grouped: true or catalog: true is supplied", async () => {
      const result = await listPermissions({ grouped: true });
      expect(result).toBeDefined();
      expect(result.isGrouped).toBe(true);
      expect(Array.isArray(result.permissions)).toBe(true);
      expect(result.permissions.length).toBe(SECTION5_CATALOG.length);

      const firstCategory = result.permissions[0];
      expect(firstCategory.category).toBeDefined();
      expect(Array.isArray(firstCategory.permissions)).toBe(true);
    });

    it("filters grouped catalog by search term", async () => {
      const result = await listPermissions({ grouped: true, search: "Bank Accounts" });
      expect(result.isGrouped).toBe(true);
      expect(result.permissions.some((c) => c.category === "Vendor Bank Accounts")).toBe(true);
      expect(
        result.permissions.every(
          (c) => c.category.includes("Bank") || c.permissions.some((p) => p.slug.includes("bank"))
        )
      ).toBe(true);
    });

    it("returns full un-truncated list when all: true is passed", async () => {
      const result = await listPermissions({ all: true });
      expect(result).toBeDefined();
      expect(Array.isArray(result.permissions)).toBe(true);
      expect(result.permissions.length).toBeGreaterThan(100);
      expect(result.limit).toBe(1000);
    });
  });

  describe("3. Multi-Role Enforcement & Authorization Pipeline", () => {
    let superAdminUser;
    let financeAdminUser;
    let financeAdminEmployee;
    let financeRole;

    beforeAll(async () => {
      await User.deleteMany({ email: /@test-rbac01\.com$/ });
      await JobRole.deleteMany({ slug: /rbac01-role-/ });

      // Find or create Superadmin
      superAdminUser = await User.findOne({ role: ROLES.SUPER_ADMIN, isActive: true });
      if (!superAdminUser) {
        superAdminUser = await User.create({
          firstName: "Root",
          lastName: "Superadmin",
          email: `superadmin_${Date.now()}@test-rbac01.com`,
          password: "SuperAdminSecret123!",
          role: ROLES.SUPER_ADMIN,
          isActive: true,
        });
      }

      // Create Finance Admin User & Role
      financeRole = await JobRole.create({
        name: `Finance Manager Role ${Date.now()}`,
        slug: `rbac01-role-fin-${Date.now()}`,
        tier: 3,
        permissions: ["finance.view", "settlements.view", "vendors.bank_accounts.view"],
        isActive: true,
      });

      financeAdminUser = await User.create({
        firstName: "Finance",
        lastName: "Specialist",
        email: `fin_admin_${Date.now()}@test-rbac01.com`,
        password: "FinancePassword123!",
        role: ROLES.ADMIN,
        isActive: true,
      });

      financeAdminEmployee = await Employee.create({
        userId: financeAdminUser._id,
        employeeNumber: `EMP_FIN_${Date.now()}`,
        status: "active",
        jobRoleId: financeRole._id,
      });
    });

    afterAll(async () => {
      await User.deleteMany({ email: /@test-rbac01\.com$/ });
      await JobRole.deleteMany({ slug: /rbac01-role-/ });
      if (financeAdminEmployee) {
        await Employee.deleteOne({ _id: financeAdminEmployee._id });
      }
    });

    it("verifies Superadmin has all permissions and bypasses restrictions", async () => {
      const permissions = await getEffectivePermissions(superAdminUser._id);
      expect(Array.isArray(permissions)).toBe(true);
      expect(permissions).toContain("finance.view");
      expect(permissions).toContain("products.delete");
      expect(permissions).toContain("vendors.bank_accounts.manage");
      expect(permissions).toContain("governance.superadmin_transfer");
    });

    it("calculates effective permissions for non-superadmin based on active JobRole", async () => {
      const permissions = await getEffectivePermissions(financeAdminUser._id);
      expect(permissions).toContain("finance.view");
      expect(permissions).toContain("settlements.view");
      expect(permissions).toContain("vendors.bank_accounts.view");
      expect(permissions).not.toContain("products.delete");
      expect(permissions).not.toContain("governance.superadmin_transfer");
    });

    it("correctly applies explicit permission restrictions over JobRole grants", async () => {
      // Restrict 'settlements.view'
      await updateEmployeePermissionsBulk({
        employeeId: financeAdminEmployee._id,
        permissionSlugs: ["finance.view", "vendors.bank_accounts.view"], // settlements.view omitted -> restricted
        actorId: superAdminUser._id,
      });

      const permsAfter = await getEffectivePermissions(financeAdminUser._id);
      expect(permsAfter).toContain("finance.view");
      expect(permsAfter).toContain("vendors.bank_accounts.view");
      expect(permsAfter).not.toContain("settlements.view");
    });

    it("verifies session and permission version invalidation", async () => {
      const dbUserBefore = await User.findById(financeAdminUser._id);
      const currentVersion = Number(dbUserBefore.permissionVersion ?? 1);
      const freshCheckBefore = verifyTokenVersions(dbUserBefore, { permissionVersion: currentVersion });
      expect(freshCheckBefore.isPermissionFresh).toBe(true);

      // Increment version
      const { permissionVersion: newVersion } = await incrementPermissionVersion(financeAdminUser._id);
      expect(newVersion).toBe(currentVersion + 1);

      const dbUserAfter = await User.findById(financeAdminUser._id);

      // Stale token with old version must now be rejected
      const freshCheckAfter = verifyTokenVersions(dbUserAfter, { permissionVersion: currentVersion });
      expect(freshCheckAfter.isPermissionFresh).toBe(false);
      expect(freshCheckAfter.reason).toBe("PERMISSION_VERSION_STALE");

      // Current version token must be accepted
      const freshCheckCurrent = verifyTokenVersions(dbUserAfter, { permissionVersion: newVersion });
      expect(freshCheckCurrent.isPermissionFresh).toBe(true);
    });
  });
});
