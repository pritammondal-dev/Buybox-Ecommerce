import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  parsePrice,
  calculateDiscountPercentage,
  formatCurrency,
} from "../../src/utils/formatCurrency.js";

describe("Product Details Page Logic & Architectural Tests", () => {
  // 1. Price Parsing and Decimal128 Handling
  test("parsePrice correctly extracts numbers from Decimal128, numbers, and strings", () => {
    assert.equal(parsePrice(1499), 1499);
    assert.equal(parsePrice("1499.50"), 1499.5);
    assert.equal(parsePrice({ $numberDecimal: "24999.00" }), 24999);
    assert.equal(parsePrice({ $numberDecimal: "0" }), 0);
    assert.equal(parsePrice(null), 0);
    assert.equal(parsePrice(undefined), 0);
  });

  // 2. Discount Percentage & Savings Calculation
  test("calculateDiscountPercentage and savings calculation", () => {
    // 25% discount: 10,000 to 7,500
    const originalPrice = { $numberDecimal: "10000" };
    const salePrice = { $numberDecimal: "7500" };
    const discount = calculateDiscountPercentage(originalPrice, salePrice);
    assert.equal(discount, 25);

    const savings = parsePrice(originalPrice) - parsePrice(salePrice);
    assert.equal(savings, 2500);

    // No discount if salePrice >= originalPrice
    assert.equal(calculateDiscountPercentage(5000, 5000), 0);
    assert.equal(calculateDiscountPercentage(4000, 5000), 0);
    assert.equal(calculateDiscountPercentage(0, 1000), 0);
  });

  // 3. Stock Status & Low Stock Logic
  test("evaluates stock availability and low-stock warning threshold accurately", () => {
    const evaluateStock = (product) => {
      const stockStatus = product?.stockStatus || "out_of_stock";
      const isOutOfStock = stockStatus === "out_of_stock";
      const isPreorder = stockStatus === "preorder";
      const stockQuantity =
        typeof product?.stockQuantity === "number" ? product.stockQuantity : null;
      const isLowStock =
        !isOutOfStock &&
        !isPreorder &&
        stockQuantity !== null &&
        stockQuantity > 0 &&
        stockQuantity <= 5;

      return { isOutOfStock, isPreorder, isLowStock, inStock: !isOutOfStock && !isPreorder };
    };

    // Standard In Stock
    const normalItem = evaluateStock({ stockStatus: "in_stock", stockQuantity: 25 });
    assert.equal(normalItem.inStock, true);
    assert.equal(normalItem.isLowStock, false);
    assert.equal(normalItem.isOutOfStock, false);

    // Low Stock (<= 5)
    const lowStockItem = evaluateStock({ stockStatus: "in_stock", stockQuantity: 3 });
    assert.equal(lowStockItem.inStock, true);
    assert.equal(lowStockItem.isLowStock, true);

    // Out of Stock
    const outOfStockItem = evaluateStock({ stockStatus: "out_of_stock", stockQuantity: 0 });
    assert.equal(outOfStockItem.isOutOfStock, true);
    assert.equal(outOfStockItem.inStock, false);

    // Preorder
    const preorderItem = evaluateStock({ stockStatus: "preorder" });
    assert.equal(preorderItem.isPreorder, true);
    assert.equal(preorderItem.inStock, false);
  });

  // 4. Dynamic Specifications Parser (Map & Object)
  test("safely parses both ES6 Map and plain Object specifications", () => {
    const parseSpecs = (specifications) => {
      if (!specifications) return [];
      let entries = [];
      if (specifications instanceof Map) {
        entries = Array.from(specifications.entries());
      } else if (typeof specifications === "object") {
        entries = Object.entries(specifications);
      }
      return entries.filter(
        ([k, v]) => k && v !== undefined && v !== null && String(v).trim() !== ""
      );
    };

    // Object format
    const objSpecs = {
      processor: "Apple M3 Pro",
      ram: "18GB Unified",
      storage: "512GB SSD",
      emptyField: "",
      nullField: null,
    };
    const parsedObj = parseSpecs(objSpecs);
    assert.equal(parsedObj.length, 3);
    assert.deepEqual(parsedObj[0], ["processor", "Apple M3 Pro"]);

    // Map format
    const mapSpecs = new Map([
      ["display", "16-inch Liquid Retina XDR"],
      ["battery", "100Wh Lithium-Polymer"],
    ]);
    const parsedMap = parseSpecs(mapSpecs);
    assert.equal(parsedMap.length, 2);
    assert.deepEqual(parsedMap[0], ["display", "16-inch Liquid Retina XDR"]);

    // Null/undefined format
    assert.deepEqual(parseSpecs(null), []);
    assert.deepEqual(parseSpecs(undefined), []);
  });

  // 5. Delivery PIN Code Validation (6-digit Indian PIN)
  test("validates 6-digit Indian PIN code format strictly", () => {
    const isValidPinCode = (pin) => {
      const clean = String(pin || "").trim();
      return /^[1-9][0-9]{5}$/.test(clean);
    };

    // Valid PIN codes
    assert.equal(isValidPinCode("110001"), true); // New Delhi
    assert.equal(isValidPinCode("400001"), true); // Mumbai
    assert.equal(isValidPinCode("700001"), true); // Kolkata
    assert.equal(isValidPinCode("560001"), true); // Bengaluru

    // Invalid PIN codes
    assert.equal(isValidPinCode("011001"), false); // Starts with 0
    assert.equal(isValidPinCode("11000"), false); // Only 5 digits
    assert.equal(isValidPinCode("1100001"), false); // 7 digits
    assert.equal(isValidPinCode("11000A"), false); // Contains letter
    assert.equal(isValidPinCode(""), false); // Empty
    assert.equal(isValidPinCode(null), false); // Null
  });

  // 6. Breadcrumb Hierarchy Builder
  test("builds correct category hierarchy in breadcrumb trail", () => {
    const buildBreadcrumbs = (category, allCategories = []) => {
      const trail = [
        { label: "Home", href: "/" },
        { label: "Shop", href: "/shop" },
      ];

      if (!category) return trail;

      const parentId = category.parentId;
      if (parentId && Array.isArray(allCategories) && allCategories.length > 0) {
        const parentCat = allCategories.find(
          (c) => String(c._id || c.id) === String(parentId)
        );
        if (parentCat) {
          trail.push({
            label: parentCat.name,
            href: `/category/${parentCat.slug || parentCat._id}`,
          });
        }
      }

      trail.push({
        label: category.name,
        href: `/category/${category.slug || category._id}`,
      });

      return trail;
    };

    const electronics = { _id: "cat-1", name: "Electronics", slug: "electronics" };
    const laptops = { _id: "cat-2", name: "Laptops", slug: "laptops", parentId: "cat-1" };

    const trail = buildBreadcrumbs(laptops, [electronics, laptops]);
    assert.equal(trail.length, 4);
    assert.equal(trail[0].label, "Home");
    assert.equal(trail[1].label, "Shop");
    assert.equal(trail[2].label, "Electronics");
    assert.equal(trail[3].label, "Laptops");
  });

  // 7. Lightbox wrap-around navigation logic
  test("cycles lightbox photo indices safely with wrap-around", () => {
    const getNextIndex = (currentIndex, totalImages) => {
      return currentIndex === totalImages - 1 ? 0 : currentIndex + 1;
    };

    const getPrevIndex = (currentIndex, totalImages) => {
      return currentIndex === 0 ? totalImages - 1 : currentIndex - 1;
    };

    const total = 4;
    // Next navigation
    assert.equal(getNextIndex(0, total), 1);
    assert.equal(getNextIndex(2, total), 3);
    assert.equal(getNextIndex(3, total), 0); // Wrap around

    // Prev navigation
    assert.equal(getPrevIndex(3, total), 2);
    assert.equal(getPrevIndex(1, total), 0);
    assert.equal(getPrevIndex(0, total), 3); // Wrap around
  });

  // 8. Cart store payload normalization
  test("safely normalizes string and object payloads for addItem", () => {
    const normalizePayload = (payload) => {
      let productVariantId;
      let productId;
      let quantity = 1;
      let itemSnapshot = {};

      if (typeof payload === "string") {
        productId = payload;
      } else if (payload && typeof payload === "object") {
        productVariantId = payload.productVariantId;
        productId = payload.productId || payload.id || payload._id;
        quantity = typeof payload.quantity === "number" ? payload.quantity : 1;
        itemSnapshot = payload.itemSnapshot || {};
      }

      return { productVariantId, productId, quantity, itemSnapshot };
    };

    // String argument
    const fromString = normalizePayload("prod-12345");
    assert.equal(fromString.productId, "prod-12345");
    assert.equal(fromString.quantity, 1);

    // Full object argument
    const fromObj = normalizePayload({
      productId: "prod-999",
      quantity: 3,
      itemSnapshot: { name: "MacBook", price: 199999 },
    });
    assert.equal(fromObj.productId, "prod-999");
    assert.equal(fromObj.quantity, 3);
    assert.equal(fromObj.itemSnapshot.name, "MacBook");
  });

  // 9. Centralized Storefront Business Policies Integrity
  test("STOREFRONT_BUSINESS_POLICIES contains valid platform defaults", async () => {
    const { STOREFRONT_BUSINESS_POLICIES } = await import(
      "../../src/config/business-policies.config.js"
    );

    assert.ok(STOREFRONT_BUSINESS_POLICIES.shipping.freeShippingThreshold > 0);
    assert.ok(STOREFRONT_BUSINESS_POLICIES.shipping.standardEstimatedDays);
    assert.ok(Array.isArray(STOREFRONT_BUSINESS_POLICIES.bankOffers));
    assert.ok(STOREFRONT_BUSINESS_POLICIES.bankOffers.length > 0);
    assert.ok(Array.isArray(STOREFRONT_BUSINESS_POLICIES.coupons));
    assert.ok(STOREFRONT_BUSINESS_POLICIES.coupons[0].code === "BUYBOX10");
    assert.equal(STOREFRONT_BUSINESS_POLICIES.returnsAndWarranty.replacementDays, 7);
    assert.equal(STOREFRONT_BUSINESS_POLICIES.trustBadges.length, 4);
  });

  // 10. Dynamic Product-Specific Warranty Extractor
  test("extractProductWarranty safely extracts authentic warranty from specifications", async () => {
    const { extractProductWarranty } = await import(
      "../../src/config/business-policies.config.js"
    );

    // From Object
    const productWithObjWarranty = {
      specifications: {
        Warranty: "2 Years Comprehensive Manufacturer Warranty",
        Display: "6.7-inch OLED",
      },
    };
    assert.equal(
      extractProductWarranty(productWithObjWarranty),
      "2 Years Comprehensive Manufacturer Warranty"
    );

    // From Map with case-insensitive key
    const productWithMapWarranty = {
      specifications: new Map([
        ["warranty period", "1-Year Limited Hardware Warranty"],
        ["color", "Space Gray"],
      ]),
    };
    assert.equal(
      extractProductWarranty(productWithMapWarranty),
      "1-Year Limited Hardware Warranty"
    );

    // When unspecified
    assert.equal(extractProductWarranty({ specifications: {} }), null);
    assert.equal(extractProductWarranty({}), null);
    assert.equal(extractProductWarranty(null), null);
  });

  // 11. Truthful Seller Info & Rating Resolution (Zero Fabricated Ratings)
  test("resolveSellerInfo renders authentic ratings and omits fake scores for unrated vendors", async () => {
    const { resolveSellerInfo } = await import(
      "../../src/config/business-policies.config.js"
    );

    // Rated vendor
    const ratedProduct = {
      vendor: {
        businessName: "Appario Retail",
        ratingAverage: 4.6,
      },
    };
    const ratedInfo = resolveSellerInfo(ratedProduct);
    assert.equal(ratedInfo.sellerName, "Appario Retail");
    assert.equal(ratedInfo.rating, 4.6);
    assert.equal(ratedInfo.verifiedBadge, "Buybox Verified Partner");

    // Unrated vendor in backend (should NEVER invent 4.9)
    const unratedProduct = {
      vendor: {
        businessName: "Cloudtail India",
      },
    };
    const unratedInfo = resolveSellerInfo(unratedProduct);
    assert.equal(unratedInfo.sellerName, "Cloudtail India");
    assert.equal(unratedInfo.rating, null); // Strictly null, not 4.9!

    // Fallback when no vendor object is populated
    const noVendorProduct = {
      name: "Generic Gadget",
    };
    const fallbackInfo = resolveSellerInfo(noVendorProduct, { name: "Sony Official" });
    assert.equal(fallbackInfo.sellerName, "Sony Official");
    assert.equal(fallbackInfo.rating, null);
  });
});
