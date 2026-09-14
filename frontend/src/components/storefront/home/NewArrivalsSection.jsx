"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { ProductCard } from "../ProductCard.jsx";
import { productService } from "../../../services/product.service.js";

export function NewArrivalsSection({
  initialProducts = [],
  wishlistVariantIds = [],
  onWishlistToggle,
  onAddToCart,
}) {
  const [products, setProducts] = useState(initialProducts);

  useEffect(() => {
    if (initialProducts.length > 0) return;

    let isMounted = true;
    productService
      .getProducts({ limit: 8, status: "active" })
      .then((res) => {
        if (!isMounted) return;
        const list = res?.data?.products || (Array.isArray(res?.data) ? res.data : []);
        setProducts(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!isMounted) return;
        setProducts([]);
      });

    return () => {
      isMounted = false;
    };
  }, [initialProducts]);

  if (products.length === 0) {
    return null;
  }

  return (
    <section aria-label="New Arrivals" className="py-6 sm:py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-emerald-50/70 p-5 sm:p-7 md:p-8 lg:p-9 shadow-xs border border-emerald-200/80 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-emerald-100">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-100 text-[#007A55] shadow-xs">
                <Sparkles className="size-5.5 text-[#007A55]" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                  New Arrivals
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                  Explore the latest additions to the Buybox hardware catalog
                </p>
              </div>
            </div>

            <Link
              href="/shop?sort=newest"
              className="flex items-center gap-1.5 text-xs font-bold text-[#007A55] hover:text-[#006346] bg-white hover:bg-slate-50 px-3.5 py-1.5 rounded-full border border-slate-200/80 transition-all shadow-xs"
            >
              <span>View All Newest</span>
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
      </div>
    </section>
  );
}

export default NewArrivalsSection;
