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
const {
  generateQuoteReference,
  verifyQuoteReference,
  computePricingFingerprint,
  getSigningKey,
} = require("../src/utils/quote-reference.util");
const { generateAccessToken } = require("../src/services/token.service");
const app = require("../src/app");

describe("Phase 3A.1 — Checkout Quote Staleness & Integrity (DEF-3A-05)", () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();
  const shippingAddressId = new mongoose.Types.ObjectId().toString();
  const variantId = new mongoose.Types.ObjectId().toString();
  const productId = new mongoose.Types.ObjectId().toString();
  const warehouseId = new mongoose.Types.ObjectId().toString();
  const vendorId = new mongoose.Types.ObjectId().toString();
  const cartId = new mongoose.Types.ObjectId().toString();

  let token;
  let defaultCart;
  let defaultAddress;
  let defaultTaxCalculation;

  beforeEach(() => {
    jest.clearAllMocks();

    token = generateAccessToken({ sub: userId, role: "customer" });

    withTransaction.mockImplementation(async (callback) => {
      const mockSession = {};
      return callback(mockSession);
    });

    Customer.findOne.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(customerId),
      userId,
      isActive: true,
      deletedAt: null,
    });

    User.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        session: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            email: "customer@example.com",
            firstName: "Jane",
            lastName: "Doe",
          }),
        }),
      }),
    });

    defaultAddress = {
      _id: new mongoose.Types.ObjectId(shippingAddressId),
      userId,
      firstName: "Jane",
      lastName: "Doe",
      phone: "+919876543210",
      addressLine1: "123 Market Street",
      city: "Mumbai",
      state: "Maharashtra",
      postalCode: "400001",
      country: "IN",
    };
    addressRepository.findById.mockResolvedValue(defaultAddress);

    defaultCart = {
      _id: new mongoose.Types.ObjectId(cartId),
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

    ProductVariant.find.mockReturnValue({
      session: jest.fn().mockReturnThis(),
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
      session: jest.fn().mockReturnThis(),
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

    jest.spyOn(Order, "findOne").mockReturnValue({
      select: jest.fn().mockReturnValue({
        session: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      }),
    });

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

    // 2 items * 500 = 1000 subtotal, 180 tax, 0 shipping -> 1180.00 grandTotal
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
        jurisdictionState: "Maharashtra",
      },
    };
    taxService.calculateOrderTax.mockResolvedValue(defaultTaxCalculation);

    notificationOutboxService.enqueue.mockResolvedValue({});

    orderRepository.create.mockImplementation(async (data) => ({
      _id: new mongoose.Types.ObjectId(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    orderRepository.findByCustomerIdAndIdempotencyKey.mockResolvedValue(null);
  });

  describe("1. Cryptographic Quote Reference Utility", () => {
    it("generates a signed quote token bound to customer, cart, and total", () => {
      const { quoteReference, expiresAt } = generateQuoteReference({
        customerId,
        cartId,
        grandTotal: "1180.00",
        currency: "INR",
      });

      expect(quoteReference).toMatch(/^qref_v1_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
      expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());

      const verified = verifyQuoteReference(quoteReference, { customerId, cartId });
      expect(verified.quotedGrandTotal).toBe("1180.00");
      expect(verified.currency).toBe("INR");
      expect(verified.customerId).toBe(customerId);
      expect(verified.cartId).toBe(cartId);
    });

    it("rejects token tampered in payload or signature", () => {
      const { quoteReference } = generateQuoteReference({
        customerId,
        cartId,
        grandTotal: "1180.00",
        currency: "INR",
      });

      const tampered = quoteReference.slice(0, -6) + "xyz123";
      expect(() => {
        verifyQuoteReference(tampered, { customerId, cartId });
      }).toThrow("Quote reference signature verification failed");
    });

    it("rejects token used with a different customer ID", () => {
      const otherCustomerId = new mongoose.Types.ObjectId().toString();
      const { quoteReference } = generateQuoteReference({
        customerId,
        cartId,
        grandTotal: "1180.00",
        currency: "INR",
      });

      expect(() => {
        verifyQuoteReference(quoteReference, { customerId: otherCustomerId, cartId });
      }).toThrow("Quote reference belongs to another customer account");
    });

    it("rejects token used with a different cart ID", () => {
      const otherCartId = new mongoose.Types.ObjectId().toString();
      const { quoteReference } = generateQuoteReference({
        customerId,
        cartId,
        grandTotal: "1180.00",
        currency: "INR",
      });

      expect(() => {
        verifyQuoteReference(quoteReference, { customerId, cartId: otherCartId });
      }).toThrow("Quote reference does not match the active customer cart");
    });

    it("rejects expired token with QUOTE_EXPIRED error code", () => {
      const { quoteReference } = generateQuoteReference({
        customerId,
        cartId,
        grandTotal: "1180.00",
        currency: "INR",
        expiresInMs: -1000,
      });

      expect(() => {
        verifyQuoteReference(quoteReference, { customerId, cartId });
      }).toThrow("Checkout quote has expired. Please refresh checkout to verify current pricing.");
    });
  });

  describe("2. Authoritative Checkout Quote Endpoint", () => {
    it("returns quoteReference and quoteExpiresAt in quote response", async () => {
      const res = await request(app)
        .post("/api/v1/orders/quote")
        .set("Authorization", `Bearer ${token}`)
        .send({
          shippingAddressId,
          deliveryOptionId: "standard",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.quoteReference).toBeDefined();
      expect(res.body.data.quoteReference).toMatch(/^qref_v1_/);
      expect(res.body.data.quoteExpiresAt).toBeDefined();
      expect(res.body.data.grandTotal).toBe("1180.00");
    });
  });

  describe("3. Order Submission With Quote Reference", () => {
    it("creates order successfully when quote total matches authoritative total", async () => {
      const { quoteReference } = generateQuoteReference({
        customerId,
        cartId,
        grandTotal: "1180.00",
        currency: "INR",
      });

      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${token}`)
        .send({
          shippingAddressId,
          deliveryOptionId: "standard",
          quoteReference,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(inventoryService.reserveStockInTransaction).toHaveBeenCalled();
      expect(orderRepository.create).toHaveBeenCalled();
    });

    it("rejects order with 409 PRICE_CHANGED when catalog price changes between quote and submission", async () => {
      // Customer quoted 1180.00 (unit price 500)
      const { quoteReference } = generateQuoteReference({
        customerId,
        cartId,
        grandTotal: "1180.00",
        currency: "INR",
      });

      // Price changed to 600 in catalog before submission
      ProductVariant.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: new mongoose.Types.ObjectId(variantId),
            productId: new mongoose.Types.ObjectId(productId),
            sku: "TEST-SKU-1",
            price: "600.00",
            currency: "INR",
            name: "Test Variant",
            isActive: true,
            deletedAt: null,
          },
        ]),
      });

      taxService.calculateOrderTax.mockResolvedValue({
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
            unitPrice: "600.00",
            lineTotal: "1200.00",
            discountTotal: "0.00",
            taxTotal: "216.00",
            currency: "INR",
          },
        ],
        totalTaxMinorUnits: 21600,
        pricingMode: "exclusive",
        taxSnapshot: {
          jurisdictionCountry: "IN",
          jurisdictionState: "Maharashtra",
        },
      });

      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${token}`)
        .send({
          shippingAddressId,
          deliveryOptionId: "standard",
          quoteReference,
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("PRICE_CHANGED");
      expect(res.body.details).toBeDefined();
      expect(res.body.details.quotedGrandTotal).toBe("1180.00");
      expect(res.body.details.currentGrandTotal).toBe("1416.00");

      // Verify no order was created and no stock was reserved
      expect(inventoryService.reserveStockInTransaction).not.toHaveBeenCalled();
      expect(orderRepository.create).not.toHaveBeenCalled();
    });

    it("rejects order with 409 QUOTE_EXPIRED when quoteReference is older than TTL", async () => {
      const { quoteReference } = generateQuoteReference({
        customerId,
        cartId,
        grandTotal: "1180.00",
        currency: "INR",
        expiresInMs: -5000,
      });

      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${token}`)
        .send({
          shippingAddressId,
          deliveryOptionId: "standard",
          quoteReference,
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("QUOTE_EXPIRED");
      expect(inventoryService.reserveStockInTransaction).not.toHaveBeenCalled();
      expect(orderRepository.create).not.toHaveBeenCalled();
    });

    it("rejects order with 400 INVALID_QUOTE_REFERENCE when quoteReference is stolen from another customer", async () => {
      const otherCustomerId = new mongoose.Types.ObjectId().toString();
      const { quoteReference } = generateQuoteReference({
        customerId: otherCustomerId,
        cartId,
        grandTotal: "1180.00",
        currency: "INR",
      });

      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${token}`)
        .send({
          shippingAddressId,
          deliveryOptionId: "standard",
          quoteReference,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_QUOTE_REFERENCE");
      expect(inventoryService.reserveStockInTransaction).not.toHaveBeenCalled();
      expect(orderRepository.create).not.toHaveBeenCalled();
    });

    it("preserves backward compatibility when quoteReference is omitted, computing authoritative price", async () => {
      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${token}`)
        .send({
          shippingAddressId,
          deliveryOptionId: "standard",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(orderRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          grandTotal: "1180.00",
        }),
        expect.anything()
      );
    });

    it("maintains idempotency replay when quoteReference is supplied with Idempotency-Key", async () => {
      const { quoteReference } = generateQuoteReference({
        customerId,
        cartId,
        grandTotal: "1180.00",
        currency: "INR",
      });

      const existingOrder = {
        _id: "order-existing-123",
        orderNumber: "BB-EXISTING-123",
        customerId,
        idempotencyKey: "bb-idem-test-key-12345",
        idempotencyFingerprint: crypto
          .createHash("sha256")
          .update(`${String(customerId)}|${String(shippingAddressId)}|`, "utf8")
          .digest("hex"),
        grandTotal: "1180.00",
        items: [],
      };

      orderRepository.findByCustomerIdAndIdempotencyKey.mockResolvedValue(existingOrder);

      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", "bb-idem-test-key-12345")
        .send({
          shippingAddressId,
          deliveryOptionId: "standard",
          quoteReference,
        });

      expect(res.status).toBe(201);
      expect(orderRepository.create).not.toHaveBeenCalled();
      expect(inventoryService.reserveStockInTransaction).not.toHaveBeenCalled();
    });

    it("rejects order with 409 PRICE_CHANGED when shipping fee changes between quote and submission", async () => {
      const { quoteReference } = generateQuoteReference({
        customerId,
        cartId,
        grandTotal: "1180.00",
        currency: "INR",
      });

      // Submit with express delivery option (which adds an express delivery fee)
      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${token}`)
        .send({
          shippingAddressId,
          deliveryOptionId: "express",
          quoteReference,
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("PRICE_CHANGED");
      expect(res.body.details.quotedGrandTotal).toBe("1180.00");
      expect(inventoryService.reserveStockInTransaction).not.toHaveBeenCalled();
      expect(orderRepository.create).not.toHaveBeenCalled();
    });

    it("rejects order with 409 PRICE_CHANGED when tax rate or tax snapshot changes", async () => {
      const { quoteReference } = generateQuoteReference({
        customerId,
        cartId,
        grandTotal: "1180.00",
        currency: "INR",
      });

      // Tax increases from 180 to 280
      taxService.calculateOrderTax.mockResolvedValue({
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
            taxTotal: "280.00",
            currency: "INR",
          },
        ],
        totalTaxMinorUnits: 28000,
        pricingMode: "exclusive",
        taxSnapshot: {
          jurisdictionCountry: "IN",
          jurisdictionState: "Maharashtra",
        },
      });

      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${token}`)
        .send({
          shippingAddressId,
          deliveryOptionId: "standard",
          quoteReference,
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("PRICE_CHANGED");
      expect(res.body.details.quotedGrandTotal).toBe("1180.00");
      expect(res.body.details.currentGrandTotal).toBe("1280.00");
      expect(inventoryService.reserveStockInTransaction).not.toHaveBeenCalled();
    });

    it("rejects order with 409 PRICE_CHANGED when currency mismatch occurs", async () => {
      const { quoteReference } = generateQuoteReference({
        customerId,
        cartId,
        grandTotal: "1180.00",
        currency: "USD", // Quoted in USD but cart is INR
      });

      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${token}`)
        .send({
          shippingAddressId,
          deliveryOptionId: "standard",
          quoteReference,
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("PRICE_CHANGED");
      expect(inventoryService.reserveStockInTransaction).not.toHaveBeenCalled();
    });

    it("rejects malformed quote reference format with 400 INVALID_QUOTE_REFERENCE", async () => {
      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${token}`)
        .send({
          shippingAddressId,
          deliveryOptionId: "standard",
          quoteReference: "malformed_token_string",
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_QUOTE_REFERENCE");
      expect(inventoryService.reserveStockInTransaction).not.toHaveBeenCalled();
    });
  });

  describe("4. Phase 3A.1.2 Canonical Pricing Fingerprint & Offsetting Changes", () => {
    it("rejects order with 409 PRICE_CHANGED when two item prices change in opposite directions while grand total remains identical", async () => {
      const variant2Id = new mongoose.Types.ObjectId().toString();
      const product2Id = new mongoose.Types.ObjectId().toString();

      // Active cart has 2 items: Variant 1 (qty 1 @ 500) and Variant 2 (qty 1 @ 500). Subtotal 1000, Tax 180 -> Grand Total 1180.00
      const multiItemCart = {
        _id: new mongoose.Types.ObjectId(cartId),
        customerId: new mongoose.Types.ObjectId(customerId),
        status: "active",
        currency: "INR",
        items: [
          { productVariantId: new mongoose.Types.ObjectId(variantId), quantity: 1 },
          { productVariantId: new mongoose.Types.ObjectId(variant2Id), quantity: 1 },
        ],
      };
      cartRepository.findActiveByCustomer.mockResolvedValue(multiItemCart);

      // Quoted state: Variant 1 = 500.00, Variant 2 = 500.00
      const quotedItems = [
        {
          productId,
          productVariantId: variantId,
          sku: "TEST-SKU-1",
          quantity: 1,
          unitPrice: "500.00",
          lineTotal: "500.00",
          taxTotal: "90.00",
          discountTotal: "0.00",
        },
        {
          productId: product2Id,
          productVariantId: variant2Id,
          sku: "TEST-SKU-2",
          quantity: 1,
          unitPrice: "500.00",
          lineTotal: "500.00",
          taxTotal: "90.00",
          discountTotal: "0.00",
        },
      ];

      const { quoteReference } = generateQuoteReference({
        customerId,
        cartId,
        grandTotal: "1180.00",
        currency: "INR",
        items: quotedItems,
        subtotal: "1000.00",
        taxTotal: "180.00",
        shippingTotal: "0.00",
        deliveryOptionId: "standard",
      });

      // At submission: Variant 1 dropped to 400.00 (-100), Variant 2 increased to 600.00 (+100)
      // Subtotal is STILL 1000.00, Tax is STILL 180.00, Grand total is STILL 1180.00!
      ProductVariant.find.mockReturnValue({
        session: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          {
            _id: new mongoose.Types.ObjectId(variantId),
            productId: new mongoose.Types.ObjectId(productId),
            sku: "TEST-SKU-1",
            price: "400.00",
            currency: "INR",
            name: "Test Variant 1",
            isActive: true,
            deletedAt: null,
          },
          {
            _id: new mongoose.Types.ObjectId(variant2Id),
            productId: new mongoose.Types.ObjectId(product2Id),
            sku: "TEST-SKU-2",
            price: "600.00",
            currency: "INR",
            name: "Test Variant 2",
            isActive: true,
            deletedAt: null,
          },
        ]),
      });

      Product.find.mockReturnValue({
        session: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          { _id: new mongoose.Types.ObjectId(productId), vendorId: new mongoose.Types.ObjectId(vendorId), status: "active", deletedAt: null },
          { _id: new mongoose.Types.ObjectId(product2Id), vendorId: new mongoose.Types.ObjectId(vendorId), status: "active", deletedAt: null },
        ]),
      });

      taxService.calculateOrderTax.mockResolvedValue({
        items: [
          {
            productId: new mongoose.Types.ObjectId(productId),
            productVariantId: new mongoose.Types.ObjectId(variantId),
            sku: "TEST-SKU-1",
            productName: "Test Product",
            variantName: "Test Variant 1",
            quantity: 1,
            unitPrice: "400.00",
            lineTotal: "400.00",
            discountTotal: "0.00",
            taxTotal: "90.00",
            currency: "INR",
          },
          {
            productId: new mongoose.Types.ObjectId(product2Id),
            productVariantId: new mongoose.Types.ObjectId(variant2Id),
            sku: "TEST-SKU-2",
            productName: "Test Product",
            variantName: "Test Variant 2",
            quantity: 1,
            unitPrice: "600.00",
            lineTotal: "600.00",
            discountTotal: "0.00",
            taxTotal: "90.00",
            currency: "INR",
          },
        ],
        totalTaxMinorUnits: 18000,
        pricingMode: "exclusive",
        taxSnapshot: { jurisdictionCountry: "IN", jurisdictionState: "Maharashtra" },
      });

      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${token}`)
        .send({
          shippingAddressId,
          deliveryOptionId: "standard",
          quoteReference,
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("PRICE_CHANGED");
      expect(res.body.details).toBeDefined();
      expect(res.body.details.quotedGrandTotal).toBe("1180.00");
      expect(res.body.details.currentGrandTotal).toBe("1180.00");
      expect(res.body.details.reason).toBe("component_changed");
      expect(res.body.details.previousQuote).toBeDefined();
      expect(res.body.details.currentQuote).toBeDefined();

      // Crucial transactional invariant: no stock reserved, no order created
      expect(inventoryService.reserveStockInTransaction).not.toHaveBeenCalled();
      expect(orderRepository.create).not.toHaveBeenCalled();
    });

    it("rejects order with 409 PRICE_CHANGED when item price increases and shipping fee decreases by same amount", async () => {
      // Quoted: Item 1000 + Tax 180 + Express Shipping 99 = 1279.00
      const quotedItems = [
        {
          productId,
          productVariantId: variantId,
          sku: "TEST-SKU-1",
          quantity: 2,
          unitPrice: "500.00",
          lineTotal: "1000.00",
          taxTotal: "180.00",
          discountTotal: "0.00",
        },
      ];

      const { quoteReference } = generateQuoteReference({
        customerId,
        cartId,
        grandTotal: "1279.00",
        currency: "INR",
        items: quotedItems,
        subtotal: "1000.00",
        taxTotal: "180.00",
        shippingTotal: "99.00",
        deliveryOptionId: "express",
      });

      // At submission: Delivery option switched or resolved to standard (free shipping 0.00, fee -99)
      // but item price increased by +99 so grand total remains 1279.00
      ProductVariant.find.mockReturnValue({
        session: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          {
            _id: new mongoose.Types.ObjectId(variantId),
            productId: new mongoose.Types.ObjectId(productId),
            sku: "TEST-SKU-1",
            price: "549.50", // 2 * 549.50 = 1099.00
            currency: "INR",
            name: "Test Variant",
            isActive: true,
            deletedAt: null,
          },
        ]),
      });

      taxService.calculateOrderTax.mockResolvedValue({
        items: [
          {
            productId: new mongoose.Types.ObjectId(productId),
            productVariantId: new mongoose.Types.ObjectId(variantId),
            sku: "TEST-SKU-1",
            quantity: 2,
            unitPrice: "549.50",
            lineTotal: "1099.00",
            discountTotal: "0.00",
            taxTotal: "180.00",
            currency: "INR",
          },
        ],
        totalTaxMinorUnits: 18000,
        pricingMode: "exclusive",
        taxSnapshot: { jurisdictionCountry: "IN", jurisdictionState: "Maharashtra" },
      });

      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${token}`)
        .send({
          shippingAddressId,
          deliveryOptionId: "standard", // standard has 0 shipping fee
          quoteReference,
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("PRICE_CHANGED");
      expect(res.body.details.reason).toBe("component_changed");
      expect(inventoryService.reserveStockInTransaction).not.toHaveBeenCalled();
      expect(orderRepository.create).not.toHaveBeenCalled();
    });

    it("rejects order with 409 PRICE_CHANGED when coupon discount changes between quote and submission", async () => {
      const quotedItems = [
        {
          productId,
          productVariantId: variantId,
          sku: "TEST-SKU-1",
          quantity: 2,
          unitPrice: "500.00",
          lineTotal: "1000.00",
          taxTotal: "180.00",
          discountTotal: "100.00",
        },
      ];

      const { quoteReference } = generateQuoteReference({
        customerId,
        cartId,
        grandTotal: "1080.00",
        currency: "INR",
        items: quotedItems,
        subtotal: "1000.00",
        discountTotal: "100.00",
        taxTotal: "180.00",
        shippingTotal: "0.00",
        couponCode: "SAVE100",
      });

      // At submission, coupon gives 200 discount instead of 100
      couponService.validateCoupon.mockResolvedValue({
        coupon: { _id: new mongoose.Types.ObjectId(), code: "SAVE100", title: "Save 100" },
        discountAmount: "200.00",
      });

      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${token}`)
        .send({
          shippingAddressId,
          deliveryOptionId: "standard",
          couponCode: "SAVE100",
          quoteReference,
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("PRICE_CHANGED");
      expect(inventoryService.reserveStockInTransaction).not.toHaveBeenCalled();
    });
  });

  describe("5. Phase 3A.1.2 Dedicated Quote Signing Secret & Migration", () => {
    it("signs and verifies quote reference with dedicated CHECKOUT_QUOTE_SECRET", () => {
      const testSecret = "my-super-secret-checkout-quote-signing-key-32chars";
      const customEnv = {
        CHECKOUT_QUOTE_SECRET: testSecret,
        JWT_ACCESS_SECRET: "different-jwt-access-secret-32characters-long",
        NODE_ENV: "test",
      };

      const resolvedKey = getSigningKey(customEnv);
      expect(resolvedKey).toBe(testSecret);

      const { quoteReference } = generateQuoteReference({
        customerId,
        cartId,
        grandTotal: "1180.00",
        currency: "INR",
        signingKey: resolvedKey,
      });

      const verified = verifyQuoteReference(quoteReference, { customerId, cartId }, { signingKey: resolvedKey });
      expect(verified.quotedGrandTotal).toBe("1180.00");
    });

    it("falls back to JWT_ACCESS_SECRET when CHECKOUT_QUOTE_SECRET is absent", () => {
      const jwtSecret = "jwt-access-secret-for-migration-fallback-32chars";
      const customEnv = {
        CHECKOUT_QUOTE_SECRET: undefined,
        JWT_ACCESS_SECRET: jwtSecret,
        NODE_ENV: "test",
      };

      const resolvedKey = getSigningKey(customEnv);
      expect(resolvedKey).toBe(jwtSecret);
    });

    it("rejects signing secret shorter than 32 characters", () => {
      const shortEnv = {
        CHECKOUT_QUOTE_SECRET: "too-short-secret",
        NODE_ENV: "test",
      };

      expect(() => {
        getSigningKey(shortEnv);
      }).toThrow("CHECKOUT_QUOTE_SECRET must be at least 32 characters long");
    });

    it("throws in production if neither CHECKOUT_QUOTE_SECRET nor JWT_ACCESS_SECRET is configured", () => {
      const prodEnv = {
        CHECKOUT_QUOTE_SECRET: undefined,
        JWT_ACCESS_SECRET: undefined,
        NODE_ENV: "production",
      };

      expect(() => {
        getSigningKey(prodEnv);
      }).toThrow("Missing quote signing secret");
    });
  });

  describe("6. Phase 3A.1.2 Transaction Session Propagation", () => {
    it("propagates active transaction session to ProductVariant.find and Product.find during order creation", async () => {
      const mockSessionInstance = { id: "test-mongo-session-42" };
      withTransaction.mockImplementation(async (callback) => {
        return callback(mockSessionInstance);
      });

      const variantSessionSpy = jest.fn().mockReturnThis();
      ProductVariant.find.mockReturnValue({
        session: variantSessionSpy,
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

      const productSessionSpy = jest.fn().mockReturnThis();
      Product.find.mockReturnValue({
        session: productSessionSpy,
        lean: jest.fn().mockResolvedValue([
          {
            _id: new mongoose.Types.ObjectId(productId),
            vendorId: new mongoose.Types.ObjectId(vendorId),
            status: "active",
            deletedAt: null,
          },
        ]),
      });

      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${token}`)
        .send({
          shippingAddressId,
          deliveryOptionId: "standard",
        });

      expect(res.status).toBe(201);
      expect(variantSessionSpy).toHaveBeenCalledWith(mockSessionInstance);
      expect(productSessionSpy).toHaveBeenCalledWith(mockSessionInstance);
    });
  });
});
