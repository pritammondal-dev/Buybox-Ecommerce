"use client";

import React from "react";
import { X, SlidersHorizontal } from "lucide-react";
import { Sheet, SheetContent } from "../../ui/Sheet.jsx";
import { CategoryFilterSidebar } from "./CategoryFilterSidebar.jsx";
import { cn } from "../../../utils/cn.js";

export function MobileFilterDrawer({
  isOpen = false,
  onClose,
  totalResults = 0,
  ...sidebarProps
}) {
  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
      <SheetContent
        side="left"
        className="w-[85vw] sm:max-w-md p-0 flex flex-col h-full bg-white z-[60]"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-[#004D38]" />
            <h2 className="text-base font-bold text-slate-900">Filters</h2>
            {sidebarProps.activeFilterCount > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-[#004D38] text-[11px] font-bold text-white">
                {sidebarProps.activeFilterCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {sidebarProps.activeFilterCount > 0 && (
              <button
                type="button"
                suppressHydrationWarning
                onClick={sidebarProps.onClearAll}
                className="text-xs font-semibold text-[#004D38] hover:underline px-2 py-1"
              >
                Clear all
              </button>
            )}
            <button
              type="button"
              suppressHydrationWarning
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
              aria-label="Close filters"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Drawer Body (Scrollable Filters) */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <CategoryFilterSidebar
            {...sidebarProps}
            className="border-0 shadow-none p-0 rounded-none static w-full"
          />
        </div>

        {/* Drawer Sticky Footer */}
        <div className="border-t border-slate-200 bg-white p-4 sticky bottom-0 z-10 shadow-lg">
          <button
            type="button"
            suppressHydrationWarning
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#004D38] py-3 px-4 text-sm font-bold text-white shadow-md hover:bg-[#003B2B] active:scale-98 transition-all"
          >
            <span>Apply Filters</span>
            {totalResults > 0 && (
              <span className="text-xs font-medium text-emerald-200">
                ({totalResults} items)
              </span>
            )}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default MobileFilterDrawer;
