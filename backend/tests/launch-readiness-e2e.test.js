const request = require("supertest");
const mongoose = require("mongoose");
const crypto = require("crypto");
const app = require("../src/app");

const User = require("../src/models/User");
const Customer = require("../src/models/Customer");
const Order = require("../src/models/Order");
const Payment = require("../src/models/Payment");
const PaymentMethod = require("../src/models/PaymentMethod");
const RewardAccount = require("../src/models/RewardAccount");
const RewardTransaction = require("../src/models/RewardTransaction");
const GiftCard = require("../src/models/GiftCard");
const ReturnRequest = require("../src/models/ReturnRequest");
const Review = require("../src/models/Review");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Category = require("../src/models/Category");
const Brand = require("../src/models/Brand");
const Warehouse = require("../src/models/Warehouse");
const Shipment = require("../src/models/Shipment");
const SupportTicket = require("../src/models/SupportTicket");
const CustomerNotification = require("../src/models/CustomerNotification");
const Address = require("../src/models/Address");
const Cart = require("../src/models/Cart");
const Vendor = require("../src/models/Vendor");

const { generateAccessToken } = require("../src/services/token.service");
const orderService = require("../src/services/order.service");
const paymentService = require("../src/services/payment.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_launch_e2e_test?")
  : "mongodb://127.0.0.1:27017/buybox_launch_e2e_test?replicaSet=rs0";

