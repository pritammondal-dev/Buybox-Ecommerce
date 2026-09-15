const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Employee = require("../src/models/Employee");
const Customer = require("../src/models/Customer");
const Vendor = require("../src/models/Vendor");
const Category = require("../src/models/Category");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Order = require("../src/models/Order");
const Warehouse = require("../src/models/Warehouse");
const AuditLog = require("../src/models/AuditLog");
const Role = require("../src/models/Role");
const Permission = require("../src/models/Permission");
const RolePermission = require("../src/models/RolePermission");
const EmployeeRole = require("../src/models/EmployeeRole");
const EmployeePermissionGrant = require("../src/models/EmployeePermissionGrant");
const EmployeePermissionRestriction = require("../src/models/EmployeePermissionRestriction");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const { generateAccessToken } = require("../src/services/token.service");
const {
  incrementAuthVersion,
  incrementPermissionVersion,
} = require("../src/services/authorization.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_phase3b_test?")
  : "mongodb://127.0.0.1:27017/buybox_phase3b_test?replicaSet=rs0";

describe("Buybox Phase 3B — Vendor Product Lifecycle, Approval & Order Isolation", () => {
  let createdPermissions = new Map();
  let testCategory;
  let testWarehouse;

  // Helper to ensure permissions exist in DB
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
        { upsert: true, returnDocument: "after" }
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

  // Helper to create test employee
  async function createTestEmployee(options = {}) {
    const status = options.status || "active";
    const user = await User.create({
      firstName: "Staff",
      lastName: "Tester",
      email: `staff_${Date.now()}_${Math.random().toString(36).substring(7)}@test-phase3b.com`,
      password: "Password123!",
      role: options.userRole || ROLES.MANAGER,
      isActive: options.isActive !== undefined ? options.isActive : true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const employee = await Employee.create({
      userId: user._id,
      employeeNumber: `EMP_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`,
      jobTitle: options.jobTitle || "Content Moderator",
      department: "Catalog Operations",
      status,
    });

    const token = generateAccessToken({
      sub: user._id.toString(),
      role: user.role,
      authVersion: user.authVersion,
      permissionVersion: user.permissionVersion,
    });

    return { user, employee, token };
  }

  // Helper to create test vendor
  async function createTestVendor(options = {}) {
    const user = await User.create({
      firstName: options.firstName || "Vendor",
      lastName: "User",
      email: `vendor_${Date.now()}_${Math.random().toString(36).substring(7)}@test-phase3b.com`,
      password: "Password123!",
      role: ROLES.VENDOR,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const vendor = await Vendor.create({
      userId: user._id,
      businessName: options.businessName || `Vendor Corp ${Date.now()}-${Math.random().toString(36).substring(7)}`,
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

  // Helper to create test customer
  async function createTestCustomer() {
    const user = await User.create({
      firstName: "Customer",
      lastName: "User",
      email: `customer_${Date.now()}_${Math.random().toString(36).substring(7)}@test-phase3b.com`,
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

  // Helper to create product
  async function createTestProduct(vendorId, overrides = {}) {
    return Product.create({
      name: overrides.name || `Product ${Date.now()}-${Math.random().toString(36).substring(7)}`,
      slug: overrides.slug || `product-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      sku: overrides.sku || `SKU-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`,
      categoryId: testCategory._id,
      vendorId,
      price: overrides.price || mongoose.Types.Decimal128.fromString("199.99"),
      currency: "INR",
      status: overrides.status || "draft",
      submittedAt: overrides.submittedAt || null,
      approvedAt: overrides.approvedAt || null,
      rejectedAt: overrides.rejectedAt || null,
      moderatedBy: overrides.moderatedBy || null,
      rejectionReason: overrides.rejectionReason || null,
    });
  }

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    testCategory = await Category.create({
      name: `Category ${Date.now()}`,
      slug: `category-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      isActive: true,
    });

    testWarehouse = await Warehouse.create({
      name: `WH-${Date.now()}`,
      code: `WH-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`,
      address: {
        addressLine1: "123 Hub St",
        city: "Bangalore",
        state: "Karnataka",
        postalCode: "560001",
        country: "IN",
      },
      isActive: true,
    });
  });

  afterAll(async () => {
    await Category.deleteMany({ _id: testCategory._id });
    await Warehouse.deleteMany({ _id: testWarehouse._id });
    await mongoose.connection.close();
  });

  // ==========================================
  // PART 1: PRODUCT LIFECYCLE & APPROVAL TESTS
  // ==========================================
  describe("PART 1: Product Approval Workflow & Vendor Product Listing", () => {
    let vendorA, vendorB, moderatorStaff;

    beforeAll(async () => {
      vendorA = await createTestVendor({ businessName: "Alpha Supplies" });
      vendorB = await createTestVendor({ businessName: "Beta Logistics" });

      moderatorStaff = await createTestEmployee();
      await assignRoleWithPermissions(
        moderatorStaff.employee._id,
        "role_catalog_moderator",
        [PERMISSIONS.PRODUCTS_MODERATE, PERMISSIONS.PRODUCTS_READ]
      );
    });

    it("1. Vendor creates draft product (status is forced to draft)", async () => {
      const res = await request(app)
        .post("/api/v1/products")
        .set("Authorization", `Bearer ${vendorA.token}`)
        .send({
          name: "Alpha Organic Soap",
          slug: `alpha-soap-${Date.now()}`,
          sku: `SKU-SOAP-${Date.now()}`,
          categoryId: testCategory._id.toString(),
          price: "150.00",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.product.status).toBe("draft");
      expect(res.body.data.product.submittedAt).toBeNull();
      expect(res.body.data.product.approvedAt).toBeNull();
    });

    it("2. Vendor cannot directly create active product (status: active payload is forced to draft)", async () => {
      const res = await request(app)
        .post("/api/v1/products")
        .set("Authorization", `Bearer ${vendorA.token}`)
        .send({
          name: "Alpha Bypass Soap",
          slug: `alpha-bypass-${Date.now()}`,
          sku: `SKU-BYPASS-${Date.now()}`,
          categoryId: testCategory._id.toString(),
          price: "200.00",
          status: "active", // attempted direct activation
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.product.status).toBe("draft"); // server strictly forced draft
    });

    it("3. Vendor sees own draft product in GET /api/v1/products/vendor/my", async () => {
      const prodA = await createTestProduct(vendorA.vendor._id, { status: "draft" });

      const res = await request(app)
        .get("/api/v1/products/vendor/my")
        .set("Authorization", `Bearer ${vendorA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      const found = res.body.data.find((p) => p._id.toString() === prodA._id.toString());
      expect(found).toBeDefined();
      expect(found.status).toBe("draft");
    });

    it("4. Vendor does not see another Vendor's draft in GET /api/v1/products/vendor/my", async () => {
      const prodB = await createTestProduct(vendorB.vendor._id, { status: "draft" });

      const res = await request(app)
        .get("/api/v1/products/vendor/my")
        .set("Authorization", `Bearer ${vendorA.token}`);

      expect(res.status).toBe(200);
      const found = res.body.data.find((p) => p._id.toString() === prodB._id.toString());
      expect(found).toBeUndefined();
    });

    it("5. Vendor submits own draft product for approval (draft -> pending_approval)", async () => {
      const prod = await createTestProduct(vendorA.vendor._id, { status: "draft" });

      const res = await request(app)
        .post(`/api/v1/products/${prod._id}/submit`)
        .set("Authorization", `Bearer ${vendorA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.product.status).toBe("pending_approval");
      expect(res.body.data.product.submittedAt).not.toBeNull();
    });

    it("6. Vendor cannot submit another Vendor's product (403 PRODUCT_OWNERSHIP_REQUIRED)", async () => {
      const prodB = await createTestProduct(vendorB.vendor._id, { status: "draft" });

      const res = await request(app)
        .post(`/api/v1/products/${prodB._id}/submit`)
        .set("Authorization", `Bearer ${vendorA.token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("PRODUCT_OWNERSHIP_REQUIRED");
    });

    it("7. Vendor cannot approve product (403 INSUFFICIENT_PERMISSIONS)", async () => {
      const prod = await createTestProduct(vendorA.vendor._id, { status: "pending_approval" });

      const res = await request(app)
        .patch(`/api/v1/products/${prod._id}/approve`)
        .set("Authorization", `Bearer ${vendorA.token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("8. Vendor cannot reject product (403 INSUFFICIENT_PERMISSIONS)", async () => {
      const prod = await createTestProduct(vendorA.vendor._id, { status: "pending_approval" });

      const res = await request(app)
        .patch(`/api/v1/products/${prod._id}/reject`)
        .set("Authorization", `Bearer ${vendorA.token}`)
        .send({ reason: "Self rejection" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("9. Platform employee with products:moderate approves product (pending_approval -> active)", async () => {
      const prod = await createTestProduct(vendorA.vendor._id, { status: "pending_approval" });

      const res = await request(app)
        .patch(`/api/v1/products/${prod._id}/approve`)
        .set("Authorization", `Bearer ${moderatorStaff.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.product.status).toBe("active");
      expect(res.body.data.product.approvedAt).not.toBeNull();
      expect(res.body.data.product.moderatedBy.toString()).toBe(moderatorStaff.user._id.toString());
    });

    it("10. Platform employee with products:moderate rejects product (pending_approval -> rejected)", async () => {
      const prod = await createTestProduct(vendorA.vendor._id, { status: "pending_approval" });

      const res = await request(app)
        .patch(`/api/v1/products/${prod._id}/reject`)
        .set("Authorization", `Bearer ${moderatorStaff.token}`)
        .send({ reason: "Inadequate description and low resolution images" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.product.status).toBe("rejected");
      expect(res.body.data.product.rejectedAt).not.toBeNull();
      expect(res.body.data.product.rejectionReason).toBe("Inadequate description and low resolution images");
    });

    it("11. Reject requires reason (400 validation error on missing/empty reason)", async () => {
      const prod = await createTestProduct(vendorA.vendor._id, { status: "pending_approval" });

      const res = await request(app)
        .patch(`/api/v1/products/${prod._id}/reject`)
        .set("Authorization", `Bearer ${moderatorStaff.token}`)
        .send({ reason: "" });

      expect(res.status).toBe(400);
    });

    it("12. Vendor can resubmit rejected product (rejected -> pending_approval)", async () => {
      const prod = await createTestProduct(vendorA.vendor._id, {
        status: "rejected",
        rejectionReason: "Previous rejection",
      });

      const res = await request(app)
        .post(`/api/v1/products/${prod._id}/submit`)
        .set("Authorization", `Bearer ${vendorA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.product.status).toBe("pending_approval");
      expect(res.body.data.product.rejectionReason).toBeNull();
    });

    it("13. Approval metadata is server-controlled and cannot be set directly by vendor via update", async () => {
      const prod = await createTestProduct(vendorA.vendor._id, { status: "draft" });

      const fakeUserId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .patch(`/api/v1/products/${prod._id}`)
        .set("Authorization", `Bearer ${vendorA.token}`)
        .send({
          name: "Updated Name",
          approvedAt: new Date(),
          moderatedBy: fakeUserId.toString(),
          rejectionReason: "Fake reason",
        });

      // Strict schema validation does not accept approval metadata from client payloads
      expect(res.status).toBe(400);
      const updated = await Product.findById(prod._id);
      expect(updated.name).toBe(prod.name); // unchanged
      expect(updated.approvedAt).toBeNull();
      expect(updated.moderatedBy).toBeNull();
      expect(updated.rejectionReason).toBeNull();
    });

    it("14. Vendor cannot directly activate product via PATCH /products/:id (403 DIRECT_ACTIVATION_FORBIDDEN)", async () => {
      const prod = await createTestProduct(vendorA.vendor._id, { status: "draft" });

      const res = await request(app)
        .patch(`/api/v1/products/${prod._id}`)
        .set("Authorization", `Bearer ${vendorA.token}`)
        .send({
          status: "active",
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("DIRECT_ACTIVATION_FORBIDDEN");
    });

    it("15. Public storefront excludes pending and rejected products", async () => {
      const pendingProd = await createTestProduct(vendorA.vendor._id, {
        status: "pending_approval",
        slug: `pending-prod-${Date.now()}`,
      });
      const rejectedProd = await createTestProduct(vendorA.vendor._id, {
        status: "rejected",
        slug: `rejected-prod-${Date.now()}`,
      });

      // 15a. Public list
      const listRes = await request(app).get("/api/v1/products");
      expect(listRes.status).toBe(200);
      const items = listRes.body.data;
      expect(items.some((p) => p._id.toString() === pendingProd._id.toString())).toBe(false);
      expect(items.some((p) => p._id.toString() === rejectedProd._id.toString())).toBe(false);

      // 15b. Public by ID
      const pendingGetRes = await request(app).get(`/api/v1/products/${pendingProd._id}`);
      expect(pendingGetRes.status).toBe(404);

      // 15c. Public by Slug
      const rejectedSlugRes = await request(app).get(`/api/v1/products/slug/${rejectedProd.slug}`);
      expect(rejectedSlugRes.status).toBe(404);
    });

    it("16. Approved active product becomes publicly visible", async () => {
      const activeProd = await createTestProduct(vendorA.vendor._id, {
        status: "active",
        slug: `public-prod-${Date.now()}`,
      });

      const getRes = await request(app).get(`/api/v1/products/${activeProd._id}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.product._id.toString()).toBe(activeProd._id.toString());
    });

    it("17. Immutable AuditLog records are created for submission, approval, and rejection", async () => {
      const prod = await createTestProduct(vendorA.vendor._id, { status: "draft" });

      // Submit
      await request(app)
        .post(`/api/v1/products/${prod._id}/submit`)
        .set("Authorization", `Bearer ${vendorA.token}`);

      const submitLog = await AuditLog.findOne({
        targetId: prod._id,
        action: "product_submitted",
      });
      expect(submitLog).not.toBeNull();
      expect(submitLog.entityType).toBe("product");

      // Approve
      await request(app)
        .patch(`/api/v1/products/${prod._id}/approve`)
        .set("Authorization", `Bearer ${moderatorStaff.token}`);

      const approveLog = await AuditLog.findOne({
        targetId: prod._id,
        action: "product_approved",
      });
      expect(approveLog).not.toBeNull();
      expect(approveLog.actorId.toString()).toBe(moderatorStaff.user._id.toString());
    });
  });

  // ==========================================
  // PART 2: PRODUCT VARIANT COMPATIBILITY
  // ==========================================
  describe("PART 2: ProductVariant Compatibility", () => {
    let vendorA, vendorB;

    beforeAll(async () => {
      vendorA = await createTestVendor({ businessName: "Variant Vendor A" });
      vendorB = await createTestVendor({ businessName: "Variant Vendor B" });
    });

    it("18. Vendor cannot mutate a ProductVariant belonging to another Vendor's product", async () => {
      const prodB = await createTestProduct(vendorB.vendor._id, { status: "active" });
      const variantB = await ProductVariant.create({
        productId: prodB._id,
        sku: `SKU-VAR-${Date.now()}`,
        name: "Size M",
        price: mongoose.Types.Decimal128.fromString("99.99"),
        stock: 10,
        options: { size: "M" },
      });

      const res = await request(app)
        .patch(`/api/v1/product-variants/${variantB._id}`)
        .set("Authorization", `Bearer ${vendorA.token}`)
        .send({ price: "50.00" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("PRODUCT_OWNERSHIP_REQUIRED");
    });
  });

  // ==========================================
  // PART 3: VENDOR ORDER ISOLATION & PROJECTION
  // ==========================================
  describe("PART 3: Multi-Vendor Order Isolation & Projection", () => {
    let vendorA, vendorB, customer;
    let orderAOnly, orderBOnly, mixedOrder;

    beforeAll(async () => {
      vendorA = await createTestVendor({ businessName: "Merchant Alpha" });
      vendorB = await createTestVendor({ businessName: "Merchant Beta" });
      customer = await createTestCustomer();

      const prodA1 = await createTestProduct(vendorA.vendor._id, { status: "active", price: mongoose.Types.Decimal128.fromString("100.00") });
      const prodA2 = await createTestProduct(vendorA.vendor._id, { status: "active", price: mongoose.Types.Decimal128.fromString("50.00") });
      const prodB1 = await createTestProduct(vendorB.vendor._id, { status: "active", price: mongoose.Types.Decimal128.fromString("300.00") });

      const varA1 = await ProductVariant.create({
        productId: prodA1._id,
        sku: `VAR-A1-${Date.now()}`,
        name: "A1 Var",
        price: mongoose.Types.Decimal128.fromString("100.00"),
        stock: 50,
      });

      const varA2 = await ProductVariant.create({
        productId: prodA2._id,
        sku: `VAR-A2-${Date.now()}`,
        name: "A2 Var",
        price: mongoose.Types.Decimal128.fromString("50.00"),
        stock: 50,
      });

      const varB1 = await ProductVariant.create({
        productId: prodB1._id,
        sku: `VAR-B1-${Date.now()}`,
        name: "B1 Var",
        price: mongoose.Types.Decimal128.fromString("300.00"),
        stock: 50,
      });

      // 1. Order containing ONLY Vendor A items
      orderAOnly = await Order.create({
        orderNumber: `ORD-A-${Date.now()}`,
        customerId: customer.customer._id,
        status: "confirmed",
        currency: "INR",
        items: [
          {
            productId: prodA1._id,
            productVariantId: varA1._id,
            warehouseId: testWarehouse._id,
            vendorId: vendorA.vendor._id,
            sku: varA1.sku,
            productName: prodA1.name,
            quantity: 2,
            unitPrice: mongoose.Types.Decimal128.fromString("100.00"),
            discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
            taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("200.00"),
            currency: "INR",
            inventoryStatus: "reserved",
          },
        ],
        subtotal: mongoose.Types.Decimal128.fromString("200.00"),
        grandTotal: mongoose.Types.Decimal128.fromString("200.00"),
        shippingAddress: {
          fullName: "Alice Buyer",
          phone: "9876543210",
          addressLine1: "100 Customer Lane",
          city: "Mumbai",
          state: "Maharashtra",
          postalCode: "400001",
          country: "IN",
        },
      });

      // 2. Order containing ONLY Vendor B items
      orderBOnly = await Order.create({
        orderNumber: `ORD-B-${Date.now()}`,
        customerId: customer.customer._id,
        status: "confirmed",
        currency: "INR",
        items: [
          {
            productId: prodB1._id,
            productVariantId: varB1._id,
            warehouseId: testWarehouse._id,
            vendorId: vendorB.vendor._id,
            sku: varB1.sku,
            productName: prodB1.name,
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("300.00"),
            discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
            taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("300.00"),
            currency: "INR",
            inventoryStatus: "reserved",
          },
        ],
        subtotal: mongoose.Types.Decimal128.fromString("300.00"),
        grandTotal: mongoose.Types.Decimal128.fromString("300.00"),
        shippingAddress: {
          fullName: "Bob Buyer",
          phone: "9876543211",
          addressLine1: "200 Buyer Blvd",
          city: "Delhi",
          state: "Delhi",
          postalCode: "110001",
          country: "IN",
        },
      });

      // 3. Mixed order containing BOTH Vendor A and Vendor B items
      mixedOrder = await Order.create({
        orderNumber: `ORD-MIXED-${Date.now()}`,
        customerId: customer.customer._id,
        status: "processing",
        fulfillmentStatus: "partially_fulfilled",
        currency: "INR",
        items: [
          {
            productId: prodA2._id,
            productVariantId: varA2._id,
            warehouseId: testWarehouse._id,
            vendorId: vendorA.vendor._id,
            sku: varA2.sku,
            productName: prodA2.name,
            quantity: 3,
            unitPrice: mongoose.Types.Decimal128.fromString("50.00"),
            discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
            taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("150.00"),
            currency: "INR",
            inventoryStatus: "reserved",
          },
          {
            productId: prodB1._id,
            productVariantId: varB1._id,
            warehouseId: testWarehouse._id,
            vendorId: vendorB.vendor._id,
            sku: varB1.sku,
            productName: prodB1.name,
            quantity: 2,
            unitPrice: mongoose.Types.Decimal128.fromString("300.00"),
            discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
            taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("600.00"),
            currency: "INR",
            inventoryStatus: "reserved",
          },
        ],
        subtotal: mongoose.Types.Decimal128.fromString("750.00"),
        grandTotal: mongoose.Types.Decimal128.fromString("750.00"),
        idempotencyKey: "secret-key-123",
        idempotencyFingerprint: "fingerprint-xyz",
        shippingAddress: {
          fullName: "Charlie Buyer",
          phone: "9876543212",
          addressLine1: "300 Commerce Way",
          city: "Chennai",
          state: "Tamil Nadu",
          postalCode: "600001",
          country: "IN",
        },
      });
    });

    it("19. Vendor A sees orders containing Vendor A items via GET /api/v1/orders/vendor/my", async () => {
      const res = await request(app)
        .get("/api/v1/orders/vendor/my")
        .set("Authorization", `Bearer ${vendorA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const orderIds = res.body.data.map((o) => o._id.toString());
      expect(orderIds).toContain(orderAOnly._id.toString());
      expect(orderIds).toContain(mixedOrder._id.toString());
      expect(orderIds).not.toContain(orderBOnly._id.toString()); // Vendor B-only order completely omitted
    });

    it("20. Vendor B sees orders containing Vendor B items via GET /api/v1/orders/vendor/my", async () => {
      const res = await request(app)
        .get("/api/v1/orders/vendor/my")
        .set("Authorization", `Bearer ${vendorB.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const orderIds = res.body.data.map((o) => o._id.toString());
      expect(orderIds).toContain(orderBOnly._id.toString());
      expect(orderIds).toContain(mixedOrder._id.toString());
      expect(orderIds).not.toContain(orderAOnly._id.toString()); // Vendor A-only order completely omitted
    });

    it("21. Vendor A requesting Vendor B-only order returns 404 ORDER_NOT_FOUND (no order existence leak)", async () => {
      const res = await request(app)
        .get(`/api/v1/orders/vendor/my/${orderBOnly._id}`)
        .set("Authorization", `Bearer ${vendorA.token}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("ORDER_NOT_FOUND");
    });

    it("22. Mixed A+B order returns ONLY Vendor A items to Vendor A", async () => {
      const res = await request(app)
        .get(`/api/v1/orders/vendor/my/${mixedOrder._id}`)
        .set("Authorization", `Bearer ${vendorA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const order = res.body.data;

      expect(order.items).toHaveLength(1);
      expect(order.items[0].vendorId.toString()).toBe(vendorA.vendor._id.toString());
      expect(order.itemCount).toBe(3); // 3 units of Prod A2
      expect(order.subtotal).toBe("150.00"); // Only Vendor A's items subtotal!
    });

    it("23. Mixed A+B order returns ONLY Vendor B items to Vendor B", async () => {
      const res = await request(app)
        .get(`/api/v1/orders/vendor/my/${mixedOrder._id}`)
        .set("Authorization", `Bearer ${vendorB.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const order = res.body.data;

      expect(order.items).toHaveLength(1);
      expect(order.items[0].vendorId.toString()).toBe(vendorB.vendor._id.toString());
      expect(order.itemCount).toBe(2); // 2 units of Prod B1
      expect(order.subtotal).toBe("600.00"); // Only Vendor B's items subtotal!
    });

    it("24. Vendor A cannot infer Vendor B items or platform totals from response", async () => {
      const res = await request(app)
        .get(`/api/v1/orders/vendor/my/${mixedOrder._id}`)
        .set("Authorization", `Bearer ${vendorA.token}`);

      expect(res.status).toBe(200);
      const order = res.body.data;

      // Ensure platform totals that include Vendor B's items are absent
      expect(order.grandTotal).toBeUndefined();
      expect(order.totalTax).toBeUndefined();
      expect(order.taxSnapshot).toBeUndefined();
      expect(order.shippingTotal).toBeUndefined();

      // Ensure payment secrets are absent
      expect(order.idempotencyKey).toBeUndefined();
      expect(order.idempotencyFingerprint).toBeUndefined();
      expect(order.cancellationStatus).toBeUndefined();
    });

    it("25. Customer fulfillment info is minimized to shipping address required for delivery", async () => {
      const res = await request(app)
        .get(`/api/v1/orders/vendor/my/${mixedOrder._id}`)
        .set("Authorization", `Bearer ${vendorA.token}`);

      expect(res.status).toBe(200);
      const { shippingAddress } = res.body.data;
      expect(shippingAddress).toBeDefined();
      expect(shippingAddress.fullName).toBe("Charlie Buyer");
      expect(shippingAddress.phone).toBe("9876543212");
      expect(shippingAddress.addressLine1).toBe("300 Commerce Way");
      expect(shippingAddress.city).toBe("Chennai");
      expect(shippingAddress.state).toBe("Tamil Nadu");
      expect(shippingAddress.postalCode).toBe("600001");
    });

    it("26. Customer order APIs remain unchanged and strictly customer-scoped", async () => {
      const res = await request(app)
        .get("/api/v1/orders")
        .set("Authorization", `Bearer ${customer.token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      // Customer sees their orders
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    });

    it("27. Status filter works correctly and cannot bypass vendor filtering", async () => {
      const res = await request(app)
        .get("/api/v1/orders/vendor/my?status=processing")
        .set("Authorization", `Bearer ${vendorA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]._id.toString()).toBe(mixedOrder._id.toString());
    });

    it("28. Pagination works correctly and cannot bypass vendor filtering", async () => {
      const res = await request(app)
        .get("/api/v1/orders/vendor/my?page=1&limit=1")
        .set("Authorization", `Bearer ${vendorA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(2);
      expect(res.body.meta.totalPages).toBe(2);
    });

    it("29. Employee with direct grant of orders:read_own can access vendor order API (with vendor profile)", async () => {
      // Create user with both vendor profile and employee profile
      const vendorUser = await User.create({
        firstName: "Dual",
        lastName: "VendorStaff",
        email: `dual_${Date.now()}@test-phase3b.com`,
        password: "Password123!",
        role: "customer", // no role-based permission
        isActive: true,
        authVersion: 1,
        permissionVersion: 1,
      });

      await Vendor.create({
        userId: vendorUser._id,
        businessName: "Dual Role Vendor",
        businessSlug: `dual-role-${Date.now()}`,
        isActive: true,
        onboardingStatus: "approved",
      });

      const emp = await Employee.create({
        userId: vendorUser._id,
        employeeNumber: `EMP_DUAL_${Date.now()}`,
        jobTitle: "Vendor Representative",
        department: "Vendor Ops",
        status: "active",
      });

      const perm = await getOrCreatePermission(PERMISSIONS.ORDERS_READ_OWN);
      await EmployeePermissionGrant.create({
        employeeId: emp._id,
        permissionId: perm._id,
        isRevoked: false,
        expiresAt: null,
      });

      const token = generateAccessToken({
        sub: vendorUser._id.toString(),
        role: vendorUser.role,
        authVersion: 1,
        permissionVersion: 1,
      });

      const res = await request(app)
        .get("/api/v1/orders/vendor/my")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("30. Direct restriction on orders:read_own denies vendor-order access", async () => {
      const user = await User.create({
        firstName: "Restricted",
        lastName: "Vendor",
        email: `restricted_${Date.now()}@test-phase3b.com`,
        password: "Password123!",
        role: ROLES.VENDOR,
        isActive: true,
        authVersion: 1,
        permissionVersion: 1,
      });

      await Vendor.create({
        userId: user._id,
        businessName: "Restricted Corp",
        businessSlug: `restricted-${Date.now()}`,
        isActive: true,
        onboardingStatus: "approved",
      });

      const emp = await Employee.create({
        userId: user._id,
        employeeNumber: `EMP_REST_${Date.now()}`,
        jobTitle: "Vendor Rep",
        department: "Vendor Ops",
        status: "active",
      });

      const perm = await getOrCreatePermission(PERMISSIONS.ORDERS_READ_OWN);
      await EmployeePermissionRestriction.create({
        employeeId: emp._id,
        permissionId: perm._id,
        isActive: true,
        expiresAt: null,
      });

      const token = generateAccessToken({
        sub: user._id.toString(),
        role: user.role,
        authVersion: 1,
        permissionVersion: 1,
      });

      const res = await request(app)
        .get("/api/v1/orders/vendor/my")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("31. Expired direct grant of orders:read_own denies access", async () => {
      const user = await User.create({
        firstName: "Expired",
        lastName: "Grant",
        email: `expired_${Date.now()}@test-phase3b.com`,
        password: "Password123!",
        role: "customer",
        isActive: true,
        authVersion: 1,
        permissionVersion: 1,
      });

      await Vendor.create({
        userId: user._id,
        businessName: "Expired Grant Corp",
        businessSlug: `expired-${Date.now()}`,
        isActive: true,
        onboardingStatus: "approved",
      });

      const emp = await Employee.create({
        userId: user._id,
        employeeNumber: `EMP_EXP_${Date.now()}`,
        jobTitle: "Vendor Rep",
        department: "Vendor Ops",
        status: "active",
      });

      const perm = await getOrCreatePermission(PERMISSIONS.ORDERS_READ_OWN);
      await EmployeePermissionGrant.create({
        employeeId: emp._id,
        permissionId: perm._id,
        isRevoked: false,
        expiresAt: new Date(Date.now() - 3600000), // expired 1 hr ago
      });

      const token = generateAccessToken({
        sub: user._id.toString(),
        role: user.role,
        authVersion: 1,
        permissionVersion: 1,
      });

      const res = await request(app)
        .get("/api/v1/orders/vendor/my")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("32. Suspended employee with role granting orders:read_own is denied", async () => {
      const user = await User.create({
        firstName: "Suspended",
        lastName: "Staff",
        email: `suspended_${Date.now()}@test-phase3b.com`,
        password: "Password123!",
        role: "customer",
        isActive: true,
        authVersion: 1,
        permissionVersion: 1,
      });

      await Vendor.create({
        userId: user._id,
        businessName: "Suspended Vendor",
        businessSlug: `suspended-${Date.now()}`,
        isActive: true,
        onboardingStatus: "approved",
      });

      const emp = await Employee.create({
        userId: user._id,
        employeeNumber: `EMP_SUS_${Date.now()}`,
        jobTitle: "Rep",
        department: "Ops",
        status: "suspended", // Suspended!
      });

      await assignRoleWithPermissions(emp._id, "role_suspended_grant", [PERMISSIONS.ORDERS_READ_OWN]);

      const token = generateAccessToken({
        sub: user._id.toString(),
        role: user.role,
        authVersion: 1,
        permissionVersion: 1,
      });

      const res = await request(app)
        .get("/api/v1/orders/vendor/my")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("33. Terminated employee with role granting orders:read_own is denied", async () => {
      const user = await User.create({
        firstName: "Terminated",
        lastName: "Staff",
        email: `terminated_${Date.now()}@test-phase3b.com`,
        password: "Password123!",
        role: "customer",
        isActive: true,
        authVersion: 1,
        permissionVersion: 1,
      });

      await Vendor.create({
        userId: user._id,
        businessName: "Terminated Vendor",
        businessSlug: `terminated-${Date.now()}`,
        isActive: true,
        onboardingStatus: "approved",
      });

      const emp = await Employee.create({
        userId: user._id,
        employeeNumber: `EMP_TERM_${Date.now()}`,
        jobTitle: "Rep",
        department: "Ops",
        status: "terminated", // Terminated!
      });

      await assignRoleWithPermissions(emp._id, "role_terminated_grant", [PERMISSIONS.ORDERS_READ_OWN]);

      const token = generateAccessToken({
        sub: user._id.toString(),
        role: user.role,
        authVersion: 1,
        permissionVersion: 1,
      });

      const res = await request(app)
        .get("/api/v1/orders/vendor/my")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("34. Stale permissionVersion dynamically re-resolves from DB", async () => {
      const user = await User.create({
        firstName: "StalePerm",
        lastName: "Vendor",
        email: `stale_perm_${Date.now()}@test-phase3b.com`,
        password: "Password123!",
        role: "customer", // token created before role assignment
        isActive: true,
        authVersion: 1,
        permissionVersion: 1,
      });

      await Vendor.create({
        userId: user._id,
        businessName: "Stale Perm Corp",
        businessSlug: `stale-perm-${Date.now()}`,
        isActive: true,
        onboardingStatus: "approved",
      });

      const emp = await Employee.create({
        userId: user._id,
        employeeNumber: `EMP_STALE_${Date.now()}`,
        jobTitle: "Rep",
        department: "Ops",
        status: "active",
      });

      // Token issued with permissionVersion: 1
      const token = generateAccessToken({
        sub: user._id.toString(),
        role: user.role,
        authVersion: 1,
        permissionVersion: 1,
      });

      // Role assigned in DB and permissionVersion bumped in DB
      await assignRoleWithPermissions(emp._id, "role_stale_assigned", [PERMISSIONS.ORDERS_READ_OWN]);
      await incrementPermissionVersion(user._id);

      // Request with stale token succeeds because DB resolves fresh permissions
      const res = await request(app)
        .get("/api/v1/orders/vendor/my")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("35. Stale authVersion rejects with 401 AUTH_VERSION_MISMATCH", async () => {
      const user = await User.create({
        firstName: "StaleAuth",
        lastName: "Vendor",
        email: `stale_auth_${Date.now()}@test-phase3b.com`,
        password: "Password123!",
        role: ROLES.VENDOR,
        isActive: true,
        authVersion: 1,
        permissionVersion: 1,
      });

      await Vendor.create({
        userId: user._id,
        businessName: "Stale Auth Corp",
        businessSlug: `stale-auth-${Date.now()}`,
        isActive: true,
        onboardingStatus: "approved",
      });

      const token = generateAccessToken({
        sub: user._id.toString(),
        role: user.role,
        authVersion: 1,
        permissionVersion: 1,
      });

      // Auth version bumped in DB (e.g. password changed or logged out all)
      await incrementAuthVersion(user._id);

      const res = await request(app)
        .get("/api/v1/orders/vendor/my")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("AUTH_VERSION_MISMATCH");
    });

    it("36. Super Admin retains access to product moderation via dynamic authorization", async () => {
      const superAdminUser = await User.create({
        firstName: "Super",
        lastName: "Admin",
        email: `super_admin_${Date.now()}@test-phase3b.com`,
        password: "Password123!",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        authVersion: 1,
        permissionVersion: 1,
      });

      const superToken = generateAccessToken({
        sub: superAdminUser._id.toString(),
        role: superAdminUser.role,
        authVersion: 1,
        permissionVersion: 1,
      });

      const prod = await createTestProduct(vendorA.vendor._id, { status: "pending_approval" });

      const res = await request(app)
        .patch(`/api/v1/products/${prod._id}/approve`)
        .set("Authorization", `Bearer ${superToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.product.status).toBe("active");
    });
  });
});
