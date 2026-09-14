"use client";

import React from "react";
import Link from "next/link";
import {
  Shirt,
  UserCheck,
  Baby,
  Smile,
  Glasses,
  Watch,
  Headphones,
  Laptop,
  Tv,
  Folder,
  ArrowRight,
} from "lucide-react";
import { useCategoryStore } from "../../../stores/category.store.js";
import { Skeleton } from "../../ui/Skeleton.jsx";

function getCategoryIcon(name = "") {
  const lower = name.toLowerCase();
  if (lower.includes("audio") || lower.includes("headphone") || lower.includes("speaker")) return Headphones;
  if (lower.includes("computer") || lower.includes("laptop") || lower.includes("tech")) return Laptop;
  if (lower.includes("electronic") || lower.includes("appliance")) return Tv;
  if (lower.includes("women")) return Shirt;
  if (lower.includes("men")) return UserCheck;
  if (lower.includes("kid") || lower.includes("baby")) return Baby;
  if (lower.includes("watch") || lower.includes("jewelry")) return Watch;
  if (lower.includes("access") || lower.includes("glass")) return Glasses;
  return Folder;
}

export function FeaturedCategories({ initialCategories = [] }) {
  const storeCategories = useCategoryStore((state) => state.categories);
  const isLoading = useCategoryStore((state) => state.isLoading);

  // Prioritize server-rendered initialCategories or storeCategories
  const categories =
    initialCategories && initialCategories.length > 0
      ? initialCategories
      : storeCategories;

  if (isLoading && categories.length === 0) {
    return (
      <section aria-label="Product Categories" className="py-8 sm:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between pb-6 border-b border-slate-100">
            <Skeleton className="h-6 w-48 rounded-lg" />
            <Skeleton className="h-4 w-24 rounded-lg" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 pt-6">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={`cat-skel-${idx}`}
                className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white p-5 text-center shadow-xs"
              >
                <Skeleton className="size-16 rounded-full mb-3" />
                <Skeleton className="h-4 w-20 rounded-md mb-1.5" />
                <Skeleton className="h-3 w-12 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Gracefully hide if no categories in backend
  if (categories.length === 0) {
    return null;
  }

  return (
    <section aria-label="Shop by Category" className="py-8 sm:py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between pb-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              Shop by Category
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Explore authentic hardware across our verified product lines
            </p>
          </div>
          <Link
            href="/shop"
            className="flex items-center gap-1.5 text-xs font-bold text-[#007A55] hover:text-[#006346] transition-colors"
          >
            <span>View All</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 pt-6">
          {categories.map((cat) => {
            const id = cat.id || cat._id;
            const slug = cat.slug || id;
            const Icon = getCategoryIcon(cat.name);
            const imageUrl = cat.image?.url || null;

            return (
              <Link
                key={id}
                href={`/category/${slug}`}
                className="group flex flex-col items-center justify-center rounded-2xl border border-border/80 bg-white p-5 text-center shadow-xs transition-all duration-300 hover:border-[#007A55]/40 hover:shadow-card hover:-translate-y-1 cursor-pointer"
              >
                {/* Category Icon / Image Circle */}
                <div className="relative flex size-16 items-center justify-center rounded-full bg-slate-50 text-slate-700 transition-colors duration-300 group-hover:bg-emerald-50 group-hover:text-[#007A55] mb-3 overflow-hidden">
                  {imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={imageUrl}
                      alt={cat.name}
                      className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <Icon className="size-7 stroke-[1.7]" aria-hidden="true" />
                  )}
                </div>

                <span className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-[#007A55] transition-colors line-clamp-1">
                  {cat.name}
                </span>

                {cat.description && (
                  <span className="mt-1 text-[11px] font-medium text-slate-400 line-clamp-1">
                    {cat.description}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default FeaturedCategories;
