"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "../../../utils/cn.js";
import { useBannerSlot } from "../../../hooks/useBannerSlot.js";

const DEFAULT_HERO_SLIDES = [
  {
    badge: "Big Summer Sale",
    badgeIcon: "🌿",
    title: "Upgrade Your Tech This Season",
    subtitle: "Top brands. Unbeatable deals. Only at Buybox.",
    cta: "Shop Now",
    href: "/shop",
    bannerImage: "/images/banners/hero-summer-sale.png",
    bgGradient: "bg-gradient-to-r from-[#D2EFE0] via-[#E5F5EC] to-[#C7EADB]",
    isDark: false,
  },
  {
    badge: "Mega Electronics Fest",
    badgeIcon: "⚡",
    title: "Next-Gen Hardware & Peripherals",
    subtitle: "Experience cutting-edge compute, 4K displays and studio audio.",
    cta: "Explore Now",
    href: "/shop?sort=featured",
    bannerImage: "/images/banners/hero-electronics-fest.png",
    bgGradient: "bg-gradient-to-r from-[#043E2E] via-[#064E3B] to-[#022c22]",
    isDark: true,
  },
];

export function HeroSection({ initialBanners = [], initialCampaign = null }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const heroAudio = useBannerSlot(initialBanners, "hero_audio");
  const heroSmartHome = useBannerSlot(initialBanners, "hero_smart_home");
  const heroBrandDeals = useBannerSlot(initialBanners, "hero_brand_deals");

  const slides = useMemo(() => {
    if (Array.isArray(initialBanners) && initialBanners.length > 0) {
      const validBanners = initialBanners.filter(
        (b) =>
          (!b.slotKey || b.slotKey === "hero_main" || b.placement === "hero_main") &&
          b.imageUrl &&
          !b.imageUrl.includes("unsplash.com") &&
          !b.imageUrl.includes("example.com")
      );
      if (validBanners.length > 0) {
        return validBanners.map((b, i) => ({
          badge: b.badge || (i % 2 === 1 ? "Mega Electronics Fest" : "Big Summer Sale"),
          badgeIcon: i % 2 === 1 ? "⚡" : "🌿",
          title: b.title || (i % 2 === 1 ? "Next-Gen Hardware & Peripherals" : "Upgrade Your Tech This Season"),
          subtitle: b.subtitle || b.description || "Top brands. Unbeatable deals. Only at Buybox.",
          cta: b.ctaText || (i % 2 === 1 ? "Explore Now" : "Shop Now"),
          href: b.linkUrl || (i % 2 === 1 ? "/shop?sort=featured" : "/shop"),
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

  return (
    <section
      aria-label="Hero Showcase"
      className="py-4 sm:py-6"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 items-stretch">
          {/* Main Hero Banner (2/3 width, Left) */}
          <div
            className={cn(
              "lg:col-span-2 relative overflow-hidden rounded-3xl p-4 sm:p-6 lg:p-8 flex flex-col justify-between h-[280px] sm:h-[350px] lg:h-[430px] shadow-sm border border-emerald-200/50 transition-all duration-500",
              current.bgGradient
            )}
          >
            {/* Visual Artwork Background Image */}
            {current?.bannerImage && (
              <div className="absolute inset-0 z-0 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={current.bannerImage}
                  alt={current?.title}
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
              </div>
            )}

            {/* Slide Navigation Buttons */}
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

            {/* Content & Imagery */}
            <div className="relative z-10 pl-6 sm:pl-8 lg:pl-10 max-w-xs sm:max-w-sm lg:max-w-md flex flex-col items-start justify-center space-y-2 sm:space-y-3 my-auto">
              {/* Badge */}
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-bold shadow-xs backdrop-blur-xs",
                  current.isDark
                    ? "bg-emerald-900/90 text-emerald-300 border border-emerald-500/30"
                    : "bg-white/95 text-[#007A55] border border-emerald-100"
                )}
              >
                <span>{current?.badgeIcon}</span>
                <span>{current?.badge}</span>
              </div>

              {/* Main Heading */}
              <h1
                className={cn(
                  "text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-black tracking-tight leading-tight",
                  current?.isDark ? "text-white" : "text-slate-900"
                )}
              >
                {current.title}
              </h1>

              {/* Subtitle */}
              <p
                className={cn(
                  "text-[11px] sm:text-xs lg:text-sm font-medium leading-relaxed max-w-sm line-clamp-2",
                  current?.isDark ? "text-emerald-100/90" : "text-slate-700"
                )}
              >
                {current?.subtitle}
              </p>

              {/* CTA Button */}
              <div className="pt-1">
                <Link
                  href={current?.href || "/shop"}
                  className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-[#004D38] px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-[#003A2A] hover:shadow-lg active:scale-95 transition-all"
                >
                  <span>{current?.cta}</span>
                  <ArrowRight className="size-3.5 sm:size-4 stroke-[2.5]" />
                </Link>
              </div>
            </div>

            {/* Carousel Dots */}
            <div className="relative z-10 flex items-center justify-center gap-1.5 pt-1.5 sm:pt-2">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentSlide(idx)}
                  aria-label={`Go to slide ${idx + 1}`}
                  className={cn(
                    "h-1.5 sm:h-2 rounded-full transition-all cursor-pointer",
                    idx === currentSlide
                      ? current.isDark ? "w-5 sm:w-6 bg-emerald-400" : "w-5 sm:w-6 bg-[#004D38]"
                      : current.isDark ? "w-1.5 sm:w-2 bg-white/40 hover:bg-white/60" : "w-1.5 sm:w-2 bg-emerald-700/30 hover:bg-emerald-700/50"
                  )}
                />
              ))}
            </div>
          </div>

          {/* Right Column: 3 Stacked Promo Cards (1/3 width, Right, Image-Only) */}
          <div className="flex flex-col sm:grid sm:grid-cols-3 lg:flex lg:flex-col gap-3 sm:gap-4 justify-between lg:h-[430px]">
            {/* Card 1: Audio Essentials (hero_audio) */}
            <Link
              href={heroAudio.linkUrl}
              className="relative flex-1 h-[95px] sm:h-[115px] lg:h-auto overflow-hidden rounded-2xl border border-slate-200/80 shadow-2xs group hover:shadow-md transition-all bg-slate-100 block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroAudio.src}
                alt={heroAudio.altText}
                onError={heroAudio.handleImageError}
                className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            </Link>

            {/* Card 2: Smart Devices for a Smarter Home (hero_smart_home) */}
            <Link
              href={heroSmartHome.linkUrl}
              className="relative flex-1 h-[95px] sm:h-[115px] lg:h-auto overflow-hidden rounded-2xl border border-slate-200/80 shadow-2xs group hover:shadow-md transition-all bg-slate-100 block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroSmartHome.src}
                alt={heroSmartHome.altText}
                onError={heroSmartHome.handleImageError}
                className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            </Link>

            {/* Card 3: Exclusive Brand Deals (hero_brand_deals) */}
            <Link
              href={heroBrandDeals.linkUrl}
              className="relative flex-1 h-[95px] sm:h-[115px] lg:h-auto overflow-hidden rounded-2xl border border-slate-200/80 shadow-2xs group hover:shadow-md transition-all bg-slate-100 block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroBrandDeals.src}
                alt={heroBrandDeals.altText}
                onError={heroBrandDeals.handleImageError}
                className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
