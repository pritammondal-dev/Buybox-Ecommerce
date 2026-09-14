"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Compass, ArrowRight } from "lucide-react";
import { ProductCard } from "../ProductCard.jsx";
import { productService } from "../../../services/product.service.js";

/**
 * ExploreMoreSection
 * Additional product discovery section positioned after all special homepage sections.
 * Automatically deduplicates products against items already shown in earlier sections.
 */
export function ExploreMoreSection({
  excludeIds = [],
  initialProducts = [],
  wishlistVariantIds = [],
  onWishlistToggle,
  onAddToCart,
}) {
  const deduplicatedInitial = React.useMemo(() => {
    if (Array.isArray(initialProducts) && initialProducts.length > 0) {
      const excludeSet = new Set(excludeIds || []);
      return initialProducts.filter((p) => !excludeSet.has(p._id || p.id));
    }
    return null;
  }, [initialProducts, excludeIds]);

  const [fetchedProducts, setFetchedProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(() => deduplicatedInitial === null);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (deduplicatedInitial !== null) {
      return;
    }

    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    let isMounted = true;

    async function loadExploreProducts() {
      try {
        const res = await productService.getProducts({ limit: 12, status: "active" });
        const pool = res?.data?.products || (Array.isArray(res?.data) ? res.data : []);

        if (!isMounted) return;

        const excludeSet = new Set(excludeIds || []);
        const deduplicated = pool.filter((product) => {
          const id = product._id || product.id;
          return !excludeSet.has(id);
        });

        setFetchedProducts(deduplicated);
      } catch {
        if (!isMounted) return;
        setFetchedProducts([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadExploreProducts();

    return () => {
      isMounted = false;
    };
  }, [deduplicatedInitial, excludeIds]);

  const products = deduplicatedInitial !== null ? deduplicatedInitial : fetchedProducts;

  // If no unseen products remain after deduplication, cleanly hide section
  if (!isLoading && products.length === 0) {
    return null;
  }

  if (isLoading && products.length === 0) {
    return null;
  }

  return (
    <section aria-label="Explore More Products" className="py-8 sm:py-12 bg-white border-t border-slate-100/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Compass className="size-5 text-slate-700" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                Explore More Products
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Discover more genuine audio hardware, mechanical keyboards & everyday gear
              </p>
            </div>
          </div>

          <Link
            href="/shop"
            className="flex items-center gap-1.5 text-xs font-bold text-[#007A55] hover:text-[#006346] transition-colors"
          >
            <span>Browse Full Catalog</span>
            <ArrowRight className="size-3.5" />
          </Link>
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

export default ExploreMoreSection;
