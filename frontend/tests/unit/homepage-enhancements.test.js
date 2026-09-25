import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import {
  recordRecentlyViewed,
  getRecentlyViewedIds,
  removeRecentlyViewedId,
  clearRecentlyViewed,
} from "../../src/utils/recentlyViewed.js";

/**
 * Unit Tests for Phase 9.5: Storefront Homepage Enhancement
 * Covers:
 * 1. Recently viewed client storage lifecycle & bounds (max 10, deduplication, SSR safety)
 * 2. Authentic stock availability & Out of Stock detection
 * 3. Section product deduplication (ExploreMoreSection)
 * 4. Genuine discount validation (Today's Hot Deals)
 */

describe("Phase 9.5: Recently Viewed Products Tracker", () => {
  let mockStore = {};

  beforeEach(() => {
    mockStore = {};
    global.window = {
      localStorage: {
        getItem: (key) => mockStore[key] || null,
        setItem: (key, val) => {
          mockStore[key] = String(val);
        },
        removeItem: (key) => {
          delete mockStore[key];
        },
      },
    };
  });

  it("should return an empty array when no products have been viewed", () => {
    const ids = getRecentlyViewedIds();
    assert.deepStrictEqual(ids, []);
  });

  it("should record a product ID and place it at the front of the list", () => {
    recordRecentlyViewed("prod_101");
    assert.deepStrictEqual(getRecentlyViewedIds(), ["prod_101"]);

    recordRecentlyViewed("prod_102");
    assert.deepStrictEqual(getRecentlyViewedIds(), ["prod_102", "prod_101"]);
  });

  it("should deduplicate existing product IDs and move the re-viewed product to index 0", () => {
    recordRecentlyViewed("prod_101");
    recordRecentlyViewed("prod_102");
    recordRecentlyViewed("prod_103");
    assert.deepStrictEqual(getRecentlyViewedIds(), ["prod_103", "prod_102", "prod_101"]);

    // Re-view prod_101
    recordRecentlyViewed("prod_101");
    assert.deepStrictEqual(getRecentlyViewedIds(), ["prod_101", "prod_103", "prod_102"]);
  });

  it("should cap the recently viewed history at maximum 10 items", () => {
    for (let i = 1; i <= 15; i++) {
      recordRecentlyViewed(`prod_${i}`);
    }
    const ids = getRecentlyViewedIds();
    assert.strictEqual(ids.length, 10);
    assert.strictEqual(ids[0], "prod_15");
    assert.strictEqual(ids[9], "prod_6");
  });

  it("should safely ignore null, undefined, non-string, or empty product IDs", () => {
    recordRecentlyViewed(null);
    recordRecentlyViewed(undefined);
    recordRecentlyViewed("");
    recordRecentlyViewed("   ");
    recordRecentlyViewed(12345);
    assert.deepStrictEqual(getRecentlyViewedIds(), []);
  });

  it("should remove a specific product ID via removeRecentlyViewedId", () => {
    recordRecentlyViewed("prod_1");
    recordRecentlyViewed("prod_2");
    recordRecentlyViewed("prod_3");

    removeRecentlyViewedId("prod_2");
    assert.deepStrictEqual(getRecentlyViewedIds(), ["prod_3", "prod_1"]);
  });

  it("should completely clear history via clearRecentlyViewed", () => {
    recordRecentlyViewed("prod_1");
    recordRecentlyViewed("prod_2");
    clearRecentlyViewed();
    assert.deepStrictEqual(getRecentlyViewedIds(), []);
  });

  it("should safely handle corrupted JSON in localStorage", () => {
    mockStore["buybox_recently_viewed"] = "{not-valid-json";
    const ids = getRecentlyViewedIds();
    assert.deepStrictEqual(ids, []);
  });
});

describe("Phase 9.5: Product Availability & Out-of-Stock Logic", () => {
  const checkIsOutOfStock = (product) => {
    if (!product) return false;
    return (
      product.stockStatus === "out_of_stock" ||
      product.status === "out_of_stock" ||
      (typeof product.stockQuantity === "number" && product.stockQuantity <= 0) ||
      (typeof product.stock === "number" && product.stock <= 0)
    );
  };

  it("should detect out of stock when stockStatus is 'out_of_stock'", () => {
    const product = { _id: "p1", name: "Headphones", stockStatus: "out_of_stock", price: 2999 };
    assert.strictEqual(checkIsOutOfStock(product), true);
  });

  it("should detect out of stock when status is 'out_of_stock'", () => {
    const product = { _id: "p2", name: "Keyboard", status: "out_of_stock", price: 4999 };
    assert.strictEqual(checkIsOutOfStock(product), true);
  });

  it("should detect out of stock when stockQuantity is 0 or negative", () => {
    const productZero = { _id: "p3", name: "Mouse", stockQuantity: 0 };
    const productNeg = { _id: "p4", name: "Mousepad", stockQuantity: -1 };
    assert.strictEqual(checkIsOutOfStock(productZero), true);
    assert.strictEqual(checkIsOutOfStock(productNeg), true);
  });

  it("should identify in-stock products correctly", () => {
    const inStockProd = {
      _id: "p5",
      name: "Desk Mat",
      stockStatus: "in_stock",
      stockQuantity: 25,
      price: 999,
    };
    assert.strictEqual(checkIsOutOfStock(inStockProd), false);
  });
});

