const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Employee = require("../src/models/Employee");
const Customer = require("../src/models/Customer");
const Vendor = require("../src/models/Vendor");
const Warehouse = require("../src/models/Warehouse");
const Shipment = require("../src/models/Shipment");
const Order = require("../src/models/Order");
const Role = require("../src/models/Role");
const Permission = require("../src/models/Permission");
const RolePermission = require("../src/models/RolePermission");
const EmployeeRole = require("../src/models/EmployeeRole");
const EmployeePermissionGrant = require("../src/models/EmployeePermissionGrant");
const EmployeePermissionRestriction = require("../src/models/EmployeePermissionRestriction");
const { orderIdSchema } = require("../src/validators/order/order-id.validator");
const { shipmentOrderIdSchema } = require("../src/validators/shipping/shipment-order-id.validator");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const { generateAccessToken } = require("../src/services/token.service");
const {
  incrementAuthVersion,
  incrementPermissionVersion,
} = require("../src/services/authorization.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_batch2g_test?")
  : "mongodb://127.0.0.1:27017/buybox_batch2g_test?replicaSet=rs0";

describe("Phase 1G / Batch 2G — Logistics Core Operations Route Authorization (PBAC)", () => {
  let createdPermissions = new Map();

  // Helper to create test employee user + profile
  async function createTestEmployee(options = {}) {
    const status = options.status || "active";
    let user;
    if (options.userRole === "super_admin") {
      user = await User.findOne({ role: "super_admin", isActive: true });
    }
    if (!user) {
      user = await User.create({
        firstName: "Batch2G",
        lastName: options.userRole === "super_admin" ? "SuperAdmin" : "Staff",
        email: `staff_${Date.now()}_${Math.random().toString(36).substring(7)}@test-batch2g.com`,
        password: "Password123!",
        role: options.userRole || "manager",
        isActive: options.isActive !== undefined ? options.isActive : true,
        authVersion: 1,
        permissionVersion: 1,
      });
    }

    let employee = await Employee.findOne({ userId: user._id });
    if (!employee) {
      employee = await Employee.create({
        userId: user._id,
        employeeNumber: `EMP_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`,
        jobTitle: "Logistics Coordinator",
        department: "Logistics",
        status,
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

  // Helper to create customer user + customer profile
  async function createTestCustomer() {
    const user = await User.create({
      firstName: "Customer",
      lastName: "Batch2GTester",
      email: `customer_${Date.now()}_${Math.random().toString(36).substring(7)}@test-batch2g.com`,
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
      lastName: "Batch2GTester",
      email: `vendor_${Date.now()}_${Math.random().toString(36).substring(7)}@test-batch2g.com`,
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

  // Helper to get or create permission document
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

  // Helper to create direct permission grant
  async function createDirectGrant(employeeId, permissionSlug, expiresAt = null) {
    const perm = await getOrCreatePermission(permissionSlug);
    return EmployeePermissionGrant.create({
      employeeId,
      permissionId: perm._id,
      isActive: true,
      expiresAt,
    });
  }

  // Helper to create direct permission restriction
  async function createDirectRestriction(employeeId, permissionSlug, expiresAt = null) {
    const perm = await getOrCreatePermission(permissionSlug);
    return EmployeePermissionRestriction.create({
      employeeId,
      permissionId: perm._id,
      isActive: true,
      expiresAt,
    });
  }

  // Helper to create a warehouse document
  async function createTestWarehouse(overrides = {}) {
    const code = `WH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    return Warehouse.create({
      name: "Bangalore Central Hub",
      code,
      description: "Primary fulfillment facility",
      address: {
        addressLine1: "123 Outer Ring Rd",
        city: "Bangalore",
        state: "Karnataka",
        postalCode: "560103",
        country: "IN",
      },
      contactPhone: "9876543210",
      contactEmail: "wh-blr@buybox.test",
      isActive: true,
      ...overrides,
    });
  }

  // Helper to create a shipment document
  async function createTestShipment(overrides = {}) {
    const shipmentNumber = `SHP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    return Shipment.create({
      orderId: new mongoose.Types.ObjectId(),
      customerId: new mongoose.Types.ObjectId(),
      vendorId: new mongoose.Types.ObjectId(),
      warehouseId: new mongoose.Types.ObjectId(),
      shipmentNumber,
      status: "created",
      inventoryStatus: "reserved",
      carrier: "BlueDart",
      serviceLevel: "standard",
      trackingNumber: `TRK-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      trackingUrl: "https://tracking.carrier.test",
      shippingAddress: {
        fullName: "Test Recipient",
        phone: "9876543210",
        addressLine1: "456 Test Lane",
        city: "Bangalore",
        state: "Karnataka",
        postalCode: "560001",
        country: "IN",
      },
      items: [
        {
          productId: new mongoose.Types.ObjectId(),
          productVariantId: new mongoose.Types.ObjectId(),
          sku: "TEST-SKU-001",
          name: "Test Shipment Item",
          quantity: 1,
        },
      ],
      ...overrides,
    });
  }

  // Helper to create an order document
  async function createTestOrder(customerId, overrides = {}) {
    return Order.create({
      customerId,
      orderNumber: `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      currency: "INR",
      items: [
        {
          productId: new mongoose.Types.ObjectId(),
          productVariantId: new mongoose.Types.ObjectId(),
          warehouseId: new mongoose.Types.ObjectId(),
          vendorId: new mongoose.Types.ObjectId(),
          sku: "TEST-SKU-ORD",
          productName: "Test Order Product",
          quantity: 1,
          unitPrice: 500,
          discountTotal: 0,
          taxTotal: 0,
          lineTotal: 500,
          currency: "INR",
        },
      ],
      subtotal: 500,
      discountTotal: 0,
      taxTotal: 90,
      deliveryFee: 50,
      grandTotal: 640,
      shippingAddress: {
        fullName: "Test Customer",
        phone: "9876543210",
        addressLine1: "789 Customer Road",
        city: "Bangalore",
        state: "Karnataka",
        postalCode: "560001",
        country: "IN",
      },
      status: "confirmed",
      ...overrides,
    });
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
    await getOrCreatePermission(PERMISSIONS.WAREHOUSES_MANAGE);
    await getOrCreatePermission(PERMISSIONS.SHIPMENTS_READ);
  });

  afterAll(async () => {
    try {
      await User.deleteMany({ email: /@test-batch2g\.com$/ });
      await Employee.deleteMany({ department: "Logistics" });
      await Customer.deleteMany({});
      await Vendor.deleteMany({ businessSlug: /^vendor-corp-/ });
      await Role.deleteMany({ slug: /^test_batch2g_/ });
      await Warehouse.deleteMany({ code: /^WH-/ });
      await Shipment.deleteMany({ shipmentNumber: /^SHP-/ });
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
    test("reconciliation: warehouse.routes.js mounts POST / with router-level authenticate and requirePermissions(warehouses:manage)", () => {
      const warehouseRoutes = require("../src/routes/warehouse.routes");
      expect(warehouseRoutes).toBeDefined();

      const routerAuth = warehouseRoutes.stack.find(
        (l) => !l.route && (l.name === "authenticate" || l.handle.name === "authenticate")
      );
      expect(routerAuth).toBeDefined();

      const postLayer = warehouseRoutes.stack.find(
        (l) => l.route && l.route.path === "/" && l.route.methods.post
      );
      expect(postLayer).toBeDefined();
      expect(postLayer.route.stack.length).toBeGreaterThanOrEqual(3);
    });

    test("reconciliation: shipment.routes.js mounts GET /:shipmentId with router-level authenticate and requirePermissions(shipments:read)", () => {
      const shipmentRoutes = require("../src/routes/shipment.routes");
      expect(shipmentRoutes).toBeDefined();

      const routerAuth = shipmentRoutes.stack.find(
        (l) => !l.route && (l.name === "authenticate" || l.handle.name === "authenticate")
      );
      expect(routerAuth).toBeDefined();

      const getShipmentLayer = shipmentRoutes.stack.find(
        (l) => l.route && l.route.path === "/:shipmentId" && l.route.methods.get
      );
      expect(getShipmentLayer).toBeDefined();

      const middlewareNames = getShipmentLayer.route.stack.map((s) => s.name || s.handle.name);
      expect(middlewareNames).toContain("getShipmentById");
      expect(getShipmentLayer.route.stack.length).toBeGreaterThanOrEqual(2);
    });

    test("reconciliation: shipment.routes.js mounts GET /order/:orderId with router-level authenticate, requirePermissions(shipments:read), and shipmentOrderIdSchema", () => {
      const shipmentRoutes = require("../src/routes/shipment.routes");
      expect(shipmentRoutes).toBeDefined();

      const getOrderByOrderLayer = shipmentRoutes.stack.find(
        (l) => l.route && l.route.path === "/order/:orderId" && l.route.methods.get
      );
      expect(getOrderByOrderLayer).toBeDefined();

      const middlewareNames = getOrderByOrderLayer.route.stack.map((s) => s.name || s.handle.name);
      expect(middlewareNames).toContain("getShipmentsByOrderId");
      expect(getOrderByOrderLayer.route.stack.length).toBeGreaterThanOrEqual(3);
    });

    test("reconciliation: target routes contain zero legacy static-role bypass guards", () => {
      const warehouseRoutes = require("../src/routes/warehouse.routes");
      const shipmentRoutes = require("../src/routes/shipment.routes");

      const postWhLayer = warehouseRoutes.stack.find(
        (l) => l.route && l.route.path === "/" && l.route.methods.post
      );
      const getShpLayer = shipmentRoutes.stack.find(
        (l) => l.route && l.route.path === "/:shipmentId" && l.route.methods.get
      );
      const getOrdShpLayer = shipmentRoutes.stack.find(
        (l) => l.route && l.route.path === "/order/:orderId" && l.route.methods.get
      );

      const allMiddleware = [
        ...postWhLayer.route.stack.map((s) => s.name || s.handle.name),
        ...getShpLayer.route.stack.map((s) => s.name || s.handle.name),
        ...getOrdShpLayer.route.stack.map((s) => s.name || s.handle.name),
      ];

      expect(allMiddleware).not.toContain("authorize");
      expect(allMiddleware).not.toContain("requireRoles");
    });
  });

  // ---------------------------------------------------------------------------
  // 2. POST /api/v1/warehouses Dynamic PBAC & Business Safety
  // ---------------------------------------------------------------------------
  describe("2. POST /api/v1/warehouses Dynamic PBAC & Business Safety", () => {
    const validWarehousePayload = () => ({
      name: "North Logistics Center",
      code: `WH-N-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`,
      address: {
        addressLine1: "45 Industrial Area Phase II",
        city: "Gurugram",
        state: "Haryana",
        postalCode: "122002",
        country: "IN",
      },
      contactPhone: "9811122233",
      contactEmail: "wh-north@buybox.test",
    });

    test("unauthenticated request returns 401 AUTHENTICATION_REQUIRED", async () => {
      const res = await dispatchRequest("POST", "/api/v1/warehouses", null, validWarehousePayload());
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
    });

    test("authenticated employee without warehouses:manage returns 403 INSUFFICIENT_PERMISSIONS", async () => {
      const { token } = await createTestEmployee();
      const res = await dispatchRequest("POST", "/api/v1/warehouses", token, validWarehousePayload());
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("dynamic role granting warehouses:manage allows warehouse creation", async () => {
      const { employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(employee._id, "test_batch2g_wh_manager", [
        PERMISSIONS.WAREHOUSES_MANAGE,
      ]);

      const payload = validWarehousePayload();
      const res = await dispatchRequest("POST", "/api/v1/warehouses", token, payload);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Warehouse created successfully");
      expect(res.body.data.warehouse).toBeDefined();
      expect(res.body.data.warehouse.code).toBe(payload.code);
    });

    test("direct permission grant without role allows warehouse creation", async () => {
      const { employee, token } = await createTestEmployee();
      await createDirectGrant(employee._id, PERMISSIONS.WAREHOUSES_MANAGE);

      const payload = validWarehousePayload();
      const res = await dispatchRequest("POST", "/api/v1/warehouses", token, payload);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.warehouse.code).toBe(payload.code);
    });

    test("active restriction overrides role permission (restriction dominance)", async () => {
      const { employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(employee._id, "test_batch2g_wh_op", [
        PERMISSIONS.WAREHOUSES_MANAGE,
      ]);
      await createDirectRestriction(employee._id, PERMISSIONS.WAREHOUSES_MANAGE);

      const res = await dispatchRequest("POST", "/api/v1/warehouses", token, validWarehousePayload());
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("active restriction overrides direct grant (restriction dominance)", async () => {
      const { employee, token } = await createTestEmployee();
      await createDirectGrant(employee._id, PERMISSIONS.WAREHOUSES_MANAGE);
      await createDirectRestriction(employee._id, PERMISSIONS.WAREHOUSES_MANAGE);

      const res = await dispatchRequest("POST", "/api/v1/warehouses", token, validWarehousePayload());
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("expired direct grant fails closed with 403 INSUFFICIENT_PERMISSIONS", async () => {
      const { employee, token } = await createTestEmployee();
      const pastDate = new Date(Date.now() - 3600000);
      await createDirectGrant(employee._id, PERMISSIONS.WAREHOUSES_MANAGE, pastDate);

      const res = await dispatchRequest("POST", "/api/v1/warehouses", token, validWarehousePayload());
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("suspended employee account is denied access with 403 INSUFFICIENT_PERMISSIONS", async () => {
      const { employee, token } = await createTestEmployee({ status: "suspended" });
      await createDirectGrant(employee._id, PERMISSIONS.WAREHOUSES_MANAGE);

      const res = await dispatchRequest("POST", "/api/v1/warehouses", token, validWarehousePayload());
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("terminated employee account is denied access with 403 INSUFFICIENT_PERMISSIONS", async () => {
      const { employee, token } = await createTestEmployee({ status: "terminated" });
      await createDirectGrant(employee._id, PERMISSIONS.WAREHOUSES_MANAGE);

      const res = await dispatchRequest("POST", "/api/v1/warehouses", token, validWarehousePayload());
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("stale permissionVersion triggers authoritative database lookup", async () => {
      const { user, employee, token } = await createTestEmployee();
      // Token has permissionVersion 1. Now assign grant and increment DB permissionVersion to 2
      await createDirectGrant(employee._id, PERMISSIONS.WAREHOUSES_MANAGE);
      await incrementPermissionVersion(user._id);

      const res = await dispatchRequest("POST", "/api/v1/warehouses", token, validWarehousePayload());
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    test("stale authVersion rejects request with 401 AUTH_VERSION_MISMATCH", async () => {
      const { user, employee, token } = await createTestEmployee();
      await createDirectGrant(employee._id, PERMISSIONS.WAREHOUSES_MANAGE);
      await incrementAuthVersion(user._id);

      const res = await dispatchRequest("POST", "/api/v1/warehouses", token, validWarehousePayload());
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("AUTH_VERSION_MISMATCH");
    });

    test("customer user is denied access with 403 INSUFFICIENT_PERMISSIONS", async () => {
      const { token } = await createTestCustomer();
      const res = await dispatchRequest("POST", "/api/v1/warehouses", token, validWarehousePayload());
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("vendor user is denied access with 403 INSUFFICIENT_PERMISSIONS", async () => {
      const { token } = await createTestVendor();
      const res = await dispatchRequest("POST", "/api/v1/warehouses", token, validWarehousePayload());
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("authorized Admin access: admin employee with dynamic warehouses:manage role is granted access", async () => {
      const { employee, token } = await createTestEmployee({ userRole: "admin" });
      await assignRoleWithPermissions(employee._id, "test_batch2g_admin_wh", [
        PERMISSIONS.WAREHOUSES_MANAGE,
      ]);
      const res = await dispatchRequest("POST", "/api/v1/warehouses", token, validWarehousePayload());
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    test("authorized Super Admin access: super_admin employee with dynamic permissions is granted access", async () => {
      const { employee, token } = await createTestEmployee({ userRole: "super_admin" });
      await assignRoleWithPermissions(employee._id, "test_batch2g_super_wh", [
        PERMISSIONS.WAREHOUSES_MANAGE,
      ]);
      const res = await dispatchRequest("POST", "/api/v1/warehouses", token, validWarehousePayload());
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    test("no legacy static-role bypass: employee with privileged legacy user.role but no PBAC permissions is rejected (403)", async () => {
      const { token } = await createTestEmployee({ userRole: "admin" });
      const res = await dispatchRequest("POST", "/api/v1/warehouses", token, validWarehousePayload());
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("business safety: validation error when payload is missing required fields", async () => {
      const { employee, token } = await createTestEmployee();
      await createDirectGrant(employee._id, PERMISSIONS.WAREHOUSES_MANAGE);

      const invalidPayload = {
        name: "Missing Code Hub",
        // missing code & address
      };

      const res = await dispatchRequest("POST", "/api/v1/warehouses", token, invalidPayload);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    test("business safety: validation error when warehouse code contains lowercase or invalid symbols", async () => {
      const { employee, token } = await createTestEmployee();
      await createDirectGrant(employee._id, PERMISSIONS.WAREHOUSES_MANAGE);

      const invalidPayload = {
        ...validWarehousePayload(),
        code: "invalid code with spaces and lower!",
      };

      const res = await dispatchRequest("POST", "/api/v1/warehouses", token, invalidPayload);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    test("business safety: duplicate warehouse code returns 409 WAREHOUSE_CODE_ALREADY_EXISTS", async () => {
      const { employee, token } = await createTestEmployee();
      await createDirectGrant(employee._id, PERMISSIONS.WAREHOUSES_MANAGE);

      const existingWh = await createTestWarehouse();
      const duplicatePayload = {
        ...validWarehousePayload(),
        code: existingWh.code,
      };

      const res = await dispatchRequest("POST", "/api/v1/warehouses", token, duplicatePayload);
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("WAREHOUSE_CODE_ALREADY_EXISTS");
    });
  });

  // ---------------------------------------------------------------------------
  // 3. GET /api/v1/shipments/:shipmentId Dynamic PBAC, Actor Isolation & Safety
  // ---------------------------------------------------------------------------
  describe("3. GET /api/v1/shipments/:shipmentId Dynamic PBAC, Actor Isolation & Safety", () => {
    let testShipment;

    beforeAll(async () => {
      testShipment = await createTestShipment();
    });

    test("unauthenticated request returns 401 AUTHENTICATION_REQUIRED", async () => {
      const res = await dispatchRequest("GET", `/api/v1/shipments/${testShipment._id}`);
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
    });

    test("authenticated employee without shipments:read returns 403 INSUFFICIENT_PERMISSIONS", async () => {
      const { token } = await createTestEmployee();
      const res = await dispatchRequest("GET", `/api/v1/shipments/${testShipment._id}`, token);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("dynamic role granting shipments:read allows retrieving shipment", async () => {
      const { employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(employee._id, "test_batch2g_shp_viewer", [
        PERMISSIONS.SHIPMENTS_READ,
      ]);

      const res = await dispatchRequest("GET", `/api/v1/shipments/${testShipment._id}`, token);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Shipment retrieved successfully");
      expect(res.body.data._id.toString()).toBe(testShipment._id.toString());
      expect(res.body.data.shipmentNumber).toBe(testShipment.shipmentNumber);
    });

    test("direct permission grant allows retrieving shipment", async () => {
      const { employee, token } = await createTestEmployee();
      await createDirectGrant(employee._id, PERMISSIONS.SHIPMENTS_READ);

      const res = await dispatchRequest("GET", `/api/v1/shipments/${testShipment._id}`, token);
      expect(res.status).toBe(200);
      expect(res.body.data._id.toString()).toBe(testShipment._id.toString());
    });

    test("active direct restriction overrides dynamic role grant", async () => {
      const { employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(employee._id, "test_batch2g_shp_op", [
        PERMISSIONS.SHIPMENTS_READ,
      ]);
      await createDirectRestriction(employee._id, PERMISSIONS.SHIPMENTS_READ);

      const res = await dispatchRequest("GET", `/api/v1/shipments/${testShipment._id}`, token);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("active direct restriction overrides direct grant", async () => {
      const { employee, token } = await createTestEmployee();
      await createDirectGrant(employee._id, PERMISSIONS.SHIPMENTS_READ);
      await createDirectRestriction(employee._id, PERMISSIONS.SHIPMENTS_READ);

      const res = await dispatchRequest("GET", `/api/v1/shipments/${testShipment._id}`, token);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("expired direct grant fails closed with 403 INSUFFICIENT_PERMISSIONS", async () => {
      const { employee, token } = await createTestEmployee();
      const pastDate = new Date(Date.now() - 3600000);
      await createDirectGrant(employee._id, PERMISSIONS.SHIPMENTS_READ, pastDate);

      const res = await dispatchRequest("GET", `/api/v1/shipments/${testShipment._id}`, token);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("suspended employee account is denied access with 403 INSUFFICIENT_PERMISSIONS", async () => {
      const { employee, token } = await createTestEmployee({ status: "suspended" });
      await createDirectGrant(employee._id, PERMISSIONS.SHIPMENTS_READ);

      const res = await dispatchRequest("GET", `/api/v1/shipments/${testShipment._id}`, token);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("terminated employee account is denied access with 403 INSUFFICIENT_PERMISSIONS", async () => {
      const { employee, token } = await createTestEmployee({ status: "terminated" });
      await createDirectGrant(employee._id, PERMISSIONS.SHIPMENTS_READ);

      const res = await dispatchRequest("GET", `/api/v1/shipments/${testShipment._id}`, token);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("stale permissionVersion triggers authoritative database lookup", async () => {
      const { user, employee, token } = await createTestEmployee();
      await createDirectGrant(employee._id, PERMISSIONS.SHIPMENTS_READ);
      await incrementPermissionVersion(user._id);

      const res = await dispatchRequest("GET", `/api/v1/shipments/${testShipment._id}`, token);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("stale authVersion rejects request with 401 AUTH_VERSION_MISMATCH", async () => {
      const { user, employee, token } = await createTestEmployee();
      await createDirectGrant(employee._id, PERMISSIONS.SHIPMENTS_READ);
      await incrementAuthVersion(user._id);

      const res = await dispatchRequest("GET", `/api/v1/shipments/${testShipment._id}`, token);
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("AUTH_VERSION_MISMATCH");
    });

    test("authorized admin and super_admin employees with dynamic permissions can access platform shipment retrieval", async () => {
      const adminStaff = await createTestEmployee({ userRole: "admin" });
      await assignRoleWithPermissions(adminStaff.employee._id, "test_batch2g_admin_shp", [
        PERMISSIONS.SHIPMENTS_READ,
      ]);
      const superAdminStaff = await createTestEmployee({ userRole: "super_admin" });
      await assignRoleWithPermissions(superAdminStaff.employee._id, "test_batch2g_super_shp", [
        PERMISSIONS.SHIPMENTS_READ,
      ]);

      const resAdmin = await dispatchRequest("GET", `/api/v1/shipments/${testShipment._id}`, adminStaff.token);
      expect(resAdmin.status).toBe(200);

      const resSuper = await dispatchRequest("GET", `/api/v1/shipments/${testShipment._id}`, superAdminStaff.token);
      expect(resSuper.status).toBe(200);
    });

    test("no legacy static-role bypass: employee with privileged user.role but no PBAC permissions is rejected (403)", async () => {
      const adminStaff = await createTestEmployee({ userRole: "admin" });
      const res = await dispatchRequest("GET", `/api/v1/shipments/${testShipment._id}`, adminStaff.token);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("customer user calling platform route GET /:shipmentId is rejected with 403 INSUFFICIENT_PERMISSIONS", async () => {
      const { token } = await createTestCustomer();
      const res = await dispatchRequest("GET", `/api/v1/shipments/${testShipment._id}`, token);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("customer self-service: GET /my/:shipmentId succeeds for own shipment", async () => {
      const { customer, token } = await createTestCustomer();
      const ownShipment = await createTestShipment({ customerId: customer._id });

      const res = await dispatchRequest("GET", `/api/v1/shipments/my/${ownShipment._id}`, token);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id.toString()).toBe(ownShipment._id.toString());
    });

    test("customer self-service: GET /my/:shipmentId returns 404 SHIPMENT_NOT_FOUND for another customer's shipment", async () => {
      const { token } = await createTestCustomer();
      const otherCustomerShipment = await createTestShipment({ customerId: new mongoose.Types.ObjectId() });

      const res = await dispatchRequest("GET", `/api/v1/shipments/my/${otherCustomerShipment._id}`, token);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("SHIPMENT_NOT_FOUND");
    });

    test("vendor user calling platform route GET /:shipmentId is rejected with 403 INSUFFICIENT_PERMISSIONS", async () => {
      const { token } = await createTestVendor();
      const res = await dispatchRequest("GET", `/api/v1/shipments/${testShipment._id}`, token);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("vendor self-service: GET /vendor/my/:shipmentId succeeds for own shipment", async () => {
      const { vendor, token } = await createTestVendor();
      const ownShipment = await createTestShipment({ vendorId: vendor._id });

      const res = await dispatchRequest("GET", `/api/v1/shipments/vendor/my/${ownShipment._id}`, token);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id.toString()).toBe(ownShipment._id.toString());
    });

    test("vendor self-service: GET /vendor/my/:shipmentId returns 404 SHIPMENT_NOT_FOUND for another vendor's shipment", async () => {
      const { token } = await createTestVendor();
      const otherVendorShipment = await createTestShipment({ vendorId: new mongoose.Types.ObjectId() });

      const res = await dispatchRequest("GET", `/api/v1/shipments/vendor/my/${otherVendorShipment._id}`, token);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("SHIPMENT_NOT_FOUND");
    });

    test("malformed shipmentId returns 400 INVALID_SHIPMENTID", async () => {
      const { employee, token } = await createTestEmployee();
      await createDirectGrant(employee._id, PERMISSIONS.SHIPMENTS_READ);

      const res = await dispatchRequest("GET", "/api/v1/shipments/not-a-valid-hex-id", token);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_SHIPMENTID");
    });

    test("non-existent shipmentId returns 404 SHIPMENT_NOT_FOUND", async () => {
      const { employee, token } = await createTestEmployee();
      await createDirectGrant(employee._id, PERMISSIONS.SHIPMENTS_READ);

      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await dispatchRequest("GET", `/api/v1/shipments/${nonExistentId}`, token);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("SHIPMENT_NOT_FOUND");
    });
  });

  // ---------------------------------------------------------------------------
  // 4. GET /api/v1/shipments/order/:orderId Dynamic PBAC & Data Retrieval
  // ---------------------------------------------------------------------------
  describe("4. GET /api/v1/shipments/order/:orderId Dynamic PBAC & Data Retrieval", () => {
    let testOrderId;
    let orderShipment;

    beforeAll(async () => {
      testOrderId = new mongoose.Types.ObjectId();
      orderShipment = await createTestShipment({ orderId: testOrderId });
    });

    test("unauthenticated request returns 401 AUTHENTICATION_REQUIRED", async () => {
      const res = await dispatchRequest("GET", `/api/v1/shipments/order/${testOrderId}`);
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
    });

    test("authenticated employee without shipments:read returns 403 INSUFFICIENT_PERMISSIONS", async () => {
      const { token } = await createTestEmployee();
      const res = await dispatchRequest("GET", `/api/v1/shipments/order/${testOrderId}`, token);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("dynamic role granting shipments:read allows retrieving shipments for order", async () => {
      const { employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(employee._id, "test_batch2g_order_shp_viewer", [
        PERMISSIONS.SHIPMENTS_READ,
      ]);

      const res = await dispatchRequest("GET", `/api/v1/shipments/order/${testOrderId}`, token);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Order shipments retrieved successfully");
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0]._id.toString()).toBe(orderShipment._id.toString());
    });

    test("direct permission grant allows retrieving shipments for order", async () => {
      const { employee, token } = await createTestEmployee();
      await createDirectGrant(employee._id, PERMISSIONS.SHIPMENTS_READ);

      const res = await dispatchRequest("GET", `/api/v1/shipments/order/${testOrderId}`, token);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some((s) => s._id.toString() === orderShipment._id.toString())).toBe(true);
    });

    test("active restriction overrides role permission", async () => {
      const { employee, token } = await createTestEmployee();
      await assignRoleWithPermissions(employee._id, "test_batch2g_order_shp_op", [
        PERMISSIONS.SHIPMENTS_READ,
      ]);
      await createDirectRestriction(employee._id, PERMISSIONS.SHIPMENTS_READ);

      const res = await dispatchRequest("GET", `/api/v1/shipments/order/${testOrderId}`, token);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("active restriction overrides direct grant", async () => {
      const { employee, token } = await createTestEmployee();
      await createDirectGrant(employee._id, PERMISSIONS.SHIPMENTS_READ);
      await createDirectRestriction(employee._id, PERMISSIONS.SHIPMENTS_READ);

      const res = await dispatchRequest("GET", `/api/v1/shipments/order/${testOrderId}`, token);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("expired direct grant fails closed with 403 INSUFFICIENT_PERMISSIONS", async () => {
      const { employee, token } = await createTestEmployee();
      const pastDate = new Date(Date.now() - 3600000);
      await createDirectGrant(employee._id, PERMISSIONS.SHIPMENTS_READ, pastDate);

      const res = await dispatchRequest("GET", `/api/v1/shipments/order/${testOrderId}`, token);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("suspended employee account is denied access with 403 INSUFFICIENT_PERMISSIONS", async () => {
      const { employee, token } = await createTestEmployee({ status: "suspended" });
      await createDirectGrant(employee._id, PERMISSIONS.SHIPMENTS_READ);

      const res = await dispatchRequest("GET", `/api/v1/shipments/order/${testOrderId}`, token);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("terminated employee account is denied access with 403 INSUFFICIENT_PERMISSIONS", async () => {
      const { employee, token } = await createTestEmployee({ status: "terminated" });
      await createDirectGrant(employee._id, PERMISSIONS.SHIPMENTS_READ);

      const res = await dispatchRequest("GET", `/api/v1/shipments/order/${testOrderId}`, token);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("stale permissionVersion triggers authoritative database lookup", async () => {
      const { user, employee, token } = await createTestEmployee();
      await createDirectGrant(employee._id, PERMISSIONS.SHIPMENTS_READ);
      await incrementPermissionVersion(user._id);

      const res = await dispatchRequest("GET", `/api/v1/shipments/order/${testOrderId}`, token);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("stale authVersion rejects request with 401 AUTH_VERSION_MISMATCH", async () => {
      const { user, employee, token } = await createTestEmployee();
      await createDirectGrant(employee._id, PERMISSIONS.SHIPMENTS_READ);
      await incrementAuthVersion(user._id);

      const res = await dispatchRequest("GET", `/api/v1/shipments/order/${testOrderId}`, token);
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("AUTH_VERSION_MISMATCH");
    });

    test("customer user is denied access with 403 INSUFFICIENT_PERMISSIONS", async () => {
      const { token } = await createTestCustomer();
      const res = await dispatchRequest("GET", `/api/v1/shipments/order/${testOrderId}`, token);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("vendor user is denied access with 403 INSUFFICIENT_PERMISSIONS", async () => {
      const { token } = await createTestVendor();
      const res = await dispatchRequest("GET", `/api/v1/shipments/order/${testOrderId}`, token);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("malformed orderId returns 400 VALIDATION_ERROR", async () => {
      const { employee, token } = await createTestEmployee();
      await createDirectGrant(employee._id, PERMISSIONS.SHIPMENTS_READ);

      const res = await dispatchRequest("GET", "/api/v1/shipments/order/not-an-object-id", token);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    test("non-existent order returns 200 OK with empty array", async () => {
      const { employee, token } = await createTestEmployee();
      await createDirectGrant(employee._id, PERMISSIONS.SHIPMENTS_READ);

      const emptyOrderId = new mongoose.Types.ObjectId().toString();
      const res = await dispatchRequest("GET", `/api/v1/shipments/order/${emptyOrderId}`, token);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Parameter Schema Strictness & Cross-Route Compatibility Verification
  // ---------------------------------------------------------------------------
  describe("5. Parameter Schema Strictness & Cross-Route Compatibility Verification", () => {
    const validHexId = new mongoose.Types.ObjectId().toString();

    describe("A. orderIdSchema Unit Contract (/orders/:id)", () => {
      test("accepts strictly valid { id: validObjectId }", () => {
        const result = orderIdSchema.safeParse({ id: validHexId });
        expect(result.success).toBe(true);
        expect(result.data.id).toBe(validHexId);
      });

      test("rejects empty object {}", () => {
        const result = orderIdSchema.safeParse({});
        expect(result.success).toBe(false);
        expect(result.error.issues.some((i) => i.path.includes("id"))).toBe(true);
      });

      test("rejects malformed id string", () => {
        const result = orderIdSchema.safeParse({ id: "invalid-hex-id" });
        expect(result.success).toBe(false);
        expect(result.error.issues.some((i) => i.message === "Invalid order ID")).toBe(true);
      });

      test("rejects { orderId } parameter (orderId cannot satisfy /orders/:id)", () => {
        const result = orderIdSchema.safeParse({ orderId: validHexId });
        expect(result.success).toBe(false);
        expect(result.error.issues.some((i) => i.path.includes("id"))).toBe(true);
      });

      test("rejects combined { id, orderId } due to strict mode", () => {
        const result = orderIdSchema.safeParse({ id: validHexId, orderId: validHexId });
        expect(result.success).toBe(false);
        expect(result.error.issues.some((i) => i.code === "unrecognized_keys")).toBe(true);
      });

      test("rejects unexpected additional keys due to strict mode", () => {
        const result = orderIdSchema.safeParse({ id: validHexId, unexpectedKey: "extra" });
        expect(result.success).toBe(false);
        expect(result.error.issues.some((i) => i.code === "unrecognized_keys")).toBe(true);
      });
    });

    describe("B. shipmentOrderIdSchema Unit Contract (/shipments/order/:orderId)", () => {
      test("accepts strictly valid { orderId: validObjectId }", () => {
        const result = shipmentOrderIdSchema.safeParse({ orderId: validHexId });
        expect(result.success).toBe(true);
        expect(result.data.orderId).toBe(validHexId);
      });

      test("rejects empty object {}", () => {
        const result = shipmentOrderIdSchema.safeParse({});
        expect(result.success).toBe(false);
        expect(result.error.issues.some((i) => i.path.includes("orderId"))).toBe(true);
      });

      test("rejects malformed orderId string", () => {
        const result = shipmentOrderIdSchema.safeParse({ orderId: "invalid-hex-order-id" });
        expect(result.success).toBe(false);
        expect(result.error.issues.some((i) => i.message === "Invalid order ID")).toBe(true);
      });

      test("rejects { id } parameter (id cannot satisfy /shipments/order/:orderId)", () => {
        const result = shipmentOrderIdSchema.safeParse({ id: validHexId });
        expect(result.success).toBe(false);
        expect(result.error.issues.some((i) => i.path.includes("orderId"))).toBe(true);
      });

      test("rejects combined { id, orderId } due to strict mode", () => {
        const result = shipmentOrderIdSchema.safeParse({ id: validHexId, orderId: validHexId });
        expect(result.success).toBe(false);
        expect(result.error.issues.some((i) => i.code === "unrecognized_keys")).toBe(true);
      });

      test("rejects unexpected additional keys due to strict mode", () => {
        const result = shipmentOrderIdSchema.safeParse({ orderId: validHexId, extraField: "extra" });
        expect(result.success).toBe(false);
        expect(result.error.issues.some((i) => i.code === "unrecognized_keys")).toBe(true);
      });
    });

    describe("C. Live HTTP Integration: GET /api/v1/orders/:id Compatibility", () => {
      test("customer accessing own order with valid id succeeds (200 OK)", async () => {
        const { customer, token } = await createTestCustomer();
        const order = await createTestOrder(customer._id);

        const res = await dispatchRequest("GET", `/api/v1/orders/${order._id}`, token);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data._id.toString()).toBe(order._id.toString());
      });

      test("customer accessing /api/v1/orders/:id with malformed id is rejected by orderIdSchema (400 VALIDATION_ERROR)", async () => {
        const { token } = await createTestCustomer();

        const res = await dispatchRequest("GET", "/api/v1/orders/not-a-valid-hex-order-id", token);
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.code).toBe("VALIDATION_ERROR");
        expect(res.body.message).toContain("Invalid order ID");
      });
    });

    describe("D. Live HTTP Integration: GET /api/v1/shipments/order/:orderId Compatibility", () => {
      test("platform employee accessing with valid orderId succeeds (200 OK)", async () => {
        const { employee, token } = await createTestEmployee();
        await createDirectGrant(employee._id, PERMISSIONS.SHIPMENTS_READ);

        const validId = new mongoose.Types.ObjectId().toString();
        const res = await dispatchRequest("GET", `/api/v1/shipments/order/${validId}`, token);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
      });

      test("platform employee accessing with malformed orderId is rejected by shipmentOrderIdSchema (400 VALIDATION_ERROR)", async () => {
        const { employee, token } = await createTestEmployee();
        await createDirectGrant(employee._id, PERMISSIONS.SHIPMENTS_READ);

        const res = await dispatchRequest("GET", "/api/v1/shipments/order/not-a-valid-hex-order-id", token);
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.code).toBe("VALIDATION_ERROR");
        expect(res.body.message).toContain("Invalid order ID");
      });
    });
  });
});
