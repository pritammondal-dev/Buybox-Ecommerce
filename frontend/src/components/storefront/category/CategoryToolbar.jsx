"use client";

import React from "react";
import { SlidersHorizontal, ChevronDown, X } from "lucide-react";
import { formatCurrency } from "../../../utils/formatCurrency.js";
import { cn } from "../../../utils/cn.js";

const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest Arrivals" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "rating_desc", label: "Highest Rated" },
];

export function CategoryToolbar({
  totalProducts = 0,
  currentPage = 1,
  limit = 12,
  sort = "featured",
  onSortChange,
  activeFilters = {},
  brandNamesMap = {},
  onRemoveFilter,
  onClearAllFilters,
  onOpenMobileFilters,
  className,
}) {
  const startCount = totalProducts === 0 ? 0 : (currentPage - 1) * limit + 1;
  const endCount = Math.min(currentPage * limit, totalProducts);

  // Compute active chips
  const chips = [];

  // Price Chip
  if (activeFilters.minPrice || activeFilters.maxPrice) {
    let priceLabel = "";
    if (activeFilters.minPrice && activeFilters.maxPrice) {
      priceLabel = `${formatCurrency(activeFilters.minPrice)} - ${formatCurrency(
        activeFilters.maxPrice
      )}`;
    } else if (activeFilters.minPrice) {
      priceLabel = `Over ${formatCurrency(activeFilters.minPrice)}`;
    } else if (activeFilters.maxPrice) {
      priceLabel = `Under ${formatCurrency(activeFilters.maxPrice)}`;
    }
    chips.push({
      id: "price",
      key: "price",
      label: priceLabel,
      onRemove: () => {
        onRemoveFilter?.("minPrice");
        onRemoveFilter?.("maxPrice");
      },
    });
  }

  // Brands Chips
  if (Array.isArray(activeFilters.brands)) {
    activeFilters.brands.forEach((bId) => {
      const bName = brandNamesMap[bId] || "Brand";
      chips.push({
        id: `brand-${bId}`,
        key: "brand",
        value: bId,
        label: bName,
        onRemove: () => onRemoveFilter?.("brand", bId),
      });
    });
  }

  // Rating Chip
  if (activeFilters.rating) {
    chips.push({
      id: `rating-${activeFilters.rating}`,
      key: "rating",
      label: `${activeFilters.rating}★ & above`,
      onRemove: () => onRemoveFilter?.("rating"),
    });
  }

  // Availability / Stock Status Chip
  if (activeFilters.stockStatus) {
    chips.push({
      id: `stock-${activeFilters.stockStatus}`,
      key: "stockStatus",
      label:
        activeFilters.stockStatus === "in_stock"
          ? "In Stock"
          : activeFilters.stockStatus === "out_of_stock"
          ? "Out of Stock"
          : "Pre-order",
      onRemove: () => onRemoveFilter?.("stockStatus"),
    });
  }

  // Discount Chip
  if (activeFilters.discount) {
    chips.push({
      id: `discount-${activeFilters.discount}`,
      key: "discount",
      label: `${activeFilters.discount}% or more`,
      onRemove: () => onRemoveFilter?.("discount"),
    });
  }

  // Active filter count for mobile badge
  const totalActiveFilterCount = chips.length;

  return (
    <div className={cn("flex flex-col gap-3 pb-3 sm:pb-4", className)}>
      {/* Top Row: Results Count, Mobile Filter Trigger, Sort Dropdown */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-4">
        {/* Left: Product count & Mobile filter button */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile Filter Sheet Button */}
          <button
            type="button"
            suppressHydrationWarning
            onClick={onOpenMobileFilters}
            className="inline-flex lg:hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-xs hover:bg-slate-50 active:scale-95 transition-all"
          >
            <SlidersHorizontal className="size-3.5 text-[#004D38]" />
            <span>Filters</span>
            {totalActiveFilterCount > 0 && (
              <span className="flex size-4 items-center justify-center rounded-full bg-[#004D38] text-[10px] font-extrabold text-white">
                {totalActiveFilterCount}
              </span>
            )}
          </button>

          {/* Result Count Text */}
          <p className="text-xs sm:text-sm font-medium text-slate-500">
            {totalProducts > 0 ? (
              <>
                Showing{" "}
                <span className="font-bold text-slate-900">
                  {startCount}-{endCount}
                </span>{" "}
                of{" "}
                <span className="font-bold text-slate-900">{totalProducts}</span>{" "}
                results
              </>
            ) : (
              "No results found"
            )}
          </p>
        </div>

        {/* Right: Sort Dropdown */}
        <div className="flex items-center gap-2 ml-auto">
          <label
            htmlFor="category-sort-select"
            className="text-xs font-medium text-slate-500 hidden sm:inline"
          >
            Sort by:
          </label>
          <div className="relative">
            <select
              id="category-sort-select"
              suppressHydrationWarning
              value={sort}
              onChange={(e) => onSortChange?.(e.target.value)}
              className="appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-xs font-semibold text-slate-800 shadow-xs hover:border-slate-300 focus:border-[#004D38] focus:outline-none focus:ring-1 focus:ring-[#004D38] cursor-pointer"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
          </div>
        </div>
      </div>

      {/* Bottom Row: Active Filter Chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1">
            Active:
          </span>
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              suppressHydrationWarning
              onClick={chip.onRemove}
              className="group inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700 transition-colors"
            >
              <span>{chip.label}</span>
              <X className="size-3 text-slate-400 group-hover:text-red-600 transition-colors" />
            </button>
          ))}
          <button
            type="button"
            suppressHydrationWarning
            onClick={onClearAllFilters}
            className="text-xs font-semibold text-[#004D38] hover:text-[#003B2B] hover:underline ml-1 cursor-pointer"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

export default CategoryToolbar;
