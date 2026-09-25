"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "../../../utils/cn.js";

const DEFAULT_SHOP_CATEGORIES = [
  {
    name: "Mobiles",
    slug: "mobiles",
    count: "350+ products",
    bgTint: "bg-[#E0F2FE] border-sky-200/80 hover:border-sky-400",
    image: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=300&q=80",
  },
  {
    name: "Laptops",
    slug: "laptops",
    count: "280+ products",
    bgTint: "bg-[#E0F7FA] border-cyan-200/80 hover:border-cyan-400",
    image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=300&q=80",
  },
  {
    name: "Audio",
    slug: "audio",
    count: "420+ products",
    bgTint: "bg-[#FEF3C7] border-amber-200/80 hover:border-amber-400",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=300&q=80",
  },
  {
    name: "TV & Home Appliances",
    slug: "tv-appliances",
    count: "190+ products",
    bgTint: "bg-[#F1F5F9] border-slate-300/80 hover:border-slate-400",
    image: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=300&q=80",
  },
  {
    name: "Accessories",
    slug: "accessories",
    count: "650+ products",
    bgTint: "bg-[#DCFCE7] border-emerald-200/80 hover:border-emerald-400",
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=300&q=80",
  },
  {
    name: "Smart Home",
    slug: "smart-home",
    count: "150+ products",
    bgTint: "bg-[#ECFCCB] border-lime-200/80 hover:border-lime-400",
    image: "https://images.unsplash.com/photo-1543512214-318c7553f230?auto=format&fit=crop&w=300&q=80",
  },
  {
    name: "Gaming",
    slug: "gaming",
    count: "200+ products",
    bgTint: "bg-[#F3E8FF] border-purple-200/80 hover:border-purple-400",
    image: "https://images.unsplash.com/photo-1612287233207-6f81c96a41f6?auto=format&fit=crop&w=300&q=80",
  },
  {
    name: "Fashion",
    slug: "fashion",
    count: "380+ products",
    bgTint: "bg-[#FFE4E6] border-rose-200/80 hover:border-rose-400",
    image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=300&q=80",
  },
];

export function FeaturedCategories({ initialCategories = [] }) {
  const scrollRef = useRef(null);

  // Authoritative: dynamically render database categories, using their real names, slugs, and images
  const categories = React.useMemo(() => {
    if (Array.isArray(initialCategories) && initialCategories.length > 0) {
      return initialCategories.map((cat, idx) => {
        const def =
          DEFAULT_SHOP_CATEGORIES.find(
            (d) => d.slug === cat.slug || cat.name?.toLowerCase().includes(d.slug)
          ) || DEFAULT_SHOP_CATEGORIES[idx % DEFAULT_SHOP_CATEGORIES.length];

        return {
          name: cat.name,
          slug: cat.slug || cat._id,
          count: cat.productCount ? `${cat.productCount} products` : def?.count || "Explore products",
          bgTint: def?.bgTint || "bg-[#E0F2FE] border-sky-200/80 hover:border-sky-400",
          image:
            cat.image?.url ||
            def?.image ||
            "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=300&q=80",
        };
      });
    }
    return DEFAULT_SHOP_CATEGORIES;
  }, [initialCategories]);

  const scroll = (direction) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: direction === "left" ? -280 : 280,
        behavior: "smooth",
      });
    }
  };

  return (
    <section aria-label="Shop by Category" className="py-6 sm:py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-5">
          <div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              Shop by Category
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Explore top categories and find what you need.
            </p>
          </div>
          <Link
            href="/shop"
            className="group inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-[#007A55] hover:text-[#006346] transition-colors"
          >
            <span>View All</span>
            <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Carousel / Grid */}
        <div className="relative">
          <div
            ref={scrollRef}
            className="flex items-center gap-4 sm:gap-5 overflow-x-auto scrollbar-none py-2"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {categories.map((cat) => {
              const href = `/category/${cat.slug}`;
              return (
                <Link
                  key={cat.slug}
                  href={href}
                  className="flex flex-col items-center shrink-0 w-28 sm:w-32 group/cat transition-transform duration-200 hover:-translate-y-1 text-center"
                >
                  {/* Circular pastel icon container */}
                  <div
                    className={cn(
                      "size-20 sm:size-24 rounded-full flex items-center justify-center p-3 border transition-all duration-300 shadow-2xs group-hover/cat:shadow-md",
                      cat.bgTint
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cat.image}
                      alt={cat.name}
                      className="size-full object-contain rounded-full group-hover/cat:scale-110 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                  {/* Category Name */}
                  <span className="mt-2.5 text-xs sm:text-sm font-bold text-slate-800 group-hover/cat:text-[#007A55] transition-colors line-clamp-1">
                    {cat.name}
                  </span>
                  {/* Count */}
                  <span className="text-[10px] sm:text-[11px] font-medium text-slate-400 mt-0.5">
                    {cat.count}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Right Scroll Arrow */}
          <button
            type="button"
            onClick={() => scroll("right")}
            aria-label="Scroll categories right"
            className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 size-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md hover:bg-slate-50 hover:text-[#007A55] transition-all cursor-pointer"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

export default FeaturedCategories;
