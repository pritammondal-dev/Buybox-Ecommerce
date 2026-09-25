"use client";

import React from "react";
import { ShieldCheck, CreditCard, RotateCcw, Headphones } from "lucide-react";

export function TrustSection() {
  const GUARANTEES = [
    {
      icon: ShieldCheck,
      title: "Verified Marketplace",
      description: "Trusted sellers, genuine products",
    },
    {
      icon: CreditCard,
      title: "Secure Checkout",
      description: "Multiple payment options",
    },
    {
      icon: RotateCcw,
      title: "Easy 30-Day Returns",
      description: "Hassle-free returns",
    },
    {
      icon: Headphones,
      title: "Dedicated Support",
      description: "We're here to help",
    },
  ];

  return (
    <section aria-label="Marketplace Guarantees" className="py-2 sm:py-3">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-100">
            {GUARANTEES.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className={`flex items-center gap-3.5 ${idx > 0 ? "pt-3 md:pt-0 md:pl-6" : ""}`}
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#007A55] shadow-2xs">
                    <Icon className="size-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
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

export default TrustSection;
