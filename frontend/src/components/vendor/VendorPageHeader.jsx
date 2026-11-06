"use client";

import React from "react";
import { VendorBreadcrumbs } from "./VendorBreadcrumbs.jsx";

/**
 * Standardized Vendor Page Header with Breadcrumbs, Title, Status, and Actions
 *
 * @param {Object} props
 * @param {string|React.ReactNode} props.title - Primary page heading
 * @param {string|React.ReactNode} [props.description] - Subtitle or contextual description
 * @param {Array<{ label: string, href?: string }>} [props.breadcrumbs] - Hierarchical breadcrumb items
 * @param {React.ReactNode} [props.badge] - Optional badge or status indicator displayed next to title
 * @param {React.ReactNode} [props.actions] - Contextual action buttons (Refresh, Add Product, Export, etc.)
 * @param {string} [props.className]
 */
export function VendorPageHeader({
  title,
  description,
  breadcrumbs = [],
  badge,
  actions,
  className = "",
}) {
  return (
    <div className={`space-y-3 pb-4 border-b border-slate-200/90 ${className}`}>
      {/* Breadcrumb Trail */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <VendorBreadcrumbs items={breadcrumbs} />
      )}

      {/* Title & Actions Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {title}
            </h1>
            {badge && <div className="shrink-0">{badge}</div>}
          </div>
          {description && (
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {/* Action Toolbar */}
        {actions && (
          <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

export default VendorPageHeader;

