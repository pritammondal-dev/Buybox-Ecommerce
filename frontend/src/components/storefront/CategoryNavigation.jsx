"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, ChevronDown, PhoneCall, Flame, Sparkles, ArrowRight } from "lucide-react";
import { categoryService } from "../../services/category.service.js";
import { cn } from "../../utils/cn.js";

export function CategoryNavigation({ categories: propCategories, className }) {
  const pathname = usePathname();
  const [internalCategories, setInternalCategories] = useState([]);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const dropdownRef = useRef(null);

  const categories = propCategories && propCategories.length > 0 ? propCategories : internalCategories;

  // Fetch real categories if not supplied as props
  useEffect(() => {
    if (propCategories && propCategories.length > 0) return;

    let isMounted = true;
    categoryService
      .getCategories({ limit: 50 })
      .then((res) => {
        if (!isMounted) return;
        const list = res?.data?.categories || (Array.isArray(res?.data) ? res.data : []);
        setInternalCategories(Array.isArray(list) ? list : []);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [propCategories]);

  // Click outside to close categories dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setCategoriesOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter primary categories to show in horizontal navigation bar
  const topCategories = categories.slice(0, 4);

  return (
    <div className={cn("w-full border-b bg-white relative z-30", className)}>
      <div className="mx-auto flex h-13 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Explore All Categories Dropdown Button */}
        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setCategoriesOpen((prev) => !prev)}
            aria-expanded={categoriesOpen}
            aria-label="Toggle all categories menu"
            className="flex items-center gap-2.5 rounded-full bg-[#007A55] px-4.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#006346] active:scale-95 transition-all cursor-pointer"
          >
            <LayoutGrid className="size-4 stroke-[2.2]" />
            <span>Explore All Categories</span>
            <ChevronDown className={cn("size-3.5 transition-transform duration-200", categoriesOpen && "rotate-180")} />
          </button>

          {/* All Categories Flyout Dropdown */}
          {categoriesOpen && (
            <div className="absolute left-0 top-full mt-2 w-64 rounded-2xl border border-border bg-white p-2 shadow-elevated z-50 animate-in fade-in-50 zoom-in-95">
              <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border mb-1">
                Browse Categories ({categories.length})
              </div>

              <div className="max-h-80 overflow-y-auto space-y-0.5">
                {categories.length > 0 ? (
                  categories.map((cat) => {
                    const id = cat.id || cat._id;
                    const slug = cat.slug || id;
                    const href = `/category/${slug}`;
                    const isActive = pathname === href;

                    return (
                      <Link
                        key={id}
                        href={href}
                        onClick={() => setCategoriesOpen(false)}
                        className={cn(
                          "flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors",
                          isActive
                            ? "bg-emerald-50 text-[#007A55] font-bold"
                            : "text-foreground hover:bg-slate-50 hover:text-[#007A55]"
                        )}
                      >
                        <span className="truncate">{cat.name}</span>
                        <ArrowRight className="size-3 text-muted-foreground opacity-60" />
                      </Link>
                    );
                  })
                ) : (
                  <div className="p-3 text-center text-xs text-muted-foreground">
                    No categories available
                  </div>
                )}
              </div>

              <div className="border-t border-border mt-1 pt-1">
                <Link
                  href="/shop"
                  onClick={() => setCategoriesOpen(false)}
                  className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold text-[#007A55] hover:bg-emerald-50 transition-colors"
                >
                  <span>All Products Catalog</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Center: Main Horizontal Navigation Links */}
        <nav aria-label="Main menu" className="hidden lg:flex items-center gap-6 text-xs font-semibold">
          <Link
            href="/"
            className={cn(
              "py-1 transition-colors hover:text-[#007A55]",
              pathname === "/" ? "text-[#007A55] font-bold" : "text-foreground/90"
            )}
          >
            Home
          </Link>

          <Link
            href="/shop"
            className={cn(
              "py-1 transition-colors hover:text-[#007A55]",
              pathname === "/shop" ? "text-[#007A55] font-bold" : "text-foreground/90"
            )}
          >
            Shop All
          </Link>

          {/* Dynamic Top Categories from Backend */}
          {topCategories.map((cat) => {
            const id = cat.id || cat._id;
            const slug = cat.slug || id;
            const href = `/category/${slug}`;
            const isActive = pathname === href;

            return (
              <Link
                key={id}
                href={href}
                className={cn(
                  "py-1 transition-colors hover:text-[#007A55]",
                  isActive ? "text-[#007A55] font-bold" : "text-foreground/90"
                )}
              >
                {cat.name}
              </Link>
            );
          })}

          <Link
            href="/shop?sort=discount"
            className="flex items-center gap-1.5 py-1 text-foreground/90 hover:text-rose-600 transition-colors"
          >
            <Flame className="size-3.5 text-rose-500 fill-rose-500" />
            <span>Today&apos;s Deals</span>
            <span className="rounded bg-[#E02424] px-1 py-0.2 text-[9px] font-extrabold uppercase text-white shadow-xs">
              HOT
            </span>
          </Link>

          <Link
            href="/shop?sort=newest"
            className="flex items-center gap-1 py-1 text-foreground/90 hover:text-amber-600 transition-colors"
          >
            <Sparkles className="size-3.5 text-amber-500" />
            <span>New Arrivals</span>
          </Link>

          <Link
            href="/account/orders"
            className="py-1 text-foreground/90 hover:text-[#007A55] transition-colors"
          >
            Track Order
          </Link>
        </nav>

        {/* Right: Support Hotline */}
        <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <div className="flex size-6 items-center justify-center rounded-full bg-emerald-50 text-[#007A55]">
            <PhoneCall className="size-3" />
          </div>
          <span>24/7 Support:</span>
          <span className="font-bold text-foreground">+800-777-003</span>
        </div>
      </div>
    </div>
  );
}

export default CategoryNavigation;
