import { describe, it } from "node:test";
import assert from "node:assert";

/**
 * Unit Tests for Phase 9: Product Discovery, Search, Filtering, Sorting & URL Synchronization
 */

// Helper functions mirroring ShopCatalog logic
const isObjectId = (str) => typeof str === "string" && /^[0-9a-fA-F]{24}$/.test(str);

const resolveCategory = (identifier, categories) => {
  if (!identifier) return null;
  return categories.find(
    (c) => c._id === identifier || c.id === identifier || c.slug === identifier
  ) || null;
};

const buildProductQueryParams = ({ search, categoryId, brandId, page = 1, limit = 16, status = "active" }) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(Math.max(1, Number(limit) || 16), 100);

  const params = {
    page: safePage,
    limit: safeLimit,
    status,
  };

  if (search && search.trim()) {
    params.search = search.trim();
  }

  if (categoryId && isObjectId(categoryId)) {
    params.categoryId = categoryId;
  }

  if (brandId && isObjectId(brandId)) {
    params.brandId = brandId;
  }

  return params;
};

const updateQueryString = (currentSearchString, updates, resetPage = true) => {
  const params = new URLSearchParams(currentSearchString);

  Object.entries(updates).forEach(([key, val]) => {
    if (val === null || val === undefined || val === "") {
      params.delete(key);
    } else {
      params.set(key, String(val));
    }
  });

  if (resetPage && !("page" in updates)) {
    params.set("page", "1");
  }

  return params.toString();
};

const sortProducts = (products, sortType) => {
  const list = [...products];
  if (sortType === "price_asc") {
    return list.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  }
  if (sortType === "price_desc") {
    return list.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
  }
  if (sortType === "rating_desc") {
    return list.sort((a, b) => (b.ratingAverage || 0) - (a.ratingAverage || 0));
  }
  if (sortType === "featured") {
    return list.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
  }
  return list;
};

describe("Phase 9: Product Discovery & Search Architecture Tests", () => {
  it("validates MongoDB ObjectId correctly to prevent backend INVALID_RESOURCE_ID crashes", () => {
    assert.strictEqual(isObjectId("6a9925b23d7694ebc6be2e50"), true);
    assert.strictEqual(isObjectId("electronics"), false);
    assert.strictEqual(isObjectId("12345"), false);
    assert.strictEqual(isObjectId(null), false);
    assert.strictEqual(isObjectId(undefined), false);
  });

  it("resolves category slug to authentic MongoDB ObjectId", () => {
    const mockCategories = [
      { _id: "6a9925b23d7694ebc6be2e50", name: "Electronics", slug: "electronics" },
      { _id: "6a9925b23d7694ebc6be2e59", name: "Accessories", slug: "accessories" },
    ];

    const resolvedBySlug = resolveCategory("electronics", mockCategories);
    assert.ok(resolvedBySlug);
    assert.strictEqual(resolvedBySlug._id, "6a9925b23d7694ebc6be2e50");
    assert.strictEqual(resolvedBySlug.name, "Electronics");

    const resolvedById = resolveCategory("6a9925b23d7694ebc6be2e59", mockCategories);
    assert.ok(resolvedById);
    assert.strictEqual(resolvedById.slug, "accessories");

    const unmapped = resolveCategory("unknown-slug", mockCategories);
    assert.strictEqual(unmapped, null);
  });

  it("builds query parameters strictly conforming to backend GET /products contract", () => {
    const params = buildProductQueryParams({
      search: " headphones ",
      categoryId: "6a9925b23d7694ebc6be2e50",
      brandId: "6a9925c23d7694ebc6be2e51",
      page: 2,
      limit: 16,
    });

    assert.strictEqual(params.search, "headphones");
    assert.strictEqual(params.categoryId, "6a9925b23d7694ebc6be2e50");
    assert.strictEqual(params.brandId, "6a9925c23d7694ebc6be2e51");
    assert.strictEqual(params.page, 2);
    assert.strictEqual(params.limit, 16);
    assert.strictEqual(params.status, "active");
  });

  it("sanitizes invalid non-ObjectId category and brand before passing to backend", () => {
    const params = buildProductQueryParams({
      search: "smart",
      categoryId: "electronics", // non-ObjectId slug should NOT be passed raw as categoryId
      brandId: "buybox",
      page: -5,
      limit: 500,
    });

    assert.strictEqual(params.search, "smart");
    assert.strictEqual(params.categoryId, undefined);
    assert.strictEqual(params.brandId, undefined);
    assert.strictEqual(params.page, 1); // clamped
    assert.strictEqual(params.limit, 100); // clamped to max 100
  });

  it("synchronizes URL query strings and resets page on filter changes", () => {
    const initialQs = "category=electronics&page=3";

    // Adding brand should update brand and reset page to 1
    const updatedWithBrand = updateQueryString(initialQs, { brand: "buybox" }, true);
    assert.strictEqual(updatedWithBrand, "category=electronics&page=1&brand=buybox");

    // Removing category should delete category and reset page to 1
    const updatedWithoutCat = updateQueryString(updatedWithBrand, { category: null }, true);
    assert.strictEqual(updatedWithoutCat, "page=1&brand=buybox");

    // Changing page only should not reset page to 1
    const updatedPage = updateQueryString(updatedWithoutCat, { page: 2 }, false);
    assert.strictEqual(updatedPage, "page=2&brand=buybox");
  });

  it("sorts product catalog items accurately based on price, rating, and featured flag", () => {
    const mockProducts = [
      { id: "1", name: "A", price: 500, ratingAverage: 4.2, isFeatured: false },
      { id: "2", name: "B", price: 1500, ratingAverage: 4.8, isFeatured: true },
      { id: "3", name: "C", price: 200, ratingAverage: 3.5, isFeatured: false },
    ];

    const priceAsc = sortProducts(mockProducts, "price_asc");
    assert.strictEqual(priceAsc[0].id, "3"); // 200
    assert.strictEqual(priceAsc[1].id, "1"); // 500
    assert.strictEqual(priceAsc[2].id, "2"); // 1500

    const priceDesc = sortProducts(mockProducts, "price_desc");
    assert.strictEqual(priceDesc[0].id, "2"); // 1500
    assert.strictEqual(priceDesc[2].id, "3"); // 200

    const ratingDesc = sortProducts(mockProducts, "rating_desc");
    assert.strictEqual(ratingDesc[0].id, "2"); // 4.8
    assert.strictEqual(ratingDesc[1].id, "1"); // 4.2
    assert.strictEqual(ratingDesc[2].id, "3"); // 3.5

    const featuredFirst = sortProducts(mockProducts, "featured");
    assert.strictEqual(featuredFirst[0].id, "2"); // isFeatured: true
  });
});
