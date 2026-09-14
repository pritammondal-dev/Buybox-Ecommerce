"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function BentoPromoGrid() {
  return (
    <section aria-label="Featured Highlights" className="py-8 sm:py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Card 1: Large Pastel Pink Card (Studio & Wireless Audio) */}
          <div className="md:col-span-6 rounded-[28px] bg-[#FCE7F3] p-8 sm:p-10 flex flex-col justify-between relative overflow-hidden border border-pink-200/60 shadow-xs">
            <div className="max-w-xs space-y-3 z-10">
              <span className="inline-block rounded-full bg-white/90 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-pink-700 backdrop-blur-xs">
                Studio Acoustics
              </span>
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950 leading-tight">
                Precision Studio & Wireless Audio
              </h3>
              <p className="text-xs sm:text-sm text-slate-600">
                Immerse yourself in high-fidelity sound, deep acoustics, and genuine manufacturer warranties.
              </p>
              <div className="pt-3">
                <Link
                  href="/shop"
                  className="inline-flex items-center gap-2 rounded-full bg-[#007A55] px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#006346] transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <span>Explore Gear</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>

            <div className="absolute right-0 bottom-0 w-1/2 max-w-[240px] pointer-events-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=500&q=80"
                alt="Studio headphones"
                className="w-full object-contain"
                loading="lazy"
              />
            </div>
          </div>

          {/* Card 2 & 3: Two Stacked / Side Cards */}
          <div className="md:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Card 2: Warm Pastel Yellow Card (Smart Tech & Displays) */}
            <div className="rounded-[24px] bg-[#FEF9C3] p-6 flex flex-col justify-between relative overflow-hidden border border-yellow-300/60 shadow-xs">
              <div className="space-y-2 z-10">
                <span className="inline-block rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-800">
                  Smart Tech
                </span>
                <h4 className="text-xl font-black tracking-tight text-slate-950">
                  Displays & Smart Gear
                </h4>
                <p className="text-xs text-slate-600">
                  Productivity hardware and smart desk upgrades.
                </p>
                <div className="pt-2">
                  <Link
                    href="/category/electronics"
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#007A55] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#006346] transition-transform hover:scale-105 cursor-pointer"
                  >
                    <span>View Category</span>
                    <ArrowRight className="size-3" />
                  </Link>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=400&q=80"
                  alt="Displays and electronics"
                  className="h-28 w-auto object-contain rounded-lg"
                  loading="lazy"
                />
              </div>
            </div>

            {/* Card 3: Soft Pastel Sky Blue Card (Everyday Peripherals) */}
            <div className="rounded-[24px] bg-[#E0F2FE] p-6 flex flex-col justify-between relative overflow-hidden border border-sky-300/60 shadow-xs">
              <div className="space-y-2 z-10">
                <span className="inline-block rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-sky-800">
                  Peripherals
                </span>
                <h4 className="text-xl font-black tracking-tight text-slate-950">
                  Minimalist Hardware
                </h4>
                <p className="text-xs text-slate-600">
                  Mechanical keyboards and precision peripherals.
                </p>
                <div className="pt-2">
                  <Link
                    href="/shop"
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#007A55] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#006346] transition-transform hover:scale-105 cursor-pointer"
                  >
                    <span>Browse All</span>
                    <ArrowRight className="size-3" />
                  </Link>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=400&q=80"
                  alt="Hardware peripherals"
                  className="h-28 w-auto object-contain rounded-lg"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default BentoPromoGrid;
