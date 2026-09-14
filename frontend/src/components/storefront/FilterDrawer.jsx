"use client";

import React from "react";
import { SlidersHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "../ui/Sheet.jsx";
import { Button } from "../ui/Button.jsx";
import { FilterSidebar } from "./FilterSidebar.jsx";

export function FilterDrawer({
  isOpen,
  onClose,
  categories = [],
  brands = [],
  selectedCategories = [],
  selectedBrands = [],
  onCategoryChange,
  onBrandChange,
  onClearAll,
  onApply,
}) {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="left"
        onClose={onClose}
        className="w-full sm:max-w-xs flex flex-col justify-between p-0"
      >
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2 text-base font-bold">
            <SlidersHorizontal className="size-4 text-primary" />
            <span>Filter Products</span>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-5">
          <FilterSidebar
            categories={categories}
            brands={brands}
            selectedCategories={selectedCategories}
            selectedBrands={selectedBrands}
            onCategoryChange={onCategoryChange}
            onBrandChange={onBrandChange}
            onClearAll={onClearAll}
          />
        </div>

        <SheetFooter className="p-4 border-t bg-muted/20 flex gap-2">
          <Button variant="outline" size="sm" onClick={onClearAll} className="flex-1">
            Reset
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onApply?.();
              onClose?.();
            }}
            className="flex-1"
          >
            Apply Filters
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default FilterDrawer;
