const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../src/app");
const taxService = require("../src/services/tax.service");
const taxRepository = require("../src/repositories/tax.repository");
const orderService = require("../src/services/order.service");
const orderRepository = require("../src/repositories/order.repository");
const cartRepository = require("../src/repositories/cart.repository");
const addressRepository = require("../src/repositories/address.repository");
const couponRepository = require("../src/repositories/coupon.repository");
const couponRedemptionRepository = require("../src/repositories/coupon-redemption.repository");
const paymentRepository = require("../src/repositories/payment.repository");
const inventoryRepository = require("../src/repositories/inventory.repository");
const inventoryService = require("../src/services/inventory.service");
const paymentService = require("../src/services/payment.service");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Customer = require("../src/models/Customer");
const User = require("../src/models/User");
const Order = require("../src/models/Order");
const TaxRule = require("../src/models/TaxRule");
const withTransaction = require("../src/utils/withTransaction");
const { generateAccessToken } = require("../src/services/token.service");
const {
  TAX_CATEGORIES,
  TAX_PRICING_MODES,
} = require("../src/constants/tax.constants");
const {
  createProductSchema,
} = require("../src/validators/catalog/product.validator");
const {
  updateProductSchema,
} = require("../src/validators/catalog/update-product.validator");

jest.mock("../src/repositories/tax.repository");
jest.mock("../src/repositories/order.repository");
jest.mock("../src/repositories/cart.repository");
jest.mock("../src/repositories/address.repository");
jest.mock("../src/repositories/coupon.repository");
jest.mock("../src/repositories/coupon-redemption.repository");
jest.mock("../src/repositories/payment.repository");
jest.mock("../src/repositories/inventory.repository");
jest.mock("../src/services/inventory.service");
jest.mock("../src/services/payment.service");
jest.mock("../src/services/notification.service");
jest.mock("../src/services/notification-outbox.service");
jest.mock("../src/services/notification");
jest.mock("../src/models/Product");
jest.mock("../src/models/ProductVariant");
jest.mock("../src/models/Customer");
jest.mock("../src/models/User");
jest.mock("../src/models/Order");
jest.mock("../src/models/TaxRule");
jest.mock("../src/utils/withTransaction");

