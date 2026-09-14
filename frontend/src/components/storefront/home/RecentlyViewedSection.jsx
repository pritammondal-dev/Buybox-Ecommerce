"use client";

import React, { useState, useEffect } from "react";
import { History, Trash2 } from "lucide-react";
import { ProductCard } from "../ProductCard.jsx";
import { getRecentlyViewedIds, clearRecentlyViewed } from "../../../utils/recentlyViewed.js";
import { productService } from "../../../services/product.service.js";

/**
 * RecentlyViewedSection
 * Displays products the customer recently viewed (stored in localStorage).
 * Automatically fetches real product data from the backend by ID.
 * Gracefully renders null if no products have been viewed yet.
 */
export function RecentlyViewedSection({
  wishlistVariantIds = [],
  onWishlistToggle,
  onAddToCart,
}) {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchRecentlyViewed() {
      const ids = getRecentlyViewedIds();
      if (!ids || ids.length === 0) {
        if (isMounted) setIsLoading(false);
        return;
      }

      try {
        // Fetch up to 8 recently viewed products in parallel
        const topIds = ids.slice(0, 8);
        const results = await Promise.allSettled(
          topIds.map((id) => productService.getProductById(id))
        );

        if (!isMounted) return;

        const loadedProducts = results
          .filter((r) => r.status === "fulfilled" && r.value?.data)
          .map((r) => r.value.data?.product || (r.value.data?._id ? r.value.data : null))
          .filter(Boolean);

        setProducts(loadedProducts);
      } catch {
        if (isMounted) setProducts([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchRecentlyViewed();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleClear = () => {
    clearRecentlyViewed();
    setProducts([]);
  };

  // Gracefully hide if no recently viewed products exist
  if (!isLoading && products.length === 0) {
    return null;
  }

  if (isLoading && products.length === 0) {
    return null;
  }

  return (
    <section aria-label="Recently Viewed Products" className="py-8 sm:py-12 bg-stone-50/60 border-y border-stone-200/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-stone-200/80">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-stone-200/70 text-stone-700">
              <History className="size-5 text-stone-700" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                Recently Viewed
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Hardware & peripherals you recently explored
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600 transition-colors cursor-pointer self-start sm:self-auto"
            aria-label="Clear recently viewed history"
          >
            <Trash2 className="size-3.5" />
            <span>Clear History</span>
          </button>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 pt-6">
          {products.map((product) => {
            const id = product.id || product._id;
            const isWishlisted = Array.isArray(wishlistVariantIds) && wishlistVariantIds.includes(id);

            return (
              <ProductCard
                key={id}
                product={product}
                isWishlisted={isWishlisted}
                onWishlistToggle={(val) => onWishlistToggle?.(product, val)}
                onAddToCart={() => onAddToCart?.(product)}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default RecentlyViewedSection;
