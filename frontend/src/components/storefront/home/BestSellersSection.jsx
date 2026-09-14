"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { TrendingUp, ArrowRight } from "lucide-react";
import { ProductCard } from "../ProductCard.jsx";
import { storefrontService } from "../../../services/storefront.service.js";

export function BestSellersSection({
  initialProducts = [],
  wishlistVariantIds = [],
  onWishlistToggle,
  onAddToCart,
}) {
  const [products, setProducts] = useState(initialProducts);
  const [title, setTitle] = useState("Best Sellers");
  const [subtitle, setSubtitle] = useState("Most popular products according to verified customer purchases");

  useEffect(() => {
    if (initialProducts.length > 0) return;

    let isMounted = true;
    async function loadBestSellers() {
      try {
        // Query active storefront sections for configured "best_sellers" section
        const sectionRes = await storefrontService.getSections().catch(() => null);
        const activeSections = sectionRes?.data || [];
        const bestSellerSec = activeSections.find(
          (s) => s.key === "best_sellers" || s.type === "best_sellers"
        );

        if (bestSellerSec && Array.isArray(bestSellerSec.productIds) && bestSellerSec.productIds.length > 0) {
          if (!isMounted) return;
          if (bestSellerSec.title) setTitle(bestSellerSec.title);
          if (bestSellerSec.subtitle) setSubtitle(bestSellerSec.subtitle);
          setProducts(bestSellerSec.productIds);
        } else {
          // Backend has no public sales ranking aggregation API endpoint;
          // Gracefully omit rather than inventing fake sales data
          if (!isMounted) return;
          setProducts([]);
        }
      } catch {
        if (!isMounted) return;
        setProducts([]);
      }
    }

    loadBestSellers();
    return () => {
      isMounted = false;
    };
  }, [initialProducts]);

  // Gracefully hide if no best sellers section configured in backend
  if (products.length === 0) {
    return null;
  }

  return (
    <section aria-label="Best Sellers" className="py-8 sm:py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-[#007A55]">
              <TrendingUp className="size-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                {title}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {subtitle}
              </p>
            </div>
          </div>

          <Link
            href="/shop"
            className="flex items-center gap-1.5 text-xs font-bold text-[#007A55] hover:text-[#006346] transition-colors"
          >
            <span>View All</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

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

export default BestSellersSection;
