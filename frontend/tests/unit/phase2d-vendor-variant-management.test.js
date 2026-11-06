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

describe("Buybox Phase 2D — Vendor Variant Management & SKU Control Workflows Frontend Unit Tests", () => {
  // 1. Attribute Normalization & Extraction
  describe("1. Attribute Normalization & Extraction", () => {
    test("normalizes plain object attributes correctly", () => {
      const input = { Size: "M", Color: "Emerald Green" };
      const res = normalizeAttributes(input);
      assert.deepEqual(res, { Size: "M", Color: "Emerald Green" });
    });

    test("normalizes Mongoose/ES6 Map instances correctly", () => {
      const map = new Map([
        ["Material", "100% Cotton"],
        ["Fit", "Relaxed"],
      ]);
      const res = normalizeAttributes(map);
      assert.deepEqual(res, { Material: "100% Cotton", Fit: "Relaxed" });
    });

    test("normalizes legacy Array format [{ name, value }]", () => {
      const arr = [
        { name: "Storage", value: "256GB" },
        { name: "RAM", value: "16GB" },
      ];
      const res = normalizeAttributes(arr);
      assert.deepEqual(res, { Storage: "256GB", RAM: "16GB" });
    });

    test("handles empty and malformed attributes safely", () => {
      assert.deepEqual(normalizeAttributes(null), {});
      assert.deepEqual(normalizeAttributes(undefined), {});
      assert.deepEqual(normalizeAttributes("string"), {});
      assert.deepEqual(normalizeAttributes(123), {});
    });

    test("generates correct attribute entries and formatted display string", () => {
      const input = { Color: "Black", Size: "XL" };
      const entries = getAttributeEntries(input);
      assert.equal(entries.length, 2);
      assert.deepEqual(entries, [
        { name: "Color", value: "Black" },
        { name: "Size", value: "XL" },
      ]);
      const str = formatAttributesString(input);
      assert.equal(str, "Color: Black, Size: XL");
    });
  });

  // 2. Combination Fingerprinting & Duplicate Detection
  describe("2. Combination Fingerprinting", () => {
    test("produces deterministic canonical fingerprints regardless of key ordering or casing", () => {
      const comboA = { Size: "M", Color: "Red" };
      const comboB = { color: "red", size: "m" };
      const fpA = getCombinationFingerprint(comboA);
      const fpB = getCombinationFingerprint(comboB);
      assert.equal(fpA, "color:red|size:m");
      assert.equal(fpB, "color:red|size:m");
      assert.equal(fpA, fpB);
    });

    test("distinguishes distinct combinations", () => {
      const comboA = { Size: "M", Color: "Red" };
      const comboB = { Size: "L", Color: "Red" };
      assert.notEqual(getCombinationFingerprint(comboA), getCombinationFingerprint(comboB));
    });
  });

  // 3. Cartesian Product Combination Generation
  describe("3. Cartesian Product Generation", () => {
    test("generates exact Cartesian product for 2 attributes", () => {
      const definitions = [
        { name: "Color", values: ["Red", "Blue"] },
        { name: "Size", values: ["S", "M", "L"] },
      ];
      const combos = generateCartesianCombinations(definitions);
      assert.equal(combos.length, 6);
      assert.deepEqual(combos[0], { Color: "Red", Size: "S" });
      assert.deepEqual(combos[1], { Color: "Red", Size: "M" });
      assert.deepEqual(combos[2], { Color: "Red", Size: "L" });
      assert.deepEqual(combos[3], { Color: "Blue", Size: "S" });
      assert.deepEqual(combos[4], { Color: "Blue", Size: "M" });
      assert.deepEqual(combos[5], { Color: "Blue", Size: "L" });
    });

    test("returns empty array when attributes have no values", () => {
      const definitions = [{ name: "Color", values: [] }];
      const combos = generateCartesianCombinations(definitions);
      assert.deepEqual(combos, []);
    });

    test("handles single attribute correctly", () => {
      const definitions = [{ name: "Size", values: ["S", "M", "L"] }];
      const combos = generateCartesianCombinations(definitions);
      assert.equal(combos.length, 3);
      assert.deepEqual(combos, [{ Size: "S" }, { Size: "M" }, { Size: "L" }]);
    });
  });

  // 4. Combination Estimation & Limit Safeguard
  describe("4. Combination Estimation & Limits", () => {
    test("calculates accurate combination count", () => {
      const definitions = [
        { name: "Color", values: ["Red", "Green", "Blue"] },
        { name: "Size", values: ["S", "M", "L", "XL"] },
      ];
      const { count, exceedsLimit } = estimateCombinationCount(definitions, 100);
      assert.equal(count, 12);
      assert.equal(exceedsLimit, false);
    });

    test("flags excessive combination batches (> 100 limit)", () => {
      const definitions = [
        { name: "Color", values: Array.from({ length: 11 }, (_, i) => `Color${i}`) },
        { name: "Size", values: Array.from({ length: 10 }, (_, i) => `Size${i}`) },
      ]; // 11 * 10 = 110 > 100
      const { count, exceedsLimit, maxLimit } = estimateCombinationCount(definitions, 100);
      assert.equal(count, 110);
      assert.equal(exceedsLimit, true);
      assert.equal(maxLimit, 100);
    });

    test("handles zero values cleanly", () => {
      const { count, exceedsLimit } = estimateCombinationCount([], 100);
      assert.equal(count, 0);
      assert.equal(exceedsLimit, false);
    });
  });

  // 5. SKU Suggestion Logic
  describe("5. SKU Suggestion Logic", () => {
    test("generates predictable uppercase variant SKU based on parent SKU and attributes", () => {
      const sku = suggestVariantSku("TSHIRT-CLASSIC", { Color: "Red", Size: "M" });
      assert.equal(sku, "TSHIRT-CLASSIC-RED-M");
    });

    test("handles special characters in attribute values", () => {
      const sku = suggestVariantSku("BOOTS-PRO", { Material: "100% Leather", Color: "Dark Gray" });
      assert.equal(sku, "BOOTS-PRO-100L-DARK");
    });

    test("falls back cleanly when combination has no values", () => {
      const sku = suggestVariantSku("PARENT-SKU", {});
      assert.equal(sku, "PARENT-SKU-VAR");
    });
  });

  // 6. Service API Methods Integrity
  describe("6. Service API Client Verification", () => {
    test("productService exposes bulk variant methods", () => {
      assert.equal(typeof productService.createBulkVariants, "function");
      assert.equal(typeof productService.updateBulkVariants, "function");
      assert.equal(typeof productService.getVariantAvailability, "function");
    });

    test("vendorService exposes variation management methods", () => {
      assert.equal(typeof vendorService.createBulkProductVariants, "function");
      assert.equal(typeof vendorService.updateBulkProductVariants, "function");
      assert.equal(typeof vendorService.getVariantAvailability, "function");
      assert.equal(typeof vendorService.getMyWarehouses, "function");
      assert.equal(typeof vendorService.adjustInventory, "function");
    });
  });
});
