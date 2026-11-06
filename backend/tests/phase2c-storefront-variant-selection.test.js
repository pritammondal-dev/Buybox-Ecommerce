const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const Category = require("../src/models/Category");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Warehouse = require("../src/models/Warehouse");
const Inventory = require("../src/models/Inventory");
const Cart = require("../src/models/Cart");
const Customer = require("../src/models/Customer");
const productService = require("../src/services/product.service");
const cartService = require("../src/services/cart.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_phase2c_test?")
  : "mongodb://127.0.0.1:27017/buybox_phase2c_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Buybox Phase 2C — Storefront Variant Selection & Real-Time Availability Integration", () => {
  let testCategory;
  let testWarehouse;
  let inactiveWarehouse;
  let testVendor;
  let testCustomer;

  async function createTestVendor(name) {
    const rand = Math.random().toString(36).substring(7);
    const user = await User.create({
      firstName: name,
      lastName: "Vendor",
      email: `${name.toLowerCase()}_${Date.now()}_${rand}@phase2c-test.com`,
      password: "Password123!",
      role: "vendor",
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const vendor = await Vendor.create({
      userId: user._id,
      businessName: `${name} Business ${rand}`,
      businessSlug: `${name.toLowerCase()}-biz-${rand}`,
      isActive: true,
      onboardingStatus: "approved",
    });

    return { user, vendor };
  }

  async function createTestCustomer() {
    const rand = Math.random().toString(36).substring(7);
    const user = await User.create({
      firstName: "Test",
      lastName: "Customer",
      email: `customer_${Date.now()}_${rand}@phase2c-test.com`,
      password: "Password123!",
      role: "customer",
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const customer = await Customer.create({
      userId: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });

    return { user, customer };
  }

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    testWarehouse = await Warehouse.create({
      name: "Phase 2C Main Distribution Center",
      code: `P2C-WH-${Date.now()}`,
      address: {
        addressLine1: "1 Industrial Blvd",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "IN",
      },
      isActive: true,
    });

    inactiveWarehouse = await Warehouse.create({
      name: "Phase 2C Decommissioned Warehouse",
      code: `P2C-INACTIVE-WH-${Date.now()}`,
      address: {
        addressLine1: "99 Old Hub",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560002",
        country: "IN",
      },
      isActive: false,
    });

    testCategory = await Category.create({
      name: `Computing ${Date.now()}`,
      slug: `computing-${Date.now()}`,
      isActive: true,
    });

    const vData = await createTestVendor("GadgetShop");
    testVendor = vData.vendor;

    const cData = await createTestCustomer();
    testCustomer = cData.customer;
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await User.deleteMany({ email: { $regex: /@phase2c-test\.com$/ } });
      await Vendor.deleteMany({ businessSlug: { $regex: /^gadgetshop-/ } });
      await Category.deleteMany({ _id: testCategory._id });
      await Warehouse.deleteMany({ _id: { $in: [testWarehouse._id, inactiveWarehouse._id] } });
      await Customer.deleteMany({ _id: testCustomer._id });
      await Product.deleteMany({ vendorId: testVendor._id });
      await ProductVariant.deleteMany({});
      await Inventory.deleteMany({});
      await Cart.deleteMany({});
    }
  });

  describe("1. Simple Product Canonical Variant & Stock Resolution", () => {
    let simpleProduct;
    let defaultVariant;

    beforeAll(async () => {
      simpleProduct = await Product.create({
        name: "Mechanical Keyboard P2C",
        slug: `keyboard-p2c-${Date.now()}`,
        sku: `KB-P2C-${Date.now()}`,
        productType: "simple",
        vendorId: testVendor._id,
        categoryId: testCategory._id,
        price: 4999,
        compareAtPrice: 5999,
        status: "active",
      });

      defaultVariant = await ProductVariant.create({
        productId: simpleProduct._id,
        sku: simpleProduct.sku,
        name: simpleProduct.name,
        price: 4999,
        compareAtPrice: 5999,
        currency: "INR",
        isDefault: true,
        isActive: true,
        stockQuantity: 999, // Deprecated compatibility mirror (should be overridden by warehouse inventory)
      });

      // Provision authoritative inventory: 25 on-hand, 5 reserved => 20 available
      await Inventory.create({
        productVariantId: defaultVariant._id,
        warehouseId: testWarehouse._id,
        onHand: 25,
        reserved: 5,
        lowStockThreshold: 5,
        lastStockUpdateAt: new Date(),
      });

      // Also add stock in inactive warehouse: 50 on-hand (must NOT be counted in available stock)
      await Inventory.create({
        productVariantId: defaultVariant._id,
        warehouseId: inactiveWarehouse._id,
        onHand: 50,
        reserved: 0,
        lowStockThreshold: 5,
        lastStockUpdateAt: new Date(),
      });
    });

    test("resolves canonical default variant and authoritative stock on getProductById", async () => {
      const retrieved = await productService.getProductById(simpleProduct._id.toString());
      expect(retrieved).toBeDefined();
      expect(retrieved.productType).toBe("simple");
      expect(retrieved.defaultVariant).toBeDefined();
      expect(retrieved.defaultVariant._id.toString()).toBe(defaultVariant._id.toString());
      expect(retrieved.defaultVariantId.toString()).toBe(defaultVariant._id.toString());

      // Authoritative available stock must be 20 (active warehouse only: 25 - 5)
      expect(retrieved.availableQuantity).toBe(20);
      expect(retrieved.inStock).toBe(true);
      expect(retrieved.stockStatus).toBe("in_stock");
    });

    test("resolves canonical default variant and authoritative stock on getProductBySlug", async () => {
      const retrieved = await productService.getProductBySlug(simpleProduct.slug);
      expect(retrieved).toBeDefined();
      expect(retrieved.defaultVariant).toBeDefined();
      expect(retrieved.defaultVariant.sku).toBe(simpleProduct.sku);
      expect(retrieved.availableQuantity).toBe(20);
      expect(retrieved.inStock).toBe(true);
    });

    test("returns authoritative availability via public endpoint without private warehouse details", async () => {
      const res = await request(app)
        .get(`/api/v1/products/variants/${defaultVariant._id}/availability`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      const data = res.body.data;
      expect(data.variantId).toBe(defaultVariant._id.toString());
      expect(data.productId).toBe(simpleProduct._id.toString());
      expect(data.sku).toBe(defaultVariant.sku);
      expect(data.availableQuantity).toBe(20);
      expect(data.inStock).toBe(true);
      expect(data.stockStatus).toBe("in_stock");
      expect(Number(data.price)).toBe(4999);
      expect(Number(data.compareAtPrice)).toBe(5999);

      // Verify privacy: no warehouse IDs, costs, or vendor internals exposed
      expect(data.warehouses).toBeUndefined();
      expect(data.warehouseId).toBeUndefined();
      expect(data.onHand).toBeUndefined();
      expect(data.reserved).toBeUndefined();
      expect(data.vendorId).toBeUndefined();
    });
  });

  describe("2. Variable Product Variant Listing & Dynamic Pricing", () => {
    let variableProduct;
    let variantRedSmall;
    let variantRedLarge;
    let variantBlueSmall;
    let inactiveVariant;

    beforeAll(async () => {
      variableProduct = await Product.create({
        name: "Pro Gaming Mouse P2C",
        slug: `mouse-p2c-${Date.now()}`,
        sku: `MSE-P2C-${Date.now()}`,
        productType: "variable",
        vendorId: testVendor._id,
        categoryId: testCategory._id,
        price: 2499,
        status: "active",
      });

      variantRedSmall = await ProductVariant.create({
        productId: variableProduct._id,
        sku: `MSE-RED-SM-${Date.now()}`,
        name: "Pro Gaming Mouse - Red / Small",
        price: 2499,
        compareAtPrice: 2999,
        currency: "INR",
        attributes: new Map([["color", "Red"], ["size", "Small"]]),
        isActive: true,
      });

      variantRedLarge = await ProductVariant.create({
        productId: variableProduct._id,
        sku: `MSE-RED-LG-${Date.now()}`,
        name: "Pro Gaming Mouse - Red / Large",
        price: 2999,
        compareAtPrice: 3499,
        currency: "INR",
        attributes: new Map([["color", "Red"], ["size", "Large"]]),
        isActive: true,
      });

      variantBlueSmall = await ProductVariant.create({
        productId: variableProduct._id,
        sku: `MSE-BLU-SM-${Date.now()}`,
        name: "Pro Gaming Mouse - Blue / Small",
        price: 2799,
        currency: "INR",
        attributes: new Map([["color", "Blue"], ["size", "Small"]]),
        isActive: true,
      });

      inactiveVariant = await ProductVariant.create({
        productId: variableProduct._id,
        sku: `MSE-DISCONTINUED-${Date.now()}`,
        name: "Pro Gaming Mouse - Discontinued",
        price: 1999,
        currency: "INR",
        attributes: new Map([["color", "Yellow"], ["size", "Small"]]),
        isActive: false, // Inactive variant must be omitted
      });

      // Stock: Red Small = 10, Red Large = 0, Blue Small = 15
      await Inventory.create({
        productVariantId: variantRedSmall._id,
        warehouseId: testWarehouse._id,
        onHand: 10,
        reserved: 0,
        lowStockThreshold: 2,
      });

      await Inventory.create({
        productVariantId: variantRedLarge._id,
        warehouseId: testWarehouse._id,
        onHand: 0,
        reserved: 0,
        lowStockThreshold: 2,
      });

      await Inventory.create({
        productVariantId: variantBlueSmall._id,
        warehouseId: testWarehouse._id,
        onHand: 15,
        reserved: 0,
        lowStockThreshold: 2,
      });
    });

    test("attaches only active child variants and computes authoritative price range", async () => {
      const retrieved = await productService.getProductById(variableProduct._id.toString());
      expect(retrieved.productType).toBe("variable");
      expect(retrieved.variants).toHaveLength(3);

      // Verify inactive variant is excluded
      const variantIds = retrieved.variants.map((v) => v._id.toString());
      expect(variantIds).toContain(variantRedSmall._id.toString());
      expect(variantIds).toContain(variantRedLarge._id.toString());
      expect(variantIds).toContain(variantBlueSmall._id.toString());
      expect(variantIds).not.toContain(inactiveVariant._id.toString());

      // Price range must reflect min and max of active variants: 2499 - 2999
      expect(retrieved.priceRange).toEqual({
        min: 2499,
        max: 2999,
      });

      // Normalizes attributes to standard object for frontend compatibility
      const redSmallEnriched = retrieved.variants.find(
        (v) => v._id.toString() === variantRedSmall._id.toString()
      );
      expect(redSmallEnriched.attributes).toEqual({ color: "Red", size: "Small" });
      expect(redSmallEnriched.availableQuantity).toBe(10);
      expect(redSmallEnriched.inStock).toBe(true);

      const redLargeEnriched = retrieved.variants.find(
        (v) => v._id.toString() === variantRedLarge._id.toString()
      );
      expect(redLargeEnriched.availableQuantity).toBe(0);
      expect(redLargeEnriched.inStock).toBe(false);
      expect(redLargeEnriched.stockStatus).toBe("out_of_stock");
    });

    test("returns 404 for availability check on inactive variant", async () => {
      const res = await request(app)
        .get(`/api/v1/products/variants/${inactiveVariant._id}/availability`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("VARIANT_NOT_FOUND");
    });

    test("returns 400 for malformed variant ID", async () => {
      const res = await request(app)
        .get("/api/v1/products/variants/invalid-mongo-id/availability")
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("INVALID_VARIANT_ID");
    });
  });

  describe("3. Authoritative Stock Guard & Cart Integration", () => {
    let cartProduct;
    let cartVariantInStock;
    let cartVariantOutOfStock;

    beforeAll(async () => {
      cartProduct = await Product.create({
        name: "Wireless Earbuds P2C",
        slug: `earbuds-p2c-${Date.now()}`,
        sku: `EB-P2C-${Date.now()}`,
        productType: "variable",
        vendorId: testVendor._id,
        categoryId: testCategory._id,
        price: 3499,
        status: "active",
      });

      cartVariantInStock = await ProductVariant.create({
        productId: cartProduct._id,
        sku: `EB-WHT-${Date.now()}`,
        name: "Wireless Earbuds - White",
        price: 3499,
        currency: "INR",
        attributes: { color: "White" },
        isActive: true,
        stockQuantity: 999, // Deprecated mirror must NOT override inventory
      });

      cartVariantOutOfStock = await ProductVariant.create({
        productId: cartProduct._id,
        sku: `EB-BLK-${Date.now()}`,
        name: "Wireless Earbuds - Black",
        price: 3499,
        currency: "INR",
        attributes: { color: "Black" },
        isActive: true,
        stockQuantity: 999, // Deprecated mirror must NOT override inventory
      });

      // Warehouse Inventory: White = 5 on hand, Black = 0 on hand
      await Inventory.create({
        productVariantId: cartVariantInStock._id,
        warehouseId: testWarehouse._id,
        onHand: 5,
        reserved: 0,
        lowStockThreshold: 2,
      });

      await Inventory.create({
        productVariantId: cartVariantOutOfStock._id,
        warehouseId: testWarehouse._id,
        onHand: 0,
        reserved: 0,
        lowStockThreshold: 2,
      });
    });

    test("rejects adding variable product to cart without explicit variant ID", async () => {
      await expect(
        cartService.addItem(
          testCustomer.userId,
          { productId: cartProduct._id.toString() },
          1
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        code: "VARIANT_SELECTION_REQUIRED",
      });
    });

    test("successfully adds variable product to cart with valid in-stock variant ID", async () => {
      const cart = await cartService.addItem(
        testCustomer.userId,
        { productVariantId: cartVariantInStock._id.toString() },
        2
      );

      expect(cart).toBeDefined();
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].productVariantId.toString()).toBe(cartVariantInStock._id.toString());
      expect(cart.items[0].quantity).toBe(2);
      expect(Number(cart.items[0].priceSnapshot)).toBe(3499);
    });

    test("merges quantity when adding the same variant again", async () => {
      const cart = await cartService.addItem(
        testCustomer.userId,
        { productVariantId: cartVariantInStock._id.toString() },
        2
      );

      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].quantity).toBe(4);
    });

    test("rejects adding more quantity than available in warehouse inventory (DEF-16)", async () => {
      // Current in cart: 4. Total available in warehouse: 5. Adding 2 more would require 6 => fails
      await expect(
        cartService.addItem(
          testCustomer.userId,
          { productVariantId: cartVariantInStock._id.toString() },
          2
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        code: "INSUFFICIENT_STOCK",
      });
    });

    test("rejects adding out-of-stock variant regardless of deprecated stock mirror", async () => {
      await expect(
        cartService.addItem(
          testCustomer.userId,
          { productVariantId: cartVariantOutOfStock._id.toString() },
          1
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        code: "OUT_OF_STOCK",
      });
    });
  });
});
