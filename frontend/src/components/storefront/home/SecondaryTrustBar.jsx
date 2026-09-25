"use client";

import React from "react";
import { ShoppingBag, ShieldCheck, RotateCcw, Headphones } from "lucide-react";

export function SecondaryTrustBar() {
  const ITEMS = [
    {
      icon: ShoppingBag,
      title: "Why Buybox?",
      description: "Your trusted marketplace for electronics & more.",
      highlight: true,
    },
    {
      icon: ShieldCheck,
      title: "Verified Sellers",
      description: "100% quality products",
    },
    {
      icon: RotateCcw,
      title: "Easy 30-Day Returns",
      description: "Hassle-free refunds",
    },
    {
      icon: Headphones,
      title: "Dedicated Support",
      description: "We're here to help",
    },
  ];

  return (
    <section aria-label="Why Buybox Marketplace Guarantees" className="py-4 sm:py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-emerald-200/70 bg-[#EBF7EE]/90 p-4 sm:p-5 shadow-2xs">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 divide-y md:divide-y-0 md:divide-x divide-emerald-200/50">
            {ITEMS.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className={`flex items-center gap-3 ${idx > 0 ? "pt-3 md:pt-0 md:pl-5" : ""}`}
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#007A55] shadow-2xs">
                    <Icon className="size-4 stroke-[2.2]" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export default SecondaryTrustBar;
