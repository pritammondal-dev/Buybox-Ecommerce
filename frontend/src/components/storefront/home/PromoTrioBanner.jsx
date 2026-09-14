"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function PromoTrioBanner() {
  const BANNERS = [
    {
      bg: "bg-[#DCFCE7]",
      borderColor: "border-emerald-200/60",
      badgeBg: "bg-emerald-100 text-emerald-800",
      badge: "Extra 20% Savings",
      title: "Style That Speaks You",
      subtitle: "Discover the latest casual collections.",
      image: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=400&q=80",
    },
    {
      bg: "bg-[#FCE7F3]",
      borderColor: "border-pink-200/60",
      badgeBg: "bg-pink-100 text-pink-800",
      badge: "Fresh Looks, Every Season",
      title: "Fresh Looks, Every Season",
      subtitle: "Effortless elegance for every moment.",
      image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80",
    },
    {
      bg: "bg-[#FEF08A]",
      borderColor: "border-yellow-200/60",
      badgeBg: "bg-yellow-100 text-yellow-800",
      badge: "Fresh Looks, Every Season",
      title: "Fresh Looks, Every Season",
      subtitle: "Bright styles curated for your everyday.",
      image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
    },
  ];

  return (
    <section aria-label="Promotional Collection Highlights" className="py-8 sm:py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {BANNERS.map((banner, idx) => (
            <div
              key={`trio-${idx}`}
              className={`rounded-[26px] ${banner.bg} p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden border ${banner.borderColor} shadow-xs`}
            >
              <div className="space-y-2.5 z-10 max-w-[200px]">
                <span className={`inline-block rounded-full ${banner.badgeBg} px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider`}>
                  {banner.badge}
                </span>

                <h3 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950 leading-tight">
                  {banner.title}
                </h3>

                <p className="text-xs text-slate-600">
                  {banner.subtitle}
                </p>

                <div className="pt-2">
                  <Link
                    href="/shop"
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#007A55] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#006346] transition-transform hover:scale-105 active:scale-95"
                  >
                    <span>Shop Now</span>
                    <ArrowRight className="size-3" />
                  </Link>
                </div>
              </div>

              <div className="absolute right-2 bottom-0 w-36 sm:w-40 pointer-events-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={banner.image}
                  alt={banner.title}
                  className="w-full object-contain"
                  loading="lazy"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default PromoTrioBanner;
