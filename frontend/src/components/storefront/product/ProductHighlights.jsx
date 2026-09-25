"use client";

import React from "react";
import { Check, Zap } from "lucide-react";

/**
 * Format a camelCase or snake_case key into Title Case
 */
function formatSpecKey(key) {
  if (!key) return "";
  const spaced = key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function ProductHighlights({ specifications }) {
  if (!specifications) return null;

  let entries = [];
  if (specifications instanceof Map) {
    entries = Array.from(specifications.entries());
  } else if (typeof specifications === "object") {
    entries = Object.entries(specifications);
  }

  // Filter out empty or null values
  const validEntries = entries.filter(
    ([k, v]) => k && v !== undefined && v !== null && String(v).trim() !== ""
  );

  if (validEntries.length === 0) {
    return null;
  }

  // Priority feature keys to elevate to the top
  const priorityKeys = [
    "display",
    "processor",
    "ram",
    "storage",
    "battery",
    "camera",
    "connectivity",
    "os",
    "operating system",
    "warranty",
    "material",
    "color",
  ];

  const sortedEntries = [...validEntries].sort(([a], [b]) => {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    const aIdx = priorityKeys.findIndex((k) => aLower.includes(k));
    const bIdx = priorityKeys.findIndex((k) => bLower.includes(k));
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return 0;
  });

  // Display top 4 to 6 highlights
  const topHighlights = sortedEntries.slice(0, 6);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-2.5">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800">
        <Zap className="size-3.5 text-[#004D38] fill-[#004D38]" />
        <span>Key Specifications & Features</span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {topHighlights.map(([key, val]) => (
          <div key={key} className="flex items-start gap-2 text-xs">
            <span className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[#004D38]">
              <Check className="size-2.5 stroke-[2.5]" />
            </span>
            <span className="text-slate-700 leading-tight">
              <span className="font-semibold text-slate-900">
                {formatSpecKey(key)}:
              </span>{" "}
              {String(val)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ProductHighlights;
