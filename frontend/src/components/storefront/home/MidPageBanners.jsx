"use client";

import React from "react";
import Link from "next/link";

import { useBannerSlot } from "../../../hooks/useBannerSlot.js";

export function MidPageBanners({ banners = [] }) {
  const workSmarter = useBannerSlot(banners, "mid_work_smarter");
  const stylishLooks = useBannerSlot(banners, "mid_stylish_looks");

  return (
    <section aria-label="Middle Campaign Banners" className="py-4 sm:py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 items-stretch">
          {/* Left Banner: Work Smarter (67% width, Image-Only) */}
          <Link
            href={workSmarter.linkUrl}
            className="md:col-span-8 rounded-3xl overflow-hidden shadow-sm border border-slate-200/80 relative group hover:shadow-md transition-all min-h-[200px] sm:min-h-[240px] md:min-h-[260px] block bg-slate-100"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={workSmarter.src}
              alt={workSmarter.altText}
              onError={workSmarter.handleImageError}
              className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
              loading="lazy"
            />
          </Link>

          {/* Right Banner: Stylish Looks (33% width, Image-Only) */}
          <Link
            href={stylishLooks.linkUrl}
            className="md:col-span-4 rounded-3xl overflow-hidden shadow-2xs border border-slate-200/80 relative group hover:shadow-md transition-all min-h-[200px] sm:min-h-[240px] md:min-h-[260px] block bg-slate-100"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={stylishLooks.src}
              alt={stylishLooks.altText}
              onError={stylishLooks.handleImageError}
              className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
              loading="lazy"
            />
          </Link>
        </div>
      </div>
    </section>
  );
}

export default MidPageBanners;

