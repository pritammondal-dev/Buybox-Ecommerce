const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Employee = require("../src/models/Employee");
const JobRole = require("../src/models/JobRole");
const AuditLog = require("../src/models/AuditLog");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Category = require("../src/models/Category");
const Brand = require("../src/models/Brand");
const Order = require("../src/models/Order");
const ReturnRequest = require("../src/models/ReturnRequest");
const Refund = require("../src/models/Refund");
const Payment = require("../src/models/Payment");
const Task = require("../src/models/Task");
const Warehouse = require("../src/models/Warehouse");
const Inventory = require("../src/models/Inventory");
const Review = require("../src/models/Review");
const Shipment = require("../src/models/Shipment");
const Vendor = require("../src/models/Vendor");
const { bootstrapSuperadmin } = require("../src/services/bootstrap.service");

describe("Part 2 — Complete Operational Admin Control Plane Test Suite", () => {
  jest.setTimeout(60000);

  let superadminToken = "";
  let superadminUser = null;

  let catalogManagerUser = null;
  let catalogManagerEmployee = null;
  let catalogManagerToken = "";

  let testCustomer = null;
  let testCustomerToken = "";

  let testVendorUser = null;
  let testVendor = null;
  let testCategory = null;
  let testBrand = null;
  let testProduct = null;
  let testVariant = null;
  let testWarehouse = null;
  let testInventory = null;
  let testOrder = null;
  let testReturn = null;

  beforeAll(async () => {
    const TEST_URI = process.env.MONGODB_URI
      ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_admin_control_plane_test?")
      : "mongodb://127.0.0.1:27017/buybox_admin_control_plane_test?replicaSet=rs0";

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_URI, { autoIndex: true });
    }

    await Promise.all([
      User.init(),
      Employee.init(),
      JobRole.init(),
      AuditLog.init(),
      Product.init(),
      ProductVariant.init(),
      Category.init(),
      Brand.init(),
      Order.init(),
      ReturnRequest.init(),
      Refund.init(),
      Payment.init(),
      Task.init(),
      Warehouse.init(),
      Inventory.init(),
      Review.init(),
      Shipment.init(),
    ]);

    // 1. Bootstrap superadmin
    await bootstrapSuperadmin();

    // 2. Log in as Superadmin
    const superadminLogin = await request(app)
      .post("/api/v1/administrator/auth/login")
      .send({
        email: "admin123@example.com",
        password: "admin123",
      });

    expect(superadminLogin.status).toBe(200);
    superadminToken = superadminLogin.body.data.accessToken;
    superadminUser = superadminLogin.body.data.user;

    // 3. Create a scoped JobRole with only catalog permissions (products.view, products.edit)
    const uniqueRoleSuffix = Date.now();
    const catalogRoleRes = await request(app)
      .post("/api/v1/admin/job-roles")
      .set("Authorization", `Bearer ${superadminToken}`)
      .send({
        name: "Catalog Specialist " + uniqueRoleSuffix,
        slug: "catalog-specialist-" + uniqueRoleSuffix,
        department: "catalog",
        tier: 5,
        permissions: [
          "products.view",
          "products.edit",
          "categories.view",
          "brands.view",
          "tasks.view",
          "tasks.edit",
        ],
        description: "Specialist with access only to catalog operations",
      });
    expect(catalogRoleRes.status).toBe(201);
    const catalogRole = catalogRoleRes.body.data.role;

    // 4. Create an employee user for catalog specialist via Part 1 staff provisioning
    const createStaffRes = await request(app)
      .post("/api/v1/admin/staff")
      .set("Authorization", `Bearer ${superadminToken}`)
      .send({
        firstName: "Cat",
        lastName: "Specialist",
        email: `catalog.spec.${Date.now()}@buybox.test`,
        password: "Password123!",
        role: "editor",
        jobRoleId: catalogRole._id,
        department: "catalog",
        jobTitle: "Catalog Specialist",
      });

    expect(createStaffRes.status).toBe(201);
    catalogManagerUser = createStaffRes.body.data.staff;
    catalogManagerEmployee = createStaffRes.body.data.staff.employee;

    // Log in as Catalog Specialist
    const loginRes = await request(app)
      .post("/api/v1/administrator/auth/login")
      .send({
        email: catalogManagerUser.email,
        password: "Password123!",
      });
    expect(loginRes.status).toBe(200);
    catalogManagerToken = loginRes.body.data.accessToken;

    // 5. Create test customer
    testCustomer = await User.create({
      firstName: "Jane",
      lastName: "Doe",
      email: `customer.${Date.now()}@example.com`,
      password: "CustomerPassword123!",
      role: "customer",
      isActive: true,
    });

    const jwt = require("jsonwebtoken");
    const { JWT_SECRET } = require("../src/config/env");
    testCustomerToken = jwt.sign(
      { id: testCustomer._id.toString(), role: "customer" },
      JWT_SECRET || "fallback_secret",
      { expiresIn: "1h" }
    );

    // 6. Create Category & Brand
    testCategory = await Category.create({
      name: "Electronics Test " + Date.now(),
      slug: "electronics-test-" + Date.now(),
      isActive: true,
    });

    testBrand = await Brand.create({
      name: "Acme Brand " + Date.now(),
      slug: "acme-brand-" + Date.now(),
      isActive: true,
    });

    testVendorUser = await User.create({
      firstName: "Test",
      lastName: "Vendor",
      email: `vendor.${Date.now()}@buybox.test`,
      password: "VendorPassword123!",
      role: "vendor",
      isActive: true,
    });

    testVendor = await Vendor.create({
      userId: testVendorUser._id,
      businessName: "Acme Tech " + Date.now(),
      businessSlug: "acme-tech-" + Date.now(),
      isActive: true,
      onboardingStatus: "approved",
    });

    // 7. Create Product & Variant
    testProduct = await Product.create({
      name: "Test Smart Phone " + Date.now(),
      slug: "test-smart-phone-" + Date.now(),
      sku: "PHONE-" + Date.now(),
      categoryId: testCategory._id,
      brandId: testBrand._id,
      vendorId: testVendor._id,
      price: mongoose.Types.Decimal128.fromString("29999.00"),
      currency: "INR",
      status: "active",
    });

    testVariant = await ProductVariant.create({
      productId: testProduct._id,
      sku: testProduct.sku + "-V1",
      name: "128GB Black",
      price: 29999,
      stockQuantity: 50,
      isActive: true,
    });

    // 8. Create Warehouse & Inventory
    testWarehouse = await Warehouse.create({
      name: "Central Mumbai Hub " + Date.now(),
      code: "WH-MUM-" + Date.now().toString().slice(-4),
      isActive: true,
      address: {
        addressLine1: "Plot 42 Logistics Park",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "IN",
      },
    });

    testInventory = await Inventory.create({
      productVariantId: testVariant._id,
      warehouseId: testWarehouse._id,
      onHand: 40,
      reserved: 5,
      lowStockThreshold: 10,
    });

    // 9. Create Order & Return
    testOrder = await Order.create({
      orderNumber: "ORD-TEST-" + Date.now(),
      customerId: testCustomer._id,
      userId: testCustomer._id,
      status: "delivered",
      paymentStatus: "paid",
      fulfillmentStatus: "fulfilled",
      subtotal: mongoose.Types.Decimal128.fromString("29999.00"),
      grandTotal: mongoose.Types.Decimal128.fromString("29999.00"),
      discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
      taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
      currency: "INR",
      shippingAddress: {
        fullName: "Jane Doe",
        phone: "+919876543210",
        addressLine1: "123 Main Street",
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
          warehouseId: testWarehouse._id,
          productName: testProduct.name,
          sku: testVariant.sku,
          quantity: 1,
          unitPrice: mongoose.Types.Decimal128.fromString("29999.00"),
          discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
          taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
          lineTotal: mongoose.Types.Decimal128.fromString("29999.00"),
          currency: "INR",
          inventoryStatus: "reserved",
          fulfillmentStatus: "delivered",
        },
      ],
    });

    testReturn = await ReturnRequest.create({
      returnNumber: "RET-" + Date.now(),
      orderId: testOrder._id,
      customerId: testCustomer._id,
      vendorIds: [testVendor._id],
      items: [
        {
          productId: testProduct._id,
          productVariantId: testVariant._id,
          sku: testVariant.sku,
          name: testProduct.name,
          quantity: 1,
          itemPrice: mongoose.Types.Decimal128.fromString("29999.00"),
          reason: "defective",
          condition: "defective_in_box",
          vendorId: testVendor._id,
        },
      ],
      customerNotes: "Defective item on delivery",
      status: "requested",
    });
  });

  afterAll(async () => {
    // Clean up created entities
    if (testCustomer?._id) await User.deleteOne({ _id: testCustomer._id });
    if (catalogManagerUser?._id) await User.deleteOne({ _id: catalogManagerUser._id });
    if (catalogManagerEmployee?._id) await Employee.deleteOne({ _id: catalogManagerEmployee._id });
    if (testVendor?._id) await Vendor.deleteOne({ _id: testVendor._id });
    if (testVendorUser?._id) await User.deleteOne({ _id: testVendorUser._id });
    if (testProduct?._id) await Product.deleteOne({ _id: testProduct._id });
    if (testVariant?._id) await ProductVariant.deleteOne({ _id: testVariant._id });
    if (testCategory?._id) await Category.deleteOne({ _id: testCategory._id });
    if (testBrand?._id) await Brand.deleteOne({ _id: testBrand._id });
    if (testWarehouse?._id) await Warehouse.deleteOne({ _id: testWarehouse._id });
    if (testInventory?._id) await Inventory.deleteOne({ _id: testInventory._id });
    if (testOrder?._id) await Order.deleteOne({ _id: testOrder._id });
    if (testReturn?._id) await ReturnRequest.deleteOne({ _id: testReturn._id });
    await mongoose.connection.close();
  });

  /*
   * ========================================================
   * 1. PERMISSION-AWARE ADMIN DASHBOARD (Section 6 & 7)
   * ========================================================
   */
  describe("1. Permission-Aware Admin Dashboard", () => {
    it("Superadmin receives full data across all operational domains", async () => {
      const res = await request(app)
        .get("/api/v1/admin/dashboard")
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;

      // Superadmin must see kpis and allowed sections
      expect(data).toHaveProperty("kpis");
      expect(data.kpis).toHaveProperty("revenue");
      expect(data.kpis).toHaveProperty("totalOrders");
      expect(data.kpis).toHaveProperty("totalCustomers");
      expect(data.kpis).toHaveProperty("activeVendors");
      expect(data.kpis).toHaveProperty("totalProducts");
    });

    it("Catalog Specialist has sales, customer, and finance data filtered out server-side", async () => {
      const res = await request(app)
        .get("/api/v1/admin/dashboard")
        .set("Authorization", `Bearer ${catalogManagerToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;

      // Products kpi is allowed since catalogManager has products.view
      expect(data.kpis).toHaveProperty("totalProducts");

      // Gross sales, finance, customers, vendors must NOT be exposed
      expect(data.kpis.revenue).toBeUndefined();
      expect(data.kpis.gmv).toBeUndefined();
      expect(data.kpis.totalCustomers).toBeUndefined();
      expect(data.kpis.activeVendors).toBeUndefined();
    });

    it("Rejects unauthenticated dashboard access with 401", async () => {
      const res = await request(app).get("/api/v1/admin/dashboard");
      expect(res.status).toBe(401);
    });
  });

  /*
   * ========================================================
   * 2. GLOBAL SEARCH & PERMISSION FILTERING (Section 35)
   * ========================================================
   */
  describe("2. Global Search & Permission Scoping", () => {
    it("Superadmin can search across all resources", async () => {
      const res = await request(app)
        .get("/api/v1/admin/search")
        .query({ q: "Phone" })
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const results = res.body.data;
      expect(results).toHaveProperty("products");
      expect(results.products.length).toBeGreaterThanOrEqual(1);
    });

    it("Staff without customer or order permissions cannot see customer/order results", async () => {
      const res = await request(app)
        .get("/api/v1/admin/search")
        .query({ q: "Jane" })
        .set("Authorization", `Bearer ${catalogManagerToken}`);

      expect(res.status).toBe(200);
      const results = res.body.data;
      // customers key should either be empty or undefined
      expect(results.customers || []).toEqual([]);
    });

    it("Short query (<2 chars) returns safe empty structure without querying DB", async () => {
      const res = await request(app)
        .get("/api/v1/admin/search")
        .query({ q: "a" })
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalResults).toBe(0);
    });
  });

  /*
   * ========================================================
   * 3. CUSTOMER MANAGEMENT & SENSITIVE DATA PROTECTION (Section 12)
   * ========================================================
   */
  describe("3. Customer Management & Data Safety", () => {
    it("Admin can fetch customer details with orders and returns populated", async () => {
      const res = await request(app)
        .get(`/api/v1/admin/customers/${testCustomer._id}`)
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const customer = res.body.data.customer;
      expect(customer._id.toString()).toBe(testCustomer._id.toString());
      expect(customer.email).toBe(testCustomer.email);

      // Sensitive fields must NEVER be returned
      expect(customer.passwordHash).toBeUndefined();
      expect(customer.password).toBeUndefined();
      expect(customer.otp).toBeUndefined();
      expect(customer.jwt).toBeUndefined();
    });

    it("Admin can toggle customer active status (suspend / restore)", async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/customers/${testCustomer._id}/status`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ isActive: false, reason: "Administrative suspension test" });

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);

      // Restore status
      const restoreRes = await request(app)
        .patch(`/api/v1/admin/customers/${testCustomer._id}/status`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ isActive: true });

      expect(restoreRes.status).toBe(200);
      expect(restoreRes.body.data.isActive).toBe(true);
    });

    it("Rejects customer management from unauthorized staff", async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/customers/${testCustomer._id}/status`)
        .set("Authorization", `Bearer ${catalogManagerToken}`)
        .send({ isActive: false });

      expect([401, 403]).toContain(res.status);
    });
  });

  /*
   * ========================================================
   * 4. CATALOG OPERATIONS & MODERATION (Section 13, 14, 15, 31)
   * ========================================================
   */
  describe("4. Catalog Operations & Review Moderation", () => {
    it("Admin can review and approve / moderate product", async () => {
      await Product.updateOne({ _id: testProduct._id }, { status: "pending_approval" });

      const res = await request(app)
        .patch(`/api/v1/products/${testProduct._id}/approve`)
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("Admin can list reviews and moderate them (Approve / Reject)", async () => {
      // Create a test review
      const testReview = await Review.create({
        productId: testProduct._id,
        customerId: testCustomer._id,
        orderId: testOrder._id,
        rating: 5,
        title: "Outstanding product",
        comment: "Exceeded all expectations, great battery life!",
        status: "pending",
      });

      // List reviews
      const listRes = await request(app)
        .get("/api/v1/reviews")
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.success).toBe(true);

      // Moderate (Approve)
      const approveRes = await request(app)
        .patch(`/api/v1/reviews/${testReview._id}/moderation`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ status: "approved", reason: "Meets community standards" });

      expect(approveRes.status).toBe(200);

      // Clean up review
      await Review.deleteOne({ _id: testReview._id });
    });
  });

  /*
   * ========================================================
   * 5. INVENTORY ATOMIC ADJUSTMENTS & CONCURRENCY (Section 16 & 17)
   * ========================================================
   */
  describe("5. Inventory Operations & Atomic Mutation", () => {
    it("Performs authoritative server-side stock adjustment", async () => {
      const initialStock = testInventory.onHand;
      const delta = 15;

      const res = await request(app)
        .patch(`/api/v1/inventory/${testInventory._id}/adjust`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          quantity: delta,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inventory.onHand).toBe(initialStock + delta);
    });

    it("Rejects negative delta that would result in negative available inventory", async () => {
      const res = await request(app)
        .patch(`/api/v1/inventory/${testInventory._id}/adjust`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          quantity: -9999, // Exceeds available stock
        });

      expect([400, 409, 422]).toContain(res.status);
    });
  });

  /*
   * ========================================================
   * 6. RETURNS, REFUNDS & FINANCIAL AUDITING (Section 23, 24, 26)
   * ========================================================
   */
  describe("6. Returns & Refunds Operations", () => {
    it("Admin can list returns with customer and order data", async () => {
      const res = await request(app)
        .get("/api/v1/returns/admin")
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("Admin can approve return request", async () => {
      const res = await request(app)
        .post(`/api/v1/returns/admin/${testReturn._id}/approve`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ note: "Return inspection approved" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("approved");
    });

    it("Admin can list all platform refunds", async () => {
      const res = await request(app)
        .get("/api/v1/payments/admin/refunds")
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("Staff without finance/refunds permission is denied access to refund ledger", async () => {
      const res = await request(app)
        .get("/api/v1/payments/admin/refunds")
        .set("Authorization", `Bearer ${catalogManagerToken}`);

      expect([401, 403]).toContain(res.status);
    });
  });

  /*
   * ========================================================
   * 7. TASK MANAGEMENT DYNAMIC AUTHORIZATION (Section 10)
   * ========================================================
   */
  describe("7. Task Management Authorization", () => {
    let createdTaskId = null;

    it("Admin can create and assign task to employee", async () => {
      const res = await request(app)
        .post("/api/v1/admin/tasks")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          title: "Audit Q3 Product Catalog",
          description: "Verify SKU barcoding and tax classification",
          assignedTo: (catalogManagerUser._id || catalogManagerUser.id).toString(),
          priority: "HIGH",
          dueDate: new Date(Date.now() + 86400000).toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const task = res.body.data.task || res.body.data;
      createdTaskId = task._id || task.id;
    });

    it("Assigned employee can view their assigned task", async () => {
      const res = await request(app)
        .get(`/api/v1/admin/tasks/${createdTaskId}`)
        .set("Authorization", `Bearer ${catalogManagerToken}`);

      expect(res.status).toBe(200);
      const task = res.body.data.task || res.body.data;
      expect(task.title).toBe("Audit Q3 Product Catalog");
    });

    it("Employee can add note / comment to their task", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/tasks/${createdTaskId}/notes`)
        .set("Authorization", `Bearer ${catalogManagerToken}`)
        .send({
          note: "Started SKU verification for Electronics subcategory.",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    afterAll(async () => {
      if (createdTaskId) await Task.deleteOne({ _id: createdTaskId });
    });
  });

  /*
   * ========================================================
   * 8. IDOR & PRIVILEGE ESCALATION DEFENSE (Section 38 & 39)
   * ========================================================
   */
  describe("8. IDOR & Privilege Escalation Defense", () => {
    it("Catalog Specialist cannot promote themselves or alter JobRole tiers", async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/job-roles/${catalogManagerEmployee.jobRoleId}`)
        .set("Authorization", `Bearer ${catalogManagerToken}`)
        .send({
          name: "Escalated Super Role",
          tier: 0,
          permissions: ["*"],
        });

      expect([401, 403]).toContain(res.status);
    });

    it("Unauthorized actor cannot trigger bulk catalog imports", async () => {
      const res = await request(app)
        .post("/api/v1/products/admin/import/commit")
        .set("Authorization", `Bearer ${testCustomerToken}`)
        .send({ rows: [] });

      expect([401, 403]).toContain(res.status);
    });
  });
});
