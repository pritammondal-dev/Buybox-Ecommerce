"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight, TrendingUp, TrendingDown } from "lucide-react";

const KPI_VARIANTS = {
  emerald: {
    iconBg: "bg-emerald-50 text-[#007A55]",
    borderHover: "hover:border-emerald-300",
  },
  blue: {
    iconBg: "bg-blue-50 text-blue-700",
    borderHover: "hover:border-blue-300",
  },
  amber: {
    iconBg: "bg-amber-50 text-amber-700",
    borderHover: "hover:border-amber-300",
  },
  rose: {
    iconBg: "bg-rose-50 text-rose-700",
    borderHover: "hover:border-rose-300",
  },
  indigo: {
    iconBg: "bg-indigo-50 text-indigo-700",
    borderHover: "hover:border-indigo-300",
  },
  purple: {
    iconBg: "bg-purple-50 text-purple-700",
    borderHover: "hover:border-purple-300",
  },
  teal: {
    iconBg: "bg-teal-50 text-teal-700",
    borderHover: "hover:border-teal-300",
  },
  slate: {
    iconBg: "bg-slate-100 text-slate-700",
    borderHover: "hover:border-slate-300",
  },
};

/**
 * Information-Dense Vendor KPI Card
 */
export function VendorKpiCard({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  variant = "emerald",
  href,
  isLoading = false,
  alert = false,
  className = "",
}) {
  const v = KPI_VARIANTS[variant] || KPI_VARIANTS.emerald;

  if (isLoading) {
    return (
      <div className={`p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs animate-pulse ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="h-3.5 w-24 bg-slate-200 rounded" />
          <div className="size-9 rounded-xl bg-slate-200" />
        </div>
        <div className="h-7 w-32 bg-slate-200 rounded-lg mb-2" />
        <div className="h-3 w-40 bg-slate-100 rounded" />
      </div>
    );
  }

  const content = (
    <div
      className={`p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs transition-all ${
        href ? `cursor-pointer ${v.borderHover} hover:shadow-sm` : ""
      } ${className}`}
    >
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
            {title}
          </span>
          {alert && (
            <span className="size-2 rounded-full bg-amber-500 animate-pulse shrink-0" title="Action required" />
          )}
        </div>
        {Icon && (
          <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${v.iconBg}`}>
            <Icon className="size-4.5" />
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <div className="text-2xl font-black text-slate-900 tracking-tight">
          {value ?? "—"}
        </div>
        {href && (
          <ArrowUpRight className="size-3.5 text-slate-400 group-hover:text-slate-700 transition-colors shrink-0" />
        )}
      </div>

      {(subtitle || trend) && (
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
          {trend && (
            <span
              className={`inline-flex items-center gap-0.5 font-bold ${
                trend.isPositive ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {trend.isPositive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {trend.value}
            </span>
          )}
          {subtitle && <span className="truncate">{subtitle}</span>}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="group block focus:outline-none focus:ring-2 focus:ring-[#007A55]/30 rounded-2xl">
        {content}
      </Link>
    );
  }

  return content;
}

export default VendorKpiCard;
