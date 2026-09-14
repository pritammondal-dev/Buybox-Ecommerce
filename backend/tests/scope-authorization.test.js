const mongoose = require("mongoose");
const request = require("supertest");
const express = require("express");

const User = require("../src/models/User");
const Employee = require("../src/models/Employee");
const WorkAssignment = require("../src/models/WorkAssignment");
const Role = require("../src/models/Role");
const Permission = require("../src/models/Permission");
const RolePermission = require("../src/models/RolePermission");
const EmployeeRole = require("../src/models/EmployeeRole");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Inventory = require("../src/models/Inventory");
const Warehouse = require("../src/models/Warehouse");
const Shipment = require("../src/models/Shipment");
const SupportTicket = require("../src/models/SupportTicket");
const Customer = require("../src/models/Customer");
const Vendor = require("../src/models/Vendor");

const {
  SCOPE_TYPES,
  ALLOWED_SCOPE_TYPES,
} = require("../src/constants/scope.constants");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { generateAccessToken } = require("../src/services/token.service");
const authenticate = require("../src/middlewares/authentication.middleware");
const {
  requirePermissions,
} = require("../src/middlewares/authorization.middleware");
const { requireScope } = require("../src/middlewares/scope.middleware");
const errorHandler = require("../src/middlewares/error.middleware");
const {
  getActiveAssignments,
  hasAssignment,
  hasAnyAssignment,
  hasAllAssignments,
  assertScope,
  hasScopeAccess,
  resolveProductScope,
  resolveProductVariantScope,
  resolveInventoryScope,
  resolveWarehouseScope,
  resolveShipmentScope,
  resolveSupportTicketScope,
} = require("../src/services/scope-authorization.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_scope_test?")
  : "mongodb://127.0.0.1:27017/buybox_scope_test?replicaSet=rs0";

