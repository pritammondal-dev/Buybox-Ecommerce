"use client";

import React, { useState } from "react";
import { Star, Search, Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../../../utils/cn.js";

const PRICE_PRESETS = [
  { label: "Under ₹10,000", min: null, max: 10000 },
  { label: "₹10,000 - ₹20,000", min: 10000, max: 20000 },
  { label: "₹20,000 - ₹40,000", min: 20000, max: 40000 },
  { label: "₹40,000 - ₹60,000", min: 40000, max: 60000 },
  { label: "Above ₹60,000", min: 60000, max: null },
];

const RATING_OPTIONS = [
  { stars: 4, label: "4★ & above" },
  { stars: 3, label: "3★ & above" },
  { stars: 2, label: "2★ & above" },
  { stars: 1, label: "1★ & above" },
];

const AVAILABILITY_OPTIONS = [
  { value: "in_stock", label: "In Stock" },
  { value: "preorder", label: "Pre-order" },
  { value: "out_of_stock", label: "Out of Stock" },
];

const DISCOUNT_OPTIONS = [
  { value: 40, label: "40% or more" },
  { value: 30, label: "30% or more" },
  { value: 20, label: "20% or more" },
  { value: 10, label: "10% or more" },
];

export function CategoryFilterSidebar({
  categories = [],
  brands = [],
  currentCategoryId = null,
  selectedBrandIds = [],
  minPrice = "",
  maxPrice = "",
  selectedRating = null,
  selectedAvailability = null,
  selectedDiscount = null,
  onCategoryChange,
  onBrandToggle,
  onPriceChange,
  onRatingChange,
  onAvailabilityChange,
  onDiscountChange,
  onClearAll,
  activeFilterCount = 0,
  className,
}) {
  const [brandSearch, setBrandSearch] = useState("");
  const [customMin, setCustomMin] = useState(minPrice || "");
  const [customMax, setCustomMax] = useState(maxPrice || "");

  // Collapsible section toggles
  const [collapsedSections, setCollapsedSections] = useState({});
  const toggleSection = (key) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Filtered brands for brand search input
  const filteredBrands = brands.filter((b) =>
    b.name?.toLowerCase().includes(brandSearch.toLowerCase().trim())
  );

  const handleCustomPriceSubmit = (e) => {
    e.preventDefault();
    onPriceChange?.(customMin || null, customMax || null);
  };

  return (
    <aside
      aria-label="Product filters"
      className={cn(
        "rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs text-slate-800 space-y-5 select-none",
        className
      )}
    >
      {/* 1. Header: "Filter" & "Clear All" */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
          Filter
        </h2>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            suppressHydrationWarning
            className="text-[11px] font-bold text-[#007A55] hover:underline cursor-pointer"
          >
            Clear All ({activeFilterCount})
          </button>
        )}
      </div>

      {/* 2. Price Range */}
      <div className="border-b border-slate-100 pb-4">
        <button
          type="button"
          onClick={() => toggleSection("price")}
          className="flex w-full items-center justify-between py-1 text-xs font-bold text-slate-800 hover:text-[#007A55] cursor-pointer"
        >
          <span>Price Range</span>
          {collapsedSections.price ? (
            <ChevronDown className="size-3.5 text-slate-400" />
          ) : (
            <ChevronUp className="size-3.5 text-slate-400" />
          )}
        </button>

        {!collapsedSections.price && (
          <div className="mt-2 space-y-2">
            {PRICE_PRESETS.map((preset, idx) => {
              const isSelected =
                String(minPrice || "") === String(preset.min || "") &&
                String(maxPrice || "") === String(preset.max || "");

              return (
                <label
                  key={`preset-${idx}`}
                  className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer hover:text-slate-950 transition-colors"
                >
                  <input
                    type="radio"
                    name="pricePreset"
                    checked={isSelected}
                    onChange={() => onPriceChange?.(preset.min, preset.max)}
                    className="size-3.5 text-[#007A55] focus:ring-[#007A55] border-slate-300"
                  />
                  <span className={cn(isSelected && "font-bold text-[#007A55]")}>
                    {preset.label}
                  </span>
                </label>
              );
            })}

            {/* Min-Max numeric inputs with Go button */}
            <form onSubmit={handleCustomPriceSubmit} className="pt-2 flex items-center gap-1.5">
              <input
                type="number"
                min="0"
                placeholder="Min ₹"
                value={customMin}
                onChange={(e) => setCustomMin(e.target.value)}
                className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-900 outline-none focus:border-[#007A55] focus:bg-white"
              />
              <span className="text-slate-400 text-xs">-</span>
              <input
                type="number"
                min="0"
                placeholder="Max ₹"
                value={customMax}
                onChange={(e) => setCustomMax(e.target.value)}
                className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-900 outline-none focus:border-[#007A55] focus:bg-white"
              />
              <button
                type="submit"
                suppressHydrationWarning
                className="rounded-lg bg-[#007A55] px-2.5 py-1 text-xs font-bold text-white shadow-2xs hover:bg-[#006346] active:scale-95 transition-all cursor-pointer"
              >
                Go
              </button>
            </form>
          </div>
        )}
      </div>

      {/* 3. Categories */}
      {categories.length > 0 && (
        <div className="border-b border-slate-100 pb-4">
          <button
            type="button"
            onClick={() => toggleSection("category")}
            className="flex w-full items-center justify-between py-1 text-xs font-bold text-slate-800 hover:text-[#007A55] cursor-pointer"
          >
            <span>Categories</span>
            {collapsedSections.category ? (
              <ChevronDown className="size-3.5 text-slate-400" />
            ) : (
              <ChevronUp className="size-3.5 text-slate-400" />
            )}
          </button>

          {!collapsedSections.category && (
            <div className="mt-2 max-h-48 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
              {categories.map((cat) => {
                const id = cat._id || cat.id;
                const isSelected =
                  currentCategoryId === id || currentCategoryId === cat.slug;

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onCategoryChange?.(cat.slug || id)}
                    suppressHydrationWarning
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2 py-1 text-xs text-left transition-colors cursor-pointer",
                      isSelected
                        ? "bg-emerald-50 text-[#007A55] font-bold"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <span className="truncate">{cat.name}</span>
                    {isSelected && <Check className="size-3 text-[#007A55]" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. Brand */}
      {brands.length > 0 && (
        <div className="border-b border-slate-100 pb-4">
          <button
            type="button"
            onClick={() => toggleSection("brand")}
            className="flex w-full items-center justify-between py-1 text-xs font-bold text-slate-800 hover:text-[#007A55] cursor-pointer"
          >
            <span>Brand</span>
            {collapsedSections.brand ? (
              <ChevronDown className="size-3.5 text-slate-400" />
            ) : (
              <ChevronUp className="size-3.5 text-slate-400" />
            )}
          </button>

          {!collapsedSections.brand && (
            <div className="mt-2 space-y-2">
              {brands.length > 5 && (
                <div className="relative mb-2">
                  <input
                    type="text"
                    value={brandSearch}
                    onChange={(e) => setBrandSearch(e.target.value)}
                    placeholder="Search brand..."
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1 pl-7 pr-2 text-[11px] outline-none focus:border-[#007A55] focus:bg-white"
                  />
                  <Search className="size-3.5 text-slate-400 absolute left-2 top-2" />
                </div>
              )}

              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                {filteredBrands.map((brand) => {
                  const id = brand._id || brand.id;
                  const isChecked = selectedBrandIds.includes(id) || selectedBrandIds.includes(brand.slug);

                  return (
                    <label
                      key={id}
                      className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:text-slate-950 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onBrandToggle?.(id)}
                        className="size-3.5 rounded text-[#007A55] focus:ring-[#007A55] border-slate-300"
                      />
                      <span className={cn(isChecked && "font-bold text-[#007A55]")}>
                        {brand.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Customer Ratings */}
      <div className="border-b border-slate-100 pb-4">
        <button
          type="button"
          onClick={() => toggleSection("rating")}
          className="flex w-full items-center justify-between py-1 text-xs font-bold text-slate-800 hover:text-[#007A55] cursor-pointer"
        >
          <span>Customer Rating</span>
          {collapsedSections.rating ? (
            <ChevronDown className="size-3.5 text-slate-400" />
          ) : (
            <ChevronUp className="size-3.5 text-slate-400" />
          )}
        </button>

        {!collapsedSections.rating && (
          <div className="mt-2 space-y-1.5">
            {RATING_OPTIONS.map((opt) => {
              const isSelected = Number(selectedRating) === opt.stars;

              return (
                <button
                  key={`rating-${opt.stars}`}
                  type="button"
                  onClick={() => onRatingChange?.(isSelected ? null : opt.stars)}
                  suppressHydrationWarning
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs text-left transition-colors cursor-pointer",
                    isSelected
                      ? "bg-emerald-50 text-[#007A55] font-bold"
                      : "text-slate-700 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center text-amber-400">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "size-3",
                          i < opt.stars
                            ? "fill-amber-400 text-amber-400"
                            : "text-slate-200"
                        )}
                      />
                    ))}
                  </div>
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. Availability */}
      <div className="border-b border-slate-100 pb-4">
        <button
          type="button"
          onClick={() => toggleSection("availability")}
          className="flex w-full items-center justify-between py-1 text-xs font-bold text-slate-800 hover:text-[#007A55] cursor-pointer"
        >
          <span>Availability</span>
          {collapsedSections.availability ? (
            <ChevronDown className="size-3.5 text-slate-400" />
          ) : (
            <ChevronUp className="size-3.5 text-slate-400" />
          )}
        </button>

        {!collapsedSections.availability && (
          <div className="mt-2 space-y-1.5">
            {AVAILABILITY_OPTIONS.map((opt) => {
              const isSelected = selectedAvailability === opt.value;

              return (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:text-slate-950 transition-colors"
                >
                  <input
                    type="radio"
                    name="availabilityOption"
                    checked={isSelected}
                    onChange={() => onAvailabilityChange?.(isSelected ? null : opt.value)}
                    className="size-3.5 text-[#007A55] focus:ring-[#007A55] border-slate-300"
                  />
                  <span className={cn(isSelected && "font-bold text-[#007A55]")}>
                    {opt.label}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* 7. Discount */}
      <div>
        <button
          type="button"
          onClick={() => toggleSection("discount")}
          className="flex w-full items-center justify-between py-1 text-xs font-bold text-slate-800 hover:text-[#007A55] cursor-pointer"
        >
          <span>Discount</span>
          {collapsedSections.discount ? (
            <ChevronDown className="size-3.5 text-slate-400" />
          ) : (
            <ChevronUp className="size-3.5 text-slate-400" />
          )}
        </button>

        {!collapsedSections.discount && (
          <div className="mt-2 space-y-1.5">
            {DISCOUNT_OPTIONS.map((opt) => {
              const isSelected = Number(selectedDiscount) === opt.value;

              return (
                <label
                  key={`discount-${opt.value}`}
                  className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:text-slate-950 transition-colors"
                >
                  <input
                    type="radio"
                    name="discountOption"
                    checked={isSelected}
                    onChange={() => onDiscountChange?.(isSelected ? null : opt.value)}
                    className="size-3.5 text-[#007A55] focus:ring-[#007A55] border-slate-300"
                  />
                  <span className={cn(isSelected && "font-bold text-[#007A55]")}>
                    {opt.label}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

export default CategoryFilterSidebar;
