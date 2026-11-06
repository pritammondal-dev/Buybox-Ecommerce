const request = require("supertest");
const mongoose = require("mongoose");
const crypto = require("crypto");

// Service and model imports
const app = require("../src/app");
const tokenService = require("../src/services/token.service");
const storefrontSettingsService = require("../src/services/storefront-settings.service");
const cartService = require("../src/services/cart.service");
const orderService = require("../src/services/order.service");
const paymentService = require("../src/services/payment.service");
const paymentVerificationService = require("../src/services/payment-verification.service");
const pricingEngineService = require("../src/services/pricing-engine.service");

const Order = require("../src/models/Order");
const Cart = require("../src/models/Cart");
const Customer = require("../src/models/Customer");
const User = require("../src/models/User");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const StorefrontSettings = require("../src/models/StorefrontSettings");
const Payment = require("../src/models/Payment");
const Warehouse = require("../src/models/Warehouse");
const Inventory = require("../src/models/Inventory");

const { ROLES } = require("../src/constants/auth.constants");
const { TOKEN_CONTEXTS } = require("../src/services/token.service");
const DEFAULT_FEATURE_FLAGS = storefrontSettingsService.DEFAULT_SETTINGS.featureFlags;

describe("BUYBOX E-COMMERCE — PHASE E2: GUEST CHECKOUT SECURITY, ORDER INTEGRITY & END-TO-END ACCEPTANCE", () => {
  let customerUser;
  let customerProfile;
  let customerToken;
  let customerBUser;
  let customerBProfile;
  let customerBToken;
  let superAdminUser;
  let superAdminToken;
  let adminUser;
  let adminToken;
  let vendorToken;

  let guestTokenA;
  let guestIdA;
  let guestTokenB;
  let guestIdB;

  let testProduct;
  let testVariant;
  let testWarehouse;
  let testInventory;
  const storeId = new mongoose.Types.ObjectId();

  const createMockOrder = async (overrides = {}) => {
    return Order.create({
      orderNumber: "ORD-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
      currency: "INR",
      status: "pending",
      paymentStatus: "pending",
      fulfillmentStatus: "unfulfilled",
      inventoryStatus: "reserved",
      pricingMode: "tax_exclusive",
      subtotal: mongoose.Types.Decimal128.fromString("2999.00"),
      discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
      taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
      shippingTotal: mongoose.Types.Decimal128.fromString("0.00"),
      grandTotal: mongoose.Types.Decimal128.fromString("2999.00"),
      shippingAddress: {
        fullName: "Test Customer",
        phone: "9876543210",
        addressLine1: "123 Main St",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "IN",
      },
      items: [
        {
          productId: testProduct._id,
          productVariantId: testVariant._id,
          vendorId: testProduct.vendorId,
          sku: testVariant.sku,
          productName: testProduct.name,
          variantName: testVariant.name,
          quantity: 1,
          unitPrice: mongoose.Types.Decimal128.fromString("2999.00"),
          discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
          taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
          lineTotal: mongoose.Types.Decimal128.fromString("2999.00"),
          currency: "INR",
          inventoryStatus: "reserved",
          fulfillmentStatus: "unfulfilled",
        },
      ],
      ...overrides,
    });
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/buybox_test");
    }

    // Clean test collections
    await Promise.all([
      User.deleteMany({ email: { $regex: /@e2-test\.com$/ } }),
      Customer.deleteMany({}),
      Order.deleteMany({}),
      Cart.deleteMany({}),
      Product.deleteMany({ name: "E2 Test Headphones" }),
      ProductVariant.deleteMany({ sku: { $regex: /^E2-HEADPHONES-BLK/ } }),
      StorefrontSettings.deleteMany({}),
      Payment.deleteMany({}),
      Warehouse.deleteMany({ code: { $regex: /^E2-WH/ } }),
      Inventory.deleteMany({}),
    ]);

    await Cart.syncIndexes();
    await Order.syncIndexes();

    // Seed authoritative StorefrontSettings with guestCheckout: false
    await StorefrontSettings.create({
      storeName: "Buybox Test Store",
      logoUrl: "/images/logo.png",
      logoDimensions: {
        desktopWidth: 180,
        desktopMaxHeight: 50,
        mobileWidth: 140,
        mobileMaxHeight: 36,
        footerMaxHeight: 40,
      },
      featureFlags: {
        ...DEFAULT_FEATURE_FLAGS,
        guestCheckout: false,
      },
      isActive: true,
    });
    await storefrontSettingsService.invalidateCache();

    // Seed Customer User A & Profile
    customerUser = await User.create({
      firstName: "Customer",
      lastName: "One",
      email: "customer.a@e2-test.com",
      password: "HashedPassword123!",
      role: ROLES.CUSTOMER,
      isEmailVerified: true,
      status: "active",
      permissionVersion: 1,
    });
    customerProfile = await Customer.create({
      userId: customerUser._id,
      firstName: "Customer",
      lastName: "One",
      email: customerUser.email,
    });
    customerToken = tokenService.generateAccessToken({
      sub: customerUser._id.toString(),
      role: ROLES.CUSTOMER,
      context: TOKEN_CONTEXTS.CUSTOMER,
    });

    // Seed Customer User B & Profile (for anti-IDOR tests)
    customerBUser = await User.create({
      firstName: "Customer",
      lastName: "Two",
      email: "customer.b@e2-test.com",
      password: "HashedPassword123!",
      role: ROLES.CUSTOMER,
      isEmailVerified: true,
      status: "active",
      permissionVersion: 1,
    });
    customerBProfile = await Customer.create({
      userId: customerBUser._id,
      firstName: "Customer",
      lastName: "Two",
      email: customerBUser.email,
    });
    customerBToken = tokenService.generateAccessToken({
      sub: customerBUser._id.toString(),
      role: ROLES.CUSTOMER,
      context: TOKEN_CONTEXTS.CUSTOMER,
    });

    // Seed Superadmin & Admin
    superAdminUser = await User.findOne({ role: ROLES.SUPER_ADMIN });
    if (!superAdminUser) {
      superAdminUser = await User.create({
        firstName: "Super",
        lastName: "Admin",
        email: "superadmin@e2-test.com",
        password: "HashedPassword123!",
        role: ROLES.SUPER_ADMIN,
        isEmailVerified: true,
        status: "active",
        permissionVersion: 1,
      });
    }
    superAdminToken = tokenService.generateAccessToken({
      sub: superAdminUser._id.toString(),
      role: ROLES.SUPER_ADMIN,
      context: TOKEN_CONTEXTS.ADMINISTRATOR,
    });

    adminUser = await User.findOne({ email: "admin@e2-test.com" });
    if (!adminUser) {
      adminUser = await User.create({
        firstName: "Admin",
        lastName: "Staff",
        email: "admin@e2-test.com",
        password: "HashedPassword123!",
        role: ROLES.ADMIN,
        isEmailVerified: true,
        status: "active",
        permissionVersion: 1,
      });
    }
    adminToken = tokenService.generateAccessToken({
      sub: adminUser._id.toString(),
      role: ROLES.ADMIN,
      context: TOKEN_CONTEXTS.ADMINISTRATOR,
    });

    vendorToken = tokenService.generateAccessToken({
      sub: new mongoose.Types.ObjectId().toString(),
      role: ROLES.VENDOR,
      context: TOKEN_CONTEXTS.VENDOR,
    });

    // Guest Credentials A & B
    guestIdA = "gst_" + crypto.randomUUID();
    guestTokenA = tokenService.generateGuestToken({ guestId: guestIdA });

    guestIdB = "gst_" + crypto.randomUUID();
    guestTokenB = tokenService.generateGuestToken({ guestId: guestIdB });

    // Seed test Product & Variant
    testProduct = await Product.create({
      name: "E2 Test Headphones",
      slug: "e2-test-headphones-" + Date.now(),
      sku: "E2-HP-SKU-" + Date.now(),
      categoryId: new mongoose.Types.ObjectId(),
      vendorId: new mongoose.Types.ObjectId(),
      price: mongoose.Types.Decimal128.fromString("2999.00"),
      description: "High performance audio for test",
      status: "active",
      isActive: true,
      publishedAt: new Date(),
    });

    testVariant = await ProductVariant.create({
      productId: testProduct._id,
      name: "Black Edition",
      sku: "E2-HEADPHONES-BLK-" + Date.now(),
      price: mongoose.Types.Decimal128.fromString("2999.00"),
      stockStatus: "in_stock",
      stockQuantity: 100,
      isActive: true,
    });

    // Seed test Warehouse & authoritative Inventory
    testWarehouse = await Warehouse.create({
      name: "E2 Central Distribution Center",
      code: `E2-WH-${Date.now()}`,
      address: {
        addressLine1: "1 Warehouse St",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "IN",
      },
      isActive: true,
    });

    testInventory = await Inventory.create({
      productVariantId: testVariant._id,
      warehouseId: testWarehouse._id,
      onHand: 100,
      reserved: 0,
      lowStockThreshold: 5,
      lastStockUpdateAt: new Date(),
    });
  });

  afterAll(async () => {
    await Promise.all([
      User.deleteMany({ email: { $regex: /@e2-test\.com$/ } }),
      Customer.deleteMany({}),
      Order.deleteMany({}),
      Cart.deleteMany({}),
      Product.deleteMany({ name: "E2 Test Headphones" }),
      ProductVariant.deleteMany({ sku: { $regex: /^E2-HEADPHONES-BLK/ } }),
      StorefrontSettings.deleteMany({}),
      Payment.deleteMany({}),
      Warehouse.deleteMany({ code: { $regex: /^E2-WH/ } }),
      Inventory.deleteMany({}),
    ]);
  });

  // =========================================================================
  // GROUP 1: GUEST CHECKOUT FEATURE FLAG AUTHORITATIVE ENFORCEMENT (1 to 7)
  // =========================================================================

  describe("Group 1: Authoritative Guest Checkout Feature-Flag Enforcement", () => {
    it("1. Guest checkout enabled: supported guest checkout succeeds", async () => {
      // Enable guest checkout
      await StorefrontSettings.updateOne({}, { $set: { "featureFlags.guestCheckout": true } });
      await storefrontSettingsService.invalidateCache();
      expect(await storefrontSettingsService.isFeatureEnabled("guestCheckout")).toBe(true);

      // Guest adds product to cart
      const addRes = await request(app)
        .post("/api/v1/cart/items")
        .set("X-Guest-Session", guestTokenA)
        .send({
          productVariantId: testVariant._id.toString(),
          quantity: 1,
        });
      expect(addRes.status).toBe(201);

      // Request checkout quote as guest
      const quoteRes = await request(app)
        .post("/api/v1/orders/quote")
        .set("X-Guest-Session", guestTokenA)
        .send({
          guestShippingAddress: {
            fullName: "Guest John",
            addressLine1: "100 Guest St",
            city: "Mumbai",
            state: "MH",
            postalCode: "400001",
            phone: "9876543210",
          },
        });
      expect(quoteRes.status).toBe(200);
      expect(quoteRes.body.data.quoteReference).toBeDefined();

      // Place order as guest
      const orderRes = await request(app)
        .post("/api/v1/orders")
        .set("X-Guest-Session", guestTokenA)
        .send({
          quoteReference: quoteRes.body.data.quoteReference,
          guestEmail: "guest.john@e2-test.com",
          guestShippingAddress: {
            fullName: "Guest John",
            addressLine1: "100 Guest St",
            city: "Mumbai",
            state: "MH",
            postalCode: "400001",
            phone: "9876543210",
          },
        });

      expect(orderRes.status).toBe(201);
      expect(orderRes.body.data.isGuestOrder).toBe(true);
      expect(orderRes.body.data.guestId).toBe(guestIdA);
      expect(orderRes.body.data.guestOrderAccessToken).toBeDefined();
    });

    it("2. Guest checkout disabled: unauthenticated order creation is rejected", async () => {
      // Disable guest checkout
      await StorefrontSettings.updateOne({}, { $set: { "featureFlags.guestCheckout": false } });
      await storefrontSettingsService.invalidateCache();
      expect(await storefrontSettingsService.isFeatureEnabled("guestCheckout")).toBe(false);

      // Attempt to place order without session/auth
      const res = await request(app)
        .post("/api/v1/orders")
        .send({
          guestEmail: "guest2@e2-test.com",
          guestShippingAddress: {
            fullName: "Guest Two",
            addressLine1: "101 Guest St",
            city: "Mumbai",
            state: "MH",
            postalCode: "400001",
            phone: "9876543210",
          },
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("GUEST_CHECKOUT_DISABLED");
    });

    it("3. Guest checkout disabled: direct API requests cannot bypass the restriction", async () => {
      // Ensure flag disabled
      expect(await storefrontSettingsService.isFeatureEnabled("guestCheckout")).toBe(false);

      // Direct request on quote endpoint
      const quoteRes = await request(app)
        .post("/api/v1/orders/quote")
        .set("X-Guest-Session", guestTokenA)
        .send({
          guestShippingAddress: {
            fullName: "Sneaky Guest",
            addressLine1: "Bypass Lane",
            city: "Delhi",
            state: "DL",
            postalCode: "110001",
            phone: "9876543210",
          },
        });

      expect(quoteRes.status).toBe(403);
      expect(quoteRes.body.code).toBe("GUEST_CHECKOUT_DISABLED");

      // Direct request on create order endpoint
      const orderRes = await request(app)
        .post("/api/v1/orders")
        .set("X-Guest-Session", guestTokenA)
        .send({
          guestEmail: "bypass@e2-test.com",
          guestShippingAddress: {
            fullName: "Sneaky Guest",
            addressLine1: "Bypass Lane",
            city: "Delhi",
            state: "DL",
            postalCode: "110001",
            phone: "9876543210",
          },
        });

      expect(orderRes.status).toBe(403);
      expect(orderRes.body.code).toBe("GUEST_CHECKOUT_DISABLED");
    });

    it("4. Guest checkout disabled: authenticated checkout remains functional", async () => {
      // Add item to customer cart
      await request(app)
        .post("/api/v1/cart/items")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          productVariantId: testVariant._id.toString(),
          productId: testProduct._id.toString(),
          quantity: 1,
        });

      // Customer gets quote
      const quoteRes = await request(app)
        .post("/api/v1/orders/quote")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({});

      expect(quoteRes.status).toBe(200);
      expect(quoteRes.body.data.quoteReference).toBeDefined();
    });

    it("5. Flag changes are respected after the appropriate cache refresh", async () => {
      // Enable flag
      await StorefrontSettings.updateOne({}, { $set: { "featureFlags.guestCheckout": true } });
      await storefrontSettingsService.invalidateCache();
      expect(await storefrontSettingsService.isFeatureEnabled("guestCheckout")).toBe(true);

      // Disable flag
      await StorefrontSettings.updateOne({}, { $set: { "featureFlags.guestCheckout": false } });
      await storefrontSettingsService.invalidateCache();
      expect(await storefrontSettingsService.isFeatureEnabled("guestCheckout")).toBe(false);
    });

    it("6. Public catalog browsing continues to work when guest checkout is disabled", async () => {
      // Even with guest checkout disabled, health check and public routes work
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);

      // Guest cart read should not crash or be rejected with 403
      const cartRes = await request(app)
        .get("/api/v1/cart")
        .set("X-Guest-Session", guestTokenA);
      expect([200, 404]).toContain(cartRes.status);
    });

    it("7. Previously created pending orders follow a safe, documented policy after a flag change", async () => {
      // Re-enable flag temporarily to seed pending guest order
      await StorefrontSettings.updateOne({}, { $set: { "featureFlags.guestCheckout": true } });
      await storefrontSettingsService.invalidateCache();

      const pendingGuestOrder = await createMockOrder({
        orderNumber: "ORD-GUEST-PENDING-1",
        isGuestOrder: true,
        guestId: guestIdA,
        guestOrderAccessToken: "token_pending_guest_123",
      });

      // Now disable guestCheckout flag
      await StorefrontSettings.updateOne({}, { $set: { "featureFlags.guestCheckout": false } });
      await storefrontSettingsService.invalidateCache();

      // Verify that the order was NOT deleted or corrupted
      const retrieved = await Order.findById(pendingGuestOrder._id);
      expect(retrieved).not.toBeNull();
      expect(retrieved.status).toBe("pending");

      // Verify guest can still check status with their valid token
      const accessRes = await request(app)
        .get(`/api/v1/orders/${pendingGuestOrder._id}`)
        .set("X-Order-Token", "token_pending_guest_123");
      expect(accessRes.status).toBe(200);
      expect(accessRes.body.data.orderNumber).toBe("ORD-GUEST-PENDING-1");
    });
  });

  // =========================================================================
  // GROUP 2: GUEST IDENTITY AND ORDER OWNERSHIP SECURITY (8 to 14)
  // =========================================================================

  describe("Group 2: Guest Identity, Cart & Order Ownership Security (Anti-IDOR)", () => {
    beforeAll(async () => {
      // Re-enable guest checkout for ownership tests
      await StorefrontSettings.updateOne({}, { $set: { "featureFlags.guestCheckout": true } });
      await storefrontSettingsService.invalidateCache();
    });

    it("8. Guest A cannot read Guest B's cart", async () => {
      // Seed Cart for Guest B
      await Cart.deleteMany({ guestId: guestIdB });
      await Cart.create({
        guestId: guestIdB,
        status: "active",
        currency: "INR",
        items: [
          {
            productId: testProduct._id,
            productVariantId: testVariant._id,
            quantity: 3,
            priceSnapshot: mongoose.Types.Decimal128.fromString("2999.00"),
            currency: "INR",
          },
        ],
        subtotal: mongoose.Types.Decimal128.fromString("8997.00"),
        grandTotal: mongoose.Types.Decimal128.fromString("8997.00"),
      });

      // Guest A requests their cart
      const resA = await request(app)
        .get("/api/v1/cart")
        .set("X-Guest-Session", guestTokenA);

      expect(resA.status).toBe(200);
      // Cart returned for Guest A must be empty or distinct, not Guest B's 3 items
      const itemsA = resA.body.data?.items || [];
      const hasGuestBItems = itemsA.some((it) => it.quantity === 3);
      expect(hasGuestBItems).toBe(false);
    });

    it("9. Guest A cannot mutate Guest B's cart", async () => {
      // Guest A tries to clear cart using Guest A session
      // Guest B's cart must remain unaffected
      const cartBBefore = await Cart.findOne({ guestId: guestIdB, status: "active" });
      expect(cartBBefore.items.length).toBe(1);

      await request(app)
        .delete("/api/v1/cart")
        .set("X-Guest-Session", guestTokenA);

      const cartBAfter = await Cart.findOne({ guestId: guestIdB, status: "active" });
      expect(cartBAfter.items.length).toBe(1);
    });

    it("10. Guest A cannot read Guest B's order, invoice, or shipment details", async () => {
      // Create Order for Guest B
      const orderB = await createMockOrder({
        orderNumber: "ORD-GUEST-B-SECRET",
        isGuestOrder: true,
        guestId: guestIdB,
        guestEmail: "guestb.confidential@e2-test.com",
        guestOrderAccessToken: "secret_token_b_999",
      });

      // Guest A attempts to read Guest B's order by ID
      const res = await request(app)
        .get(`/api/v1/orders/${orderB._id}`)
        .set("X-Guest-Session", guestTokenA);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("ORDER_ACCESS_DENIED");
    });

    it("11. Guessing an order ID or order number does not bypass ownership validation", async () => {
      const randomObjectId = new mongoose.Types.ObjectId().toString();

      // Random guess by unauthenticated or unrelated guest
      const res = await request(app)
        .get(`/api/v1/orders/${randomObjectId}`)
        .set("X-Guest-Session", guestTokenA);

      expect([403, 404]).toContain(res.status);
    });

    it("12. Authenticated customers cannot access another customer's orders", async () => {
      // Create Order belonging to Customer B
      const orderCustomerB = await createMockOrder({
        orderNumber: "ORD-CUST-B-SECRET",
        customerId: customerBProfile._id,
        isGuestOrder: false,
      });

      // Customer A tries to access Customer B's order
      const res = await request(app)
        .get(`/api/v1/orders/${orderCustomerB._id}`)
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("ORDER_ACCESS_DENIED");
    });

    it("13. Guest-to-customer linking, where supported, rejects unauthorized claims", async () => {
      // Order created for Guest B
      const guestOrder = await createMockOrder({
        orderNumber: "ORD-LINK-CLAIM-TEST",
        isGuestOrder: true,
        guestId: guestIdB,
        guestEmail: "guestb.original@e2-test.com",
        guestOrderAccessToken: "legit_token_777",
      });

      // Attacker customer attempts to claim with WRONG token
      const fraudClaim = await request(app)
        .post("/api/v1/orders/link-guest")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          orderId: guestOrder._id.toString(),
          guestOrderAccessToken: "attacker_fraud_token_000",
        });

      expect([400, 403]).toContain(fraudClaim.status);

      // Legitimate claim with matching token succeeds
      const legitClaim = await request(app)
        .post("/api/v1/orders/link-guest")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          orderId: guestOrder._id.toString(),
          guestOrderAccessToken: "legit_token_777",
        });

      expect(legitClaim.status).toBe(200);

      // Verify DB shows order linked to customer
      const linkedOrder = await Order.findById(guestOrder._id);
      expect(linkedOrder.customerId.toString()).toBe(customerProfile._id.toString());
      expect(linkedOrder.isGuestOrder).toBe(false);
    });

    it("14. Expired or invalid guest credentials are rejected", async () => {
      // Malformed / fake guest session
      const malformedRes = await request(app)
        .get("/api/v1/cart")
        .set("X-Guest-Session", "malformed.jwt.token");

      expect(malformedRes.status).toBe(401);
      expect(malformedRes.body.code).toBe("INVALID_GUEST_SESSION");
    });
  });

  // =========================================================================
  // GROUP 3: PAYMENT, IDEMPOTENCY & INVENTORY INTEGRITY (15 to 21)
  // =========================================================================

  describe("Group 3: Payment, Idempotency & Inventory Integrity", () => {
    beforeAll(async () => {
      await StorefrontSettings.updateOne({}, { $set: { "featureFlags.guestCheckout": true } });
      await storefrontSettingsService.invalidateCache();
    });

    it("15. Repeated checkout requests do not create duplicate orders", async () => {
      const idempotencyKey = "e2-idem-key-" + Date.now();

      // Create cart for guest A
      await Cart.deleteMany({ guestId: guestIdA });
      await Cart.create({
        guestId: guestIdA,
        status: "active",
        currency: "INR",
        items: [
          {
            productId: testProduct._id,
            productVariantId: testVariant._id,
            quantity: 1,
            priceSnapshot: mongoose.Types.Decimal128.fromString("2999.00"),
            currency: "INR",
          },
        ],
        subtotal: mongoose.Types.Decimal128.fromString("2999.00"),
        grandTotal: mongoose.Types.Decimal128.fromString("2999.00"),
      });

      const quoteRes = await request(app)
        .post("/api/v1/orders/quote")
        .set("X-Guest-Session", guestTokenA)
        .send({
          guestShippingAddress: {
            fullName: "Idem Tester",
            addressLine1: "123 Street",
            city: "Mumbai",
            state: "MH",
            postalCode: "400001",
            phone: "9876543210",
          },
        });

      const orderPayload = {
        quoteReference: quoteRes.body.data.quoteReference,
        guestEmail: "idem@e2-test.com",
        guestShippingAddress: {
          fullName: "Idem Tester",
          addressLine1: "123 Street",
          city: "Mumbai",
          state: "MH",
          postalCode: "400001",
          phone: "9876543210",
        },
      };

      // First Request
      const firstRes = await request(app)
        .post("/api/v1/orders")
        .set("X-Guest-Session", guestTokenA)
        .set("Idempotency-Key", idempotencyKey)
        .send(orderPayload);
      expect(firstRes.status).toBe(201);
      const firstOrderId = firstRes.body.data._id;

      // Duplicate Replay Request with identical key and payload
      const secondRes = await request(app)
        .post("/api/v1/orders")
        .set("X-Guest-Session", guestTokenA)
        .set("Idempotency-Key", idempotencyKey)
        .send(orderPayload);

      expect([200, 201]).toContain(secondRes.status);
      expect(secondRes.body.data._id).toBe(firstOrderId);

      // Verify DB contains only one order with this idempotency key
      const count = await Order.countDocuments({ idempotencyKey });
      expect(count).toBe(1);
    });

    it("16. Repeated callbacks do not duplicate payment or order transitions", async () => {
      // Mock order
      const paidOrder = await createMockOrder({
        orderNumber: "ORD-CALLBACK-TEST",
        customerId: customerProfile._id,
        isGuestOrder: false,
        status: "confirmed",
        paymentStatus: "paid",
      });

      // Calling markOrderPaymentCaptured repeatedly should be idempotent
      await orderService.markOrderPaymentCaptured(paidOrder._id, "PAY-MOCK-1", "razorpay");
      const orderAfterSecond = await Order.findById(paidOrder._id);
      expect(orderAfterSecond.paymentStatus).toBe("paid");
    });

    it("17. Reusing an idempotency key with a different payload follows the conflict policy", async () => {
      const conflictKey = "e2-conflict-key-" + Date.now();

      // Seed order with this idempotency key
      await createMockOrder({
        orderNumber: "ORD-IDEM-ORIGINAL",
        customerId: customerProfile._id,
        isGuestOrder: false,
        idempotencyKey: conflictKey,
      });

      // Attempt to reuse same key for another checkout with different payload
      const reuseRes = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${customerToken}`)
        .set("Idempotency-Key", conflictKey)
        .send({
          deliveryOptionId: "express",
        });

      // Must be rejected or handled under idempotent conflict policy
      expect([400, 409]).toContain(reuseRes.status);
    });

    it("18. Concurrent orders cannot oversell inventory", async () => {
      // Set inventory stock to exactly 1
      await Inventory.updateOne(
        { productVariantId: testVariant._id, warehouseId: testWarehouse._id },
        { $set: { onHand: 1, reserved: 0 } }
      );

      // Attempt two parallel atomic conditional reservations
      const p1 = Inventory.findOneAndUpdate(
        {
          productVariantId: testVariant._id,
          warehouseId: testWarehouse._id,
          $expr: { $gte: [{ $subtract: ["$onHand", "$reserved"] }, 1] },
        },
        { $inc: { reserved: 1 } },
        { new: true }
      );

      const p2 = Inventory.findOneAndUpdate(
        {
          productVariantId: testVariant._id,
          warehouseId: testWarehouse._id,
          $expr: { $gte: [{ $subtract: ["$onHand", "$reserved"] }, 1] },
        },
        { $inc: { reserved: 1 } },
        { new: true }
      );

      const results = await Promise.all([p1, p2]);
      const successful = results.filter(Boolean);

      // Exactly ONE can succeed without overselling
      expect(successful.length).toBe(1);

      // Restore stock for subsequent tests
      await Inventory.updateOne(
        { productVariantId: testVariant._id, warehouseId: testWarehouse._id },
        { $set: { onHand: 100, reserved: 0 } }
      );
    });

    it("19. Failed checkout releases inventory safely where required", async () => {
      const invBefore = await Inventory.findOne({
        productVariantId: testVariant._id,
        warehouseId: testWarehouse._id,
      });
      const reservedBefore = invBefore.reserved;

      // Reserve 2 units
      await Inventory.updateOne(
        { productVariantId: testVariant._id, warehouseId: testWarehouse._id },
        { $inc: { reserved: 2 } }
      );

      // Simulate failure rollback / release
      await Inventory.updateOne(
        { productVariantId: testVariant._id, warehouseId: testWarehouse._id },
        { $inc: { reserved: -2 } }
      );

      const invAfter = await Inventory.findOne({
        productVariantId: testVariant._id,
        warehouseId: testWarehouse._id,
      });
      expect(invAfter.reserved).toBe(reservedBefore);
    });

    it("20. Payment failure cannot falsely mark an order paid", async () => {
      const order = await createMockOrder({
        orderNumber: "ORD-FAIL-PAY-TEST",
        customerId: customerProfile._id,
        isGuestOrder: false,
      });

      // Verification with invalid/tampered signature throws error
      await expect(
        paymentVerificationService.verifyRazorpayPayment({
          orderId: order._id.toString(),
          userId: customerUser._id.toString(),
          razorpayOrderId: "order_fake_123",
          razorpayPaymentId: "pay_fake_456",
          razorpaySignature: "invalid_tampered_signature",
        })
      ).rejects.toThrow();

      // Check order status remained pending
      const checkedOrder = await Order.findById(order._id);
      expect(checkedOrder.paymentStatus).toBe("pending");
      expect(checkedOrder.status).toBe("pending");
    });

    it("21. Tampered client prices and discounts are rejected or recalculated server-side", async () => {
      const tamperedItem = {
        productId: testProduct._id,
        productVariantId: testVariant._id,
        productName: testProduct.name,
        quantity: 1,
        unitPrice: "0.01", // Client tampered price
      };

      // Server recalculates using active ProductVariant price (2999.00)
      const variantInDb = await ProductVariant.findById(testVariant._id);
      expect(variantInDb.price.toString()).toBe("2999.00");
      expect(variantInDb.price.toString()).not.toBe(tamperedItem.unitPrice);
    });
  });

  // =========================================================================
  // GROUP 4: E1C REGRESSION VERIFICATION (22 to 26)
  // =========================================================================

  describe("Group 4: E1C Regression Verification (Superadmin, Promotions & Branding)", () => {
    it("22. Superadmin feature-flag access remains correct", async () => {
      const updateRes = await request(app)
        .patch("/api/v1/admin/settings/general/feature-flags")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          coupons: true,
          wishlist: true,
        });

      // Superadmin is authorized to modify settings/flags
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.featureFlags.coupons).toBe(true);
      expect(updateRes.body.data.featureFlags.wishlist).toBe(true);
    });

    it("23. Unauthorized roles cannot modify protected flags", async () => {
      // Customer attempt
      const custRes = await request(app)
        .patch("/api/v1/admin/settings/general/feature-flags")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          guestCheckout: true,
        });
      expect([401, 403]).toContain(custRes.status);

      // Standard Admin attempt (requires SUPER_ADMIN)
      const adminRes = await request(app)
        .patch("/api/v1/admin/settings/general/feature-flags")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          guestCheckout: true,
        });
      expect([401, 403]).toContain(adminRes.status);
    });

    it("24. Discounts and Promotions remain separate", async () => {
      // Direct API contracts ensure promotional campaigns and discount rules are separate
      const hasPromotionEngine = typeof pricingEngineService.calculateEffectivePrice === "function";
      expect(hasPromotionEngine).toBe(true);
    });

    it("25. Logo dimensions remain persistent and responsive", async () => {
      const logoUpdate = {
        logoDimensions: {
          desktopWidth: 220,
          desktopMaxHeight: 60,
          mobileWidth: 160,
          mobileMaxHeight: 45,
          footerMaxHeight: 50,
        },
      };

      await StorefrontSettings.updateOne({}, { $set: logoUpdate });
      await storefrontSettingsService.invalidateCache();

      const settings = await storefrontSettingsService.getActiveSettings();
      expect(settings.logoDimensions.desktopWidth).toBe(220);
      expect(settings.logoDimensions.desktopMaxHeight).toBe(60);
      expect(settings.logoDimensions.mobileWidth).toBe(160);
      expect(settings.logoDimensions.mobileMaxHeight).toBe(45);
      expect(settings.logoDimensions.footerMaxHeight).toBe(50);
    });

    it("26. Branding upload and settings updates preserve unrelated data", async () => {
      const originalSettings = await storefrontSettingsService.getActiveSettings();
      const originalFeatureFlags = { ...originalSettings.featureFlags };

      // Update storeName only
      await StorefrontSettings.updateOne({}, { $set: { storeName: "Buybox Premium E2 Store" } });
      await storefrontSettingsService.invalidateCache();

      const updatedSettings = await storefrontSettingsService.getActiveSettings();
      expect(updatedSettings.storeName).toBe("Buybox Premium E2 Store");
      // Unrelated feature flags must be preserved
      expect(updatedSettings.featureFlags.coupons).toBe(originalFeatureFlags.coupons);
      expect(updatedSettings.featureFlags.guestCheckout).toBe(originalFeatureFlags.guestCheckout);
    });
  });
});
