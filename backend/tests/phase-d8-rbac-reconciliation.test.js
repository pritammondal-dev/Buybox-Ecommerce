const request = require("supertest");
const mongoose = require("mongoose");
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
  requireRoles,
} = require("../src/middlewares/authorization.middleware");
const {
  ROLE_PERMISSIONS,
  CANONICAL_PERMISSIONS_49,
} = require("../src/constants/role-permissions.constants");
const { SYSTEM_ROLES } = require("../src/seeds/rbac.seed");
const orderRoutes = require("../src/routes/order.routes");
const fulfillmentExceptionRoutes = require("../src/routes/fulfillment-exception.routes");
const warehouseOperationsRoutes = require("../src/routes/warehouse-operations.routes");

describe("Phase D8 — Complete Feature-to-Permission Reconciliation Suite", () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Inject simulated authenticated session from custom header for testing
    app.use((req, res, next) => {
      const authHeader = req.headers["x-test-user"];
      if (authHeader) {
        req.user = JSON.parse(authHeader);
      }
      next();
    });

    app.use("/api/v1/orders", orderRoutes);
    app.use("/api/v1/fulfillment-exceptions", fulfillmentExceptionRoutes);
    app.use("/api/v1/warehouse-operations", warehouseOperationsRoutes);

    // Standard test error handler
    app.use((err, req, res, next) => {
      res.status(err.statusCode || 500).json({
        success: false,
        errorCode: err.code || err.errorCode || "INTERNAL_ERROR",
        message: err.message,
      });
    });
  });

  describe("1. Admin Order Boundary & Role Guarding (Finding 1 Remediation)", () => {
    it("denies unauthenticated access to /api/v1/orders/admin (401)", async () => {
      const res = await request(app).get("/api/v1/orders/admin");
      expect(res.status).toBe(401);
      expect(res.body.errorCode).toBe("AUTHENTICATION_REQUIRED");
    });

    it("denies customer access to /api/v1/orders/admin with 403 INSUFFICIENT_ROLE", async () => {
      const customer = {
        id: new mongoose.Types.ObjectId().toString(),
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER],
        isPermissionFresh: true,
      };

      const res = await request(app)
        .get("/api/v1/orders/admin")
        .set("x-test-user", JSON.stringify(customer));

      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe("INSUFFICIENT_ROLE");
    });

    it("denies vendor access to /api/v1/orders/admin with 403 INSUFFICIENT_ROLE", async () => {
      const vendor = {
        id: new mongoose.Types.ObjectId().toString(),
        role: ROLES.VENDOR,
        roles: [ROLES.VENDOR],
        isPermissionFresh: true,
      };

      const res = await request(app)
        .get("/api/v1/orders/admin")
        .set("x-test-user", JSON.stringify(vendor));

      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe("INSUFFICIENT_ROLE");
    });

    it("denies customer access to /api/v1/orders/export with 403 INSUFFICIENT_ROLE", async () => {
      const customer = {
        id: new mongoose.Types.ObjectId().toString(),
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER],
        isPermissionFresh: true,
      };

      const res = await request(app)
        .get("/api/v1/orders/export")
        .set("x-test-user", JSON.stringify(customer));

      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe("INSUFFICIENT_ROLE");
    });

    it("denies customer access to /api/v1/orders/export/items with 403 INSUFFICIENT_ROLE", async () => {
      const customer = {
        id: new mongoose.Types.ObjectId().toString(),
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER],
        isPermissionFresh: true,
      };

      const res = await request(app)
        .get("/api/v1/orders/export/items")
        .set("x-test-user", JSON.stringify(customer));

      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe("INSUFFICIENT_ROLE");
    });
  });

  describe("2. Order Packing Slip Route Guarding (Finding 2 Remediation)", () => {
    it("denies unauthenticated request to /api/v1/orders/:id/packing-slip with 401", async () => {
      const res = await request(app).get("/api/v1/orders/order-123/packing-slip");
      expect(res.status).toBe(401);
      expect(res.body.errorCode).toBe("AUTHENTICATION_REQUIRED");
    });
  });

  describe("3. Fulfillment Exception Administrator Queue Role Guarding (Finding 3 Remediation)", () => {
    it("denies customer access to /api/v1/fulfillment-exceptions/admin with 403 INSUFFICIENT_ROLE", async () => {
      const customer = {
        id: new mongoose.Types.ObjectId().toString(),
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER],
        isPermissionFresh: true,
      };

      const res = await request(app)
        .get("/api/v1/fulfillment-exceptions/admin")
        .set("x-test-user", JSON.stringify(customer));

      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe("INSUFFICIENT_ROLE");
    });

    it("denies vendor access to /api/v1/fulfillment-exceptions/admin with 403 INSUFFICIENT_ROLE", async () => {
      const vendor = {
        id: new mongoose.Types.ObjectId().toString(),
        role: ROLES.VENDOR,
        roles: [ROLES.VENDOR],
        isPermissionFresh: true,
      };

      const res = await request(app)
        .get("/api/v1/fulfillment-exceptions/admin")
        .set("x-test-user", JSON.stringify(vendor));

      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe("INSUFFICIENT_ROLE");
    });
  });

  describe("4. Warehouse Operations Allocation Route Guarding (Finding 4 Remediation)", () => {
    it("denies customer access to /api/v1/warehouse-operations/allocations/eligible/:productVariantId with 403", async () => {
      const validObjectId = new mongoose.Types.ObjectId().toString();
      const customer = {
        id: new mongoose.Types.ObjectId().toString(),
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER],
        isPermissionFresh: true,
      };

      const res = await request(app)
        .get(`/api/v1/warehouse-operations/allocations/eligible/${validObjectId}`)
        .set("x-test-user", JSON.stringify(customer));

      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe("INSUFFICIENT_PERMISSIONS");
    });
  });

  describe("5. Permission Alias Isolation & Boundary Safety", () => {
    it("resolves discounts:read to promotions and coupons without leaking to orders or inventory", () => {
      const aliases = resolvePermissionAliases("discounts:read");
      expect(aliases).toContain("discounts:read");
      expect(aliases).toContain("discounts.view");
      expect(aliases).toContain("coupons:read");
      expect(aliases).toContain("campaigns:read");

      // Verify no cross-module privilege expansion
      expect(aliases).not.toContain(PERMISSIONS.ORDERS_READ);
      expect(aliases).not.toContain(PERMISSIONS.INVENTORY_READ);
      expect(aliases).not.toContain(PERMISSIONS.ROLES_MANAGE);
    });

    it("resolves discounts:manage without leaking to governance or settings", () => {
      const aliases = resolvePermissionAliases("discounts:manage");
      expect(aliases).toContain("discounts:manage");
      expect(aliases).toContain("discounts.manage");
      expect(aliases).toContain("coupons:manage");
      expect(aliases).toContain("campaigns:manage");

      expect(aliases).not.toContain(PERMISSIONS.PERMISSIONS_MANAGE);
      expect(aliases).not.toContain(PERMISSIONS.SETTINGS_MANAGE);
    });
  });

  describe("6. Seed & Canonical Definitions Safety", () => {
    it("preserves exactly 49 canonical permissions in CANONICAL_PERMISSIONS_49", () => {
      expect(CANONICAL_PERMISSIONS_49).toHaveLength(49);
    });

    it("verifies system_super_admin seed maps exactly 49 canonical permissions", () => {
      const superAdminSeed = SYSTEM_ROLES.find(
        (r) => r.slug === "system_super_admin"
      );
      expect(superAdminSeed).toBeDefined();
      expect(superAdminSeed.permissions).toHaveLength(49);
    });

    it("verifies customer baseline contains exactly 3 permissions", () => {
      expect(ROLE_PERMISSIONS[ROLES.CUSTOMER]).toEqual([
        PERMISSIONS.PRODUCTS_READ,
        PERMISSIONS.ORDERS_READ,
        PERMISSIONS.REVIEWS_READ,
      ]);
    });

    it("verifies vendor baseline contains exactly 13 permissions", () => {
      expect(ROLE_PERMISSIONS[ROLES.VENDOR]).toHaveLength(13);
      expect(ROLE_PERMISSIONS[ROLES.VENDOR]).toContain(PERMISSIONS.PRODUCTS_READ);
      expect(ROLE_PERMISSIONS[ROLES.VENDOR]).toContain(PERMISSIONS.PRODUCTS_DELETE);
      expect(ROLE_PERMISSIONS[ROLES.VENDOR]).toContain(PERMISSIONS.INVENTORY_READ);
      expect(ROLE_PERMISSIONS[ROLES.VENDOR]).toContain(PERMISSIONS.ORDERS_READ_OWN);
      expect(ROLE_PERMISSIONS[ROLES.VENDOR]).toContain(PERMISSIONS.SHIPMENTS_READ_OWN);
      expect(ROLE_PERMISSIONS[ROLES.VENDOR]).not.toContain(PERMISSIONS.USERS_MANAGE);
      expect(ROLE_PERMISSIONS[ROLES.VENDOR]).not.toContain(PERMISSIONS.ROLES_MANAGE);
    });
  });
});
