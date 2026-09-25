"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Flame, Zap, ArrowRight } from "lucide-react";
import { cn } from "../../../utils/cn.js";

const DEFAULT_HOT_THUMBNAILS = [
  {
    name: "boAt Airdopes 141",
    image: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=150&q=80",
    href: "/product/boat-airdopes-141",
  },
  {
    name: "Fire-Boltt Phoenix",
    image: "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=150&q=80",
    href: "/product/fire-boltt-phoenix-smartwatch",
  },
  {
    name: "Fire-Boltt Ninja Call",
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=150&q=80",
    href: "/product/fire-boltt-ninja-call-pro",
  },
  {
    name: "Anker Multiport Charger",
    image: "https://images.unsplash.com/photo-1622445262464-84b1456045b6?auto=format&fit=crop&w=150&q=80",
    href: "/shop?category=accessories",
  },
];

const DEFAULT_FLASH_THUMBNAILS = [
  {
    name: "HP Laptop 15s",
    image: "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=150&q=80",
    href: "/product/hp-laptop-15s",
  },
  {
    name: "Sony WH-CH520",
    image: "https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=150&q=80",
    href: "/product/sony-wh-ch520",
  },
  {
    name: "Samsung Galaxy M14",
    image: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=150&q=80",
    href: "/product/samsung-galaxy-m14-5g",
  },
  {
    name: "ASUS TUF Gaming F15",
    image: "https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=150&q=80",
    href: "/product/asus-tuf-gaming-f15",
  },
];

export function DealsPromoRow({
  hotDealsProducts = [],
  flashSaleProducts = [],
}) {
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
      const items = hotDealsProducts.slice(0, 4).map((p) => ({
        name: p.name,
        image:
          p.images?.[0]?.url ||
          p.image ||
          "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=150&q=80",
        href: p.slug ? `/product/${p.slug}` : `/product/${p._id || p.id}`,
      }));
      let padIdx = 0;
      while (items.length < 4 && DEFAULT_HOT_THUMBNAILS[padIdx]) {
        items.push(DEFAULT_HOT_THUMBNAILS[padIdx]);
        padIdx++;
      }
      return items;
    }
    return DEFAULT_HOT_THUMBNAILS;
  }, [hotDealsProducts]);

  const displayFlashThumbnails = React.useMemo(() => {
    if (Array.isArray(flashSaleProducts) && flashSaleProducts.length > 0) {
      const items = flashSaleProducts.slice(0, 4).map((p) => ({
        name: p.name,
        image:
          p.images?.[0]?.url ||
          p.image ||
          "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=150&q=80",
        href: p.slug ? `/product/${p.slug}` : `/product/${p._id || p.id}`,
      }));
      let padIdx = 0;
      while (items.length < 4 && DEFAULT_FLASH_THUMBNAILS[padIdx]) {
        items.push(DEFAULT_FLASH_THUMBNAILS[padIdx]);
        padIdx++;
      }
      return items;
    }
    return DEFAULT_FLASH_THUMBNAILS;
  }, [flashSaleProducts]);

  return (
    <section aria-label="Deals and Special Offers" className="py-4 sm:py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* 1. Today's Hot Deals */}
          <div className="relative overflow-hidden rounded-2xl border border-rose-200/80 bg-[#FFF5F5] p-5 shadow-2xs flex flex-col justify-between min-h-[290px] group hover:shadow-md transition-all">

            <div className="relative z-10">
              {/* Header */}
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-full bg-rose-100 text-rose-600 shadow-2xs">
                  <Flame className="size-4 fill-rose-500 text-rose-500" />
                </div>
                <h3 className="text-base sm:text-lg font-black tracking-tight text-slate-900">
                  Today&apos;s Hot Deals
                </h3>
                <span className="rounded-full bg-[#E02424] px-2 py-0.5 text-[9px] font-extrabold uppercase text-white shadow-2xs">
                  Limited Time Only!
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Grab the best deals before they&apos;re gone!
              </p>
            </div>

            {/* 4 Thumbnails in a row */}
            <div className="relative z-10 grid grid-cols-4 gap-2 my-4">
              {displayHotThumbnails.map((item, idx) => (
                <Link
                  key={idx}
                  href={item.href}
                  className="group/thumb flex flex-col items-center bg-white p-2 rounded-xl border border-rose-100 shadow-2xs hover:shadow-xs hover:border-rose-300 transition-all"
                >
                  <div className="size-14 sm:size-16 overflow-hidden rounded-lg flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image}
                      alt={item.name}
                      className="size-full object-contain group-hover/thumb:scale-105 transition-transform"
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
          <div className="relative overflow-hidden rounded-2xl border border-amber-200/80 bg-[#FFFBEB] p-5 shadow-2xs flex flex-col justify-between min-h-[290px] group hover:shadow-md transition-all">

            <div className="relative z-10">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-full bg-amber-100 text-amber-600 shadow-2xs">
                    <Zap className="size-4 fill-amber-500 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black tracking-tight text-slate-900">
                      Flash Sale
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md">
                    Up to 70%
                  </span>
                </div>

                {/* Dynamic Countdown Timer */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-semibold text-slate-500 mr-1">Ends in:</span>
                  <span className="rounded-md bg-white border border-amber-200 px-1.5 py-0.5 text-xs font-black text-red-600 shadow-2xs">
                    {String(timeLeft.hours).padStart(2, "0")}
                  </span>
                  <span className="text-xs font-bold text-red-600">:</span>
                  <span className="rounded-md bg-white border border-amber-200 px-1.5 py-0.5 text-xs font-black text-red-600 shadow-2xs">
                    {String(timeLeft.minutes).padStart(2, "0")}
                  </span>
                  <span className="text-xs font-bold text-red-600">:</span>
                  <span className="rounded-md bg-white border border-amber-200 px-1.5 py-0.5 text-xs font-black text-red-600 shadow-2xs">
                    {String(timeLeft.seconds).padStart(2, "0")}
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Big discounts, limited time only!
              </p>
            </div>

            {/* 4 Thumbnails */}
            <div className="relative z-10 grid grid-cols-4 gap-2 my-4">
              {displayFlashThumbnails.map((item, idx) => (
                <Link
                  key={idx}
                  href={item.href}
                  className="group/thumb flex flex-col items-center bg-white p-2 rounded-xl border border-amber-100 shadow-2xs hover:shadow-xs hover:border-amber-300 transition-all"
                >
                  <div className="size-14 sm:size-16 overflow-hidden rounded-lg flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image}
                      alt={item.name}
                      className="size-full object-contain group-hover/thumb:scale-105 transition-transform"
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

          {/* 3. Bank Offers (Image-Only Promotional Card) */}
          <Link
            href="/shop"
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
