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
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Inventory = require("../src/models/Inventory");
const Category = require("../src/models/Category");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const { SCOPE_TYPES } = require("../src/constants/scope.constants");
const { generateAccessToken } = require("../src/services/token.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_inv_test?")
  : "mongodb://127.0.0.1:27017/buybox_inv_test?replicaSet=rs0";

jest.setTimeout(30000);

describe("Phase A — Inventory Authorization & Warehouse Scope Enforcement", () => {
  let createdPermissions = new Map();
  let warehouseA;
  let warehouseB;
  let testCategory;
  let vendorUserA;
  let vendorA;
  let vendorTokenA;
  let vendorUserB;
  let vendorB;
  let vendorTokenB;
  let productA;
  let variantA;
  let inventoryA;

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
      firstName: "Inv",
      lastName: "Staff",
      email: `inv_staff_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`,
      password: "Password123!",
      role: options.userRole || "manager",
      isActive: options.isActive !== undefined ? options.isActive : true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const employee = await Employee.create({
      userId: user._id,
      employeeNumber: `EMP_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`,
      jobTitle: "Inventory Specialist",
      department: "Logistics",
      status,
    });

    if (options.permissions && options.permissions.length > 0) {
      const suffix = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const role = await Role.create({
        slug: `inv_role_${suffix}`,
        name: `Inventory Staff Role ${suffix}`,
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

    await getOrCreatePermission(PERMISSIONS.INVENTORY_READ);
    await getOrCreatePermission(PERMISSIONS.INVENTORY_MANAGE);

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

    // 2. Category
    testCategory = await Category.create({
      name: `Inv Category ${Date.now()}`,
      slug: `inv-category-${Date.now()}`,
      isActive: true,
    });

    // 3. Vendor A
    vendorUserA = await User.create({
      firstName: "Vendor",
      lastName: "Alpha",
      email: `vendor_a_${Date.now()}@test.com`,
      password: "Password123!",
      role: ROLES.VENDOR,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    vendorA = await Vendor.create({
      userId: vendorUserA._id,
      businessName: "Alpha Supplies",
      businessSlug: `alpha-supplies-${Date.now()}`,
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

    // 4. Vendor B
    vendorUserB = await User.create({
      firstName: "Vendor",
      lastName: "Beta",
      email: `vendor_b_${Date.now()}@test.com`,
      password: "Password123!",
      role: ROLES.VENDOR,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    vendorB = await Vendor.create({
      userId: vendorUserB._id,
      businessName: "Beta Goods",
      businessSlug: `beta-goods-${Date.now()}`,
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

    // 5. Product & Variant owned by Vendor A
    productA = await Product.create({
      name: "Product A",
      slug: `product-a-${Date.now()}`,
      sku: `SKU-A-${Date.now()}`,
      categoryId: testCategory._id,
      vendorId: vendorA._id,
      price: 250,
      isActive: true,
    });

    variantA = await ProductVariant.create({
      productId: productA._id,
      sku: `VAR-A-${Date.now()}`,
      name: "Variant A Size M",
      price: 250,
      isActive: true,
    });

    // 6. Inventory for Variant A in Warehouse A
    inventoryA = await Inventory.create({
      productVariantId: variantA._id,
      warehouseId: warehouseA._id,
      onHand: 100,
      reserved: 10,
      lowStockThreshold: 5,
    });
  });

  afterAll(async () => {
    try {
      await User.deleteMany({ email: /@test\.com$/ });
      await Employee.deleteMany({ department: "Logistics" });
      await Vendor.deleteMany({ businessName: { $in: ["Alpha Supplies", "Beta Goods"] } });
      await Warehouse.deleteMany({ code: /^WH-[AB]-/ });
      await Category.deleteMany({ slug: /^inv-category-/ });
      await Product.deleteMany({ slug: /^product-a-/ });
      await ProductVariant.deleteMany({ sku: /^VAR-A-/ });
      await Inventory.deleteMany({ _id: inventoryA._id });
      await Role.deleteMany({ slug: /^inv_role_/ });
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

  describe("1. Dynamic PBAC Evaluation on Inventory Operations", () => {
    test("authorized employee with inventory:read can view inventory by ID", async () => {
      const { token } = await createTestEmployee({
        permissions: [PERMISSIONS.INVENTORY_READ],
      });

      const res = await request(app)
        .get(`/api/v1/inventory/${inventoryA._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inventory._id).toBe(inventoryA._id.toString());
    });

    test("employee without inventory:read is rejected with 403 INSUFFICIENT_PERMISSIONS", async () => {
      const { token } = await createTestEmployee({
        permissions: [],
      });

      const res = await request(app)
        .get(`/api/v1/inventory/${inventoryA._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("direct grant: employee with direct grant for inventory:read succeeds without role", async () => {
      const { employee, token } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.INVENTORY_READ);

      await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: null,
      });

      const res = await request(app)
        .get(`/api/v1/inventory/${inventoryA._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("restriction dominance: direct restriction overrides role permission and direct grant", async () => {
      const { employee, token } = await createTestEmployee({
        permissions: [PERMISSIONS.INVENTORY_READ],
      });
      const perm = await getOrCreatePermission(PERMISSIONS.INVENTORY_READ);

      await EmployeePermissionGrant.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: null,
      });

      await EmployeePermissionRestriction.create({
        employeeId: employee._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: null,
      });

      const res = await request(app)
        .get(`/api/v1/inventory/${inventoryA._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("expired grant fails 403; expired restriction does not block active role", async () => {
      // Expired grant
      const { employee: emp1, token: token1 } = await createTestEmployee();
      const perm = await getOrCreatePermission(PERMISSIONS.INVENTORY_READ);

      await EmployeePermissionGrant.create({
        employeeId: emp1._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: new Date(Date.now() - 5000),
      });

      const res1 = await request(app)
        .get(`/api/v1/inventory/${inventoryA._id}`)
        .set("Authorization", `Bearer ${token1}`);
      expect(res1.status).toBe(403);

      // Expired restriction
      const { employee: emp2, token: token2 } = await createTestEmployee({
        permissions: [PERMISSIONS.INVENTORY_READ],
      });

      await EmployeePermissionRestriction.create({
        employeeId: emp2._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: new Date(Date.now() - 5000),
      });

      const res2 = await request(app)
        .get(`/api/v1/inventory/${inventoryA._id}`)
        .set("Authorization", `Bearer ${token2}`);
      expect(res2.status).toBe(200);
    });

    test("suspended employee is rejected with 403", async () => {
      const { token } = await createTestEmployee({
        permissions: [PERMISSIONS.INVENTORY_READ],
        status: "suspended",
      });

      const res = await request(app)
        .get(`/api/v1/inventory/${inventoryA._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    test("terminated employee is rejected with 403", async () => {
      const { token } = await createTestEmployee({
        permissions: [PERMISSIONS.INVENTORY_READ],
        status: "terminated",
      });

      const res = await request(app)
        .get(`/api/v1/inventory/${inventoryA._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  describe("2. Warehouse Scope Enforcement on Inventory Mutations", () => {
    test("employee assigned to Warehouse Alpha can adjust stock in Warehouse Alpha", async () => {
      const { employee, token } = await createTestEmployee({
        permissions: [PERMISSIONS.INVENTORY_MANAGE],
      });

      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.WAREHOUSE,
        scopeId: warehouseA._id.toString(),
        isActive: true,
      });

      const res = await request(app)
        .patch(`/api/v1/inventory/${inventoryA._id}/adjust`)
        .set("Authorization", `Bearer ${token}`)
        .send({ quantity: 5 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inventory.onHand).toBe(105);
    });

    test("employee assigned to Warehouse Beta CANNOT adjust stock in Warehouse Alpha (403 INSUFFICIENT_SCOPE)", async () => {
      const { employee, token } = await createTestEmployee({
        permissions: [PERMISSIONS.INVENTORY_MANAGE],
      });

      // Assigned only to Warehouse Beta
      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.WAREHOUSE,
        scopeId: warehouseB._id.toString(),
        isActive: true,
      });

      const res = await request(app)
        .patch(`/api/v1/inventory/${inventoryA._id}/adjust`)
        .set("Authorization", `Bearer ${token}`)
        .send({ quantity: 5 });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_SCOPE");
    });

    test("employee without warehouse assignment fails closed on warehouse-scoped adjustment (403 INSUFFICIENT_SCOPE)", async () => {
      const { token } = await createTestEmployee({
        permissions: [PERMISSIONS.INVENTORY_MANAGE],
        userRole: "manager",
      });

      // No warehouse assignment
      const res = await request(app)
        .patch(`/api/v1/inventory/${inventoryA._id}/adjust`)
        .set("Authorization", `Bearer ${token}`)
        .send({ quantity: 5 });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_SCOPE");
    });

    test("employee with inactive warehouse assignment fails closed (403 INSUFFICIENT_SCOPE)", async () => {
      const { employee, token } = await createTestEmployee({
        permissions: [PERMISSIONS.INVENTORY_MANAGE],
      });

      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.WAREHOUSE,
        scopeId: warehouseA._id.toString(),
        isActive: false,
      });

      const res = await request(app)
        .patch(`/api/v1/inventory/${inventoryA._id}/adjust`)
        .set("Authorization", `Bearer ${token}`)
        .send({ quantity: 5 });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_SCOPE");
    });

    test("Super Admin operates globally across warehouses", async () => {
      const { employee, token } = await createTestEmployee({
        permissions: [PERMISSIONS.INVENTORY_MANAGE],
        userRole: ROLES.SUPER_ADMIN,
      });

      const res = await request(app)
        .patch(`/api/v1/inventory/${inventoryA._id}/adjust`)
        .set("Authorization", `Bearer ${token}`)
        .send({ quantity: -5 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("3. Vendor Inventory Access & Isolation", () => {
    test("vendor owning product variant can view own variant inventory", async () => {
      const res = await request(app)
        .get(`/api/v1/inventory/variant/${variantA._id}`)
        .set("Authorization", `Bearer ${vendorTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("vendor NOT owning product variant cannot view foreign variant inventory (403 INVENTORY_ACCESS_DENIED)", async () => {
      const res = await request(app)
        .get(`/api/v1/inventory/variant/${variantA._id}`)
        .set("Authorization", `Bearer ${vendorTokenB}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INVENTORY_ACCESS_DENIED");
    });

    test("vendor NOT owning inventory cannot adjust stock (403 INVENTORY_ACCESS_DENIED)", async () => {
      const res = await request(app)
        .patch(`/api/v1/inventory/${inventoryA._id}/adjust`)
        .set("Authorization", `Bearer ${vendorTokenB}`)
        .send({ quantity: 10 });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INVENTORY_ACCESS_DENIED");
    });

    test("vendor listing warehouse inventory only receives accessible own items", async () => {
      const res = await request(app)
        .get(`/api/v1/inventory/warehouse/${warehouseA._id}`)
        .set("Authorization", `Bearer ${vendorTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.inventory)).toBe(true);
      const ids = res.body.data.inventory.map((i) => i._id);
      expect(ids).toContain(inventoryA._id.toString());
    });

    test("vendor B listing warehouse inventory does not see Vendor A items", async () => {
      const res = await request(app)
        .get(`/api/v1/inventory/warehouse/${warehouseA._id}`)
        .set("Authorization", `Bearer ${vendorTokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const ids = res.body.data.inventory.map((i) => i._id);
      expect(ids).not.toContain(inventoryA._id.toString());
    });
  });

  describe("4. Customer Isolation", () => {
    test("customer calling inventory routes is rejected with 403 INSUFFICIENT_PERMISSIONS", async () => {
      const customerUser = await User.create({
        firstName: "Customer",
        lastName: "InvTester",
        email: `cust_inv_${Date.now()}@test.com`,
        password: "Password123!",
        role: ROLES.CUSTOMER,
        isActive: true,
        authVersion: 1,
        permissionVersion: 1,
      });

      const customerToken = generateAccessToken({
        sub: customerUser._id.toString(),
        role: ROLES.CUSTOMER,
        authVersion: 1,
        permissionVersion: 1,
      });

      const res = await request(app)
        .get(`/api/v1/inventory/${inventoryA._id}`)
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });
  });
});
