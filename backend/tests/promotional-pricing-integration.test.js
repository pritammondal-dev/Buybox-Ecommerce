const mongoose = require("mongoose");
const crypto = require("crypto");
const User = require("../src/models/User");
const Customer = require("../src/models/Customer");
const Vendor = require("../src/models/Vendor");
const Category = require("../src/models/Category");
const Brand = require("../src/models/Brand");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Warehouse = require("../src/models/Warehouse");
const Inventory = require("../src/models/Inventory");
const Cart = require("../src/models/Cart");
const Order = require("../src/models/Order");
const Coupon = require("../src/models/Coupon");
const ProductDiscount = require("../src/models/ProductDiscount");
const Address = require("../src/models/Address");

const productService = require("../src/services/product.service");
const pricingEngineService = require("../src/services/pricing-engine.service");
const cartService = require("../src/services/cart.service");
const orderService = require("../src/services/order.service");
const vendorSettlementService = require("../src/services/vendor-settlement.service");

const {
  DISCOUNT_TYPES,
  DISCOUNT_STATUSES,
  DISCOUNT_SCOPES,
  FUNDING_SOURCES,
} = require("../src/constants/promotion.constants");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace(/\/buybox(_test)?(\?|$)/, "/buybox_d5_test$2")
  : "mongodb://127.0.0.1:27017/buybox_d5_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Phase D5 — Dynamic Discount & Promotional Pricing Integration", () => {
  let testCategory;
  let testBrand;
  let testWarehouse;
  let testVendor;
  let vendorUser;
  let customerUser;
  let customerDoc;
  let shippingAddress;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    const rand = Math.random().toString(36).substring(7);

    testCategory = await Category.create({
      name: `D5 Category ${rand}`,
      slug: `d5-cat-${rand}`,
      isActive: true,
    });

    testBrand = await Brand.create({
      name: `D5 Brand ${rand}`,
      slug: `d5-brand-${rand}`,
      isActive: true,
    });

    testWarehouse = await Warehouse.create({
      name: `D5 Warehouse ${rand}`,
      code: `WH-D5-${rand}`.toUpperCase(),
      address: {
        addressLine1: "100 Logistics Way",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "IN",
      },
      isActive: true,
    });

    vendorUser = await User.create({
      firstName: "D5",
      lastName: "Vendor",
      name: `D5 Vendor ${rand}`,
      email: `d5-vendor-${rand}@example.com`,
      password: "Password123!",
      role: "vendor",
      isActive: true,
    });

    testVendor = await Vendor.create({
      userId: vendorUser._id,
      storeName: `D5 Vendor Store ${rand}`,
      businessName: `D5 Vendor Business ${rand}`,
      businessSlug: `d5-vendor-biz-${rand}`,
      isActive: true,
      onboardingStatus: "approved",
    });

    customerUser = await User.create({
      firstName: "D5",
      lastName: "Customer",
      name: `D5 Customer ${rand}`,
      email: `d5-customer-${rand}@example.com`,
      password: "Password123!",
      role: "customer",
      isActive: true,
    });

    customerDoc = await Customer.create({
      userId: customerUser._id,
      isActive: true,
    });

    shippingAddress = await Address.create({
      userId: customerUser._id,
      firstName: "Test",
      lastName: "Customer",
      phone: "9876543210",
      addressLine1: "123 Commercial St",
      city: "Bengaluru",
      state: "Karnataka",
      postalCode: "560001",
      country: "IN",
      isDefault: true,
    });
  });

  afterAll(async () => {
    // Clean up test collections
    await ProductDiscount.deleteMany({ name: /D5/i });
    await Product.deleteMany({ name: /D5/i });
    await ProductVariant.deleteMany({ sku: /D5/i });
    await Cart.deleteMany({ customerId: customerDoc?._id });
    await Order.deleteMany({ customerId: customerDoc?._id });
    await User.deleteMany({ email: /d5-.*@example\.com/ });
    await Customer.deleteMany({ _id: customerDoc?._id });
    await Vendor.deleteMany({ _id: testVendor?._id });
    await Warehouse.deleteMany({ _id: testWarehouse?._id });
    await Category.deleteMany({ _id: testCategory?._id });
    await Brand.deleteMany({ _id: testBrand?._id });
    await Address.deleteMany({ userId: customerUser?._id });
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  /**
   * Helper to create test product with warehouse inventory
   */
  async function createTestProduct({ price = "1000.00", compareAtPrice = "1200.00", stock = 50 }) {
    const rand = Math.random().toString(36).substring(7);
    const sku = `D5-SKU-${rand}`.toUpperCase();

    const product = await productService.createProduct({
      data: {
        name: `D5 Product ${rand}`,
        slug: `d5-product-${rand}`,
        sku,
        categoryId: testCategory._id.toString(),
        brandId: testBrand._id.toString(),
        price,
        compareAtPrice,
        stockQuantity: stock,
        warehouseId: testWarehouse._id.toString(),
        productType: "simple",
      },
      userId: vendorUser._id.toString(),
      actor: vendorUser,
    });

    await Product.findByIdAndUpdate(product._id, { status: "active" });
    product.status = "active";

    const variant = await ProductVariant.findOne({ productId: product._id, isDefault: true });

    return { product, variant, sku };
  }

  describe("1. Catalog & Storefront Authoritative Pricing Resolution", () => {
    test("1.1 Product without promotion retains regular catalog price and price fields unchanged", async () => {
      const { product, variant } = await createTestProduct({ price: "1000.00", compareAtPrice: "1200.00" });

      const detail = await productService.getProductById(product._id.toString());
      expect(detail).toBeDefined();
      expect(detail.price.toString()).toBe("1000.00");
      expect(detail.effectivePrice).toBe("1000.00");
      expect(detail.regularPrice).toBe("1000.00");
      expect(detail.isPromotional).toBe(false);
      expect(detail.promotionalDiscountAmount).toBe("0.00");

      const dbVariant = await ProductVariant.findById(variant._id);
      expect(dbVariant.price.toString()).toBe("1000.00");
    });

    test("1.2 Valid percentage promotion calculates authoritative effectivePrice without mutating catalog price", async () => {
      const { product, variant } = await createTestProduct({ price: "1000.00" });

      const promo = await ProductDiscount.create({
        name: "D5 20% Off Promotion",
        description: "20 percent off test",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: mongoose.Types.Decimal128.fromString("20.00"),
        scope: DISCOUNT_SCOPES.PRODUCTS,
        productIds: [product._id],
        status: DISCOUNT_STATUSES.ACTIVE,
        priority: 10,
        fundingSource: FUNDING_SOURCES.PLATFORM,
        allowCoupons: true,
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 3600000),
      });

      const detail = await productService.getProductById(product._id.toString());
      expect(detail.price.toString()).toBe("1000.00"); // Regular price unchanged
      expect(detail.effectivePrice).toBe("800.00");
      expect(detail.regularPrice).toBe("1000.00");
      expect(detail.isPromotional).toBe(true);
      expect(detail.promotionalDiscountAmount).toBe("200.00");
      expect(detail.discountPercentage).toBe(20);
      expect(detail.promotion.name).toBe("D5 20% Off Promotion");

      // Verify Product.price in DB was NOT mutated
      const dbProduct = await Product.findById(product._id);
      expect(dbProduct.price.toString()).toBe("1000.00");

      await ProductDiscount.findByIdAndDelete(promo._id);
    });

    test("1.3 Valid fixed amount promotion calculates authoritative effectivePrice", async () => {
      const { product } = await createTestProduct({ price: "500.00" });

      const promo = await ProductDiscount.create({
        name: "D5 Fixed 100 Off",
        discountType: DISCOUNT_TYPES.FIXED_AMOUNT,
        value: mongoose.Types.Decimal128.fromString("100.00"),
        scope: DISCOUNT_SCOPES.PRODUCTS,
        productIds: [product._id],
        status: DISCOUNT_STATUSES.ACTIVE,
        priority: 10,
        fundingSource: FUNDING_SOURCES.VENDOR,
        allowCoupons: false,
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 3600000),
      });

      const detail = await productService.getProductById(product._id.toString());
      expect(detail.effectivePrice).toBe("400.00");
      expect(detail.promotionalDiscountAmount).toBe("100.00");
      expect(detail.isPromotional).toBe(true);

      await ProductDiscount.findByIdAndDelete(promo._id);
    });

    test("1.4 Promotion priority resolves conflict in favor of higher priority promotion", async () => {
      const { product } = await createTestProduct({ price: "1000.00" });

      const promoLow = await ProductDiscount.create({
        name: "D5 Low Priority 10%",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: mongoose.Types.Decimal128.fromString("10.00"),
        scope: DISCOUNT_SCOPES.PRODUCTS,
        productIds: [product._id],
        status: DISCOUNT_STATUSES.ACTIVE,
        priority: 5,
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 3600000),
      });

      const promoHigh = await ProductDiscount.create({
        name: "D5 High Priority 30%",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: mongoose.Types.Decimal128.fromString("30.00"),
        scope: DISCOUNT_SCOPES.PRODUCTS,
        productIds: [product._id],
        status: DISCOUNT_STATUSES.ACTIVE,
        priority: 25,
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 3600000),
      });

      const detail = await productService.getProductById(product._id.toString());
      expect(detail.effectivePrice).toBe("700.00");
      expect(detail.promotion.id).toBe(promoHigh._id.toString());

      await ProductDiscount.deleteMany({ _id: { $in: [promoLow._id, promoHigh._id] } });
    });

    test("1.5 Expired promotion with stale active status is authoritatively rejected by time-window check", async () => {
      const { product } = await createTestProduct({ price: "1000.00" });

      const expiredPromo = await ProductDiscount.create({
        name: "D5 Stale Expired Promotion",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: mongoose.Types.Decimal128.fromString("50.00"),
        scope: DISCOUNT_SCOPES.PRODUCTS,
        productIds: [product._id],
        status: DISCOUNT_STATUSES.ACTIVE, // Stale active status
        startsAt: new Date(Date.now() - 7200000),
        endsAt: new Date(Date.now() - 3600000), // Ended 1 hour ago
      });

      const detail = await productService.getProductById(product._id.toString());
      expect(detail.isPromotional).toBe(false);
      expect(detail.effectivePrice).toBe("1000.00");

      await ProductDiscount.findByIdAndDelete(expiredPromo._id);
    });

    test("1.6 getVariantAvailability returns promotional pricing fields", async () => {
      const { product, variant } = await createTestProduct({ price: "800.00" });

      const promo = await ProductDiscount.create({
        name: "D5 Variant Availability Promo",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: mongoose.Types.Decimal128.fromString("25.00"),
        scope: DISCOUNT_SCOPES.PRODUCTS,
        productIds: [product._id],
        status: DISCOUNT_STATUSES.ACTIVE,
        priority: 10,
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 3600000),
      });

      const avail = await productService.getVariantAvailability(variant._id.toString());
      expect(avail).toBeDefined();
      expect(avail.price).toBe("800.00");
      expect(avail.effectivePrice).toBe("600.00");
      expect(avail.regularPrice).toBe("800.00");
      expect(avail.isPromotional).toBe(true);
      expect(avail.promotionalDiscountAmount).toBe("200.00");

      await ProductDiscount.findByIdAndDelete(promo._id);
    });
  });

  describe("2. Cart Authoritative Promotional Pricing & Savings", () => {
    test("2.1 Cart calculates effective prices, line promotional savings, and productDiscountTotal", async () => {
      await Cart.deleteMany({ customerId: customerDoc._id });

      const { product, variant } = await createTestProduct({ price: "1000.00" });

      const promo = await ProductDiscount.create({
        name: "D5 Cart Promo 20%",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: mongoose.Types.Decimal128.fromString("20.00"),
        scope: DISCOUNT_SCOPES.PRODUCTS,
        productIds: [product._id],
        status: DISCOUNT_STATUSES.ACTIVE,
        priority: 10,
        fundingSource: FUNDING_SOURCES.PLATFORM,
        allowCoupons: true,
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 3600000),
      });

      const updatedCart = await cartService.addItem(
        customerUser._id.toString(),
        variant._id.toString(),
        2
      );

      expect(updatedCart.items).toHaveLength(1);
      const cartItem = updatedCart.items[0];

      // Effective unit price is 800.00
      expect(cartItem.priceSnapshot.toString()).toBe("800.00");
      expect(cartItem.effectivePrice.toString()).toBe("800.00");
      expect(cartItem.regularPrice.toString()).toBe("1000.00");
      expect(cartItem.isPromotional).toBe(true);
      // Promotional savings: (1000 - 800) * 2 = 400.00
      expect(cartItem.promotionalSavings.toString()).toBe("400.00");
      // Subtotal: 800 * 2 = 1600.00
      expect(updatedCart.subtotal.toString()).toBe("1600.00");
      expect(updatedCart.productDiscountTotal.toString()).toBe("400.00");

      await ProductDiscount.findByIdAndDelete(promo._id);
      await Cart.deleteMany({ customerId: customerDoc._id });
    });

    test("2.2 Promotion expiration while item is in cart reverts to regular price on getCart", async () => {
      await Cart.deleteMany({ customerId: customerDoc._id });

      const { product, variant } = await createTestProduct({ price: "1000.00" });

      const promo = await ProductDiscount.create({
        name: "D5 Ephemeral Cart Promo",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: mongoose.Types.Decimal128.fromString("30.00"),
        scope: DISCOUNT_SCOPES.PRODUCTS,
        productIds: [product._id],
        status: DISCOUNT_STATUSES.ACTIVE,
        priority: 10,
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 3600000),
      });

      await cartService.addItem(customerUser._id.toString(), variant._id.toString(), 1);

      // Now simulate promotion expiration in DB
      await ProductDiscount.findByIdAndUpdate(promo._id, {
        endsAt: new Date(Date.now() - 60000),
      });

      // Calling getCart triggers authoritative recalculateCart
      const refreshedCart = await cartService.getCart(customerUser._id.toString());
      expect(refreshedCart.items[0].isPromotional).toBe(false);
      expect(refreshedCart.items[0].priceSnapshot.toString()).toBe("1000.00");
      expect(refreshedCart.subtotal.toString()).toBe("1000.00");
      expect(refreshedCart.productDiscountTotal.toString()).toBe("0.00");

      await ProductDiscount.findByIdAndDelete(promo._id);
      await Cart.deleteMany({ customerId: customerDoc._id });
    });
  });

  describe("3. Coupon Stacking Policies", () => {
    test("3.1 Coupon stacking is rejected when promotion has allowCoupons === false", async () => {
      await Cart.deleteMany({ customerId: customerDoc._id });

      const { product, variant } = await createTestProduct({ price: "1000.00" });

      const promoNoStack = await ProductDiscount.create({
        name: "D5 Exclusive Promotion No Stacking",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: mongoose.Types.Decimal128.fromString("25.00"),
        scope: DISCOUNT_SCOPES.PRODUCTS,
        productIds: [product._id],
        status: DISCOUNT_STATUSES.ACTIVE,
        priority: 10,
        allowCoupons: false, // Disallow coupon stacking
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 3600000),
      });

      const coupon = await Coupon.create({
        code: `D5NOSTACK${Date.now()}`,
        type: "percentage",
        value: mongoose.Types.Decimal128.fromString("10.00"),
        minOrderAmount: mongoose.Types.Decimal128.fromString("100.00"),
        startsAt: new Date(Date.now() - 3600000),
        expiresAt: new Date(Date.now() + 3600000),
        scope: "all",
        status: "active",
      });

      await cartService.addItem(customerUser._id.toString(), variant._id.toString(), 1);

      // Quote returns structured coupon error
      const quote = await orderService.calculateCheckoutQuote({
        userId: customerUser._id.toString(),
        couponCode: coupon.code,
      });

      expect(quote.coupon).toBeDefined();
      expect(quote.coupon.error).toContain("Coupon cannot be combined with promotional item");
      expect(quote.couponDiscount).toBe("0.00");

      // Attempting order creation with conflicting coupon throws 400 COUPON_STACKING_DISALLOWED
      await expect(
        orderService.createOrderFromCurrentCart(
          customerUser._id.toString(),
          shippingAddress._id.toString(),
          coupon.code,
          `idem-stack-disallowed-${Date.now()}`
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        code: "COUPON_STACKING_DISALLOWED",
      });

      await ProductDiscount.findByIdAndDelete(promoNoStack._id);
      await Coupon.findByIdAndDelete(coupon._id);
      await Cart.deleteMany({ customerId: customerDoc._id });
    });

    test("3.2 Coupon stacking is accepted and deterministically calculated when allowCoupons === true", async () => {
      await Cart.deleteMany({ customerId: customerDoc._id });

      const { product, variant } = await createTestProduct({ price: "1000.00" });

      const promoStackable = await ProductDiscount.create({
        name: "D5 Stackable Promotion",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: mongoose.Types.Decimal128.fromString("20.00"), // ₹1000 -> ₹800
        scope: DISCOUNT_SCOPES.PRODUCTS,
        productIds: [product._id],
        status: DISCOUNT_STATUSES.ACTIVE,
        priority: 10,
        allowCoupons: true,
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 3600000),
      });

      const coupon = await Coupon.create({
        code: `D5STACK${Date.now()}`,
        type: "percentage",
        value: mongoose.Types.Decimal128.fromString("10.00"), // 10% on ₹800 = ₹80
        minOrderAmount: mongoose.Types.Decimal128.fromString("100.00"),
        startsAt: new Date(Date.now() - 3600000),
        expiresAt: new Date(Date.now() + 3600000),
        scope: "all",
        status: "active",
      });

      await cartService.addItem(customerUser._id.toString(), variant._id.toString(), 1);

      const quote = await orderService.calculateCheckoutQuote({
        userId: customerUser._id.toString(),
        couponCode: coupon.code,
      });

      expect(quote.coupon).toBeDefined();
      expect(quote.coupon.error).toBeUndefined();
      expect(quote.subtotal).toBe("800.00");
      expect(quote.productDiscount).toBe("200.00");
      expect(quote.couponDiscount).toBe("80.00");

      await ProductDiscount.findByIdAndDelete(promoStackable._id);
      await Coupon.findByIdAndDelete(coupon._id);
      await Cart.deleteMany({ customerId: customerDoc._id });
    });
  });

  describe("4. Checkout Quote, Fingerprint Integrity & Price Change Protection", () => {
    test("4.1 Fingerprint detects promotion expiration and triggers PRICE_CHANGED (409)", async () => {
      await Cart.deleteMany({ customerId: customerDoc._id });

      const { product, variant } = await createTestProduct({ price: "1000.00" });

      const promo = await ProductDiscount.create({
        name: "D5 Fingerprint Expiration Promo",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: mongoose.Types.Decimal128.fromString("20.00"),
        scope: DISCOUNT_SCOPES.PRODUCTS,
        productIds: [product._id],
        status: DISCOUNT_STATUSES.ACTIVE,
        priority: 10,
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 3600000),
      });

      await cartService.addItem(customerUser._id.toString(), variant._id.toString(), 1);

      // 1. Generate quote while promotion is active
      const quote = await orderService.calculateCheckoutQuote({
        userId: customerUser._id.toString(),
      });
      expect(quote.grandTotal).toBe("800.00");
      const quoteRef = quote.quoteReference;
      expect(quoteRef).toBeDefined();

      // 2. Promotion expires before order confirmation
      await ProductDiscount.findByIdAndUpdate(promo._id, {
        endsAt: new Date(Date.now() - 60000),
      });

      // 3. Placing order with old quote reference must fail with PRICE_CHANGED (409)
      await expect(
        orderService.createOrderFromCurrentCart(
          customerUser._id.toString(),
          shippingAddress._id.toString(),
          null,
          `idem-price-change-${Date.now()}`,
          "standard",
          quoteRef
        )
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "PRICE_CHANGED",
      });

      await ProductDiscount.findByIdAndDelete(promo._id);
      await Cart.deleteMany({ customerId: customerDoc._id });
    });
  });

  describe("5. Immutable Order Snapshots & Financial Invariants", () => {
    test("5.1 Order creation persists immutable promotional snapshot and reconciles totals", async () => {
      await Cart.deleteMany({ customerId: customerDoc._id });

      const { product, variant } = await createTestProduct({ price: "1000.00", compareAtPrice: "1250.00" });

      const promo = await ProductDiscount.create({
        name: "D5 Immutable Order Snapshot Promo",
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        value: mongoose.Types.Decimal128.fromString("20.00"),
        scope: DISCOUNT_SCOPES.PRODUCTS,
        productIds: [product._id],
        status: DISCOUNT_STATUSES.ACTIVE,
        priority: 10,
        fundingSource: FUNDING_SOURCES.PLATFORM,
        allowCoupons: true,
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 3600000),
      });

      await cartService.addItem(customerUser._id.toString(), variant._id.toString(), 2);

      const order = await orderService.createOrderFromCurrentCart(
        customerUser._id.toString(),
        shippingAddress._id.toString(),
        null,
        `idem-immutable-${Date.now()}`
      );

      expect(order).toBeDefined();
      expect(order.items).toHaveLength(1);
      const line = order.items[0];

      // Verify line-level immutable snapshot fields
      expect(line.unitPrice.toString()).toBe("800.00");
      expect(line.regularPrice.toString()).toBe("1000.00");
      expect(line.compareAtPrice.toString()).toBe("1250.00");
      expect(line.effectivePrice.toString()).toBe("800.00");
      expect(line.isPromotional).toBe(true);
      expect(line.promotionId.toString()).toBe(promo._id.toString());
      expect(line.promotionName).toBe("D5 Immutable Order Snapshot Promo");
      expect(line.promotionDiscountAmount.toString()).toBe("200.00");
      expect(line.fundingSource).toBe("platform");
      expect(line.allowCoupons).toBe(true);

      // Verify order totals
      expect(order.subtotal.toString()).toBe("1600.00");
      expect(order.productDiscountTotal.toString()).toBe("400.00");
      expect(order.grandTotal.toString()).toBe("1600.00"); // >= 499 free standard delivery

      // Later promotion deletion must NOT rewrite historical order pricing
      await ProductDiscount.findByIdAndDelete(promo._id);

      const reFetchedOrder = await Order.findById(order._id);
      expect(reFetchedOrder.items[0].unitPrice.toString()).toBe("800.00");
      expect(reFetchedOrder.items[0].effectivePrice.toString()).toBe("800.00");
      expect(reFetchedOrder.productDiscountTotal.toString()).toBe("400.00");
      expect(reFetchedOrder.grandTotal.toString()).toBe("1600.00");

      await Cart.deleteMany({ customerId: customerDoc._id });
    });
  });

  describe("6. Vendor Settlement Audit & Funding Safety Verification", () => {
    test("6.1 Vendor settlement formulas integrate platform reimbursement subsidy", () => {
      const platformItem = {
        lineTotal: "800.00",
        regularPrice: "1000.00",
        effectivePrice: "800.00",
        isPromotional: true,
        fundingSource: "platform",
        promotionDiscountAmount: "200.00",
      };

      // Auditing proof: Platform funding requires settlement subsidy credit
      expect(platformItem.fundingSource).toBe("platform");
      expect(Number(platformItem.regularPrice) - Number(platformItem.effectivePrice)).toBe(200);

      // Verify calculateNetPayable incorporates platformSubsidy
      const net = vendorSettlementService.calculateNetPayable({
        grossSales: "800.00",
        platformSubsidy: "200.00",
        discounts: "0.00",
        refunds: "0.00",
        platformCommission: "100.00",
      });
      expect(Number(net.toString())).toBe(900);
    });
  });
});
