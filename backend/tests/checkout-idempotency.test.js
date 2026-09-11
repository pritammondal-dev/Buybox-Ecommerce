const mongoose = require("mongoose");
const request = require("supertest");
const crypto = require("crypto");

jest.mock("../src/repositories/order.repository");
jest.mock("../src/repositories/cart.repository");
jest.mock("../src/repositories/address.repository");
jest.mock("../src/repositories/inventory.repository");
jest.mock("../src/services/inventory.service");
jest.mock("../src/services/coupon.service");
jest.mock("../src/services/coupon-redemption.service");
jest.mock("../src/services/tax.service");
jest.mock("../src/services/notification-outbox.service");
jest.mock("../src/services/analytics.service");
jest.mock("../src/models/Customer");
jest.mock("../src/models/User");
jest.mock("../src/models/Product");
jest.mock("../src/models/ProductVariant");
jest.mock("../src/utils/withTransaction");

const Order = require("../src/models/Order");
const Customer = require("../src/models/Customer");
const User = require("../src/models/User");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");

const orderRepository = require("../src/repositories/order.repository");
const cartRepository = require("../src/repositories/cart.repository");
const addressRepository = require("../src/repositories/address.repository");
const inventoryRepository = require("../src/repositories/inventory.repository");
const inventoryService = require("../src/services/inventory.service");
const couponService = require("../src/services/coupon.service");
const couponRedemptionService = require("../src/services/coupon-redemption.service");
const taxService = require("../src/services/tax.service");
const notificationOutboxService = require("../src/services/notification-outbox.service");
const analyticsService = require("../src/services/analytics.service");
const withTransaction = require("../src/utils/withTransaction");

const orderService = require("../src/services/order.service");
const { generateAccessToken } = require("../src/services/token.service");
const app = require("../src/app");

