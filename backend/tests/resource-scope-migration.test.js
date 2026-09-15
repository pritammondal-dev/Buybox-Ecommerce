const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Employee = require("../src/models/Employee");
const Customer = require("../src/models/Customer");
const Role = require("../src/models/Role");
const Permission = require("../src/models/Permission");
const RolePermission = require("../src/models/RolePermission");
const EmployeeRole = require("../src/models/EmployeeRole");
const WorkAssignment = require("../src/models/WorkAssignment");
const Warehouse = require("../src/models/Warehouse");
const Category = require("../src/models/Category");
const SupportTicket = require("../src/models/SupportTicket");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const { SCOPE_TYPES } = require("../src/constants/scope.constants");
const { generateAccessToken } = require("../src/services/token.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_resource_scope_test?")
  : "mongodb://127.0.0.1:27017/buybox_resource_scope_test?replicaSet=rs0";

jest.setTimeout(30000);

describe("Phase D — Resource Scope Migration (Category, Warehouse, Support Queue)", () => {
  let createdPermissions = new Map();
  let warehouseA;
  let warehouseB;
  let categoryA;
  let categoryB;
  let customerUser;
  let customer;
  let ticketShipping;
  let ticketPayment;

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
      firstName: "Scope",
      lastName: "Staff",
      email: `scope_staff_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`,
      password: "Password123!",
      role: options.userRole || "manager",
      isActive: options.isActive !== undefined ? options.isActive : true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const employee = await Employee.create({
      userId: user._id,
      employeeNumber: `EMP_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`,
      jobTitle: "Operations Specialist",
      department: "Operations",
      status,
    });

    if (options.permissions && options.permissions.length > 0) {
      const suffix = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const role = await Role.create({
        slug: `scope_role_${suffix}`,
        name: `Scope Staff Role ${suffix}`,
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
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    warehouseA = await Warehouse.create({
      name: `WH Scope A ${Date.now()}`,
      code: `WHA_${Date.now()}`,
      address: {
        addressLine1: "123 Scope Rd",
        city: "Kolkata",
        state: "WB",
        postalCode: "700001",
        country: "IN",
      },
      isActive: true,
    });

    warehouseB = await Warehouse.create({
      name: `WH Scope B ${Date.now()}`,
      code: `WHB_${Date.now()}`,
      address: {
        addressLine1: "456 Scope Rd",
        city: "Mumbai",
        state: "MH",
        postalCode: "400001",
        country: "IN",
      },
      isActive: true,
    });

    categoryA = await Category.create({
      name: `Cat Scope A ${Date.now()}`,
      slug: `cat-scope-a-${Date.now()}`,
      description: "Scope A Category",
      isActive: true,
    });

    categoryB = await Category.create({
      name: `Cat Scope B ${Date.now()}`,
      slug: `cat-scope-b-${Date.now()}`,
      description: "Scope B Category",
      isActive: true,
    });

    customerUser = await User.create({
      firstName: "Ticket",
      lastName: "Customer",
      email: `ticket_cust_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`,
      password: "Password123!",
      role: ROLES.CUSTOMER,
      isActive: true,
    });

    customer = await Customer.create({
      userId: customerUser._id,
      phone: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      isActive: true,
    });

    ticketShipping = await SupportTicket.create({
      ticketNumber: `TCK-SHIP-${Date.now()}`,
      customerId: customer._id,
      subject: "Shipping Delay",
      description: "Package is delayed in transit",
      category: "shipping",
      status: "open",
    });

    ticketPayment = await SupportTicket.create({
      ticketNumber: `TCK-PAY-${Date.now()}`,
      customerId: customer._id,
      subject: "Payment Failed",
      description: "Amount deducted but order failed",
      category: "payment",
      status: "open",
    });
  });

  afterAll(async () => {
    try {
      await Warehouse.deleteMany({ _id: { $in: [warehouseA._id, warehouseB._id] } });
      await Category.deleteMany({ _id: { $in: [categoryA._id, categoryB._id] } });
      await SupportTicket.deleteMany({ _id: { $in: [ticketShipping._id, ticketPayment._id] } });
      await Customer.deleteMany({ _id: customer._id });
      await User.deleteMany({ _id: customerUser._id });
    } catch (e) {
      // Ignored
    }
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  describe("1. Category Scope Enforcement", () => {
    test("staff scoped to Category A can update Category A", async () => {
      const { employee, token } = await createTestEmployee({
        permissions: [PERMISSIONS.PRODUCTS_UPDATE],
      });

      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.CATEGORY,
        scopeId: categoryA._id.toString(),
        isActive: true,
      });

      const res = await request(app)
        .patch(`/api/v1/categories/${categoryA._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ description: "Updated by Scoped Staff" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("staff scoped to Category A CANNOT update Category B (403 INSUFFICIENT_SCOPE)", async () => {
      const { employee, token } = await createTestEmployee({
        permissions: [PERMISSIONS.PRODUCTS_UPDATE],
      });

      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.CATEGORY,
        scopeId: categoryA._id.toString(),
        isActive: true,
      });

      const res = await request(app)
        .patch(`/api/v1/categories/${categoryB._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ description: "Unauthorized Update" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_SCOPE");
    });

    test("unassigned platform actor can update Category B globally (allowGlobalPlatformActor)", async () => {
      const { token } = await createTestEmployee({
        permissions: [PERMISSIONS.PRODUCTS_UPDATE],
      });

      const res = await request(app)
        .patch(`/api/v1/categories/${categoryB._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ description: "Global Staff Update" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("2. Warehouse Scope Enforcement", () => {
    test("staff scoped to Warehouse A can view Warehouse A detail", async () => {
      const { employee, token } = await createTestEmployee({
        permissions: [PERMISSIONS.WAREHOUSES_READ],
      });

      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.WAREHOUSE,
        scopeId: warehouseA._id.toString(),
        isActive: true,
      });

      const res = await request(app)
        .get(`/api/v1/warehouses/${warehouseA._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("staff scoped to Warehouse A CANNOT view Warehouse B (403 INSUFFICIENT_SCOPE)", async () => {
      const { employee, token } = await createTestEmployee({
        permissions: [PERMISSIONS.WAREHOUSES_READ],
      });

      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.WAREHOUSE,
        scopeId: warehouseA._id.toString(),
        isActive: true,
      });

      const res = await request(app)
        .get(`/api/v1/warehouses/${warehouseB._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_SCOPE");
    });

    test("staff scoped to Warehouse A CANNOT update Warehouse B (403 INSUFFICIENT_SCOPE)", async () => {
      const { employee, token } = await createTestEmployee({
        permissions: [PERMISSIONS.WAREHOUSES_MANAGE],
      });

      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.WAREHOUSE,
        scopeId: warehouseA._id.toString(),
        isActive: true,
      });

      const res = await request(app)
        .patch(`/api/v1/warehouses/${warehouseB._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Renamed WH B" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_SCOPE");
    });

    test("unassigned platform actor operates globally on warehouses", async () => {
      const { token } = await createTestEmployee({
        permissions: [PERMISSIONS.WAREHOUSES_READ],
      });

      const res = await request(app)
        .get(`/api/v1/warehouses/${warehouseB._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("3. Support Queue Scope Enforcement", () => {
    test("staff scoped to 'shipping' queue can access shipping ticket details", async () => {
      const { employee, token } = await createTestEmployee({
        permissions: [PERMISSIONS.SUPPORT_TICKETS_READ],
      });

      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.SUPPORT_QUEUE,
        scopeId: "shipping",
        isActive: true,
      });

      const res = await request(app)
        .get(`/api/v1/support-tickets/${ticketShipping._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("staff scoped to 'shipping' queue CANNOT access 'payment' ticket (403 INSUFFICIENT_SCOPE)", async () => {
      const { employee, token } = await createTestEmployee({
        permissions: [PERMISSIONS.SUPPORT_TICKETS_READ],
      });

      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.SUPPORT_QUEUE,
        scopeId: "shipping",
        isActive: true,
      });

      const res = await request(app)
        .get(`/api/v1/support-tickets/${ticketPayment._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_SCOPE");
    });

    test("staff scoped to 'shipping' queue CANNOT update 'payment' ticket status (403 INSUFFICIENT_SCOPE)", async () => {
      const { employee, token } = await createTestEmployee({
        permissions: [PERMISSIONS.SUPPORT_TICKETS_MANAGE],
      });

      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.SUPPORT_QUEUE,
        scopeId: "shipping",
        isActive: true,
      });

      const res = await request(app)
        .patch(`/api/v1/support-tickets/${ticketPayment._id}/status`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "in_progress" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_SCOPE");
    });

    test("staff scoped to 'shipping' queue listing tickets receives only shipping tickets", async () => {
      const { employee, token } = await createTestEmployee({
        permissions: [PERMISSIONS.SUPPORT_TICKETS_READ],
      });

      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.SUPPORT_QUEUE,
        scopeId: "shipping",
        isActive: true,
      });

      const res = await request(app)
        .get("/api/v1/support-tickets")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const tickets = res.body.data;
      expect(Array.isArray(tickets)).toBe(true);
      const categories = tickets.map((t) => t.category);
      expect(categories.every((cat) => cat === "shipping")).toBe(true);
    });

    test("staff scoped to 'shipping' queue requesting category=other returns EMPTY array (cannot bypass queue restriction)", async () => {
      const { employee, token } = await createTestEmployee({
        permissions: [PERMISSIONS.SUPPORT_TICKETS_READ],
      });

      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.SUPPORT_QUEUE,
        scopeId: "shipping",
        isActive: true,
      });

      const res = await request(app)
        .get("/api/v1/support-tickets?category=other")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    test("staff scoped to 'shipping' queue requesting category=shipping returns shipping tickets", async () => {
      const { employee, token } = await createTestEmployee({
        permissions: [PERMISSIONS.SUPPORT_TICKETS_READ],
      });

      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.SUPPORT_QUEUE,
        scopeId: "shipping",
        isActive: true,
      });

      const res = await request(app)
        .get("/api/v1/support-tickets?category=shipping")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every((t) => t.category === "shipping")).toBe(true);
    });

    test("staff with MULTIPLE queue assignments receives tickets across all assigned queues", async () => {
      const { employee, token } = await createTestEmployee({
        permissions: [PERMISSIONS.SUPPORT_TICKETS_READ],
      });

      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.SUPPORT_QUEUE,
        scopeId: "shipping",
        isActive: true,
      });

      await WorkAssignment.create({
        employeeId: employee._id,
        scopeType: SCOPE_TYPES.SUPPORT_QUEUE,
        scopeId: "payment",
        isActive: true,
      });

      const res = await request(app)
        .get("/api/v1/support-tickets")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const categories = res.body.data.map((t) => t.category);
      expect(categories.every((c) => ["shipping", "payment"].includes(c))).toBe(true);
      expect(categories).toContain("shipping");
      expect(categories).toContain("payment");
    });

    test("unassigned platform actor can view any queue ticket globally", async () => {
      const { token } = await createTestEmployee({
        permissions: [PERMISSIONS.SUPPORT_TICKETS_READ],
      });

      const res = await request(app)
        .get(`/api/v1/support-tickets/${ticketPayment._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("4. Super Admin Global Operation Across Scopes", () => {
    test("Super Admin operates globally across categories, warehouses, and queues", async () => {
      const { token } = await createTestEmployee({
        permissions: [
          PERMISSIONS.PRODUCTS_UPDATE,
          PERMISSIONS.WAREHOUSES_READ,
          PERMISSIONS.SUPPORT_TICKETS_READ,
        ],
        userRole: ROLES.SUPER_ADMIN,
      });

      const resCat = await request(app)
        .patch(`/api/v1/categories/${categoryA._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ description: "Super Admin Update" });
      expect(resCat.status).toBe(200);

      const resWh = await request(app)
        .get(`/api/v1/warehouses/${warehouseB._id}`)
        .set("Authorization", `Bearer ${token}`);
      expect(resWh.status).toBe(200);

      const resTck = await request(app)
        .get(`/api/v1/support-tickets/${ticketPayment._id}`)
        .set("Authorization", `Bearer ${token}`);
      expect(resTck.status).toBe(200);
    });
  });
});
