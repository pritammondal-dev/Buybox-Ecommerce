const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");

const User = require("../src/models/User");
const Employee = require("../src/models/Employee");
const Customer = require("../src/models/Customer");
const Vendor = require("../src/models/Vendor");
const Category = require("../src/models/Category");
const Brand = require("../src/models/Brand");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Inventory = require("../src/models/Inventory");
const Warehouse = require("../src/models/Warehouse");
const Order = require("../src/models/Order");
const Shipment = require("../src/models/Shipment");
const Role = require("../src/models/Role");
const Permission = require("../src/models/Permission");
const RolePermission = require("../src/models/RolePermission");
const EmployeeRole = require("../src/models/EmployeeRole");
const EmployeePermissionGrant = require("../src/models/EmployeePermissionGrant");
const EmployeePermissionRestriction = require("../src/models/EmployeePermissionRestriction");
const WorkAssignment = require("../src/models/WorkAssignment");

const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const { SCOPE_TYPES } = require("../src/constants/scope.constants");
const { generateAccessToken } = require("../src/services/token.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_shipment_split_test?")
  : "mongodb://127.0.0.1:27017/buybox_shipment_split_test?replicaSet=rs0";

jest.setTimeout(40000);

describe("Buybox Phase 3C — Safe Vendor Shipment Splitting", () => {
  let createdPermissions = new Map();
  let testCategory;
  let testBrand;
  let warehouseA;
  let warehouseB;
  let vendorAUser, vendorA, vendorAToken;
  let vendorBUser, vendorB, vendorBToken;
  let vendorCUser, vendorC, vendorCToken;
  let customerUser, customer, customerToken;
  let customer2User, customer2, customer2Token;
  let productA, variantA, inventoryA;
  let productB, variantB, inventoryB;

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

  async function createTestEmployee(options = {}) {
    const status = options.status || "active";
    const user = await User.create({
      firstName: "Staff",
      lastName: "Tester",
      email: `staff_${Date.now()}_${Math.random().toString(36).substring(7)}@test-shipment.com`,
      password: "Password123!",
      role: options.userRole || ROLES.MANAGER,
      isActive: options.isActive !== undefined ? options.isActive : true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const employee = await Employee.create({
      userId: user._id,
      employeeNumber: `EMP_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`,
      jobTitle: options.jobTitle || "Logistics Specialist",
      department: "Logistics",
      status,
    });

    if (options.permissions && options.permissions.length > 0) {
      await assignRoleWithPermissions(
        employee._id,
        `role_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        options.permissions
      );
    }

    const token = generateAccessToken({
      sub: user._id.toString(),
      role: user.role,
      authVersion: user.authVersion,
      permissionVersion: user.permissionVersion,
    });

    return { user, employee, token };
  }

  async function createTestVendor(options = {}) {
    const user = await User.create({
      firstName: options.firstName || "Vendor",
      lastName: "User",
      email: `vendor_${Date.now()}_${Math.random().toString(36).substring(7)}@test-shipment.com`,
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

  async function createTestCustomer() {
    const user = await User.create({
      firstName: "Customer",
      lastName: "User",
      email: `customer_${Date.now()}_${Math.random().toString(36).substring(7)}@test-shipment.com`,
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

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    await Promise.all([
      User.init(),
      Employee.init(),
      Customer.init(),
      Vendor.init(),
      Warehouse.init(),
      Category.init(),
      Brand.init(),
      Product.init(),
      ProductVariant.init(),
      Inventory.init(),
      Order.init(),
      Shipment.init(),
      Role.init(),
      Permission.init(),
      RolePermission.init(),
      EmployeeRole.init(),
      EmployeePermissionGrant.init(),
      EmployeePermissionRestriction.init(),
      WorkAssignment.init(),
    ]);

    await getOrCreatePermission(PERMISSIONS.SHIPMENTS_READ);
    await getOrCreatePermission(PERMISSIONS.SHIPMENTS_MANAGE);
    await getOrCreatePermission(PERMISSIONS.SHIPMENTS_READ_OWN);
    await getOrCreatePermission(PERMISSIONS.SHIPMENTS_MANAGE_OWN);

    // Setup Category & Brand
    testCategory = await Category.create({
      name: "Shipment Test Category",
      slug: `shipment-category-${Date.now()}`,
      isActive: true,
    });

    testBrand = await Brand.create({
      name: "Shipment Test Brand",
      slug: `shipment-brand-${Date.now()}`,
      isActive: true,
    });

    // Setup Warehouses
    warehouseA = await Warehouse.create({
      name: "Warehouse Alpha",
      code: `WH-A-${Date.now()}`,
      address: {
        addressLine1: "123 Port Way",
        city: "Mumbai",
        state: "MH",
        postalCode: "400001",
        country: "IN",
      },
      isActive: true,
    });

    warehouseB = await Warehouse.create({
      name: "Warehouse Beta",
      code: `WH-B-${Date.now()}`,
      address: {
        addressLine1: "456 Cargo Rd",
        city: "Bengaluru",
        state: "KA",
        postalCode: "560001",
        country: "IN",
      },
      isActive: true,
    });

    // Setup Vendors
    const vA = await createTestVendor({ firstName: "VendorA", businessName: "Vendor A Logistics" });
    vendorAUser = vA.user;
    vendorA = vA.vendor;
    vendorAToken = vA.token;

    const vB = await createTestVendor({ firstName: "VendorB", businessName: "Vendor B Logistics" });
    vendorBUser = vB.user;
    vendorB = vB.vendor;
    vendorBToken = vB.token;

    const vC = await createTestVendor({ firstName: "VendorC", businessName: "Vendor C Logistics" });
    vendorCUser = vC.user;
    vendorC = vC.vendor;
    vendorCToken = vC.token;

    // Setup Customers
    const c1 = await createTestCustomer();
    customerUser = c1.user;
    customer = c1.customer;
    customerToken = c1.token;

    const c2 = await createTestCustomer();
    customer2User = c2.user;
    customer2 = c2.customer;
    customer2Token = c2.token;

    // Setup Products & Variants
    productA = await Product.create({
      name: "Vendor A Product",
      slug: `prod-a-${Date.now()}`,
      sku: `SKU-A-${Date.now()}`,
      vendorId: vendorA._id,
      categoryId: testCategory._id,
      brandId: testBrand._id,
      price: 100,
      currency: "INR",
      status: "active",
      approvalStatus: "approved",
    });

    variantA = await ProductVariant.create({
      productId: productA._id,
      sku: `VAR-A-${Date.now()}`,
      name: "Variant A1",
      price: 100,
      currency: "INR",
      status: "active",
    });

    inventoryA = await Inventory.create({
      productVariantId: variantA._id,
      warehouseId: warehouseA._id,
      onHand: 100,
      reserved: 20,
    });

    productB = await Product.create({
      name: "Vendor B Product",
      slug: `prod-b-${Date.now()}`,
      sku: `SKU-B-${Date.now()}`,
      vendorId: vendorB._id,
      categoryId: testCategory._id,
      brandId: testBrand._id,
      price: 200,
      currency: "INR",
      status: "active",
      approvalStatus: "approved",
    });

    variantB = await ProductVariant.create({
      productId: productB._id,
      sku: `VAR-B-${Date.now()}`,
      name: "Variant B1",
      price: 200,
      currency: "INR",
      status: "active",
    });

    inventoryB = await Inventory.create({
      productVariantId: variantB._id,
      warehouseId: warehouseB._id,
      onHand: 100,
      reserved: 10,
    });
  });

  afterAll(async () => {
    try {
      await User.deleteMany({ email: /@test-shipment\.com$/ });
      await Customer.deleteMany({});
      await Vendor.deleteMany({ businessSlug: /^vendor-corp-/ });
      await Warehouse.deleteMany({ code: /^WH-/ });
      await Category.deleteMany({ slug: /^shipment-category-/ });
      await Brand.deleteMany({ slug: /^shipment-brand-/ });
      await Product.deleteMany({ slug: /^prod-/ });
      await ProductVariant.deleteMany({ sku: /^VAR-/ });
      await Inventory.deleteMany({});
      await Order.deleteMany({ orderNumber: /^ORD-/ });
      await Shipment.deleteMany({ shipmentNumber: /^SHP-/ });
      await Role.deleteMany({ slug: /^role/ });
      await WorkAssignment.deleteMany({});
    } catch (e) {}
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  // Helper to create order
  async function createTestOrder(items, overrides = {}) {
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
    return Order.create({
      orderNumber,
      customerId: customer._id,
      userId: customerUser._id,
      status: overrides.status || "confirmed",
      paymentStatus: overrides.paymentStatus || "paid",
      fulfillmentStatus: overrides.fulfillmentStatus || "unfulfilled",
      inventoryStatus: overrides.inventoryStatus || "reserved",
      currency: "INR",
      items,
      shippingAddress: {
        fullName: "Fulfillment Customer",
        phone: "+919876543210",
        addressLine1: "100 Delivery Lane",
        city: "Bengaluru",
        state: "KA",
        postalCode: "560001",
        country: "IN",
      },
      pricing: {
        itemsTotal: 300,
        subtotal: 300,
        grandTotal: 300,
      },
    });
  }

  // =========================================================================
  // SCENARIOS 1-10: SPLITTING, MULTI-VENDOR ISOLATION & INVENTORY
  // =========================================================================

  test("1. Single-vendor order creates one valid shipment (Regression)", async () => {
    const order = await createTestOrder([
      {
        productId: productA._id,
        productVariantId: variantA._id,
        warehouseId: warehouseA._id,
        vendorId: vendorA._id,
        sku: variantA.sku,
        productName: productA.name,
        variantName: variantA.name,
        quantity: 2,
        unitPrice: 100,
        discountTotal: 0,
        taxTotal: 0,
        lineTotal: 200,
        currency: "INR",
        inventoryStatus: "reserved",
      },
    ]);

    const res = await request(app)
      .post("/api/v1/shipments/vendor")
      .set("Authorization", `Bearer ${vendorAToken}`)
      .set("Idempotency-Key", `idemp-single-${Date.now()}`)
      .send({
        orderId: order._id.toString(),
        carrier: "BlueDart",
        serviceLevel: "Express",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.vendorId.toString()).toBe(vendorA._id.toString());
    expect(res.body.data.warehouseId.toString()).toBe(warehouseA._id.toString());
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].quantity).toBe(2);
    expect(res.body.data.status).toBe("created");
  });

  test("2. Multi-vendor order splits into separate vendor shipments", async () => {
    const multiOrder = await createTestOrder([
      {
        productId: productA._id,
        productVariantId: variantA._id,
        warehouseId: warehouseA._id,
        vendorId: vendorA._id,
        sku: variantA.sku,
        productName: productA.name,
        variantName: variantA.name,
        quantity: 3,
        unitPrice: 100,
        discountTotal: 0,
        taxTotal: 0,
        lineTotal: 300,
        currency: "INR",
        inventoryStatus: "reserved",
      },
      {
        productId: productB._id,
        productVariantId: variantB._id,
        warehouseId: warehouseB._id,
        vendorId: vendorB._id,
        sku: variantB.sku,
        productName: productB.name,
        variantName: variantB.name,
        quantity: 1,
        unitPrice: 200,
        discountTotal: 0,
        taxTotal: 0,
        lineTotal: 200,
        currency: "INR",
        inventoryStatus: "reserved",
      },
    ]);

    // Vendor A creates their shipment
    const resA = await request(app)
      .post("/api/v1/shipments/vendor")
      .set("Authorization", `Bearer ${vendorAToken}`)
      .set("Idempotency-Key", `idemp-multi-a-${Date.now()}`)
      .send({
        orderId: multiOrder._id.toString(),
        carrier: "BlueDart",
      });

    expect(resA.status).toBe(201);
    expect(resA.body.data.vendorId.toString()).toBe(vendorA._id.toString());
    expect(resA.body.data.items).toHaveLength(1);
    expect(resA.body.data.items[0].sku).toBe(variantA.sku);

    // Vendor B creates their shipment
    const resB = await request(app)
      .post("/api/v1/shipments/vendor")
      .set("Authorization", `Bearer ${vendorBToken}`)
      .set("Idempotency-Key", `idemp-multi-b-${Date.now()}`)
      .send({
        orderId: multiOrder._id.toString(),
        carrier: "Delhivery",
      });

    expect(resB.status).toBe(201);
    expect(resB.body.data.vendorId.toString()).toBe(vendorB._id.toString());
    expect(resB.body.data.items).toHaveLength(1);
    expect(resB.body.data.items[0].sku).toBe(variantB.sku);
  });

  test("3. Vendor A can create ONLY Vendor A shipment", async () => {
    const multiOrder = await createTestOrder([
      {
        productId: productA._id,
        productVariantId: variantA._id,
        warehouseId: warehouseA._id,
        vendorId: vendorA._id,
        sku: variantA.sku,
        productName: productA.name,
        quantity: 1,
        unitPrice: 100,
        discountTotal: 0,
        taxTotal: 0,
        lineTotal: 100,
        currency: "INR",
        inventoryStatus: "reserved",
      },
      {
        productId: productB._id,
        productVariantId: variantB._id,
        warehouseId: warehouseB._id,
        vendorId: vendorB._id,
        sku: variantB.sku,
        productName: productB.name,
        quantity: 1,
        unitPrice: 200,
        discountTotal: 0,
        taxTotal: 0,
        lineTotal: 200,
        currency: "INR",
        inventoryStatus: "reserved",
      },
    ]);

    const res = await request(app)
      .post("/api/v1/shipments/vendor")
      .set("Authorization", `Bearer ${vendorAToken}`)
      .set("Idempotency-Key", `idemp-a-only-${Date.now()}`)
      .send({ orderId: multiOrder._id.toString() });

    expect(res.status).toBe(201);
    expect(res.body.data.items.every((i) => i.productId.toString() === productA._id.toString())).toBe(true);
  });

  test("4. Vendor B can create ONLY Vendor B shipment", async () => {
    const multiOrder = await createTestOrder([
      {
        productId: productA._id,
        productVariantId: variantA._id,
        warehouseId: warehouseA._id,
        vendorId: vendorA._id,
        sku: variantA.sku,
        productName: productA.name,
        quantity: 1,
        unitPrice: 100,
        discountTotal: 0,
        taxTotal: 0,
        lineTotal: 100,
        currency: "INR",
        inventoryStatus: "reserved",
      },
      {
        productId: productB._id,
        productVariantId: variantB._id,
        warehouseId: warehouseB._id,
        vendorId: vendorB._id,
        sku: variantB.sku,
        productName: productB.name,
        quantity: 1,
        unitPrice: 200,
        discountTotal: 0,
        taxTotal: 0,
        lineTotal: 200,
        currency: "INR",
        inventoryStatus: "reserved",
      },
    ]);

    const res = await request(app)
      .post("/api/v1/shipments/vendor")
      .set("Authorization", `Bearer ${vendorBToken}`)
      .set("Idempotency-Key", `idemp-b-only-${Date.now()}`)
      .send({ orderId: multiOrder._id.toString() });

    expect(res.status).toBe(201);
    expect(res.body.data.items.every((i) => i.productId.toString() === productB._id.toString())).toBe(true);
  });

  test("5. Cross-vendor item inclusion rejected (Vendor C has no items in order -> 404)", async () => {
    const order = await createTestOrder([
      {
        productId: productA._id,
        productVariantId: variantA._id,
        warehouseId: warehouseA._id,
        vendorId: vendorA._id,
        sku: variantA.sku,
        productName: productA.name,
        quantity: 1,
        unitPrice: 100,
        discountTotal: 0,
        taxTotal: 0,
        lineTotal: 100,
        currency: "INR",
        inventoryStatus: "reserved",
      },
    ]);

    // Vendor C attempts to create shipment for Vendor A's order
    const res = await request(app)
      .post("/api/v1/shipments/vendor")
      .set("Authorization", `Bearer ${vendorCToken}`)
      .set("Idempotency-Key", `idemp-c-cross-${Date.now()}`)
      .send({ orderId: order._id.toString() });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("SHIPMENT_NOT_FOUND");
  });

  test("6. Client vendorId is ignored/overwritten with authenticated vendorId", async () => {
    const multiOrder = await createTestOrder([
      {
        productId: productA._id,
        productVariantId: variantA._id,
        warehouseId: warehouseA._id,
        vendorId: vendorA._id,
        sku: variantA.sku,
        productName: productA.name,
        quantity: 1,
        unitPrice: 100,
        discountTotal: 0,
        taxTotal: 0,
        lineTotal: 100,
        currency: "INR",
        inventoryStatus: "reserved",
      },
      {
        productId: productB._id,
        productVariantId: variantB._id,
        warehouseId: warehouseB._id,
        vendorId: vendorB._id,
        sku: variantB.sku,
        productName: productB.name,
        quantity: 1,
        unitPrice: 200,
        discountTotal: 0,
        taxTotal: 0,
        lineTotal: 200,
        currency: "INR",
        inventoryStatus: "reserved",
      },
    ]);

    // Vendor A tries to pass Vendor B's vendorId
    const res = await request(app)
      .post("/api/v1/shipments/vendor")
      .set("Authorization", `Bearer ${vendorAToken}`)
      .set("Idempotency-Key", `idemp-override-${Date.now()}`)
      .send({
        orderId: multiOrder._id.toString(),
        vendorId: vendorB._id.toString(),
      });

    expect(res.status).toBe(201);
    // Verified: Server strictly used Vendor A!
    expect(res.body.data.vendorId.toString()).toBe(vendorA._id.toString());
  });

  test("7. Warehouse mismatch rejected (400 WAREHOUSE_MISMATCH)", async () => {
    const order = await createTestOrder([
      {
        productId: productA._id,
        productVariantId: variantA._id,
        warehouseId: warehouseA._id,
        vendorId: vendorA._id,
        sku: variantA.sku,
        productName: productA.name,
        quantity: 1,
        unitPrice: 100,
        discountTotal: 0,
        taxTotal: 0,
        lineTotal: 100,
        currency: "INR",
        inventoryStatus: "reserved",
      },
    ]);

    // Vendor A tries to specify Warehouse B for items stored in Warehouse A
    const res = await request(app)
      .post("/api/v1/shipments/vendor")
      .set("Authorization", `Bearer ${vendorAToken}`)
      .set("Idempotency-Key", `idemp-wh-mismatch-${Date.now()}`)
      .send({
        orderId: order._id.toString(),
        warehouseId: warehouseB._id.toString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("WAREHOUSE_MISMATCH");
  });

  test("8. Duplicate shipment rejected (409 SHIPMENT_ALREADY_EXISTS)", async () => {
    const order = await createTestOrder([
      {
        productId: productA._id,
        productVariantId: variantA._id,
        warehouseId: warehouseA._id,
        vendorId: vendorA._id,
        sku: variantA.sku,
        productName: productA.name,
        quantity: 1,
        unitPrice: 100,
        discountTotal: 0,
        taxTotal: 0,
        lineTotal: 100,
        currency: "INR",
        inventoryStatus: "reserved",
      },
    ]);

    const res1 = await request(app)
      .post("/api/v1/shipments/vendor")
      .set("Authorization", `Bearer ${vendorAToken}`)
      .set("Idempotency-Key", `idemp-dup-1-${Date.now()}`)
      .send({ orderId: order._id.toString() });

    expect(res1.status).toBe(201);

    // Attempting to create duplicate active shipment with different idempotency key
    const res2 = await request(app)
      .post("/api/v1/shipments/vendor")
      .set("Authorization", `Bearer ${vendorAToken}`)
      .set("Idempotency-Key", `idemp-dup-2-${Date.now()}`)
      .send({ orderId: order._id.toString() });

    expect(res2.status).toBe(409);
    expect(res2.body.code).toBe("SHIPMENT_ALREADY_EXISTS");
  });

  test("9. Over-fulfillment prevented (duplicate shipment for same vendor & warehouse rejected)", async () => {
    const order = await createTestOrder([
      {
        productId: productA._id,
        productVariantId: variantA._id,
        warehouseId: warehouseA._id,
        vendorId: vendorA._id,
        sku: variantA.sku,
        productName: productA.name,
        quantity: 5,
        unitPrice: 100,
        discountTotal: 0,
        taxTotal: 0,
        lineTotal: 500,
        currency: "INR",
        inventoryStatus: "reserved",
      },
    ]);

    await request(app)
      .post("/api/v1/shipments/vendor")
      .set("Authorization", `Bearer ${vendorAToken}`)
      .set("Idempotency-Key", `idemp-overf-1-${Date.now()}`)
      .send({ orderId: order._id.toString() });

    const duplicateRes = await request(app)
      .post("/api/v1/shipments/vendor")
      .set("Authorization", `Bearer ${vendorAToken}`)
      .set("Idempotency-Key", `idemp-overf-2-${Date.now()}`)
      .send({ orderId: order._id.toString() });

    expect(duplicateRes.status).toBe(409);
    expect(duplicateRes.body.code).toBe("SHIPMENT_ALREADY_EXISTS");
  });

  test("10. Inventory deduction and release lifecycle integrity", async () => {
    const order = await createTestOrder([
      {
        productId: productA._id,
        productVariantId: variantA._id,
        warehouseId: warehouseA._id,
        vendorId: vendorA._id,
        sku: variantA.sku,
        productName: productA.name,
        quantity: 4,
        unitPrice: 100,
        discountTotal: 0,
        taxTotal: 0,
        lineTotal: 400,
        currency: "INR",
        inventoryStatus: "reserved",
      },
    ]);

    const createRes = await request(app)
      .post("/api/v1/shipments/vendor")
      .set("Authorization", `Bearer ${vendorAToken}`)
      .set("Idempotency-Key", `idemp-inv-lifecycle-${Date.now()}`)
      .send({ orderId: order._id.toString() });

    expect(createRes.status).toBe(201);
    const shipmentId = createRes.body.data._id;

    // Transition created -> ready_to_ship
    const readyRes = await request(app)
      .patch(`/api/v1/shipments/vendor/${shipmentId}/status`)
      .set("Authorization", `Bearer ${vendorAToken}`)
      .send({ status: "ready_to_ship" });
    expect(readyRes.status).toBe(200);

    // Transition ready_to_ship -> picked_up (deducts inventory)
    const pickupRes = await request(app)
      .patch(`/api/v1/shipments/vendor/${shipmentId}/status`)
      .set("Authorization", `Bearer ${vendorAToken}`)
      .send({ status: "picked_up" });

    expect(pickupRes.status).toBe(200);
    expect(pickupRes.body.data.inventoryStatus).toBe("deducted");

    // Verify order item inventoryStatus was synchronized to deducted
    const updatedOrder = await Order.findById(order._id);
    expect(updatedOrder.items[0].inventoryStatus).toBe("deducted");
  });

  // =========================================================================
  // SCENARIOS 11-13: OWNERSHIP & STATUS MACHINE INTEGRITY
  // =========================================================================

  test("11. Vendor shipment ownership: Vendor A cannot view/update Vendor B's shipment (404)", async () => {
    const order = await createTestOrder([
      {
        productId: productB._id,
        productVariantId: variantB._id,
        warehouseId: warehouseB._id,
        vendorId: vendorB._id,
        sku: variantB.sku,
        productName: productB.name,
        quantity: 1,
        unitPrice: 200,
        discountTotal: 0,
        taxTotal: 0,
        lineTotal: 200,
        currency: "INR",
        inventoryStatus: "reserved",
      },
    ]);

    // Vendor B creates shipment
    const bRes = await request(app)
      .post("/api/v1/shipments/vendor")
      .set("Authorization", `Bearer ${vendorBToken}`)
      .set("Idempotency-Key", `idemp-iso-b-${Date.now()}`)
      .send({ orderId: order._id.toString() });

    const shipmentBId = bRes.body.data._id;

    // Vendor A tries to read Vendor B's shipment
    const getRes = await request(app)
      .get(`/api/v1/shipments/vendor/my/${shipmentBId}`)
      .set("Authorization", `Bearer ${vendorAToken}`);

    expect(getRes.status).toBe(404);
    expect(getRes.body.code).toBe("SHIPMENT_NOT_FOUND");

    // Vendor A tries to update status of Vendor B's shipment
    const patchRes = await request(app)
      .patch(`/api/v1/shipments/vendor/${shipmentBId}/status`)
      .set("Authorization", `Bearer ${vendorAToken}`)
      .send({ status: "ready_to_ship" });

    expect(patchRes.status).toBe(404);
    expect(patchRes.body.code).toBe("SHIPMENT_NOT_FOUND");
  });

  test("12. Customer shipment ownership: Customer 2 cannot access Customer 1's shipment (404)", async () => {
    const order = await createTestOrder([
      {
        productId: productA._id,
        productVariantId: variantA._id,
        warehouseId: warehouseA._id,
        vendorId: vendorA._id,
        sku: variantA.sku,
        productName: productA.name,
        quantity: 1,
        unitPrice: 100,
        discountTotal: 0,
        taxTotal: 0,
        lineTotal: 100,
        currency: "INR",
        inventoryStatus: "reserved",
      },
    ]);

    const sRes = await request(app)
      .post("/api/v1/shipments/vendor")
      .set("Authorization", `Bearer ${vendorAToken}`)
      .set("Idempotency-Key", `idemp-cust-iso-${Date.now()}`)
      .send({ orderId: order._id.toString() });

    const shipmentId = sRes.body.data._id;

    // Customer 1 (purchaser) can access
    const c1Res = await request(app)
      .get(`/api/v1/shipments/my/${shipmentId}`)
      .set("Authorization", `Bearer ${customerToken}`);
    expect(c1Res.status).toBe(200);

    // Customer 2 cannot access
    const c2Res = await request(app)
      .get(`/api/v1/shipments/my/${shipmentId}`)
      .set("Authorization", `Bearer ${customer2Token}`);
    expect(c2Res.status).toBe(404);
    expect(c2Res.body.code).toBe("SHIPMENT_NOT_FOUND");
  });

  test("13. Invalid status transition rejected (409 INVALID_SHIPMENT_STATUS_TRANSITION)", async () => {
    const order = await createTestOrder([
      {
        productId: productA._id,
        productVariantId: variantA._id,
        warehouseId: warehouseA._id,
        vendorId: vendorA._id,
        sku: variantA.sku,
        productName: productA.name,
        quantity: 1,
        unitPrice: 100,
        discountTotal: 0,
        taxTotal: 0,
        lineTotal: 100,
        currency: "INR",
        inventoryStatus: "reserved",
      },
    ]);

    const sRes = await request(app)
      .post("/api/v1/shipments/vendor")
      .set("Authorization", `Bearer ${vendorAToken}`)
      .set("Idempotency-Key", `idemp-invalid-trans-${Date.now()}`)
      .send({ orderId: order._id.toString() });

    const shipmentId = sRes.body.data._id;

    // Directly attempting delivered from created (skipping ready_to_ship, picked_up, in_transit)
    const patchRes = await request(app)
      .patch(`/api/v1/shipments/vendor/${shipmentId}/status`)
      .set("Authorization", `Bearer ${vendorAToken}`)
      .send({ status: "delivered" });

    expect(patchRes.status).toBe(409);
    expect(patchRes.body.code).toBe("INVALID_SHIPMENT_STATUS_TRANSITION");
  });

  // =========================================================================
  // SCENARIOS 14-19: DYNAMIC PBAC, SCOPE & GOVERNANCE
  // =========================================================================

  test("14. Dynamic PBAC: shipments:manage_own required for vendor creation, denied to customer", async () => {
    const order = await createTestOrder([
      {
        productId: productA._id,
        productVariantId: variantA._id,
        warehouseId: warehouseA._id,
        vendorId: vendorA._id,
        sku: variantA.sku,
        productName: productA.name,
        quantity: 1,
        unitPrice: 100,
        discountTotal: 0,
        taxTotal: 0,
        lineTotal: 100,
        currency: "INR",
        inventoryStatus: "reserved",
      },
    ]);

    // Customer lacks shipments:manage_own
    const res = await request(app)
      .post("/api/v1/shipments/vendor")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ orderId: order._id.toString() });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
  });

  test("15. Warehouse scope enforcement: Employee with warehouseA scope cannot access warehouseB", async () => {
    const { employee, token } = await createTestEmployee({
      jobTitle: "Warehouse Specialist",
      permissions: [PERMISSIONS.SHIPMENTS_READ],
    });

    // Assign scope ONLY to Warehouse A
    await WorkAssignment.create({
      employeeId: employee._id,
      scopeType: SCOPE_TYPES.WAREHOUSE,
      scopeId: warehouseA._id.toString(),
      isActive: true,
    });

    // Allowed warehouse A
    const resA = await request(app)
      .get(`/api/v1/shipments/warehouse/${warehouseA._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(resA.status).toBe(200);

    // Denied warehouse B
    const resB = await request(app)
      .get(`/api/v1/shipments/warehouse/${warehouseB._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(resB.status).toBe(403);
    expect(resB.body.code).toBe("INSUFFICIENT_SCOPE");
  });

  test("16. Direct restriction dominates role grant for shipments:read_own", async () => {
    const { employee, user, token } = await createTestEmployee();

    // Assign role with shipments:read_own
    await assignRoleWithPermissions(employee._id, "ship_reader_role", [PERMISSIONS.SHIPMENTS_READ_OWN]);

    // Add direct restriction
    const perm = await getOrCreatePermission(PERMISSIONS.SHIPMENTS_READ_OWN);
    await EmployeePermissionRestriction.create({
      employeeId: employee._id,
      permissionId: perm._id,
      reason: "Restricted temporarily",
    });

    const res = await request(app)
      .get("/api/v1/shipments/vendor/my")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
  });

  test("17. Expired direct grant denies access", async () => {
    const { employee, token } = await createTestEmployee({
      userRole: "customer",
    });

    const perm = await getOrCreatePermission(PERMISSIONS.SHIPMENTS_READ_OWN);
    await EmployeePermissionGrant.create({
      employeeId: employee._id,
      permissionId: perm._id,
      expiresAt: new Date(Date.now() - 10000), // expired in past
      reason: "Temporary grant expired",
    });

    const res = await request(app)
      .get("/api/v1/shipments/vendor/my")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
  });

  test("18. Suspended employee is rejected (403)", async () => {
    const { employee, token } = await createTestEmployee({
      status: "suspended",
      permissions: [PERMISSIONS.SHIPMENTS_READ],
    });

    const suspendedRes = await request(app)
      .get("/api/v1/shipments/order/507f1f77bcf86cd799439011")
      .set("Authorization", `Bearer ${token}`);

    expect(suspendedRes.status).toBe(403);
    expect(suspendedRes.body.code).toBe("INSUFFICIENT_PERMISSIONS");
  });

  test("19. Terminated employee is rejected (403)", async () => {
    const { token } = await createTestEmployee({
      status: "terminated",
      permissions: [PERMISSIONS.SHIPMENTS_READ],
    });

    const terminatedRes = await request(app)
      .get(`/api/v1/shipments/warehouse/${warehouseA._id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(terminatedRes.status).toBe(403);
    expect(terminatedRes.body.code).toBe("INSUFFICIENT_PERMISSIONS");
  });

  // =========================================================================
  // SCENARIOS 20-21: PRODUCT VARIANT & VENDOR ORDER REGRESSION
  // =========================================================================

  test("20. ProductVariant ownership regression: Vendor A cannot mutate Vendor B variant (403)", async () => {
    const res = await request(app)
      .patch(`/api/v1/product-variants/${variantB._id}`)
      .set("Authorization", `Bearer ${vendorAToken}`)
      .send({ name: "Hacked Variant Name" });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("PRODUCT_OWNERSHIP_REQUIRED");
  });

  test("21. Vendor order isolation regression: Vendor A sees only Vendor A items in multi-vendor order", async () => {
    const multiOrder = await createTestOrder([
      {
        productId: productA._id,
        productVariantId: variantA._id,
        warehouseId: warehouseA._id,
        vendorId: vendorA._id,
        sku: variantA.sku,
        productName: productA.name,
        quantity: 2,
        unitPrice: 100,
        discountTotal: 0,
        taxTotal: 0,
        lineTotal: 200,
        currency: "INR",
        inventoryStatus: "reserved",
      },
      {
        productId: productB._id,
        productVariantId: variantB._id,
        warehouseId: warehouseB._id,
        vendorId: vendorB._id,
        sku: variantB.sku,
        productName: productB.name,
        quantity: 1,
        unitPrice: 200,
        discountTotal: 0,
        taxTotal: 0,
        lineTotal: 200,
        currency: "INR",
        inventoryStatus: "reserved",
      },
    ]);

    const res = await request(app)
      .get(`/api/v1/orders/vendor/my/${multiOrder._id}`)
      .set("Authorization", `Bearer ${vendorAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].sku).toBe(variantA.sku);
    expect(res.body.data.itemCount).toBe(2);
    expect(res.body.data.subtotal).toBe("200.00");
  });
});
