"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "../../../utils/cn.js";

const VARIANTS = {
  plain: "bg-white border-transparent",
  deals: "bg-[#FFF1F2] border-rose-200/80",
  flash: "bg-[#FFFBEB] border-amber-200/80",
  featured: "bg-[#FFFDF0] border-amber-200/70",
  new: "bg-[#F0FDF4] border-emerald-200/80",
  trending: "bg-[#FAF5FF] border-purple-200/80",
  brands: "bg-[#F0F7FF] border-sky-200/80",
  recent: "bg-[#F5F3FF] border-violet-200/80",
};

export function SectionContainer({
  title,
  subtitle,
  badge,
  badgeColor = "bg-[#E02424] text-white",
  icon: Icon,
  iconBg = "bg-emerald-50 text-[#007A55]",
  viewAllHref,
  viewAllText = "View All",
  variant = "plain",
  headerRight,
  children,
  className,
  containerClassName,
  ariaLabel,
}) {
  return (
    <section aria-label={ariaLabel || title} className={cn("py-4 sm:py-6", className)}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className={cn(
            "rounded-3xl p-4 sm:p-6 md:p-7 shadow-xs border transition-all duration-300",
            VARIANTS[variant] || VARIANTS.plain,
            containerClassName
          )}
        >
          {/* Section Header */}
          {(title || Icon || viewAllHref || headerRight) && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 sm:pb-5 border-b border-slate-200/60">
              <div className="flex items-center gap-3">
                {Icon && (
                  <div
                    className={cn(
                      "flex size-9 sm:size-10 items-center justify-center rounded-2xl shadow-2xs shrink-0",
                      iconBg
                    )}
                  >
                    <Icon className="size-5 stroke-[2]" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg sm:text-xl md:text-2xl font-black tracking-tight text-slate-900">
                      {title}
                    </h2>
                    {badge && (
                      <span
                        className={cn(
                          "rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide shadow-2xs",
                          badgeColor
                        )}
                      >
                        {badge}
                      </span>
                    )}
                  </div>
                  {subtitle && (
                    <p className="text-xs text-slate-500 mt-0.5 font-medium">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>

              {/* Right: Actions / View All */}
              <div className="flex items-center gap-3 self-end sm:self-auto">
                {headerRight}
                {viewAllHref && (
                  <Link
                    href={viewAllHref}
                    className="group inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-[#007A55] hover:text-[#006346] transition-colors shrink-0"
                  >
                    <span>{viewAllText}</span>
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Body Content */}
          <div className="pt-4 sm:pt-5">{children}</div>
        </div>
      </div>
    </section>
  );
}

export default SectionContainer;
