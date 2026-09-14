"use client";

import React from "react";
import { Skeleton } from "../../ui/Skeleton.jsx";

export function CheckoutSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 animate-pulse space-y-8">
      {/* Breadcrumb skeleton */}
      <div className="flex gap-2">
        <Skeleton className="h-4 w-12 rounded-md" />
        <Skeleton className="h-4 w-4 rounded-md" />
        <Skeleton className="h-4 w-12 rounded-md" />
        <Skeleton className="h-4 w-4 rounded-md" />
        <Skeleton className="h-4 w-16 rounded-md" />
      </div>

      {/* Header skeleton */}
      <div className="space-y-2 border-b pb-6">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-4 w-72 rounded-md" />
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        {/* Left column (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
            <Skeleton className="h-6 w-40 rounded-md" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
            <Skeleton className="h-6 w-36 rounded-md" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
        </div>

        {/* Right column (5 cols) */}
        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
            <Skeleton className="h-6 w-32 rounded-md" />
            <div className="space-y-3">
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
            </div>
            <div className="space-y-2 border-t pt-4">
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-6 w-full rounded-md" />
            </div>
            <Skeleton className="h-12 w-full rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default CheckoutSkeleton;
