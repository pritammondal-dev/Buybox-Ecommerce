"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard } from "./ProductCard.jsx";
import { cn } from "../../utils/cn.js";

/**
 * ProductCarousel
 * Production-quality responsive horizontal product carousel.
 * - Desktop: smooth horizontal scroll with intuitive previous/next arrow buttons
 * - Mobile / Tablet: touch-friendly swipe gesture with snap alignment
 * - Graceful layout: doesn't stretch or distort when only 1 or 2 products exist
 */
export function ProductCarousel({
  products = [],
  wishlistVariantIds = [],
  onWishlistToggle,
  onAddToCart,
  renderItem,
  className,
  itemClassName,
}) {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);

    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll, products]);

  const scroll = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = el.clientWidth * 0.75;
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  if (!Array.isArray(products) || products.length === 0) {
    return null;
  }

  return (
    <div className={cn("relative group/carousel", className)}>
      {/* Desktop Navigation Arrows */}
      <button
        type="button"
        suppressHydrationWarning
        onClick={() => scroll("left")}
        disabled={!canScrollLeft}
        aria-label="Scroll left"
        className={cn(
          "absolute -left-3.5 top-1/2 -translate-y-1/2 z-20 hidden md:flex size-9 sm:size-10 items-center justify-center rounded-full bg-white text-slate-800 shadow-md border border-slate-200/80 transition-all cursor-pointer",
          !canScrollLeft
            ? "opacity-35 cursor-not-allowed"
            : "hover:bg-slate-50 hover:scale-105 active:scale-95 text-[#007A55]"
        )}
      >
        <ChevronLeft className="size-5" />
      </button>

      <button
        type="button"
        suppressHydrationWarning
        onClick={() => scroll("right")}
        disabled={!canScrollRight}
        aria-label="Scroll right"
        className={cn(
          "absolute -right-3.5 top-1/2 -translate-y-1/2 z-20 hidden md:flex size-9 sm:size-10 items-center justify-center rounded-full bg-white text-slate-800 shadow-md border border-slate-200/80 transition-all cursor-pointer",
          !canScrollRight
            ? "opacity-35 cursor-not-allowed"
            : "hover:bg-slate-50 hover:scale-105 active:scale-95 text-[#007A55]"
        )}
      >
        <ChevronRight className="size-5" />
      </button>

      {/* Horizontal Carousel Track */}
      <div
        ref={scrollRef}
        className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-none py-1 px-0.5 snap-x snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {products.map((product, idx) => {
          const id = product.id || product._id || `product-${idx}`;
          const isWishlisted =
            Array.isArray(wishlistVariantIds) && wishlistVariantIds.includes(id);

          if (typeof renderItem === "function") {
            return (
              <div
                key={id}
                className={cn(
                  "w-[200px] sm:w-[215px] md:w-[220px] lg:w-[226px] xl:w-[230px] shrink-0 snap-start",
                  itemClassName
                )}
              >
                {renderItem(product, idx)}
              </div>
            );
          }

          return (
            <div
              key={id}
              className={cn(
                "w-[200px] sm:w-[215px] md:w-[220px] lg:w-[226px] xl:w-[230px] shrink-0 snap-start flex flex-col",
                itemClassName
              )}
            >
              <ProductCard
                product={product}
                isWishlisted={isWishlisted}
                onWishlistToggle={(val) => onWishlistToggle?.(product, val)}
                onAddToCart={() => onAddToCart?.(product)}
                className="h-full"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ProductCarousel;