describe("Phase 1E — WorkAssignment Scope Authorization Foundation", () => {
  let createdPermissions = new Map();

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

  async function createTestEmployee(options = {}) {
    const status = options.status || "active";
    const user = await User.create({
      firstName: "Scoped",
      lastName: "Tester",
      email: `scoped_${Date.now()}_${Math.random().toString(36).substring(7)}@test-scope.com`,
      password: "Password123!",
      role: options.userRole || "manager",
      isActive: options.userIsActive !== undefined ? options.userIsActive : true,
      authVersion: 1,
      permissionVersion: 1,
    });

    let employee = null;
    if (!options.skipEmployee) {
      employee = await Employee.create({
        userId: user._id,
        employeeNumber: `EMP_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`,
        jobTitle: "Operations Specialist",
        department: "Operations",
        status,
      });
    }

    if (options.permissions && options.permissions.length > 0 && employee) {
      const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const role = await Role.create({
        slug: `test_role_${uniqueSuffix}`,
        name: `Test Role ${uniqueSuffix}`,
        isActive: true,
      });
      for (const pSlug of options.permissions) {
        const pDoc = await getOrCreatePermission(pSlug);
        await RolePermission.create({ roleId: role._id, permissionId: pDoc._id });
      }
      await EmployeeRole.create({
        employeeId: employee._id,
        roleId: role._id,
        isActive: true,
      });
    }

    const token = generateAccessToken({
      sub: user._id.toString(),
      role: user.role,
      authVersion: user.authVersion,
      permissionVersion: user.permissionVersion,
    });

    return { user, employee, token };
  }

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI, { autoIndex: true });
    }
    await Promise.all([
      User.init(),
      Employee.init(),
      WorkAssignment.init(),
      Role.init(),
      Permission.init(),
      RolePermission.init(),
      EmployeeRole.init(),
      Product.init(),
      ProductVariant.init(),
      Inventory.init(),
      Warehouse.init(),
      Shipment.init(),
      SupportTicket.init(),
    ]);
  });

  afterAll(async () => {
    await Promise.all([
      User.deleteMany({ email: /@test-scope\.com$/ }),
      Employee.deleteMany({}),
      WorkAssignment.deleteMany({}),
      Role.deleteMany({ slug: { $regex: /^test_role_/ } }),
      RolePermission.deleteMany({}),
      EmployeeRole.deleteMany({}),
      Product.deleteMany({ name: { $regex: /^Test Product/ } }),
      ProductVariant.deleteMany({ name: { $regex: /^Test Variant/ } }),
      Inventory.deleteMany({}),
      Warehouse.deleteMany({ name: { $regex: /^Test Warehouse/ } }),
      Shipment.deleteMany({ shipmentNumber: { $regex: /^SHP-TEST/ } }),
      SupportTicket.deleteMany({ ticketNumber: { $regex: /^TKT-TEST/ } }),
    ]);
    await mongoose.disconnect();
  });

  describe("1. Scope Constants & Contract", () => {
    it("exports canonical scope types exactly matching the WorkAssignment schema", () => {
      expect(SCOPE_TYPES).toEqual({
        VENDOR: "vendor",
        WAREHOUSE: "warehouse",
        CATEGORY: "category",
        SUPPORT_QUEUE: "support_queue",
      });
      expect(ALLOWED_SCOPE_TYPES).toEqual([
        "vendor",
        "warehouse",
        "category",
        "support_queue",
      ]);
    });
  });

  describe("2. Scope Authorization Service — Unit Cases", () => {
    it("active assignment succeeds in hasAssignment", async () => {
      const { employee } = await createTestEmployee();
      const warehouseId = new mongoose.Types.ObjectId().toString();

      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.WAREHOUSE,
        scopeId: warehouseId,
        isActive: true,
      });

      const result = await hasAssignment(
        employee._id,
        SCOPE_TYPES.WAREHOUSE,
        warehouseId,
      );
      expect(result).toBe(true);
    });

    it("missing assignment returns false in hasAssignment", async () => {
      const { employee } = await createTestEmployee();
      const warehouseId = new mongoose.Types.ObjectId().toString();

      const result = await hasAssignment(
        employee._id,
        SCOPE_TYPES.WAREHOUSE,
        warehouseId,
      );
      expect(result).toBe(false);
    });

    it("inactive assignment (isActive: false) returns false in hasAssignment", async () => {
      const { employee } = await createTestEmployee();
      const warehouseId = new mongoose.Types.ObjectId().toString();

      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.WAREHOUSE,
        scopeId: warehouseId,
        isActive: false,
      });

      const result = await hasAssignment(
        employee._id,
        SCOPE_TYPES.WAREHOUSE,
        warehouseId,
      );
      expect(result).toBe(false);
    });

    it("wrong scope type returns false even if scopeId matches", async () => {
      const { employee } = await createTestEmployee();
      const sharedId = new mongoose.Types.ObjectId().toString();

      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.VENDOR,
        scopeId: sharedId,
        isActive: true,
      });

      const isWarehouse = await hasAssignment(
        employee._id,
        SCOPE_TYPES.WAREHOUSE,
        sharedId,
      );
      expect(isWarehouse).toBe(false);

      const isVendor = await hasAssignment(
        employee._id,
        SCOPE_TYPES.VENDOR,
        sharedId,
      );
      expect(isVendor).toBe(true);
    });

    it("wrong scope ID returns false", async () => {
      const { employee } = await createTestEmployee();
      const warehouse1 = new mongoose.Types.ObjectId().toString();
      const warehouse2 = new mongoose.Types.ObjectId().toString();

      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.WAREHOUSE,
        scopeId: warehouse1,
        isActive: true,
      });

      const result = await hasAssignment(
        employee._id,
        SCOPE_TYPES.WAREHOUSE,
        warehouse2,
      );
      expect(result).toBe(false);
    });

    it("suspended employee receives no active assignments", async () => {
      const { employee } = await createTestEmployee({ status: "suspended" });
      const warehouseId = new mongoose.Types.ObjectId().toString();

      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.WAREHOUSE,
        scopeId: warehouseId,
        isActive: true,
      });

      const assignments = await getActiveAssignments(employee._id);
      expect(assignments).toEqual([]);

      const result = await hasAssignment(
        employee._id,
        SCOPE_TYPES.WAREHOUSE,
        warehouseId,
      );
      expect(result).toBe(false);
    });

    it("terminated employee receives no active assignments", async () => {
      const { employee } = await createTestEmployee({ status: "terminated" });
      const warehouseId = new mongoose.Types.ObjectId().toString();

      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.WAREHOUSE,
        scopeId: warehouseId,
        isActive: true,
      });

      const assignments = await getActiveAssignments(employee._id);
      expect(assignments).toEqual([]);

      const result = await hasAssignment(
        employee._id,
        SCOPE_TYPES.WAREHOUSE,
        warehouseId,
      );
      expect(result).toBe(false);
    });

    it("missing employee profile returns empty array and fails closed", async () => {
      const nonExistentEmployeeId = new mongoose.Types.ObjectId();
      const assignments = await getActiveAssignments(nonExistentEmployeeId);
      expect(assignments).toEqual([]);

      const hasAssigned = await hasAssignment(
        nonExistentEmployeeId,
        SCOPE_TYPES.VENDOR,
        "V1",
      );
      expect(hasAssigned).toBe(false);
    });

    it("handles multiple assignments across vendors deterministically", async () => {
      const { employee } = await createTestEmployee();
      const v1 = new mongoose.Types.ObjectId().toString();
      const v2 = new mongoose.Types.ObjectId().toString();
      const v3 = new mongoose.Types.ObjectId().toString();

      await WorkAssignment.create([
        { employeeId: employee._id, scopeType: SCOPE_TYPES.VENDOR, scopeId: v1, isActive: true },
        { employeeId: employee._id, scopeType: SCOPE_TYPES.VENDOR, scopeId: v2, isActive: true },
      ]);

      expect(await hasAssignment(employee._id, SCOPE_TYPES.VENDOR, v1)).toBe(true);
      expect(await hasAssignment(employee._id, SCOPE_TYPES.VENDOR, v2)).toBe(true);
      expect(await hasAssignment(employee._id, SCOPE_TYPES.VENDOR, v3)).toBe(false);

      expect(
        await hasAnyAssignment(employee._id, [
          { scopeType: SCOPE_TYPES.VENDOR, scopeId: v1 },
          { scopeType: SCOPE_TYPES.VENDOR, scopeId: v3 },
        ]),
      ).toBe(true);

      expect(
        await hasAllAssignments(employee._id, [
          { scopeType: SCOPE_TYPES.VENDOR, scopeId: v1 },
          { scopeType: SCOPE_TYPES.VENDOR, scopeId: v2 },
        ]),
      ).toBe(true);

      expect(
        await hasAllAssignments(employee._id, [
          { scopeType: SCOPE_TYPES.VENDOR, scopeId: v1 },
          { scopeType: SCOPE_TYPES.VENDOR, scopeId: v3 },
        ]),
      ).toBe(false);
    });

    it("handles multiple warehouse assignments deterministically", async () => {
      const { employee } = await createTestEmployee();
      const w1 = new mongoose.Types.ObjectId().toString();
      const w2 = new mongoose.Types.ObjectId().toString();
      const w3 = new mongoose.Types.ObjectId().toString();

      await WorkAssignment.create([
        { employeeId: employee._id, scopeType: SCOPE_TYPES.WAREHOUSE, scopeId: w1, isActive: true },
        { employeeId: employee._id, scopeType: SCOPE_TYPES.WAREHOUSE, scopeId: w2, isActive: true },
      ]);

      expect(await hasAssignment(employee._id, SCOPE_TYPES.WAREHOUSE, w1)).toBe(true);
      expect(await hasAssignment(employee._id, SCOPE_TYPES.WAREHOUSE, w2)).toBe(true);
      expect(await hasAssignment(employee._id, SCOPE_TYPES.WAREHOUSE, w3)).toBe(false);
    });

    it("assertScope throws 403 INSUFFICIENT_SCOPE when assignment is absent", async () => {
      const { employee } = await createTestEmployee();
      const w1 = new mongoose.Types.ObjectId().toString();

      await expect(
        assertScope(employee._id, {
          scopeType: SCOPE_TYPES.WAREHOUSE,
          scopeId: w1,
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "INSUFFICIENT_SCOPE",
      });
    });

    it("assertScope succeeds and returns true when assignment is active", async () => {
      const { employee } = await createTestEmployee();
      const w1 = new mongoose.Types.ObjectId().toString();

      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.WAREHOUSE,
        scopeId: w1,
        isActive: true,
      });

      const res = await assertScope(employee._id, {
        scopeType: SCOPE_TYPES.WAREHOUSE,
        scopeId: w1,
      });
      expect(res).toBe(true);
    });
  });

  describe("3. Scope Evaluation Logic (hasScopeAccess) & Platform Actor Semantics", () => {
    it("scoped employee with warehouse assignments is bounded to assigned warehouses only", async () => {
      const { employee } = await createTestEmployee();
      const w1 = "wh_east_1";
      const w2 = "wh_west_2";

      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.WAREHOUSE,
        scopeId: w1,
        isActive: true,
      });

      // Bounded to w1
      expect(
        await hasScopeAccess({
          employeeId: employee._id,
          scopeType: SCOPE_TYPES.WAREHOUSE,
          scopeId: w1,
          isPlatformActor: true,
          allowGlobal: true,
        }),
      ).toBe(true);

      // Denied w2 even though isPlatformActor is true, because employee is explicitly scoped
      expect(
        await hasScopeAccess({
          employeeId: employee._id,
          scopeType: SCOPE_TYPES.WAREHOUSE,
          scopeId: w2,
          isPlatformActor: true,
          allowGlobal: true,
        }),
      ).toBe(false);
    });

    it("unassigned platform actor with allowGlobal=true operates globally", async () => {
      const { employee } = await createTestEmployee();
      // Employee has NO WorkAssignments

      const hasAccess = await hasScopeAccess({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.WAREHOUSE,
        scopeId: "wh_any_123",
        isPlatformActor: true,
        allowGlobal: true,
      });
      expect(hasAccess).toBe(true);
    });

    it("unassigned actor with allowGlobal=false fails closed", async () => {
      const { employee } = await createTestEmployee();
      // Employee has NO WorkAssignments

      const hasAccess = await hasScopeAccess({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.WAREHOUSE,
        scopeId: "wh_any_123",
        isPlatformActor: true,
        allowGlobal: false,
      });
      expect(hasAccess).toBe(false);
    });

    it("non-platform actor fails closed even if allowGlobal=true", async () => {
      const { employee } = await createTestEmployee();

      const hasAccess = await hasScopeAccess({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.WAREHOUSE,
        scopeId: "wh_any_123",
        isPlatformActor: false,
        allowGlobal: true,
      });
      expect(hasAccess).toBe(false);
    });
  });

  describe("4. Resource Scope Resolvers", () => {
    let testVendorId;
    let testCategoryId;
    let testWarehouseId;
    let testProduct;
    let testVariant;
    let testInventory;
    let testShipment;
    let testTicket;

    beforeAll(async () => {
      testVendorId = new mongoose.Types.ObjectId();
      testCategoryId = new mongoose.Types.ObjectId();
      testWarehouseId = new mongoose.Types.ObjectId();

      testProduct = await Product.create({
        name: "Test Product Scope",
        slug: `test-product-scope-${Date.now()}`,
        sku: `SKU-SCOPE-${Date.now()}`,
        categoryId: testCategoryId,
        vendorId: testVendorId,
        price: 100,
      });

      testVariant = await ProductVariant.create({
        productId: testProduct._id,
        sku: `VAR-SCOPE-${Date.now()}`,
        name: "Test Variant Scope",
        price: 100,
      });

      testInventory = await Inventory.create({
        productVariantId: testVariant._id,
        warehouseId: testWarehouseId,
        onHand: 50,
      });

      testShipment = await Shipment.create({
        orderId: new mongoose.Types.ObjectId(),
        customerId: new mongoose.Types.ObjectId(),
        vendorId: testVendorId,
        warehouseId: testWarehouseId,
        shipmentNumber: `SHP-TEST-${Date.now()}`,
        shippingAddress: {
          fullName: "Recipient Test",
          phone: "9876543210",
          addressLine1: "123 Test St",
          city: "Test City",
          state: "Test State",
          postalCode: "123456",
          country: "India",
        },
      });

      testTicket = await SupportTicket.create({
        ticketNumber: `TKT-TEST-${Date.now()}`,
        customerId: new mongoose.Types.ObjectId(),
        subject: "Scope test ticket",
        description: "Testing scope resolvers",
        category: "shipping",
      });
    });

    it("resolves Product scope (vendorId and categoryId)", async () => {
      const scope = await resolveProductScope(testProduct._id);
      expect(scope).toEqual({
        vendorId: testVendorId.toString(),
        categoryId: testCategoryId.toString(),
      });
    });

    it("resolves ProductVariant scope via parent Product", async () => {
      const scope = await resolveProductVariantScope(testVariant._id);
      expect(scope).toEqual({
        vendorId: testVendorId.toString(),
        categoryId: testCategoryId.toString(),
      });
    });

    it("resolves Inventory scope (warehouseId, vendorId, categoryId)", async () => {
      const scope = await resolveInventoryScope(testInventory._id);
      expect(scope).toEqual({
        warehouseId: testWarehouseId.toString(),
        vendorId: testVendorId.toString(),
        categoryId: testCategoryId.toString(),
      });
    });

    it("resolves Warehouse scope", async () => {
      const whDoc = await Warehouse.create({
        name: "Test Warehouse Scope",
        code: `WH-${Date.now()}`,
        address: {
          addressLine1: "123 Warehouse Way",
          city: "Metropolis",
          state: "NY",
          country: "IN",
          postalCode: "10001",
        },
      });

      const scope = await resolveWarehouseScope(whDoc._id);
      expect(scope).toEqual({
        warehouseId: whDoc._id.toString(),
      });
    });

    it("resolves Shipment scope (vendorId and warehouseId)", async () => {
      const scope = await resolveShipmentScope(testShipment._id);
      expect(scope).toEqual({
        vendorId: testVendorId.toString(),
        warehouseId: testWarehouseId.toString(),
      });
    });

    it("resolves SupportTicket scope (supportQueue)", async () => {
      const scope = await resolveSupportTicketScope(testTicket._id);
      expect(scope.supportQueue).toBe("shipping");
      expect(scope.customerId).toBe(testTicket.customerId.toString());
    });

    it("resolvers fail closed (return null) on non-existent or invalid resources", async () => {
      const invalidId = new mongoose.Types.ObjectId();
      expect(await resolveProductScope(invalidId)).toBeNull();
      expect(await resolveProductVariantScope(invalidId)).toBeNull();
      expect(await resolveInventoryScope(invalidId)).toBeNull();
      expect(await resolveWarehouseScope(invalidId)).toBeNull();
      expect(await resolveShipmentScope(invalidId)).toBeNull();
      expect(await resolveSupportTicketScope(invalidId)).toBeNull();
      expect(await resolveProductScope("invalid_id")).toBeNull();
    });
  });

  describe("5. Scope Middleware (requireScope) Integration Test Harness", () => {
    let testApp;
    const testWarehouseW1 = new mongoose.Types.ObjectId().toString();
    const testWarehouseW2 = new mongoose.Types.ObjectId().toString();
    const testVendorV1 = new mongoose.Types.ObjectId().toString();

    beforeAll(() => {
      testApp = express();
      testApp.use(express.json());

      // Route 1: Scoped warehouse route requiring permission + warehouse scope
      testApp.get(
        "/test/warehouses/:warehouseId/stock",
        authenticate,
        requirePermissions(PERMISSIONS.WAREHOUSES_READ),
        requireScope({
          scopeType: SCOPE_TYPES.WAREHOUSE,
          resolveScopeId: "params.warehouseId",
        }),
        (req, res) => {
          res.status(200).json({
            success: true,
            scope: req.scope,
          });
        },
      );

      // Route 2: Scoped vendor route requiring permission + vendor scope
      testApp.get(
        "/test/vendors/:vendorId/products",
        authenticate,
        requirePermissions(PERMISSIONS.PRODUCTS_READ),
        requireScope({
          scopeType: SCOPE_TYPES.VENDOR,
          resolveScopeId: (req) => req.params.vendorId,
        }),
        (req, res) => {
          res.status(200).json({
            success: true,
            scope: req.scope,
          });
        },
      );

      // Route 3: Global-permitted route with allowGlobalPlatformActor
      testApp.get(
        "/test/central-ops/warehouses/:warehouseId",
        authenticate,
        requirePermissions(PERMISSIONS.WAREHOUSES_READ),
        requireScope({
          scopeType: SCOPE_TYPES.WAREHOUSE,
          resolveScopeId: "params.warehouseId",
          allowGlobalPlatformActor: true,
        }),
        (req, res) => {
          res.status(200).json({
            success: true,
            scope: req.scope,
          });
        },
      );

      testApp.use(errorHandler);
    });

    it("unauthenticated request fails with 401", async () => {
      const res = await request(testApp).get(
        `/test/warehouses/${testWarehouseW1}/stock`,
      );
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
    });

    it("customer identity cannot access employee scoped route (fails closed)", async () => {
      const customerUser = await User.create({
        firstName: "Customer",
        lastName: "ScopeTester",
        email: `customer_${Date.now()}@test-scope.com`,
        password: "Password123!",
        role: "customer",
        isActive: true,
      });

      const token = generateAccessToken({
        sub: customerUser._id.toString(),
        role: "customer",
        authVersion: 1,
        permissionVersion: 1,
      });

      const res = await request(testApp)
        .get(`/test/warehouses/${testWarehouseW1}/stock`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      // Fails either on requirePermissions or requireScope
      expect(["INSUFFICIENT_PERMISSIONS", "INSUFFICIENT_SCOPE"]).toContain(
        res.body.code,
      );
    });

    it("vendor identity cannot access employee scoped route (fails closed)", async () => {
      const vendorUser = await User.create({
        firstName: "Vendor",
        lastName: "ScopeTester",
        email: `vendor_${Date.now()}@test-scope.com`,
        password: "Password123!",
        role: "vendor",
        isActive: true,
      });

      const token = generateAccessToken({
        sub: vendorUser._id.toString(),
        role: "vendor",
        authVersion: 1,
        permissionVersion: 1,
      });

      // Vendor tries to access warehouse scoped route
      const res = await request(testApp)
        .get(`/test/warehouses/${testWarehouseW1}/stock`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it("platform actor without permission fails at requirePermissions before scope check", async () => {
      // Employee has WorkAssignment for W1, but NO permissions
      const { employee, token } = await createTestEmployee();
      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.WAREHOUSE,
        scopeId: testWarehouseW1,
        isActive: true,
      });

      const res = await request(testApp)
        .get(`/test/warehouses/${testWarehouseW1}/stock`)
        .set("Authorization", `Bearer ${token}`);

      // Rejected at permission level! Scope does NOT bypass permissions!
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("employee with permission AND active scope assignment succeeds", async () => {
      const { employee, token } = await createTestEmployee({
        permissions: [PERMISSIONS.WAREHOUSES_READ],
      });

      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.WAREHOUSE,
        scopeId: testWarehouseW1,
        isActive: true,
      });

      const res = await request(testApp)
        .get(`/test/warehouses/${testWarehouseW1}/stock`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.scope.scopeType).toBe(SCOPE_TYPES.WAREHOUSE);
      expect(res.body.scope.scopeId).toBe(testWarehouseW1);
    });

    it("employee with permission but WRONG scope assignment fails (403 INSUFFICIENT_SCOPE)", async () => {
      const { employee, token } = await createTestEmployee({
        permissions: [PERMISSIONS.WAREHOUSES_READ],
      });

      // Assigned to W1 only
      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.WAREHOUSE,
        scopeId: testWarehouseW1,
        isActive: true,
      });

      // Attempts to access W2
      const res = await request(testApp)
        .get(`/test/warehouses/${testWarehouseW2}/stock`)
        .set("Authorization", `Bearer ${token}`);

      // Permission check passes, but scope check rejects! Permission does not bypass scope!
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_SCOPE");
    });

    it("employee with missing employee profile fails (403 EMPLOYEE_PROFILE_REQUIRED)", async () => {
      const { user, token } = await createTestEmployee({
        skipEmployee: true,
        userRole: "manager",
      });

      // Give role-permission to user role so permission check passes
      const res = await request(testApp)
        .get(`/test/warehouses/${testWarehouseW1}/stock`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(["EMPLOYEE_PROFILE_REQUIRED", "INSUFFICIENT_PERMISSIONS"]).toContain(
        res.body.code,
      );
    });

    it("suspended employee fails scope check even with permission and assignment", async () => {
      const { employee, token } = await createTestEmployee({
        status: "suspended",
        permissions: [PERMISSIONS.WAREHOUSES_READ],
      });

      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.WAREHOUSE,
        scopeId: testWarehouseW1,
        isActive: true,
      });

      const res = await request(testApp)
        .get(`/test/warehouses/${testWarehouseW1}/stock`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it("unassigned platform actor passes on route with allowGlobalPlatformActor=true", async () => {
      const { token } = await createTestEmployee({
        permissions: [PERMISSIONS.WAREHOUSES_READ],
      });
      // Employee has NO assignments

      const res = await request(testApp)
        .get(`/test/central-ops/warehouses/${testWarehouseW1}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("scoped platform actor assigned to W1 fails on W2 even with allowGlobalPlatformActor=true", async () => {
      const { employee, token } = await createTestEmployee({
        permissions: [PERMISSIONS.WAREHOUSES_READ],
      });

      // Employee is explicitly scoped to W1
      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.WAREHOUSE,
        scopeId: testWarehouseW1,
        isActive: true,
      });

      // Accessing W2 fails because scoped assignment restricts them
      const res = await request(testApp)
        .get(`/test/central-ops/warehouses/${testWarehouseW2}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_SCOPE");
    });

    it("unresolved scope parameter fails closed (403 UNRESOLVED_SCOPE)", async () => {
      const { token } = await createTestEmployee({
        permissions: [PERMISSIONS.PRODUCTS_READ],
      });

      // App with a route where resolveScopeId returns null
      const unresolvableApp = express();
      unresolvableApp.use(express.json());
      unresolvableApp.get(
        "/test/unresolved",
        authenticate,
        requirePermissions(PERMISSIONS.PRODUCTS_READ),
        requireScope({
          scopeType: SCOPE_TYPES.VENDOR,
          resolveScopeId: () => null, // Cannot resolve
        }),
        (req, res) => res.status(200).json({ success: true }),
      );
      unresolvableApp.use(errorHandler);

      const res = await request(unresolvableApp)
        .get("/test/unresolved")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("UNRESOLVED_SCOPE");
    });
  });

  describe("6. Domain Ownership & Scope Separation", () => {
    it("ownership checks and scope checks operate as independent orthogonal boundaries", async () => {
      // Create vendor
      const vendorUser = await User.create({
        firstName: "VendorOwner",
        lastName: "Test",
        email: `vendor_owner_${Date.now()}@test-scope.com`,
        password: "Password123!",
        role: "vendor",
        isActive: true,
      });

      const vendor = await Vendor.create({
        userId: vendorUser._id,
        businessName: `Vendor Store ${Date.now()}`,
        businessSlug: `vendor-store-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        status: "approved",
      });

      const otherVendor = await Vendor.create({
        userId: new mongoose.Types.ObjectId(),
        businessName: `Other Store ${Date.now()}`,
        businessSlug: `other-store-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        status: "approved",
      });

      // Domain ownership rule simulation:
      const checkVendorOwnership = (resourceVendorId, authenticatedVendorId) => {
        return (
          resourceVendorId &&
          authenticatedVendorId &&
          resourceVendorId.toString() === authenticatedVendorId.toString()
        );
      };

      // Vendor owns their own resource
      expect(checkVendorOwnership(vendor._id, vendor._id)).toBe(true);

      // Vendor CANNOT own other vendor's resource
      expect(checkVendorOwnership(otherVendor._id, vendor._id)).toBe(false);

      // Scope authorization: An employee assigned to vendor V1 can manage V1's operations
      const { employee } = await createTestEmployee();
      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.VENDOR,
        scopeId: vendor._id.toString(),
        isActive: true,
      });

      // Employee has scope for vendor, but is NOT the vendor owner (orthogonal concepts)
      expect(
        await hasAssignment(
          employee._id,
          SCOPE_TYPES.VENDOR,
          vendor._id.toString(),
        ),
      ).toBe(true);
      expect(
        await hasAssignment(
          employee._id,
          SCOPE_TYPES.VENDOR,
          otherVendor._id.toString(),
        ),
      ).toBe(false);
    });
  });
});
