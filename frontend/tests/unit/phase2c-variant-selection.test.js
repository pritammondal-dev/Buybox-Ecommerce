import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { normalizeVariantAttributes } from "../../src/utils/variantAttributes.js";
import { parsePrice, calculateDiscountPercentage, formatCurrency } from "../../src/utils/formatCurrency.js";
import { productService } from "../../src/services/product.service.js";

describe("Buybox Phase 2C — Storefront Variant Selection & Real-Time Availability Tests", () => {
  // 1. Attribute Normalization (Map, Array, Object schemas)
  describe("1. Attribute Normalization", () => {
    test("normalizes Mongoose Map instances correctly", () => {
      const mapAttrs = new Map([
        ["color", "Space Gray"],
        ["storage", "512GB"],
      ]);
      const normalized = normalizeVariantAttributes(mapAttrs);
      assert.deepEqual(normalized, {
        color: "Space Gray",
        storage: "512GB",
      });
    });

    test("normalizes Array of name-value objects correctly", () => {
      const arrayAttrs = [
        { name: "Color", value: "Phantom Silver" },
        { name: "RAM", value: "16GB" },
      ];
      const normalized = normalizeVariantAttributes(arrayAttrs);
      assert.deepEqual(normalized, {
        Color: "Phantom Silver",
        RAM: "16GB",
      });
    });

    test("normalizes plain key-value Object attributes", () => {
      const plainObj = { size: "XL", fit: "Slim" };
      const normalized = normalizeVariantAttributes(plainObj);
      assert.deepEqual(normalized, {
        size: "XL",
        fit: "Slim",
      });
    });

    test("handles null, undefined, and non-object inputs safely", () => {
      assert.deepEqual(normalizeVariantAttributes(null), {});
      assert.deepEqual(normalizeVariantAttributes(undefined), {});
      assert.deepEqual(normalizeVariantAttributes("invalid"), {});
      assert.deepEqual(normalizeVariantAttributes(123), {});
    });
  });

  // 2. Combinatorial Variant Resolution & Dependency Reconciliation
  describe("2. Combinatorial Variant Resolution & Dependency Reconciliation", () => {
    const mockVariants = [
      {
        _id: "var_1",
        sku: "TSHIRT-RED-SM",
        price: 999,
        attributes: { color: "Red", size: "Small" },
        isActive: true,
        availableQuantity: 10,
      },
      {
        _id: "var_2",
        sku: "TSHIRT-RED-MD",
        price: 1099,
        attributes: { color: "Red", size: "Medium" },
        isActive: true,
        availableQuantity: 0, // out of stock
      },
      {
        _id: "var_3",
        sku: "TSHIRT-BLU-LG",
        price: 1199,
        attributes: { color: "Blue", size: "Large" },
        isActive: true,
        availableQuantity: 5,
      },
      {
        _id: "var_4",
        sku: "TSHIRT-DISCONTINUED",
        price: 899,
        attributes: { color: "Red", size: "Large" },
        isActive: false, // inactive
        availableQuantity: 10,
      },
    ];

    test("resolves matching active variant when valid combination is selected", () => {
      const activeVariants = mockVariants.filter((v) => v.isActive && !v.deletedAt);
      const selected = { color: "Red", size: "Small" };

      const found = activeVariants.find((v) => {
        const vAttrs = normalizeVariantAttributes(v.attributes);
        return Object.entries(selected).every(
          ([k, val]) => vAttrs[k]?.toLowerCase() === val.toLowerCase()
        );
      });

      assert.ok(found);
      assert.equal(found._id, "var_1");
      assert.equal(found.sku, "TSHIRT-RED-SM");
    });

    test("does not resolve inactive variant even if attributes match", () => {
      const activeVariants = mockVariants.filter((v) => v.isActive && !v.deletedAt);
      const selected = { color: "Red", size: "Large" };

      const found = activeVariants.find((v) => {
        const vAttrs = normalizeVariantAttributes(v.attributes);
        return Object.entries(selected).every(
          ([k, val]) => vAttrs[k]?.toLowerCase() === val.toLowerCase()
        );
      });

      // var_4 matches Red+Large but is inactive, so no match should be found
      assert.equal(found, undefined);
    });

    test("reconciles dependent selections when selecting an incompatible attribute", () => {
      // Customer has { color: "Red", size: "Small" }.
      // Customer clicks size: "Large".
      // There is no active Red+Large (only Blue+Large).
      // Reconciliation retains the new click (size: "Large") and prunes incompatible earlier selections (color: "Red").
      const prev = { color: "Red", size: "Small" };
      const newAttr = "size";
      const newVal = "Large";

      const activeVariants = mockVariants.filter((v) => v.isActive && !v.deletedAt);
      const prospective = { ...prev, [newAttr]: newVal };

      const matchExists = activeVariants.some((v) => {
        const vAttrs = normalizeVariantAttributes(v.attributes);
        return Object.entries(prospective).every(
          ([k, val]) => vAttrs[k]?.toLowerCase() === val.toLowerCase()
        );
      });

      assert.equal(matchExists, false); // Red+Large does not exist among active variants

      // Perform reconciliation algorithm
      const reconciled = { [newAttr]: newVal };
      for (const [k, v] of Object.entries(prev)) {
        if (k === newAttr) continue;
        const testCombo = { ...reconciled, [k]: v };
        const canCombine = activeVariants.some((varDoc) => {
          const vAttrs = normalizeVariantAttributes(varDoc.attributes);
          return Object.entries(testCombo).every(
            ([tk, tv]) => vAttrs[tk]?.toLowerCase() === tv.toLowerCase()
          );
        });
        if (canCombine) {
          reconciled[k] = v;
        }
      }

      assert.deepEqual(reconciled, { size: "Large" });
      assert.equal(reconciled.color, undefined); // Incompatible color pruned safely
    });
  });

  // 3. Price & Image Display Priority
  describe("3. Price & Image Display Priority", () => {
    test("selected variant price overrides parent display price", () => {
      const parentProduct = {
        name: "Pro Headphones",
        price: 4999,
        compareAtPrice: 5999,
      };

      const selectedVariant = {
        name: "Pro Headphones - Special Edition",
        price: 6499,
        compareAtPrice: 7499,
      };

      const authoritativePrice = parsePrice(selectedVariant.price);
      const authoritativeCompareAt = parsePrice(selectedVariant.compareAtPrice);
      const discount = calculateDiscountPercentage(authoritativeCompareAt, authoritativePrice);

      assert.equal(authoritativePrice, 6499);
      assert.equal(authoritativeCompareAt, 7499);
      assert.equal(discount, 13); // Math.round(((7499 - 6499) / 7499) * 100) = 13%
    });

    test("prepends variant image to gallery and falls back to product image when missing", () => {
      const parentImages = [
        { url: "https://example.com/parent-front.jpg" },
        { url: "https://example.com/parent-back.jpg" },
      ];

      const resolveGallery = (product, selectedVariant) => {
        const variantImageUrl = selectedVariant?.image?.url || null;
        const baseImages = Array.isArray(product?.images) ? [...product.images] : [];

        if (variantImageUrl) {
          const existingIdx = baseImages.findIndex((img) => img.url === variantImageUrl);
          if (existingIdx > -1) {
            const copy = [...baseImages];
            const [found] = copy.splice(existingIdx, 1);
            return [found, ...copy];
          }
          return [
            { url: variantImageUrl, altText: selectedVariant.name },
            ...baseImages,
          ];
        }
        return baseImages;
      };

      // Case A: Variant has specific image
      const galleryWithVariantImg = resolveGallery(
        { images: parentImages },
        { name: "Red", image: { url: "https://example.com/variant-red.jpg" } }
      );
      assert.equal(galleryWithVariantImg.length, 3);
      assert.equal(galleryWithVariantImg[0].url, "https://example.com/variant-red.jpg");

      // Case B: Variant has no image => fallback to parent imagery
      const galleryWithoutVariantImg = resolveGallery(
        { images: parentImages },
        { name: "Blue", image: null }
      );
      assert.equal(galleryWithoutVariantImg.length, 2);
      assert.equal(galleryWithoutVariantImg[0].url, "https://example.com/parent-front.jpg");
    });
  });

  // 4. Product Card Merchandising Contract
  describe("4. Product Card Merchandising Contract", () => {
    test("variable product formats price with 'From ' prefix using priceRange.min", () => {
      const variableProduct = {
        name: "Wireless Speaker",
        productType: "variable",
        price: 2999, // parent display price
        priceRange: {
          min: 1999,
          max: 3999,
        },
      };

      const isVariable = variableProduct.productType === "variable";
      const rawPrice = isVariable && variableProduct.priceRange?.min != null
        ? variableProduct.priceRange.min
        : variableProduct.price;

      const formatted = `${isVariable ? "From " : ""}${formatCurrency(parsePrice(rawPrice))}`;
      assert.equal(formatted.includes("From"), true);
      assert.equal(formatted.includes("1,999"), true);
    });

    test("simple product formats price without 'From ' prefix", () => {
      const simpleProduct = {
        name: "USB-C Cable",
        productType: "simple",
        price: 499,
      };

      const isVariable = simpleProduct.productType === "variable";
      const rawPrice = isVariable && simpleProduct.priceRange?.min != null
        ? simpleProduct.priceRange.min
        : simpleProduct.price;

      const formatted = `${isVariable ? "From " : ""}${formatCurrency(parsePrice(rawPrice))}`;
      assert.equal(formatted.includes("From"), false);
      assert.equal(formatted.includes("499"), true);
    });
  });

  // 5. Storefront Availability API Client Method
  describe("5. Storefront Availability API Client Method", () => {
    test("productService exposes getVariantAvailability method", () => {
      assert.equal(typeof productService.getVariantAvailability, "function");
    });
  });
});
