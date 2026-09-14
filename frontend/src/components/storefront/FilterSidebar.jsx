"use client";

import React from "react";
import { Checkbox } from "../ui/Checkbox.jsx";
import { Button } from "../ui/Button.jsx";
import { Separator } from "../ui/Separator.jsx";
import { cn } from "../../utils/cn.js";

export function FilterSidebar({
  categories = [],
  brands = [],
  selectedCategories = [],
  selectedBrands = [],
  onCategoryChange,
  onBrandChange,
  onClearAll,
  className,
}) {
  const hasActiveFilters =
    selectedCategories.length > 0 || selectedBrands.length > 0;

  return (
    <aside
      aria-label="Product filters"
      className={cn("w-full space-y-6 text-sm", className)}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground tracking-tight">
          Filters
        </h3>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="h-8 px-2 text-xs text-primary hover:text-primary"
          >
            Clear All
          </Button>
        )}
      </div>

      {/* Categories Filter Group */}
      {categories.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider">
            Categories
          </h4>
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {categories.map((cat) => {
              const id = cat.id || cat._id || cat.slug;
              const isChecked = selectedCategories.includes(id);

              return (
                <div key={id} className="flex items-center gap-2">
                  <Checkbox
                    id={`cat-${id}`}
                    checked={isChecked}
                    onChange={() => onCategoryChange?.(id)}
                  />
                  <label
                    htmlFor={`cat-${id}`}
                    className="flex-1 cursor-pointer text-xs text-foreground/80 hover:text-foreground"
                  >
                    {cat.name}
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Separator />

      {/* Brands Filter Group */}
      {brands.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider">
            Brands
          </h4>
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {brands.map((brand) => {
              const id = brand.id || brand._id || brand.slug;
              const isChecked = selectedBrands.includes(id);

              return (
                <div key={id} className="flex items-center gap-2">
                  <Checkbox
                    id={`brand-${id}`}
                    checked={isChecked}
                    onChange={() => onBrandChange?.(id)}
                  />
                  <label
                    htmlFor={`brand-${id}`}
                    className="flex-1 cursor-pointer text-xs text-foreground/80 hover:text-foreground"
                  >
                    {brand.name}
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}

export default FilterSidebar;
