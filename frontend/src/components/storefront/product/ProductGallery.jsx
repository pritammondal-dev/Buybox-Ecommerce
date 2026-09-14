"use client";

import React, { useState } from "react";
import { Heart, ImageOff } from "lucide-react";
import { calculateDiscountPercentage, parsePrice } from "../../../utils/formatCurrency.js";
import { cn } from "../../../utils/cn.js";

export function ProductGallery({
  product,
  isWishlisted = false,
  onWishlistToggle,
}) {
  const images = Array.isArray(product?.images) && product.images.length > 0
    ? product.images
    : product?.image
      ? [{ url: product.image }]
      : [];

  const [activeIndex, setActiveIndex] = useState(0);
  const [imageError, setImageError] = useState(false);

  const price = parsePrice(product?.price || 0);
  const compareAtPrice = parsePrice(product?.compareAtPrice);
  const discount = calculateDiscountPercentage(compareAtPrice, price);

  const activeImage = images[activeIndex];
  const activeUrl = activeImage?.url || null;

  return (
    <div className="flex flex-col gap-4">
      {/* Main Showcase Image */}
      <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-slate-200/80 bg-slate-50 shadow-xs group">
        {/* Dynamic Discount Badge strictly if compareAtPrice > price */}
        {discount > 0 && (
          <div className="absolute top-4 left-4 z-10">
            <span className="rounded-full bg-[#E02424] px-3 py-1 text-xs font-black uppercase tracking-wider text-white shadow-xs">
              -{discount}% OFF
            </span>
          </div>
        )}

        {/* Floating Wishlist Heart */}
        <button
          type="button"
          onClick={onWishlistToggle}
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          className={cn(
            "absolute top-4 right-4 z-10 flex size-10 items-center justify-center rounded-full bg-white/90 backdrop-blur-md shadow-md transition-all active:scale-90 hover:scale-105 cursor-pointer",
            isWishlisted ? "text-red-500" : "text-slate-500 hover:text-red-500"
          )}
        >
          <Heart className={cn("size-5", isWishlisted && "fill-current")} />
        </button>

        {activeUrl && !imageError ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={activeUrl}
            alt={activeImage?.altText || product?.name || "Product image"}
            onError={() => setImageError(true)}
            className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          /* Generic Fallback (Does not visually imply actual product) */
          <div className="flex size-full flex-col items-center justify-center gap-2 text-slate-400 bg-slate-50 select-none">
            <ImageOff className="size-12 stroke-[1.4]" aria-hidden="true" />
            <span className="text-xs font-semibold tracking-wider uppercase text-slate-400">
              Image Not Available
            </span>
          </div>
        )}
      </div>

      {/* Thumbnails Row (Strictly if multiple images exist) */}
      {images.length > 1 && (
        <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
          {images.map((img, idx) => (
            <button
              key={img.url || idx}
              type="button"
              onClick={() => {
                setActiveIndex(idx);
                setImageError(false);
              }}
              aria-label={`View photo ${idx + 1}`}
              className={cn(
                "relative size-20 shrink-0 overflow-hidden rounded-xl border-2 transition-all cursor-pointer bg-slate-50",
                activeIndex === idx
                  ? "border-[#007A55] ring-2 ring-[#007A55]/20 scale-105"
                  : "border-slate-200 opacity-70 hover:opacity-100"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.altText || `Thumbnail ${idx + 1}`}
                className="size-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProductGallery;
