"use client";

import React from "react";
import Link from "next/link";
import { Phone, ChevronDown } from "lucide-react";

export function AnnouncementBar() {
  return (
    <div className="bg-[#004D38] text-white text-[11px] font-medium border-b border-emerald-900/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-9">
          {/* Left section: Support Phone & Selectors */}
          <div className="hidden lg:flex items-center gap-4 text-emerald-100/90">
            <div className="flex items-center gap-1.5">
              <Phone className="size-3 text-emerald-300" aria-hidden="true" />
              <span>Need Support? Call Us:</span>
              <span className="font-semibold text-white">+1800 900 1234</span>
            </div>
            <span className="text-emerald-700">|</span>
            <div className="flex items-center gap-1 cursor-pointer hover:text-white transition-colors">
              <span>English</span>
              <ChevronDown className="size-3" />
            </div>
            <span className="text-emerald-700">|</span>
            <div className="flex items-center gap-1 cursor-pointer hover:text-white transition-colors">
              <span>INR ₹</span>
              <ChevronDown className="size-3" />
            </div>
          </div>

          {/* Center section: Daily Special Promo Badge */}
          <div className="flex items-center justify-center gap-2 mx-auto lg:mx-0">
            <span className="text-emerald-100">Trending Category</span>
            <span className="rounded-full bg-[#FACC15] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-950 shadow-xs">
              Extra 20% Off
            </span>
            <span className="text-emerald-100 hidden sm:inline">- Today Only</span>
          </div>

          {/* Right section: Quick Header Links */}
          <div className="hidden md:flex items-center gap-3 text-emerald-100/90">
            <Link href="/shop" className="hover:text-white transition-colors">
              About Us
            </Link>
            <span className="text-emerald-700">|</span>
            <Link href="/account/profile" className="hover:text-white transition-colors">
              My Account
            </Link>
            <span className="text-emerald-700">|</span>
            <Link href="/wishlist" className="hover:text-white transition-colors">
              My Wishlist
            </Link>
            <span className="text-emerald-700">|</span>
            <Link href="/account/orders" className="hover:text-white transition-colors">
              Order Tracking
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AnnouncementBar;
