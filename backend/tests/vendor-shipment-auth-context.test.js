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
const Order = require("../src/models/Order");
const Shipment = require("../src/models/Shipment");
const Warehouse = require("../src/models/Warehouse");
const Employee = require("../src/models/Employee");

const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const { generateAccessToken, TOKEN_CONTEXTS, TOKEN_AUDIENCES } = require("../src/services/token.service");
const { hashPassword } = require("../src/utils/password");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_vendor_auth_ctx_test?")
  : "mongodb://127.0.0.1:27017/buybox_vendor_auth_ctx_test?replicaSet=rs0";

jest.setTimeout(45000);

describe("P1 Integration Suite: Vendor Shipment Creation Authentication Context & Demo Shipping", () => {
  let adminUser, adminToken;
  let vendorAUser, vendorA, vendorAToken;
  let vendorBUser, vendorB, vendorBToken;
  let customerUser, customer, customerToken;
  let warehouse, category, brand, productA, variantA;
  let testOrderA;

  let createdAdmin = false;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(TEST_MONGODB_URI);

    // 1. Superadmin User & Employee Record
    adminUser = await User.findOne({ role: ROLES.SUPER_ADMIN, isActive: true });
    if (!adminUser) {
      adminUser = await User.create({
        firstName: "Super",
        lastName: "Admin",
        email: `superadmin_ctx_${Date.now()}@buybox.test`,
        password: await hashPassword("Password123!"),
        role: ROLES.SUPER_ADMIN,
        roles: [ROLES.SUPER_ADMIN],
        isEmailVerified: true,
        isActive: true,
        authVersion: 1,
        permissionVersion: 1,
      });
      createdAdmin = true;
    }

    let employee = await Employee.findOne({ userId: adminUser._id });
    if (!employee) {
      employee = await Employee.create({
        userId: adminUser._id,
        employeeNumber: `EMP-${Date.now()}`,
        department: "Platform Engineering",
        jobTitle: "Super Administrator",
        status: "active",
      });
    }

    adminToken = generateAccessToken(
      {
        sub: adminUser._id.toString(),
        id: adminUser._id.toString(),
        email: adminUser.email,
        role: ROLES.SUPER_ADMIN,
        roles: [ROLES.SUPER_ADMIN],
        permissions: [PERMISSIONS.SHIPMENTS_READ, PERMISSIONS.SHIPMENTS_MANAGE, PERMISSIONS.ORDERS_READ, PERMISSIONS.ORDERS_MANAGE],
        authVersion: 1,
        permissionVersion: 1,
      },
      { context: TOKEN_CONTEXTS.ADMINISTRATOR }
    );

    // 2. Vendor A User & Store
    vendorAUser = await User.create({
      firstName: "Smriti",
      lastName: "Seller",
      email: `smriti_seller_${Date.now()}@buybox.test`,
      password: await hashPassword("Password123!"),
      role: ROLES.VENDOR,
      roles: [ROLES.VENDOR],
      isEmailVerified: true,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    vendorA = await Vendor.create({
      userId: vendorAUser._id,
      storeName: "Smriti's Store",
      businessName: "Smriti's Store",
      businessSlug: `smriti-store-${Date.now()}`,
      status: "approved",
      isActive: true,
      approvalStatus: "approved",
      onboardingStatus: "approved",
      email: vendorAUser.email,
      phone: "+919876543210",
      complianceStatus: "verified",
      verificationStatus: "verified",
      address: {
        addressLine1: "456 Seller Lane",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "IN",
      },
    });

    vendorAToken = generateAccessToken(
      {
        sub: vendorAUser._id.toString(),
        id: vendorAUser._id.toString(),
        email: vendorAUser.email,
        role: ROLES.VENDOR,
        roles: [ROLES.VENDOR],
        permissions: [PERMISSIONS.SHIPMENTS_READ_OWN, PERMISSIONS.SHIPMENTS_MANAGE_OWN, PERMISSIONS.ORDERS_READ_OWN, PERMISSIONS.ORDERS_MANAGE_OWN],
        authVersion: 1,
        permissionVersion: 1,
      },
      { context: TOKEN_CONTEXTS.VENDOR, audience: TOKEN_AUDIENCES.VENDOR }
    );

    // 3. Vendor B User & Store (for isolation testing)
    vendorBUser = await User.create({
      firstName: "Bob",
      lastName: "Merchant",
      email: `bob_merchant_${Date.now()}@buybox.test`,
      password: await hashPassword("Password123!"),
      role: ROLES.VENDOR,
      roles: [ROLES.VENDOR],
      isEmailVerified: true,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    vendorB = await Vendor.create({
      userId: vendorBUser._id,
      storeName: "Bob's Goods",
      businessName: "Bob's Goods",
      businessSlug: `bobs-goods-${Date.now()}`,
      status: "approved",
      isActive: true,
      approvalStatus: "approved",
      onboardingStatus: "approved",
      email: vendorBUser.email,
      phone: "+919876543211",
      complianceStatus: "verified",
      verificationStatus: "verified",
      address: {
        addressLine1: "789 Market Rd",
        city: "Delhi",
        state: "Delhi",
        postalCode: "110001",
        country: "IN",
      },
    });

    vendorBToken = generateAccessToken(
      {
        sub: vendorBUser._id.toString(),
        id: vendorBUser._id.toString(),
        email: vendorBUser.email,
        role: ROLES.VENDOR,
        roles: [ROLES.VENDOR],
        permissions: [PERMISSIONS.SHIPMENTS_READ_OWN, PERMISSIONS.SHIPMENTS_MANAGE_OWN, PERMISSIONS.ORDERS_READ_OWN, PERMISSIONS.ORDERS_MANAGE_OWN],
        authVersion: 1,
        permissionVersion: 1,
      },
      { context: TOKEN_CONTEXTS.VENDOR, audience: TOKEN_AUDIENCES.VENDOR }
    );

    // 4. Customer User
    customerUser = await User.create({
      firstName: "Alice",
      lastName: "Customer",
      email: `alice_customer_${Date.now()}@buybox.test`,
      password: await hashPassword("Password123!"),
      role: ROLES.CUSTOMER,
      roles: [ROLES.CUSTOMER],
      isEmailVerified: true,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    customer = await Customer.create({
      userId: customerUser._id,
      firstName: "Alice",
      lastName: "Customer",
      email: customerUser.email,
      phone: "+919123456789",
    });

    customerToken = generateAccessToken(
      {
        sub: customerUser._id.toString(),
        id: customerUser._id.toString(),
        email: customerUser.email,
        role: ROLES.CUSTOMER,
        roles: [ROLES.CUSTOMER],
        permissions: [],
        authVersion: 1,
        permissionVersion: 1,
      },
      { context: TOKEN_CONTEXTS.CUSTOMER, audience: TOKEN_AUDIENCES.CUSTOMER }
    );

    // 5. Shared Warehouse, Category, Brand, Product
    warehouse = await Warehouse.create({
      name: "Bengaluru Central Hub",
      warehouseName: "Bengaluru Central Hub",
      code: `WH-BLR-${Date.now()}`,
      address: {
        addressLine1: "Industrial Area Phase 2",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560058",
        country: "IN",
      },
      isActive: true,
    });

    category = await Category.create({
      name: `Electronics-${Date.now()}`,
      slug: `electronics-${Date.now()}`,
      isActive: true,
    });

    brand = await Brand.create({
      name: `AudioBrand-${Date.now()}`,
      slug: `audiobrand-${Date.now()}`,
      isActive: true,
    });

    productA = await Product.create({
      name: "Noise Cancelling Headphones",
      title: "Noise Cancelling Headphones",
      slug: `headphones-${Date.now()}`,
      sku: `PROD-HEADPHONE-${Date.now().toString().slice(-4)}`,
      vendorId: vendorA._id,
      categoryId: category._id,
      brandId: brand._id,
      price: mongoose.Types.Decimal128.fromString("2999.00"),
      currency: "INR",
      status: "active",
      approvalStatus: "approved",
      publishedAt: new Date(),
      isActive: true,
    });

    variantA = await ProductVariant.create({
      productId: productA._id,
      sku: `SKU-HEADPHONE-${Date.now()}`,
      title: "Default Black",
      price: mongoose.Types.Decimal128.fromString("2999.00"),
      stock: 50,
      status: "active",
      isActive: true,
    });

    // 6. Test Order for Vendor A (Pre-accepted and fulfillment confirmed)
    testOrderA = await Order.create({
      orderNumber: `ORD-CTX-${Date.now()}`,
      customerId: customer._id,
      customerEmail: customerUser.email,
      status: "processing",
      paymentStatus: "paid",
      paymentMethod: "razorpay",
      currency: "INR",
      subtotal: mongoose.Types.Decimal128.fromString("2999.00"),
      discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
      taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
      shippingTotal: mongoose.Types.Decimal128.fromString("0.00"),
      grandTotal: mongoose.Types.Decimal128.fromString("2999.00"),
      amountPaid: mongoose.Types.Decimal128.fromString("2999.00"),
      shippingAddress: {
        fullName: "Alice Customer",
        addressLine1: "Flat 101, Residency",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "IN",
        phone: "+919123456789",
      },
      billingAddress: {
        fullName: "Alice Customer",
        addressLine1: "Flat 101, Residency",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "IN",
        phone: "+919123456789",
      },
      items: [
        {
          productId: productA._id,
          productVariantId: variantA._id,
          productName: productA.name,
          sku: variantA.sku,
          unitPrice: mongoose.Types.Decimal128.fromString("2999.00"),
          price: mongoose.Types.Decimal128.fromString("2999.00"),
          discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
          taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
          lineTotal: mongoose.Types.Decimal128.fromString("2999.00"),
          currency: "INR",
          quantity: 1,
          vendorId: vendorA._id,
          warehouseId: warehouse._id,
          inventoryStatus: "reserved",
          fulfillmentStatus: "processing",
        },
      ],
      vendorFulfillments: [
        {
          vendorId: vendorA._id,
          warehouseId: warehouse._id,
          acceptanceStatus: "accepted",
          acceptedAt: new Date(),
          isFulfillmentConfirmed: true,
          fulfillmentConfirmedAt: new Date(),
          assignedShipmentPartner: {
            partnerId: "delhivery",
            partnerName: "Delhivery Surface",
          },
          expectedDeliveryDate: new Date(Date.now() + 86400000 * 5),
          fulfillmentStatus: "ready_to_ship",
        },
      ],
    });
  });

  afterAll(async () => {
    if (testOrderA?._id) await Order.deleteMany({ _id: testOrderA._id });
    if (testOrderA?._id) await Shipment.deleteMany({ orderId: testOrderA._id });
    if (variantA?._id) await ProductVariant.deleteMany({ _id: variantA._id });
    if (productA?._id) await Product.deleteMany({ _id: productA._id });
    if (brand?._id) await Brand.deleteMany({ _id: brand._id });
    if (category?._id) await Category.deleteMany({ _id: category._id });
    if (warehouse?._id) await Warehouse.deleteMany({ _id: warehouse._id });
    if (customer?._id) await Customer.deleteMany({ _id: customer._id });
    if (vendorA?._id || vendorB?._id) await Vendor.deleteMany({ _id: { $in: [vendorA?._id, vendorB?._id].filter(Boolean) } });
    if (createdAdmin && adminUser?._id) {
      await Employee.deleteMany({ userId: adminUser._id });
      await User.deleteMany({ _id: adminUser._id });
    }
    await User.deleteMany({ _id: { $in: [vendorAUser?._id, vendorBUser?._id, customerUser?._id].filter(Boolean) } });
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe("1. Strict Authentication & Context Enforcement", () => {
    it("REJECTS customer-context session on vendor shipment creation with HTTP 403 INVALID_SESSION_CONTEXT", async () => {
      const res = await request(app)
        .post(`/api/v1/vendors/me/orders/${testOrderA._id}/shipments`)
        .set("Authorization", `Bearer ${customerToken}`)
        .set("Idempotency-Key", `idemp-cust-${Date.now()}`)
        .send({
          carrier: "Delhivery",
          warehouseId: warehouse._id.toString(),
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INVALID_SESSION_CONTEXT");
      expect(res.body.message).toContain("Cross-context session disallowed. Required: vendor, found: customer");
    });

    it("REJECTS request missing Authorization header with HTTP 401 AUTHENTICATION_REQUIRED", async () => {
      const res = await request(app)
        .post(`/api/v1/vendors/me/orders/${testOrderA._id}/shipments`)
        .set("Idempotency-Key", `idemp-none-${Date.now()}`)
        .send({
          carrier: "Delhivery",
          warehouseId: warehouse._id.toString(),
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
    });

    it("REJECTS expired vendor token with HTTP 401 TOKEN_EXPIRED", async () => {
      const jwt = require("jsonwebtoken");
      const env = require("../src/config/env");

      const now = Math.floor(Date.now() / 1000);
      const expiredVendorToken = jwt.sign(
        {
          sub: vendorAUser._id.toString(),
          id: vendorAUser._id.toString(),
          email: vendorAUser.email,
          role: ROLES.VENDOR,
          roles: [ROLES.VENDOR],
          context: TOKEN_CONTEXTS.VENDOR,
          type: "access",
          authVersion: 1,
          permissionVersion: 1,
          iat: now - 120,
          exp: now - 60,
        },
        env.JWT_ACCESS_SECRET,
        {
          issuer: "buybox-api",
          audience: TOKEN_AUDIENCES.VENDOR,
        }
      );

      const res = await request(app)
        .post(`/api/v1/vendors/me/orders/${testOrderA._id}/shipments`)
        .set("Authorization", `Bearer ${expiredVendorToken}`)
        .set("Idempotency-Key", `idemp-exp-${Date.now()}`)
        .send({
          carrier: "Delhivery",
          warehouseId: warehouse._id.toString(),
        });

      expect(res.status).toBe(401);
      expect(["TOKEN_EXPIRED", "INVALID_ACCESS_TOKEN"]).toContain(res.body.code);
    });
  });

  describe("2. Demo / Manual Mode Shipment Creation & Optionality", () => {
    let demoShipmentId = null;
    let demoIdempotencyKey = null;

    it("ACCEPTS shipment creation with vendor session where AWB and trackingUrl are omitted", async () => {
      demoIdempotencyKey = `idemp-demo-shp-${Date.now()}`;

      const res = await request(app)
        .post(`/api/v1/vendors/me/orders/${testOrderA._id}/shipments`)
        .set("Authorization", `Bearer ${vendorAToken}`)
        .set("Idempotency-Key", demoIdempotencyKey)
        .send({
          carrier: "Delhivery",
          warehouseId: warehouse._id.toString(),
          serviceLevel: "Surface Standard",
          // trackingNumber and trackingUrl intentionally omitted (Demo / Manual mode)
          notes: "Manual demo packaging for dispatch test",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();

      const createdShipment = res.body.data;
      demoShipmentId = createdShipment._id;
      expect(createdShipment.status).toBe("created");
      expect(createdShipment.carrier).toBe("Delhivery");
      expect(createdShipment.orderId.toString()).toBe(testOrderA._id.toString());
      expect(createdShipment.vendorId.toString()).toBe(vendorA._id.toString());
      // In unconfigured courier demo mode, booking details indicate local creation
      expect(createdShipment.bookingDetails).toBeDefined();
      expect(createdShipment.bookingDetails.status).toBe("not_configured");
    });

    it("ENFORCES Idempotency-Key: identical key returns existing shipment without duplicates", async () => {
      // Re-submitting the identical idempotency key returns the previously created shipment
      const res = await request(app)
        .post(`/api/v1/vendors/me/orders/${testOrderA._id}/shipments`)
        .set("Authorization", `Bearer ${vendorAToken}`)
        .set("Idempotency-Key", demoIdempotencyKey)
        .send({
          carrier: "Delhivery",
          warehouseId: warehouse._id.toString(),
          serviceLevel: "Surface Standard",
          notes: "Manual demo packaging for dispatch test",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(demoShipmentId);
    });
  });

  describe("3. Tenant Isolation & Staff Override", () => {
    it("REJECTS Vendor B attempting to create shipment on Vendor A's order", async () => {
      const res = await request(app)
        .post(`/api/v1/vendors/me/orders/${testOrderA._id}/shipments`)
        .set("Authorization", `Bearer ${vendorBToken}`)
        .set("Idempotency-Key", `idemp-tenanta-${Date.now()}`)
        .send({
          carrier: "BlueDart",
          warehouseId: warehouse._id.toString(),
        });

      // Vendor B has no items in Vendor A's order
      expect([403, 404, 409]).toContain(res.status);
    });

    it("ALLOWS superadmin staff token to access vendor shipments via admin control plane", async () => {
      // Superadmin can inspect vendor shipments using administrative permissions
      const res = await request(app)
        .get(`/api/v1/shipments/vendor/${vendorA._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });
});
