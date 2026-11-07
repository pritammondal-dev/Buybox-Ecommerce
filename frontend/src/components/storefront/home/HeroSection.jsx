"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../../utils/cn.js";
import { useBannerSlot } from "../../../hooks/useBannerSlot.js";

// Helper to extract clean card title, subtitle, badge and thematic styling
function getPromoCardTheme(card) {
  const slotKey = card.key;
  const slot = card.slot;

  // Title: use custom title if set, or clean default title
  let title = slot.title;
  if (
    !title ||
    title.startsWith("Hero Card") ||
    title.startsWith("Hero Card 1") ||
    title.startsWith("Hero Card 2") ||
    title.startsWith("Hero Card 3")
  ) {
    if (slotKey === "hero_audio") title = "Audio Essentials";
    else if (slotKey === "hero_smart_home") title = "Smart Devices";
    else if (slotKey === "hero_brand_deals") title = "Exclusive Deals";
    else title = slot.altText || "Special Offer";
  }

  // Subtitle: only if available or default for slot
  const subtitle =
    slot.subtitle ||
    (slotKey === "hero_audio"
      ? "Studio monitors & wireless audio"
      : slotKey === "hero_smart_home"
      ? "For a smarter connected home"
      : slotKey === "hero_brand_deals"
      ? "Apple, Samsung, Dell & more"
      : null);

  // Badge: only if available or slot default
  const badge =
    slot.badge ||
    (slotKey === "hero_audio"
      ? "PREMIUM SOUND"
      : slotKey === "hero_smart_home"
      ? "SMART LIVING"
      : slotKey === "hero_brand_deals"
      ? "TOP BRANDS"
      : null);

  const cta = slot.ctaText || "Shop Now";

  // Card themes
  const isDark = slotKey === "hero_audio" || (!slotKey && card.slot.src?.includes("audio"));
  const isAmber = slotKey === "hero_smart_home";
  const isRose = slotKey === "hero_brand_deals";

  let bgClass = "bg-gradient-to-br from-[#022c22] via-[#043E2E] to-[#064E3B] border-emerald-800/40";
  let fadeColor = "from-[#022c22]";
  let badgeClass = "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
  let headingClass = "text-white";
  let subtitleClass = "text-emerald-100/80";
  let ctaClass = "inline-flex items-center gap-1.5 rounded-full bg-[#007A55] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#005f42]";

  if (isAmber) {
    bgClass = "bg-gradient-to-br from-[#FFFDF5] via-[#FEF3C7] to-[#FDE68A] border-amber-200/80";
    fadeColor = "from-[#FFFDF5]";
    badgeClass = "bg-amber-100/90 text-amber-800 border-amber-300/60";
    headingClass = "text-slate-900";
    subtitleClass = "text-slate-700";
    ctaClass = "inline-flex items-center gap-1 text-xs font-extrabold text-amber-900 hover:text-amber-950 underline decoration-amber-500 decoration-2 underline-offset-4";
  } else if (isRose) {
    bgClass = "bg-gradient-to-br from-[#FFF1F2] via-[#FFE4E6] to-[#FECDD3] border-rose-200/80";
    fadeColor = "from-[#FFF1F2]";
    badgeClass = "bg-rose-100/90 text-rose-800 border-rose-300/60";
    headingClass = "text-slate-900";
    subtitleClass = "text-slate-700";
    ctaClass = "inline-flex items-center gap-1.5 rounded-full bg-[#881337] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#700f2b]";
  }

  return {
    title,
    subtitle,
    badge,
    cta,
    bgClass,
    fadeColor,
    badgeClass,
    headingClass,
    subtitleClass,
    ctaClass,
    isDark,
    isAmber,
    isRose,
  };
}

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
          const isDark =
            i % 2 === 1 ||
            b.imageUrl?.includes("promo-audio") ||
            b.imageUrl?.includes("electronics");
          return {
            id: b._id || b.id || `slide-${i}`,
            badge: b.badge || "Featured Showcase",
            badgeIcon: isDark ? "⚡" : "🌿",
            title: b.title || "Next-Gen Hardware & Peripherals",
            subtitle: b.subtitle || b.description || "Top brands. Unbeatable deals. Only at Buybox.",
            cta: b.ctaText || "Shop Now",
            href: b.linkUrl || "/shop",
            bannerImage: b.imageUrl,
            bgGradient: isDark
              ? "bg-gradient-to-r from-[#022c22] via-[#043E2E] to-[#064E3B]"
              : "bg-gradient-to-r from-[#D2EFE0] via-[#E5F5EC] to-[#C7EADB]",
            isDark,
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
          {/* Main Hero Banner: Option A Professional Split-Layout */}
          {current && (
            <div
              className={cn(
                activeSideCards.length > 0 ? "lg:col-span-2" : "col-span-1 lg:col-span-3",
                "relative overflow-hidden rounded-3xl h-auto min-h-[340px] sm:min-h-[380px] lg:h-[430px] shadow-sm border border-emerald-200/50 transition-all duration-500 flex flex-col justify-between",
                current.bgGradient || (current.isDark ? "bg-[#043E2E]" : "bg-[#D2EFE0]")
              )}
            >
              {/* Split Layout Container */}
              <div className="flex flex-col sm:flex-row size-full items-stretch relative z-10">
                {/* Left Content Zone (52–56% on Desktop) */}
                <div className="w-full sm:w-[54%] lg:w-[55%] flex flex-col justify-center items-start z-10 pl-11 sm:pl-14 lg:pl-16 pr-5 sm:pr-6 py-6 sm:py-8 lg:py-10 select-none">
                  {/* Discount Badge */}
                  {current.badge && (
                    <div
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold shadow-xs backdrop-blur-xs",
                        current.isDark
                          ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/30"
                          : "bg-white/95 text-[#007A55] border border-emerald-200"
                      )}
                    >
                      <span className="text-sm">{current.badgeIcon || "🌿"}</span>
                      <span>{current.badge}</span>
                    </div>
                  )}

                  {/* Main Headline */}
                  <h1
                    className={cn(
                      "mt-2.5 sm:mt-3 text-xl sm:text-2xl lg:text-[1.75rem] xl:text-3xl font-black tracking-tight leading-[1.2] line-clamp-3",
                      current.isDark ? "text-white" : "text-slate-900"
                    )}
                  >
                    {current.title}
                  </h1>

                  {/* Supporting Description */}
                  {current.subtitle && (
                    <p
                      className={cn(
                        "mt-2 sm:mt-2.5 text-xs sm:text-sm font-medium leading-relaxed max-w-sm lg:max-w-md line-clamp-2",
                        current.isDark ? "text-emerald-100/90" : "text-slate-600"
                      )}
                    >
                      {current.subtitle}
                    </p>
                  )}

                  {/* Primary CTA Button */}
                  <div className="mt-4 sm:mt-5 pt-0.5">
                    <Link
                      href={current.href || "/shop"}
                      className="inline-flex items-center gap-2 rounded-full bg-[#004D38] px-5 py-2.5 sm:px-6 sm:py-3 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-[#003A2A] hover:shadow-lg active:scale-95 transition-all cursor-pointer"
                    >
                      <span>{current.cta || "Shop Now"}</span>
                      <ArrowRight className="size-3.5 sm:size-4 stroke-[2.5]" />
                    </Link>
                  </div>
                </div>

                {/* Right Artwork Zone (44–48% on Desktop) */}
                <div className="w-full sm:w-[46%] lg:w-[45%] h-[150px] sm:h-auto relative flex items-center justify-end px-4 sm:px-6 lg:px-8 py-2 sm:py-6 overflow-hidden pointer-events-none">
                  {/* Subtle blend fade on the inner edge */}
                  <div
                    className={cn(
                      "hidden sm:block absolute inset-y-0 left-0 w-12 sm:w-16 z-10 pointer-events-none bg-gradient-to-r to-transparent",
                      current.isDark ? "from-[#043E2E]" : "from-[#E5F5EC]"
                    )}
                  />

                  {current.bannerImage ? (
                    <div className="relative h-full w-[140px] sm:w-full flex items-center justify-end overflow-hidden ml-auto">
                      <Link
                        href={current.href || "/shop"}
                        className="relative size-full flex items-center justify-end group pointer-events-auto"
                        tabIndex={-1}
                        aria-label={current.title || "Hero showcase banner artwork"}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={current.bannerImage}
                          alt={current.title || "Hero showcase banner artwork"}
                          className={cn(
                            "max-h-[90%] max-w-full drop-shadow-xl select-none transition-transform duration-700 group-hover:scale-105",
                            current.bannerImage?.endsWith(".svg")
                              ? "size-full object-cover object-right scale-110 sm:scale-125 origin-right"
                              : "object-contain object-center sm:object-right"
                          )}
                          loading="eager"
                        />
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Slide Navigation Buttons */}
              {slides.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={prevSlide}
                    aria-label="Previous slide"
                    className="absolute left-2.5 sm:left-3.5 top-1/2 -translate-y-1/2 z-20 flex size-8 sm:size-9 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-md backdrop-blur-xs hover:bg-white hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  >
                    <ChevronLeft className="size-4 sm:size-5" />
                  </button>
                  <button
                    type="button"
                    onClick={nextSlide}
                    aria-label="Next slide"
                    className="absolute right-2.5 sm:right-3.5 top-1/2 -translate-y-1/2 z-20 flex size-8 sm:size-9 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-md backdrop-blur-xs hover:bg-white hover:scale-105 active:scale-95 transition-all cursor-pointer"
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

          {/* Active Side Promo Cards: Two-Area Split Design */}
          {activeSideCards.length > 0 && (
            <div
              className={cn(
                "flex flex-col gap-3.5 sm:gap-4 justify-between lg:h-[430px]",
                activeSideCards.length === 1 && "sm:grid sm:grid-cols-1 lg:flex lg:flex-col",
                activeSideCards.length === 2 && "sm:grid sm:grid-cols-2 lg:flex lg:flex-col",
                activeSideCards.length >= 3 && "sm:grid sm:grid-cols-3 lg:flex lg:flex-col"
              )}
            >
              {activeSideCards.map((card) => {
                const theme = getPromoCardTheme(card);

                return (
                  <Link
                    key={card.key}
                    href={card.slot.linkUrl || "/shop"}
                    className={cn(
                      "relative flex-1 min-h-[140px] sm:min-h-[155px] lg:min-h-0 overflow-hidden rounded-2xl border shadow-2xs group hover:shadow-md transition-all flex items-stretch",
                      theme.bgClass
                    )}
                  >
                    {/* LEFT Content Zone (56–58% width) */}
                    <div className="w-[58%] sm:w-[58%] flex flex-col justify-between p-3.5 sm:p-4 lg:p-4.5 z-10 select-none">
                      <div className="space-y-1">
                        {theme.badge && (
                          <span
                            className={cn(
                              "inline-block text-[9px] sm:text-[10px] font-extrabold tracking-wider px-2 py-0.5 rounded-full border",
                              theme.badgeClass
                            )}
                          >
                            {theme.badge}
                          </span>
                        )}
                        <h2
                          className={cn(
                            "font-black text-sm sm:text-base lg:text-[15px] xl:text-base tracking-tight leading-snug line-clamp-2",
                            theme.headingClass
                          )}
                        >
                          {theme.title}
                        </h2>
                        {theme.subtitle && (
                          <p
                            className={cn(
                              "text-[10px] sm:text-[11px] font-medium leading-relaxed line-clamp-2",
                              theme.subtitleClass
                            )}
                          >
                            {theme.subtitle}
                          </p>
                        )}
                      </div>

                      <div className="pt-2">
                        <span className={theme.ctaClass}>
                          <span>{theme.cta}</span>
                          <ArrowRight className="size-3 stroke-[2.5]" />
                        </span>
                      </div>
                    </div>

                    {/* RIGHT Artwork Zone (42–44% width) */}
                    <div className="w-[42%] sm:w-[42%] relative flex items-center justify-end p-2 sm:p-3 overflow-hidden pointer-events-none">
                      {/* Inner edge subtle blend */}
                      <div
                        className={cn(
                          "absolute inset-y-0 left-0 w-6 z-10 pointer-events-none bg-gradient-to-r to-transparent",
                          theme.fadeColor
                        )}
                      />

                      <div className="relative size-full flex items-center justify-center lg:justify-end overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={card.slot.src}
                          alt={card.slot.altText || theme.title}
                          onError={card.slot.handleImageError}
                          className={cn(
                            "max-h-full max-w-full drop-shadow-md transition-transform duration-500 group-hover:scale-105 select-none",
                            card.slot.src?.endsWith(".svg")
                              ? "size-full object-cover object-right scale-110 sm:scale-125 origin-right"
                              : "object-contain object-center lg:object-right"
                          )}
                          loading="lazy"
                        />
                      </div>
                    </div>
                  </Link>
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