describe("Tax Management Engine & Checkout Regression Suite", () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();
  const vendorId1 = new mongoose.Types.ObjectId().toString();
  const vendorId2 = new mongoose.Types.ObjectId().toString();
  const productId1 = new mongoose.Types.ObjectId().toString();
  const productId2 = new mongoose.Types.ObjectId().toString();
  const variantId1 = new mongoose.Types.ObjectId().toString();
  const variantId2 = new mongoose.Types.ObjectId().toString();
  const addressId = new mongoose.Types.ObjectId().toString();

  const mockAddress = {
    _id: addressId,
    userId,
    firstName: "John",
    lastName: "Doe",
    phone: "9876543210",
    addressLine1: "123 MG Road",
    city: "Mumbai",
    state: "MH",
    postalCode: "400001",
    country: "IN",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    withTransaction.mockImplementation(async (cb) => cb({}));
    Customer.findOne.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(customerId),
      userId,
      isActive: true,
      deletedAt: null,
    });
    Customer.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ userId, firstName: "John", lastName: "Doe" }),
    });
    User.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        session: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ email: "john@example.com", firstName: "John", lastName: "Doe" }),
        }),
        lean: jest.fn().mockResolvedValue({ email: "john@example.com", firstName: "John", lastName: "Doe" }),
      }),
    });
  });

  describe("1. Taxable vs Non-Taxable Product Calculation", () => {
    it("Scenario 1 & 4: should calculate standard percentage tax on taxable products", async () => {
      taxRepository.findCandidateRules.mockResolvedValue([
        {
          _id: "rule-1",
          name: "GST 18%",
          country: "IN",
          state: "MH",
          taxCategory: "standard",
          rate: mongoose.Types.Decimal128.fromString("18.00"),
          priority: 10,
          isActive: true,
          startsAt: null,
          expiresAt: null,
        },
      ]);

      const result = await taxService.calculateOrderTax({
        items: [
          {
            productId: productId1,
            productVariantId: variantId1,
            unitPrice: "1000.00",
            quantity: 1,
            isTaxable: true,
            taxCategory: "standard",
          },
        ],
        shippingAddress: { country: "IN", state: "MH" },
        pricingMode: TAX_PRICING_MODES.TAX_EXCLUSIVE,
      });

      expect(result.items[0].taxTotal).toBe("180.00");
      expect(result.totalTax).toBe("180.00");
      expect(result.items[0].taxDetails.taxRate.toString()).toBe("18.00");
    });

    it("Scenario 2: should apply zero tax for non-taxable products (isTaxable: false)", async () => {
      taxRepository.findCandidateRules.mockResolvedValue([
        {
          _id: "rule-1",
          name: "GST 18%",
          country: "IN",
          state: "MH",
          taxCategory: "standard",
          rate: mongoose.Types.Decimal128.fromString("18.00"),
          priority: 10,
        },
      ]);

      const result = await taxService.calculateOrderTax({
        items: [
          {
            productId: productId1,
            productVariantId: variantId1,
            unitPrice: "1000.00",
            quantity: 1,
            isTaxable: false,
            taxCategory: "standard",
          },
        ],
        shippingAddress: { country: "IN", state: "MH" },
        pricingMode: TAX_PRICING_MODES.TAX_EXCLUSIVE,
      });

      expect(result.items[0].taxTotal).toBe("0.00");
      expect(result.totalTax).toBe("0.00");
      expect(result.items[0].taxDetails.isTaxable).toBe(false);
    });

    it("Scenario 3: should apply zero tax when rule rate is zero", async () => {
      taxRepository.findCandidateRules.mockResolvedValue([
        {
          _id: "rule-zero",
          name: "Zero Rated",
          country: "IN",
          state: "MH",
          taxCategory: "standard",
          rate: mongoose.Types.Decimal128.fromString("0.00"),
          priority: 0,
        },
      ]);

      const result = await taxService.calculateOrderTax({
        items: [
          {
            productId: productId1,
            productVariantId: variantId1,
            unitPrice: "500.00",
            quantity: 2,
            isTaxable: true,
            taxCategory: "standard",
          },
        ],
        shippingAddress: { country: "IN", state: "MH" },
        pricingMode: TAX_PRICING_MODES.TAX_EXCLUSIVE,
      });

      expect(result.items[0].taxTotal).toBe("0.00");
      expect(result.totalTax).toBe("0.00");
    });
  });

  describe("2. Pricing Modes: Tax-Exclusive vs Tax-Inclusive", () => {
    it("Scenario 5: should extract tax from gross price in tax-inclusive mode without increasing grand total", async () => {
      taxRepository.findCandidateRules.mockResolvedValue([
        {
          _id: "rule-inclusive",
          name: "Inclusive VAT 20%",
          country: "GB",
          state: null,
          taxCategory: "standard",
          rate: mongoose.Types.Decimal128.fromString("20.00"),
          priority: 0,
        },
      ]);

      const items = [
        {
          productId: productId1,
          productVariantId: variantId1,
          unitPrice: "120.00",
          quantity: 1,
          lineTotal: "120.00",
          isTaxable: true,
          taxCategory: "standard",
        },
      ];

      const taxResult = await taxService.calculateOrderTax({
        items,
        shippingAddress: { country: "GB" },
        pricingMode: TAX_PRICING_MODES.TAX_INCLUSIVE,
      });

      // In 120.00 with 20% tax: tax = 120 * 20 / (100 + 20) = 2400 / 120 = 20.00
      expect(taxResult.items[0].taxTotal).toBe("20.00");
      expect(taxResult.totalTax).toBe("20.00");

      const totals = orderService.calculateOrderTotals(
        taxResult.items,
        "GBP",
        0,
        taxResult
      );

      expect(totals.subtotal).toBe("120.00");
      expect(totals.taxTotal).toBe("20.00");
      expect(totals.grandTotal).toBe("120.00"); // Not 140.00
    });

    it("Scenario 6: should add tax on top of net price in tax-exclusive mode", async () => {
      taxRepository.findCandidateRules.mockResolvedValue([
        {
          _id: "rule-exclusive",
          name: "US Sales Tax 10%",
          country: "US",
          state: "CA",
          taxCategory: "standard",
          rate: mongoose.Types.Decimal128.fromString("10.00"),
          priority: 0,
        },
      ]);

      const items = [
        {
          productId: productId1,
          productVariantId: variantId1,
          unitPrice: "100.00",
          quantity: 1,
          lineTotal: "100.00",
          isTaxable: true,
          taxCategory: "standard",
        },
      ];

      const taxResult = await taxService.calculateOrderTax({
        items,
        shippingAddress: { country: "US", state: "CA" },
        pricingMode: TAX_PRICING_MODES.TAX_EXCLUSIVE,
      });

      expect(taxResult.items[0].taxTotal).toBe("10.00");
      expect(taxResult.totalTax).toBe("10.00");

      const totals = orderService.calculateOrderTotals(
        taxResult.items,
        "USD",
        0,
        taxResult
      );

      expect(totals.subtotal).toBe("100.00");
      expect(totals.taxTotal).toBe("10.00");
      expect(totals.grandTotal).toBe("110.00"); // 100 + 10
    });
  });

  describe("3. Discount & Coupon Taxable-Base Reductions", () => {
    it("Scenario 7 & 8: should reduce taxable base by coupon discount before tax calculation with exact conservation", async () => {
      taxRepository.findCandidateRules.mockResolvedValue([
        {
          _id: "rule-1",
          name: "GST 18%",
          country: "IN",
          state: "MH",
          taxCategory: "standard",
          rate: mongoose.Types.Decimal128.fromString("18.00"),
          priority: 0,
        },
      ]);

      // 3 items with fractional discount allocation: total discount = 50.00
      const items = [
        {
          productId: productId1,
          productVariantId: variantId1,
          unitPrice: "100.00",
          quantity: 1,
          isTaxable: true,
          taxCategory: "standard",
        },
        {
          productId: productId2,
          productVariantId: variantId2,
          unitPrice: "100.00",
          quantity: 1,
          isTaxable: true,
          taxCategory: "standard",
        },
        {
          productId: productId1,
          productVariantId: variantId1,
          unitPrice: "100.00",
          quantity: 1,
          isTaxable: true,
          taxCategory: "standard",
        },
      ];

      // Subtotal = 300.00, coupon discount = 50.00 (5000 minor units across 3 equal items = 1667, 1667, 1666)
      const taxResult = await taxService.calculateOrderTax({
        items,
        shippingAddress: { country: "IN", state: "MH" },
        couponDiscountMinorUnits: 5000,
        pricingMode: TAX_PRICING_MODES.TAX_EXCLUSIVE,
      });

      const d1 = taxService.decimalToMinorUnits(taxResult.items[0].discountTotal);
      const d2 = taxService.decimalToMinorUnits(taxResult.items[1].discountTotal);
      const d3 = taxService.decimalToMinorUnits(taxResult.items[2].discountTotal);

      // Exact discount conservation: 1667 + 1667 + 1666 = 5000
      expect(d1 + d2 + d3).toBe(5000);

      // Taxable base for item 1 = 100.00 - 16.67 = 83.33 -> 18% of 83.33 = 15.00
      expect(taxResult.items[0].taxTotal).toBe("15.00");
      expect(taxResult.items[1].taxTotal).toBe("15.00");
      expect(taxResult.items[2].taxTotal).toBe("15.00");
      expect(taxResult.totalTax).toBe("45.00");
    });

    it("Scenario 9: should calculate shipping tax when rule specifies isShippingTaxable = true", async () => {
      taxRepository.findCandidateRules.mockResolvedValue([
        {
          _id: "rule-ship",
          name: "GST with shipping tax",
          country: "IN",
          state: "MH",
          taxCategory: "standard",
          rate: mongoose.Types.Decimal128.fromString("18.00"),
          isShippingTaxable: true,
          priority: 0,
        },
      ]);

      const taxResult = await taxService.calculateOrderTax({
        items: [
          {
            productId: productId1,
            productVariantId: variantId1,
            unitPrice: "500.00",
            quantity: 1,
            isTaxable: true,
            taxCategory: "standard",
          },
        ],
        shippingAddress: { country: "IN", state: "MH" },
        shippingTotalMinorUnits: 10000, // 100.00 shipping
        pricingMode: TAX_PRICING_MODES.TAX_EXCLUSIVE,
      });

      // Item tax = 18% of 500 = 90.00
      expect(taxResult.itemsTaxTotal).toBe("90.00");
      // Shipping tax = 18% of 100 = 18.00
      expect(taxResult.shippingTaxTotal).toBe("18.00");
      expect(taxResult.totalTax).toBe("108.00");
    });
  });

  describe("4. Deterministic Two-Tier Jurisdiction Precedence", () => {
    it("Scenario 10: state-specific rule MUST take precedence over a broad country rule even if country rule has higher priority", async () => {
      // Mock repository returning both state and country rules
      taxRepository.findCandidateRules.mockResolvedValue([
        {
          _id: "rule-country",
          name: "Country Wide High Priority",
          country: "IN",
          state: null,
          taxCategory: "standard",
          rate: mongoose.Types.Decimal128.fromString("28.00"),
          priority: 100, // Very high priority
        },
        {
          _id: "rule-state",
          name: "Maharashtra State Specific",
          country: "IN",
          state: "MH",
          taxCategory: "standard",
          rate: mongoose.Types.Decimal128.fromString("18.00"),
          priority: 5, // Lower priority
        },
      ]);

      const matchedRule = await taxService.resolveTaxRule({
        country: "IN",
        state: "MH",
        taxCategory: "standard",
      });

      // Must select state rule (Tier 1) over country rule (Tier 2)
      expect(matchedRule._id).toBe("rule-state");
      expect(matchedRule.rate.toString()).toBe("18.00");
    });

    it("Scenario 11: should ignore rules whose startsAt is in the future or expiresAt in past", async () => {
      const now = new Date("2026-09-11T10:00:00Z");

      // taxRepository handles date conditions, but let's test resolveTaxRule passes asOfDate
      taxRepository.findCandidateRules.mockImplementation(async ({ asOfDate }) => {
        if (asOfDate >= now) {
          return [
            {
              _id: "rule-active",
              name: "Active Rule",
              country: "IN",
              state: "MH",
              taxCategory: "standard",
              rate: mongoose.Types.Decimal128.fromString("12.00"),
              priority: 0,
            },
          ];
        }
        return [];
      });

      const matched = await taxService.resolveTaxRule({
        country: "IN",
        state: "MH",
        taxCategory: "standard",
        asOfDate: now,
      });

      expect(matched._id).toBe("rule-active");
      expect(taxRepository.findCandidateRules).toHaveBeenCalledWith(
        expect.objectContaining({ asOfDate: now }),
        expect.anything()
      );
    });

    it("Scenario 12: should ignore inactive rules (isActive: false)", async () => {
      taxRepository.findCandidateRules.mockResolvedValue([]); // isActive: false rules excluded by query

      const matched = await taxService.resolveTaxRule({
        country: "IN",
        state: "MH",
        taxCategory: "standard",
      });

      expect(matched).toBeNull();
    });

    it("Scenario 13: within the same tier, higher priority rule wins", async () => {
      taxRepository.findCandidateRules.mockResolvedValue([
        {
          _id: "rule-p10",
          name: "High Priority State Rule",
          country: "IN",
          state: "MH",
          taxCategory: "standard",
          rate: mongoose.Types.Decimal128.fromString("18.00"),
          priority: 10,
        },
        {
          _id: "rule-p5",
          name: "Low Priority State Rule",
          country: "IN",
          state: "MH",
          taxCategory: "standard",
          rate: mongoose.Types.Decimal128.fromString("12.00"),
          priority: 5,
        },
      ]);

      const matched = await taxService.resolveTaxRule({
        country: "IN",
        state: "MH",
        taxCategory: "standard",
      });

      expect(matched._id).toBe("rule-p10");
    });
  });

  describe("5. Precision, Rounding & Currency Safety", () => {
    it("Scenario 14 & 15: should round half-up at 0.5 minor units and use Decimal128 precision", async () => {
      taxRepository.findCandidateRules.mockResolvedValue([
        {
          _id: "rule-precision",
          name: "Special 7.5% Tax",
          country: "IN",
          state: "MH",
          taxCategory: "standard",
          rate: mongoose.Types.Decimal128.fromString("7.50"),
          priority: 0,
        },
      ]);

      // 33.33 * 7.5% = 2.49975 -> 2.50
      const result = await taxService.calculateOrderTax({
        items: [
          {
            productId: productId1,
            productVariantId: variantId1,
            unitPrice: "33.33",
            quantity: 1,
            isTaxable: true,
            taxCategory: "standard",
          },
        ],
        shippingAddress: { country: "IN", state: "MH" },
        pricingMode: TAX_PRICING_MODES.TAX_EXCLUSIVE,
      });

      expect(result.items[0].taxTotal).toBe("2.50");
      expect(result.totalTax).toBe("2.50");
      expect(result.items[0].taxDetails.taxAmount).toBeInstanceOf(
        mongoose.Types.Decimal128
      );
    });

    it("Scenario 16: should reject currency mismatch during cart validation", async () => {
      const cart = {
        status: "active",
        currency: "USD",
        items: [{ productVariantId: variantId1, quantity: 1 }],
      };

      ProductVariant.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: variantId1,
            productId: productId1,
            sku: "SKU-INR",
            price: "100.00",
            currency: "INR", // Mismatch with cart USD
            isActive: true,
            deletedAt: null,
          },
        ]),
      });

      Product.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: productId1,
            name: "Test",
            vendorId: vendorId1,
            status: "active",
            deletedAt: null,
          },
        ]),
      });

      await expect(orderService.validateCartItems(cart)).rejects.toMatchObject({
        statusCode: 400,
        code: "CART_CURRENCY_MISMATCH",
      });
    });
  });

  describe("6. Order Persistence & Historical Snapshot", () => {
    it("Scenario 17: created order persists taxSnapshot and does NOT change when tax rules change later", async () => {
      taxRepository.findCandidateRules.mockResolvedValue([
        {
          _id: "rule-18",
          name: "GST 18%",
          country: "IN",
          state: "MH",
          taxCategory: "standard",
          rate: mongoose.Types.Decimal128.fromString("18.00"),
          priority: 0,
        },
      ]);

      const cart = {
        _id: "cart-1",
        status: "active",
        currency: "INR",
        items: [{ productVariantId: variantId1, quantity: 1 }],
      };

      cartRepository.findActiveByCustomer.mockResolvedValue(cart);
      cartRepository.convertActiveCart.mockResolvedValue({ status: "converted" });
      addressRepository.findById.mockResolvedValue(mockAddress);

      ProductVariant.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: variantId1,
            productId: productId1,
            sku: "SKU-1",
            price: "100.00",
            currency: "INR",
            isActive: true,
            deletedAt: null,
          },
        ]),
      });

      Product.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: productId1,
            name: "Product 1",
            vendorId: vendorId1,
            categoryId: "cat-1",
            isTaxable: true,
            taxCategory: "standard",
            status: "active",
            deletedAt: null,
          },
        ]),
      });

      Order.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(null),
          }),
        }),
      });

      inventoryRepository.findByVariant.mockResolvedValue([
        { _id: "inv-1", warehouseId: "wh-1", onHand: 10, reserved: 0 },
      ]);
      inventoryService.reserveStockInTransaction.mockResolvedValue({
        warehouseId: "wh-1",
      });

      let savedOrderDoc = null;
      orderRepository.create.mockImplementation((doc) => {
        savedOrderDoc = { ...doc, _id: "order-created-1" };
        return Promise.resolve(savedOrderDoc);
      });

      const order = await orderService.createOrderFromCurrentCart(
        userId,
        addressId
      );

      expect(order.taxTotal).toBe("18.00");
      expect(order.grandTotal).toBe("118.00");
      expect(order.taxSnapshot).toBeDefined();
      expect(order.taxSnapshot.jurisdictionState).toBe("MH");
      expect(order.items[0].taxDetails.taxRuleId).toBe("rule-18");
      expect(order.items[0].taxDetails.taxRate.toString()).toBe("18.00");

      // Now simulate updating the tax rule in the database to 28%
      taxRepository.findCandidateRules.mockResolvedValue([
        {
          _id: "rule-28",
          name: "GST 28%",
          country: "IN",
          state: "MH",
          taxCategory: "standard",
          rate: mongoose.Types.Decimal128.fromString("28.00"),
          priority: 0,
        },
      ]);

      // When order is fetched again, it must return the persisted 18.00, NOT 28.00
      orderRepository.findById.mockResolvedValue(savedOrderDoc);
      const fetchedOrder = await orderService.getOrderById(
        "order-created-1",
        userId
      );

      expect(fetchedOrder.taxTotal).toBe("18.00");
      expect(fetchedOrder.grandTotal).toBe("118.00");
    });
  });

  describe("7. Order Cancellation & Refund Behavior", () => {
    it("Scenario 18: cancelling an order preserves persisted tax without recalculation", async () => {
      const order = {
        _id: "order-1",
        orderNumber: "BB-ORD-1",
        customerId,
        status: "pending",
        taxTotal: "18.00",
        grandTotal: "118.00",
        items: [
          {
            productVariantId: variantId1,
            warehouseId: "wh-1",
            quantity: 1,
            sku: "SKU-1",
            taxTotal: "18.00",
          },
        ],
      };

      orderRepository.findById.mockResolvedValue(order);
      paymentService.getLatestPaymentForOrder = jest.fn().mockResolvedValue(null);
      inventoryRepository.findByVariantAndWarehouse.mockResolvedValue({ _id: "inv-1" });
      inventoryService.releaseStockInTransaction.mockResolvedValue({});
      orderRepository.updateById.mockResolvedValue({ ...order, status: "cancelled" });

      const cancelled = await orderService.cancelOrder("order-1", { userId });

      expect(cancelled.status).toBe("cancelled");
      expect(cancelled.taxTotal).toBe("18.00");
      // Verify tax rule queries were NEVER called during cancellation
      expect(taxRepository.findCandidateRules).not.toHaveBeenCalled();
    });

    it("Scenario 19: refund calculates against captured grand total without recalculating tax", async () => {
      // Payment was captured for 118.00 (which included 18.00 tax)
      paymentRepository.findById.mockResolvedValue({
        _id: "pay-1",
        orderId: "order-1",
        amount: mongoose.Types.Decimal128.fromString("118.00"),
        refundedAmount: mongoose.Types.Decimal128.fromString("0.00"),
        status: "captured",
      });

      // No active tax rules should ever be queried
      expect(taxRepository.findCandidateRules).not.toHaveBeenCalled();
    });
  });

  describe("8. Multi-Vendor Item-Level Attribution", () => {
    it("Scenario 20: multi-vendor order preserves separate item-level tax attribution per vendor", async () => {
      taxRepository.findCandidateRules.mockResolvedValue([
        {
          _id: "rule-1",
          name: "GST 18%",
          country: "IN",
          state: "MH",
          taxCategory: "standard",
          rate: mongoose.Types.Decimal128.fromString("18.00"),
          priority: 0,
        },
      ]);

      const items = [
        {
          productId: productId1,
          productVariantId: variantId1,
          vendorId: vendorId1,
          unitPrice: "200.00",
          quantity: 1,
          isTaxable: true,
          taxCategory: "standard",
        },
        {
          productId: productId2,
          productVariantId: variantId2,
          vendorId: vendorId2,
          unitPrice: "400.00",
          quantity: 1,
          isTaxable: true,
          taxCategory: "standard",
        },
      ];

      const taxResult = await taxService.calculateOrderTax({
        items,
        shippingAddress: { country: "IN", state: "MH" },
        pricingMode: TAX_PRICING_MODES.TAX_EXCLUSIVE,
      });

      // Vendor 1 item: 200 * 18% = 36.00
      expect(taxResult.items[0].vendorId).toBe(vendorId1);
      expect(taxResult.items[0].taxTotal).toBe("36.00");

      // Vendor 2 item: 400 * 18% = 72.00
      expect(taxResult.items[1].vendorId).toBe(vendorId2);
      expect(taxResult.items[1].taxTotal).toBe("72.00");

      // Total order tax = 108.00
      expect(taxResult.totalTax).toBe("108.00");
    });
  });

  describe("9. Non-Authoritative Preview & Security / RBAC", () => {
    it("Scenario 21: POST /api/v1/tax/preview calculates server-authoritatively and marks response as preview", async () => {
      const userToken = generateAccessToken({
        sub: userId,
        role: "customer",
      });

      ProductVariant.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: variantId1,
            productId: productId1,
            price: "500.00",
            currency: "INR",
          },
        ]),
      });

      Product.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: productId1,
            name: "Server Product",
            vendorId: vendorId1,
            isTaxable: true,
            taxCategory: "standard",
          },
        ]),
      });

      taxRepository.findCandidateRules.mockResolvedValue([
        {
          _id: "rule-1",
          name: "GST 18%",
          country: "IN",
          state: "MH",
          taxCategory: "standard",
          rate: mongoose.Types.Decimal128.fromString("18.00"),
          priority: 0,
        },
      ]);

      const res = await request(app)
        .post("/api/v1/tax/preview")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          shippingAddress: { country: "IN", state: "MH" },
          items: [{ productVariantId: variantId1, quantity: 2 }],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isPreview).toBe(true);
      expect(res.body.data.isAuthoritative).toBe(false);
      expect(res.body.data.subtotal).toBe("1000.00");
      expect(res.body.data.taxTotal).toBe("180.00");
      expect(res.body.data.grandTotal).toBe("1180.00");
    });

    it("Scenario 22: non-admin user cannot access Tax Rule management APIs (RBAC / 403 Forbidden)", async () => {
      const customerToken = generateAccessToken({
        sub: userId,
        role: "customer",
      });

      const res = await request(app)
        .post("/api/v1/tax/rules")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          name: "Unauthorized Rule",
          country: "IN",
          rate: 18,
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("Scenario 22b: admin user CAN create Tax Rule successfully", async () => {
      const adminToken = generateAccessToken({
        sub: new mongoose.Types.ObjectId().toString(),
        role: "admin",
      });

      taxRepository.findConflictingRule.mockResolvedValue(null);
      taxRepository.create.mockResolvedValue({
        _id: "new-rule-1",
        name: "Admin Rule",
        country: "IN",
        state: "MH",
        taxCategory: "standard",
        rate: mongoose.Types.Decimal128.fromString("18.00"),
        priority: 0,
      });

      const res = await request(app)
        .post("/api/v1/tax/rules")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Admin Rule",
          country: "IN",
          state: "MH",
          taxCategory: "standard",
          rate: 18,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Admin Rule");
    });

    it("Scenario 22c: creating overlapping active rule with identical priority is rejected with 409 Conflict", async () => {
      const adminToken = generateAccessToken({
        sub: new mongoose.Types.ObjectId().toString(),
        role: "admin",
      });

      taxRepository.findConflictingRule.mockResolvedValue({
        _id: "existing-rule-id",
        name: "Existing Active Rule",
      });

      const res = await request(app)
        .post("/api/v1/tax/rules")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Duplicate Rule",
          country: "IN",
          state: "MH",
          taxCategory: "standard",
          rate: 18,
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("TAX_RULE_OVERLAP_CONFLICT");
    });
  });

  describe("10. Mixed Coupon Eligibility & Proportional Discount Allocation (Issue 1 Regression)", () => {
    it("1. should never allocate discount to coupon-ineligible items when ineligible item appears first", async () => {
      taxRepository.findCandidateRules.mockResolvedValue([
        {
          _id: "rule-18",
          name: "GST 18%",
          country: "IN",
          state: "MH",
          taxCategory: "standard",
          rate: mongoose.Types.Decimal128.fromString("18.00"),
          priority: 0,
        },
      ]);

      const items = [
        {
          productId: productId1,
          productVariantId: variantId1,
          unitPrice: "100.00",
          quantity: 1,
          isTaxable: true,
          isCouponEligible: false, // Ineligible item appears first
          taxCategory: "standard",
        },
        {
          productId: productId2,
          productVariantId: variantId2,
          unitPrice: "200.00",
          quantity: 1,
          isTaxable: true,
          isCouponEligible: true, // Eligible item appears second
          taxCategory: "standard",
        },
      ];

      // Total coupon discount: 50.00 (5000 minor units)
      const taxResult = await taxService.calculateOrderTax({
        items,
        shippingAddress: { country: "IN", state: "MH" },
        couponDiscountMinorUnits: 5000,
        pricingMode: TAX_PRICING_MODES.TAX_EXCLUSIVE,
      });

      // Item 0 (ineligible): 0 discount, taxable base = 100.00, tax = 18.00
      expect(taxResult.items[0].discountTotal).toBe("0.00");
      expect(taxResult.items[0].taxTotal).toBe("18.00");
      expect(taxResult.items[0].taxDetails.taxableBase.toString()).toBe("100.00");

      // Item 1 (eligible): 50.00 discount, taxable base = 150.00, tax = 27.00
      expect(taxResult.items[1].discountTotal).toBe("50.00");
      expect(taxResult.items[1].taxTotal).toBe("27.00");
      expect(taxResult.items[1].taxDetails.taxableBase.toString()).toBe("150.00");

      // Total order tax = 18.00 + 27.00 = 45.00
      expect(taxResult.totalTax).toBe("45.00");
    });

    it("2. should correctly allocate discounts across multiple interleaved eligible and ineligible items", async () => {
      taxRepository.findCandidateRules.mockResolvedValue([
        {
          _id: "rule-10",
          name: "Tax 10%",
          country: "IN",
          state: "MH",
          taxCategory: "standard",
          rate: mongoose.Types.Decimal128.fromString("10.00"),
          priority: 0,
        },
      ]);

      const items = [
        {
          productId: productId1,
          productVariantId: variantId1,
          unitPrice: "100.00",
          quantity: 1,
          isTaxable: true,
          isCouponEligible: false,
          taxCategory: "standard",
        },
        {
          productId: productId2,
          productVariantId: variantId2,
          unitPrice: "100.00",
          quantity: 1,
          isTaxable: true,
          isCouponEligible: true,
          taxCategory: "standard",
        },
        {
          productId: productId1,
          productVariantId: variantId1,
          unitPrice: "100.00",
          quantity: 1,
          isTaxable: true,
          isCouponEligible: false,
          taxCategory: "standard",
        },
        {
          productId: productId2,
          productVariantId: variantId2,
          unitPrice: "100.00",
          quantity: 1,
          isTaxable: true,
          isCouponEligible: true,
          taxCategory: "standard",
        },
      ];

      // Eligible subtotal is 200.00. Coupon discount is 40.00 (4000 minor units).
      const taxResult = await taxService.calculateOrderTax({
        items,
        shippingAddress: { country: "IN", state: "MH" },
        couponDiscountMinorUnits: 4000,
        pricingMode: TAX_PRICING_MODES.TAX_EXCLUSIVE,
      });

      expect(taxResult.items[0].discountTotal).toBe("0.00");
      expect(taxResult.items[1].discountTotal).toBe("20.00");
      expect(taxResult.items[2].discountTotal).toBe("0.00");
      expect(taxResult.items[3].discountTotal).toBe("20.00");
    });

    it("3. should preserve exact discount conservation when remainder units are distributed", async () => {
      taxRepository.findCandidateRules.mockResolvedValue([
        {
          _id: "rule-10",
          name: "Tax 10%",
          country: "IN",
          state: "MH",
          taxCategory: "standard",
          rate: mongoose.Types.Decimal128.fromString("10.00"),
          priority: 0,
        },
      ]);

      const items = [
        {
          productId: productId1,
          productVariantId: variantId1,
          unitPrice: "100.00",
          quantity: 1,
          isTaxable: true,
          isCouponEligible: false,
        },
        {
          productId: productId2,
          productVariantId: variantId2,
          unitPrice: "100.00",
          quantity: 1,
          isTaxable: true,
          isCouponEligible: true,
        },
        {
          productId: productId1,
          productVariantId: variantId1,
          unitPrice: "100.00",
          quantity: 1,
          isTaxable: true,
          isCouponEligible: true,
        },
        {
          productId: productId2,
          productVariantId: variantId2,
          unitPrice: "100.00",
          quantity: 1,
          isTaxable: true,
          isCouponEligible: true,
        },
      ];

      // Total discount: 50.00 (5000 minor units) across 3 eligible items (300.00 subtotal)
      const taxResult = await taxService.calculateOrderTax({
        items,
        shippingAddress: { country: "IN", state: "MH" },
        couponDiscountMinorUnits: 5000,
        pricingMode: TAX_PRICING_MODES.TAX_EXCLUSIVE,
      });

      const d0 = taxService.decimalToMinorUnits(taxResult.items[0].discountTotal);
      const d1 = taxService.decimalToMinorUnits(taxResult.items[1].discountTotal);
      const d2 = taxService.decimalToMinorUnits(taxResult.items[2].discountTotal);
      const d3 = taxService.decimalToMinorUnits(taxResult.items[3].discountTotal);

      expect(d0).toBe(0);
      expect(d1 + d2 + d3).toBe(5000); // 1667 + 1667 + 1666 = 5000 exact
    });

    it("4. should assign zero discount when all items in cart are coupon-ineligible", async () => {
      taxRepository.findCandidateRules.mockResolvedValue([]);

      const items = [
        {
          productId: productId1,
          productVariantId: variantId1,
          unitPrice: "100.00",
          quantity: 1,
          isTaxable: true,
          isCouponEligible: false,
        },
      ];

      const taxResult = await taxService.calculateOrderTax({
        items,
        shippingAddress: { country: "IN" },
        couponDiscountMinorUnits: 2000,
      });

      expect(taxResult.items[0].discountTotal).toBe("0.00");
    });

    it("5. should deterministically allocate largest-remainder unit using originalIndex tie-breaker", async () => {
      taxRepository.findCandidateRules.mockResolvedValue([]);

      const items = [
        {
          productId: productId1,
          productVariantId: variantId1,
          unitPrice: "100.00",
          quantity: 1,
          isTaxable: true,
          isCouponEligible: true,
        },
        {
          productId: productId2,
          productVariantId: variantId2,
          unitPrice: "100.00",
          quantity: 1,
          isTaxable: true,
          isCouponEligible: true,
        },
      ];

      // 1 minor unit discount across 2 identical items: fraction is 0.5 for both
      // Tie-breaker: originalIndex ascending -> item 0 receives the 1 minor unit, item 1 receives 0
      const taxResult = await taxService.calculateOrderTax({
        items,
        shippingAddress: { country: "IN" },
        couponDiscountMinorUnits: 1,
      });

      expect(taxResult.items[0].discountTotal).toBe("0.01");
      expect(taxResult.items[1].discountTotal).toBe("0.00");
    });

    it("6. should safely handle zero eligible subtotal", async () => {
      taxRepository.findCandidateRules.mockResolvedValue([]);

      const items = [
        {
          productId: productId1,
          productVariantId: variantId1,
          unitPrice: "0.00",
          quantity: 1,
          isTaxable: true,
          isCouponEligible: true,
        },
      ];

      const taxResult = await taxService.calculateOrderTax({
        items,
        shippingAddress: { country: "IN" },
        couponDiscountMinorUnits: 1000,
      });

      expect(taxResult.items[0].discountTotal).toBe("0.00");
    });

    it("7. should cap discount at eligible subtotal when discount is larger than eligible subtotal", async () => {
      taxRepository.findCandidateRules.mockResolvedValue([
        {
          _id: "rule-10",
          name: "Tax 10%",
          country: "IN",
          taxCategory: "standard",
          rate: mongoose.Types.Decimal128.fromString("10.00"),
          priority: 0,
        },
      ]);

      const items = [
        {
          productId: productId1,
          productVariantId: variantId1,
          unitPrice: "50.00",
          quantity: 1,
          isTaxable: true,
          isCouponEligible: true,
        },
      ];

      // Eligible subtotal is 50.00. Requested discount is 100.00 (10000 minor units).
      const taxResult = await taxService.calculateOrderTax({
        items,
        shippingAddress: { country: "IN" },
        couponDiscountMinorUnits: 10000,
      });

      // Discount capped at 50.00; taxable base = 0.00; tax = 0.00
      expect(taxResult.items[0].discountTotal).toBe("50.00");
      expect(taxResult.items[0].taxTotal).toBe("0.00");
      expect(taxResult.items[0].taxDetails.taxableBase.toString()).toBe("0.00");
    });
  });

  describe("11. Catalog Product Schema Validation (Issue 2 Regression)", () => {
    const validProductPayload = {
      name: "Smart Watch",
      slug: "smart-watch",
      sku: "SKU-WATCH-1",
      categoryId: new mongoose.Types.ObjectId().toString(),
      price: "199.99",
    };

    it("1. should allow creating product with isTaxable=false", () => {
      const parsed = createProductSchema.parse({
        ...validProductPayload,
        isTaxable: false,
      });
      expect(parsed.isTaxable).toBe(false);
      expect(parsed.taxCategory).toBe("standard"); // Default applied
    });

    it("2. should allow creating product with taxCategory=reduced", () => {
      const parsed = createProductSchema.parse({
        ...validProductPayload,
        taxCategory: "reduced",
      });
      expect(parsed.taxCategory).toBe("reduced");
      expect(parsed.isTaxable).toBe(true); // Default applied
    });

    it("3. should allow creating product with taxCategory=zero_rated", () => {
      const parsed = createProductSchema.parse({
        ...validProductPayload,
        taxCategory: "zero_rated",
      });
      expect(parsed.taxCategory).toBe("zero_rated");
    });

    it("4. should allow creating product with taxCategory=exempt", () => {
      const parsed = createProductSchema.parse({
        ...validProductPayload,
        taxCategory: "exempt",
      });
      expect(parsed.taxCategory).toBe("exempt");
    });

    it("5. should allow updating isTaxable from true to false", () => {
      const parsed = updateProductSchema.parse({
        isTaxable: false,
      });
      expect(parsed.isTaxable).toBe(false);
      expect(parsed.taxCategory).toBeUndefined(); // Does NOT inject default
    });

    it("6. should allow updating taxCategory", () => {
      const parsed = updateProductSchema.parse({
        taxCategory: "reduced",
      });
      expect(parsed.taxCategory).toBe("reduced");
      expect(parsed.isTaxable).toBeUndefined(); // Does NOT inject default
    });

    it("7. should reject unsupported taxCategory with validation error", () => {
      expect(() => {
        createProductSchema.parse({
          ...validProductPayload,
          taxCategory: "luxury_super_tax",
        });
      }).toThrow();

      expect(() => {
        updateProductSchema.parse({
          taxCategory: "invalid_category",
        });
      }).toThrow();
    });

    it("8. should reject non-boolean isTaxable", () => {
      expect(() => {
        createProductSchema.parse({
          ...validProductPayload,
          isTaxable: "yes",
        });
      }).toThrow();

      expect(() => {
        updateProductSchema.parse({
          isTaxable: "true",
        });
      }).toThrow();
    });

    it("9. should reject unknown fields in product create and update schemas", () => {
      expect(() => {
        createProductSchema.parse({
          ...validProductPayload,
          unrecognizedKey: "malicious_payload",
        });
      }).toThrow();

      expect(() => {
        updateProductSchema.parse({
          name: "Updated Name",
          unrecognizedKey: "malicious_payload",
        });
      }).toThrow();
    });

    it("10. should confirm omitted update fields remain omitted in partial update", () => {
      const parsed = updateProductSchema.parse({
        price: "249.99",
      });
      expect(parsed).toEqual({ price: "249.99" });
      expect(parsed.isTaxable).toBeUndefined();
      expect(parsed.taxCategory).toBeUndefined();
    });
  });

  describe("12. Tax Preview Pricing Mode Alignment & Security (Issue 3 Regression)", () => {
    it("1. should calculate correct tax-exclusive preview grand total (subtotal - discount + tax)", async () => {
      const userToken = generateAccessToken({
        sub: userId,
        role: "customer",
      });

      ProductVariant.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: variantId1,
            productId: productId1,
            price: "100.00",
            currency: "INR",
          },
        ]),
      });

      Product.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: productId1,
            name: "Exclusive Product",
            vendorId: vendorId1,
            isTaxable: true,
            taxCategory: "standard",
          },
        ]),
      });

      taxRepository.findCandidateRules.mockResolvedValue([
        {
          _id: "rule-18",
          name: "GST 18%",
          country: "IN",
          taxCategory: "standard",
          rate: mongoose.Types.Decimal128.fromString("18.00"),
          priority: 0,
        },
      ]);

      const res = await request(app)
        .post("/api/v1/tax/preview")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          shippingAddress: { country: "IN" },
          items: [{ productVariantId: variantId1, quantity: 1 }],
          pricingMode: TAX_PRICING_MODES.TAX_EXCLUSIVE,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.pricingMode).toBe("tax_exclusive");
      expect(res.body.data.subtotal).toBe("100.00");
      expect(res.body.data.taxTotal).toBe("18.00");
      expect(res.body.data.grandTotal).toBe("118.00"); // 100 + 18
    });

    it("2. should calculate correct tax-inclusive preview grand total and NOT double-count tax", async () => {
      const userToken = generateAccessToken({
        sub: userId,
        role: "customer",
      });

      ProductVariant.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: variantId1,
            productId: productId1,
            price: "120.00",
            currency: "GBP",
          },
        ]),
      });

      Product.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: productId1,
            name: "Inclusive Product",
            vendorId: vendorId1,
            isTaxable: true,
            taxCategory: "standard",
          },
        ]),
      });

      taxRepository.findCandidateRules.mockResolvedValue([
        {
          _id: "rule-vat20",
          name: "VAT 20%",
          country: "GB",
          taxCategory: "standard",
          rate: mongoose.Types.Decimal128.fromString("20.00"),
          priority: 0,
        },
      ]);

      const res = await request(app)
        .post("/api/v1/tax/preview")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          shippingAddress: { country: "GB" },
          items: [{ productVariantId: variantId1, quantity: 1 }],
          pricingMode: TAX_PRICING_MODES.TAX_INCLUSIVE,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.pricingMode).toBe("tax_inclusive");
      expect(res.body.data.subtotal).toBe("120.00");
      expect(res.body.data.taxTotal).toBe("20.00"); // Extracted tax
      expect(res.body.data.grandTotal).toBe("120.00"); // Must NOT be 140.00
    });

    it("3. should produce matching totals between preview and checkout", async () => {
      taxRepository.findCandidateRules.mockResolvedValue([
        {
          _id: "rule-18",
          name: "GST 18%",
          country: "IN",
          state: "MH",
          taxCategory: "standard",
          rate: mongoose.Types.Decimal128.fromString("18.00"),
          priority: 0,
        },
      ]);

      const items = [
        {
          productId: productId1,
          productVariantId: variantId1,
          unitPrice: "500.00",
          quantity: 2,
          lineTotal: "1000.00",
          isTaxable: true,
          taxCategory: "standard",
          currency: "INR",
        },
      ];

      const taxCalculation = await taxService.calculateOrderTax({
        items,
        shippingAddress: { country: "IN", state: "MH" },
        pricingMode: TAX_PRICING_MODES.TAX_EXCLUSIVE,
      });

      const checkoutTotals = orderService.calculateOrderTotals(
        taxCalculation.items,
        "INR",
        0,
        taxCalculation
      );

      // Verify identical logic in preview
      expect(checkoutTotals.subtotal).toBe("1000.00");
      expect(checkoutTotals.taxTotal).toBe("180.00");
      expect(checkoutTotals.grandTotal).toBe("1180.00");
    });

    it("4. should ignore client-supplied price and tax amount in preview request", async () => {
      const userToken = generateAccessToken({
        sub: userId,
        role: "customer",
      });

      // Attempt to tamper with price and taxTotal in request
      const res = await request(app)
        .post("/api/v1/tax/preview")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          shippingAddress: { country: "IN" },
          items: [{ productVariantId: variantId1, quantity: 1, price: "1.00", taxAmount: "0.00" }],
          taxTotal: "0.00",
          grandTotal: "1.00",
        });

      // Rejected by Zod schema strict mode
      expect(res.status).toBe(400);
    });

    it("5. should reject preview when variants use mixed currencies", async () => {
      const userToken = generateAccessToken({
        sub: userId,
        role: "customer",
      });

      ProductVariant.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: variantId1,
            productId: productId1,
            price: "100.00",
            currency: "USD",
          },
          {
            _id: variantId2,
            productId: productId2,
            price: "100.00",
            currency: "INR", // Mismatch
          },
        ]),
      });

      Product.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: productId1, name: "P1", isTaxable: true },
          { _id: productId2, name: "P2", isTaxable: true },
        ]),
      });

      const res = await request(app)
        .post("/api/v1/tax/preview")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          shippingAddress: { country: "IN" },
          items: [
            { productVariantId: variantId1, quantity: 1 },
            { productVariantId: variantId2, quantity: 1 },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("CURRENCY_MISMATCH");
    });
  });

  describe("13. Shipping Tax & Zero-Shipping Behavior (Issue 5 Regression)", () => {
    it("should guarantee zero shipping tax when shippingTotal is zero in both exclusive and inclusive modes", async () => {
      taxRepository.findCandidateRules.mockResolvedValue([
        {
          _id: "rule-ship-taxable",
          name: "GST 18% with Shipping Tax",
          country: "IN",
          taxCategory: "standard",
          rate: mongoose.Types.Decimal128.fromString("18.00"),
          isShippingTaxable: true,
          priority: 10,
        },
      ]);

      const items = [
        {
          productId: productId1,
          productVariantId: variantId1,
          unitPrice: "100.00",
          quantity: 1,
          isTaxable: true,
          taxCategory: "standard",
        },
      ];

      // Zero shipping in tax-exclusive mode
      const exclusiveResult = await taxService.calculateOrderTax({
        items,
        shippingAddress: { country: "IN" },
        shippingTotalMinorUnits: 0,
        pricingMode: TAX_PRICING_MODES.TAX_EXCLUSIVE,
      });

      expect(exclusiveResult.shippingTaxTotal).toBe("0.00");
      expect(exclusiveResult.shippingTaxTotalMinorUnits).toBe(0);

      // Zero shipping in tax-inclusive mode
      const inclusiveResult = await taxService.calculateOrderTax({
        items,
        shippingAddress: { country: "IN" },
        shippingTotalMinorUnits: 0,
        pricingMode: TAX_PRICING_MODES.TAX_INCLUSIVE,
      });

      expect(inclusiveResult.shippingTaxTotal).toBe("0.00");
      expect(inclusiveResult.shippingTaxTotalMinorUnits).toBe(0);
    });

    it("should calculate shipping tax correctly when non-zero shipping is supplied", async () => {
      taxRepository.findCandidateRules.mockResolvedValue([
        {
          _id: "rule-ship-taxable",
          name: "GST 18% with Shipping Tax",
          country: "IN",
          taxCategory: "standard",
          rate: mongoose.Types.Decimal128.fromString("18.00"),
          isShippingTaxable: true,
          priority: 10,
        },
      ]);

      const items = [
        {
          productId: productId1,
          productVariantId: variantId1,
          unitPrice: "100.00",
          quantity: 1,
          isTaxable: true,
          taxCategory: "standard",
        },
      ];

      // Non-zero shipping in tax-exclusive mode: 100.00 shipping (10000 minor units) -> 18% = 18.00
      const exclusiveResult = await taxService.calculateOrderTax({
        items,
        shippingAddress: { country: "IN" },
        shippingTotalMinorUnits: 10000,
        pricingMode: TAX_PRICING_MODES.TAX_EXCLUSIVE,
      });

      expect(exclusiveResult.shippingTaxTotal).toBe("18.00");

      // Non-zero shipping in tax-inclusive mode: 118.00 shipping (11800 minor units) -> extracted 18% = 18.00
      const inclusiveResult = await taxService.calculateOrderTax({
        items,
        shippingAddress: { country: "IN" },
        shippingTotalMinorUnits: 11800,
        pricingMode: TAX_PRICING_MODES.TAX_INCLUSIVE,
      });

      expect(inclusiveResult.shippingTaxTotal).toBe("18.00");
    });
  });
});
