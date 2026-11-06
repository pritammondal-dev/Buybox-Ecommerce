"use client";

import React from "react";
import { STATUS_STYLES, resolveStatusMeta } from "@/utils/status-badge.util";

export { STATUS_STYLES, resolveStatusMeta };

/**
 * Standardized Vendor Status Badge
 * Buybox Marketplace Global Design Standard
 */
export function VendorStatusBadge({
  status,
  entityType = "general",
  label,
  size = "sm",
  showDot = true,
  className = "",
}) {
  const meta = resolveStatusMeta(status, entityType);
  const displayLabel = label || meta.label;
  const style = STATUS_STYLES[meta.variant] || STATUS_STYLES.slate;

  const sizeClasses =
    size === "md"
      ? "px-3 py-1 text-xs gap-1.5"
      : "px-2.5 py-0.5 text-[10px] gap-1 font-bold";

  return (
    <span
      className={`inline-flex items-center rounded-full border uppercase tracking-wider font-semibold whitespace-nowrap select-none transition-colors ${sizeClasses} ${style.bg} ${className}`}
    >
      {showDot && (
        <span
          className={`size-1.5 rounded-full shrink-0 ${style.dot}`}
          aria-hidden="true"
        />
      )}
      <span>{displayLabel}</span>
    </span>
  );
}

export default VendorStatusBadge;
