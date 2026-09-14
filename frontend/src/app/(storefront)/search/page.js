import React, { Suspense } from "react";
import { ShopCatalog } from "../../../components/storefront/shop/ShopCatalog.jsx";
import { Skeleton } from "../../../components/ui/Skeleton.jsx";

export async function generateMetadata({ searchParams }) {
  const resolved = await searchParams;
  const q = resolved?.search || "";
  return {
    title: q ? `Search results for "${q}" | Buybox` : "Search Products | Buybox",
    description: `Browse products matching "${q || "your search"}" across all categories and brands at Buybox.`,
  };
}

function SearchFallback() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Skeleton className="h-4 w-32 mb-4" />
      <Skeleton className="h-28 w-full rounded-2xl mb-8" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export default async function SearchPage({ searchParams }) {
  const resolved = await searchParams;
  const q = resolved?.search || "";
  const cat = resolved?.category || "";

  return (
    <Suspense fallback={<SearchFallback />}>
      <ShopCatalog
        initialSearchQuery={q}
        initialCategoryId={cat}
        pageTitle={q ? `Search: "${q}"` : "Search Products"}
        pageDescription={
          q
            ? `Showing results matching "${q}". Refine by category and brand filters.`
            : "Search and discover high-performance audio equipment, peripherals, and accessories."
        }
      />
    </Suspense>
  );
}

