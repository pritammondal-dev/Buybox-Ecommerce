import React, { Suspense } from "react";
import { ShopCatalog } from "../../../../components/storefront/shop/ShopCatalog.jsx";
import { Skeleton } from "../../../../components/ui/Skeleton.jsx";

function formatSlugToTitle(slug = "") {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug || "";
  const title = formatSlugToTitle(slug);

  return {
    title: `${title} Collection | Buybox`,
    description: `Browse curated ${title} audio and tech equipment handpicked for quality and performance at Buybox.`,
  };
}

function CollectionFallback() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export default async function CollectionPage({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug || "";
  const collectionTitle = formatSlugToTitle(slug);

  return (
    <Suspense fallback={<CollectionFallback />}>
      <ShopCatalog
        pageTitle={`${collectionTitle} Collection`}
        pageDescription={`Handpicked selection of premium audio peripherals, wireless monitors, and studio accessories curated for audiophiles.`}
      />
    </Suspense>
  );
}
