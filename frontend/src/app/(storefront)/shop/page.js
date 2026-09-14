import React, { Suspense } from "react";
import { ShopCatalog } from "../../../components/storefront/shop/ShopCatalog.jsx";
import { Skeleton } from "../../../components/ui/Skeleton.jsx";

export const metadata = {
  title: "Shop All Products | Buybox",
  description:
    "Explore our complete catalog of high-performance wireless audio, computer accessories, mechanical peripherals, and smart gear.",
};

function ShopCatalogFallback() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Skeleton className="h-4 w-32 mb-4" />
      <Skeleton className="h-32 w-full rounded-2xl mb-8" />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
        <Skeleton className="hidden lg:block h-96 rounded-2xl" />
        <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<ShopCatalogFallback />}>
      <ShopCatalog
        pageTitle="Explore All Gear"
        pageDescription="Discover high-precision audio equipment, mechanical components, and modern desk essentials from verified manufacturers."
      />
    </Suspense>
  );
}
