"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../../utils/cn.js";
import { useBannerSlot } from "../../../hooks/useBannerSlot.js";

export function HeroSection({ initialBanners = [], initialCampaign = null, inactiveSlots = [] }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const effectiveInactive = useMemo(() => {
    const list = new Set(Array.isArray(inactiveSlots) ? inactiveSlots : []);
    if (Array.isArray(initialBanners?.inactiveSlots)) {
      initialBanners.inactiveSlots.forEach((s) => list.add(s));
    }
    if (Array.isArray(initialBanners)) {
      initialBanners.forEach((b) => {
        if (b && b.isActive === false && (b.slotKey || b.placement)) {
          list.add(b.slotKey || b.placement);
        }
      });
    }
    return Array.from(list);
  }, [initialBanners, inactiveSlots]);

  const heroAudio = useBannerSlot(initialBanners, "hero_audio", effectiveInactive);
  const heroSmartHome = useBannerSlot(initialBanners, "hero_smart_home", effectiveInactive);
  const heroBrandDeals = useBannerSlot(initialBanners, "hero_brand_deals", effectiveInactive);

  const activeSideCards = useMemo(() => {
    return [
      { key: "hero_audio", slot: heroAudio },
      { key: "hero_smart_home", slot: heroSmartHome },
      { key: "hero_brand_deals", slot: heroBrandDeals },
    ].filter(
      (c) =>
        c.slot.isVisible &&
        Boolean(c.slot.src) &&
        c.slot.isActive !== false &&
        !effectiveInactive.includes(c.key)
    );
  }, [heroAudio, heroSmartHome, heroBrandDeals, effectiveInactive]);

  const slides = useMemo(() => {
    if (Array.isArray(initialBanners) && initialBanners.length > 0) {
      const validBanners = initialBanners.filter(
        (b) =>
          (!b.slotKey || b.slotKey === "hero_main" || b.placement === "hero_main") &&
          b.isActive !== false &&
          b.imageUrl &&
          !b.imageUrl.includes("unsplash.com") &&
          !b.imageUrl.includes("example.com")
      );
      if (validBanners.length > 0) {
        return validBanners.map((b, i) => {
          return {
            id: b._id || b.id || `slide-${i}`,
            title: b.title || "Promotional Showcase",
            href: b.linkUrl || "/shop",
            bannerImage: b.imageUrl,
            mobileImage: b.mobileImageUrl || b.imageUrl,
          };
        });
      }
    }
    return [];
  }, [initialBanners]);

  const nextSlide = useCallback(() => {
    if (slides.length <= 1) return;
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    if (slides.length <= 1) return;
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  // Auto-advance slides
  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;
    const timer = setInterval(() => {
      nextSlide();
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length, isPaused, nextSlide]);

  const current = slides[currentSlide] || null;

  if (!current && activeSideCards.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Hero Showcase"
      className="py-4 sm:py-6"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className={cn(
            "grid gap-4 sm:gap-6 items-stretch",
            activeSideCards.length > 0 ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1"
          )}
        >
          {/* Main Hero Banner: Image-Only Promotional Artwork */}
          {current && (
            <div
              className={cn(
                activeSideCards.length > 0 ? "lg:col-span-2" : "col-span-1 lg:col-span-3",
                "relative overflow-hidden rounded-3xl aspect-[16/9] sm:aspect-auto sm:h-[320px] lg:h-[430px] shadow-sm border border-emerald-200/50 transition-all duration-500 bg-slate-900 group"
              )}
            >
              {current.bannerImage ? (
                <Link
                  href={current.href || "/shop"}
                  className="relative size-full block overflow-hidden"
                  tabIndex={0}
                  aria-label={current.title || "Hero promotional banner"}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={current.bannerImage}
                    alt={current.title || "Hero promotional banner"}
                    className="size-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.02]"
                    loading="eager"
                  />
                </Link>
              ) : (
                <div className="size-full flex items-center justify-center bg-emerald-950 text-white font-medium text-sm">
                  <span>{current.title}</span>
                </div>
              )}

              {/* Slide Navigation Buttons */}
              {slides.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={prevSlide}
                    aria-label="Previous slide"
                    className="absolute left-2.5 sm:left-4 top-1/2 -translate-y-1/2 z-20 flex size-8 sm:size-9 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-md backdrop-blur-xs hover:bg-white hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  >
                    <ChevronLeft className="size-4 sm:size-5" />
                  </button>
                  <button
                    type="button"
                    onClick={nextSlide}
                    aria-label="Next slide"
                    className="absolute right-2.5 sm:right-4 top-1/2 -translate-y-1/2 z-20 flex size-8 sm:size-9 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-md backdrop-blur-xs hover:bg-white hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  >
                    <ChevronRight className="size-4 sm:size-5" />
                  </button>

                  {/* Carousel Dots */}
                  <div className="absolute bottom-3 sm:bottom-4 left-0 right-0 z-20 flex items-center justify-center gap-1.5 pointer-events-none">
                    {slides.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setCurrentSlide(idx);
                        }}
                        aria-label={`Go to slide ${idx + 1}`}
                        className={cn(
                          "h-1.5 sm:h-2 rounded-full transition-all cursor-pointer pointer-events-auto",
                          idx === currentSlide
                            ? "w-5 sm:w-6 bg-white shadow-md"
                            : "w-1.5 sm:w-2 bg-white/60 hover:bg-white/90 drop-shadow-xs"
                        )}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Active Side Promo Cards: Pure Image-Only Promotional Banners */}
          {activeSideCards.length > 0 && (
            <div
              className={cn(
                "flex flex-col gap-3 sm:gap-3.5 lg:h-[430px] justify-between",
                activeSideCards.length === 1 && "sm:grid sm:grid-cols-1 lg:flex lg:flex-col",
                activeSideCards.length === 2 && "sm:grid sm:grid-cols-2 lg:flex lg:flex-col",
                activeSideCards.length >= 3 && "sm:grid sm:grid-cols-3 lg:flex lg:flex-col"
              )}
            >
              {activeSideCards.map((card) => {
                const destination = card.slot.linkUrl || card.slot.href;
                const hasValidDestination =
                  typeof destination === "string" &&
                  destination.trim().length > 0 &&
                  destination !== "#";
                const accessibleLabel = card.slot.altText || card.slot.title || "Promotional banner";

                const imageElement = (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={card.slot.src}
                    alt={accessibleLabel}
                    onError={card.slot.handleImageError}
                    className="size-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                );

                if (hasValidDestination) {
                  return (
                    <Link
                      key={card.key}
                      href={destination}
                      aria-label={accessibleLabel}
                      className="relative flex-1 min-h-0 h-[115px] sm:h-auto sm:aspect-[2.4/1] lg:aspect-auto lg:h-auto overflow-hidden rounded-2xl border border-slate-200/80 shadow-2xs group hover:shadow-md transition-all bg-slate-100 block focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007A55]"
                    >
                      {imageElement}
                    </Link>
                  );
                }

                return (
                  <div
                    key={card.key}
                    role="img"
                    aria-label={accessibleLabel}
                    className="relative flex-1 min-h-0 h-[115px] sm:h-auto sm:aspect-[2.4/1] lg:aspect-auto lg:h-auto overflow-hidden rounded-2xl border border-slate-200/80 shadow-2xs group transition-all bg-slate-100 block"
                  >
                    {imageElement}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
