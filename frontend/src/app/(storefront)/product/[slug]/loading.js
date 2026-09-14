"use client";

import React from "react";
import { Skeleton } from "../../../../components/ui/Skeleton.jsx";

export default function ProductDetailsLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      {/* Breadcrumb Skeleton */}
      <div className="mb-6 flex items-center gap-2">
        <Skeleton className="h-3 w-12" />
        <span className="text-slate-300">/</span>
        <Skeleton className="h-3 w-12" />
        <span className="text-slate-300">/</span>
        <Skeleton className="h-3 w-20" />
        <span className="text-slate-300">/</span>
        <Skeleton className="h-3 w-36" />
      </div>

      {/* Main Grid Skeleton */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
        {/* Left Column: Gallery Skeleton */}
        <div className="lg:col-span-6 space-y-4">
          <Skeleton className="aspect-square w-full rounded-3xl" />
          <div className="flex items-center gap-3">
            <Skeleton className="size-20 rounded-xl" />
            <Skeleton className="size-20 rounded-xl" />
            <Skeleton className="size-20 rounded-xl" />
          </div>
        </div>

        {/* Right Column: Info Skeleton */}
        <div className="lg:col-span-6 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-9 w-3/4" />
            <Skeleton className="h-4 w-40" />
          </div>

          <Skeleton className="h-20 w-full rounded-2xl" />

          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>

          <div className="flex items-center gap-4 pt-4 border-t">
            <Skeleton className="h-12 w-32 rounded-full" />
            <Skeleton className="h-12 flex-1 rounded-full" />
            <Skeleton className="h-12 flex-1 rounded-full" />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-4 border-t">
            <Skeleton className="h-8 w-full rounded-lg" />
            <Skeleton className="h-8 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
