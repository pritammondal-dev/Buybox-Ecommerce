"use client";

import React from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "../../../utils/cn.js";

export function CategoryPagination({
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  className,
}) {
  if (totalPages <= 1) return null;

  // Generate page numbers with ellipses
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) pages.push(i);

      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  const pages = getPageNumbers();

  return (
    <nav
      role="navigation"
      aria-label="Category pagination"
      className={cn("flex items-center justify-center gap-1.5 pt-8 pb-4", className)}
    >
      {/* Previous Button */}
      <button
        type="button"
        suppressHydrationWarning
        disabled={currentPage <= 1}
        onClick={() => onPageChange?.(currentPage - 1)}
        className={cn(
          "inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-xs transition-all",
          currentPage <= 1
            ? "border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed"
            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 active:scale-95"
        )}
      >
        <ChevronLeft className="size-3.5" />
        <span className="hidden sm:inline">Previous</span>
      </button>

      {/* Page Numbers */}
      <div className="flex items-center gap-1">
        {pages.map((p, idx) => {
          if (p === "...") {
            return (
              <span
                key={`ellipsis-${idx}`}
                className="flex size-8 sm:size-9 items-center justify-center text-slate-400"
              >
                <MoreHorizontal className="size-4" />
              </span>
            );
          }

          const isCurrent = p === currentPage;

          return (
            <button
              key={`page-${p}`}
              type="button"
              suppressHydrationWarning
              onClick={() => onPageChange?.(p)}
              aria-current={isCurrent ? "page" : undefined}
              className={cn(
                "flex size-8 sm:size-9 items-center justify-center rounded-lg text-xs font-bold transition-all shadow-xs",
                isCurrent
                  ? "bg-[#004D38] text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 active:scale-95"
              )}
            >
              {p}
            </button>
          );
        })}
      </div>

      {/* Next Button */}
      <button
        type="button"
        suppressHydrationWarning
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange?.(currentPage + 1)}
        className={cn(
          "inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-xs transition-all",
          currentPage >= totalPages
            ? "border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed"
            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 active:scale-95"
        )}
      >
        <span className="hidden sm:inline">Next</span>
        <ChevronRight className="size-3.5" />
      </button>
    </nav>
  );
}

export default CategoryPagination;
