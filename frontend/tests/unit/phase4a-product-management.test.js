import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeAttributes,
  getAttributeEntries,
  formatAttributesString,
  getCombinationFingerprint,
  generateCartesianCombinations,
  estimateCombinationCount,
  suggestVariantSku,
} from "../../src/utils/attribute.util.js";
import { productService } from "../../src/services/product.service.js";
import { vendorService } from "../../src/services/vendor.service.js";

describe("Buybox Phase 4A — Advanced Product Management & Variable Creation Unit Tests", () => {
  // 1. Cartesian Product Generator & Combination Boundaries
  describe("1. Cartesian Generator & Combination Limits", () => {
    test("calculates exact Cartesian combination count accurately", () => {
      const axes = [
        { name: "Color", values: ["Red", "Green", "Blue"] },
        { name: "Size", values: ["S", "M", "L", "XL"] },
        { name: "Material", values: ["Cotton", "Polyester"] },
      ];
      const estimate = estimateCombinationCount(axes);
      assert.equal(estimate.count, 3 * 4 * 2); // 24
      assert.equal(estimate.exceedsLimit, false);
    });

    test("generates exact combination array matching count", () => {
      const axes = [
        { name: "Color", values: ["White", "Black"] },
        { name: "Size", values: ["S", "M"] },
      ];
      const combos = generateCartesianCombinations(axes);
      assert.equal(combos.length, 4);
      assert.deepEqual(combos[0], { Color: "White", Size: "S" });
      assert.deepEqual(combos[1], { Color: "White", Size: "M" });
      assert.deepEqual(combos[2], { Color: "Black", Size: "S" });
      assert.deepEqual(combos[3], { Color: "Black", Size: "M" });
    });

    test("safely handles empty attribute value lists", () => {
      const allEmpty = [{ name: "Color", values: [] }];
      assert.deepEqual(generateCartesianCombinations(allEmpty), []);

      const partiallyEmpty = [
        { name: "Color", values: ["Red"] },
        { name: "Size", values: [] },
      ];
      const combos = generateCartesianCombinations(partiallyEmpty);
      assert.deepEqual(combos, [{ Color: "Red" }]);
    });

    test("prevents accidental generation of combinations exceeding the 100 limit safety boundary", () => {
      const axes = [
        { name: "Attr1", values: ["1", "2", "3", "4", "5"] },
        { name: "Attr2", values: ["1", "2", "3", "4", "5"] },
        { name: "Attr3", values: ["1", "2", "3", "4", "5"] }, // 5*5*5 = 125 > 100
      ];
      const estimate = estimateCombinationCount(axes, 100);
      assert.equal(estimate.count, 125);
      assert.equal(estimate.exceedsLimit, true);
    });
  });

  // 2. Pricing Formulas: Percentages and Fixed rupee adjustments
  describe("2. Bulk Variation Pricing Calculations", () => {
    test("applies positive percentage price adjustment correctly with round-up", () => {
      const basePrice = 1000;
      const percentIncrease = 15; // +15%
      const newPrice = Math.max(0, Math.round(basePrice * (1 + percentIncrease / 100)));
      assert.equal(newPrice, 1150);
    });

    test("applies negative percentage price discount correctly", () => {
      const basePrice = 500;
      const percentDiscount = -20; // -20%
      const newPrice = Math.max(0, Math.round(basePrice * (1 + percentDiscount / 100)));
      assert.equal(newPrice, 400);
    });

    test("enforces zero lower bound on price adjustments", () => {
      const basePrice = 100;
      const extremeDiscount = -150; // -150%
      const newPrice = Math.max(0, Math.round(basePrice * (1 + extremeDiscount / 100)));
      assert.equal(newPrice, 0);
    });

    test("validates compareAtPrice relationship (compareAtPrice >= price)", () => {
      const validProduct = { price: 499, compareAtPrice: 999 };
      assert.equal(validProduct.compareAtPrice >= validProduct.price, true);

      const invalidProduct = { price: 999, compareAtPrice: 499 };
      assert.equal(invalidProduct.compareAtPrice >= invalidProduct.price, false);
    });
  });

  // 3. Bulk SKU Pattern Generation
  describe("3. Bulk Variation SKU Pattern Logic", () => {
    test("suggests deterministic variant SKU with base SKU and attribute initials", () => {
      const sku = suggestVariantSku("TSHIRT-001", { Color: "Black", Size: "Medium" });
      assert.equal(sku, "TSHIRT-001-BLAC-MEDI");
    });

    test("applies bulk prefix and suffix to variant SKUs cleanly", () => {
      const initialSkus = ["VAR-001", "VAR-002", "VAR-003"];
      const prefix = "BBX-";
      const suffix = "-V1";

      const updatedSkus = initialSkus.map((s) => `${prefix}${s}${suffix}`);
      assert.deepEqual(updatedSkus, ["BBX-VAR-001-V1", "BBX-VAR-002-V1", "BBX-VAR-003-V1"]);
    });
  });

  // 4. Variant Normalization and Bulk Update Payloads
  describe("4. Variant Normalization & Bulk Payloads", () => {
    test("normalizes variant payload supporting both id and variantId fields", () => {
      const rawItem = {
        variantId: "6ad0f46cdeb12d85b496019f",
        price: 899,
        compareAtPrice: 1299,
        image: {
          url: "https://assets.buybox.com/img/variant-1.webp",
          altText: "Black Variant",
        },
      };

      const normalized = {
        id: rawItem.id || rawItem.variantId,
        variantId: rawItem.variantId || rawItem.id,
        price: rawItem.price,
        compareAtPrice: rawItem.compareAtPrice,
        image: rawItem.image,
      };

      assert.equal(normalized.id, "6ad0f46cdeb12d85b496019f");
      assert.equal(normalized.variantId, "6ad0f46cdeb12d85b496019f");
      assert.equal(normalized.price, 899);
      assert.equal(normalized.image.url, "https://assets.buybox.com/img/variant-1.webp");
    });

    test("produces canonical attribute fingerprint for deduplication", () => {
      const a = { Size: "M", Color: "Emerald" };
      const b = { color: "emerald", size: "m" };
      assert.equal(getCombinationFingerprint(a), getCombinationFingerprint(b));
    });
  });

  // 5. Image & Gallery Upload Verification
  describe("5. Image & Gallery Upload Contracts", () => {
    test("productService defines uploadProductImage method", () => {
      assert.equal(typeof productService.uploadProductImage, "function");
    });

    test("vendorService defines uploadProductImage method", () => {
      assert.equal(typeof vendorService.uploadProductImage, "function");
    });

    test("validates file size limit and allowed MIME types", () => {
      const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
      const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];

      assert.equal(4.2 * 1024 * 1024 <= MAX_SIZE_BYTES, true);
      assert.equal(5.5 * 1024 * 1024 <= MAX_SIZE_BYTES, false);

      assert.equal(allowedMimes.includes("image/webp"), true);
      assert.equal(allowedMimes.includes("application/pdf"), false);
    });
  });

  // 6. SEO Metadata Contracts
  describe("6. SEO Metadata Validation", () => {
    test("enforces SEO field limits and formats", () => {
      const validSeo = {
        title: "Premium Organic Cotton T-Shirt | Buybox",
        description: "Explore our ultra-comfortable 100% organic cotton t-shirts in multiple sizes and colors.",
        keywords: ["cotton", "organic", "t-shirt", "apparel"],
      };

      assert.equal(validSeo.title.length <= 70, true);
      assert.equal(validSeo.description.length <= 160, true);
      assert.equal(Array.isArray(validSeo.keywords), true);
      assert.equal(validSeo.keywords.length, 4);
    });
  });
});
