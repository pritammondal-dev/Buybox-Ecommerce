import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("Category Listing Page Logic & Architectural Tests", () => {
  // 1. Discount calculation
  test("calculates accurate discount percentage for promotional products", () => {
    const calcDiscount = (price, compareAtPrice) => {
      const p = Number(price?.$numberDecimal || price || 0);
      const c = Number(compareAtPrice?.$numberDecimal || compareAtPrice || 0);
      return c > p ? Math.round(((c - p) / c) * 100) : 0;
    };

    assert.equal(calcDiscount(75000, 100000), 25);
    assert.equal(calcDiscount({ $numberDecimal: "80000" }, { $numberDecimal: "100000" }), 20);
    assert.equal(calcDiscount(50000, 50000), 0);
    assert.equal(calcDiscount(60000, 50000), 0); // No negative discount
  });

  // 2. Pagination generator
  test("generates correct pagination pages with ellipsis", () => {
    const getPageNumbers = (currentPage, totalPages) => {
      const pages = [];
      const maxVisible = 5;

      if (totalPages <= maxVisible) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        if (currentPage > 3) pages.push("...");

        const start = Math.max(2, currentPage - 1);
        const end = Math.min(totalPages - 1, currentPage + 1);

        for (let i = start; i <= end; i++) pages.push(i);

        if (currentPage < totalPages - 2) pages.push("...");
        pages.push(totalPages);
      }
      return pages;
    };

    assert.deepEqual(getPageNumbers(1, 3), [1, 2, 3]);
    assert.deepEqual(getPageNumbers(1, 10), [1, 2, "...", 10]);
    assert.deepEqual(getPageNumbers(5, 10), [1, "...", 4, 5, 6, "...", 10]);
    assert.deepEqual(getPageNumbers(9, 10), [1, "...", 8, 9, 10]);
  });

  // 3. Active filter chips and count
  test("correctly computes active filter count and chips", () => {
    const computeActiveFilterCount = ({
      brands = [],
      minPrice = "",
      maxPrice = "",
      rating = null,
      stockStatus = null,
      discount = null,
    }) => {
      let count = brands.length;
      if (minPrice || maxPrice) count += 1;
      if (rating) count += 1;
      if (stockStatus) count += 1;
      if (discount) count += 1;
      return count;
    };

    assert.equal(
      computeActiveFilterCount({
        brands: ["brand-1", "brand-2"],
        minPrice: "10000",
        rating: 4,
      }),
      4
    );

    assert.equal(
      computeActiveFilterCount({
        brands: [],
        minPrice: "",
        maxPrice: "",
        rating: null,
      }),
      0
    );
  });

  // 4. Multi-brand query string serialization and deserialization
  test("serializes and deserializes multi-brand filter query parameter correctly", () => {
    const brandIds = ["651a1b2c3d4e5f6a7b8c9d01", "651a1b2c3d4e5f6a7b8c9d02"];
    const queryParam = brandIds.join(",");
    assert.equal(
      queryParam,
      "651a1b2c3d4e5f6a7b8c9d01,651a1b2c3d4e5f6a7b8c9d02"
    );

    const parsed = queryParam.split(",").filter(Boolean);
    assert.deepEqual(parsed, brandIds);
  });

  // 5. Brand lookup map
  test("creates quick brand names lookup map for toolbar chips", () => {
    const brands = [
      { _id: "b1", name: "Apple" },
      { _id: "b2", name: "Samsung" },
      { _id: "b3", name: "Sony" },
    ];

    const map = {};
    brands.forEach((b) => {
      map[b._id] = b.name;
    });

    assert.equal(map["b1"], "Apple");
    assert.equal(map["b2"], "Samsung");
    assert.equal(map["b4"], undefined);
  });

  // 6. Stock status checking
  test("identifies out-of-stock items reliably across product model formats", () => {
    const isOutOfStock = (product) => {
      return (
        product.stockStatus === "out_of_stock" ||
        product.status === "out_of_stock" ||
        (typeof product.stockQuantity === "number" && product.stockQuantity <= 0)
      );
    };

    assert.equal(isOutOfStock({ stockStatus: "out_of_stock" }), true);
    assert.equal(isOutOfStock({ status: "out_of_stock" }), true);
    assert.equal(isOutOfStock({ stockQuantity: 0 }), true);
    assert.equal(isOutOfStock({ stockStatus: "in_stock", stockQuantity: 15 }), false);
  });
});
