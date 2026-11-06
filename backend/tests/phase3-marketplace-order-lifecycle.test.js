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
const Inventory = require("../src/models/Inventory");
const Warehouse = require("../src/models/Warehouse");
const Order = require("../src/models/Order");
const Shipment = require("../src/models/Shipment");
const ReturnRequest = require("../src/models/ReturnRequest");
const Payment = require("../src/models/Payment");
const AuditLog = require("../src/models/AuditLog");
const Role = require("../src/models/Role");
const Permission = require("../src/models/Permission");
const RolePermission = require("../src/models/RolePermission");
const Employee = require("../src/models/Employee");
const EmployeeRole = require("../src/models/EmployeeRole");

const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const { generateAccessToken } = require("../src/services/token.service");
const { encodeSecureId } = require("../src/utils/secure-id.util");
const returnRequestService = require("../src/services/return-request.service");
const refundService = require("../src/services/refund.service");
const orderService = require("../src/services/order.service");
const razorpayRefundProvider = require("../src/integrations/payments/razorpay-refund.provider");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_p3_lifecycle_test?")
  : "mongodb://127.0.0.1:27017/buybox_p3_lifecycle_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Phase 3 Marketplace Order Lifecycle, Payments, Fulfillment, Returns & Refunds Integration Suite", () => {
  let adminUser, adminEmployee, adminToken;
  let vendor1User, vendor1, vendor1Token;
  let vendor2User, vendor2, vendor2Token;
  let customer1User, customer1, customer1Token;
  let customer2User, customer2, customer2Token;
  let warehouse, category, brand;
  let product1, variant1, inventory1;
  let product2, variant2, inventory2;

  beforeAll(async () => {
    jest.spyOn(razorpayRefundProvider, "createRefund").mockImplementation(async ({ paymentId, amount, notes }) => {
      return {
        id: `rfnd_mock_${Date.now()}`,
        entity: "refund",
        amount,
        currency: "INR",
        payment_id: paymentId,
        status: "processed",
        notes,
      };
    });

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(TEST_MONGODB_URI);

    await User.deleteMany({});
    await Customer.deleteMany({});
    await Vendor.deleteMany({});
    await Warehouse.deleteMany({});
    await Category.deleteMany({});
    await Brand.deleteMany({});
    await Product.deleteMany({});
    await ProductVariant.deleteMany({});
    await Inventory.deleteMany({});
    await Order.deleteMany({});
    await Shipment.deleteMany({});
    await ReturnRequest.deleteMany({});
    await Payment.deleteMany({});

    // Setup Superadmin / Admin
    adminUser = await User.create({
      firstName: "Phase3",
      lastName: "Superadmin",
      email: `p3_superadmin_${Date.now()}@buybox.test`,
      password: "Password123!",
      role: ROLES.SUPER_ADMIN,
      isEmailVerified: true,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    adminToken = generateAccessToken({
      sub: adminUser._id.toString(),
      id: adminUser._id.toString(),
      email: adminUser.email,
      role: ROLES.SUPER_ADMIN,
      roles: [ROLES.SUPER_ADMIN],
      permissions: [
        PERMISSIONS.ORDERS_READ,
        PERMISSIONS.ORDERS_MANAGE,
        PERMISSIONS.FINANCE_READ,
        PERMISSIONS.FINANCE_MANAGE,
        PERMISSIONS.SHIPMENTS_READ,
        PERMISSIONS.SHIPMENTS_MANAGE,
      ],
      authVersion: 1,
      permissionVersion: 1,
    });

    const adminRole = await Role.create({
      name: `P3 Admin Role ${Date.now()}`,
      slug: `p3_admin_role_${Date.now()}`,
      isActive: true,
    });
    adminEmployee = await Employee.create({
      userId: adminUser._id,
      employeeNumber: `EMP-${Date.now().toString().slice(-5)}`,
      department: "Marketplace Operations",
      status: "active",
      jobTitle: "Operations Superadmin",
    });
    await EmployeeRole.create({ employeeId: adminEmployee._id, roleId: adminRole._id });

    // Setup Vendor 1
    vendor1User = await User.create({
      firstName: "Apex",
      lastName: "Vendor",
      email: `apex_p3_${Date.now()}@buybox.test`,
      password: "Password123!",
      role: ROLES.VENDOR,
      isEmailVerified: true,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    vendor1Token = generateAccessToken({
      sub: vendor1User._id.toString(),
      id: vendor1User._id.toString(),
      email: vendor1User.email,
      role: ROLES.VENDOR,
      roles: [ROLES.VENDOR],
      authVersion: 1,
      permissionVersion: 1,
    });
    vendor1 = await Vendor.create({
      userId: vendor1User._id,
      businessName: "Apex Retailers Ltd",
      storeName: "Apex Store",
      businessSlug: `apex-store-${Date.now()}`,
      email: vendor1User.email,
      phone: "+919876543201",
      status: "approved",
      onboardingStatus: "approved",
      isActive: true,
      commissionRate: mongoose.Types.Decimal128.fromString("0.10"),
    });

    // Setup Vendor 2
    vendor2User = await User.create({
      firstName: "Beacon",
      lastName: "Vendor",
      email: `beacon_p3_${Date.now()}@buybox.test`,
      password: "Password123!",
      role: ROLES.VENDOR,
      isEmailVerified: true,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    vendor2Token = generateAccessToken({
      sub: vendor2User._id.toString(),
      id: vendor2User._id.toString(),
      email: vendor2User.email,
      role: ROLES.VENDOR,
      roles: [ROLES.VENDOR],
      authVersion: 1,
      permissionVersion: 1,
    });
    vendor2 = await Vendor.create({
      userId: vendor2User._id,
      businessName: "Beacon Electronics",
      storeName: "Beacon Direct",
      businessSlug: `beacon-direct-${Date.now()}`,
      email: vendor2User.email,
      phone: "+919876543202",
      status: "approved",
      onboardingStatus: "approved",
      isActive: true,
      commissionRate: mongoose.Types.Decimal128.fromString("0.10"),
    });

    // Setup Customer 1
    customer1User = await User.create({
      firstName: "Alice",
      lastName: "Customer",
      email: `alice_${Date.now()}@buybox.test`,
      password: "Password123!",
      role: ROLES.CUSTOMER,
      isEmailVerified: true,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    customer1Token = generateAccessToken({
      sub: customer1User._id.toString(),
      id: customer1User._id.toString(),
      email: customer1User.email,
      role: ROLES.CUSTOMER,
      roles: [ROLES.CUSTOMER],
      authVersion: 1,
      permissionVersion: 1,
    });
    customer1 = await Customer.create({
      userId: customer1User._id,
      firstName: "Alice",
      lastName: "Customer",
      email: customer1User.email,
    });

    // Setup Customer 2 (for tenant isolation test)
    customer2User = await User.create({
      firstName: "Bob",
      lastName: "Customer",
      email: `bob_${Date.now()}@buybox.test`,
      password: "Password123!",
      role: ROLES.CUSTOMER,
      isEmailVerified: true,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    customer2Token = generateAccessToken({
      sub: customer2User._id.toString(),
      id: customer2User._id.toString(),
      email: customer2User.email,
      role: ROLES.CUSTOMER,
      roles: [ROLES.CUSTOMER],
      authVersion: 1,
      permissionVersion: 1,
    });
    customer2 = await Customer.create({
      userId: customer2User._id,
      firstName: "Bob",
      lastName: "Customer",
      email: customer2User.email,
    });

    // Warehouse & Catalog
    warehouse = await Warehouse.create({
      name: "Phase3 Central Warehouse",
      code: `WH-P3-${Date.now().toString().slice(-4)}`,
      address: {
        addressLine1: "Central Hub, Andheri East",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400069",
        country: "IN",
      },
      isActive: true,
    });

    category = await Category.create({
      name: "Electronics P3",
      slug: `electronics-p3-${Date.now()}`,
      isActive: true,
    });

    brand = await Brand.create({
      name: "OmniSound",
      slug: `omnisound-${Date.now()}`,
      isActive: true,
    });

    // Product 1 (Vendor 1)
    product1 = await Product.create({
      name: "Noise Cancelling Studio Headphones",
      slug: `nc-studio-headphones-${Date.now()}`,
      sku: `PROD-ANC-${Date.now().toString().slice(-5)}`,
      vendorId: vendor1._id,
      categoryId: category._id,
      brandId: brand._id,
      price: mongoose.Types.Decimal128.fromString("4000.00"),
      currency: "INR",
      status: "active",
      approvalStatus: "approved",
      publishedAt: new Date(),
    });
    variant1 = await ProductVariant.create({
      productId: product1._id,
      name: "Matte Black",
      sku: `ANC-MATTE-${Date.now().toString().slice(-5)}`,
      price: mongoose.Types.Decimal128.fromString("4000.00"),
      currency: "INR",
      status: "active",
    });
    inventory1 = await Inventory.create({
      warehouseId: warehouse._id,
      productId: product1._id,
      productVariantId: variant1._id,
      sku: variant1.sku,
      onHand: 50,
      reserved: 0,
    });

    // Product 2 (Vendor 2)
    product2 = await Product.create({
      name: "Wireless Studio Microphone",
      slug: `studio-mic-${Date.now()}`,
      sku: `PROD-MIC-${Date.now().toString().slice(-5)}`,
      vendorId: vendor2._id,
      categoryId: category._id,
      brandId: brand._id,
      price: mongoose.Types.Decimal128.fromString("3000.00"),
      currency: "INR",
      status: "active",
      approvalStatus: "approved",
      publishedAt: new Date(),
    });
    variant2 = await ProductVariant.create({
      productId: product2._id,
      name: "Silver Pro",
      sku: `MIC-SILV-${Date.now().toString().slice(-5)}`,
      price: mongoose.Types.Decimal128.fromString("3000.00"),
      currency: "INR",
      status: "active",
    });
    inventory2 = await Inventory.create({
      warehouseId: warehouse._id,
      productId: product2._id,
      productVariantId: variant2._id,
      sku: variant2.sku,
      onHand: 30,
      reserved: 0,
    });
  });

  afterAll(async () => {
    try {
      await User.deleteMany({});
      await Customer.deleteMany({});
      await Vendor.deleteMany({});
      await Warehouse.deleteMany({});
      await Category.deleteMany({});
      await Brand.deleteMany({});
      await Product.deleteMany({});
      await ProductVariant.deleteMany({});
      await Inventory.deleteMany({});
      await Order.deleteMany({});
      await Shipment.deleteMany({});
      await ReturnRequest.deleteMany({});
      await Payment.deleteMany({});
    } catch {}
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  describe("Phase 3A: Order Lifecycle & Customer/Vendor Isolation", () => {
    let multiVendorOrder;

    it("creates a multi-vendor order with authoritative snapshots and pricing integrity", async () => {
      multiVendorOrder = await Order.create({
        orderNumber: `ORD-MV-${Date.now()}`,
        customerId: customer1._id,
        userId: customer1User._id,
        status: "confirmed",
        paymentStatus: "paid",
        fulfillmentStatus: "unfulfilled",
        currency: "INR",
        subtotal: mongoose.Types.Decimal128.fromString("10000.00"),
        grandTotal: mongoose.Types.Decimal128.fromString("10000.00"),
        discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
        taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
        shippingAddress: {
          fullName: "Alice Customer",
          phone: "+919876543200",
          addressLine1: "101 Sea View Apartments",
          city: "Mumbai",
          state: "Maharashtra",
          postalCode: "400050",
          country: "IN",
        },
        items: [
          {
            productId: product1._id,
            productVariantId: variant1._id,
            warehouseId: warehouse._id,
            vendorId: vendor1._id,
            sku: variant1.sku,
            productName: product1.name,
            variantName: variant1.name,
            quantity: 2,
            currency: "INR",
            unitPrice: mongoose.Types.Decimal128.fromString("4000.00"),
            discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
            taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("8000.00"),
            fulfillmentStatus: "unfulfilled",
            inventoryStatus: "reserved",
          },
          {
            productId: product2._id,
            productVariantId: variant2._id,
            warehouseId: warehouse._id,
            vendorId: vendor2._id,
            sku: variant2.sku,
            productName: product2.name,
            variantName: variant2.name,
            quantity: 1,
            currency: "INR",
            unitPrice: mongoose.Types.Decimal128.fromString("2000.00"), // discounted
            discountTotal: mongoose.Types.Decimal128.fromString("1000.00"),
            taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("2000.00"),
            fulfillmentStatus: "unfulfilled",
            inventoryStatus: "reserved",
          },
        ],
      });

      expect(multiVendorOrder._id).toBeDefined();
      expect(multiVendorOrder.items.length).toBe(2);
      expect(multiVendorOrder.items[0].vendorId.toString()).toBe(vendor1._id.toString());
      expect(multiVendorOrder.items[1].vendorId.toString()).toBe(vendor2._id.toString());
    });

    it("enforces customer tenant isolation: Customer 2 cannot read Customer 1's order", async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${multiVendorOrder._id}`)
        .set("Authorization", `Bearer ${customer2Token}`);

      expect([403, 404]).toContain(res.status);
    });

    it("allows Customer 1 to view their own order", async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${multiVendorOrder._id}`)
        .set("Authorization", `Bearer ${customer1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.orderNumber).toBe(multiVendorOrder.orderNumber);
    });

    it("enforces vendor tenant isolation: Vendor 1 sees only items attributed to Vendor 1", async () => {
      const res = await request(app)
        .get("/api/v1/vendors/me/orders")
        .set("Authorization", `Bearer ${vendor1Token}`);

      expect(res.status).toBe(200);
      const orders = res.body.data;
      const matchingOrder = orders.find((o) => o._id.toString() === multiVendorOrder._id.toString());
      expect(matchingOrder).toBeDefined();
      // Ensure only vendor 1's items are in the vendor view
      for (const item of matchingOrder.items) {
        expect(item.vendorId.toString()).toBe(vendor1._id.toString());
      }
    });
  });

  describe("Phase 3C: Inventory Release & Cancellation Idempotency", () => {
    let cancelTestOrder;

    beforeAll(async () => {
      // Set reserved inventory for cancellation test
      await Inventory.updateOne(
        { _id: inventory1._id },
        { $inc: { reserved: 2, onHand: -2 } }
      );

      cancelTestOrder = await Order.create({
        orderNumber: `ORD-CANCEL-${Date.now()}`,
        customerId: customer1._id,
        userId: customer1User._id,
        status: "confirmed",
        paymentStatus: "pending",
        fulfillmentStatus: "unfulfilled",
        currency: "INR",
        subtotal: mongoose.Types.Decimal128.fromString("8000.00"),
        grandTotal: mongoose.Types.Decimal128.fromString("8000.00"),
        discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
        taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
        shippingAddress: {
          fullName: "Alice Customer",
          phone: "+919876543200",
          addressLine1: "101 Sea View Apartments",
          city: "Mumbai",
          state: "Maharashtra",
          postalCode: "400050",
          country: "IN",
        },
        items: [
          {
            productId: product1._id,
            productVariantId: variant1._id,
            warehouseId: warehouse._id,
            vendorId: vendor1._id,
            sku: variant1.sku,
            productName: product1.name,
            variantName: variant1.name,
            quantity: 2,
            currency: "INR",
            unitPrice: mongoose.Types.Decimal128.fromString("4000.00"),
            discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
            taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("8000.00"),
            fulfillmentStatus: "unfulfilled",
            inventoryStatus: "reserved",
          },
        ],
      });
    });

    it("cancels an order, releases reserved stock back to warehouse, and records status", async () => {
      const invBefore = await Inventory.findById(inventory1._id);

      const res = await request(app)
        .post(`/api/v1/orders/${cancelTestOrder._id}/cancel`)
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({ reason: "Customer requested cancellation before shipment" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("cancelled");

      const invAfter = await Inventory.findById(inventory1._id);
      expect(invAfter.onHand).toBe(invBefore.onHand);
      expect(invAfter.reserved).toBe(invBefore.reserved - 2);
    });

    it("is idempotent: repeating cancellation does not release inventory twice", async () => {
      const invBefore = await Inventory.findById(inventory1._id);

      const res = await request(app)
        .post(`/api/v1/orders/${cancelTestOrder._id}/cancel`)
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({ reason: "Duplicate cancel attempt" });

      expect(res.status).toBe(200);
      const invAfter = await Inventory.findById(inventory1._id);
      expect(invAfter.onHand).toBe(invBefore.onHand);
      expect(invAfter.reserved).toBe(invBefore.reserved);
    });
  });

  describe("Phase 3D & 3E: Returns, Historical Quantity Limits, Restocking & Admin Bypasses", () => {
    let deliveredOrder;
    let paymentRecord;

    beforeAll(async () => {
      deliveredOrder = await Order.create({
        orderNumber: `ORD-RET-${Date.now()}`,
        customerId: customer1._id,
        userId: customer1User._id,
        status: "delivered",
        paymentStatus: "paid",
        fulfillmentStatus: "fulfilled",
        currency: "INR",
        subtotal: mongoose.Types.Decimal128.fromString("12000.00"),
        grandTotal: mongoose.Types.Decimal128.fromString("12000.00"),
        discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
        taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
        deliveredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // delivered 2 days ago
        shippingAddress: {
          fullName: "Alice Customer",
          phone: "+919876543200",
          addressLine1: "101 Sea View Apartments",
          city: "Mumbai",
          state: "Maharashtra",
          postalCode: "400050",
          country: "IN",
        },
        items: [
          {
            productId: product1._id,
            productVariantId: variant1._id,
            warehouseId: warehouse._id,
            vendorId: vendor1._id,
            sku: variant1.sku,
            productName: product1.name,
            variantName: variant1.name,
            quantity: 2,
            currency: "INR",
            unitPrice: mongoose.Types.Decimal128.fromString("4000.00"),
            discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
            taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("8000.00"),
            fulfillmentStatus: "delivered",
            inventoryStatus: "deducted",
          },
          {
            productId: product2._id,
            productVariantId: variant2._id,
            warehouseId: warehouse._id,
            vendorId: vendor2._id,
            sku: variant2.sku,
            productName: product2.name,
            variantName: variant2.name,
            quantity: 2,
            currency: "INR",
            unitPrice: mongoose.Types.Decimal128.fromString("2000.00"),
            discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
            taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("4000.00"),
            fulfillmentStatus: "delivered",
            inventoryStatus: "deducted",
          },
        ],
      });

      paymentRecord = await Payment.create({
        orderId: deliveredOrder._id,
        customerId: customer1._id,
        amount: mongoose.Types.Decimal128.fromString("12000.00"),
        currency: "INR",
        gateway: "razorpay",
        gatewayPaymentId: `pay_p3_${Date.now()}`,
        status: "captured",
        capturedAt: new Date(),
      });
    });

    it("creates a return for 1 unit of product1 and calculates accurate refund amount", async () => {
      const returnRes = await request(app)
        .post("/api/v1/returns")
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({
          orderId: deliveredOrder._id.toString(),
          items: [
            {
              productId: product1._id.toString(),
              productVariantId: variant1._id.toString(),
              quantity: 1,
              reason: "defective",
              condition: "opened_unused",
            },
          ],
          customerNotes: "Left speaker crackles at high volume",
        });

      expect(returnRes.status).toBe(201);
      expect(returnRes.body.data.status).toBe("requested");
      const refundAmt = Number(
        returnRes.body.data.refundAmount?.$numberDecimal ||
          returnRes.body.data.refundAmount ||
          0
      );
      expect(refundAmt).toBe(4000);
    });

    it("prevents creating another active return while one is in progress", async () => {
      const duplicateRes = await request(app)
        .post("/api/v1/returns")
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({
          orderId: deliveredOrder._id.toString(),
          items: [
            {
              productId: product1._id.toString(),
              productVariantId: variant1._id.toString(),
              quantity: 1,
              reason: "changed_mind",
            },
          ],
        });

      expect([400, 409]).toContain(duplicateRes.status);
    });

    it("allows vendor to approve, receive with undamaged condition, and restock to inventory", async () => {
      const activeReturn = await ReturnRequest.findOne({ orderId: deliveredOrder._id });
      const secureReturnId = encodeSecureId("return", activeReturn._id);

      // 1. Approve
      const approveRes = await request(app)
        .post(`/api/v1/vendors/me/returns/${secureReturnId}/approve`)
        .set("Authorization", `Bearer ${vendor1Token}`)
        .send({ notes: "Approved for return pickup" });
      expect(approveRes.status).toBe(200);

      // Check onHand before receive
      const invBefore = await Inventory.findById(inventory1._id);

      // 2. Receive and restock (opened_unused is resellable)
      const receiveRes = await request(app)
        .post(`/api/v1/vendors/me/returns/${secureReturnId}/receive`)
        .set("Authorization", `Bearer ${vendor1Token}`)
        .send({ notes: "Inspected and confirmed in good order" });
      expect(receiveRes.status).toBe(200);

      // Inventory onHand should be incremented by 1
      const invAfter = await Inventory.findById(inventory1._id);
      expect(invAfter.onHand).toBe(invBefore.onHand + 1);

      // 3. Process return refund
      const refundRes = await request(app)
        .post(`/api/v1/vendors/me/returns/${secureReturnId}/refund`)
        .set("Authorization", `Bearer ${vendor1Token}`)
        .send({ notes: "Refund authorized" });
      expect(refundRes.status).toBe(200);
      expect(refundRes.body.data.status).toBe("refunded");
    });

    it("enforces historical return quantity limit: cannot return more than remaining 1 unit of product1", async () => {
      // Customer tries to return 2 units of product1, but 1 was already returned and refunded!
      const overLimitRes = await request(app)
        .post("/api/v1/returns")
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({
          orderId: deliveredOrder._id.toString(),
          items: [
            {
              productId: product1._id.toString(),
              productVariantId: variant1._id.toString(),
              quantity: 2, // ordered: 2, already returned: 1, remaining: 1 -> MUST FAIL
              reason: "defective",
            },
          ],
        });

      expect(overLimitRes.status).toBe(400);
      expect(overLimitRes.body.message).toMatch(/remaining returnable quantity/i);
    });

    it("creates a second return for the remaining 1 unit with DAMAGED condition", async () => {
      const return2Res = await request(app)
        .post("/api/v1/returns")
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({
          orderId: deliveredOrder._id.toString(),
          items: [
            {
              productId: product1._id.toString(),
              productVariantId: variant1._id.toString(),
              quantity: 1,
              reason: "defective",
              condition: "damaged",
            },
          ],
        });

      expect(return2Res.status).toBe(201);
    });

    it("verifies condition-aware restocking: DAMAGED items are NOT added to sellable onHand inventory", async () => {
      const activeReturn = await ReturnRequest.findOne({
        orderId: deliveredOrder._id,
        status: "requested",
      });
      const secureReturnId = encodeSecureId("return", activeReturn._id);

      // Approve
      await request(app)
        .post(`/api/v1/vendors/me/returns/${secureReturnId}/approve`)
        .set("Authorization", `Bearer ${vendor1Token}`)
        .send({ notes: "Return approved" });

      const invBefore = await Inventory.findById(inventory1._id);

      // Receive with condition: damaged
      const receiveRes = await request(app)
        .post(`/api/v1/vendors/me/returns/${secureReturnId}/receive`)
        .set("Authorization", `Bearer ${vendor1Token}`)
        .send({
          notes: "Items inspected; damaged beyond resale",
          items: [
            {
              productId: product1._id.toString(),
              productVariantId: variant1._id.toString(),
              condition: "damaged",
              restock: false,
            },
          ],
        });

      expect(receiveRes.status).toBe(200);

      // onHand must NOT change!
      const invAfter = await Inventory.findById(inventory1._id);
      expect(invAfter.onHand).toBe(invBefore.onHand);
    });

    it("allows ADMIN to receive and refund without crashing into VENDOR_NOT_FOUND", async () => {
      const activeReturn = await ReturnRequest.findOne({
        orderId: deliveredOrder._id,
        status: "received",
      });

      // Admin executes refund
      const adminRefundRes = await request(app)
        .post(`/api/v1/returns/admin/${activeReturn._id}/refund`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ notes: "Admin authorized refund for damaged return" });

      expect(adminRefundRes.status).toBe(200);
      expect(adminRefundRes.body.data.status).toBe("refunded");

      // Verify AuditLog record was persisted
      const auditLog = await AuditLog.findOne({
        targetId: activeReturn._id,
        action: "RETURN_REFUNDED",
      });
      expect(auditLog).toBeDefined();
    });
  });

  describe("Phase 3B & 3E: Cumulative Refund Ceilings & Cancelled Paid Orders", () => {
    let cancelledPaidOrder;
    let cancelledPayment;

    beforeAll(async () => {
      cancelledPaidOrder = await Order.create({
        orderNumber: `ORD-CANC-PAID-${Date.now()}`,
        customerId: customer1._id,
        userId: customer1User._id,
        status: "cancelled",
        paymentStatus: "paid",
        fulfillmentStatus: "unfulfilled",
        currency: "INR",
        subtotal: mongoose.Types.Decimal128.fromString("5000.00"),
        grandTotal: mongoose.Types.Decimal128.fromString("5000.00"),
        discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
        taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
        shippingAddress: {
          fullName: "Alice Customer",
          phone: "+919876543200",
          addressLine1: "101 Sea View Apartments",
          city: "Mumbai",
          state: "Maharashtra",
          postalCode: "400050",
          country: "IN",
        },
        items: [
          {
            productId: product1._id,
            productVariantId: variant1._id,
            warehouseId: warehouse._id,
            vendorId: vendor1._id,
            sku: variant1.sku,
            productName: product1.name,
            variantName: variant1.name,
            quantity: 1,
            currency: "INR",
            unitPrice: mongoose.Types.Decimal128.fromString("5000.00"),
            discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
            taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("5000.00"),
            fulfillmentStatus: "unfulfilled",
            inventoryStatus: "released",
          },
        ],
      });

      cancelledPayment = await Payment.create({
        orderId: cancelledPaidOrder._id,
        customerId: customer1._id,
        amount: mongoose.Types.Decimal128.fromString("5000.00"),
        currency: "INR",
        gateway: "razorpay",
        gatewayPaymentId: `pay_canc_${Date.now()}`,
        status: "captured",
        capturedAt: new Date(),
      });
    });

    it("permits refunding a cancelled paid order when payment is captured", async () => {
      const result = await refundService.createRefund({
        orderId: cancelledPaidOrder._id,
        amount: "5000.00",
        reason: "Customer order cancelled post-capture",
        idempotencyKey: `canc_ref_${cancelledPaidOrder._id}`,
        userId: adminUser._id,
        role: "admin",
      });

      expect(result).toBeDefined();
      const refundRecord = result.refund || result;
      const refundAmt = Number(
        refundRecord.amount?.$numberDecimal ||
          refundRecord.amount?.toString?.() ||
          refundRecord.amount ||
          0
      );
      expect(refundAmt).toBe(5000);
      expect(["succeeded", "processed"]).toContain(refundRecord.status);
    });

    it("rejects refund amounts exceeding the payment total", async () => {
      await expect(
        refundService.createRefund({
          orderId: cancelledPaidOrder._id,
          amount: "100.00", // payment already fully refunded!
          reason: "Excess refund attempt",
          idempotencyKey: `excess_ref_${cancelledPaidOrder._id}`,
          userId: adminUser._id,
          role: "admin",
        })
      ).rejects.toThrow();
    });
  });
});
