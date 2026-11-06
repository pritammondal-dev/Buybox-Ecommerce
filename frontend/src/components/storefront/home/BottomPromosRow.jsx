"use client";

import React from "react";
import Link from "next/link";

import { useBannerSlot } from "../../../hooks/useBannerSlot.js";
import { cn } from "../../../utils/cn.js";

export function BottomPromosRow({ banners = [], inactiveSlots = [] }) {
  const effectiveInactive = [
    ...(Array.isArray(inactiveSlots) ? inactiveSlots : []),
    ...(Array.isArray(banners?.inactiveSlots) ? banners.inactiveSlots : []),
  ];

  const homeKitchen = useBannerSlot(banners, "bottom_home_kitchen", effectiveInactive);
  const smartGadgets = useBannerSlot(banners, "bottom_smart_gadgets", effectiveInactive);
  const monsoonSpecial = useBannerSlot(banners, "bottom_monsoon_special", effectiveInactive);

  const promos = [
    {
      ...homeKitchen,
      borderColor: "border-rose-200/80",
      bgColor: "bg-rose-50",
    },
    {
      ...smartGadgets,
      borderColor: "border-emerald-200/80",
      bgColor: "bg-emerald-50",
    },
    {
      ...monsoonSpecial,
      borderColor: "border-sky-200/80",
      bgColor: "bg-sky-50",
    },
  ].filter((p) => p.isVisible && Boolean(p.src));

  if (promos.length === 0) {
    return null;
  }

  return (
    <section aria-label="Seasonal and Special Category Promotions" className="py-4 sm:py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className={cn(
            "grid gap-4 sm:gap-6",
            promos.length === 1 && "grid-cols-1 max-w-2xl mx-auto",
            promos.length === 2 && "grid-cols-1 md:grid-cols-2",
            promos.length >= 3 && "grid-cols-1 md:grid-cols-3"
          )}
        >
          {promos.map((promo) => (
            <Link
              key={promo.slotKey}
              href={promo.linkUrl}
              className={`relative block rounded-2xl overflow-hidden border ${promo.borderColor} ${promo.bgColor} shadow-2xs group hover:shadow-md transition-all aspect-[16/9] md:aspect-[4/3]`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={promo.src}
                alt={promo.altText}
                onError={promo.handleImageError}
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

export default BottomPromosRow;

