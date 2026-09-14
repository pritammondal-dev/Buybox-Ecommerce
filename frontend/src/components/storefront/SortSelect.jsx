"use client";

import React from "react";
import { ArrowUpDown } from "lucide-react";
import { Select } from "../ui/Select.jsx";
import { cn } from "../../utils/cn.js";

const SORT_OPTIONS = [
  { value: "featured", label: "Featured / Recommended" },
  { value: "newest", label: "Newest Arrivals" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "rating_desc", label: "Customer Rating" },
];

export function SortSelect({
  value = "featured",
  onChange,
  options = SORT_OPTIONS,
  className,
}) {
  return (
    <div className={cn("inline-flex items-center gap-2 text-xs", className)}>
      <span className="hidden sm:inline text-muted-foreground flex items-center gap-1 font-medium whitespace-nowrap">
        <ArrowUpDown className="size-3.5" />
        Sort By:
      </span>
      <div className="w-44">
        <Select
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="h-8 text-xs font-medium"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

export default SortSelect;
