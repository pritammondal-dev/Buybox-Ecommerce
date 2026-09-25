"use client";

import React, { useState } from "react";
import { cn } from "../../utils/cn.js";
import { Bookmark, Plus, Trash2 } from "lucide-react";

export function SavedViews({
  views = [],
  activeView,
  onViewChange,
  onSaveCurrentView,
  onDeleteView,
  className,
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [viewName, setViewName] = useState("");

  const handleSave = (e) => {
    e.preventDefault();
    if (!viewName.trim()) return;
    onSaveCurrentView?.(viewName.trim());
    setViewName("");
    setIsSaving(false);
  };

  return (
    <div
      role="tablist"
      aria-label="Saved Views"
      className={cn("flex items-center gap-1.5 overflow-x-auto border-b pb-2", className)}
    >
      {views.map((view) => {
        const viewId = view.id || view._id;
        const isActive = activeView === viewId;

        return (
          <div key={viewId} className="flex items-center group relative">
            <button
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onViewChange?.(viewId, view)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
                isActive
                  ? "bg-muted text-foreground font-semibold shadow-2xs"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <span>{view.label || view.name}</span>
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
            {onDeleteView && view._id && !view.isDefault && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteView(view._id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity"
                title="Delete saved view"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        );
      })}

      {onSaveCurrentView && (
        <div className="flex items-center ml-2">
          {isSaving ? (
            <form onSubmit={handleSave} className="flex items-center gap-1">
              <input
                type="text"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="View name..."
                className="h-7 px-2 text-xs rounded border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
              />
              <button
                type="submit"
                className="h-7 px-2 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsSaving(false)}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setIsSaving(true)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted"
            >
              <Plus className="w-3 h-3" />
              <span>Save View</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default SavedViews;
