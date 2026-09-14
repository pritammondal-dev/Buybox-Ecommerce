"use client";

import React from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { Button } from "./Button.jsx";
import { cn } from "../../utils/cn.js";

export function Pagination({
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  className,
}) {
  if (totalPages <= 1) return null;

  // Generate page numbers to show
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
      aria-label="pagination"
      className={cn("mx-auto flex w-full justify-center gap-1", className)}
    >
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange?.(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="Go to previous page"
      >
        <ChevronLeft className="size-4" />
        <span className="hidden sm:inline">Previous</span>
      </Button>

      <div className="flex items-center gap-1">
        {pages.map((p, idx) => {
          if (p === "...") {
            return (
              <span
                key={`ellipsis-${idx}`}
                className="flex size-9 items-center justify-center text-muted-foreground"
              >
                <MoreHorizontal className="size-4" />
              </span>
            );
          }

          const isCurrent = p === currentPage;
          return (
            <Button
              key={p}
              variant={isCurrent ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange?.(p)}
              aria-current={isCurrent ? "page" : undefined}
              className="size-9 p-0 text-sm"
            >
              {p}
            </Button>
          );
        })}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange?.(currentPage + 1)}
        disabled={currentPage >= totalPages}
        aria-label="Go to next page"
      >
        <span className="hidden sm:inline">Next</span>
        <ChevronRight className="size-4" />
      </Button>
    </nav>
  );
}

export default Pagination;
