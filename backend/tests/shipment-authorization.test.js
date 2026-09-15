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
const WorkAssignment = require("../src/models/WorkAssignment");
const Warehouse = require("../src/models/Warehouse");
const Shipment = require("../src/models/Shipment");
const Order = require("../src/models/Order");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const { SCOPE_TYPES } = require("../src/constants/scope.constants");
const { generateAccessToken } = require("../src/services/token.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_shipment_auth_test?")
  : "mongodb://127.0.0.1:27017/buybox_shipment_auth_test?replicaSet=rs0";

jest.setTimeout(30000);

describe("Phase C — Shipment / Logistics Authorization & Scope Enforcement", () => {
  let createdPermissions = new Map();
  let warehouseA;
  let warehouseB;
  let customerUserA;
  let customerA;
  let customerTokenA;
  let customerUserB;
  let customerB;
  let customerTokenB;
  let vendorUserA;
  let vendorA;
  let vendorTokenA;
  let vendorUserB;
  let vendorB;
  let vendorTokenB;
  let shipmentA;
  let shipmentB;

  async function getOrCreatePermission(slug) {
    if (createdPermissions.has(slug)) {
      return createdPermissions.get(slug);
    }
    let perm = await Permission.findOne({ slug });
    if (!perm) {
      perm = await Permission.create({
        slug,
        name: `Perm ${slug}`,
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
      firstName: "Ship",
      lastName: "Staff",
      email: `ship_staff_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`,
      password: "Password123!",
      role: options.userRole || "manager",
      isActive: options.isActive !== undefined ? options.isActive : true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const employee = await Employee.create({
      userId: user._id,
      employeeNumber: `EMP_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`,
      jobTitle: "Fulfillment Specialist",
      department: "Logistics",
      status,
    });

    if (options.permissions && options.permissions.length > 0) {
      const suffix = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const role = await Role.create({
        slug: `ship_role_${suffix}`,
        name: `Shipment Staff Role ${suffix}`,
        isActive: true,
      });

      for (const slug of options.permissions) {
        const perm = await getOrCreatePermission(slug);
        await RolePermission.create({
          roleId: role._id,
          permissionId: perm._id,
        });
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
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    await getOrCreatePermission(PERMISSIONS.SHIPMENTS_READ);
    await getOrCreatePermission(PERMISSIONS.SHIPMENTS_MANAGE);
    await getOrCreatePermission(PERMISSIONS.SHIPMENTS_READ_OWN);
    await getOrCreatePermission(PERMISSIONS.SHIPMENTS_MANAGE_OWN);

    // 1. Warehouses
    warehouseA = await Warehouse.create({
      name: "Warehouse Alpha",
      code: `WH-A-${Date.now()}`,
      address: {
        addressLine1: "100 Alpha Blvd",
        city: "Alpha City",
        state: "AL",
        country: "IN",
        postalCode: "110001",
      },
      isActive: true,
    });

    warehouseB = await Warehouse.create({
      name: "Warehouse Beta",
      code: `WH-B-${Date.now()}`,
      address: {
        addressLine1: "200 Beta St",
        city: "Beta City",
        state: "BT",
        country: "IN",
        postalCode: "110002",
      },
      isActive: true,
    });

    // 2. Customers
    customerUserA = await User.create({
      firstName: "Customer",
      lastName: "Alpha",
      email: `cust_a_${Date.now()}@test.com`,
      password: "Password123!",
      role: ROLES.CUSTOMER,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    customerA = await Customer.create({
      userId: customerUserA._id,
      isActive: true,
    });
    customerTokenA = generateAccessToken({
      sub: customerUserA._id.toString(),
      role: ROLES.CUSTOMER,
      authVersion: 1,
      permissionVersion: 1,
    });

    customerUserB = await User.create({
      firstName: "Customer",
      lastName: "Beta",
      email: `cust_b_${Date.now()}@test.com`,
      password: "Password123!",
      role: ROLES.CUSTOMER,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    customerB = await Customer.create({
      userId: customerUserB._id,
      isActive: true,
    });
    customerTokenB = generateAccessToken({
      sub: customerUserB._id.toString(),
      role: ROLES.CUSTOMER,
      authVersion: 1,
      permissionVersion: 1,
    });

    // 3. Vendors
    vendorUserA = await User.create({
      firstName: "Vendor",
      lastName: "Alpha",
      email: `vend_a_${Date.now()}@test.com`,
      password: "Password123!",
      role: ROLES.VENDOR,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    vendorA = await Vendor.create({
      userId: vendorUserA._id,
      businessName: "Vendor Alpha Ltd",
      businessSlug: `vend-a-${Date.now()}`,
      businessEmail: vendorUserA.email,
      phone: "9876543210",
      onboardingStatus: "approved",
      isActive: true,
    });
    vendorTokenA = generateAccessToken({
      sub: vendorUserA._id.toString(),
      role: ROLES.VENDOR,
      authVersion: 1,
      permissionVersion: 1,
    });

    vendorUserB = await User.create({
      firstName: "Vendor",
      lastName: "Beta",
      email: `vend_b_${Date.now()}@test.com`,
      password: "Password123!",
      role: ROLES.VENDOR,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    vendorB = await Vendor.create({
      userId: vendorUserB._id,
      businessName: "Vendor Beta Ltd",
      businessSlug: `vend-b-${Date.now()}`,
      businessEmail: vendorUserB.email,
      phone: "9876543211",
      onboardingStatus: "approved",
      isActive: true,
    });
    vendorTokenB = generateAccessToken({
      sub: vendorUserB._id.toString(),
      role: ROLES.VENDOR,
      authVersion: 1,
      permissionVersion: 1,
    });

    // 4. Shipments
    shipmentA = await Shipment.create({
      orderId: new mongoose.Types.ObjectId(),
      customerId: customerA._id,
      vendorId: vendorA._id,
      warehouseId: warehouseA._id,
      shipmentNumber: `SHP-A-${Date.now()}`,
      status: "created",
      inventoryStatus: "reserved",
      carrier: "BlueDart",
      serviceLevel: "standard",
      trackingNumber: `TRK-A-${Date.now()}`,
      shippingAddress: {
        fullName: "Customer Alpha",
        phone: "9876543210",
        addressLine1: "123 Alpha St",
        city: "Alpha City",
        state: "AL",
        postalCode: "110001",
        country: "IN",
      },
      items: [
        {
          productId: new mongoose.Types.ObjectId(),
          productVariantId: new mongoose.Types.ObjectId(),
          sku: "SKU-A-001",
          name: "Item A",
          quantity: 2,
        },
      ],
    });

    shipmentB = await Shipment.create({
      orderId: new mongoose.Types.ObjectId(),
      customerId: customerB._id,
      vendorId: vendorB._id,
      warehouseId: warehouseB._id,
      shipmentNumber: `SHP-B-${Date.now()}`,
      status: "created",
      inventoryStatus: "reserved",
      carrier: "Delhivery",
      serviceLevel: "standard",
      trackingNumber: `TRK-B-${Date.now()}`,
      shippingAddress: {
        fullName: "Customer Beta",
        phone: "9876543211",
        addressLine1: "456 Beta St",
        city: "Beta City",
        state: "BT",
        postalCode: "110002",
        country: "IN",
      },
      items: [
        {
          productId: new mongoose.Types.ObjectId(),
          productVariantId: new mongoose.Types.ObjectId(),
          sku: "SKU-B-001",
          name: "Item B",
          quantity: 1,
        },
      ],
    });
  });

  afterAll(async () => {
    try {
      await User.deleteMany({ email: /@test\.com$/ });
      await Employee.deleteMany({ department: "Logistics" });
      await Customer.deleteMany({});
      await Vendor.deleteMany({ businessSlug: /^vend-[ab]-/ });
      await Warehouse.deleteMany({ code: /^WH-[AB]-/ });
      await Shipment.deleteMany({ shipmentNumber: /^SHP-[AB]-/ });
      await Role.deleteMany({ slug: /^ship_role_/ });
      await RolePermission.deleteMany({});
      await EmployeeRole.deleteMany({});
      await WorkAssignment.deleteMany({});
    } catch (e) {
      // Ignored
    }
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  describe("1. Dynamic PBAC Evaluation in Tracking Service (Eliminating Legacy ROLE_PERMISSIONS)", () => {
    test("staff with dynamic shipments:read permission receives full shipment tracking details", async () => {
      const { token } = await createTestEmployee({
        permissions: [PERMISSIONS.SHIPMENTS_READ],
      });

      const res = await request(app)
        .get(`/api/v1/shipments/tracking/${shipmentA.trackingNumber}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(shipmentA._id.toString());
    });

    test("staff with direct grant for shipments:read receives full tracking details", async () => {
      const { employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.SHIPMENTS_READ);

      await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: null,
      });

      const res = await request(app)
        .get(`/api/v1/shipments/tracking/${shipmentA.trackingNumber}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(shipmentA._id.toString());
    });

    test("staff with direct restriction on shipments:read is denied privileged tracking access", async () => {
      const { employee, token } = await createTestEmployee({
        permissions: [PERMISSIONS.SHIPMENTS_READ],
      });
      const perm = await getOrCreatePermission(PERMISSIONS.SHIPMENTS_READ);

      await EmployeePermissionRestriction.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: null,
      });

      const res = await request(app)
        .get(`/api/v1/shipments/tracking/${shipmentA.trackingNumber}`)
        .set("Authorization", `Bearer ${token}`);

      // Not privileged and not customer owner -> 404 SHIPMENT_NOT_FOUND
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("SHIPMENT_NOT_FOUND");
    });
  });

  describe("2. Customer Isolation on Shipments", () => {
    test("customer A can view own shipment by ID via /my/:shipmentId", async () => {
      const res = await request(app)
        .get(`/api/v1/shipments/my/${shipmentA._id}`)
        .set("Authorization", `Bearer ${customerTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(shipmentA._id.toString());
    });

    test("customer A CANNOT view customer B's shipment (404/403 isolation)", async () => {
      const res = await request(app)
        .get(`/api/v1/shipments/my/${shipmentB._id}`)
        .set("Authorization", `Bearer ${customerTokenA}`);

      expect([403, 404]).toContain(res.status);
    });

    test("customer A tracking own shipment succeeds", async () => {
      const res = await request(app)
        .get(`/api/v1/shipments/tracking/${shipmentA.trackingNumber}`)
        .set("Authorization", `Bearer ${customerTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("customer A tracking customer B shipment is rejected with 404", async () => {
      const res = await request(app)
        .get(`/api/v1/shipments/tracking/${shipmentB.trackingNumber}`)
        .set("Authorization", `Bearer ${customerTokenA}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("SHIPMENT_NOT_FOUND");
    });
  });

  describe("3. Vendor Isolation on Shipments", () => {
    test("vendor A can view own shipment via /vendor/my/:shipmentId", async () => {
      const res = await request(app)
        .get(`/api/v1/shipments/vendor/my/${shipmentA._id}`)
        .set("Authorization", `Bearer ${vendorTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(shipmentA._id.toString());
    });

    test("vendor A CANNOT view vendor B's shipment (404/403 isolation)", async () => {
      const res = await request(app)
        .get(`/api/v1/shipments/vendor/my/${shipmentB._id}`)
        .set("Authorization", `Bearer ${vendorTokenA}`);

      expect([403, 404]).toContain(res.status);
    });
  });

  describe("4. Warehouse & Vendor Scope Enforcement on Staff Routes", () => {
    test("employee with warehouse scope can list shipments for assigned warehouse", async () => {
      const { employee, token } = await createTestEmployee({
        permissions: [PERMISSIONS.SHIPMENTS_READ],
      });

      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.WAREHOUSE,
        scopeId: warehouseA._id.toString(),
        isActive: true,
      });

      const res = await request(app)
        .get(`/api/v1/shipments/warehouse/${warehouseA._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("employee scoped to Warehouse A CANNOT access Warehouse B shipments (403 INSUFFICIENT_SCOPE)", async () => {
      const { employee, token } = await createTestEmployee({
        permissions: [PERMISSIONS.SHIPMENTS_READ],
      });

      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.WAREHOUSE,
        scopeId: warehouseA._id.toString(),
        isActive: true,
      });

      const res = await request(app)
        .get(`/api/v1/shipments/warehouse/${warehouseB._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_SCOPE");
    });

    test("employee scoped to Vendor A CANNOT access Vendor B shipments (403 INSUFFICIENT_SCOPE)", async () => {
      const { employee, token } = await createTestEmployee({
        permissions: [PERMISSIONS.SHIPMENTS_READ],
      });

      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.VENDOR,
        scopeId: vendorA._id.toString(),
        isActive: true,
      });

      const res = await request(app)
        .get(`/api/v1/shipments/vendor/${vendorB._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_SCOPE");
    });

    test("malformed shipment ID fails route validation (400 INVALID_OBJECT_ID)", async () => {
      const { token } = await createTestEmployee({
        permissions: [PERMISSIONS.SHIPMENTS_READ],
      });

      const res = await request(app)
        .get("/api/v1/shipments/warehouse/invalid-id-format")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_OBJECT_ID");
    });

    test("Super Admin operates globally across warehouses and vendors", async () => {
      const { token } = await createTestEmployee({
        permissions: [PERMISSIONS.SHIPMENTS_READ],
        userRole: ROLES.SUPER_ADMIN,
      });

      const res = await request(app)
        .get(`/api/v1/shipments/warehouse/${warehouseA._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
