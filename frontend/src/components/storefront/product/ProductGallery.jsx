"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Heart,
  ImageOff,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
} from "lucide-react";
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
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const price = parsePrice(product?.price || 0);
  const compareAtPrice = parsePrice(product?.compareAtPrice);
  const discount = calculateDiscountPercentage(compareAtPrice, price);

  const activeImage = images[activeIndex];
  const activeUrl = activeImage?.url || null;
  const hasMultipleImages = images.length > 1;

  const handlePrev = useCallback(() => {
    if (!hasMultipleImages) return;
    setActiveIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    setImageError(false);
  }, [hasMultipleImages, images.length]);

  const handleNext = useCallback(() => {
    if (!hasMultipleImages) return;
    setActiveIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    setImageError(false);
  }, [hasMultipleImages, images.length]);

  // Keyboard navigation for Lightbox
  useEffect(() => {
    if (!isLightboxOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsLightboxOpen(false);
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    // Prevent background scrolling while lightbox is open
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isLightboxOpen, handlePrev, handleNext]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-start">
        {/* Desktop Vertical Thumbnails Column */}
        {hasMultipleImages && (
          <div className="hidden sm:flex sm:flex-col gap-2.5 overflow-y-auto max-h-[480px] pr-1 scrollbar-thin shrink-0">
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
                  "relative size-16 lg:size-20 shrink-0 overflow-hidden rounded-xl border-2 transition-all cursor-pointer bg-slate-50",
                  activeIndex === idx
                    ? "border-[#004D38] ring-2 ring-[#004D38]/20 scale-102 shadow-xs"
                    : "border-slate-200 opacity-70 hover:opacity-100 hover:border-slate-300"
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

        {/* Main Showcase Image */}
        <div className="relative aspect-square flex-1 overflow-hidden rounded-3xl border border-slate-200/80 bg-slate-50 shadow-xs group">
          {/* Dynamic Discount Badge */}
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

          {/* Zoom / Lightbox Trigger Button */}
          {activeUrl && !imageError && (
            <button
              type="button"
              onClick={() => setIsLightboxOpen(true)}
              aria-label="Enlarge image preview"
              className="absolute bottom-4 left-4 z-10 flex size-9 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-md backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 sm:hover:scale-105 cursor-pointer"
            >
              <Maximize2 className="size-4" />
            </button>
          )}

          {/* Photo Counter Pill */}
          {hasMultipleImages && (
            <div className="absolute bottom-4 right-4 z-10 rounded-full bg-slate-900/75 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-xs shadow-xs">
              Photo {activeIndex + 1} of {images.length}
            </div>
          )}

          {/* Arrow Navigation (Previous) */}
          {hasMultipleImages && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 -translate-y-1/2 z-10 flex size-9 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-md backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 hover:bg-white hover:scale-110 active:scale-95 cursor-pointer"
            >
              <ChevronLeft className="size-5" />
            </button>
          )}

          {/* Arrow Navigation (Next) */}
          {hasMultipleImages && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              aria-label="Next photo"
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex size-9 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-md backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 hover:bg-white hover:scale-110 active:scale-95 cursor-pointer"
            >
              <ChevronRight className="size-5" />
            </button>
          )}

          {/* Main Image Viewport */}
          {activeUrl && !imageError ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={activeUrl}
              alt={activeImage?.altText || product?.name || "Product image"}
              onError={() => setImageError(true)}
              onClick={() => setIsLightboxOpen(true)}
              className="size-full object-cover cursor-zoom-in transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 text-slate-400 bg-slate-50 select-none">
              <ImageOff className="size-12 stroke-[1.4]" aria-hidden="true" />
              <span className="text-xs font-semibold tracking-wider uppercase text-slate-400">
                Image Not Available
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Horizontal Thumbnails Strip (< 640px) */}
      {hasMultipleImages && (
        <div className="flex sm:hidden items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
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
                "relative size-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all cursor-pointer bg-slate-50",
                activeIndex === idx
                  ? "border-[#004D38] ring-2 ring-[#004D38]/20 scale-102"
                  : "border-slate-200 opacity-70"
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

      {/* Lightbox / Zoom Modal */}
      {isLightboxOpen && activeUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="High-resolution image preview"
          className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/95 p-4 sm:p-6 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setIsLightboxOpen(false)}
        >
          {/* Top Bar with Title & Close */}
          <div
            className="flex w-full max-w-6xl items-center justify-between text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-xs sm:text-sm font-semibold text-slate-300 line-clamp-1 max-w-md">
              {product?.name}
            </span>
            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-400">
                {activeIndex + 1} / {images.length}
              </span>
              <button
                type="button"
                onClick={() => setIsLightboxOpen(false)}
                aria-label="Close image preview"
                className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>

          {/* Main Encircled High-Res Image View */}
          <div
            className="relative flex flex-1 w-full max-w-5xl items-center justify-center py-4"
            onClick={(e) => e.stopPropagation()}
          >
            {hasMultipleImages && (
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Previous photo"
                className="absolute left-2 sm:left-4 z-10 flex size-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25 active:scale-95 transition-all cursor-pointer"
              >
                <ChevronLeft className="size-6" />
              </button>
            )}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeUrl}
              alt={activeImage?.altText || product?.name || "Product high-resolution preview"}
              className="max-h-[75vh] max-w-[90vw] object-contain select-none rounded-lg"
            />

            {hasMultipleImages && (
              <button
                type="button"
                onClick={handleNext}
                aria-label="Next photo"
                className="absolute right-2 sm:right-4 z-10 flex size-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25 active:scale-95 transition-all cursor-pointer"
              >
                <ChevronRight className="size-6" />
              </button>
            )}
          </div>

          {/* Bottom Thumbnails Strip in Lightbox */}
          {hasMultipleImages && (
            <div
              className="flex max-w-full items-center gap-2 overflow-x-auto pb-2 scrollbar-none"
              onClick={(e) => e.stopPropagation()}
            >
              {images.map((img, idx) => (
                <button
                  key={img.url || idx}
                  type="button"
                  onClick={() => {
                    setActiveIndex(idx);
                    setImageError(false);
                  }}
                  className={cn(
                    "relative size-14 shrink-0 overflow-hidden rounded-lg border-2 transition-all cursor-pointer",
                    activeIndex === idx
                      ? "border-emerald-400 ring-2 ring-emerald-400/40 scale-105"
                      : "border-white/20 opacity-50 hover:opacity-90"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={`Preview ${idx + 1}`}
                    className="size-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ProductGallery;
