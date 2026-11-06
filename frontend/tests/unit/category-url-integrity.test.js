import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  getCategorySlug,
  getCategoryHref,
  getCategoryId,
  getBrandId,
} from "../../src/utils/category.util.js";

describe("Category URL & Slug Integrity Tests", () => {
  // 1. Slug Resolution with valid strings
  test("getCategorySlug returns clean string when passed a valid string", () => {
    assert.equal(getCategorySlug("electronics"), "electronics");
    assert.equal(getCategorySlug(" audio-headphones "), "audio-headphones");
    assert.equal(getCategorySlug("gaming-accessories"), "gaming-accessories");
  });

  // 2. Slug Resolution with populated Mongoose category objects
  test("getCategorySlug safely extracts slug from category objects", () => {
    const populatedCat = {
      _id: "662f1a9b8c3d4e0012345678",
      name: "Wireless Earbuds",
      slug: "wireless-earbuds",
      isActive: true,
    };
    assert.equal(getCategorySlug(populatedCat), "wireless-earbuds");
  });

  // 3. Fallback to ID string when slug is missing from object
  test("getCategorySlug falls back to _id or id string when slug is absent", () => {
    assert.equal(
      getCategorySlug({ _id: "662f1a9b8c3d4e0012345678", name: "Gadgets" }),
      "662f1a9b8c3d4e0012345678"
    );
    assert.equal(
      getCategorySlug({ id: "category-uuid-1234", name: "Gadgets" }),
      "category-uuid-1234"
    );
  });

  // 4. Strict rejection of [object Object] strings and invalid objects
  test("getCategorySlug rejects [object Object], empty objects, and unresolvable inputs", () => {
    assert.equal(getCategorySlug("[object Object]"), null);
    assert.equal(getCategorySlug("[object Array]"), null);
    assert.equal(getCategorySlug({}), null);
    assert.equal(getCategorySlug({ slug: "" }), null);
    assert.equal(getCategorySlug({ slug: "   " }), null);
    assert.equal(getCategorySlug({ slug: "[object Object]" }), null);
    assert.equal(getCategorySlug(null), null);
    assert.equal(getCategorySlug(undefined), null);
    assert.equal(getCategorySlug(12345), null);
    assert.equal(getCategorySlug({ _id: {} }), null);
  });

  // 5. Safe Href Generation
  test("getCategoryHref produces valid category routes and safe fallbacks", () => {
    assert.equal(getCategoryHref("audio"), "/category/audio");
    assert.equal(
      getCategoryHref({ slug: "smart-home" }),
      "/category/smart-home"
    );
    assert.equal(
      getCategoryHref({ _id: "662f1a9b8c3d4e0012345678" }),
      "/category/662f1a9b8c3d4e0012345678"
    );

    // Fallback to /shop on invalid or missing categories
    assert.equal(getCategoryHref(null), "/shop");
    assert.equal(getCategoryHref(undefined), "/shop");
    assert.equal(getCategoryHref({}), "/shop");
    assert.equal(getCategoryHref("[object Object]"), "/shop");
    assert.equal(getCategoryHref({}, "/categories"), "/categories");
  });

  // 6. Category ID extraction
  test("getCategoryId extracts clean string IDs from strings or populated objects", () => {
    assert.equal(getCategoryId("662f1a9b8c3d4e0012345678"), "662f1a9b8c3d4e0012345678");
    assert.equal(
      getCategoryId({ _id: "662f1a9b8c3d4e0012345678", name: "Audio" }),
      "662f1a9b8c3d4e0012345678"
    );
    assert.equal(
      getCategoryId({ id: "662f1a9b8c3d4e0012345678", name: "Audio" }),
      "662f1a9b8c3d4e0012345678"
    );
    assert.equal(getCategoryId("[object Object]"), null);
    assert.equal(getCategoryId(null), null);
    assert.equal(getCategoryId({}), null);
  });

  // 7. Brand ID extraction
  test("getBrandId extracts clean string IDs from strings or populated objects", () => {
    assert.equal(getBrandId("brand-1234"), "brand-1234");
    assert.equal(
      getBrandId({ _id: "662f1a9b8c3d4e0012345678", name: "Sony" }),
      "662f1a9b8c3d4e0012345678"
    );
    assert.equal(
      getBrandId({ id: "brand-uuid", name: "Apple" }),
      "brand-uuid"
    );
    assert.equal(getBrandId("[object Object]"), null);
    assert.equal(getBrandId(null), null);
    assert.equal(getBrandId({}), null);
  });

  // 8. Product Detail Page category & brand resolution simulation
  test("ProductDetailPage resolution does not pass [object Object] to services", () => {
    const mockPopulatedProduct = {
      _id: "prod-999",
      name: "Sony WH-1000XM5",
      categoryId: {
        _id: "cat-audio-01",
        name: "Audio & Headphones",
        slug: "audio-headphones",
        isActive: true,
      },
      brandId: {
        _id: "brand-sony-01",
        name: "Sony",
        slug: "sony",
        logo: "https://example.com/sony.png",
        isActive: true,
      },
    };

    const resolvedCategoryId = getCategoryId(
      mockPopulatedProduct.categoryId || mockPopulatedProduct.category
    );
    const resolvedBrandId = getBrandId(
      mockPopulatedProduct.brandId || mockPopulatedProduct.brand
    );

    // Assert string IDs are extracted without [object Object]
    assert.equal(resolvedCategoryId, "cat-audio-01");
    assert.equal(resolvedBrandId, "brand-sony-01");

    // Assert category slug for MoreFromCategory / Breadcrumbs
    const resolvedSlug = getCategorySlug(mockPopulatedProduct.categoryId);
    assert.equal(resolvedSlug, "audio-headphones");

    const categoryHref = getCategoryHref(mockPopulatedProduct.categoryId);
    assert.equal(categoryHref, "/category/audio-headphones");
    assert.ok(!categoryHref.includes("[object Object]"));
  });
});