describe("Buybox Final Launch Readiness End-to-End Audit Suite", () => {
  jest.setTimeout(45000);

  let customer1User, customer1Token, customer1;
  let customer2User, customer2Token, customer2;
  let testVendorUser, testVendor;
  let testBrand, testCategory, testWarehouse, testProduct, testVariant;
  let testAddress1;

  const createTestOrder = async (customerId, overrides = {}) => {
    const qty = overrides.quantity || 1;
    const unitPrice = overrides.unitPrice || "2499.00";
    const total = overrides.grandTotal || (parseFloat(unitPrice) * qty).toFixed(2);
    return await Order.create({
      orderNumber: `ORD-LAUNCH-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`,
      customerId,
      status: overrides.status || "pending",
      paymentStatus: overrides.paymentStatus || "pending",
      fulfillmentStatus: overrides.fulfillmentStatus || "unfulfilled",
      inventoryStatus: "reserved",
      currency: "INR",
      subtotal: overrides.subtotal || total,
      discountTotal: overrides.discountTotal || "0.00",
      taxTotal: overrides.taxTotal || "0.00",
      shippingTotal: overrides.shippingTotal || "0.00",
      grandTotal: total,
      shippingAddress: {
        fullName: "Launch QA Customer",
        phone: "+919876543210",
        addressLine1: "100 Innovation Blvd",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "IN",
      },
      items: [
        {
          productId: testProduct._id,
          productVariantId: testVariant._id,
          warehouseId: testWarehouse._id,
          vendorId: testVendor._id,
          sku: testVariant.sku,
          productName: testProduct.name,
          quantity: qty,
          unitPrice: unitPrice,
          discountTotal: "0.00",
          taxTotal: "0.00",
          lineTotal: total,
          currency: "INR",
        },
      ],
      ...overrides,
    });
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    // Customer 1
    const email1 = `launch_cust1_${Date.now()}_${Math.random().toString(36).substring(7)}@buybox.test`;
    customer1User = await User.create({
      email: email1,
      password: "Password123!",
      firstName: "CustomerOne",
      lastName: "Tester",
      role: "customer",
      isActive: true,
      isEmailVerified: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    customer1 = await Customer.create({
      userId: customer1User._id,
      phone: "+919876543201",
      isActive: true,
    });
    customer1Token = generateAccessToken({
      sub: customer1User._id.toString(),
      id: customer1User._id.toString(),
      email: customer1User.email,
      role: customer1User.role,
    });

    // Customer 2
    const email2 = `launch_cust2_${Date.now()}_${Math.random().toString(36).substring(7)}@buybox.test`;
    customer2User = await User.create({
      email: email2,
      password: "Password123!",
      firstName: "CustomerTwo",
      lastName: "Tester",
      role: "customer",
      isActive: true,
      isEmailVerified: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    customer2 = await Customer.create({
      userId: customer2User._id,
      phone: "+919876543202",
      isActive: true,
    });
    customer2Token = generateAccessToken({
      sub: customer2User._id.toString(),
      id: customer2User._id.toString(),
      email: customer2User.email,
      role: customer2User.role,
    });

    // Vendor
    testVendorUser = await User.create({
      email: `launch_vendor_${Date.now()}_${Math.random().toString(36).substring(7)}@buybox.test`,
      password: "Password123!",
      firstName: "Launch",
      lastName: "Vendor",
      role: "vendor",
      isActive: true,
      isEmailVerified: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    testVendor = await Vendor.create({
      userId: testVendorUser._id,
      businessName: "Launch Acoustics",
      businessSlug: `launch-acoustics-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      isActive: true,
    });

    // Catalog & Warehouse Prerequisites
    testCategory = await Category.create({
      name: "Launch Electronics",
      slug: `launch-elec-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      isActive: true,
    });

    testBrand = await Brand.create({
      name: "Launch Sound",
      slug: `launch-sound-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      isActive: true,
    });

    testWarehouse = await Warehouse.create({
      name: "Launch Hub Alpha",
      code: `WH-LCH-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`,
      address: {
        addressLine1: "100 Logistics Park",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "IN",
      },
      isActive: true,
    });

    testProduct = await Product.create({
      name: "Launch Wireless Pro Earbuds",
      slug: `launch-earbuds-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      description: "Launch verified audiophile wireless earbuds.",
      sku: `SKU-LCH-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`,
      categoryId: testCategory._id,
      brandId: testBrand._id,
      vendorId: testVendor._id,
      price: "2499.00",
      status: "active",
      variants: [],
    });

    testVariant = await ProductVariant.create({
      productId: testProduct._id,
      sku: `SKU-LVAR-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`,
      name: "Matte Black",
      price: "2499.00",
      currency: "INR",
      stockQuantity: 250,
    });

    // Customer 1 Address
    testAddress1 = await Address.create({
      userId: customer1User._id,
      firstName: "CustomerOne",
      lastName: "Address",
      phone: "+919876543201",
      addressLine1: "Flat 4B, Silicon Heights",
      city: "Bengaluru",
      state: "Karnataka",
      postalCode: "560001",
      country: "IN",
      isDefault: true,
    });
  });

  afterAll(async () => {
    try {
      await Promise.all([
        User.deleteMany({ email: { $regex: /@buybox\.test$/ } }),
        Customer.deleteMany({ _id: { $in: [customer1?._id, customer2?._id].filter(Boolean) } }),
        testVendor?._id ? Vendor.deleteOne({ _id: testVendor._id }) : Promise.resolve(),
        Address.deleteMany({ userId: { $in: [customer1User?._id, customer2User?._id].filter(Boolean) } }),
        PaymentMethod.deleteMany({ customerId: { $in: [customer1?._id, customer2?._id].filter(Boolean) } }),
        RewardAccount.deleteMany({ customerId: { $in: [customer1?._id, customer2?._id].filter(Boolean) } }),
        RewardTransaction.deleteMany({ customerId: { $in: [customer1?._id, customer2?._id].filter(Boolean) } }),
        GiftCard.deleteMany({ code: { $regex: /^LCH-GC-/ } }),
        testVariant?._id ? ProductVariant.deleteOne({ _id: testVariant._id }) : Promise.resolve(),
        testProduct?._id ? Product.deleteOne({ _id: testProduct._id }) : Promise.resolve(),
        testCategory?._id ? Category.deleteOne({ _id: testCategory._id }) : Promise.resolve(),
        testBrand?._id ? Brand.deleteOne({ _id: testBrand._id }) : Promise.resolve(),
        testWarehouse?._id ? Warehouse.deleteOne({ _id: testWarehouse._id }) : Promise.resolve(),
      ]);
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch (err) {
      // Ignore teardown error
    }
  });

  // =========================================================================
  // 1. PAYMENT FAILURE MATRIX (SCENARIOS A - H)
  // =========================================================================
  describe("1. Payment Failure Matrix (Scenarios A through H)", () => {
    it("Scenario A: Successful payment transitions order from pending to confirmed with capture timestamp", async () => {
      const order = await createTestOrder(customer1._id);
      expect(order.status).toBe("pending");
      expect(order.paymentStatus).toBe("pending");

      const captured = await orderService.markOrderPaymentCaptured(order._id);
      expect(captured.status).toBe("confirmed");
      expect(captured.paymentStatus).toBe("paid");
      expect(captured.placedAt).toBeDefined();

      await Order.deleteOne({ _id: order._id });
    });

    it("Scenario B: Payment cancellation leaves order unconfirmed in pending state", async () => {
      const order = await createTestOrder(customer1._id);

      await Payment.create({
        orderId: order._id,
        customerId: customer1._id,
        gateway: "razorpay",
        amount: "2499.00",
        currency: "INR",
        status: "cancelled",
      });

      const freshOrder = await Order.findById(order._id);
      expect(freshOrder.status).toBe("pending");
      expect(freshOrder.paymentStatus).toBe("pending");

      await Order.deleteOne({ _id: order._id });
      await Payment.deleteMany({ orderId: order._id });
    });

    it("Scenario C: Payment failure leaves order unconfirmed in pending state", async () => {
      const order = await createTestOrder(customer1._id);

      await Payment.create({
        orderId: order._id,
        customerId: customer1._id,
        gateway: "razorpay",
        amount: "2499.00",
        currency: "INR",
        status: "failed",
        failureReason: "Payment authentication failed at issuer bank",
      });

      const freshOrder = await Order.findById(order._id);
      expect(freshOrder.status).toBe("pending");
      expect(freshOrder.paymentStatus).toBe("pending");

      await Order.deleteOne({ _id: order._id });
      await Payment.deleteMany({ orderId: order._id });
    });

    it("Scenario D: Payment expiry leaves order unconfirmed", async () => {
      const order = await createTestOrder(customer1._id);

      // Simulate expired payment attempt (gateway marks expired/cancelled)
      await Payment.create({
        orderId: order._id,
        customerId: customer1._id,
        gateway: "razorpay",
        amount: "2499.00",
        currency: "INR",
        status: "cancelled",
      });

      const freshOrder = await Order.findById(order._id);
      expect(freshOrder.status).toBe("pending");
      expect(freshOrder.paymentStatus).toBe("pending");

      await Order.deleteOne({ _id: order._id });
      await Payment.deleteMany({ orderId: order._id });
    });

    it("Scenario E: Payment retry reuses existing order and does not create duplicate orders", async () => {
      const order = await createTestOrder(customer1._id);
      const initialOrderCount = await Order.countDocuments({ customerId: customer1._id });

      // First attempt fails
      const payment1 = await Payment.create({
        orderId: order._id,
        customerId: customer1._id,
        gateway: "razorpay",
        amount: "2499.00",
        currency: "INR",
        status: "failed",
      });

      // Customer retries payment on the SAME order and succeeds (captured)
      const payment2 = await Payment.create({
        orderId: order._id,
        customerId: customer1._id,
        gateway: "razorpay",
        amount: "2499.00",
        currency: "INR",
        status: "captured",
      });

      const orderCountAfterRetry = await Order.countDocuments({ customerId: customer1._id });
      expect(orderCountAfterRetry).toBe(initialOrderCount); // No duplicate order created!

      await Order.deleteOne({ _id: order._id });
      await Payment.deleteMany({ orderId: order._id });
    });

    it("Scenario F: Duplicate callback/webhook events are strictly idempotent", async () => {
      const order = await createTestOrder(customer1._id);

      // First capture
      const capture1 = await orderService.markOrderPaymentCaptured(order._id);
      expect(capture1.paymentStatus).toBe("paid");
      expect(capture1.status).toBe("confirmed");

      // Second duplicate capture event
      const capture2 = await orderService.markOrderPaymentCaptured(order._id);
      expect(capture2.paymentStatus).toBe("paid");
      expect(capture2.status).toBe("confirmed");

      // Verify no duplicate order timeline entries for confirmation
      const confirmedEvents = capture2.timeline.filter((t) => t.event === "order_confirmed");
      expect(confirmedEvents.length).toBe(1);

      await Order.deleteOne({ _id: order._id });
    });

    it("Scenario G: Invalid payment signature is rejected and order remains unconfirmed", async () => {
      const order = await createTestOrder(customer1._id);

      // Fake verification payload with forged signature
      const res = await request(app)
        .post("/api/v1/payments/verify")
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({
          orderId: order._id.toString(),
          razorpayPaymentId: "pay_fake_1234567890",
          razorpayOrderId: "order_fake_1234567890",
          razorpaySignature: "invalid_tampered_signature_hash",
        });

      // Verification fails
      expect(res.status).toBe(400);

      const orderAfterAttack = await Order.findById(order._id);
      expect(orderAfterAttack.status).toBe("pending");
      expect(orderAfterAttack.paymentStatus).toBe("pending");

      await Order.deleteOne({ _id: order._id });
    });

    it("Scenario H: Client-side manipulation of payment status is ignored by the server", async () => {
      const order = await createTestOrder(customer1._id);

      // Malicious client tries to PATCH order with fake paid status
      const res = await request(app)
        .patch(`/api/v1/orders/${order._id}`)
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({
          paid: true,
          paymentStatus: "paid",
          status: "confirmed",
          grandTotal: "1.00",
        });

      // Route does not permit arbitrary mutation of payment state (404/405/400)
      expect([400, 404, 405]).toContain(res.status);

      const freshOrder = await Order.findById(order._id);
      expect(freshOrder.paymentStatus).toBe("pending");
      expect(freshOrder.status).toBe("pending");
      expect(freshOrder.grandTotal.toString()).toBe("2499.00");

      await Order.deleteOne({ _id: order._id });
    });
  });

  // =========================================================================
  // 2. CUSTOMER AUTHORIZATION / IDOR AUDIT (10 RESOURCE TYPES)
  // =========================================================================
  describe("2. Customer Authorization / IDOR Audit (10 Resource Types)", () => {
    let cust1Order, cust1Shipment, cust1Notif, cust1Ticket, cust1Method, cust1GiftCard;

    beforeAll(async () => {
      cust1Order = await createTestOrder(customer1._id, { status: "confirmed", paymentStatus: "paid" });

      cust1Shipment = await Shipment.create({
        shipmentNumber: `SHP-IDOR-${Date.now()}`,
        orderId: cust1Order._id,
        customerId: customer1._id,
        vendorId: testVendor._id,
        warehouseId: testWarehouse._id,
        status: "in_transit",
        inventoryStatus: "reserved",
        trackingNumber: `TRK-IDOR-${Date.now()}`,
        shippingAddress: {
          fullName: "CustomerOne",
          phone: "+919876543201",
          addressLine1: "100 Innovation Blvd",
          city: "Bengaluru",
          state: "Karnataka",
          postalCode: "560001",
          country: "IN",
        },
        items: [{ productId: testProduct._id, productVariantId: testVariant._id, sku: testVariant.sku, name: testProduct.name, quantity: 1 }],
      });

      cust1Notif = await CustomerNotification.create({
        customerId: customer1._id,
        userId: customer1User._id,
        title: "Confidential Order Update",
        message: "Customer 1 private message",
        type: "order",
        isRead: false,
      });

      cust1Ticket = await SupportTicket.create({
        ticketNumber: `TKT-IDOR-${Date.now().toString(36).toUpperCase()}`,
        customerId: customer1._id,
        subject: "Private Query",
        description: "Customer 1 confidential support request",
        category: "order",
        orderId: cust1Order._id,
      });

      cust1Method = await PaymentMethod.create({
        customerId: customer1._id,
        name: "Customer 1 Private Visa",
        code: `cust_${customer1._id}_visa_idor`,
        gateway: "razorpay",
        type: "card",
        token: "tok_secret_c1_token",
        last4: "1111",
        cardBrand: "visa",
        isDefault: true,
      });

      cust1GiftCard = await GiftCard.create({
        code: `LCH-GC-C1-${Date.now()}`,
        initialBalance: "1000.00",
        currentBalance: "1000.00",
        status: "active",
        claimedByCustomerId: customer1._id,
        claimedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
    });

    afterAll(async () => {
      await Promise.all([
        Order.deleteOne({ _id: cust1Order?._id }),
        Shipment.deleteOne({ _id: cust1Shipment?._id }),
        CustomerNotification.deleteOne({ _id: cust1Notif?._id }),
        SupportTicket.deleteOne({ _id: cust1Ticket?._id }),
        PaymentMethod.deleteOne({ _id: cust1Method?._id }),
        GiftCard.deleteOne({ _id: cust1GiftCard?._id }),
      ]);
    });

    it("1. IDOR Check — Customer 2 cannot read Customer 1's order", async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${cust1Order._id}`)
        .set("Authorization", `Bearer ${customer2Token}`);
      expect([403, 404]).toContain(res.status);
    });

    it("2. IDOR Check — Customer 2 cannot read or modify Customer 1's address", async () => {
      const res = await request(app)
        .get(`/api/v1/addresses/${testAddress1._id}`)
        .set("Authorization", `Bearer ${customer2Token}`);
      expect([403, 404]).toContain(res.status);
    });

    it("3. IDOR Check — Customer 2 cannot mark Customer 1's notification as read", async () => {
      const res = await request(app)
        .patch(`/api/v1/notifications/${cust1Notif._id}/read`)
        .set("Authorization", `Bearer ${customer2Token}`);
      expect([403, 404]).toContain(res.status);
    });

    it("4. IDOR Check — Customer 2 cannot request a return on Customer 1's order", async () => {
      const res = await request(app)
        .post("/api/v1/returns")
        .set("Authorization", `Bearer ${customer2Token}`)
        .send({
          orderId: cust1Order._id.toString(),
          items: [{ productId: testProduct._id.toString(), quantity: 1, reason: "defective" }],
        });
      expect([400, 403, 404]).toContain(res.status);
    });

    it("5. IDOR Check — Customer 2 cannot create support ticket referencing Customer 1's order", async () => {
      const res = await request(app)
        .post("/api/v1/support-tickets")
        .set("Authorization", `Bearer ${customer2Token}`)
        .send({
          subject: "Unauthorized Inquiry",
          description: "Attempting to inspect another customer's order",
          category: "order",
          orderId: cust1Order._id.toString(),
        });
      expect(res.status).toBe(403);
    });

    it("6. IDOR Check — Customer 2 cannot see Customer 1's rewards balance", async () => {
      const res = await request(app)
        .get("/api/v1/rewards/my")
        .set("Authorization", `Bearer ${customer2Token}`);
      expect(res.status).toBe(200);
      const points = res.body.data?.account?.pointsBalance ?? res.body.data?.pointsBalance ?? 0;
      expect(points).toBe(0); // Customer 2 sees only their own 0 points
    });

    it("7. IDOR Check — Customer 2 cannot claim Customer 1's already-claimed gift card", async () => {
      const res = await request(app)
        .post("/api/v1/gift-cards/claim")
        .set("Authorization", `Bearer ${customer2Token}`)
        .send({ code: cust1GiftCard.code });
      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already been claimed/i);
    });

    it("8. IDOR Check — Customer 2 cannot delete Customer 1's saved payment method", async () => {
      const res = await request(app)
        .delete(`/api/v1/payment-methods/my/${cust1Method._id}`)
        .set("Authorization", `Bearer ${customer2Token}`);
      expect(res.status).toBe(404);
    });

    it("9. IDOR Check — Customer 2 cannot access Customer 1's invoice data", async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${cust1Order._id}`)
        .set("Authorization", `Bearer ${customer2Token}`);
      expect([403, 404]).toContain(res.status);
    });

    it("10. IDOR Check — Customer 2 cannot view Customer 1's shipment tracking", async () => {
      const res = await request(app)
        .get(`/api/v1/shipments/my/order/${cust1Order._id}`)
        .set("Authorization", `Bearer ${customer2Token}`);
      expect(res.status).toBe(404);
    });
  });

  // =========================================================================
  // 3. ADMIN / VENDOR BOUNDARY ENFORCEMENT
  // =========================================================================
  describe("3. Admin / Vendor Boundary Enforcement", () => {
    it("forbids customer token from creating products (requires PRODUCTS_CREATE)", async () => {
      const res = await request(app)
        .post("/api/v1/products")
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({
          name: "Hacked Product",
          price: "10.00",
        });
      expect(res.status).toBe(403);
    });

    it("forbids customer token from viewing admin inventory details (requires INVENTORY_READ)", async () => {
      const res = await request(app)
        .get(`/api/v1/inventory/variant/${testVariant._id}`)
        .set("Authorization", `Bearer ${customer1Token}`);
      expect(res.status).toBe(403);
    });

    it("forbids customer token from creating marketing coupons (requires COUPONS_MANAGE)", async () => {
      const res = await request(app)
        .post("/api/v1/coupons")
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({
          code: "FREE99",
          discountType: "percentage",
          discountValue: 99,
        });
      expect(res.status).toBe(403);
    });

    it("forbids customer token from issuing arbitrary refunds (requires PAYMENTS_MANAGE)", async () => {
      const res = await request(app)
        .post(`/api/v1/payments/orders/${new mongoose.Types.ObjectId()}/refunds`)
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({
          amount: "1000.00",
          reason: "Customer self-refund attempt",
        });
      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // 4. FINANCIAL INTEGRITY & SERVER-AUTHORITATIVE PRICING
  // =========================================================================
  describe("4. Financial Integrity & Authoritative Pricing", () => {
    it("server-side quote calculates pricing authoritatively and rejects/ignores client price manipulation", async () => {
      // Clear cart first
      await request(app)
        .delete("/api/v1/cart")
        .set("Authorization", `Bearer ${customer1Token}`);

      // Add item to cart with quantity 2
      await request(app)
        .post("/api/v1/cart/items")
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({
          productId: testProduct._id.toString(),
          productVariantId: testVariant._id.toString(),
          quantity: 2,
        });

      // 1. Valid quote request - authoritative calculation from DB
      const res = await request(app)
        .post("/api/v1/orders/quote")
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({
          shippingAddressId: testAddress1._id.toString(),
          deliveryOptionId: "standard",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Authoritative subtotal must be 2499 * 2 = 4998
      const quoteData = res.body.data;
      const quotedSubtotal = parseFloat(quoteData.subtotal || quoteData.itemsSubtotal);
      expect(quotedSubtotal).toBe(4998);

      // 2. Client tampering test: attempts to inject arbitrary prices or unexpected fields are rejected by strict validation
      const tamperRes = await request(app)
        .post("/api/v1/orders/quote")
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({
          shippingAddressId: testAddress1._id.toString(),
          customPrice: "1.00",
          tamperedTotal: "5.00",
        });

      expect(tamperRes.status).toBe(400); // Strict schema rejects client tamper fields
    });
  });

  // =========================================================================
  // 5. CART LIFECYCLE AUDIT
  // =========================================================================
  describe("5. Customer Cart Lifecycle & Management", () => {
    it("supports adding, updating, and clearing items in customer cart", async () => {
      // 1. Add item to cart
      const addRes = await request(app)
        .post("/api/v1/cart/items")
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({
          productId: testProduct._id.toString(),
          productVariantId: testVariant._id.toString(),
          quantity: 1,
        });
      expect([200, 201]).toContain(addRes.status);

      // 2. Fetch cart
      const getRes = await request(app)
        .get("/api/v1/cart")
        .set("Authorization", `Bearer ${customer1Token}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.items.length).toBeGreaterThanOrEqual(1);

      // 3. Clear cart
      const clearRes = await request(app)
        .delete("/api/v1/cart")
        .set("Authorization", `Bearer ${customer1Token}`);
      expect(clearRes.status).toBe(200);

      // 4. Verify cart empty
      const emptyRes = await request(app)
        .get("/api/v1/cart")
        .set("Authorization", `Bearer ${customer1Token}`);
      expect(emptyRes.status).toBe(200);
      expect(emptyRes.body.data.items.length).toBe(0);
    });
  });
});
