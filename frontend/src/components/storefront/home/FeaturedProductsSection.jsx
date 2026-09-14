"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { ProductCard } from "../ProductCard.jsx";
import { storefrontService } from "../../../services/storefront.service.js";
import { productService } from "../../../services/product.service.js";

export function FeaturedProductsSection({
  initialProducts = [],
  wishlistVariantIds = [],
  onWishlistToggle,
  onAddToCart,
}) {
  const [products, setProducts] = useState(initialProducts);
  const [title, setTitle] = useState("Featured Products");
  const [subtitle, setSubtitle] = useState("Handpicked recommendations and highlighted hardware");

  useEffect(() => {
    if (initialProducts.length > 0) return;

    let isMounted = true;
    async function loadFeatured() {
      try {
        // 1. Try active storefront sections from CMS
        const sectionRes = await storefrontService.getSections().catch(() => null);
        const activeSections = sectionRes?.data || [];
        const featuredSec = activeSections.find(
          (s) => s.key === "featured_products" || s.type === "featured_products"
        );

        if (featuredSec && Array.isArray(featuredSec.productIds) && featuredSec.productIds.length > 0) {
          if (!isMounted) return;
          if (featuredSec.title) setTitle(featuredSec.title);
          if (featuredSec.subtitle) setSubtitle(featuredSec.subtitle);
          setProducts(featuredSec.productIds);
          return;
        }

        // 2. Fallback to products query
        const prodRes = await productService.getProducts({ limit: 8, status: "active" });
        if (!isMounted) return;
        const list = prodRes?.data?.products || (Array.isArray(prodRes?.data) ? prodRes.data : []);
        // Prioritize isFeatured if flag exists
        const featuredOnly = list.filter((p) => p.isFeatured);
        setProducts(featuredOnly.length > 0 ? featuredOnly : list);
      } catch {
        if (!isMounted) return;
        setProducts([]);
      }
    }

    loadFeatured();
    return () => {
      isMounted = false;
    };
  }, [initialProducts]);

  if (products.length === 0) {
    return null;
  }

  return (
    <section aria-label="Featured Products" className="py-6 sm:py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-amber-50/70 p-5 sm:p-7 md:p-8 lg:p-9 shadow-xs border border-amber-200/80 overflow-hidden">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-amber-200/60">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 shadow-xs">
                <Sparkles className="size-5.5 fill-amber-400 text-amber-600" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                  {title}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                  {subtitle}
                </p>
              </div>
            </div>

            <Link
              href="/shop"
              className="flex items-center gap-1.5 text-xs font-bold text-[#007A55] hover:text-[#006346] bg-white hover:bg-slate-50 px-3.5 py-1.5 rounded-full border border-slate-200/80 transition-all shadow-xs"
            >
              <span>View All Featured</span>
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
      </div>
    </section>
  );
}

export default FeaturedProductsSection;
