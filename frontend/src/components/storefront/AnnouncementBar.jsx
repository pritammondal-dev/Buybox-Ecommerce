"use client";

import React from "react";
import Link from "next/link";
import { Truck, ShieldCheck, RotateCcw, Headphones, HelpCircle, Package } from "lucide-react";

export function AnnouncementBar() {
  return (
    <div className="bg-[#004D38] text-white text-[11px] font-medium border-b border-emerald-900/50 select-none">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-8 sm:h-9">
          {/* Left section: 4 Marketplace Guarantees from mockup */}
          <div className="flex items-center gap-4 sm:gap-6 text-emerald-100/90 overflow-x-auto scrollbar-none py-1">
            <div className="flex items-center gap-1.5 shrink-0">
              <Truck className="size-3.5 text-emerald-300" aria-hidden="true" />
              <span>Free Shipping on Orders Above ₹999</span>
            </div>
            <span className="text-emerald-700/80 hidden md:inline">•</span>
            <div className="hidden sm:flex items-center gap-1.5 shrink-0">
              <ShieldCheck className="size-3.5 text-emerald-300" aria-hidden="true" />
              <span>100% Genuine Products</span>
            </div>
            <span className="text-emerald-700/80 hidden lg:inline">•</span>
            <div className="hidden md:flex items-center gap-1.5 shrink-0">
              <RotateCcw className="size-3.5 text-emerald-300" aria-hidden="true" />
              <span>Easy 30-Day Returns</span>
            </div>
            <span className="text-emerald-700/80 hidden xl:inline">•</span>
            <div className="hidden lg:flex items-center gap-1.5 shrink-0">
              <Headphones className="size-3.5 text-emerald-300" aria-hidden="true" />
              <span>Customer Support</span>
            </div>
          </div>

          {/* Right section: Track Order | Help */}
          <div className="flex items-center gap-3 text-emerald-100/90 shrink-0 text-xs">
            <Link
              href="/account/orders"
              className="flex items-center gap-1 hover:text-white transition-colors"
            >
              <Package className="size-3 text-emerald-300 sm:hidden" />
              <span>Track Order</span>
            </Link>
            <span className="text-emerald-700">|</span>
            <Link
              href="/help"
              className="flex items-center gap-1 hover:text-white transition-colors"
            >
              <HelpCircle className="size-3 text-emerald-300 sm:hidden" />
              <span>Help</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AnnouncementBar;
