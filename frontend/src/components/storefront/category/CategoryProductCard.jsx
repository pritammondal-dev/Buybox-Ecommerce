"use client";

import React from "react";
import Link from "next/link";
import { Heart, ShoppingBag, Star, Check } from "lucide-react";
import { formatCurrency } from "../../../utils/formatCurrency.js";
import { cn } from "../../../utils/cn.js";

export function CategoryProductCard({
  product,
  isWishlisted = false,
  onWishlistToggle,
  onAddToCart,
  isAddingToCart = false,
  className,
}) {
  if (!product) return null;

  const id = product._id || product.id;
  const slug = product.slug || id;

  const price = Number(product.price?.$numberDecimal || product.price || 0);
  const compareAtPrice = Number(
    product.compareAtPrice?.$numberDecimal || product.compareAtPrice || 0
  );
  const discount =
    compareAtPrice > price
      ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
      : 0;

  const imageUrl =
    product.images?.[0]?.url || product.image || "/images/placeholder.svg";
  const imageAlt = product.images?.[0]?.altText || product.name;
  const brandName = product.brandId?.name || product.brand?.name || null;

  const rating = Number(product.ratingAverage || 4.5);
  const reviewsCount = Number(product.ratingCount || 12);
  const isOutOfStock =
    product.stockStatus === "out_of_stock" || product.status === "out_of_stock";

  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 transition-all duration-200 hover:border-slate-300 hover:shadow-card h-full select-none",
        className
      )}
    >
      {/* 1. Top Media Area with Badges & Wishlist */}
      <div className="relative flex flex-col">
        {/* Top Badges */}
        <div className="absolute top-0 left-0 z-10 flex flex-col gap-1 items-start">
          {discount > 0 ? (
            <span className="rounded-md bg-[#E02424] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-xs">
              -{discount}% OFF
            </span>
          ) : product.isFeatured ? (
            <span className="rounded-md bg-[#007A55] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-xs">
              Featured
            </span>
          ) : null}
        </div>

        {/* Wishlist Heart Button */}
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
            "absolute top-0 right-0 z-10 flex size-8 items-center justify-center rounded-full bg-white/95 backdrop-blur-xs shadow-sm transition-all duration-200 hover:scale-110 active:scale-90 cursor-pointer border border-slate-100",
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

        {/* Product Image Link */}
        <Link
          href={`/product/${slug}`}
          className="relative flex h-40 sm:h-44 w-full items-center justify-center overflow-hidden rounded-xl bg-slate-50/60 p-3 pt-6 transition-colors group-hover:bg-slate-50"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={imageAlt}
            className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        </Link>

        {/* Product Information */}
        <div className="mt-3 flex flex-col flex-1">
          {brandName && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
              {brandName}
            </span>
          )}

          <Link href={`/product/${slug}`} className="group-hover:text-[#007A55] transition-colors">
            <h3 className="mt-0.5 text-xs sm:text-sm font-bold text-slate-900 line-clamp-2 leading-snug">
              {product.name}
            </h3>
          </Link>

          {/* Ratings row */}
          <div className="mt-1.5 flex items-center gap-1.5 text-xs">
            <div className="flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-amber-700 font-bold text-[11px] border border-amber-200/50">
              <Star className="size-3 fill-amber-400 text-amber-400" />
              <span>{rating.toFixed(1)}</span>
            </div>
            {reviewsCount > 0 && (
              <span className="text-[11px] text-slate-400">
                ({reviewsCount})
              </span>
            )}
          </div>

          {/* Pricing Row */}
          <div className="mt-2 flex flex-wrap items-baseline gap-1.5">
            <span className="text-sm sm:text-base font-black text-slate-900">
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
          <div className="mt-1.5">
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

      {/* 2. Full-Width Prominent "Add to Cart" Button */}
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
              : "bg-[#004D38] text-white hover:bg-[#003B2B] hover:shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
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
  );
}

export default CategoryProductCard;