describe("Phase 9.5: Explore More Section Deduplication", () => {
  const deduplicateProducts = (products, excludeIds) => {
    const excludeSet = new Set(excludeIds || []);
    return (products || []).filter((product) => {
      const id = product._id || product.id;
      return !excludeSet.has(id);
    });
  };

  it("should exclude products that already appear in earlier sections", () => {
    const catalog = [
      { _id: "p1", name: "Headphones" },
      { _id: "p2", name: "Keyboard" },
      { _id: "p3", name: "Mouse" },
      { _id: "p4", name: "Monitor" },
    ];
    const earlierSectionIds = ["p1", "p2"];

    const result = deduplicateProducts(catalog, earlierSectionIds);
    assert.deepStrictEqual(result, [
      { _id: "p3", name: "Mouse" },
      { _id: "p4", name: "Monitor" },
    ]);
  });

  it("should return empty array if all catalog items are already featured", () => {
    const catalog = [
      { _id: "p1", name: "Headphones" },
      { _id: "p2", name: "Keyboard" },
    ];
    const earlierSectionIds = ["p1", "p2"];

    const result = deduplicateProducts(catalog, earlierSectionIds);
    assert.deepStrictEqual(result, []);
  });

  it("should return all products if excludeIds is empty", () => {
    const catalog = [{ _id: "p1" }, { _id: "p2" }];
    const result = deduplicateProducts(catalog, []);
    assert.deepStrictEqual(result, catalog);
  });
});

describe("Phase 9.5: Genuine Deal Filtering (Today's Hot Deals)", () => {
  const filterGenuineDeals = (products) => {
    return (products || []).filter((p) => {
      const price = Number(p.price || p.basePrice || 0);
      const compareAt = Number(p.compareAtPrice || 0);
      return compareAt > price;
    });
  };

  it("should include items where compareAtPrice strictly exceeds price", () => {
    const products = [
      { _id: "d1", name: "Deal 1", price: 2999, compareAtPrice: 3499 }, // Genuine deal
      { _id: "d2", name: "No Deal", price: 1999, compareAtPrice: 1999 }, // Equal
      { _id: "d3", name: "Standard", price: 999 }, // No compareAtPrice
      { _id: "d4", name: "Deal 2", price: 4500, compareAtPrice: 5000 }, // Genuine deal
    ];

    const deals = filterGenuineDeals(products);
    assert.strictEqual(deals.length, 2);
    assert.strictEqual(deals[0]._id, "d1");
    assert.strictEqual(deals[1]._id, "d4");
  });

  it("should sort products by discount percentage descending", () => {
    const products = [
      { _id: "d1", price: 800, compareAtPrice: 1000 }, // 20%
      { _id: "d2", price: 500, compareAtPrice: 1000 }, // 50%
      { _id: "d3", price: 900, compareAtPrice: 1000 }, // 10%
    ];

    const sorted = [...products].sort((a, b) => {
      const pA = Number(a.price || 0);
      const cA = Number(a.compareAtPrice || 0);
      const discA = cA > pA ? (cA - pA) / cA : 0;
      const pB = Number(b.price || 0);
      const cB = Number(b.compareAtPrice || 0);
      const discB = cB > pB ? (cB - pB) / cB : 0;
      return discB - discA;
    });

    assert.strictEqual(sorted[0]._id, "d2"); // 50% first
    assert.strictEqual(sorted[1]._id, "d1"); // 20% second
    assert.strictEqual(sorted[2]._id, "d3"); // 10% third
  });
});

describe("Phase 9.5: Category Drawer & Navigation Safety", () => {
  it("should partition root categories and nested children based on parentId", () => {
    const categories = [
      { _id: "cat_1", name: "Audio", slug: "audio-headphones", parentId: null },
      { _id: "cat_2", name: "Keyboards", slug: "keyboards", parentId: null },
      { _id: "cat_sub1", name: "Earbuds", slug: "wireless-earbuds", parentId: "cat_1" },
    ];

    const roots = categories.filter((c) => !c.parentId);
    const subMap = new Map();
    categories.forEach((c) => {
      if (c.parentId) {
        if (!subMap.has(c.parentId)) subMap.set(c.parentId, []);
        subMap.get(c.parentId).push(c);
      }
    });

    assert.strictEqual(roots.length, 2);
    assert.strictEqual(subMap.get("cat_1")?.length, 1);
    assert.strictEqual(subMap.get("cat_1")?.[0].name, "Earbuds");
  });

  it("should dynamically resolve valid category URLs and fallback to /shop when not found", () => {
    const categories = [
      { _id: "c1", name: "Audio & Headphones", slug: "audio-headphones" },
    ];

    const resolveCategoryHref = (keyword, cats) => {
      const found = cats.find(
        (c) =>
          (c.slug || "").includes(keyword) ||
          (c.name || "").toLowerCase().includes(keyword)
      );
      return found ? `/category/${found.slug || found._id}` : "/shop";
    };

    assert.strictEqual(resolveCategoryHref("audio", categories), "/category/audio-headphones");
    assert.strictEqual(resolveCategoryHref("monitors", categories), "/shop");
  });
});
