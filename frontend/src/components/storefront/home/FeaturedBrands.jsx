"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Store, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { brandService } from "../../../services/brand.service.js";

const DEFAULT_MOCKUP_BRANDS = [
  { name: "SAMSUNG", slug: "samsung", style: "font-black tracking-widest text-blue-700 text-sm sm:text-base" },
  { name: " Apple", slug: "apple", style: "font-bold text-slate-900 text-sm sm:text-base" },
  { name: "Lenovo", slug: "lenovo", style: "font-black text-white bg-red-600 px-2 py-0.5 rounded text-xs tracking-wider" },
  { name: "hp", slug: "hp", style: "font-black italic text-blue-600 text-base sm:text-lg border-2 border-blue-600 rounded-full px-2" },
  { name: "ASUS", slug: "asus", style: "font-black tracking-wider text-slate-800 text-sm sm:text-base" },
  { name: "boAt", slug: "boat", style: "font-black text-red-600 tracking-tight text-sm sm:text-base" },
  { name: "realme", slug: "realme", style: "font-bold text-slate-900 bg-amber-400 px-2 py-0.5 rounded text-xs" },
  { name: "intel", slug: "intel", style: "font-bold text-blue-600 tracking-tight text-sm sm:text-base" },
];

export function FeaturedBrands({ initialBrands = [] }) {
  const [brands, setBrands] = useState(initialBrands);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (initialBrands.length > 0) return;
    let isMounted = true;
    brandService
      .getBrands({ limit: 16 })
      .then((res) => {
        if (!isMounted) return;
        const list = res?.data?.brands || (Array.isArray(res?.data) ? res.data : []);
        setBrands(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!isMounted) return;
        setBrands([]);
      });
    return () => {
      isMounted = false;
    };
  }, [initialBrands.length]);

  const displayBrands = React.useMemo(() => {
    if (brands.length >= 6) {
      return brands.map((b) => ({
        name: b.name,
        slug: b.slug || b._id,
        logo: b.logo?.url || null,
        style: "font-black tracking-wide text-slate-800 text-xs sm:text-sm",
      }));
    }
    return DEFAULT_MOCKUP_BRANDS;
  }, [brands]);

  const scroll = (direction) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: direction === "left" ? -280 : 280,
        behavior: "smooth",
      });
    }
  };

  return (
    <section id="brands" aria-label="Shop by Brand" className="py-4 sm:py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl p-4 sm:p-6 md:p-7 shadow-xs border border-sky-200/80 bg-[#F0F7FF] transition-all duration-300">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 sm:pb-5 border-b border-sky-200/60">
            <div className="flex items-center gap-3">
              <div className="flex size-9 sm:size-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 shadow-2xs shrink-0">
                <Store className="size-5 stroke-[2]" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl md:text-2xl font-black tracking-tight text-slate-900">
                  Shop by Brand
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  Top brands you can trust.
                </p>
              </div>
            </div>
            <Link
              href="/shop#brands"
              className="group inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-[#007A55] hover:text-[#006346] transition-colors shrink-0 self-end sm:self-auto"
            >
              <span>View All Brands</span>
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          {/* Carousel */}
          <div className="relative group/brandcar pt-4 sm:pt-5">
            {/* Scroll Left */}
            <button
              type="button"
              onClick={() => scroll("left")}
              aria-label="Scroll brands left"
              className="hidden md:flex absolute -left-3.5 top-1/2 -translate-y-1/2 z-10 size-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md hover:bg-slate-50 hover:text-[#007A55] transition-all cursor-pointer"
            >
              <ChevronLeft className="size-4" />
            </button>

            {/* Brands Track */}
            <div
              ref={scrollRef}
              className="flex items-center gap-3 sm:gap-4 overflow-x-auto scrollbar-none py-1 px-0.5"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {displayBrands.map((brand, idx) => (
                <Link
                  key={idx}
                  href={`/shop?brand=${brand.slug}`}
                  className="group/bcard flex h-14 sm:h-16 w-32 sm:w-36 shrink-0 items-center justify-center rounded-2xl border border-slate-200/80 bg-white p-3 text-center shadow-2xs transition-all duration-300 hover:border-[#007A55]/60 hover:shadow-card hover:-translate-y-0.5 cursor-pointer"
                >
                  {brand.logo ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={brand.logo}
                      alt={brand.name}
                      className="max-h-7 max-w-full object-contain grayscale transition-all duration-300 group-hover/bcard:grayscale-0"
                      loading="lazy"
                    />
                  ) : (
                    <span className={brand.style || "font-bold text-xs text-slate-800"}>
                      {brand.name}
                    </span>
                  )}
                </Link>
              ))}
            </div>

            {/* Scroll Right */}
            <button
              type="button"
              onClick={() => scroll("right")}
              aria-label="Scroll brands right"
              className="hidden md:flex absolute -right-3.5 top-1/2 -translate-y-1/2 z-10 size-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md hover:bg-slate-50 hover:text-[#007A55] transition-all cursor-pointer"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default FeaturedBrands;
