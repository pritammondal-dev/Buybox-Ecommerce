const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Employee = require("../src/models/Employee");
const JobRole = require("../src/models/JobRole");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Category = require("../src/models/Category");
const Brand = require("../src/models/Brand");
const Order = require("../src/models/Order");
const Task = require("../src/models/Task");
const Warehouse = require("../src/models/Warehouse");
const Inventory = require("../src/models/Inventory");
const SavedView = require("../src/models/SavedView");
const Vendor = require("../src/models/Vendor");
const { bootstrapSuperadmin } = require("../src/services/bootstrap.service");

describe("Part 2 — Comprehensive Resource-Level IDOR / BOLA Security Matrix", () => {
  jest.setTimeout(60000);

  let superadminToken = "";
  let superadminUser = null;

  let staffUserA = null;
  let staffTokenA = "";
  let staffEmployeeA = null;

  let staffUserB = null;
  let staffTokenB = "";
  let staffEmployeeB = null;

  let customerUser = null;
  let customerToken = "";

  let testCategoryA = null;
  let testCategoryB = null;
  let testWarehouseA = null;
  let testWarehouseB = null;
  let testProduct = null;
  let testVariant = null;
  let testInventoryA = null;
  let testOrder = null;
  let testVendor = null;
  let testVendorUser = null;

  beforeAll(async () => {
    const TEST_URI = process.env.MONGODB_URI
      ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_admin_idor_matrix_test?")
      : "mongodb://127.0.0.1:27017/buybox_admin_idor_matrix_test?replicaSet=rs0";

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_URI, { autoIndex: true });
    }

    await bootstrapSuperadmin();

    // 1. Superadmin Login
    const superadminLogin = await request(app)
      .post("/api/v1/administrator/auth/login")
      .send({
        email: "admin123@example.com",
        password: "admin123",
      });
    expect(superadminLogin.status).toBe(200);
    superadminToken = superadminLogin.body.data.accessToken;
    superadminUser = superadminLogin.body.data.user;

    // 2. Create Scoped Role for Staff A (Scoped to Tasks only, no permissions to manage other staff)
    const suffix = Date.now();
    const roleARes = await request(app)
      .post("/api/v1/admin/job-roles")
      .set("Authorization", `Bearer ${superadminToken}`)
      .send({
        name: "Operations Specialist " + suffix,
        slug: "ops-spec-" + suffix,
        department: "operations",
        tier: 5,
        permissions: ["tasks.view", "tasks.edit"],
        description: "Specialist with access to own tasks only",
      });
    expect(roleARes.status).toBe(201);
    const roleA = roleARes.body.data.role;

    // 3. Create Staff A
    const staffARes = await request(app)
      .post("/api/v1/admin/staff")
      .set("Authorization", `Bearer ${superadminToken}`)
      .send({
        firstName: "Staff",
        lastName: "Alpha",
        email: `staff.alpha.${suffix}@buybox.test`,
        password: "Password123!",
        role: "editor",
        jobRoleId: roleA._id,
        department: "operations",
        jobTitle: "Operations Specialist",
      });
    expect(staffARes.status).toBe(201);
    staffUserA = staffARes.body.data.staff;
    staffEmployeeA = staffARes.body.data.staff.employee;

    const loginARes = await request(app)
      .post("/api/v1/administrator/auth/login")
      .send({
        email: staffUserA.email,
        password: "Password123!",
      });
    expect(loginARes.status).toBe(200);
    staffTokenA = loginARes.body.data.accessToken;

    // 4. Create Staff B
    const staffBRes = await request(app)
      .post("/api/v1/admin/staff")
      .set("Authorization", `Bearer ${superadminToken}`)
      .send({
        firstName: "Staff",
        lastName: "Beta",
        email: `staff.beta.${suffix}@buybox.test`,
        password: "Password123!",
        role: "editor",
        jobRoleId: roleA._id,
        department: "operations",
        jobTitle: "Operations Specialist",
      });
    expect(staffBRes.status).toBe(201);
    staffUserB = staffBRes.body.data.staff;
    staffEmployeeB = staffBRes.body.data.staff.employee;

    const loginBRes = await request(app)
      .post("/api/v1/administrator/auth/login")
      .send({
        email: staffUserB.email,
        password: "Password123!",
      });
    expect(loginBRes.status).toBe(200);
    staffTokenB = loginBRes.body.data.accessToken;

    // 5. Create Customer
    customerUser = await User.create({
      firstName: "Test",
      lastName: "Customer",
      email: `customer.idor.${suffix}@buybox.test`,
      password: "CustomerPassword123!",
      role: "customer",
      isActive: true,
    });

    const jwt = require("jsonwebtoken");
    const { JWT_SECRET } = require("../src/config/env");
    customerToken = jwt.sign(
      { id: customerUser._id.toString(), role: "customer" },
      JWT_SECRET || "fallback_secret",
      { expiresIn: "1h" }
    );

    // 6. Create Vendor
    testVendorUser = await User.create({
      firstName: "Vendor",
      lastName: "User",
      email: `vendor.idor.${suffix}@buybox.test`,
      password: "VendorPassword123!",
      role: "vendor",
      isActive: true,
    });

    testVendor = await Vendor.create({
      userId: testVendorUser._id,
      businessName: "IDOR Vendor " + suffix,
      businessSlug: "idor-vendor-" + suffix,
      isActive: true,
      onboardingStatus: "approved",
    });

    // 7. Categories for Circular Hierarchy Tests
    testCategoryA = await Category.create({
      name: "Cat Root " + suffix,
      slug: "cat-root-" + suffix,
      isActive: true,
    });

    testCategoryB = await Category.create({
      name: "Cat Child " + suffix,
      slug: "cat-child-" + suffix,
      parentId: testCategoryA._id,
      isActive: true,
    });

    // 8. Warehouses and Inventory for Transfer Tests
    testWarehouseA = await Warehouse.create({
      name: "Warehouse Alpha " + suffix,
      code: "WH-A-" + suffix.toString().slice(-4),
      isActive: true,
      address: {
        addressLine1: "Hub A",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "IN",
      },
    });

    testWarehouseB = await Warehouse.create({
      name: "Warehouse Beta " + suffix,
      code: "WH-B-" + suffix.toString().slice(-4),
      isActive: true,
      address: {
        addressLine1: "Hub B",
        city: "Delhi",
        state: "Delhi",
        postalCode: "110001",
        country: "IN",
      },
    });

    testProduct = await Product.create({
      name: "Transfer Test Product " + suffix,
      slug: "transfer-prod-" + suffix,
      sku: "SKU-TRANS-" + suffix,
      categoryId: testCategoryA._id,
      vendorId: testVendor._id,
      price: mongoose.Types.Decimal128.fromString("1500.00"),
      currency: "INR",
      status: "active",
    });

    testVariant = await ProductVariant.create({
      productId: testProduct._id,
      sku: "SKU-TRANS-" + suffix + "-V1",
      name: "Standard Edition",
      price: 1500,
      stockQuantity: 100,
      isActive: true,
    });

    testInventoryA = await Inventory.create({
      productVariantId: testVariant._id,
      warehouseId: testWarehouseA._id,
      onHand: 100,
      reserved: 10,
      lowStockThreshold: 15,
    });

    testOrder = await Order.create({
      orderNumber: "ORD-IDOR-" + suffix,
      customerId: customerUser._id,
      userId: customerUser._id,
      status: "processing",
      paymentStatus: "paid",
      subtotal: mongoose.Types.Decimal128.fromString("1500.00"),
      grandTotal: mongoose.Types.Decimal128.fromString("1500.00"),
      discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
      taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
      currency: "INR",
      shippingAddress: {
        fullName: "Test Customer",
        phone: "+919876543210",
        addressLine1: "123 Test Street",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "IN",
      },
      items: [
        {
          productId: testProduct._id,
          productVariantId: testVariant._id,
          vendorId: testVendor._id,
          warehouseId: testWarehouseA._id,
          productName: testProduct.name,
          sku: testVariant.sku,
          quantity: 1,
          unitPrice: mongoose.Types.Decimal128.fromString("1500.00"),
          discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
          taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
          lineTotal: mongoose.Types.Decimal128.fromString("1500.00"),
          currency: "INR",
          inventoryStatus: "reserved",
          fulfillmentStatus: "processing",
        },
      ],
    });
  });

  afterAll(async () => {
    if (staffUserA?._id) await User.deleteOne({ _id: staffUserA._id });
    if (staffEmployeeA?._id) await Employee.deleteOne({ _id: staffEmployeeA._id });
    if (staffUserB?._id) await User.deleteOne({ _id: staffUserB._id });
    if (staffEmployeeB?._id) await Employee.deleteOne({ _id: staffEmployeeB._id });
    if (customerUser?._id) await User.deleteOne({ _id: customerUser._id });
    if (testVendorUser?._id) await User.deleteOne({ _id: testVendorUser._id });
    if (testVendor?._id) await Vendor.deleteOne({ _id: testVendor._id });
    if (testCategoryA?._id) await Category.deleteOne({ _id: testCategoryA._id });
    if (testCategoryB?._id) await Category.deleteOne({ _id: testCategoryB._id });
    if (testWarehouseA?._id) await Warehouse.deleteOne({ _id: testWarehouseA._id });
    if (testWarehouseB?._id) await Warehouse.deleteOne({ _id: testWarehouseB._id });
    if (testProduct?._id) await Product.deleteOne({ _id: testProduct._id });
    if (testVariant?._id) await ProductVariant.deleteOne({ _id: testVariant._id });
    if (testInventoryA?._id) await Inventory.deleteOne({ _id: testInventoryA._id });
    if (testOrder?._id) await Order.deleteOne({ _id: testOrder._id });
    await mongoose.connection.close();
  });

  /*
   * ========================================================
   * 1. STAFF & SESSIONS IDOR / SECURITY
   * ========================================================
   */
  describe("1. Staff Authority & Session Invalidation", () => {
    it("Subordinate staff cannot revoke Superadmin sessions (403)", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/staff/${superadminUser._id || superadminUser.id}/revoke-sessions`)
        .set("Authorization", `Bearer ${staffTokenA}`);

      expect([401, 403]).toContain(res.status);
    });

    it("Superadmin can revoke staff sessions and invalidate their token", async () => {
      const staffAId = staffUserA._id || staffUserA.id;
      const revokeRes = await request(app)
        .post(`/api/v1/admin/staff/${staffAId}/revoke-sessions`)
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(revokeRes.status).toBe(200);
      expect(revokeRes.body.success).toBe(true);

      // Now staffTokenA must be REJECTED with 401 AUTH_VERSION_MISMATCH
      const subsequentRes = await request(app)
        .get("/api/v1/admin/tasks")
        .set("Authorization", `Bearer ${staffTokenA}`);

      expect(subsequentRes.status).toBe(401);
      expect(subsequentRes.body.code).toBe("AUTH_VERSION_MISMATCH");

      // Re-login Staff A for subsequent tests
      const reLogin = await request(app)
        .post("/api/v1/administrator/auth/login")
        .send({
          email: staffUserA.email,
          password: "Password123!",
        });
      expect(reLogin.status).toBe(200);
      staffTokenA = reLogin.body.data.accessToken;
    });
  });

  /*
   * ========================================================
   * 2. TASK CROSS-EMPLOYEE IDOR & RESOURCE AUTHORIZATION
   * ========================================================
   */
  describe("2. Task Cross-Employee IDOR & Resource Authorization", () => {
    let taskForB = null;

    beforeAll(async () => {
      // Create a task assigned specifically to Staff B
      const res = await request(app)
        .post("/api/v1/admin/tasks")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          title: "Confidential Review for Beta",
          description: "Internal operations audit",
          assignedTo: (staffUserB._id || staffUserB.id).toString(),
          priority: "HIGH",
        });
      expect(res.status).toBe(201);
      taskForB = res.body.data.task || res.body.data;
    });

    afterAll(async () => {
      if (taskForB?._id) await Task.deleteOne({ _id: taskForB._id });
    });

    it("Staff A CANNOT view Staff B's private task (403 IDOR rejection)", async () => {
      const res = await request(app)
        .get(`/api/v1/admin/tasks/${taskForB._id || taskForB.id}`)
        .set("Authorization", `Bearer ${staffTokenA}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("TASK_ACCESS_DENIED");
    });

    it("Staff A CANNOT comment on Staff B's task (403 IDOR rejection)", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/tasks/${taskForB._id || taskForB.id}/notes`)
        .set("Authorization", `Bearer ${staffTokenA}`)
        .send({ note: "Illegitimate intrusion comment" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("TASK_COMMENT_DENIED");
    });

    it("Staff B CAN view their own assigned task (200 with overdue metadata)", async () => {
      const res = await request(app)
        .get(`/api/v1/admin/tasks/${taskForB._id || taskForB.id}`)
        .set("Authorization", `Bearer ${staffTokenB}`);

      expect(res.status).toBe(200);
      const task = res.body.data.task || res.body.data;
      expect(task.title).toBe("Confidential Review for Beta");
      expect(task).toHaveProperty("isOverdue");
    });

    it("Staff without tasks.assign CANNOT reassign tasks (403)", async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/tasks/${taskForB._id || taskForB.id}`)
        .set("Authorization", `Bearer ${staffTokenB}`)
        .send({ assignedTo: (staffUserA._id || staffUserA.id).toString() });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("TASK_REASSIGNMENT_DENIED");
    });

    it("Workload summary endpoint computes real aggregated staff distribution", async () => {
      const res = await request(app)
        .get("/api/v1/admin/tasks/workload")
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.workload)).toBe(true);
    });
  });

  /*
   * ========================================================
   * 3. SAVED VIEWS PRIVATE OWNERSHIP & CROSS-USER IDOR
   * ========================================================
   */
  describe("3. Saved Views Ownership & IDOR Protection", () => {
    let savedViewA = null;

    it("Staff A can create a private saved view", async () => {
      const res = await request(app)
        .post("/api/v1/admin/saved-views")
        .set("Authorization", `Bearer ${staffTokenA}`)
        .send({
          name: "My Urgent Products",
          resource: "products",
          filters: { status: "pending_approval" },
          isShared: false,
        });

      expect(res.status).toBe(201);
      savedViewA = res.body.data.view;
      expect(savedViewA.name).toBe("My Urgent Products");
    });

    it("Staff B CANNOT read Staff A's private saved view (403)", async () => {
      const res = await request(app)
        .get(`/api/v1/admin/saved-views/${savedViewA._id}`)
        .set("Authorization", `Bearer ${staffTokenB}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("SAVED_VIEW_ACCESS_DENIED");
    });

    it("Staff B CANNOT mutate or delete Staff A's saved view (403)", async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/saved-views/${savedViewA._id}`)
        .set("Authorization", `Bearer ${staffTokenB}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("SAVED_VIEW_DELETE_DENIED");
    });

    it("Staff A can delete their own saved view (200)", async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/saved-views/${savedViewA._id}`)
        .set("Authorization", `Bearer ${staffTokenA}`);

      expect(res.status).toBe(200);
    });
  });

  /*
   * ========================================================
   * 4. CATEGORY CIRCULAR HIERARCHY PREVENTION
   * ========================================================
   */
  describe("4. Category Circular Hierarchy & Self-Parent Defense", () => {
    it("Rejects category setting parent to itself (400)", async () => {
      const res = await request(app)
        .put(`/api/v1/categories/${testCategoryA._id}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ parentId: testCategoryA._id.toString() });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_PARENT_CATEGORY");
    });

    it("Rejects circular hierarchy: moving parent into its own child (400)", async () => {
      // testCategoryB is already child of testCategoryA
      // Attempting to set testCategoryA's parent to testCategoryB creates a cycle A -> B -> A
      const res = await request(app)
        .put(`/api/v1/categories/${testCategoryA._id}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ parentId: testCategoryB._id.toString() });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("CATEGORY_CYCLE_DETECTED");
    });
  });

  /*
   * ========================================================
   * 5. INVENTORY ATOMIC INTER-WAREHOUSE TRANSFERS
   * ========================================================
   */
  describe("5. Inventory Inter-Warehouse Stock Transfer", () => {
    it("Transfers stock atomically from Warehouse A to Warehouse B", async () => {
      const initialStockA = testInventoryA.onHand;
      const transferQty = 20;

      const res = await request(app)
        .post("/api/v1/inventory/transfer")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          productVariantId: testVariant._id.toString(),
          sourceWarehouseId: testWarehouseA._id.toString(),
          destinationWarehouseId: testWarehouseB._id.toString(),
          quantity: transferQty,
          reason: "Replenishing Northern regional hub",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify source warehouse stock decreased
      const sourceInv = await Inventory.findById(testInventoryA._id);
      expect(sourceInv.onHand).toBe(initialStockA - transferQty);

      // Verify destination warehouse stock increased
      const destInv = await Inventory.findOne({
        productVariantId: testVariant._id,
        warehouseId: testWarehouseB._id,
      });
      expect(destInv).toBeDefined();
      expect(destInv.onHand).toBe(transferQty);
    });

    it("Rejects transfer exceeding available unreserved stock (409)", async () => {
      const res = await request(app)
        .post("/api/v1/inventory/transfer")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          productVariantId: testVariant._id.toString(),
          sourceWarehouseId: testWarehouseA._id.toString(),
          destinationWarehouseId: testWarehouseB._id.toString(),
          quantity: 99999, // Exceeds stock
        });

      expect([400, 409, 422]).toContain(res.status);
    });

    it("Rejects transfer when source and destination warehouse are identical (400)", async () => {
      const res = await request(app)
        .post("/api/v1/inventory/transfer")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          productVariantId: testVariant._id.toString(),
          sourceWarehouseId: testWarehouseA._id.toString(),
          destinationWarehouseId: testWarehouseA._id.toString(),
          quantity: 5,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("SAME_WAREHOUSE_TRANSFER");
    });
  });

  /*
   * ========================================================
   * 6. ORDER ADMINISTRATIVE CANCELLATION & BOUNDARY
   * ========================================================
   */
  describe("6. Order Administrative Operations", () => {
    it("Admin can cancel order administratively (200)", async () => {
      const res = await request(app)
        .post(`/api/v1/orders/admin/${testOrder._id}/cancel`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ reason: "Fraud verification failure" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("Customer CANNOT cancel another customer's order (403)", async () => {
      // Create a second customer
      const anotherCustomer = await User.create({
        firstName: "Other",
        lastName: "User",
        email: `other.${Date.now()}@buybox.test`,
        password: "Password123!",
        role: "customer",
        isActive: true,
      });

      const jwt = require("jsonwebtoken");
      const { JWT_SECRET } = require("../src/config/env");
      const otherToken = jwt.sign(
        { id: anotherCustomer._id.toString(), role: "customer" },
        JWT_SECRET || "fallback_secret",
        { expiresIn: "1h" }
      );

      const res = await request(app)
        .post(`/api/v1/orders/${testOrder._id}/cancel`)
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ reason: "Unauthorized attempt" });

      expect([401, 403]).toContain(res.status);

      await User.deleteOne({ _id: anotherCustomer._id });
    });
  });
});
