"use client";

import React from "react";

export function CartSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      {/* Breadcrumb Skeleton */}
      <div className="h-4 w-32 bg-slate-200 rounded-md mb-6" />

      {/* Title Skeleton */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-200">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-slate-200 rounded-xl" />
          <div className="h-3 w-28 bg-slate-100 rounded-md" />
        </div>
        <div className="h-8 w-20 bg-slate-100 rounded-full" />
      </div>

      {/* Grid: Items (8 cols) and Summary (4 cols) */}
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={`cart-skel-item-${i}`}
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs"
            >
              <div className="flex items-center gap-4 flex-1">
                <div className="size-20 shrink-0 rounded-xl bg-slate-100" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-3/4 bg-slate-200 rounded-md" />
                  <div className="h-3 w-1/4 bg-slate-100 rounded-md" />
                  <div className="h-3 w-1/3 bg-slate-100 rounded-md" />
                </div>
              </div>
              <div className="flex items-center gap-6 w-full sm:w-auto justify-between">
                <div className="h-8 w-24 bg-slate-100 rounded-full" />
                <div className="h-5 w-16 bg-slate-200 rounded-md" />
                <div className="size-8 bg-slate-100 rounded-lg" />
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-4">
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-6 space-y-5">
            <div className="h-5 w-32 bg-slate-200 rounded-md pb-2 border-b border-slate-200" />
            <div className="space-y-3 pt-2">
              <div className="flex justify-between">
                <div className="h-3 w-20 bg-slate-200 rounded-md" />
                <div className="h-3 w-16 bg-slate-200 rounded-md" />
              </div>
              <div className="flex justify-between">
                <div className="h-3 w-28 bg-slate-200 rounded-md" />
                <div className="h-3 w-20 bg-slate-200 rounded-md" />
              </div>
              <div className="flex justify-between pt-3 border-t">
                <div className="h-4 w-24 bg-slate-300 rounded-md" />
                <div className="h-5 w-20 bg-slate-300 rounded-md" />
              </div>
            </div>
            <div className="h-12 w-full bg-slate-200 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default CartSkeleton;
