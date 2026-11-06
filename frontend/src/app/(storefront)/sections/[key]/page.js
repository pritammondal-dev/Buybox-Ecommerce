import React, { Suspense } from "react";
import { SectionDiscoveryView } from "../../../../components/storefront/sections/SectionDiscoveryView.jsx";
import { Skeleton } from "../../../../components/ui/Skeleton.jsx";

function formatSlugToTitle(key = "") {
  return key
    .replace(/[_-]/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const key = resolvedParams?.key || "";
  const title = formatSlugToTitle(key);

  return {
    title: `${title} Showcase | Buybox`,
    description: `Browse curated ${title} products with incredible prices, verified warranty, and express delivery at Buybox.`,
  };
}

function SectionFallback() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export default async function SectionPage({ params }) {
  const resolvedParams = await params;
  const key = resolvedParams?.key || "";

  return (
    <Suspense fallback={<SectionFallback />}>
      <SectionDiscoveryView sectionKey={key} />
    </Suspense>
  );
}
