"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductCard } from "../ProductCard.jsx";

export function MoreFromCategory({
  products = [],
  categoryName = "This Category",
  categorySlug,
  wishlistVariantIds = [],
  onWishlistToggle,
  onAddToCart,
}) {
  if (!Array.isArray(products) || products.length === 0) {
    return null;
  }

  return (
    <section aria-label={`More products in ${categoryName}`} className="mt-16 sm:mt-20 border-t border-slate-200 pt-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#007A55]">
            Catalog Highlights
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
            More in {categoryName}
          </h2>
        </div>

        {categorySlug && (
          <Link
            href={`/category/${categorySlug}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#007A55] hover:text-[#006346] transition-colors"
          >
            <span>View All in {categoryName}</span>
            <ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 sm:gap-4 md:gap-5">
        {products.slice(0, 4).map((item) => {
          const id = item._id || item.id;
          const isWishlisted = Array.isArray(wishlistVariantIds) && wishlistVariantIds.includes(id);

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

export default MoreFromCategory;
