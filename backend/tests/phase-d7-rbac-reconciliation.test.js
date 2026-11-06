const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const express = require("express");

const {
  PERMISSIONS,
  resolvePermissionAliases,
} = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const {
  isActorAuthorizedForFloorOverride,
} = require("../src/services/pricing-engine.service");
const {
  requirePermissions,
} = require("../src/middlewares/authorization.middleware");
const {
  ROLE_PERMISSIONS,
  CANONICAL_PERMISSIONS_49,
} = require("../src/constants/role-permissions.constants");
const { SYSTEM_ROLES } = require("../src/seeds/rbac.seed");

describe("Phase D7 — Full RBAC Reconciliation & Security Invariants", () => {
  describe("1. Permissions Aliases & Bi-directional Mapping Verification", () => {
    it("resolves discounts:read to include discounts.view and legacy aliases", () => {
      const aliases = resolvePermissionAliases("discounts:read");
      expect(aliases).toContain("discounts:read");
      expect(aliases).toContain("discounts.view");
      expect(aliases).toContain("coupons:read");
      expect(aliases).toContain("campaigns:read");
    });

    it("resolves discounts:manage to include discounts.manage and legacy aliases", () => {
      const aliases = resolvePermissionAliases("discounts:manage");
      expect(aliases).toContain("discounts:manage");
      expect(aliases).toContain("discounts.manage");
      expect(aliases).toContain("coupons:manage");
      expect(aliases).toContain("campaigns:manage");
    });

    it("resolves promotions:override_floor bi-directionally", () => {
      const aliases = resolvePermissionAliases("promotions:override_floor");
      expect(aliases).toContain("promotions:override_floor");
      expect(aliases).toContain("promotions.override_floor");

      const dotAliases = resolvePermissionAliases("promotions.override_floor");
      expect(dotAliases).toContain("promotions:override_floor");
      expect(dotAliases).toContain("promotions.override_floor");
    });

    it("resolves discounts.view to include discounts:read", () => {
      const aliases = resolvePermissionAliases("discounts.view");
      expect(aliases).toContain("discounts.view");
      expect(aliases).toContain("discounts:read");
    });
  });

  describe("2. Seed & Role Definitions Integrity", () => {
    it("system_super_admin role in seeds possesses exact 49 canonical permissions", () => {
      const systemSuperAdmin = SYSTEM_ROLES.find(
        (r) => r.slug === "system_super_admin"
      );
      expect(systemSuperAdmin).toBeDefined();
      expect(systemSuperAdmin.permissions).toHaveLength(49);
    });

    it("CANONICAL_PERMISSIONS_49 is exported and contains exact 49 items", () => {
      expect(CANONICAL_PERMISSIONS_49).toBeDefined();
      expect(CANONICAL_PERMISSIONS_49).toHaveLength(49);
    });

    it("customer and vendor roles possess expected baseline permissions", () => {
      expect(ROLE_PERMISSIONS[ROLES.CUSTOMER]).toContain(
        PERMISSIONS.PRODUCTS_READ
      );
      expect(ROLE_PERMISSIONS[ROLES.CUSTOMER]).not.toContain(
        PERMISSIONS.INVENTORY_READ
      );
      expect(ROLE_PERMISSIONS[ROLES.CUSTOMER]).not.toContain(
        PERMISSIONS.USERS_MANAGE
      );

      expect(ROLE_PERMISSIONS[ROLES.VENDOR]).toContain(
        PERMISSIONS.PRODUCTS_READ
      );
      expect(ROLE_PERMISSIONS[ROLES.VENDOR]).toContain(
        PERMISSIONS.INVENTORY_READ
      );
      expect(ROLE_PERMISSIONS[ROLES.VENDOR]).not.toContain(
        PERMISSIONS.USERS_MANAGE
      );
    });
  });

  describe("3. Pricing Engine Floor Override Authorization Matrix", () => {
    it("authorizes superadmin in multiple role formats (super_admin, superadmin)", () => {
      expect(
        isActorAuthorizedForFloorOverride({ role: "super_admin" })
      ).toBe(true);
      expect(
        isActorAuthorizedForFloorOverride({ role: "superadmin" })
      ).toBe(true);
      expect(
        isActorAuthorizedForFloorOverride({ role: "SUPER_ADMIN" })
      ).toBe(true);
      expect(isActorAuthorizedForFloorOverride({ isSuperAdmin: true })).toBe(
        true
      );
    });

    it("authorizes actor with permissions array containing colon or dot permission", () => {
      expect(
        isActorAuthorizedForFloorOverride({
          role: "admin",
          permissions: ["promotions:override_floor"],
        })
      ).toBe(true);

      expect(
        isActorAuthorizedForFloorOverride({
          role: "manager",
          permissions: ["promotions.override_floor"],
        })
      ).toBe(true);
    });

    it("authorizes actor with effectivePermissions on actor object", () => {
      expect(
        isActorAuthorizedForFloorOverride({
          role: "staff",
          effectivePermissions: ["promotions:override_floor"],
        })
      ).toBe(true);

      expect(
        isActorAuthorizedForFloorOverride({
          role: "staff",
          effectivePermissions: ["promotions.override_floor"],
        })
      ).toBe(true);
    });

    it("denies unauthorized actor without permission", () => {
      expect(isActorAuthorizedForFloorOverride(null)).toBe(false);
      expect(
        isActorAuthorizedForFloorOverride({
          role: "vendor",
          permissions: ["products:read"],
        })
      ).toBe(false);
      expect(
        isActorAuthorizedForFloorOverride({
          role: "customer",
          permissions: [],
        })
      ).toBe(false);
    });
  });

  describe("4. Middleware Permission Matching with Aliases (requirePermissions)", () => {
    let app;

    beforeAll(() => {
      app = express();
      app.use(express.json());

      // Mock middleware setting user
      app.use((req, res, next) => {
        const authHeader = req.headers["x-test-user"];
        if (authHeader) {
          req.user = JSON.parse(authHeader);
        }
        next();
      });

      // Protected route requiring discounts:read
      app.get(
        "/test/discounts",
        requirePermissions(PERMISSIONS.DISCOUNTS_READ),
        (req, res) => res.json({ success: true, route: "discounts" })
      );

      // Protected route requiring inventory:read
      app.get(
        "/test/inventory-summary",
        requirePermissions(PERMISSIONS.INVENTORY_READ),
        (req, res) => res.json({ success: true, route: "inventory-summary" })
      );

      // Protected route requiring employee.assign_role
      app.post(
        "/test/staff-role-preview",
        requirePermissions(PERMISSIONS.EMPLOYEE_ASSIGN_ROLE),
        (req, res) => res.json({ success: true, route: "staff-role-preview" })
      );

      // Error handler
      app.use((err, req, res, next) => {
        res.status(err.statusCode || 500).json({
          success: false,
          errorCode: err.code || err.errorCode,
          message: err.message,
        });
      });
    });

    it("denies unauthenticated caller with 401", async () => {
      const res = await request(app).get("/test/discounts");
      expect(res.status).toBe(401);
      expect(res.body.errorCode).toBe("AUTHENTICATION_REQUIRED");
    });

    it("allows user with Section 5 dot permission 'discounts.view' to access discounts:read route", async () => {
      const user = {
        id: new mongoose.Types.ObjectId().toString(),
        role: "admin",
        isPermissionFresh: true,
        permissions: ["discounts.view"],
        effectivePermissions: ["discounts.view"],
      };

      const res = await request(app)
        .get("/test/discounts")
        .set("x-test-user", JSON.stringify(user));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("allows user with legacy 'coupons:read' alias to access discounts:read route", async () => {
      const user = {
        id: new mongoose.Types.ObjectId().toString(),
        role: "admin",
        isPermissionFresh: true,
        permissions: ["coupons:read"],
        effectivePermissions: ["coupons:read"],
      };

      const res = await request(app)
        .get("/test/discounts")
        .set("x-test-user", JSON.stringify(user));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("denies customer without inventory:read on /test/inventory-summary (403)", async () => {
      const customer = {
        id: new mongoose.Types.ObjectId().toString(),
        role: "customer",
        isPermissionFresh: true,
        permissions: ["products:read", "orders:read", "reviews:read"],
        effectivePermissions: ["products:read", "orders:read", "reviews:read"],
      };

      const res = await request(app)
        .get("/test/inventory-summary")
        .set("x-test-user", JSON.stringify(customer));

      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("allows vendor with inventory:read on /test/inventory-summary (200)", async () => {
      const vendor = {
        id: new mongoose.Types.ObjectId().toString(),
        role: "vendor",
        isPermissionFresh: true,
        permissions: ["inventory:read", "products:read"],
        effectivePermissions: ["inventory:read", "products:read"],
      };

      const res = await request(app)
        .get("/test/inventory-summary")
        .set("x-test-user", JSON.stringify(vendor));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("denies staff without employee.assign_role on role preview (403)", async () => {
      const staffUser = {
        id: new mongoose.Types.ObjectId().toString(),
        role: "staff",
        isPermissionFresh: true,
        permissions: ["products:read"],
        effectivePermissions: ["products:read"],
      };

      const res = await request(app)
        .post("/test/staff-role-preview")
        .set("x-test-user", JSON.stringify(staffUser));

      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("allows actor with staff.edit alias to access employee.assign_role route", async () => {
      const managerUser = {
        id: new mongoose.Types.ObjectId().toString(),
        role: "manager",
        isPermissionFresh: true,
        permissions: ["staff.edit"],
        effectivePermissions: ["staff.edit"],
      };

      const res = await request(app)
        .post("/test/staff-role-preview")
        .set("x-test-user", JSON.stringify(managerUser));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("allows Superadmin to access all protected routes", async () => {
      const superadmin = {
        id: new mongoose.Types.ObjectId().toString(),
        role: "super_admin",
      };

      const res1 = await request(app)
        .get("/test/discounts")
        .set("x-test-user", JSON.stringify(superadmin));
      expect(res1.status).toBe(200);

      const res2 = await request(app)
        .get("/test/inventory-summary")
        .set("x-test-user", JSON.stringify(superadmin));
      expect(res2.status).toBe(200);

      const res3 = await request(app)
        .post("/test/staff-role-preview")
        .set("x-test-user", JSON.stringify(superadmin));
      expect(res3.status).toBe(200);
    });
  });
});
