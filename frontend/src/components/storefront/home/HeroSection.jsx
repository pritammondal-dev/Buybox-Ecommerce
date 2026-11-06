"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
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
        return validBanners.map((b, i) => ({
          badge: b.badge || "Featured Showcase",
          badgeIcon: i % 2 === 1 ? "⚡" : "🌿",
          title: b.title || "Next-Gen Hardware & Peripherals",
          subtitle: b.subtitle || b.description || "Top brands. Unbeatable deals. Only at Buybox.",
          cta: b.ctaText || "Shop Now",
          href: b.linkUrl || "/shop",
          bannerImage: b.imageUrl,
          bgGradient: i % 2 === 1 ? "bg-gradient-to-r from-[#043E2E] via-[#064E3B] to-[#022c22]" : "bg-gradient-to-r from-[#D2EFE0] via-[#E5F5EC] to-[#C7EADB]",
          isDark: i % 2 === 1,
        }));
      }
    }
    return [];
  }, [initialBanners]);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prevSlide = useCallback(() => {
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
        <div className={cn(
          "grid gap-4 sm:gap-6 items-stretch",
          activeSideCards.length > 0 ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1"
        )}>
          {/* Main Hero Banner */}
          {current && (
            <div
              className={cn(
                activeSideCards.length > 0 ? "lg:col-span-2" : "col-span-1 lg:col-span-3",
                "relative overflow-hidden rounded-3xl p-4 sm:p-6 lg:p-8 flex flex-col justify-between h-[280px] sm:h-[350px] lg:h-[430px] shadow-sm border border-emerald-200/50 transition-all duration-500",
                current.bgGradient || "bg-slate-50"
              )}
            >
              {/* Visual Artwork Background Image */}
              {current.bannerImage ? (
                <Link
                  href={current.href || "/shop"}
                  className="absolute inset-0 z-0 overflow-hidden block"
                  tabIndex={0}
                  aria-label={current.title || "Hero showcase banner"}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={current.bannerImage}
                    alt={current.title || "Hero showcase banner"}
                    className="size-full object-cover object-center md:object-right transition-transform duration-700"
                  />
                  <div
                    className="absolute inset-0 z-[2] pointer-events-none"
                    style={{
                      background: current.isDark
                        ? "linear-gradient(90deg, #043E2E 0%, #043E2E 40%, rgba(4,62,46,0.85) 60%, rgba(4,62,46,0) 80%)"
                        : "linear-gradient(90deg, #CEEBDE 0%, #CEEBDE 44%, rgba(206,235,222,0.92) 56%, rgba(206,235,222,0) 78%)",
                    }}
                  />
                </Link>
              ) : null}

              {/* Text Overlay */}
              <div className="relative z-10 pl-2 sm:pl-4 max-w-xs sm:max-w-sm lg:max-w-md flex flex-col items-start justify-center space-y-2 sm:space-y-3 my-auto pointer-events-none">
                <div
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-bold shadow-xs backdrop-blur-xs",
                    current.isDark
                      ? "bg-emerald-900/90 text-emerald-300 border border-emerald-500/30"
                      : "bg-white/95 text-[#007A55] border border-emerald-100"
                  )}
                >
                  <span>{current.badgeIcon}</span>
                  <span>{current.badge}</span>
                </div>

                <h1
                  className={cn(
                    "text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-black tracking-tight leading-tight",
                    current.isDark ? "text-white" : "text-slate-900"
                  )}
                >
                  {current.title}
                </h1>

                <p
                  className={cn(
                    "text-[11px] sm:text-xs lg:text-sm font-medium leading-relaxed max-w-sm line-clamp-2",
                    current.isDark ? "text-emerald-100/90" : "text-slate-700"
                  )}
                >
                  {current.subtitle}
                </p>

                <div className="pt-1 pointer-events-auto">
                  <Link
                    href={current.href || "/shop"}
                    className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-[#004D38] px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-[#003A2A] hover:shadow-lg active:scale-95 transition-all"
                  >
                    <span>{current.cta}</span>
                    <ArrowRight className="size-3.5 sm:size-4 stroke-[2.5]" />
                  </Link>
                </div>
              </div>

              {/* Slide Navigation Buttons */}
              {slides.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={prevSlide}
                    aria-label="Previous slide"
                    className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 z-20 flex size-8 sm:size-9 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-md backdrop-blur-xs hover:bg-white transition-all cursor-pointer"
                  >
                    <ChevronLeft className="size-4 sm:size-5" />
                  </button>
                  <button
                    type="button"
                    onClick={nextSlide}
                    aria-label="Next slide"
                    className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 z-20 flex size-8 sm:size-9 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-md backdrop-blur-xs hover:bg-white transition-all cursor-pointer"
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

          {/* Active Side Promo Cards */}
          {activeSideCards.length > 0 && (
            <div className={cn(
              "flex flex-col gap-3 sm:gap-4 justify-between lg:h-[430px]",
              activeSideCards.length === 1 && "sm:grid sm:grid-cols-1 lg:flex lg:flex-col",
              activeSideCards.length === 2 && "sm:grid sm:grid-cols-2 lg:flex lg:flex-col",
              activeSideCards.length >= 3 && "sm:grid sm:grid-cols-3 lg:flex lg:flex-col"
            )}>
              {activeSideCards.map((card) => (
                <Link
                  key={card.key}
                  href={card.slot.linkUrl || "/shop"}
                  className="relative flex-1 h-[95px] sm:h-[115px] lg:h-auto overflow-hidden rounded-2xl border border-slate-200/80 shadow-2xs group hover:shadow-md transition-all bg-slate-100 block"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={card.slot.src}
                    alt={card.slot.altText || "Promotional banner"}
                    onError={card.slot.handleImageError}
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
