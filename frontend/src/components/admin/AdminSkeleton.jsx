import React from "react";
import { Skeleton } from "../ui/Skeleton.jsx";
import { cn } from "../../utils/cn.js";

export function AdminTableSkeleton({ rows = 5, columns = 4, className }) {
  return (
    <div className={cn("space-y-3 rounded-lg border bg-card p-4", className)}>
      <div className="flex justify-between items-center pb-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-10 w-full bg-muted/70" />
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 py-2 border-b border-border/40">
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton key={c} className="h-6 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminKPISkeleton({ count = 4, className }) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-5 space-y-3">
          <div className="flex justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="size-8 rounded-lg" />
          </div>
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-3 w-36" />
        </div>
      ))}
    </div>
  );
}

export default AdminTableSkeleton;
