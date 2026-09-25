"use client";

import React, { useState, useEffect } from "react";
import { Clock, Trash2 } from "lucide-react";
import { ProductCard } from "../ProductCard.jsx";
import { getRecentlyViewedIds, clearRecentlyViewed } from "../../../utils/recentlyViewed.js";
import { productService } from "../../../services/product.service.js";

export function RecentlyViewedSection({
  currentProductId,
  wishlistVariantIds = [],
  onWishlistToggle,
  onAddToCart,
}) {
  const [products, setProducts] = useState([]);
  const [isCleared, setIsCleared] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadRecent() {
      const allIds = getRecentlyViewedIds();
      // Exclude current product ID
      const filteredIds = (allIds || []).filter(
        (id) => String(id) !== String(currentProductId)
      );

      if (filteredIds.length === 0) {
        if (isMounted) setProducts([]);
        return;
      }

      try {
        const topIds = filteredIds.slice(0, 6);
        const results = await Promise.allSettled(
          topIds.map((id) => productService.getProductById(id))
        );

        if (!isMounted) return;

        const loaded = results
          .filter((r) => r.status === "fulfilled" && r.value?.data)
          .map(
            (r) =>
              r.value.data?.product ||
              (r.value.data?._id ? r.value.data : null)
          )
          .filter(Boolean)
          .filter((p) => String(p._id || p.id) !== String(currentProductId));

        setProducts(loaded);
      } catch {
        if (isMounted) setProducts([]);
      }
    }

    loadRecent();

    return () => {
      isMounted = false;
    };
  }, [currentProductId]);

  const handleClear = () => {
    clearRecentlyViewed();
    setProducts([]);
    setIsCleared(true);
  };

  if (isCleared || products.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Recently Viewed Products"
      className="mt-14 sm:mt-18 border-t border-slate-200 pt-10"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#004D38]">
            <Clock className="size-3.5" />
            <span>Browsing History</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight mt-0.5">
            Recently Viewed
          </h2>
        </div>

        <button
          type="button"
          onClick={handleClear}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600 transition-colors cursor-pointer self-start sm:self-auto bg-slate-50 hover:bg-rose-50 px-3 py-1.5 rounded-full border border-slate-200 shadow-2xs"
          aria-label="Clear recently viewed history"
        >
          <Trash2 className="size-3.5" />
          <span>Clear History</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 sm:gap-4 md:gap-5">
        {products.map((item) => {
          const id = item._id || item.id;
          const isWishlisted =
            Array.isArray(wishlistVariantIds) && wishlistVariantIds.includes(id);

          return (
            <ProductCard
              key={id}
              product={item}
              isWishlisted={isWishlisted}
              onWishlistToggle={(val) => onWishlistToggle?.(item, val)}
              onAddToCart={() => onAddToCart?.(item)}
            />
          );
        })}
      </div>
    </section>
  );
}

export default RecentlyViewedSection;
