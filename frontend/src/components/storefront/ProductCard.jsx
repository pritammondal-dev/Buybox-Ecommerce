"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Heart, ShoppingBag, Star, ImageOff, Check } from "lucide-react";
import { Skeleton } from "../ui/Skeleton.jsx";
import { QuickView } from "./QuickView.jsx";
import {
  formatCurrency,
  calculateDiscountPercentage,
  parsePrice,
} from "../../utils/formatCurrency.js";
import { cn } from "../../utils/cn.js";

/**
 * ProductCard
 * Production-quality ecommerce product card designed for Amazon/Flipkart merchandising depth
 * while maintaining Buybox's distinct aesthetic identity (#007A55 Emerald, #FFF8D6 Warm Cream, #0F172A Slate).
 */
export function ProductCard({
  product,
  isLoading = false,
  isWishlisted = false,
  isAddingToCart = false,
  onWishlistToggle,
  onAddToCart,
  className,
}) {
  const [imageError, setImageError] = useState(false);
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);

  if (isLoading) {
    return (
      <div
        className={cn(
          "flex flex-col rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs",
          className
        )}
      >
        <Skeleton className="aspect-square w-full rounded-xl" />
        <div className="mt-3 space-y-2">
          <Skeleton className="h-3 w-1/4" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-9 w-full rounded-full" />
        </div>
      </div>
    );
  }

  if (!product) return null;

  const image =
    product.images?.find((img) => img.isPrimary)?.url ||
    product.images?.[0]?.url ||
    product.image ||
    null;

  const price = parsePrice(product.price || product.basePrice || 0);
  const compareAtPrice = parsePrice(product.compareAtPrice);
  const discount = calculateDiscountPercentage(compareAtPrice, price);

  const productUrl = `/product/${product.slug || product._id || product.id}`;
  const brandName = product.brand?.name || product.brandName || "";

  const rating =
    typeof product.ratingAverage === "number"
      ? product.ratingAverage
      : typeof product.rating === "number"
      ? product.rating
      : 0;

  const reviewCount =
    typeof product.ratingCount === "number"
      ? product.ratingCount
      : typeof product.reviewCount === "number"
      ? product.reviewCount
      : Array.isArray(product.reviews)
      ? product.reviews.length
      : 0;

  const hasRealRating = reviewCount > 0 && rating > 0;

  const isOutOfStock =
    product.stockStatus === "out_of_stock" ||
    product.status === "out_of_stock" ||
    (typeof product.stockQuantity === "number" && product.stockQuantity <= 0) ||
    (typeof product.stock === "number" && product.stock <= 0);

  return (
    <>
      <div
        className={cn(
          "group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs transition-all duration-300 hover:shadow-card hover:-translate-y-1 hover:border-[#007A55]/40",
          className
        )}
      >
        <div className="flex flex-col flex-1">
          {/* 1. Thumbnail Container with Status Badges & Wishlist Heart */}
          <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-white border border-slate-100/80">
            <Link href={productUrl} className="block size-full" tabIndex={-1}>
              {image && !imageError ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={image}
                  alt={product.name || "Product image"}
                  onError={() => setImageError(true)}
                  className="size-full object-contain p-2 transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="flex size-full flex-col items-center justify-center gap-1.5 bg-slate-50 text-slate-400">
                  <ImageOff className="size-6 stroke-[1.5]" aria-hidden="true" />
                  <span className="text-[10px] font-medium tracking-wide text-slate-400">
                    Buybox Genuine
                  </span>
                </div>
              )}
            </Link>

            {/* Top-Left: Status / Discount Badge */}
            <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1 items-start">
              {isOutOfStock ? (
                <span className="rounded-md bg-slate-900/90 backdrop-blur-xs px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-xs">
                  Out of Stock
                </span>
              ) : discount > 0 ? (
                <span className="rounded-md bg-[#E02424] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-xs">
                  -{discount}% OFF
                </span>
              ) : product.isFeatured ? (
                <span className="rounded-md bg-[#007A55] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-xs">
                  Featured
                </span>
              ) : null}
            </div>

            {/* Top-Right: Wishlist Heart Button */}
            <button
              type="button"
              suppressHydrationWarning
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onWishlistToggle?.(!isWishlisted);
              }}
              aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
              className={cn(
                "absolute top-2.5 right-2.5 z-10 flex size-8 items-center justify-center rounded-full bg-white/95 backdrop-blur-xs shadow-sm transition-all duration-200 hover:scale-110 active:scale-90 cursor-pointer border border-slate-100",
                isWishlisted
                  ? "text-red-500 border-red-100 bg-red-50/80"
                  : "text-slate-400 hover:text-red-500"
              )}
            >
              <Heart
                className={cn(
                  "size-4 transition-transform",
                  isWishlisted && "fill-current"
                )}
              />
            </button>
          </div>

          {/* 2. Product Meta, Title, Rating, Pricing & Stock */}
          <div className="mt-3 flex flex-col flex-1">
            {/* Brand (only if provided by backend) */}
            {brandName ? (
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                {brandName}
              </span>
            ) : null}

            {/* Product Name (2-line maximum truncation) */}
            <Link href={productUrl} className="group/title mt-0.5 block">
              <h3
                title={product.name}
                className="line-clamp-2 min-h-[2.5rem] text-sm font-bold text-slate-900 leading-snug transition-colors group-hover/title:text-[#007A55]"
              >
                {product.name}
              </h3>
            </Link>

            {/* Rating Row (strictly rendered ONLY if genuine review data exists) */}
            <div className="mt-1.5 flex items-center gap-1.5 min-h-[1.25rem]">
              {hasRealRating ? (
                <>
                  <div className="flex items-center gap-0.5">
                    <Star className="size-3.5 fill-amber-400 text-amber-400" />
                    <span className="text-xs font-bold text-slate-800">
                      {rating.toFixed(1)}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-400">
                    ({reviewCount})
                  </span>
                </>
              ) : (
                <span className="text-[10px] font-medium text-slate-400">
                  Verified Hardware
                </span>
              )}
            </div>

            {/* Price Line */}
            <div className="mt-2 flex items-baseline gap-2 flex-wrap">
              <span className="text-base sm:text-lg font-black tracking-tight text-[#007A55]">
                {formatCurrency(price)}
              </span>
              {compareAtPrice > price && (
                <span className="text-xs font-medium text-slate-400 line-through">
                  {formatCurrency(compareAtPrice)}
                </span>
              )}
              {discount > 0 && (
                <span className="text-[11px] font-extrabold text-[#E02424]">
                  {discount}% off
                </span>
              )}
            </div>

            {/* Availability Indicator */}
            <div className="mt-1.5 flex items-center gap-1.5">
              {isOutOfStock ? (
                <span className="inline-flex items-center text-[11px] font-semibold text-rose-600">
                  Out of Stock
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  In Stock
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 3. Action Footer: Single Prominent Full-Width Add To Cart Button */}
        <div className="mt-3.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            suppressHydrationWarning
            onClick={() => !isOutOfStock && onAddToCart?.(product)}
            disabled={isAddingToCart || isOutOfStock}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-full py-2.5 px-4 text-xs font-bold shadow-xs transition-all duration-200",
              isOutOfStock
                ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                : "bg-[#007A55] text-white hover:bg-[#006346] hover:shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
            )}
          >
            <ShoppingBag className="size-3.5 shrink-0" />
            <span>
              {isAddingToCart
                ? "Adding..."
                : isOutOfStock
                ? "Unavailable"
                : "Add to Cart"}
            </span>
          </button>
        </div>
      </div>

      {/* Quick View Modal */}
      <QuickView
        product={product}
        isOpen={isQuickViewOpen}
        onClose={() => setIsQuickViewOpen(false)}
        onAddToCart={onAddToCart}
        isAddingToCart={isAddingToCart}
        isWishlisted={isWishlisted}
        onWishlistToggle={onWishlistToggle}
      />
    </>
  );
}

export default ProductCard;
