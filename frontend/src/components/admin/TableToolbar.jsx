"use client";

import React from "react";
import { Search, X, Filter } from "lucide-react";
import { Input } from "../ui/Input.jsx";
import { Button } from "../ui/Button.jsx";
import { cn } from "../../utils/cn.js";

export function TableToolbar({
  searchQuery = "",
  onSearchChange,
  placeholder = "Filter rows...",
  filterContent,
  actions,
  children,
  className,
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-3",
        className
      )}
    >
      <div className="flex flex-1 items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder={placeholder}
            prefixIcon={Search}
            className="h-8 text-xs bg-background"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange?.("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {filterContent}
      </div>

      <div className="flex items-center gap-2">
        {actions}
        {children}
      </div>
    </div>
  );
}

export default TableToolbar;