describe("Task 8B.3 — Checkout Idempotency & Retry Recovery", () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();
  const shippingAddressId = new mongoose.Types.ObjectId().toString();
  const variantId = new mongoose.Types.ObjectId().toString();
  const productId = new mongoose.Types.ObjectId().toString();
  const warehouseId = new mongoose.Types.ObjectId().toString();
  const vendorId = new mongoose.Types.ObjectId().toString();

  let token;
  let defaultCart;
  let defaultAddress;
  let defaultTaxCalculation;

  beforeEach(() => {
    jest.clearAllMocks();

    token = generateAccessToken({ sub: userId, role: "customer" });

    // Mock withTransaction to simply execute callback with a mock session
    withTransaction.mockImplementation(async (callback) => {
      const mockSession = {};
      return callback(mockSession);
    });

    // Mock Customer lookup
    Customer.findOne.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(customerId),
      userId,
      isActive: true,
      deletedAt: null,
    });

    // Mock User lookup
    User.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        session: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            email: "customer@example.com",
            firstName: "John",
            lastName: "Doe",
          }),
        }),
      }),
    });

    // Mock Address lookup
    defaultAddress = {
      _id: new mongoose.Types.ObjectId(shippingAddressId),
      userId,
      firstName: "John",
      lastName: "Doe",
      phone: "+919876543210",
      addressLine1: "123 Market Street",
      addressLine2: "Suite 400",
      city: "Bengaluru",
      state: "Karnataka",
      postalCode: "560001",
      country: "IN",
    };
    addressRepository.findById.mockResolvedValue(defaultAddress);

    // Mock Cart
    defaultCart = {
      _id: new mongoose.Types.ObjectId(),
      customerId: new mongoose.Types.ObjectId(customerId),
      status: "active",
      currency: "INR",
      items: [
        {
          productVariantId: new mongoose.Types.ObjectId(variantId),
          quantity: 2,
        },
      ],
    };
    cartRepository.findActiveByCustomer.mockResolvedValue(defaultCart);
    cartRepository.convertActiveCart.mockResolvedValue({
      ...defaultCart,
      status: "converted",
    });

    // Mock Product and Variant
    ProductVariant.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          _id: new mongoose.Types.ObjectId(variantId),
          productId: new mongoose.Types.ObjectId(productId),
          sku: "TEST-SKU-1",
          price: "500.00",
          currency: "INR",
          name: "Test Variant",
          isActive: true,
          deletedAt: null,
        },
      ]),
    });

    Product.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          _id: new mongoose.Types.ObjectId(productId),
          vendorId: new mongoose.Types.ObjectId(vendorId),
          categoryId: new mongoose.Types.ObjectId(),
          name: "Test Product",
          status: "active",
          deletedAt: null,
        },
      ]),
    });

    // Mock first order check
    jest.spyOn(Order, "findOne").mockReturnValue({
      select: jest.fn().mockReturnValue({
        session: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      }),
    });

    // Mock inventory
    inventoryRepository.findByVariant.mockResolvedValue([
      {
        _id: new mongoose.Types.ObjectId(),
        warehouseId: new mongoose.Types.ObjectId(warehouseId),
        onHand: 10,
        reserved: 0,
      },
    ]);
    inventoryService.reserveStockInTransaction.mockResolvedValue({
      warehouseId: new mongoose.Types.ObjectId(warehouseId),
    });

    // Mock tax calculation
    defaultTaxCalculation = {
      items: [
        {
          productId: new mongoose.Types.ObjectId(productId),
          productVariantId: new mongoose.Types.ObjectId(variantId),
          vendorId: new mongoose.Types.ObjectId(vendorId),
          categoryId: new mongoose.Types.ObjectId(),
          sku: "TEST-SKU-1",
          productName: "Test Product",
          variantName: "Test Variant",
          quantity: 2,
          unitPrice: "500.00",
          lineTotal: "1000.00",
          discountTotal: "0.00",
          taxTotal: "180.00",
          currency: "INR",
        },
      ],
      totalTaxMinorUnits: 18000,
      pricingMode: "exclusive",
      taxSnapshot: {
        jurisdictionCountry: "IN",
        jurisdictionState: "Karnataka",
      },
    };
    taxService.calculateOrderTax.mockResolvedValue(defaultTaxCalculation);

    // Mock notification outbox
    notificationOutboxService.enqueue.mockResolvedValue({});

    // Mock order creation in repository
    orderRepository.create.mockImplementation(async (data) => ({
      _id: new mongoose.Types.ObjectId(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    // Default: findByCustomerIdAndIdempotencyKey returns null (new key)
    orderRepository.findByCustomerIdAndIdempotencyKey.mockResolvedValue(null);
  });

  describe("1. Order Schema & Index Structure", () => {
    it("should define compound partial unique index on { customerId: 1, idempotencyKey: 1 }", () => {
      const indexes = Order.schema.indexes();

      const compoundIndex = indexes.find(([fields, options]) => {
        return (
          fields.customerId === 1 &&
          fields.idempotencyKey === 1 &&
          options.unique === true &&
          options.partialFilterExpression?.idempotencyKey?.$type === "string"
        );
      });

      expect(compoundIndex).toBeDefined();
    });

    it("should NOT have a standalone unique index on idempotencyKey alone", () => {
      const indexes = Order.schema.indexes();

      const standaloneIndex = indexes.find(([fields, options]) => {
        return (
          fields.idempotencyKey === 1 &&
          Object.keys(fields).length === 1 &&
          options?.unique === true
        );
      });

      expect(standaloneIndex).toBeUndefined();
    });

    it("should have idempotencyKey and idempotencyFingerprint in schema definition", () => {
      expect(Order.schema.path("idempotencyKey")).toBeDefined();
      expect(Order.schema.path("idempotencyFingerprint")).toBeDefined();
    });
  });

  describe("2. Service-level Idempotency & Checkout Logic", () => {
    const validKey = "checkout-idem-key-001";

    it("should create a new order and persist idempotencyKey and idempotencyFingerprint", async () => {
      const order = await orderService.createOrderFromCurrentCart(
        userId,
        shippingAddressId,
        null,
        validKey
      );

      expect(order).toBeDefined();
      expect(order.idempotencyKey).toBe(validKey);
      expect(order.idempotencyFingerprint).toBeDefined();
      expect(typeof order.idempotencyFingerprint).toBe("string");
      expect(order.isReplay).toBeUndefined();

      expect(orderRepository.create).toHaveBeenCalledTimes(1);
      expect(cartRepository.convertActiveCart).toHaveBeenCalledTimes(1);
    });

    it("should return the existing order on idempotent retry without re-executing order creation", async () => {
      // First call: order created
      const expectedFingerprint = crypto
        .createHash("sha256")
        .update(`${customerId}|${shippingAddressId}|`, "utf8")
        .digest("hex");

      const existingOrder = {
        _id: new mongoose.Types.ObjectId(),
        orderNumber: "BB-TEST-001",
        customerId: new mongoose.Types.ObjectId(customerId),
        shippingAddressId,
        idempotencyKey: validKey,
        idempotencyFingerprint: expectedFingerprint,
        grandTotal: "1180.00",
        items: [{ sku: "TEST-SKU-1", quantity: 2 }],
      };

      // Mock that pre-transaction lookup finds existing order
      orderRepository.findByCustomerIdAndIdempotencyKey.mockResolvedValue(existingOrder);

      const replayOrder = await orderService.createOrderFromCurrentCart(
        userId,
        shippingAddressId,
        null,
        validKey
      );

      expect(replayOrder._id).toEqual(existingOrder._id);
      expect(replayOrder.orderNumber).toBe("BB-TEST-001");
      expect(replayOrder.isReplay).toBe(true);

      // Verify transaction was bypassed: no new order, no cart conversion
      expect(orderRepository.create).not.toHaveBeenCalled();
      expect(cartRepository.convertActiveCart).not.toHaveBeenCalled();
      expect(inventoryService.reserveStockInTransaction).not.toHaveBeenCalled();
    });

    it("should throw 409 IDEMPOTENCY_KEY_CONFLICT when same key is used with different shippingAddressId", async () => {
      const differentAddressId = new mongoose.Types.ObjectId().toString();
      const expectedFingerprint = crypto
        .createHash("sha256")
        .update(`${customerId}|${shippingAddressId}|`, "utf8")
        .digest("hex");

      const existingOrder = {
        _id: new mongoose.Types.ObjectId(),
        orderNumber: "BB-TEST-001",
        customerId: new mongoose.Types.ObjectId(customerId),
        idempotencyKey: validKey,
        idempotencyFingerprint: expectedFingerprint,
      };

      orderRepository.findByCustomerIdAndIdempotencyKey.mockResolvedValue(existingOrder);
      addressRepository.findById.mockResolvedValue({
        ...defaultAddress,
        _id: new mongoose.Types.ObjectId(differentAddressId),
      });

      await expect(
        orderService.createOrderFromCurrentCart(
          userId,
          differentAddressId,
          null,
          validKey
        )
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "IDEMPOTENCY_KEY_CONFLICT",
      });

      expect(orderRepository.create).not.toHaveBeenCalled();
    });

    it("should throw 409 IDEMPOTENCY_KEY_CONFLICT when same key is used with different couponCode", async () => {
      const expectedFingerprint = crypto
        .createHash("sha256")
        .update(`${customerId}|${shippingAddressId}|`, "utf8")
        .digest("hex");

      const existingOrder = {
        _id: new mongoose.Types.ObjectId(),
        orderNumber: "BB-TEST-001",
        customerId: new mongoose.Types.ObjectId(customerId),
        idempotencyKey: validKey,
        idempotencyFingerprint: expectedFingerprint,
      };

      orderRepository.findByCustomerIdAndIdempotencyKey.mockResolvedValue(existingOrder);

      await expect(
        orderService.createOrderFromCurrentCart(
          userId,
          shippingAddressId,
          "SAVE20",
          validKey
        )
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "IDEMPOTENCY_KEY_CONFLICT",
      });

      expect(orderRepository.create).not.toHaveBeenCalled();
    });

    it("should allow different customers to use the exact same Idempotency-Key without collision", async () => {
      const customerId2 = new mongoose.Types.ObjectId().toString();
      const userId2 = new mongoose.Types.ObjectId().toString();

      // Customer 1 checkout
      const order1 = await orderService.createOrderFromCurrentCart(
        userId,
        shippingAddressId,
        null,
        validKey
      );

      // Customer 2 setup
      Customer.findOne.mockResolvedValueOnce({
        _id: new mongoose.Types.ObjectId(customerId2),
        userId: userId2,
        isActive: true,
        deletedAt: null,
      });
      User.findById.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({
              email: "customer2@example.com",
              firstName: "Jane",
              lastName: "Smith",
            }),
          }),
        }),
      });
      addressRepository.findById.mockResolvedValueOnce({
        ...defaultAddress,
        userId: userId2,
      });

      // Customer 2 checkout with the same key
      const order2 = await orderService.createOrderFromCurrentCart(
        userId2,
        shippingAddressId,
        null,
        validKey
      );

      expect(order1).toBeDefined();
      expect(order2).toBeDefined();
      expect(order1.customerId.toString()).toBe(customerId);
      expect(order2.customerId.toString()).toBe(customerId2);
      expect(orderRepository.create).toHaveBeenCalledTimes(2);
    });

    it("should recover existing order when cart is already converted (network drop recovery)", async () => {
      const expectedFingerprint = crypto
        .createHash("sha256")
        .update(`${customerId}|${shippingAddressId}|`, "utf8")
        .digest("hex");

      const existingOrder = {
        _id: new mongoose.Types.ObjectId(),
        orderNumber: "BB-TEST-002",
        customerId: new mongoose.Types.ObjectId(customerId),
        idempotencyKey: validKey,
        idempotencyFingerprint: expectedFingerprint,
      };

      // Scenario: pre-transaction check missed (e.g. slight race), inside transaction cart is converted (null)
      cartRepository.findActiveByCustomer.mockResolvedValue(null);
      // In-transaction lookup finds the created order
      orderRepository.findByCustomerIdAndIdempotencyKey
        .mockResolvedValueOnce(null) // pre-check returns null
        .mockResolvedValueOnce(existingOrder); // in-transaction recovery

      const recoveredOrder = await orderService.createOrderFromCurrentCart(
        userId,
        shippingAddressId,
        null,
        validKey
      );

      expect(recoveredOrder._id).toEqual(existingOrder._id);
      expect(recoveredOrder.isReplay).toBe(true);
      expect(orderRepository.create).not.toHaveBeenCalled();
    });

    it("should throw 404 CART_NOT_FOUND if cart is missing and no idempotency order exists", async () => {
      cartRepository.findActiveByCustomer.mockResolvedValue(null);
      orderRepository.findByCustomerIdAndIdempotencyKey.mockResolvedValue(null);

      await expect(
        orderService.createOrderFromCurrentCart(
          userId,
          shippingAddressId,
          null,
          validKey
        )
      ).rejects.toMatchObject({
        statusCode: 404,
        code: "CART_NOT_FOUND",
      });
    });

    it("should recover winner order when concurrent request encounters E11000 duplicate key", async () => {
      const expectedFingerprint = crypto
        .createHash("sha256")
        .update(`${customerId}|${shippingAddressId}|`, "utf8")
        .digest("hex");

      const winningOrder = {
        _id: new mongoose.Types.ObjectId(),
        orderNumber: "BB-WINNER-001",
        customerId: new mongoose.Types.ObjectId(customerId),
        idempotencyKey: validKey,
        idempotencyFingerprint: expectedFingerprint,
      };

      // Pre-check finds nothing (both requests started at the same time)
      orderRepository.findByCustomerIdAndIdempotencyKey
        .mockResolvedValueOnce(null) // pre-check
        .mockResolvedValueOnce(winningOrder); // post-E11000 lookup

      // Transaction throws E11000
      withTransaction.mockRejectedValueOnce(
        Object.assign(
          new Error("E11000 duplicate key error collection: orders index: customerId_1_idempotencyKey_1 dup key"),
          { code: 11000 }
        )
      );

      const recoveredOrder = await orderService.createOrderFromCurrentCart(
        userId,
        shippingAddressId,
        null,
        validKey
      );

      expect(recoveredOrder._id).toEqual(winningOrder._id);
      expect(recoveredOrder.orderNumber).toBe("BB-WINNER-001");
      expect(recoveredOrder.isReplay).toBe(true);
    });

    it("should throw 409 IDEMPOTENCY_KEY_CONFLICT if E11000 winner order has different fingerprint", async () => {
      const winningOrder = {
        _id: new mongoose.Types.ObjectId(),
        orderNumber: "BB-WINNER-002",
        customerId: new mongoose.Types.ObjectId(customerId),
        idempotencyKey: validKey,
        idempotencyFingerprint: "different-fingerprint-from-concurrent-requester",
      };

      orderRepository.findByCustomerIdAndIdempotencyKey
        .mockResolvedValueOnce(null) // pre-check
        .mockResolvedValueOnce(winningOrder); // post-E11000 lookup

      withTransaction.mockRejectedValueOnce(
        Object.assign(
          new Error("E11000 duplicate key error"),
          { code: 11000 }
        )
      );

      await expect(
        orderService.createOrderFromCurrentCart(
          userId,
          shippingAddressId,
          null,
          validKey
        )
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "IDEMPOTENCY_KEY_CONFLICT",
      });
    });

    it("should rethrow non-idempotency error from withTransaction", async () => {
      withTransaction.mockRejectedValueOnce(new Error("Database connection lost"));

      await expect(
        orderService.createOrderFromCurrentCart(
          userId,
          shippingAddressId,
          null,
          validKey
        )
      ).rejects.toThrow("Database connection lost");
    });

    it("should create order without idempotencyKey when key is null/omitted", async () => {
      const order = await orderService.createOrderFromCurrentCart(
        userId,
        shippingAddressId,
        null,
        null
      );

      expect(order).toBeDefined();
      expect(order.idempotencyKey).toBeNull();
      expect(order.idempotencyFingerprint).toBeNull();
      expect(orderRepository.findByCustomerIdAndIdempotencyKey).not.toHaveBeenCalled();
      expect(orderRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: null,
          idempotencyFingerprint: null,
        }),
        expect.any(Object)
      );
    });

    it("should trim and normalize Idempotency-Key", async () => {
      const paddedKey = "   my-padded-key-12345   ";
      const normalizedKey = "my-padded-key-12345";

      const order = await orderService.createOrderFromCurrentCart(
        userId,
        shippingAddressId,
        null,
        paddedKey
      );

      expect(order.idempotencyKey).toBe(normalizedKey);
    });

    it("should reject invalid Idempotency-Key with 400 INVALID_IDEMPOTENCY_KEY", async () => {
      const invalidKeys = [
        "",
        "   ",
        "short", // length < 8
        "a".repeat(129), // length > 128
        12345, // non-string
      ];

      for (const key of invalidKeys) {
        await expect(
          orderService.createOrderFromCurrentCart(
            userId,
            shippingAddressId,
            null,
            key
          )
        ).rejects.toMatchObject({
          statusCode: 400,
          code: "INVALID_IDEMPOTENCY_KEY",
        });
      }
    });
  });

  describe("3. HTTP API & Controller Integration (POST /api/v1/orders)", () => {
    const validHeaderKey = "req-idemp-key-99999";

    it("should successfully create order and track analytics once on initial request", async () => {
      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", validHeaderKey)
        .send({
          shippingAddressId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.idempotencyKey).toBe(validHeaderKey);
      expect(res.body.data.isReplay).toBeUndefined(); // ensure isReplay never leaks

      expect(analyticsService.track).toHaveBeenCalledTimes(1);
      expect(analyticsService.track).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: "order_created",
          userId,
        })
      );
    });

    it("should return existing order on replay without calling analytics.track again", async () => {
      const expectedFingerprint = crypto
        .createHash("sha256")
        .update(`${customerId}|${shippingAddressId}|`, "utf8")
        .digest("hex");

      const existingOrder = {
        _id: new mongoose.Types.ObjectId(),
        orderNumber: "BB-HTTP-REPLAY-1",
        customerId: new mongoose.Types.ObjectId(customerId),
        currency: "INR",
        grandTotal: "1180.00",
        items: [{ sku: "TEST-SKU-1", quantity: 2 }],
        idempotencyKey: validHeaderKey,
        idempotencyFingerprint: expectedFingerprint,
      };

      orderRepository.findByCustomerIdAndIdempotencyKey.mockResolvedValue(existingOrder);

      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", validHeaderKey)
        .send({
          shippingAddressId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderNumber).toBe("BB-HTTP-REPLAY-1");
      expect(res.body.data.isReplay).toBeUndefined(); // stripped cleanly

      // Crucial: analytics track must NOT be called on replay
      expect(analyticsService.track).not.toHaveBeenCalled();
    });

    it("should return 409 IDEMPOTENCY_KEY_CONFLICT when replaying same key with different body", async () => {
      const differentAddressId = new mongoose.Types.ObjectId().toString();
      const expectedFingerprint = crypto
        .createHash("sha256")
        .update(`${customerId}|${shippingAddressId}|`, "utf8")
        .digest("hex");

      const existingOrder = {
        _id: new mongoose.Types.ObjectId(),
        orderNumber: "BB-HTTP-REPLAY-1",
        customerId: new mongoose.Types.ObjectId(customerId),
        idempotencyKey: validHeaderKey,
        idempotencyFingerprint: expectedFingerprint,
      };

      orderRepository.findByCustomerIdAndIdempotencyKey.mockResolvedValue(existingOrder);
      addressRepository.findById.mockResolvedValue({
        ...defaultAddress,
        _id: new mongoose.Types.ObjectId(differentAddressId),
      });

      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", validHeaderKey)
        .send({
          shippingAddressId: differentAddressId,
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("IDEMPOTENCY_KEY_CONFLICT");
      expect(analyticsService.track).not.toHaveBeenCalled();
    });

    it("should return 400 INVALID_IDEMPOTENCY_KEY when Idempotency-Key header is whitespace or too short", async () => {
      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", "short")
        .send({
          shippingAddressId,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("INVALID_IDEMPOTENCY_KEY");
      expect(analyticsService.track).not.toHaveBeenCalled();
    });

    it("should succeed when Idempotency-Key header is absent", async () => {
      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${token}`)
        .send({
          shippingAddressId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.idempotencyKey).toBeNull();
      expect(analyticsService.track).toHaveBeenCalledTimes(1);
    });
  });
});
