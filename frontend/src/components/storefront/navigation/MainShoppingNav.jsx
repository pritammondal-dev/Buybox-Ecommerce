"use client";

import React, { Suspense, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Flame,
  Sparkles,
  Trophy,
  ShieldCheck,
  Compass,
  Home,
  MoreHorizontal,
  ChevronDown,
  Store,
  Headphones,
  HelpCircle,
  ArrowRight,
} from "lucide-react";
import { cn } from "../../../utils/cn.js";

function MainShoppingNavBase({ pathname = "/", currentSort = null, className }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);

  // Close More menu on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (moreRef.current && !moreRef.current.contains(event.target)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close More menu on Escape key
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setMoreOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const NAV_ITEMS = [
    {
      label: "Home",
      href: "/",
      icon: Home,
      isActive: pathname === "/" && !currentSort,
    },
    {
      label: "Today's Deals",
      href: "/deals",
      icon: Flame,
      iconColor: "text-amber-300 fill-amber-300",
      badge: "HOT",
      badgeColor: "bg-[#E02424] text-white",
      isActive: pathname === "/deals",
    },
    {
      label: "Flash Sale",
      href: "/flash-sale",
      icon: Sparkles,
      iconColor: "text-amber-300",
      badge: "LIVE",
      badgeColor: "bg-amber-400 text-slate-950",
      isActive: pathname === "/flash-sale",
    },
    {
      label: "Coupons",
      href: "/coupons",
      icon: Sparkles,
      iconColor: "text-emerald-300",
      isActive: pathname === "/coupons",
    },
    {
      label: "Compare Gear",
      href: "/compare",
      icon: Trophy,
      iconColor: "text-amber-300",
      isActive: pathname === "/compare",
    },
    {
      label: "Explore Catalog",
      href: "/shop",
      icon: Compass,
      iconColor: "text-emerald-300",
      isActive: pathname === "/shop" && !currentSort,
    },
  ];

  return (
    <nav
      aria-label="Main shopping navigation"
      className={cn(
        "w-full bg-[#004D38] border-b border-emerald-900/60 text-xs font-semibold select-none text-white",
        className
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className="flex items-center justify-between gap-1 sm:gap-2 py-2"
        >
          {/* Scrollable primary navigation items */}
          <div
            className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none flex-1 min-w-0"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-all whitespace-nowrap shrink-0 text-xs",
                    item.isActive
                      ? "bg-[#007A55] text-white font-bold shadow-2xs ring-1 ring-emerald-400/30"
                      : "text-emerald-100/90 hover:text-white hover:bg-emerald-800/50"
                  )}
                >
                  {Icon && (
                    <Icon
                      className={cn(
                        "size-3.5 shrink-0",
                        item.iconColor || "text-emerald-200"
                      )}
                    />
                  )}
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      className={cn(
                        "rounded-xs px-1.5 py-0.2 text-[9px] font-extrabold uppercase tracking-wide shadow-2xs ml-0.5",
                        item.badgeColor
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* More Menu Dropdown */}
          <div ref={moreRef} className="relative shrink-0 ml-2">
            <button
              type="button"
              id="second-nav-more-button"
              onClick={() => setMoreOpen((prev) => !prev)}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              aria-label="More navigation options"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-all whitespace-nowrap text-xs cursor-pointer",
                moreOpen
                  ? "bg-[#007A55] text-white font-bold shadow-2xs ring-1 ring-emerald-400/30"
                  : "text-emerald-100/90 hover:text-white hover:bg-emerald-800/50"
              )}
            >
              <MoreHorizontal className="size-3.5 text-emerald-200" />
              <span>More</span>
              <ChevronDown
                className={cn(
                  "size-3 text-emerald-300 transition-transform duration-200",
                  moreOpen && "rotate-180"
                )}
              />
            </button>

            {moreOpen && (
              <div
                role="menu"
                aria-orientation="vertical"
                aria-labelledby="second-nav-more-button"
                className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-2 text-slate-900 shadow-elevated z-50 animate-in fade-in-50 zoom-in-95"
              >
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                  More Options
                </div>

                <Link
                  href="/vendor/login"
                  role="menuitem"
                  id="more-menu-become-vendor"
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center justify-between gap-3 rounded-xl p-2.5 text-xs transition-colors hover:bg-emerald-50/80 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100/80 text-[#007A55] group-hover:bg-[#007A55] group-hover:text-white transition-colors">
                      <Store className="size-4" />
                    </div>
                    <div className="min-w-0 text-left">
                      <div className="font-bold text-slate-900 group-hover:text-[#007A55] transition-colors truncate">
                        Become a Vendor / Seller
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        Open your shop & reach millions
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="size-3.5 text-slate-400 group-hover:text-[#007A55] group-hover:translate-x-0.5 transition-all shrink-0" />
                </Link>

                <Link
                  href="/contact-support"
                  role="menuitem"
                  id="more-menu-support"
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center justify-between gap-3 rounded-xl p-2.5 text-xs transition-colors hover:bg-emerald-50/80 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-100/80 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Headphones className="size-4" />
                    </div>
                    <div className="min-w-0 text-left">
                      <div className="font-bold text-slate-900 group-hover:text-[#007A55] transition-colors truncate">
                        24 × 7 Support
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        Dedicated ticketing & helpdesk
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="size-3.5 text-slate-400 group-hover:text-[#007A55] group-hover:translate-x-0.5 transition-all shrink-0" />
                </Link>

                <Link
                  href="/help"
                  role="menuitem"
                  id="more-menu-help"
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center justify-between gap-3 rounded-xl p-2.5 text-xs transition-colors hover:bg-emerald-50/80 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100/80 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                      <HelpCircle className="size-4" />
                    </div>
                    <div className="min-w-0 text-left">
                      <div className="font-bold text-slate-900 group-hover:text-[#007A55] transition-colors truncate">
                        Help Center
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        FAQs, order policies & guides
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="size-3.5 text-slate-400 group-hover:text-[#007A55] group-hover:translate-x-0.5 transition-all shrink-0" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

function MainShoppingNavFallback() {
  return (
    <nav className="w-full bg-[#004D38] border-b border-emerald-900/60 text-xs font-semibold py-2">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-7" />
    </nav>
  );
}

function MainShoppingNavInner(props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get("sort");

  return (
    <MainShoppingNavBase
      pathname={pathname}
      currentSort={currentSort}
      {...props}
    />
  );
}

export function MainShoppingNav(props) {
  return (
    <Suspense fallback={<MainShoppingNavFallback />}>
      <MainShoppingNavInner {...props} />
    </Suspense>
  );
}

export default MainShoppingNav;
