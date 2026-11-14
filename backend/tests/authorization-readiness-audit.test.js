const { PERMISSIONS } = require("../src/constants/permissions.constants");
const {
  ROLE_PERMISSIONS,
  OPERATIONAL_PERMISSIONS,
  GOVERNANCE_PERMISSIONS,
} = require("../src/constants/role-permissions.constants");
const {
  SCOPE_TYPES,
  ALLOWED_SCOPE_TYPES,
} = require("../src/constants/scope.constants");
const { ROLES } = require("../src/constants/auth.constants");
const app = require("../src/app");
const routes = require("../src/routes");

describe("Phase 1G — Authorization Migration Readiness Audit & Route Matrix", () => {
  describe("1. Permission Registry & Role Fallback Invariants", () => {
    test("Canonical permission registry defines the 49 core permissions plus 3 discount/promotion permissions", () => {
      const allPermissions = Object.values(PERMISSIONS);
      expect(allPermissions).toHaveLength(52);

      // Core operational permissions count (Phase 1G / D7 baseline)
      expect(OPERATIONAL_PERMISSIONS).toHaveLength(40);

      // Governance permissions count
      expect(GOVERNANCE_PERMISSIONS).toHaveLength(9);

      // Mutually exclusive and exhaustive 49-permission canonical union
      const combined = new Set([
        ...OPERATIONAL_PERMISSIONS,
        ...GOVERNANCE_PERMISSIONS,
      ]);
      expect(combined.size).toBe(49);

      // Extended discount and promotion floor permissions in PERMISSIONS
      expect(allPermissions).toContain(PERMISSIONS.DISCOUNTS_READ);
      expect(allPermissions).toContain(PERMISSIONS.DISCOUNTS_MANAGE);
      expect(allPermissions).toContain(PERMISSIONS.PROMOTIONS_OVERRIDE_FLOOR);
    });

    test("Admin role retains exactly the 40 operational permissions", () => {
      const adminPerms = ROLE_PERMISSIONS[ROLES.ADMIN];
      expect(adminPerms).toHaveLength(40);

      // No governance permissions in Admin role
      for (const govPerm of GOVERNANCE_PERMISSIONS) {
        expect(adminPerms).not.toContain(govPerm);
      }
    });

    test("Super Admin role retains all 49 canonical permissions (40 operational + 9 governance)", () => {
      const superAdminPerms = ROLE_PERMISSIONS[ROLES.SUPER_ADMIN];
      expect(superAdminPerms).toHaveLength(49);

      for (const p of OPERATIONAL_PERMISSIONS) {
        expect(superAdminPerms).toContain(p);
      }
      for (const p of GOVERNANCE_PERMISSIONS) {
        expect(superAdminPerms).toContain(p);
      }
    });

    test("Customer, Vendor, Support, and Manager roles retain established compatibility counts", () => {
      expect(ROLE_PERMISSIONS[ROLES.CUSTOMER]).toHaveLength(3);
      expect(ROLE_PERMISSIONS[ROLES.VENDOR]).toHaveLength(13);
      expect(ROLE_PERMISSIONS[ROLES.VENDOR]).toContain(PERMISSIONS.PRODUCTS_DELETE);
      expect(ROLE_PERMISSIONS[ROLES.SUPPORT]).toHaveLength(7);
      expect(ROLE_PERMISSIONS[ROLES.MANAGER]).toHaveLength(30);
    });

    test("Scope types registry defines the 4 canonical operational scopes", () => {
      expect(ALLOWED_SCOPE_TYPES).toEqual([
        "vendor",
        "warehouse",
        "category",
        "support_queue",
      ]);
      expect(SCOPE_TYPES.VENDOR).toBe("vendor");
      expect(SCOPE_TYPES.WAREHOUSE).toBe("warehouse");
      expect(SCOPE_TYPES.CATEGORY).toBe("category");
      expect(SCOPE_TYPES.SUPPORT_QUEUE).toBe("support_queue");
    });
  });

  describe("2. Backend Route Tree Inventory & Health Integrity", () => {
    test("Root application router mounts /health and /api/v1", async () => {
      const request = require("supertest");
      const healthRes = await request(app).get("/health");
      expect(healthRes.status).toBe(200);
      expect(healthRes.body.data.status).toBe("ok");

      const apiV1Res = await request(app).get("/api/v1");
      expect(apiV1Res.status).toBe(200);
      expect(apiV1Res.body.message).toBe("Buybox API v1");
    });

    test("API v1 router mounts all sub-routers", () => {
      expect(routes.stack).toBeDefined();
      // Ensure router layers exist
      expect(routes.stack.length).toBeGreaterThanOrEqual(40);
    });
  });

  describe("3. Governance Protection Invariants", () => {
    test("Governance permissions match canonical requirements", () => {
      const expectedGovernance = [
        PERMISSIONS.ROLES_READ,
        PERMISSIONS.ROLES_MANAGE,
        PERMISSIONS.PERMISSIONS_READ,
        PERMISSIONS.PERMISSIONS_MANAGE,
        PERMISSIONS.EMPLOYEES_READ,
        PERMISSIONS.EMPLOYEES_MANAGE,
        PERMISSIONS.WORK_ASSIGNMENTS_READ,
        PERMISSIONS.WORK_ASSIGNMENTS_MANAGE,
        PERMISSIONS.AUDIT_LOGS_READ,
      ];

      expect(GOVERNANCE_PERMISSIONS).toEqual(
        expect.arrayContaining(expectedGovernance)
      );
      expect(GOVERNANCE_PERMISSIONS).toHaveLength(9);
    });
  });
});
