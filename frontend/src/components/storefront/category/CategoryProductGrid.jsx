"use client";

import React from "react";
import { AlertCircle, FilterX, RotateCcw } from "lucide-react";
import { CategoryProductCard } from "./CategoryProductCard.jsx";
import { cn } from "../../../utils/cn.js";

function ProductCardSkeleton() {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 h-full animate-pulse">
      <div>
        {/* Image Skeleton */}
        <div className="relative mb-3 flex h-44 sm:h-52 w-full items-center justify-center rounded-xl bg-slate-100" />

        {/* Brand & Stock */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="h-3 w-16 bg-slate-200 rounded" />
          <div className="h-3 w-12 bg-slate-100 rounded" />
        </div>

        {/* Title */}
        <div className="space-y-1.5 mb-2.5">
          <div className="h-4 w-full bg-slate-200 rounded" />
          <div className="h-4 w-3/4 bg-slate-200 rounded" />
        </div>

        {/* Rating */}
        <div className="flex items-center gap-1.5 mb-3">
          <div className="h-3.5 w-20 bg-slate-100 rounded" />
          <div className="h-3 w-10 bg-slate-100 rounded" />
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-2">
          <div className="h-5 w-24 bg-slate-200 rounded" />
          <div className="h-3.5 w-16 bg-slate-100 rounded" />
        </div>
      </div>

      {/* Button Skeleton */}
      <div className="mt-3.5 pt-2 border-t border-slate-100">
        <div className="h-9 w-full bg-slate-200 rounded-full" />
      </div>
    </div>
  );
}

export function CategoryProductGrid({
  products = [],
  isLoading = false,
  isError = false,
  errorMessage = "Unable to load products. Please check your connection and try again.",
  onRetry,
  onClearFilters,
  wishlistIds = new Set(),
  onWishlistToggle,
  onAddToCart,
  addingCartId = null,
  skeletonCount = 6,
  className,
}) {
  if (isLoading) {
    return (
      <div
        className={cn(
          "grid grid-cols-2 gap-2.5 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:gap-5",
          className
        )}
      >
        {Array.from({ length: skeletonCount }).map((_, idx) => (
          <ProductCardSkeleton key={`product-skeleton-${idx}`} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-red-100 bg-red-50/50 p-8 text-center sm:p-12">
        <div className="flex size-12 items-center justify-center rounded-full bg-red-100 text-red-600 mb-3">
          <AlertCircle className="size-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900 mb-1">
          Something went wrong
        </h3>
        <p className="text-sm text-slate-600 max-w-md mb-4">{errorMessage}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 active:scale-95 transition-all"
          >
            <RotateCcw className="size-3.5" />
            Try Again
          </button>
        )}
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center sm:p-14">
        <div className="flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-500 mb-3">
          <FilterX className="size-7 stroke-[1.75]" />
        </div>
        <h3 className="text-base font-bold text-slate-900 mb-1">
          No products found
        </h3>
        <p className="text-sm text-slate-500 max-w-sm mb-5">
          We couldn&apos;t find any items matching your selected filters. Try
          broadening your criteria.
        </p>
        {onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex items-center gap-2 rounded-full bg-[#004D38] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#003B2B] active:scale-95 transition-all"
          >
            <RotateCcw className="size-3.5" />
            Reset All Filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-2.5 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:gap-5",
        className
      )}
    >
      {products.map((product) => {
        const id = product._id || product.id;
        const isWishlisted = wishlistIds instanceof Set
          ? wishlistIds.has(id)
          : Array.isArray(wishlistIds)
          ? wishlistIds.includes(id)
          : false;

        return (
          <CategoryProductCard
            key={id}
            product={product}
            isWishlisted={isWishlisted}
            onWishlistToggle={onWishlistToggle}
            onAddToCart={onAddToCart}
            isAddingToCart={addingCartId === id}
          />
        );
      })}
    </div>
  );
}

export default CategoryProductGrid;
