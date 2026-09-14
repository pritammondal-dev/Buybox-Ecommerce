import React, { Suspense } from "react";
import { categoryService } from "../../../../services/category.service.js";
import { ShopCatalog } from "../../../../components/storefront/shop/ShopCatalog.jsx";
import { Skeleton } from "../../../../components/ui/Skeleton.jsx";

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug || "";

  try {
    const res = await categoryService.getCategories({ limit: 100 });
    const list = res?.data?.categories || (Array.isArray(res?.data) ? res.data : []);
    const cat = list.find((c) => c.slug === slug || c._id === slug);

    if (cat) {
      return {
        title: `${cat.name} | Buybox`,
        description: cat.description || `Browse our latest collection of ${cat.name} at Buybox.`,
      };
    }
  } catch {
    // Fallback metadata
  }

  const formattedName = slug
    ? slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " ")
    : "Category";

  return {
    title: `${formattedName} | Buybox`,
    description: `Browse ${formattedName} products at Buybox.`,
  };
}

function CategoryFallback() {
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

export default async function CategoryPage({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug || "";

  let categoryId = slug;
  let categoryName = slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " ");
  let categoryDescription = `Browse high quality ${categoryName} devices, accessories and gear.`;

  try {
    const res = await categoryService.getCategories({ limit: 100 });
    const list = res?.data?.categories || (Array.isArray(res?.data) ? res.data : []);
    const cat = list.find((c) => c.slug === slug || c._id === slug);

    if (cat) {
      categoryId = cat._id || cat.id;
      categoryName = cat.name;
      if (cat.description) {
        categoryDescription = cat.description;
      }
    }
  } catch {
    // Graceful fallback to slug
  }

  return (
    <Suspense fallback={<CategoryFallback />}>
      <ShopCatalog
        initialCategoryId={categoryId}
        initialCategoryName={categoryName}
        pageTitle={categoryName}
        pageDescription={categoryDescription}
      />
    </Suspense>
  );
}
