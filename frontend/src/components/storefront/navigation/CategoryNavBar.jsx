"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  ChevronRight,
  ChevronLeft,
  Smartphone,
  Laptop,
  Headphones,
  Tv,
  Watch,
  Home as HomeIcon,
  Gamepad2,
  Shirt,
  MoreHorizontal,
  Package,
} from "lucide-react";
import { cn } from "../../../utils/cn.js";

const CATEGORY_ICON_MAP = {
  mobiles: Smartphone,
  laptops: Laptop,
  audio: Headphones,
  "audio-headphones": Headphones,
  "tv-appliances": Tv,
  accessories: Watch,
  "smart-home": HomeIcon,
  "smart-home-power": HomeIcon,
  gaming: Gamepad2,
  "gaming-hardware": Gamepad2,
  fashion: Shirt,
  "keyboards-peripherals": Laptop,
  "displays-monitors": Tv,
  "minimalist-gear-edc": Package,
};

const DEFAULT_CATEGORY_ITEMS = [
  { name: "Mobiles", slug: "mobiles", icon: Smartphone, image: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=120&q=80" },
  { name: "Laptops", slug: "laptops", icon: Laptop, image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=120&q=80" },
  { name: "Audio", slug: "audio", icon: Headphones, image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=120&q=80" },
  { name: "TV & Home Appliances", slug: "tv-appliances", icon: Tv, image: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=120&q=80" },
  { name: "Accessories", slug: "accessories", icon: Watch, image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=120&q=80" },
  { name: "Smart Home", slug: "smart-home", icon: HomeIcon, image: "https://images.unsplash.com/photo-1543512214-318c7553f230?auto=format&fit=crop&w=120&q=80" },
  { name: "Gaming", slug: "gaming", icon: Gamepad2, image: "https://images.unsplash.com/photo-1612287233207-6f81c96a41f6?auto=format&fit=crop&w=120&q=80" },
  { name: "Fashion", slug: "fashion", icon: Shirt, image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=120&q=80" },
];

export function CategoryNavBar({ categories = [], onOpenDrawer, className }) {
  const pathname = usePathname();
  const scrollContainerRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Dynamically resolve ALL backend categories without hardcoding
  const displayItems = React.useMemo(() => {
    if (!categories || categories.length === 0) {
      return DEFAULT_CATEGORY_ITEMS;
    }

    // Prefer top-level categories if parentId hierarchy exists, otherwise use all
    const rootCategories = categories.filter((c) => !c.parentId);
    const sourceList = rootCategories.length > 0 ? rootCategories : categories;

    return sourceList.map((cat) => {
      const slug = cat.slug || cat._id;
      const matchedDef = DEFAULT_CATEGORY_ITEMS.find(
        (d) => d.slug === slug || cat.name?.toLowerCase().includes(d.slug)
      );
      const icon = CATEGORY_ICON_MAP[slug] || matchedDef?.icon || Package;
      const image = cat.image?.url || matchedDef?.image || null;

      return {
        id: cat._id || cat.id,
        name: cat.name,
        slug: slug,
        icon,
        image,
      };
    });
  }, [categories]);

  // Update scroll boundary states
  const updateScrollState = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateScrollState();
    window.addEventListener("resize", updateScrollState);
    return () => window.removeEventListener("resize", updateScrollState);
  }, [displayItems, updateScrollState]);

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const distance = direction === "left" ? -280 : 280;
      scrollContainerRef.current.scrollBy({
        left: distance,
        behavior: "smooth",
      });
      // Defer scroll boundary check
      setTimeout(updateScrollState, 350);
    }
  };

  return (
    <div
      className={cn(
        "w-full bg-white border-b border-slate-200/90 relative z-20 shadow-2xs",
        className
      )}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 gap-2 sm:gap-3">
        {/* Left: All Categories Pill Button (matching mockup) */}
        <button
          type="button"
          onClick={onOpenDrawer}
          suppressHydrationWarning
          aria-haspopup="dialog"
          aria-label="Open all categories side drawer"
          className="flex items-center gap-2 rounded-full bg-[#004D38] px-3.5 sm:px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#003B2B] active:scale-95 transition-all cursor-pointer shrink-0 group ring-1 ring-emerald-500/30"
        >
          <Menu className="size-4 stroke-[2.5]" />
          <span className="hidden sm:inline">All Categories</span>
          <span className="sm:hidden">All</span>
          <ChevronRight className="size-3.5 opacity-70 group-hover:translate-x-0.5 transition-transform" />
        </button>

        {/* Left Scroll Navigation Arrow */}
        <button
          type="button"
          onClick={() => scroll("left")}
          disabled={!canScrollLeft}
          suppressHydrationWarning
          aria-label="Scroll categories left"
          className={cn(
            "hidden md:flex size-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-all shrink-0 shadow-2xs",
            canScrollLeft
              ? "hover:bg-slate-50 hover:text-[#007A55] cursor-pointer opacity-100"
              : "opacity-30 cursor-not-allowed border-slate-100 text-slate-300"
          )}
        >
          <ChevronLeft className="size-4" />
        </button>

        {/* Center: Scrollable Category Items with Image/Icon & Label */}
        <div className="relative flex-1 overflow-hidden min-w-0">
          <div
            ref={scrollContainerRef}
            onScroll={updateScrollState}
            className="flex items-center gap-4 sm:gap-6 lg:gap-8 overflow-x-auto scrollbar-none py-1 scroll-smooth"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {displayItems.map((cat) => {
              const href = `/category/${cat.slug || cat.id}`;
              const isActive = pathname === href;
              const Icon = cat.icon || Package;

              return (
                <Link
                  key={cat.id || cat.slug || cat.name}
                  href={href}
                  className={cn(
                    "flex flex-col items-center gap-1 shrink-0 group/cat py-1 transition-all",
                    isActive ? "text-[#007A55] font-bold" : "text-slate-700 hover:text-[#007A55]"
                  )}
                >
                  <div
                    className={cn(
                      "size-8 rounded-lg flex items-center justify-center overflow-hidden transition-all duration-200",
                      isActive
                        ? "ring-2 ring-[#007A55] bg-emerald-50 shadow-xs"
                        : "bg-slate-100 group-hover/cat:bg-emerald-50 group-hover/cat:scale-105"
                    )}
                  >
                    {cat.image ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={cat.image}
                        alt={cat.name}
                        className="size-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <Icon className="size-4 text-slate-600 group-hover/cat:text-[#007A55]" />
                    )}
                  </div>
                  <span className="text-[11px] font-semibold whitespace-nowrap tracking-tight">
                    {cat.name}
                  </span>
                </Link>
              );
            })}

            {/* More item */}
            <button
              type="button"
              onClick={onOpenDrawer}
              suppressHydrationWarning
              className="flex flex-col items-center gap-1 shrink-0 group/more py-1 text-slate-700 hover:text-[#007A55] cursor-pointer"
            >
              <div className="size-8 rounded-lg bg-slate-100 flex items-center justify-center group-hover/more:bg-emerald-50 group-hover/more:scale-105 transition-all">
                <MoreHorizontal className="size-4 text-slate-600 group-hover/more:text-[#007A55]" />
              </div>
              <span className="text-[11px] font-semibold whitespace-nowrap">More</span>
            </button>
          </div>
        </div>

        {/* Right Scroll Navigation Arrow */}
        <button
          type="button"
          onClick={() => scroll("right")}
          disabled={!canScrollRight}
          suppressHydrationWarning
          aria-label="Scroll categories right"
          className={cn(
            "hidden md:flex size-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-all shrink-0 shadow-2xs",
            canScrollRight
              ? "hover:bg-slate-50 hover:text-[#007A55] cursor-pointer opacity-100"
              : "opacity-30 cursor-not-allowed border-slate-100 text-slate-300"
          )}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

export default CategoryNavBar;
