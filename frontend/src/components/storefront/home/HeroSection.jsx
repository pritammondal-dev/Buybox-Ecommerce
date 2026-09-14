"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles, Clock } from "lucide-react";
import { Button } from "../../ui/Button.jsx";

const DEFAULT_SLIDES = [
  {
    badge: "Official Buybox Marketplace",
    title: "High-Performance Tech & Lifestyle Essentials",
    subtitle: "Explore high-fidelity audio, EDC peripherals, and smart hardware with genuine manufacturer warranties.",
    cta: "Shop Catalog",
    href: "/shop",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80",
    imageAlt: "High-performance audio headphones",
  },
];

export function HeroSection({ initialBanners = [], initialBanner = null }) {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Normalize banners from backend or fallback to default
  const banners =
    Array.isArray(initialBanners) && initialBanners.length > 0
      ? initialBanners
      : (initialBanner ? [initialBanner] : []);

  const slides =
    banners.length > 0
      ? banners.map((b) => ({
          badge: b.startsAt ? "Limited Time Campaign" : "Featured Campaign",
          title: b.title || "Buybox Featured Campaign",
          subtitle: "Genuine products, direct dispatch, and verified vendor quality.",
          cta: "Shop Now",
          href: b.linkUrl && b.linkUrl.startsWith("/") ? b.linkUrl : "/shop",
          image: b.imageUrl && !b.imageUrl.includes("example.com") ? b.imageUrl : DEFAULT_SLIDES[0].image,
          imageAlt: b.title || "Buybox Hero Banner",
          endsAt: b.endsAt ? new Date(b.endsAt) : null,
        }))
      : DEFAULT_SLIDES;

  const current = slides[currentSlide] || slides[0];

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  return (
    <section aria-label="Hero Banner" className="py-6 sm:py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Warm Hero Cream Container from Buybox Design System */}
        <div className="relative overflow-hidden rounded-[28px] bg-[#FFF8D6] p-8 sm:p-12 lg:p-16 shadow-xs border border-amber-200/60">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Column: Headline, Supporting Copy, Action Button */}
            <div className="lg:col-span-7 space-y-5 text-center lg:text-left z-10">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3.5 py-1 text-xs font-bold text-slate-800 backdrop-blur-xs border border-amber-200/50">
                <Sparkles className="size-3.5 text-amber-500" />
                <span>{current.badge}</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-950 leading-[1.1] sm:leading-[1.15]">
                {current.title}
              </h1>

              <p className="mx-auto lg:mx-0 max-w-lg text-sm sm:text-base font-normal text-slate-600 leading-relaxed">
                {current.subtitle}
              </p>

              {/* Timing info if real endsAt is provided by backend */}
              {current.endsAt && (
                <div className="flex items-center justify-center lg:justify-start gap-1.5 text-xs font-semibold text-slate-700">
                  <Clock className="size-3.5 text-[#007A55]" />
                  <span>Valid until: {current.endsAt.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}</span>
                </div>
              )}

              {/* Emerald Teal Pill CTA Button */}
              <div className="pt-2 flex justify-center lg:justify-start">
                <Button
                  asChild
                  size="lg"
                  className="rounded-full bg-[#007A55] text-white hover:bg-[#006346] font-bold text-sm px-8 py-3.5 shadow-sm gap-2 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <Link href={current.href}>
                    <span>{current.cta}</span>
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </div>

            {/* Right Media Container */}
            <div className="lg:col-span-5 flex justify-center z-10">
              <div className="relative w-full max-w-md aspect-[4/3] sm:aspect-square rounded-2xl overflow-hidden shadow-card border border-amber-100 bg-white/60 backdrop-blur-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={current.image}
                  alt={current.imageAlt}
                  className="size-full object-cover object-center transition-transform duration-700 hover:scale-105"
                  loading="eager"
                />
              </div>
            </div>
          </div>

          {/* Slider Controls (if multiple slides exist) */}
          {slides.length > 1 && (
            <>
              <button
                type="button"
                onClick={prevSlide}
                aria-label="Previous slide"
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex size-9 items-center justify-center rounded-full bg-slate-900 text-white shadow-md hover:bg-slate-800 transition-transform active:scale-95 cursor-pointer"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={nextSlide}
                aria-label="Next slide"
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex size-9 items-center justify-center rounded-full bg-slate-900 text-white shadow-md hover:bg-slate-800 transition-transform active:scale-95 cursor-pointer"
              >
                <ChevronRight className="size-5" />
              </button>

              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
                {slides.map((_, i) => (
                  <button
                    key={`hero-dot-${i}`}
                    type="button"
                    onClick={() => setCurrentSlide(i)}
                    aria-label={`Go to slide ${i + 1}`}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      i === currentSlide
                        ? "w-8 bg-[#007A55]"
                        : "w-2 bg-slate-300 hover:bg-slate-400"
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
