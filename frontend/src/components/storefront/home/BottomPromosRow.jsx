"use client";

import React from "react";
import Link from "next/link";

import { useBannerSlot } from "../../../hooks/useBannerSlot.js";

export function BottomPromosRow({ banners = [] }) {
  const homeKitchen = useBannerSlot(banners, "bottom_home_kitchen");
  const smartGadgets = useBannerSlot(banners, "bottom_smart_gadgets");
  const monsoonSpecial = useBannerSlot(banners, "bottom_monsoon_special");

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
  ];

  return (
    <section aria-label="Seasonal and Special Category Promotions" className="py-4 sm:py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
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

