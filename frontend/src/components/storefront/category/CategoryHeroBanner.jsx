"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight, Sparkles, Tag } from "lucide-react";
import { cn } from "../../../utils/cn.js";

export function CategoryHeroBanner({
  category,
  totalProducts = 0,
  className,
}) {
  const name = category?.name || "All Products";
  const description =
    category?.description ||
    `Explore high-performance ${name.toLowerCase()} with genuine brand warranty and same-day dispatch.`;
  const imageUrl = category?.image?.url || null;

  return (
    <div className={cn("w-full mb-6 sm:mb-8", className)}>
      {/* Breadcrumb row */}
      <nav
        aria-label="Breadcrumb"
        className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground"
      >
        <Link
          href="/"
          className="hover:text-[#007A55] transition-colors font-medium"
        >
          Home
        </Link>
        <ChevronRight className="size-3.5 text-slate-400" />
        <Link
          href="/shop"
          className="hover:text-[#007A55] transition-colors font-medium"
        >
          Categories
        </Link>
        <ChevronRight className="size-3.5 text-slate-400" />
        <span className="font-bold text-slate-800 truncate max-w-xs sm:max-w-md">
          {name}
        </span>
      </nav>

      {/* Main Promotional Banner Container matching Reference */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-[#003B2B] via-[#004D38] to-[#002F22] border border-emerald-800/40 shadow-sm text-white px-5 sm:px-8 py-5 sm:py-7 min-h-[140px] sm:min-h-[160px] flex items-center justify-between">
        {/* Subtle Decorative Background Glow & Texture */}
        <div className="absolute -left-10 -top-10 size-48 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
        <div className="absolute right-0 bottom-0 size-64 rounded-full bg-emerald-400/10 blur-2xl pointer-events-none" />

        {/* Left Column: Title, Subtitle, Deal Badge */}
        <div className="relative z-10 max-w-xl pr-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-200 border border-emerald-400/30">
              <Sparkles className="size-3" />
              <span>Official Collection</span>
            </span>
            {totalProducts > 0 && (
              <span className="text-[11px] font-semibold text-emerald-200/80 hidden sm:inline">
                • {totalProducts} Products Available
              </span>
            )}
          </div>

          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight leading-tight">
            {name}
          </h1>

          <p className="mt-1 text-xs sm:text-sm text-emerald-100/90 leading-relaxed line-clamp-2">
            {description}
          </p>

          <div className="mt-2.5 flex items-center gap-3 text-[11px] text-emerald-200/90 font-medium">
            <span className="flex items-center gap-1">
              <Tag className="size-3 text-emerald-300" />
              <span>Top Brand Deals</span>
            </span>
            <span>•</span>
            <span>100% Genuine Guaranteed</span>
            <span>•</span>
            <span className="hidden sm:inline">Fast Free Shipping</span>
          </div>
        </div>

        {/* Right Column: Visual Category Image */}
        {imageUrl && (
          <div className="relative z-10 hidden md:flex items-center justify-center shrink-0 w-44 lg:w-56 h-32 lg:h-36">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={name}
              className="max-h-full max-w-full object-contain drop-shadow-xl transition-transform duration-300 hover:scale-105"
              loading="eager"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default CategoryHeroBanner;
