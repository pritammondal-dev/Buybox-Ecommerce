"use client";

import React, { useState, useEffect } from "react";
import { Clock, Trash2 } from "lucide-react";
import { SectionContainer } from "./SectionContainer.jsx";
import { ProductCarousel } from "../ProductCarousel.jsx";
import { getRecentlyViewedIds, clearRecentlyViewed } from "../../../utils/recentlyViewed.js";
import { productService } from "../../../services/product.service.js";

export function RecentlyViewedSection({
  initialProducts = [],
  wishlistVariantIds = [],
  onWishlistToggle,
  onAddToCart,
}) {
  const [products, setProducts] = useState(initialProducts);
  const [isCleared, setIsCleared] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchRecentlyViewed() {
      const ids = getRecentlyViewedIds();
      if (!ids || ids.length === 0) {
        if (isMounted && initialProducts.length > 0) {
          setProducts(initialProducts);
        }
        return;
      }

      try {
        const topIds = ids.slice(0, 10);
        const results = await Promise.allSettled(
          topIds.map((id) => productService.getProductById(id))
        );

        if (!isMounted) return;

        const loadedProducts = results
          .filter((r) => r.status === "fulfilled" && r.value?.data)
          .map((r) => r.value.data?.product || (r.value.data?._id ? r.value.data : null))
          .filter(Boolean);

        if (loadedProducts.length > 0) {
          setProducts(loadedProducts);
        } else if (initialProducts.length > 0) {
          setProducts(initialProducts);
        }
      } catch {
        if (!isMounted && initialProducts.length > 0) {
          setProducts(initialProducts);
        }
      }
    }

    fetchRecentlyViewed();

    return () => {
      isMounted = false;
    };
  }, [initialProducts]);

  const handleClear = () => {
    clearRecentlyViewed();
    setProducts([]);
    setIsCleared(true);
  };

  if (isCleared || products.length === 0) {
    return null;
  }

  const clearButton = (
    <button
      type="button"
      suppressHydrationWarning
      onClick={handleClear}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600 transition-colors cursor-pointer bg-white px-3 py-1 rounded-full border border-slate-200 shadow-2xs"
      aria-label="Clear recently viewed history"
    >
      <Trash2 className="size-3.5" />
      <span>Clear History</span>
    </button>
  );

  return (
    <SectionContainer
      title="Recently Viewed"
      subtitle="Your recently viewed products are shown here."
      badge="HISTORY"
      badgeColor="bg-purple-600 text-white"
      icon={Clock}
      iconBg="bg-violet-200 text-violet-800"
      variant="recent"
      headerRight={clearButton}
      ariaLabel="Recently Viewed Products"
    >
      <ProductCarousel
        products={products}
        wishlistVariantIds={wishlistVariantIds}
        onWishlistToggle={onWishlistToggle}
        onAddToCart={onAddToCart}
      />
    </SectionContainer>
  );
}

export default RecentlyViewedSection;
