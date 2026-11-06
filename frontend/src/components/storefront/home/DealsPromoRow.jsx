"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Flame, Zap, ArrowRight } from "lucide-react";
import { cn } from "../../../utils/cn.js";
import { useStorefrontSettings } from "../../../hooks/useStorefrontSettings.js";

export function DealsPromoRow({
  hotDealsProducts = [],
  flashSaleProducts = [],
}) {
  const { isFeatureEnabled } = useStorefrontSettings();
  const flashSaleEnabled = isFeatureEnabled("flashSale");

  // Real-time countdown timer for Flash Sale
  const [timeLeft, setTimeLeft] = useState({ hours: 2, minutes: 14, seconds: 26 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: 59, seconds: 59 };
        } else if (prev.hours > 0) {
          return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        }
        return { hours: 2, minutes: 14, seconds: 26 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const displayHotThumbnails = React.useMemo(() => {
    if (Array.isArray(hotDealsProducts) && hotDealsProducts.length > 0) {
      return hotDealsProducts
        .slice(0, 4)
        .map((p) => ({
          name: p.name,
          image:
            p.images?.[0]?.url ||
            (typeof p.images?.[0] === "string" ? p.images[0] : null) ||
            p.image ||
            "",
          href: p.slug ? `/product/${p.slug}` : `/product/${p._id || p.id}`,
        }))
        .filter((item) => item.image);
    }
    return [];
  }, [hotDealsProducts]);

  const displayFlashThumbnails = React.useMemo(() => {
    if (!flashSaleEnabled) return [];
    if (Array.isArray(flashSaleProducts) && flashSaleProducts.length > 0) {
      return flashSaleProducts
        .slice(0, 4)
        .map((p) => ({
          name: p.name,
          image:
            p.images?.[0]?.url ||
            (typeof p.images?.[0] === "string" ? p.images[0] : null) ||
            p.image ||
            "",
          href: p.slug ? `/product/${p.slug}` : `/product/${p._id || p.id}`,
        }))
        .filter((item) => item.image);
    }
    return [];
  }, [flashSaleProducts, flashSaleEnabled]);

  if (displayHotThumbnails.length === 0 && displayFlashThumbnails.length === 0) {
    return null;
  }

  return (
    <section aria-label="Deals and Special Offers" className="py-4 sm:py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* 1. Today's Hot Deals */}
          <div className="relative overflow-hidden rounded-2xl border border-rose-200/80 bg-[#FFF5F5] p-5 shadow-2xs flex flex-col justify-between min-h-[290px] group hover:shadow-md transition-all">
            <div className="relative z-10">
              {/* Header */}
              <div className="flex items-center gap-2">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 shadow-2xs">
                  <Flame className="size-4 fill-rose-500 text-rose-500" />
                </div>
                <h3 className="text-base sm:text-lg font-black tracking-tight text-slate-900">
                  Today&apos;s Hot Deals
                </h3>
                <span className="shrink-0 rounded-full bg-[#E02424] px-2 py-0.5 text-[9px] font-extrabold uppercase text-white shadow-2xs">
                  Limited Time Only!
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Grab the best deals before they&apos;re gone!
              </p>
            </div>

            {/* 4 Thumbnails in a responsive row */}
            <div className="relative z-10 grid grid-cols-4 gap-2.5 my-4">
              {displayHotThumbnails.map((item, idx) => (
                <Link
                  key={idx}
                  href={item.href}
                  title={item.name}
                  aria-label={item.name}
                  className="group/thumb relative flex items-center justify-center w-full aspect-square rounded-xl bg-white p-2 border border-rose-100/90 shadow-2xs hover:shadow-xs hover:border-rose-300 hover:scale-[1.03] transition-all"
                >
                  <div className="relative w-full h-full rounded-lg bg-slate-50/70 p-1 flex items-center justify-center overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image}
                      alt={item.name || "Today's hot deal product"}
                      className="max-h-full max-w-full object-contain group-hover/thumb:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                </Link>
              ))}
            </div>

            {/* Link */}
            <div className="relative z-10">
              <Link
                href="/shop?sort=discount"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 transition-colors"
              >
                <span>View All Deals</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>

          {/* 2. Flash Sale */}
          {flashSaleEnabled && (
            <div className="relative overflow-hidden rounded-2xl border border-amber-200/80 bg-[#FFFBEB] p-5 shadow-2xs flex flex-col justify-between min-h-[290px] group hover:shadow-md transition-all">
              <div className="relative z-10">
                {/* Header with responsive wrapping protection */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 shadow-2xs">
                      <Zap className="size-4 fill-amber-500 text-amber-500" />
                    </div>
                    <h3 className="text-base sm:text-lg font-black tracking-tight text-slate-900 truncate">
                      Flash Sale
                    </h3>
                    <span className="shrink-0 rounded-full bg-amber-100/90 border border-amber-200/60 px-2 py-0.5 text-[9px] font-extrabold uppercase text-amber-800 shadow-2xs">
                      Up to 70%
                    </span>
                  </div>

                  {/* Dynamic Countdown Timer with tabular-nums to prevent jitter */}
                  <div className="flex shrink-0 items-center gap-1 rounded-lg bg-white/95 px-2 py-1 border border-amber-200 shadow-2xs">
                    <span className="text-[10px] font-semibold text-slate-500 mr-0.5">Ends in:</span>
                    <span className="min-w-[16px] text-center font-mono text-xs font-black text-red-600 tabular-nums">
                      {String(timeLeft.hours).padStart(2, "0")}
                    </span>
                    <span className="text-xs font-bold text-red-600">:</span>
                    <span className="min-w-[16px] text-center font-mono text-xs font-black text-red-600 tabular-nums">
                      {String(timeLeft.minutes).padStart(2, "0")}
                    </span>
                    <span className="text-xs font-bold text-red-600">:</span>
                    <span className="min-w-[16px] text-center font-mono text-xs font-black text-red-600 tabular-nums">
                      {String(timeLeft.seconds).padStart(2, "0")}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Big discounts, limited time only!
                </p>
              </div>

              {/* 4 Thumbnails in a responsive row */}
              <div className="relative z-10 grid grid-cols-4 gap-2.5 my-4">
                {displayFlashThumbnails.map((item, idx) => (
                  <Link
                    key={idx}
                    href={item.href}
                    title={item.name}
                    aria-label={item.name}
                    className="group/thumb relative flex items-center justify-center w-full aspect-square rounded-xl bg-white p-2 border border-amber-100/90 shadow-2xs hover:shadow-xs hover:border-amber-300 hover:scale-[1.03] transition-all"
                  >
                    <div className="relative w-full h-full rounded-lg bg-slate-50/70 p-1 flex items-center justify-center overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.image}
                        alt={item.name || "Flash sale product"}
                        className="max-h-full max-w-full object-contain group-hover/thumb:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>
                  </Link>
                ))}
              </div>

              {/* Link */}
              <div className="relative z-10">
                <Link
                  href="/shop?sort=discount"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-800 transition-colors"
                >
                  <span>View All Flash Sale</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>
          )}

          {/* 3. Bank Offers (Image-Only Promotional Card) */}
          <Link
            href="/campaigns"
            id="deals-promo-bank-offers-link"
            className="relative block overflow-hidden rounded-2xl md:col-span-2 lg:col-span-1 min-h-[280px] sm:min-h-[290px] shadow-2xs group hover:shadow-md transition-all border border-slate-200/80 bg-slate-100"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/banners/banner-bank-offers.svg"
              alt="Bank & Partner Offers - Up to ₹5,000 Instant Discount"
              className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          </Link>
        </div>
      </div>
    </section>
  );
}

export default DealsPromoRow;
