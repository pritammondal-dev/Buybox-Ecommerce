"use client";

import React from "react";
import Link from "next/link";

import { useBannerSlot } from "../../../hooks/useBannerSlot.js";

export function CategoryBannersRow({ banners = [] }) {
  const catAudio = useBannerSlot(banners, "category_audio");
  const catWorkspace = useBannerSlot(banners, "category_workspace");
  const catSmartLiving = useBannerSlot(banners, "category_smart_living");

  const slots = [catAudio, catWorkspace, catSmartLiving];

  return (
    <section aria-label="Category Highlights" className="py-4 sm:py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {slots.map((slot) => (
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

