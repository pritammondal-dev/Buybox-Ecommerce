const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Customer = require("../src/models/Customer");
const Vendor = require("../src/models/Vendor");
const Category = require("../src/models/Category");
const Brand = require("../src/models/Brand");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Warehouse = require("../src/models/Warehouse");
const Inventory = require("../src/models/Inventory");
const Employee = require("../src/models/Employee");
const Role = require("../src/models/Role");
const Permission = require("../src/models/Permission");
const RolePermission = require("../src/models/RolePermission");
const EmployeeRole = require("../src/models/EmployeeRole");
const { hashPassword } = require("../src/utils/password");
const { generateAccessToken } = require("../src/services/token.service");
const { ROLES } = require("../src/constants/auth.constants");
const { PERMISSIONS } = require("../src/constants/permissions.constants");

describe("Vendor Registration, Boundary & Warehouse Authorization Suite", () => {
  let customerUser;
  let customerToken;
  let vendorAUser;
  let vendorAToken;
  let vendorADoc;
  let vendorBUser;
  let vendorBToken;
  let vendorBDoc;
  let adminUser;
  let adminToken;
  let testWarehouse;
  let testCategory;
  let testBrand;
  let productA;
  let variantA;

  const TEST_MONGODB_URI = process.env.MONGODB_URI
    ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_vendor_test?")
    : "mongodb://127.0.0.1:27017/buybox_vendor_test?replicaSet=rs0";

  jest.setTimeout(45000);

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    // 1. Customer User
    customerUser = await User.create({
      email: `test-cust-${Date.now()}@buybox.test`,
      password: await hashPassword("Password123!"),
      firstName: "Regular",
      lastName: "Customer",
      role: ROLES.CUSTOMER,
      isActive: true,
    });
    await Customer.create({ userId: customerUser._id });
    customerToken = generateAccessToken({
      sub: customerUser._id.toString(),
      id: customerUser._id.toString(),
      role: ROLES.CUSTOMER,
      roles: [ROLES.CUSTOMER],
      permissions: [PERMISSIONS.PRODUCTS_READ, PERMISSIONS.ORDERS_READ],
    });

    // 2. Vendor A User & Doc
    vendorAUser = await User.create({
      email: `test-vendora-${Date.now()}@buybox.test`,
      password: await hashPassword("Password123!"),
      firstName: "Vendor",
      lastName: "Alpha",
      role: ROLES.VENDOR,
      isActive: true,
    });
    vendorADoc = await Vendor.create({
      userId: vendorAUser._id,
      businessName: "Alpha Electronics",
      businessSlug: `alpha-elec-${Date.now()}`,
      onboardingStatus: "approved",
      isActive: true,
    });
    vendorAToken = generateAccessToken({
      sub: vendorAUser._id.toString(),
      id: vendorAUser._id.toString(),
      role: ROLES.VENDOR,
      roles: [ROLES.VENDOR],
      permissions: [
        PERMISSIONS.PRODUCTS_READ,
        PERMISSIONS.PRODUCTS_CREATE,
        PERMISSIONS.PRODUCTS_UPDATE,
        PERMISSIONS.INVENTORY_READ,
        PERMISSIONS.INVENTORY_MANAGE,
        PERMISSIONS.ORDERS_READ_OWN,
      ],
    });

    // 3. Vendor B User & Doc
    vendorBUser = await User.create({
      email: `test-vendorb-${Date.now()}@buybox.test`,
      password: await hashPassword("Password123!"),
      firstName: "Vendor",
      lastName: "Beta",
      role: ROLES.VENDOR,
      isActive: true,
    });
    vendorBDoc = await Vendor.create({
      userId: vendorBUser._id,
      businessName: "Beta Audio Labs",
      businessSlug: `beta-audio-${Date.now()}`,
      onboardingStatus: "approved",
      isActive: true,
    });
    vendorBToken = generateAccessToken({
      sub: vendorBUser._id.toString(),
      id: vendorBUser._id.toString(),
      role: ROLES.VENDOR,
      roles: [ROLES.VENDOR],
      permissions: [
        PERMISSIONS.PRODUCTS_READ,
        PERMISSIONS.PRODUCTS_CREATE,
        PERMISSIONS.PRODUCTS_UPDATE,
        PERMISSIONS.INVENTORY_READ,
        PERMISSIONS.INVENTORY_MANAGE,
        PERMISSIONS.ORDERS_READ_OWN,
      ],
    });

    // 4. Admin User & Employee record
    adminUser = await User.create({
      email: `test-admin-${Date.now()}@buybox.test`,
      password: await hashPassword("Password123!"),
      firstName: "System",
      lastName: "Administrator",
      role: ROLES.ADMIN,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    const adminEmployee = await Employee.create({
      userId: adminUser._id,
      employeeNumber: `EMP-${Date.now()}`,
      status: "active",
      jobTitle: "Platform Admin",
    });

    const roleSuffix = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const adminRole = await Role.create({
      name: `Admin Role ${roleSuffix}`,
      slug: `admin_${roleSuffix}`,
      description: "Full platform administration",
      isActive: true,
    });

    const permSlugs = [PERMISSIONS.VENDORS_READ, PERMISSIONS.VENDORS_MANAGE];
    for (const slug of permSlugs) {
      let perm = await Permission.findOne({ slug });
      if (!perm) {
        perm = await Permission.create({
          slug,
          name: slug,
          module: "vendors",
          description: slug,
          isActive: true,
        });
      }
      await RolePermission.create({
        roleId: adminRole._id,
        permissionId: perm._id,
      });
    }

    await EmployeeRole.create({
      employeeId: adminEmployee._id,
      roleId: adminRole._id,
      isActive: true,
    });

    adminToken = generateAccessToken({
      sub: adminUser._id.toString(),
      role: adminUser.role,
      authVersion: 1,
      permissionVersion: 1,
    });

    // 5. Warehouse
    testWarehouse = await Warehouse.create({
      name: "Bengaluru Central Fulfillment",
      code: `WH-BLR-${Date.now().toString().slice(-4)}`,
      address: {
        addressLine1: "Industrial Area, Peenya",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560058",
        country: "IN",
      },
      isActive: true,
    });

    // 6. Category & Brand
    testCategory = await Category.create({
      name: "Headphones & Audio",
      slug: `cat-audio-${Date.now()}`,
      isActive: true,
    });
    testBrand = await Brand.create({
      name: "Sennheiser",
      slug: `brand-senn-${Date.now()}`,
      isActive: true,
    });

    // 7. Product belonging to Vendor A
    productA = await Product.create({
      name: "Alpha Pro Noise Cancelling",
      slug: `alpha-pro-${Date.now()}`,
      description: "Audiophile headphones",
      sku: `SKU-AP-${Date.now()}`,
      categoryId: testCategory._id,
      brandId: testBrand._id,
      vendorId: vendorADoc._id,
      price: "14999.00",
      status: "active",
    });

    variantA = await ProductVariant.create({
      productId: productA._id,
      sku: `VAR-AP-${Date.now()}`,
      name: "Midnight Blue",
      price: "14999.00",
      currency: "INR",
      stockQuantity: 50,
    });
  });

  afterAll(async () => {
    try {
      await User.deleteMany({ email: { $regex: /@buybox\.test$/ } });
      await Customer.deleteMany({ userId: customerUser?._id });
      await Vendor.deleteMany({ _id: { $in: [vendorADoc?._id, vendorBDoc?._id].filter(Boolean) } });
      await Warehouse.deleteMany({ _id: testWarehouse?._id });
      await Category.deleteMany({ _id: testCategory?._id });
      await Brand.deleteMany({ _id: testBrand?._id });
      await Product.deleteMany({ _id: productA?._id });
      await ProductVariant.deleteMany({ _id: variantA?._id });
      await Inventory.deleteMany({ productVariantId: variantA?._id });
    } catch {
      // Best-effort cleanup
    }
  });

  // =========================================================================
  // 1. PUBLIC VENDOR REGISTRATION FLOW
  // =========================================================================
  describe("1. Public Vendor Registration Flow", () => {
    const regPayload = {
      email: `new-vendor-${Date.now()}@buybox.test`,
      password: "SecurePassword123!",
      firstName: "Merchant",
      lastName: "Partner",
      businessName: "Apex Retail Solutions",
      businessSlug: `apex-retail-${Date.now()}`,
      phone: "+919876543299",
      supportEmail: "support@apexretail.test",
      businessAddress: {
        addressLine1: "123 Commercial Plaza",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "IN",
      },
      taxInformation: {
        taxId: "27AAAAA0000A1Z5",
        taxType: "GSTIN",
      },
    };

    it("registers new vendor with explicit status PENDING and isActive FALSE", async () => {
      const res = await request(app)
        .post("/api/v1/vendors/register")
        .send(regPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe("vendor");
      expect(res.body.data.vendor.onboardingStatus).toBe("pending");
      expect(res.body.data.vendor.isActive).toBe(false);

      // Verify in Database
      const dbVendor = await Vendor.findById(res.body.data.vendor.id);
      expect(dbVendor).toBeTruthy();
      expect(dbVendor.onboardingStatus).toBe("pending");
      expect(dbVendor.isActive).toBe(false);

      // Cleanup
      await User.deleteOne({ _id: res.body.data.user.id });
      await Vendor.deleteOne({ _id: res.body.data.vendor.id });
    });

    it("rejects registration if email already exists", async () => {
      const res = await request(app)
        .post("/api/v1/vendors/register")
        .send({
          ...regPayload,
          email: customerUser.email, // existing email
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("EMAIL_ALREADY_EXISTS");
    });
  });

  // =========================================================================
  // 2. CUSTOMER -> VENDOR BOUNDARY CHECKS
  // =========================================================================
  describe("2. Customer -> Vendor Boundary Security", () => {
    it("forbids regular customer from accessing vendor self-profile", async () => {
      const res = await request(app)
        .get("/api/v1/vendors/me")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });

    it("forbids regular customer from accessing vendor order stream", async () => {
      const res = await request(app)
        .get("/api/v1/orders/vendor/my")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });

    it("forbids regular customer from creating warehouse resources", async () => {
      const res = await request(app)
        .post("/api/v1/warehouses")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          name: "Rogue Customer Warehouse",
          code: "ROGUE-01",
          address: {
            addressLine1: "Fake Address",
            city: "Delhi",
            state: "Delhi",
            postalCode: "110001",
            country: "IN",
          },
        });

      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // 3. VENDOR MULTI-TENANT ISOLATION & IDOR
  // =========================================================================
  describe("3. Vendor Multi-Tenant Isolation & IDOR", () => {
    it("prevents Vendor B from modifying inventory of Vendor A's product", async () => {
      // First, create inventory record for Variant A at testWarehouse
      const inventoryDoc = await Inventory.create({
        productVariantId: variantA._id,
        warehouseId: testWarehouse._id,
        onHand: 100,
        reserved: 0,
      });

      // 1. Vendor B attempts to create inventory record for Vendor A's product variant
      const res = await request(app)
        .post("/api/v1/inventory")
        .set("Authorization", `Bearer ${vendorBToken}`)
        .send({
          productVariantId: variantA._id.toString(),
          warehouseId: testWarehouse._id.toString(),
          onHand: 25,
          lowStockThreshold: 5,
        });

      // Must be denied with 403 INVENTORY_ACCESS_DENIED
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INVENTORY_ACCESS_DENIED");

      // 2. Vendor B attempts to adjust stock of Vendor A's inventory
      const adjustRes = await request(app)
        .patch(`/api/v1/inventory/${inventoryDoc._id}/adjust`)
        .set("Authorization", `Bearer ${vendorBToken}`)
        .send({
          quantity: 10,
        });

      expect(adjustRes.status).toBe(403);
      expect(adjustRes.body.code).toBe("INVENTORY_ACCESS_DENIED");

      await Inventory.deleteOne({ _id: inventoryDoc._id });
    });
  });

  // =========================================================================
  // 4. ADMIN VENDOR GOVERNANCE & STATUS LIFECYCLE
  // =========================================================================
  describe("4. Admin Vendor Governance & Status Transitions", () => {
    it("allows admin to view all vendors and approve a pending vendor", async () => {
      // Create a pending vendor for testing
      const pendingUser = await User.create({
        email: `pending-vend-${Date.now()}@buybox.test`,
        password: await hashPassword("Password123!"),
        firstName: "Test",
        lastName: "Pending",
        role: ROLES.VENDOR,
        isActive: true,
      });

      const pendingVendor = await Vendor.create({
        userId: pendingUser._id,
        businessName: "Awaiting Verification LLC",
        businessSlug: `awaiting-verif-${Date.now()}`,
        onboardingStatus: "pending",
        isActive: false,
      });

      // 1. Admin lists vendors
      const listRes = await request(app)
        .get("/api/v1/vendors")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.vendors.length).toBeGreaterThanOrEqual(1);

      // 2. Admin approves pending vendor
      const approveRes = await request(app)
        .patch(`/api/v1/vendors/${pendingVendor._id}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          onboardingStatus: "approved",
        });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.vendor.onboardingStatus).toBe("approved");
      expect(approveRes.body.data.vendor.isActive).toBe(true);

      // Cleanup
      await User.deleteOne({ _id: pendingUser._id });
      await Vendor.deleteOne({ _id: pendingVendor._id });
    });
  });
});
