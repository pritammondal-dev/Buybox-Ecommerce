"use client";

import React from "react";
import { X } from "lucide-react";
import { Button } from "../ui/Button.jsx";
import { cn } from "../../utils/cn.js";

export function BulkActions({
  selectedCount = 0,
  onClearSelection,
  children,
  className,
}) {
  if (selectedCount <= 0) return null;

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full border bg-slate-900 text-white px-4 py-2 shadow-modal animate-in slide-in-from-bottom duration-200",
        className
      )}
    >
      <div className="flex items-center gap-2 border-r border-slate-700 pr-3">
        <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
          {selectedCount}
        </span>
        <span className="text-xs font-medium text-slate-200">
          Selected
        </span>
      </div>

      <div className="flex items-center gap-2">
        {children}
      </div>

      {onClearSelection && (
        <button
          type="button"
          onClick={onClearSelection}
          aria-label="Clear selection"
          className="ml-1 text-slate-400 hover:text-white transition-colors"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

export default BulkActions;
