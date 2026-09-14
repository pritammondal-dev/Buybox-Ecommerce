"use client";

import React from "react";
import { cn } from "../../utils/cn.js";

export function SavedViews({
  views = [],
  activeView,
  onViewChange,
  className,
}) {
  return (
    <div
      role="tablist"
      aria-label="Saved Views"
      className={cn("flex items-center gap-1 overflow-x-auto border-b pb-2", className)}
    >
      {views.map((view) => {
        const isActive = activeView === view.id;

        return (
          <button
            key={view.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onViewChange?.(view.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
              isActive
                ? "bg-muted text-foreground font-semibold shadow-2xs"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            <span>{view.label}</span>
            {view.count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {view.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default SavedViews;
