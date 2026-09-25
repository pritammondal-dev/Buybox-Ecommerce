const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Employee = require("../src/models/Employee");
const Role = require("../src/models/Role");
const Permission = require("../src/models/Permission");
const RolePermission = require("../src/models/RolePermission");
const EmployeeRole = require("../src/models/EmployeeRole");
const Customer = require("../src/models/Customer");
const Order = require("../src/models/Order");
const Payment = require("../src/models/Payment");
const PaymentMethod = require("../src/models/PaymentMethod");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { generateAccessToken } = require("../src/services/token.service");
const paypalProvider = require("../src/integrations/payments/paypal.provider");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_payment_system_test?")
  : "mongodb://127.0.0.1:27017/buybox_payment_system_test?replicaSet=rs0";

describe("Payment Management System Tests", () => {
  jest.setTimeout(35000);

  let adminUser;
  let adminToken;
  let regularUser;
  let regularToken;
  let testCustomer;
  let testOrder;

  async function getOrCreatePermission(slug) {
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
    return perm;
  }

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    const paymentsManagePerm = await getOrCreatePermission(PERMISSIONS.PAYMENTS_MANAGE);
    const paymentsReadPerm = await getOrCreatePermission(PERMISSIONS.PAYMENTS_READ);

    let adminRole = await Role.findOne({ slug: "payment-system-admin" });
    if (!adminRole) {
      adminRole = await Role.create({
        slug: "payment-system-admin",
        name: "Payment System Admin",
        description: "Admin for payments",
        isActive: true,
      });
    }

    await RolePermission.findOneAndUpdate(
      { roleId: adminRole._id, permissionId: paymentsManagePerm._id },
      { $setOnInsert: { isActive: true } },
      { upsert: true }
    );
    await RolePermission.findOneAndUpdate(
      { roleId: adminRole._id, permissionId: paymentsReadPerm._id },
      { $setOnInsert: { isActive: true } },
      { upsert: true }
    );

    const adminEmail = `paymentadmin_${Date.now()}_${Math.random().toString(36).substring(7)}@buybox.test`;
    adminUser = await User.create({
      email: adminEmail,
      password: "Password123!",
      firstName: "Payment",
      lastName: "Admin",
      role: "admin",
      isActive: true,
      isEmailVerified: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const employee = await Employee.create({
      userId: adminUser._id,
      employeeNumber: `EMP_PAY_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`,
      jobTitle: "Payment Manager",
      department: "Finance",
      status: "active",
    });

    await EmployeeRole.create({
      employeeId: employee._id,
      roleId: adminRole._id,
      isActive: true,
    });

    adminToken = generateAccessToken({
      sub: adminUser._id.toString(),
      id: adminUser._id.toString(),
      email: adminUser.email,
      role: adminUser.role,
    });

    const regularEmail = `customer_${Date.now()}_${Math.random().toString(36).substring(7)}@buybox.test`;
    regularUser = await User.create({
      email: regularEmail,
      password: "Password123!",
      firstName: "Jane",
      lastName: "Customer",
      role: "customer",
      isActive: true,
      isEmailVerified: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    testCustomer = await Customer.create({
      userId: regularUser._id,
      phone: "+919876543210",
      isActive: true,
    });

    regularToken = generateAccessToken({
      sub: regularUser._id.toString(),
      id: regularUser._id.toString(),
      email: regularUser.email,
      role: regularUser.role,
    });


    testOrder = await Order.create({
      orderNumber: `ORD-PAY-${Date.now().toString().slice(-6)}`,
      customerId: testCustomer._id,
      items: [
        {
          productId: new mongoose.Types.ObjectId(),
          productVariantId: new mongoose.Types.ObjectId(),
          warehouseId: new mongoose.Types.ObjectId(),
          vendorId: new mongoose.Types.ObjectId(),
          productName: "Test Wireless Headphones",
          sku: "HEADPHONES-01",
          quantity: 1,
          unitPrice: "1999.00",
          discountTotal: "0.00",
          taxTotal: "0.00",
          lineTotal: "1999.00",
          currency: "INR",
        },
      ],
      shippingAddress: {
        fullName: "Jane Customer",
        phone: "+919876543210",
        addressLine1: "123 High Street",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "IN",
      },
      subtotal: "1999.00",
      shippingFee: "0.00",
      taxTotal: "0.00",
      discountTotal: "0.00",
      grandTotal: "1999.00",
      currency: "INR",
      paymentMethod: "razorpay",
      paymentStatus: "pending",
      status: "pending",
    });
  });

  afterAll(async () => {
    await PaymentMethod.deleteMany({});
    await Order.deleteMany({ orderNumber: { $regex: /^ORD-PAY-/ } });
    await Payment.deleteMany({ customerId: testCustomer?._id });
    await Customer.deleteMany({ _id: testCustomer?._id });
    await User.deleteMany({ _id: { $in: [adminUser?._id, regularUser?._id].filter(Boolean) } });
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe("Customer Storefront Payment Methods API", () => {
    it("should return available payment methods and auto-seed defaults if collection was empty", async () => {
      const res = await request(app)
        .get("/api/v1/payment-methods/available")
        .query({ country: "IN", currency: "INR", orderAmount: "1999" });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      // Verify COD is NOT enabled by default
      const codMethod = res.body.data.find((m) => m.code === "cod");
      expect(codMethod).toBeUndefined();

      // Verify active methods exist like upi, card
      const upiMethod = res.body.data.find((m) => m.code === "upi");
      expect(upiMethod).toBeDefined();
      expect(upiMethod.enabled).toBe(true);

      // Verify no sensitive keys leaked
      res.body.data.forEach((m) => {
        if (m.gatewayConfig?.keySecret) {
          expect(m.gatewayConfig.keySecret).toContain("***");
        }
      });
    });

    it("should also be accessible via the alias /api/v1/payments/methods/available", async () => {
      const res = await request(app)
        .get("/api/v1/payments/methods/available")
        .query({ country: "IN", currency: "INR" });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("should filter out methods exceeding maximumOrderAmount or below minimumOrderAmount", async () => {
      // Create a micro-payment method with max amount 500
      await PaymentMethod.create({
        name: "Micro UPI",
        code: "micro_upi_test",
        gateway: "razorpay",
        type: "upi",
        description: "For small payments",
        enabled: true,
        displayOrder: 99,
        supportedCountries: ["IN"],
        supportedCurrencies: ["INR"],
        minimumOrderAmount: 1,
        maximumOrderAmount: 500,
      });

      const resSmall = await request(app)
        .get("/api/v1/payment-methods/available")
        .query({ country: "IN", currency: "INR", orderAmount: "200" });

      const foundInSmall = resSmall.body.data.find((m) => m.code === "micro_upi_test");
      expect(foundInSmall).toBeDefined();

      const resLarge = await request(app)
        .get("/api/v1/payment-methods/available")
        .query({ country: "IN", currency: "INR", orderAmount: "1000" });

      const foundInLarge = resLarge.body.data.find((m) => m.code === "micro_upi_test");
      expect(foundInLarge).toBeUndefined();
    });
  });

  describe("Admin Payment Method Management API", () => {
    it("should block non-admin users with 403 from listing all methods for admin", async () => {
      const res = await request(app)
        .get("/api/v1/payment-methods")
        .set("Authorization", `Bearer ${regularToken}`);

      expect(res.statusCode).toBe(403);
    });

    it("should allow admin with PAYMENTS_MANAGE to list all methods including disabled ones", async () => {
      const res = await request(app)
        .get("/api/v1/payment-methods")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const codMethod = res.body.data.find((m) => m.code === "cod");
      expect(codMethod).toBeDefined();
      expect(codMethod.enabled).toBe(false);
    });

    it("should allow admin to create a new custom payment method", async () => {
      const res = await request(app)
        .post("/api/v1/payment-methods")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Axis Bank Direct",
          code: "axis_netbanking_custom",
          gateway: "razorpay",
          type: "netbanking",
          description: "Instant net banking with Axis Bank",
          enabled: true,
          displayOrder: 15,
          supportedCountries: ["IN"],
          supportedCurrencies: ["INR"],
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.code).toBe("axis_netbanking_custom");
    });

    it("should allow admin to update a payment method", async () => {
      const method = await PaymentMethod.findOne({ code: "axis_netbanking_custom" });

      const res = await request(app)
        .patch(`/api/v1/payment-methods/${method._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          description: "Updated Axis Bank direct netbanking description",
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.description).toBe("Updated Axis Bank direct netbanking description");
    });

    it("should allow admin to toggle payment method active status", async () => {
      const method = await PaymentMethod.findOne({ code: "axis_netbanking_custom" });

      const resDeactivate = await request(app)
        .patch(`/api/v1/payment-methods/${method._id}/toggle`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(resDeactivate.statusCode).toBe(200);
      expect(resDeactivate.body.data.enabled).toBe(false);

      const resActivate = await request(app)
        .patch(`/api/v1/payment-methods/${method._id}/toggle`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(resActivate.statusCode).toBe(200);
      expect(resActivate.body.data.enabled).toBe(true);
    });

    it("should allow admin to reorder payment methods", async () => {
      const methods = await PaymentMethod.find({ isDeleted: false }).limit(3);
      const reversedIds = methods.map((m) => m._id.toString()).reverse();

      const res = await request(app)
        .post("/api/v1/payment-methods/reorder")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ orderedIds: reversedIds });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should soft-delete a payment method preserving historical records", async () => {
      const method = await PaymentMethod.findOne({ code: "axis_netbanking_custom" });

      const res = await request(app)
        .delete(`/api/v1/payment-methods/${method._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.softDeleted).toBe(true);

      const deletedMethod = await PaymentMethod.findById(method._id);
      expect(deletedMethod.isDeleted).toBe(true);
      expect(deletedMethod.enabled).toBe(false);
    });
  });

  describe("PayPal Payment Integration", () => {
    it("should reject PayPal order creation if PayPal is not configured", async () => {
      jest.spyOn(paypalProvider, "isConfigured").mockReturnValue(false);

      const res = await request(app)
        .post(`/api/v1/payments/paypal/orders/${testOrder._id}`)
        .set("Authorization", `Bearer ${regularToken}`);

      expect(res.statusCode).toBe(503);
      expect(res.body.message).toContain("PayPal");

      paypalProvider.isConfigured.mockRestore();
    });

    it("should create PayPal order when configured", async () => {
      jest.spyOn(paypalProvider, "isConfigured").mockReturnValue(true);
      jest.spyOn(paypalProvider, "createOrder").mockResolvedValue({
        id: "PAYPAL-ORDER-123456",
        status: "CREATED",
        links: [{ rel: "approve", href: "https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-ORDER-123456" }],
      });

      const res = await request(app)
        .post(`/api/v1/payments/paypal/orders/${testOrder._id}`)
        .set("Authorization", `Bearer ${regularToken}`);

      expect(res.statusCode).toBe(201);
      expect(res.body.data.gatewayOrderId).toBe("PAYPAL-ORDER-123456");
      expect(res.body.data.gateway).toBe("paypal");

      paypalProvider.createOrder.mockRestore();
      paypalProvider.isConfigured.mockRestore();
    });

    it("should capture PayPal payment and mark order paid", async () => {
      jest.spyOn(paypalProvider, "captureOrder").mockResolvedValue({
        id: "PAYPAL-ORDER-123456",
        status: "COMPLETED",
        purchase_units: [
          {
            payments: {
              captures: [
                {
                  id: "PAYPAL-CAPTURE-789012",
                  status: "COMPLETED",
                },
              ],
            },
          },
        ],
      });

      const res = await request(app)
        .post("/api/v1/payments/paypal/capture")
        .set("Authorization", `Bearer ${regularToken}`)
        .send({
          orderId: testOrder._id.toString(),
          paypalOrderId: "PAYPAL-ORDER-123456",
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.status).toBe("captured");
      expect(res.body.data.gatewayPaymentId).toBe("PAYPAL-CAPTURE-789012");

      const refreshedOrder = await Order.findById(testOrder._id);
      expect(refreshedOrder.paymentStatus).toBe("paid");

      paypalProvider.captureOrder.mockRestore();
    });
  });

  describe("Admin Payment Transactions Listing API", () => {
    it("should allow admin with PAYMENTS_READ to retrieve paginated payment transactions", async () => {
      const res = await request(app)
        .get("/api/v1/payments/admin/transactions")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({ page: 1, limit: 10 });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.page).toBe(1);
    });

    it("should block non-admin users from accessing payment transactions", async () => {
      const res = await request(app)
        .get("/api/v1/payments/admin/transactions")
        .set("Authorization", `Bearer ${regularToken}`);

      expect(res.statusCode).toBe(403);
    });
  });
});
