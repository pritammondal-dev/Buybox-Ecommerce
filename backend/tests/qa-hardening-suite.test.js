const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");

const User = require("../src/models/User");
const Customer = require("../src/models/Customer");
const Order = require("../src/models/Order");
const Payment = require("../src/models/Payment");
const PaymentMethod = require("../src/models/PaymentMethod");
const RewardAccount = require("../src/models/RewardAccount");
const RewardTransaction = require("../src/models/RewardTransaction");
const GiftCard = require("../src/models/GiftCard");
const GiftCardTransaction = require("../src/models/GiftCardTransaction");
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
const Vendor = require("../src/models/Vendor");

const { generateAccessToken } = require("../src/services/token.service");
const rewardService = require("../src/services/reward.service");
const orderService = require("../src/services/order.service");
const reviewService = require("../src/services/review.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_qa_hardening_test?")
  : "mongodb://127.0.0.1:27017/buybox_qa_hardening_test?replicaSet=rs0";

describe("Production QA & Integration Hardening Suite", () => {
  jest.setTimeout(40000);

  let customer1User, customer1Token, customer1;
  let customer2User, customer2Token, customer2;
  let testVendorUser, testVendor;
  let testBrand, testCategory, testWarehouse, testProduct, testVariant;

  const createTestOrder = async (customerId, overrides = {}) => {
    const qty = overrides.quantity || 1;
    const unitPrice = overrides.unitPrice || "2499.00";
    const total = overrides.grandTotal || (parseFloat(unitPrice) * qty).toFixed(2);
    const orderData = {
      orderNumber: `ORD-QA-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`,
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
        fullName: "QA Customer",
        phone: "+919876543210",
        addressLine1: "123 QA Lane",
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
    };
    return await Order.create(orderData);
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    // Setup Customer 1
    const email1 = `qa_cust1_${Date.now()}_${Math.random().toString(36).substring(7)}@buybox.test`;
    customer1User = await User.create({
      email: email1,
      password: "Password123!",
      firstName: "QA_Customer1",
      lastName: "Tester",
      role: "customer",
      isActive: true,
      isEmailVerified: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    customer1 = await Customer.create({
      userId: customer1User._id,
      phone: "+919876543210",
      isActive: true,
    });
    customer1Token = generateAccessToken({
      sub: customer1User._id.toString(),
      id: customer1User._id.toString(),
      email: customer1User.email,
      role: customer1User.role,
    });

    // Setup Customer 2
    const email2 = `qa_cust2_${Date.now()}_${Math.random().toString(36).substring(7)}@buybox.test`;
    customer2User = await User.create({
      email: email2,
      password: "Password123!",
      firstName: "QA_Customer2",
      lastName: "Tester",
      role: "customer",
      isActive: true,
      isEmailVerified: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    customer2 = await Customer.create({
      userId: customer2User._id,
      phone: "+919876543211",
      isActive: true,
    });
    customer2Token = generateAccessToken({
      sub: customer2User._id.toString(),
      id: customer2User._id.toString(),
      email: customer2User.email,
      role: customer2User.role,
    });

    // Setup Vendor
    testVendorUser = await User.create({
      email: `qa_vendor_${Date.now()}_${Math.random().toString(36).substring(7)}@buybox.test`,
      password: "Password123!",
      firstName: "QA_Vendor",
      lastName: "Seller",
      role: "vendor",
      isActive: true,
      isEmailVerified: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    testVendor = await Vendor.create({
      userId: testVendorUser._id,
      businessName: "QA Acoustics",
      businessSlug: `qa-acoustics-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      isActive: true,
    });

    // Catalog & Warehouse Prerequisites
    testCategory = await Category.create({
      name: "QA Electronics",
      slug: `qa-electronics-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      isActive: true,
    });

    testBrand = await Brand.create({
      name: "QA SoundTech",
      slug: `qa-soundtech-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      isActive: true,
    });

    testWarehouse = await Warehouse.create({
      name: "QA Main Hub",
      code: `WH-QA-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`,
      address: {
        addressLine1: "123 Hub St",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "IN",
      },
      isActive: true,
    });

    testProduct = await Product.create({
      name: "QA Hardening Headphones",
      slug: `qa-headphones-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      description: "Production QA audiophile test headphones.",
      sku: `SKU-QA-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`,
      categoryId: testCategory._id,
      brandId: testBrand._id,
      vendorId: testVendor._id,
      price: "2499.00",
      status: "active",
      variants: [],
    });

    testVariant = await ProductVariant.create({
      productId: testProduct._id,
      sku: `SKU-VAR-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`,
      name: "Default Variant",
      price: "2499.00",
      currency: "INR",
      stockQuantity: 100,
    });
  });

  afterAll(async () => {
    try {
      await Promise.all([
        User.deleteMany({ email: { $regex: /@buybox\.test$/ } }),
        Customer.deleteMany({ _id: { $in: [customer1?._id, customer2?._id].filter(Boolean) } }),
        testVendor?._id ? Vendor.deleteOne({ _id: testVendor._id }) : Promise.resolve(),
        PaymentMethod.deleteMany({ customerId: { $in: [customer1?._id, customer2?._id].filter(Boolean) } }),
        RewardAccount.deleteMany({ customerId: { $in: [customer1?._id, customer2?._id].filter(Boolean) } }),
        RewardTransaction.deleteMany({ customerId: { $in: [customer1?._id, customer2?._id].filter(Boolean) } }),
        GiftCard.deleteMany({ code: { $regex: /^QA-GC-/ } }),
        GiftCardTransaction.deleteMany({ customerId: { $in: [customer1?._id, customer2?._id].filter(Boolean) } }),
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
      // Ignore cleanup error
    }
  });

  // =========================================================================
  // 1. PAYMENT / ORDER STATE MACHINE HARDENING
  // =========================================================================
  describe("1. Payment & Order State Machine", () => {
    let order;

    beforeEach(async () => {
      order = await createTestOrder(customer1._id, {
        status: "pending",
        paymentStatus: "pending",
      });
    });

    afterEach(async () => {
      if (order?._id) {
        await Order.deleteOne({ _id: order._id });
        await Payment.deleteMany({ orderId: order._id });
      }
    });

    it("Order creation starts strictly as pending / pending payment", () => {
      expect(order.status).toBe("pending");
      expect(order.paymentStatus).toBe("pending");
    });

    it("Payment failure or cancellation never confirms the order", async () => {
      await Payment.create({
        orderId: order._id,
        customerId: customer1._id,
        gateway: "razorpay",
        amount: "2499.00",
        currency: "INR",
        status: "failed",
        failureReason: "Card declined by issuing bank",
      });

      const orderAfterFail = await Order.findById(order._id);
      expect(orderAfterFail.status).toBe("pending");
      expect(orderAfterFail.paymentStatus).toBe("pending");
    });

    it("Only server-side verified capture transitions order to confirmed and paymentStatus to paid", async () => {
      const updatedOrder = await orderService.markOrderPaymentCaptured(order._id);

      expect(updatedOrder.paymentStatus).toBe("paid");
      expect(updatedOrder.status).toBe("confirmed");
      expect(updatedOrder.placedAt).toBeDefined();

      const timelineEvents = updatedOrder.timeline.map((t) => t.event);
      expect(timelineEvents).toContain("payment_successful");
      expect(timelineEvents).toContain("order_confirmed");
    });
  });

  // =========================================================================
  // 2. PAYMENT METHODS: TOKENIZATION, SECURITY & AUTHORIZATION
  // =========================================================================
  describe("2. Customer Payment Methods Hardening", () => {
    let savedMethodId;

    it("should allow customer to save a valid tokenized payment method", async () => {
      const res = await request(app)
        .post("/api/v1/payment-methods/my")
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({
          name: "My HDFC Card",
          type: "card",
          token: "tok_secure_rzp_token_999",
          last4: "4242",
          cardBrand: "visa",
          expiryMonth: 12,
          expiryYear: 2028,
          isDefault: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.last4).toBe("4242");
      expect(res.body.data.isDefault).toBe(true);
      savedMethodId = (res.body.data.id || res.body.data._id).toString();
    });

    it("strictly rejects direct credit card numbers (PAN) or CVV from being saved", async () => {
      const res = await request(app)
        .post("/api/v1/payment-methods/my")
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({
          name: "Insecure Card Attempt",
          type: "card",
          token: "tok_test_123",
          cardNumber: "4111111111111111", // Direct PAN attempt
          cvv: "123", // Direct CVV attempt
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/strictly prohibited/i);
    });

    it("prevents Customer 2 from deleting Customer 1's saved payment method (IDOR)", async () => {
      const res = await request(app)
        .delete(`/api/v1/payment-methods/my/${savedMethodId}`)
        .set("Authorization", `Bearer ${customer2Token}`);

      expect(res.status).toBe(404); // Scoped to customer2, so customer1's method is not found
    });

    it("allows Customer 1 to list their saved payment methods", async () => {
      const res = await request(app)
        .get("/api/v1/payment-methods/my")
        .set("Authorization", `Bearer ${customer1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some((m) => (m.id || m._id).toString() === savedMethodId.toString())).toBe(true);
    });

    it("allows Customer 1 to delete their own payment method", async () => {
      const res = await request(app)
        .delete(`/api/v1/payment-methods/my/${savedMethodId}`)
        .set("Authorization", `Bearer ${customer1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // =========================================================================
  // 3. REWARDS: ACCRUAL, IDEMPOTENCY & ADJUSTMENTS
  // =========================================================================
  describe("3. Rewards Ledger & Accrual", () => {
    let paidDeliveredOrder;

    beforeEach(async () => {
      paidDeliveredOrder = await createTestOrder(customer1._id, {
        status: "delivered",
        paymentStatus: "paid",
        grandTotal: "5000.00",
        quantity: 2,
        unitPrice: "2500.00",
      });
    });

    afterEach(async () => {
      if (paidDeliveredOrder?._id) {
        await Order.deleteOne({ _id: paidDeliveredOrder._id });
        await RewardTransaction.deleteMany({ orderId: paidDeliveredOrder._id });
      }
    });

    it("accrues 1 point per 100 INR for delivered and paid orders", async () => {
      const tx = await rewardService.accruePointsForDeliveredOrder(paidDeliveredOrder._id);

      expect(tx).toBeDefined();
      expect(tx.points).toBe(50); // 5000 / 100 = 50 points
      expect(tx.type).toBe("earned");

      const account = await RewardAccount.findOne({ customerId: customer1._id });
      expect(account.pointsBalance).toBeGreaterThanOrEqual(50);
    });

    it("prevents duplicate point accrual on repeat execution (idempotency)", async () => {
      const tx1 = await rewardService.accruePointsForDeliveredOrder(paidDeliveredOrder._id);
      const balanceAfterFirst = (await RewardAccount.findOne({ customerId: customer1._id })).pointsBalance;

      const tx2 = await rewardService.accruePointsForDeliveredOrder(paidDeliveredOrder._id);
      const balanceAfterSecond = (await RewardAccount.findOne({ customerId: customer1._id })).pointsBalance;

      expect(tx2.points).toBe(tx1.points);
      expect(balanceAfterSecond).toBe(balanceAfterFirst); // Balance did not double
    });

    it("adjusts/debits points correctly upon order cancellation or refund", async () => {
      // First ensure points are earned
      await rewardService.accruePointsForDeliveredOrder(paidDeliveredOrder._id);
      const balanceBefore = (await RewardAccount.findOne({ customerId: customer1._id })).pointsBalance;

      // Now reverse points for a partial refund of 2000 INR (20 points)
      const adjustTx = await rewardService.adjustPointsForCancelledOrRefundedOrder(
        paidDeliveredOrder._id,
        "2000.00"
      );

      expect(adjustTx).toBeDefined();
      expect(adjustTx.points).toBe(-20);
      expect(adjustTx.type).toBe("adjusted");

      const balanceAfter = (await RewardAccount.findOne({ customerId: customer1._id })).pointsBalance;
      expect(balanceAfter).toBe(balanceBefore - 20);
    });
  });

  // =========================================================================
  // 4. GIFT CARDS: ATOMIC CONCURRENCY & BALANCE
  // =========================================================================
  describe("4. Gift Cards Concurrency & Claiming", () => {
    let testGiftCard;

    beforeEach(async () => {
      testGiftCard = await GiftCard.create({
        code: `QA-GC-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`,
        initialBalance: "1000.00",
        currentBalance: "1000.00",
        status: "active",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days valid
      });
    });

    afterEach(async () => {
      if (testGiftCard?._id) {
        await GiftCard.deleteOne({ _id: testGiftCard._id });
        await GiftCardTransaction.deleteMany({ giftCardId: testGiftCard._id });
      }
    });

    it("allows balance checking by code without exposing sensitive internal IDs", async () => {
      const res = await request(app)
        .post("/api/v1/gift-cards/check-balance")
        .send({ code: testGiftCard.code });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(parseFloat(res.body.data.currentBalance)).toBe(1000);
      expect(res.body.data._id).toBeUndefined();
    });

    it("atomically claims card to Customer 1's account and prevents second claim by Customer 2", async () => {
      // First customer claims card
      const res1 = await request(app)
        .post("/api/v1/gift-cards/claim")
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({ code: testGiftCard.code });

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);

      // Second customer attempts to claim same card -> should be rejected with 409
      const res2 = await request(app)
        .post("/api/v1/gift-cards/claim")
        .set("Authorization", `Bearer ${customer2Token}`)
        .send({ code: testGiftCard.code });

      expect(res2.status).toBe(409);
      expect(res2.body.message).toMatch(/already been claimed/i);
    });

    it("rejects claiming of expired gift cards", async () => {
      const expiredCard = await GiftCard.create({
        code: `QA-GC-EXP-${Date.now()}`,
        initialBalance: "500.00",
        currentBalance: "500.00",
        status: "active",
        expiresAt: new Date(Date.now() - 1000 * 60), // Expired 1 min ago
      });

      const res = await request(app)
        .post("/api/v1/gift-cards/claim")
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({ code: expiredCard.code });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/expired/i);

      await GiftCard.deleteOne({ _id: expiredCard._id });
    });
  });

  // =========================================================================
  // 5. SHIPMENT TRACKING & OWNERSHIP
  // =========================================================================
  describe("5. Shipment Tracking Ownership", () => {
    let order1, shipment1;

    beforeAll(async () => {
      order1 = await createTestOrder(customer1._id, {
        status: "confirmed",
        paymentStatus: "paid",
      });

      shipment1 = await Shipment.create({
        shipmentNumber: `SHP-QA-${Date.now()}`,
        orderId: order1._id,
        customerId: customer1._id,
        vendorId: testVendor._id,
        warehouseId: testWarehouse._id,
        status: "in_transit",
        inventoryStatus: "reserved",
        trackingNumber: `TRK-${Date.now()}`,
        shippingAddress: {
          fullName: "QA Customer",
          phone: "+919876543210",
          addressLine1: "123 QA Lane",
          city: "Bengaluru",
          state: "Karnataka",
          postalCode: "560001",
          country: "IN",
        },
        items: [
          {
            productId: testProduct._id,
            productVariantId: testVariant._id,
            sku: testVariant.sku,
            name: testProduct.name,
            quantity: 1,
          },
        ],
      });
    });

    afterAll(async () => {
      if (order1?._id) await Order.deleteOne({ _id: order1._id });
      if (shipment1?._id) await Shipment.deleteOne({ _id: shipment1._id });
    });

    it("allows Customer 1 to view shipments for their own order", async () => {
      const res = await request(app)
        .get(`/api/v1/shipments/my/order/${order1._id}`)
        .set("Authorization", `Bearer ${customer1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0].trackingNumber).toBe(shipment1.trackingNumber);
    });

    it("forbids Customer 2 from accessing shipments for Customer 1's order", async () => {
      const res = await request(app)
        .get(`/api/v1/shipments/my/order/${order1._id}`)
        .set("Authorization", `Bearer ${customer2Token}`);

      expect(res.status).toBe(404); // Order not found or unauthorized
    });
  });

  // =========================================================================
  // 6. RETURNS & REFUNDS: VALIDATION & 7-DAY WINDOW
  // =========================================================================
  describe("6. Returns & Refunds Rules", () => {
    let deliveredOrder, oldDeliveredOrder, nonDeliveredOrder;

    beforeAll(async () => {
      deliveredOrder = await createTestOrder(customer1._id, {
        status: "delivered",
        deliveredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago (within 7d window)
        paymentStatus: "paid",
        quantity: 2,
        grandTotal: "4998.00",
      });

      oldDeliveredOrder = await createTestOrder(customer1._id, {
        status: "delivered",
        deliveredAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago (expired window)
        paymentStatus: "paid",
        quantity: 1,
      });

      nonDeliveredOrder = await createTestOrder(customer1._id, {
        status: "confirmed",
        paymentStatus: "paid",
        quantity: 1,
      });
    });

    afterAll(async () => {
      const orderIds = [deliveredOrder?._id, oldDeliveredOrder?._id, nonDeliveredOrder?._id].filter(Boolean);
      if (orderIds.length > 0) {
        await Promise.all([
          Order.deleteMany({ _id: { $in: orderIds } }),
          ReturnRequest.deleteMany({ orderId: { $in: orderIds } }),
        ]);
      }
    });

    it("rejects return requests for orders that are not yet delivered", async () => {
      const res = await request(app)
        .post("/api/v1/returns")
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({
          orderId: nonDeliveredOrder._id.toString(),
          items: [{ productId: testProduct._id.toString(), quantity: 1, reason: "defective" }],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/only be requested for delivered orders/i);
    });

    it("rejects return requests past the 7-day return window", async () => {
      const res = await request(app)
        .post("/api/v1/returns")
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({
          orderId: oldDeliveredOrder._id.toString(),
          items: [{ productId: testProduct._id.toString(), quantity: 1, reason: "defective" }],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/return window.*expired/i);
    });

    it("rejects return requests where quantity exceeds purchased quantity", async () => {
      const res = await request(app)
        .post("/api/v1/returns")
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({
          orderId: deliveredOrder._id.toString(),
          items: [{ productId: testProduct._id.toString(), quantity: 5, reason: "defective" }], // purchased only 2
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/cannot exceed ordered quantity/i);
    });

    it("successfully creates return request within window and calculates refund from authoritative prices", async () => {
      const res = await request(app)
        .post("/api/v1/returns")
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({
          orderId: deliveredOrder._id.toString(),
          items: [{ productId: testProduct._id.toString(), quantity: 1, reason: "defective" }],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const refundAmountVal =
        typeof res.body.data.refundAmount === "object" && res.body.data.refundAmount?.$numberDecimal
          ? res.body.data.refundAmount.$numberDecimal
          : res.body.data.refundAmount.toString();
      expect(refundAmountVal).toBe("2499.00");
    });

    it("prevents duplicate active return requests for the same order", async () => {
      const res = await request(app)
        .post("/api/v1/returns")
        .set("Authorization", `Bearer ${customer1Token}`)
        .send({
          orderId: deliveredOrder._id.toString(),
          items: [{ productId: testProduct._id.toString(), quantity: 1, reason: "changed_mind" }],
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already exists for this order/i);
    });
  });

  // =========================================================================
  // 7. SUPPORT TICKETS: ORDER OWNERSHIP & SCOPING
  // =========================================================================
  describe("7. Customer Support Tickets Ownership", () => {
    let order1;

    beforeAll(async () => {
      order1 = await createTestOrder(customer1._id, {
        status: "confirmed",
        paymentStatus: "paid",
      });
    });

    afterAll(async () => {
      if (order1?._id) {
        await Order.deleteOne({ _id: order1._id });
        await SupportTicket.deleteMany({ orderId: order1._id });
      }
    });

    it("forbids Customer 2 from creating an order-specific ticket for Customer 1's order", async () => {
      const res = await request(app)
        .post("/api/v1/support-tickets")
        .set("Authorization", `Bearer ${customer2Token}`)
        .send({
          subject: "Where is my item?",
          description: "Unauthorized inquiry about someone else's order.",
          category: "order",
          priority: "medium",
          orderId: order1._id.toString(),
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/not allowed to reference this order/i);
    });
  });

  // =========================================================================
  // 8. NOTIFICATIONS: CUSTOMER SCOPING
  // =========================================================================
  describe("8. Customer Notifications Scoping", () => {
    let notif1;

    beforeAll(async () => {
      notif1 = await CustomerNotification.create({
        customerId: customer1._id,
        userId: customer1User._id,
        title: "Exclusive QA Offer",
        message: "Only for customer 1",
        type: "promotion",
        isRead: false,
      });
    });

    afterAll(async () => {
      if (notif1?._id) {
        await CustomerNotification.deleteOne({ _id: notif1._id });
      }
    });

    it("Customer 2 cannot mark Customer 1's notification as read", async () => {
      const res = await request(app)
        .patch(`/api/v1/notifications/${notif1._id}/read`)
        .set("Authorization", `Bearer ${customer2Token}`);

      expect(res.status).toBe(404); // Scoped to customer2, so not found
    });

    it("Customer 1 can mark their own notification as read", async () => {
      const res = await request(app)
        .patch(`/api/v1/notifications/${notif1._id}/read`)
        .set("Authorization", `Bearer ${customer1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isRead).toBe(true);
    });
  });

  // =========================================================================
  // 9. REVIEWS: PURCHASE ELIGIBILITY & HELPFUL TEST IDEMPOTENCY
  // =========================================================================
  describe("9. Reviews Purchase Eligibility & Helpful Vote Idempotency", () => {
    let deliveredOrder, review;

    beforeAll(async () => {
      deliveredOrder = await createTestOrder(customer1._id, {
        status: "delivered",
        paymentStatus: "paid",
        quantity: 1,
      });

      review = await Review.create({
        productId: testProduct._id,
        customerId: customer1._id,
        orderId: deliveredOrder._id,
        rating: 5,
        title: "Fantastic Sound",
        comment: "Excellent build quality and punchy bass.",
        status: "approved",
        isVerifiedPurchase: true,
        helpfulCount: 0,
        helpfulVoters: [],
      });
    });

    afterAll(async () => {
      if (deliveredOrder?._id) await Order.deleteOne({ _id: deliveredOrder._id });
      if (review?._id) await Review.deleteOne({ _id: review._id });
    });

    it("prevents customer from submitting review without a valid purchased order", async () => {
      await expect(
        reviewService.createReview({
          userId: customer2User._id,
          productId: testProduct._id,
          orderId: deliveredOrder._id, // customer1's order
          rating: 4,
          title: "Looks good",
          comment: "Never bought it though.",
        })
      ).rejects.toThrow();
    });

    it("helpful upvote is strictly idempotent (repeat votes do not inflate count)", async () => {
      // First upvote by Customer 2
      const vote1 = await reviewService.markHelpful(review._id, customer2User._id);
      expect(vote1.helpfulCount).toBe(1);

      // Repeat upvote by Customer 2
      const vote2 = await reviewService.markHelpful(review._id, customer2User._id);
      expect(vote2.helpfulCount).toBe(1); // Did not increment to 2

      const freshReview = await Review.findById(review._id);
      expect(freshReview.helpfulCount).toBe(1);
      expect(freshReview.helpfulVoters.map((v) => v.toString())).toContain(customer2._id.toString());
    });
  });

  // =========================================================================
  // 10. INVOICE SNAPSHOT DATA INTEGRITY
  // =========================================================================
  describe("10. Invoice Snapshot Data Integrity", () => {
    let invoiceOrder;

    beforeAll(async () => {
      invoiceOrder = await createTestOrder(customer1._id, {
        status: "confirmed",
        paymentStatus: "paid",
        subtotal: "2499.00",
        shippingTotal: "150.00",
        taxTotal: "250.00",
        discountTotal: "100.00",
        grandTotal: "2799.00",
      });
    });

    afterAll(async () => {
      if (invoiceOrder?._id) {
        await Order.deleteOne({ _id: invoiceOrder._id });
      }
    });

    it("persists authoritative financial breakdown on order for invoice rendering without client recalculation", async () => {
      const order = await Order.findById(invoiceOrder._id);
      expect(order).toBeDefined();
      expect(order.grandTotal.toString()).toBe("2799.00");
      expect(order.subtotal.toString()).toBe("2499.00");
      expect(order.shippingTotal.toString()).toBe("150.00");
      expect(order.taxTotal.toString()).toBe("250.00");
      expect(order.discountTotal.toString()).toBe("100.00");
    });
  });
});
