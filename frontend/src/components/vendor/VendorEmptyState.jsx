"use client";

import React from "react";
import Link from "next/link";
import { PackageOpen } from "lucide-react";

/**
 * Standardized Vendor Console Empty State
 *
 * @param {Object} props
 * @param {React.ComponentType} [props.icon] - Lucide icon component
 * @param {string} props.title - Heading
 * @param {string} props.description - Explanatory helper text
 * @param {Object} [props.action] - Primary CTA button { label, href, onClick }
 * @param {Object} [props.secondaryAction] - Secondary CTA link { label, href, onClick }
 * @param {string} [props.className]
 */
export function VendorEmptyState({
  icon: Icon = PackageOpen,
  title,
  description,
  action,
  secondaryAction,
  className = "",
}) {
  return (
    <div
      className={`p-12 sm:p-16 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs ${className}`}
    >
      <div className="size-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
        <Icon className="size-7" />
      </div>

      <h3 className="text-base font-bold text-slate-900 tracking-tight mb-1">
        {title}
      </h3>

      {description && (
        <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed mb-6">
          {description}
        </p>
      )}

      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {action &&
            (action.href ? (
              <Link
                href={action.href}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-bold shadow-xs transition-colors"
              >
                {action.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={action.onClick}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-bold shadow-xs transition-colors"
              >
                {action.label}
              </button>
            ))}

          {secondaryAction &&
            (secondaryAction.href ? (
              <Link
                href={secondaryAction.href}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors"
              >
                {secondaryAction.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={secondaryAction.onClick}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors"
              >
                {secondaryAction.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

export default VendorEmptyState;

