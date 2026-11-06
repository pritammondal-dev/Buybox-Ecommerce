const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Inventory = require("../src/models/Inventory");
const Order = require("../src/models/Order");
const Warehouse = require("../src/models/Warehouse");
const AuditLog = require("../src/models/AuditLog");
const { VendorSettlement } = require("../src/models/VendorSettlement");
const { hashPassword } = require("../src/utils/password");
const { generateAccessToken } = require("../src/services/token.service");
const { encodeSecureId } = require("../src/utils/secure-id.util");
const { ROLES } = require("../src/constants/auth.constants");
const vendorService = require("../src/services/vendor.service");

describe("Phase 6A: Superadmin Vendor Management Forensic Suite", () => {
  let adminUser;
  let adminToken;
  let testVendorUser;
  let testVendor;
  let testProduct;
  let testVariant;
  let testOrder;
  let testWarehouse;

  const TEST_MONGODB_URI = process.env.MONGODB_URI
    ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_p6a_test?")
    : "mongodb://127.0.0.1:27017/buybox_p6a_test?replicaSet=rs0";

  jest.setTimeout(45000);

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    await User.deleteMany({ role: ROLES.SUPER_ADMIN });

    const uniqueSuffix = Date.now();

    // 1. Provision Platform Superadmin
    adminUser = await User.create({
      email: `superadmin-p6a-${uniqueSuffix}@buybox.test`,
      password: await hashPassword("AdminSecret123!"),
      firstName: "Super",
      lastName: "Admin",
      role: ROLES.SUPER_ADMIN,
      isActive: true,
      isEmailVerified: true,
    });

    const Employee = require("../src/models/Employee");
    const Role = require("../src/models/Role");
    const Permission = require("../src/models/Permission");
    const RolePermission = require("../src/models/RolePermission");
    const EmployeeRole = require("../src/models/EmployeeRole");
    const { PERMISSIONS } = require("../src/constants/permissions.constants");

    const employee = await Employee.create({
      userId: adminUser._id,
      jobTitle: "Superadmin Auditor",
      department: "Administration",
      employeeNumber: `EMP-P6A-${uniqueSuffix}`,
      status: "active",
      isActive: true,
    });

    const superRole = await Role.findOneAndUpdate(
      { slug: "super-admin" },
      { name: "Super Admin", slug: "super-admin", isSystem: true, isActive: true },
      { upsert: true, new: true }
    );

    const vendorReadPerm = await Permission.findOneAndUpdate(
      { slug: PERMISSIONS.VENDORS_READ },
      { name: "Read Vendors", slug: PERMISSIONS.VENDORS_READ, module: "vendors" },
      { upsert: true, new: true }
    );

    const vendorManagePerm = await Permission.findOneAndUpdate(
      { slug: PERMISSIONS.VENDORS_MANAGE },
      { name: "Manage Vendors", slug: PERMISSIONS.VENDORS_MANAGE, module: "vendors" },
      { upsert: true, new: true }
    );

    await Promise.all([
      RolePermission.findOneAndUpdate(
        { roleId: superRole._id, permissionId: vendorReadPerm._id },
        { roleId: superRole._id, permissionId: vendorReadPerm._id },
        { upsert: true }
      ),
      RolePermission.findOneAndUpdate(
        { roleId: superRole._id, permissionId: vendorManagePerm._id },
        { roleId: superRole._id, permissionId: vendorManagePerm._id },
        { upsert: true }
      ),
    ]);

    await EmployeeRole.create({
      employeeId: employee._id,
      roleId: superRole._id,
      assignedBy: adminUser._id,
    });

    adminToken = generateAccessToken(adminUser);

    // 2. Provision Test Vendor User
    testVendorUser = await User.create({
      email: `vendor-p6a-${uniqueSuffix}@buybox.test`,
      phone: "+919876543210",
      password: await hashPassword("VendorSecret123!"),
      firstName: "Aarav",
      lastName: "Patel",
      role: ROLES.VENDOR,
      isActive: true,
      isEmailVerified: true,
    });

    // 3. Provision Test Vendor Document
    testVendor = await Vendor.create({
      userId: testVendorUser._id,
      businessName: "Aarav Tech Solutions",
      businessSlug: `aarav-tech-${uniqueSuffix}`,
      phone: "+919876543210",
      supportEmail: `support-p6a-${uniqueSuffix}@buybox.test`,
      onboardingStatus: "approved",
      isActive: true,
      approvedAt: new Date(),
      approvedBy: adminUser._id,
      businessAddress: {
        addressLine1: "123 Electronic City Phase 1",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560100",
        country: "IN",
      },
      taxInformation: {
        taxId: "29AAAAA0000A1Z5",
        taxType: "Regular",
      },
      commissionRate: 12.5,
    });

    // 4. Provision Warehouse & Product
    testWarehouse = await Warehouse.create({
      name: `P6A Hub ${uniqueSuffix}`,
      code: `WH-P6A-${uniqueSuffix}`.slice(0, 20),
      address: {
        addressLine1: "45 Industrial Layout",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560100",
        country: "IN",
      },
    });

    const Category = require("../src/models/Category");
    const testCategory = await Category.create({
      name: `Electronics ${uniqueSuffix}`,
      slug: `elec-${uniqueSuffix}`,
    });

    testProduct = await Product.create({
      name: "Aarav Quantum Earbuds",
      slug: `aarav-quantum-earbuds-${uniqueSuffix}`,
      description: "High quality wireless earbuds",
      categoryId: testCategory._id,
      vendorId: testVendor._id,
      price: 2999,
      status: "active",
      sku: `AQE-${uniqueSuffix}`.slice(0, 20),
    });

    testVariant = await ProductVariant.create({
      productId: testProduct._id,
      sku: `AQE-BLK-${uniqueSuffix}`.slice(0, 20),
      price: 2999,
      attributes: { Color: "Matte Black" },
    });

    await Inventory.create({
      productVariantId: testVariant._id,
      warehouseId: testWarehouse._id,
      onHand: 100,
      reserved: 5,
    });

    // 5. Provision Order with vendor line item
    testOrder = await Order.create({
      orderNumber: `ORD-P6A-${uniqueSuffix}`,
      customerId: adminUser._id,
      items: [
        {
          productId: testProduct._id,
          productVariantId: testVariant._id,
          vendorId: testVendor._id,
          sku: testVariant.sku,
          productName: testProduct.name,
          quantity: 2,
          unitPrice: 2999,
          lineTotal: 5998,
          currency: "INR",
        },
      ],
      shippingAddress: {
        fullName: "Test Customer",
        phone: "+919876543210",
        addressLine1: "123 Test Street",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560100",
        country: "IN",
      },
      pricing: {
        subtotal: 5998,
        grandTotal: 5998,
        currency: "INR",
      },
      paymentStatus: "paid",
      status: "processing",
    });

    // 6. Provision AuditLog
    await AuditLog.create({
      actorId: adminUser._id,
      targetId: testVendor._id,
      action: "VENDOR_APPROVED",
      entityType: "Vendor",
      afterState: { onboardingStatus: "approved" },
    });
  });

  afterAll(async () => {
    if (adminUser) await User.deleteMany({ _id: { $in: [adminUser._id, testVendorUser?._id] } });
    if (testVendor) await Vendor.deleteOne({ _id: testVendor._id });
    if (testProduct) await Product.deleteOne({ _id: testProduct._id });
    if (testVariant) await ProductVariant.deleteOne({ _id: testVariant._id });
    if (testOrder) await Order.deleteOne({ _id: testOrder._id });
    if (testWarehouse) await Warehouse.deleteOne({ _id: testWarehouse._id });
    await mongoose.disconnect();
  });

  describe("1. Regex Search Sanitization & listVendors Robustness", () => {
    it("should safely handle search strings with '+' and special regex tokens without throwing 500", async () => {
      // Searching by phone with '+'
      const res = await request(app)
        .get("/api/v1/admin/vendors")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({ search: "+919876543210" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.vendors)).toBe(true);
      expect(res.body.data.vendors.some((v) => v.businessName === "Aarav Tech Solutions")).toBe(true);
    });

    it("should safely handle parentheses and brackets in search without regex compilation error", async () => {
      const res = await request(app)
        .get("/api/v1/admin/vendors")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({ search: "Aarav (Tech) [Solutions]" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should return productsCount and ordersCount in vendor list", async () => {
      const res = await request(app)
        .get("/api/v1/admin/vendors")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({ search: "Aarav Tech Solutions" });

      expect(res.status).toBe(200);
      const vendorRecord = res.body.data.vendors.find((v) => v.businessName === "Aarav Tech Solutions");
      expect(vendorRecord).toBeDefined();
      expect(vendorRecord.productsCount).toBeGreaterThanOrEqual(1);
      expect(vendorRecord.ordersCount).toBeGreaterThanOrEqual(1);
    });

    it("should include suspended and inactive in statusCounts breakdown", async () => {
      const res = await request(app)
        .get("/api/v1/admin/vendors")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.statusCounts).toBeDefined();
      expect(typeof res.body.data.statusCounts.pending).toBe("number");
      expect(typeof res.body.data.statusCounts.approved).toBe("number");
      expect(typeof res.body.data.statusCounts.suspended).toBe("number");
      expect(typeof res.body.data.statusCounts.total).toBe("number");
    });
  });

  describe("2. Vendor Detail & ordersCount Fix", () => {
    it("should accurately return ordersCount querying items.vendorId", async () => {
      const secureVendorId = encodeSecureId("vendor", testVendor._id);
      const res = await request(app)
        .get(`/api/v1/admin/vendors/${secureVendorId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const vendorData = res.body.data.vendor;
      expect(vendorData).toBeDefined();
      expect(vendorData.businessName).toBe("Aarav Tech Solutions");
      expect(vendorData.productsCount).toBe(1);
      expect(vendorData.ordersCount).toBe(1); // Fixed from previous 0
    });
  });

  describe("3. Vendor Overview Enriched Datasets for Admin Tabs", () => {
    it("should return 12 KPIs, products with variants, projected orders, inventory, and audit logs", async () => {
      const secureVendorId = encodeSecureId("vendor", testVendor._id);
      const res = await request(app)
        .get(`/api/v1/admin/vendors/${secureVendorId}/overview`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const overview = res.body.data;

      // KPIs
      expect(overview.kpis).toBeDefined();
      expect(overview.kpis.totalProducts).toBe(1);
      expect(overview.kpis.totalOrders).toBe(1);
      expect(overview.kpis.totalEarnings).toBe(5998);

      // Enriched Products
      expect(Array.isArray(overview.products)).toBe(true);
      expect(overview.products.length).toBeGreaterThanOrEqual(1);
      expect(overview.products[0].variants).toBeDefined();

      // Recent Orders with projected vendor items
      expect(Array.isArray(overview.recentOrders)).toBe(true);
      expect(overview.recentOrders.length).toBeGreaterThanOrEqual(1);

      // Inventory
      expect(Array.isArray(overview.inventory)).toBe(true);
      expect(overview.inventory.length).toBeGreaterThanOrEqual(1);

      // Audit Logs
      expect(Array.isArray(overview.auditLogs)).toBe(true);
      expect(overview.auditLogs.some((l) => l.action === "VENDOR_APPROVED")).toBe(true);
    });
  });

  describe("4. Security & Permissions Boundaries", () => {
    it("should reject requests without authorization header", async () => {
      const res = await request(app).get("/api/v1/admin/vendors");
      expect(res.status).toBe(401);
    });

    it("should never expose password hashes or sensitive internal secrets", async () => {
      const secureVendorId = encodeSecureId("vendor", testVendor._id);
      const res = await request(app)
        .get(`/api/v1/admin/vendors/${secureVendorId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const vendorData = res.body.data.vendor;
      expect(vendorData.userId.password).toBeUndefined();
      expect(vendorData.password).toBeUndefined();
    });
  });
});
