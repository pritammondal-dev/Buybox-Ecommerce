"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  getPaginationRange,
  calculateRecordRange,
} from "../../utils/pagination.util.js";

export { getPaginationRange, calculateRecordRange };

/**
 * Accessible, responsive vendor table pagination component
 */
export default function VendorTablePagination({
  page = 1,
  limit = 20,
  total = 0,
  totalPages,
  onPageChange,
  onLimitChange,
  pageSizeOptions = [10, 20, 50, 100],
  isLoading = false,
  itemLabel = "records",
  className = "",
}) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const safeLimit = Math.max(1, Number(limit) || 20);
  const computedTotalPages = Math.max(
    1,
    totalPages !== undefined ? Number(totalPages) : Math.ceil(safeTotal / safeLimit) || 1
  );
  const safePage = Math.min(Math.max(1, Number(page) || 1), computedTotalPages);

  const startRecord = safeTotal === 0 ? 0 : (safePage - 1) * safeLimit + 1;
  const endRecord = Math.min(safePage * safeLimit, safeTotal);

  const paginationRange = getPaginationRange(safePage, computedTotalPages);

  const handlePageClick = (p) => {
    if (isLoading || p === safePage || typeof p !== "number") return;
    if (p >= 1 && p <= computedTotalPages) {
      onPageChange?.(p);
    }
  };

  const handlePrev = () => {
    if (isLoading || safePage <= 1) return;
    onPageChange?.(safePage - 1);
  };

  const handleNext = () => {
    if (isLoading || safePage >= computedTotalPages) return;
    onPageChange?.(safePage + 1);
  };

  const handleLimitSelect = (e) => {
    const newLimit = Number(e.target.value);
    if (!isNaN(newLimit) && newLimit > 0 && onLimitChange) {
      onLimitChange(newLimit);
    }
  };

  return (
    <nav
      aria-label="Table pagination"
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-4 sm:px-6 bg-white border-t border-slate-200 text-xs text-slate-600 select-none ${className}`}
    >
      {/* Records Summary */}
      <div className="flex items-center gap-3">
        <span className="font-medium text-slate-700">
          Showing <span className="font-semibold text-slate-900">{startRecord}</span>–
          <span className="font-semibold text-slate-900">{endRecord}</span> of{" "}
          <span className="font-semibold text-slate-900">{safeTotal}</span> {itemLabel}
        </span>

        {/* Page Size Selector */}
        {onLimitChange && (
          <div className="flex items-center gap-1.5 pl-3 border-l border-slate-200">
            <label htmlFor="vendor-page-size-select" className="text-slate-500 whitespace-nowrap">
              Per page:
            </label>
            <select
              id="vendor-page-size-select"
              value={safeLimit}
              disabled={isLoading}
              onChange={handleLimitSelect}
              className="px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-800 font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 transition-colors disabled:opacity-50 cursor-pointer"
              aria-label="Select number of items per page"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Page Navigation Controls */}
      <div className="flex items-center gap-1">
        {/* Previous Button */}
        <button
          type="button"
          onClick={handlePrev}
          disabled={safePage <= 1 || isLoading}
          aria-label="Previous page"
          className="inline-flex items-center justify-center p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="size-4" />
        </button>

        {/* Page Number Buttons */}
        <div className="hidden sm:flex items-center gap-1">
          {paginationRange.map((item, index) => {
            if (item === "...") {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="px-2 py-1 text-slate-400 select-none"
                  aria-hidden="true"
                >
                  …
                </span>
              );
            }

            const isCurrent = item === safePage;
            return (
              <button
                key={`page-${item}`}
                type="button"
                onClick={() => handlePageClick(item)}
                disabled={isLoading}
                aria-current={isCurrent ? "page" : undefined}
                aria-label={`Page ${item}`}
                className={`min-w-8 h-8 px-2.5 rounded-lg text-xs font-semibold transition-all ${
                  isCurrent
                    ? "bg-slate-900 text-white shadow-2xs font-bold"
                    : "text-slate-700 hover:bg-slate-100 border border-transparent hover:border-slate-200"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {item}
              </button>
            );
          })}
        </div>

        {/* Mobile Page Indicator */}
        <span className="sm:hidden px-3 text-xs font-semibold text-slate-700">
          Page {safePage} of {computedTotalPages}
        </span>

        {/* Next Button */}
        <button
          type="button"
          onClick={handleNext}
          disabled={safePage >= computedTotalPages || isLoading}
          aria-label="Next page"
          className="inline-flex items-center justify-center p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </nav>
  );
}
