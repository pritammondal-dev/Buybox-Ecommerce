"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Truck, Headphones, ShieldCheck, RotateCcw } from "lucide-react";
import { brandService } from "../../../services/brand.service.js";

export function TrustSection() {
  const [brands, setBrands] = useState([]);

  useEffect(() => {
    let isMounted = true;
    brandService
      .getBrands({ limit: 10 })
      .then((res) => {
        if (!isMounted) return;
        const list = res?.data?.brands || (Array.isArray(res?.data) ? res.data : []);
        setBrands(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!isMounted) return;
        setBrands([]);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section aria-label="Why Buy From Buybox" className="py-8 sm:py-10 border-y border-slate-100 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Continuous Ticker Marquee */}
        <div className="flex items-center justify-between overflow-x-auto py-3 text-xs font-semibold text-slate-700 scrollbar-none gap-6 select-none">
          <div className="flex items-center gap-2 shrink-0">
            <Truck className="size-4 text-[#007A55]" />
            <span>Fast Free Shipping (Orders above ₹999)</span>
          </div>
          <span className="text-amber-400 font-bold">★</span>
          <div className="flex items-center gap-2 shrink-0">
            <ShieldCheck className="size-4 text-[#007A55]" />
            <span>100% Genuine Quality Guaranteed</span>
          </div>
          <span className="text-amber-400 font-bold">★</span>
          <div className="flex items-center gap-2 shrink-0">
            <RotateCcw className="size-4 text-[#007A55]" />
            <span>Easy 30-Day Replacement Guarantee</span>
          </div>
          <span className="text-amber-400 font-bold">★</span>
          <div className="flex items-center gap-2 shrink-0">
            <Headphones className="size-4 text-[#007A55]" />
            <span>Dedicated 24/7 Client Assistance</span>
          </div>
        </div>

        {/* Verified Brands Row (strictly from backend if available) */}
        {brands.length > 0 && (
          <div className="pt-6 pb-2 border-t border-slate-100">
            <p className="text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-4">
              Featured Verified Brands
            </p>
            <div className="flex flex-wrap items-center justify-center gap-8">
              {brands.map((b) => {
                const id = b.id || b._id;
                return (
                  <Link
                    key={id}
                    href={`/shop?brand=${id}`}
                    className="text-sm font-extrabold uppercase tracking-wider text-slate-400 hover:text-[#007A55] transition-colors"
                  >
                    {b.name}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default TrustSection;
