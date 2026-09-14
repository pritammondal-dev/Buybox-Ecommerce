"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Heart, ShoppingBag, Star, ImageOff } from "lucide-react";
import { Skeleton } from "../ui/Skeleton.jsx";
import { QuickView } from "./QuickView.jsx";
import { formatCurrency, calculateDiscountPercentage, parsePrice } from "../../utils/formatCurrency.js";
import { cn } from "../../utils/cn.js";

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
  const [selectedSwatch, setSelectedSwatch] = useState(0);

  if (isLoading) {
    return (
      <div className={cn("flex flex-col rounded-2xl border bg-white p-3.5 shadow-xs", className)}>
        <Skeleton className="aspect-square w-full rounded-xl" />
        <div className="mt-3 space-y-2">
          <Skeleton className="h-3 w-1/4" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-8 w-full rounded-full" />
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
      : (product.reviews?.length ?? 0);

  const colorSwatches =
    product.options?.find((opt) => opt.name?.toLowerCase() === "color")?.values ||
    product.colors ||
    [];

  const isOutOfStock =
    product.stockStatus === "out_of_stock" ||
    product.status === "out_of_stock" ||
    (typeof product.stockQuantity === "number" && product.stockQuantity <= 0) ||
    (typeof product.stock === "number" && product.stock <= 0);

  return (
    <>
      <div
        className={cn(
          "group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-white p-3.5 shadow-xs transition-all duration-300 hover:shadow-card hover:-translate-y-1 hover:border-[#007A55]/30",
          className
        )}
      >
        <div>
          {/* Thumbnail Container */}
          <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-slate-50 border border-slate-100">
            <Link href={productUrl} className="block size-full" tabIndex={-1}>
              {image && !imageError ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={image}
                  alt={product.name || "Product image"}
                  onError={() => setImageError(true)}
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="flex size-full flex-col items-center justify-center gap-1 bg-slate-50 text-slate-400">
                  <ImageOff className="size-6 stroke-[1.5]" aria-hidden="true" />
                  <span className="text-[10px] font-medium">Buybox Genuine</span>
                </div>
              )}
            </Link>

            {/* Badges: Out of Stock and Sales */}
            <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1 items-start">
              {isOutOfStock && (
                <span className="rounded bg-slate-900/90 backdrop-blur-xs px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-xs">
                  Out of Stock
                </span>
              )}
              {discount > 0 && (
                <span className="rounded bg-[#E02424] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-xs">
                  -{discount}% OFF
                </span>
              )}
            </div>

            {/* Top-Right Heart / Wishlist Icon */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onWishlistToggle?.(!isWishlisted);
              }}
              aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
              className={cn(
                "absolute top-2.5 right-2.5 z-10 flex size-7 items-center justify-center rounded-full bg-white shadow-sm transition-transform active:scale-95 cursor-pointer",
                isWishlisted ? "text-red-500" : "text-slate-400 hover:text-red-500"
              )}
            >
              <Heart className={cn("size-3.5", isWishlisted && "fill-current")} />
            </button>
          </div>

          {/* Product Meta & Title */}
          <div className="mt-3 space-y-1">
            {brandName ? (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block truncate">
                {brandName}
              </span>
            ) : null}

            <Link href={productUrl} className="group/title block">
              <h3 className="line-clamp-1 text-sm font-bold text-slate-900 transition-colors group-hover/title:text-[#007A55]">
                {product.name}
              </h3>
            </Link>

            {/* Rating Row */}
            <div className="flex items-center gap-1 pt-0.5">
              <div className="flex items-center">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={`star-${i}`}
                    className={cn(
                      "size-3",
                      reviewCount > 0 && rating >= i + 1
                        ? "fill-amber-400 text-amber-400"
                        : reviewCount > 0 && rating >= i + 0.5
                        ? "fill-amber-400/50 text-amber-400"
                        : "text-slate-200 fill-slate-100"
                    )}
                  />
                ))}
              </div>
              <span className="text-[11px] font-medium text-slate-400">
                {reviewCount > 0 ? `(${reviewCount})` : "No reviews"}
              </span>
            </div>

            {/* Price Line with Strike-Through and Discount */}
            <div className="flex items-baseline gap-2 pt-1">
              <span className="text-base font-extrabold text-[#007A55]">
                {formatCurrency(price)}
              </span>
              {compareAtPrice > price && (
                <span className="text-xs text-slate-400 line-through">
                  {formatCurrency(compareAtPrice)}
                </span>
              )}
              {discount > 0 && (
                <span className="text-[11px] font-bold text-[#E02424]">
                  {discount}% OFF
                </span>
              )}
            </div>

            {/* Color Swatches (only if real options exist) */}
            {colorSwatches.length > 0 && (
              <div className="flex items-center gap-1.5 pt-1.5">
                {colorSwatches.map((color, idx) => {
                  const colorVal =
                    typeof color === "string"
                      ? color
                      : color.hex || color.value || "#ccc";
                  return (
                    <button
                      key={typeof color === "string" ? color : color.value || idx}
                      type="button"
                      onClick={() => setSelectedSwatch(idx)}
                      aria-label={`Select color swatch ${idx + 1}`}
                      style={{ backgroundColor: colorVal }}
                      className={cn(
                        "size-2.5 rounded-full transition-transform cursor-pointer border border-slate-200",
                        selectedSwatch === idx
                          ? "ring-2 ring-[#007A55] ring-offset-1 scale-110"
                          : "hover:scale-110"
                      )}
                    />
                  );
                })}
              </div>
            )}

            {/* Out of Stock notice if unavailable */}
            {isOutOfStock && (
              <div className="pt-1.5">
                <span className="inline-flex items-center text-[11px] font-semibold text-rose-600">
                  Out of Stock
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action Footer: Wishlist Button & Teal Pill Add To Cart */}
        <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onWishlistToggle?.(!isWishlisted);
            }}
            aria-label="Toggle wishlist"
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-slate-500 hover:border-[#007A55] hover:text-[#007A55] transition-colors cursor-pointer",
              isWishlisted && "text-red-500 border-red-200 bg-red-50/50"
            )}
          >
            <Heart className={cn("size-3.5", isWishlisted && "fill-current")} />
          </button>

          <button
            type="button"
            onClick={() => !isOutOfStock && onAddToCart?.(product)}
            disabled={isAddingToCart || isOutOfStock}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold shadow-xs transition-all",
              isOutOfStock
                ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                : "bg-[#007A55] text-white hover:bg-[#006346] active:scale-95 cursor-pointer disabled:opacity-50"
            )}
          >
            <ShoppingBag className="size-3.5" />
            <span>{isOutOfStock ? "Out of Stock" : "Add to Cart"}</span>
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
