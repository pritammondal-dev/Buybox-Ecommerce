import React, { Suspense } from "react";
import { ShopCatalog } from "../../../../components/storefront/shop/ShopCatalog.jsx";
import { Skeleton } from "../../../../components/ui/Skeleton.jsx";
import { brandService } from "../../../../services/brand.service.js";

function formatSlugToTitle(slug = "") {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug || "";

  try {
    const res = await brandService.getBrands({ limit: 100 });
    const list = res?.data?.brands || (Array.isArray(res?.data) ? res.data : []);
    const brand = list.find(
      (b) =>
        b.slug?.toLowerCase() === slug.toLowerCase() ||
        b._id === slug ||
        b.id === slug
    );

    if (brand) {
      return {
        title: `${brand.name} Products | Buybox`,
        description:
          brand.description ||
          `Explore verified, authentic audio gear and tech accessories by ${brand.name} with official warranty at Buybox.`,
      };
    }
  } catch {
    // Fallback metadata
  }

  const title = formatSlugToTitle(slug);
  return {
    title: `${title} Products | Buybox`,
    description: `Shop authentic ${title} products online at Buybox.`,
  };
}

function BrandCatalogFallback() {
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

export default async function BrandPage({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug || "";
  const brandTitle = formatSlugToTitle(slug);

  return (
    <Suspense fallback={<BrandCatalogFallback />}>
      <ShopCatalog
        pageTitle={`${brandTitle} Collection`}
        pageDescription={`Discover official ${brandTitle} products with authentic manufacturer warranty, priority dispatch, and hassle-free returns.`}
      />
    </Suspense>
  );
}
