"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  X,
  ExternalLink,
  Smartphone,
  Monitor,
  Calendar,
  Layers,
  Sparkles,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  Tag,
  Clock,
} from "lucide-react";
import { BANNER_SLOTS } from "../../../constants/banner-slots.constants.js";
import { cn } from "../../../utils/cn.js";
import { getBannerScheduleStatus } from "../../../utils/banner.util.js";

export { getBannerScheduleStatus };

export function StoreBannerPreviewModal({ isOpen, onClose, banner }) {
  const [deviceMode, setDeviceMode] = useState("desktop"); // "desktop" | "mobile"

  if (!isOpen || !banner) return null;

  const slotKey = banner.slotKey || banner.placement || "hero_main";
  const slotDef = BANNER_SLOTS.find((s) => s.slotKey === slotKey) || {
    title: slotKey,
    sectionLabel: "Promotional Banner",
    recommendedDimensions: "Responsive",
    description: "Promotional slot",
  };

  const scheduleInfo = getBannerScheduleStatus(banner);
  const activeImage =
    deviceMode === "mobile" && banner.mobileImageUrl
      ? banner.mobileImageUrl
      : banner.imageUrl;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Sparkles className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Storefront Banner Preview
                </h3>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border",
                    scheduleInfo.badgeClass
                  )}
                >
                  <span className="size-1.5 rounded-full bg-current" />
                  {scheduleInfo.label}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Placement:{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {slotDef.title}
                </span>{" "}
                • Recommended: {slotDef.recommendedDimensions}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Device Switcher */}
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs">
              <button
                type="button"
                onClick={() => setDeviceMode("desktop")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition-all cursor-pointer",
                  deviceMode === "desktop"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <Monitor className="size-3.5" />
                <span>Desktop</span>
              </button>
              <button
                type="button"
                onClick={() => setDeviceMode("mobile")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition-all cursor-pointer",
                  deviceMode === "mobile"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <Smartphone className="size-3.5" />
                <span>Mobile</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-6 flex-1">
          {/* Simulated Storefront Card */}
          <div className="flex justify-center">
            <div
              className={cn(
                "w-full transition-all duration-300",
                deviceMode === "mobile" ? "max-w-sm" : "max-w-3xl"
              )}
            >
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-950 shadow-lg group">
                {/* Artwork */}
                <div
                  className={cn(
                    "relative w-full overflow-hidden bg-slate-950 flex items-center justify-center",
                    slotKey === "hero_main"
                      ? "aspect-[2/1]"
                      : slotKey.startsWith("hero_")
                      ? "aspect-[3.3/1]"
                      : slotKey.startsWith("mid_")
                      ? "aspect-[3/1]"
                      : "aspect-[16/9]"
                  )}
                >
                  {activeImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={activeImage}
                      alt={banner.altText || banner.title}
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-102"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-8 text-slate-500 text-center">
                      <Sparkles className="size-8 mb-2 opacity-50" />
                      <span className="text-xs">No artwork image configured</span>
                    </div>
                  )}

                  {/* Gradient Overlay for Text Legibility */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent pointer-events-none" />

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10 pointer-events-none">
                    {banner.badge && (
                      <span className="rounded-lg bg-emerald-600/90 text-white px-2.5 py-0.5 text-xs font-bold shadow-xs">
                        {banner.badge}
                      </span>
                    )}
                    <span className="rounded-lg bg-slate-900/80 text-slate-200 px-2 py-0.5 text-[10px] font-mono border border-slate-700">
                      {slotKey}
                    </span>
                  </div>

                  {/* Content Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 text-white space-y-1.5 z-10">
                    <h4 className="text-base sm:text-xl font-black tracking-tight leading-snug drop-shadow-md">
                      {banner.title}
                    </h4>
                    {banner.subtitle && (
                      <p className="text-xs sm:text-sm text-slate-200 line-clamp-2 max-w-xl drop-shadow-sm font-medium">
                        {banner.subtitle}
                      </p>
                    )}
                    {banner.ctaText && (
                      <div className="pt-2">
                        <span className="inline-flex items-center gap-1.5 rounded-xl bg-white text-slate-950 px-3.5 py-1.5 text-xs font-bold shadow-md hover:bg-slate-100 transition-colors">
                          <span>{banner.ctaText}</span>
                          <ExternalLink className="size-3" />
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Banner Meta Specs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3.5 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Tag className="size-3" />
                Target Placement
              </span>
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {slotDef.title}
              </p>
              <p className="text-[11px] text-slate-500 font-mono">{slotKey}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3.5 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <LinkIcon className="size-3" />
                Destination Link
              </span>
              <p className="text-xs font-bold text-slate-900 dark:text-white font-mono truncate">
                {banner.linkUrl || "/shop"}
              </p>
              <Link
                href={banner.linkUrl || "/shop"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                <span>Test Link</span>
                <ExternalLink className="size-3" />
              </Link>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3.5 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Layers className="size-3" />
                Display Priority
              </span>
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                Order Index: {banner.displayOrder ?? 0}
              </p>
              <p className="text-[11px] text-slate-500">
                Lower index renders first
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3.5 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="size-3" />
                Schedule Window
              </span>
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                {banner.startsAt || banner.endsAt ? "Time-Bound" : "Always Active"}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                {banner.startsAt
                  ? `From: ${new Date(banner.startsAt).toLocaleDateString()}`
                  : "Immediate"}
                {banner.endsAt
                  ? ` To: ${new Date(banner.endsAt).toLocaleDateString()}`
                  : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end border-t border-slate-100 dark:border-slate-800 p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}

export default StoreBannerPreviewModal;
