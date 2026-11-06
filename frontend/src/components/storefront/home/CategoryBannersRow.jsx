"use client";

import React from "react";
import Link from "next/link";

import { useBannerSlot } from "../../../hooks/useBannerSlot.js";
import { cn } from "../../../utils/cn.js";

export function CategoryBannersRow({ banners = [], inactiveSlots = [] }) {
  const effectiveInactive = [
    ...(Array.isArray(inactiveSlots) ? inactiveSlots : []),
    ...(Array.isArray(banners?.inactiveSlots) ? banners.inactiveSlots : []),
  ];

  const catAudio = useBannerSlot(banners, "category_audio", effectiveInactive);
  const catWorkspace = useBannerSlot(banners, "category_workspace", effectiveInactive);
  const catSmartLiving = useBannerSlot(banners, "category_smart_living", effectiveInactive);

  const activeSlots = [catAudio, catWorkspace, catSmartLiving].filter(
    (slot) => slot.isVisible && Boolean(slot.src)
  );

  if (activeSlots.length === 0) {
    return null;
  }

  return (
    <section aria-label="Category Highlights" className="py-4 sm:py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className={cn(
            "grid gap-4 sm:gap-6",
            activeSlots.length === 1 && "grid-cols-1 max-w-2xl mx-auto",
            activeSlots.length === 2 && "grid-cols-1 md:grid-cols-2",
            activeSlots.length >= 3 && "grid-cols-1 md:grid-cols-3"
          )}
        >
          {activeSlots.map((slot) => (
            <Link
              key={slot.slotKey}
              href={slot.linkUrl}
              className="relative block rounded-2xl overflow-hidden border border-slate-200/80 shadow-2xs group hover:shadow-md transition-all aspect-[16/9] md:aspect-[4/3] bg-slate-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slot.src}
                alt={slot.altText}
                onError={slot.handleImageError}
                className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export default CategoryBannersRow;

