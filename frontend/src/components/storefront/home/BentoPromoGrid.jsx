"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useCategoryStore } from "../../../stores/category.store.js";

export function BentoPromoGrid({ categories = [] }) {
  const storeCategories = useCategoryStore((state) => state.categories);
  const allCategories = categories.length > 0 ? categories : storeCategories;

  // Resolve authentic categories from backend API without hardcoding non-existent routes
  const audioCategory = allCategories.find((c) =>
    (c.slug || "").includes("audio") || (c.name || "").toLowerCase().includes("audio")
  );
  const displayCategory = allCategories.find((c) =>
    (c.slug || "").includes("display") || (c.name || "").toLowerCase().includes("display")
  );
  const techCategory = allCategories.find((c) =>
    (c.slug || "").includes("gear") ||
    (c.slug || "").includes("edc") ||
    (c.slug || "").includes("keyboard")
  );

  const audioHref = audioCategory ? `/category/${audioCategory.slug || audioCategory._id}` : "/shop";
  const displayHref = displayCategory ? `/category/${displayCategory.slug || displayCategory._id}` : "/shop";
  const techHref = techCategory ? `/category/${techCategory.slug || techCategory._id}` : "/shop";

  return (
    <section aria-label="Promotional Highlights" className="py-4 sm:py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5">
          {/* Tile 1: Studio Audio & Acoustic Gear (Refined Soft Rose) */}
          <div className="md:col-span-6 rounded-3xl bg-rose-50/50 p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden border border-rose-200/60 shadow-xs">
            <div className="max-w-sm space-y-2.5 z-10">
              <span className="inline-block rounded-full bg-white/95 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-rose-700 backdrop-blur-xs shadow-2xs border border-rose-100">
                {audioCategory ? audioCategory.name : "Studio Acoustics"}
              </span>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950 leading-tight">
                Precision Studio & Wireless Audio
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Audiophile open-back monitors, noise-canceling headsets, and low-latency wireless hardware.
              </p>
              <div className="pt-2">
                <Link
                  href={audioHref}
                  className="group inline-flex items-center gap-2 rounded-full bg-[#007A55] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#006346] transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <span>Explore Audio</span>
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>

            <div className="mt-4 sm:mt-0 flex justify-end md:absolute md:right-3 md:bottom-2 md:w-5/12 max-w-[200px] pointer-events-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=450&q=80"
                alt="Studio audio hardware"
                className="w-full object-contain drop-shadow-sm transition-transform duration-500 hover:scale-105"
                loading="lazy"
              />
            </div>
          </div>

          {/* Tiles 2 & 3: Displays & Minimalist Hardware */}
          <div className="md:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            {/* Tile 2: Displays & Smart Monitors (Refined Warm Amber/Cream) */}
            <div className="rounded-3xl bg-amber-50/50 p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden border border-amber-200/60 shadow-xs">
              <div className="space-y-2 z-10">
                <span className="inline-block rounded-full bg-white/95 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-800 shadow-2xs border border-amber-100">
                  {displayCategory ? displayCategory.name : "Displays"}
                </span>
                <h4 className="text-base sm:text-lg font-black tracking-tight text-slate-950">
                  Displays & Smart Gear
                </h4>
                <p className="text-xs text-slate-600 line-clamp-2">
                  Color-accurate 4K panels and asymmetric monitor screenbars.
                </p>
                <div className="pt-1.5">
                  <Link
                    href={displayHref}
                    className="group inline-flex items-center gap-1.5 rounded-full bg-[#007A55] px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#006346] transition-transform hover:scale-105 cursor-pointer"
                  >
                    <span>View Category</span>
                    <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </div>

              <div className="mt-3 flex justify-end">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=350&q=80"
                  alt="High-resolution display monitor"
                  className="h-24 w-auto object-contain rounded-lg drop-shadow-xs"
                  loading="lazy"
                />
              </div>
            </div>

            {/* Tile 3: Minimalist Gear & Peripherals (Refined Soft Mint/Sky) */}
            <div className="rounded-3xl bg-sky-50/50 p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden border border-sky-200/60 shadow-xs">
              <div className="space-y-2 z-10">
                <span className="inline-block rounded-full bg-white/95 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-sky-800 shadow-2xs border border-sky-100">
                  {techCategory ? techCategory.name : "Hardware"}
                </span>
                <h4 className="text-base sm:text-lg font-black tracking-tight text-slate-950">
                  Minimalist Hardware
                </h4>
                <p className="text-xs text-slate-600 line-clamp-2">
                  Titanium precision drivers and mechanical switch accessories.
                </p>
                <div className="pt-1.5">
                  <Link
                    href={techHref}
                    className="group inline-flex items-center gap-1.5 rounded-full bg-[#007A55] px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#006346] transition-transform hover:scale-105 cursor-pointer"
                  >
                    <span>Explore Hardware</span>
                    <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </div>

              <div className="mt-3 flex justify-end">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?auto=format&fit=crop&w=350&q=80"
                  alt="Precision hardware tools"
                  className="h-24 w-auto object-contain rounded-lg drop-shadow-xs"
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
