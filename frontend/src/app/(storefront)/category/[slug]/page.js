import React, { Suspense } from "react";
import { categoryService } from "../../../../services/category.service.js";
import { brandService } from "../../../../services/brand.service.js";
import { productService } from "../../../../services/product.service.js";
import { CategoryListingView } from "../../../../components/storefront/category/index.js";

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
    const res = await categoryService.getCategories({ limit: 100 });
    const list =
      res?.data?.categories || (Array.isArray(res?.data) ? res.data : []);
    const cat = list.find(
      (c) =>
        c.slug?.toLowerCase() === slug.toLowerCase() ||
        c._id === slug ||
        c.id === slug
    );

    if (cat) {
      return {
        title: `${cat.name} | Buybox`,
        description:
          cat.description ||
          `Shop the best ${cat.name} with incredible deals, fast delivery, and verified quality at Buybox.`,
        openGraph: {
          title: `${cat.name} | Buybox`,
          description:
            cat.description || `Browse our latest collection of ${cat.name}.`,
          images: cat.image?.url ? [{ url: cat.image.url }] : [],
        },
      };
    }
  } catch {
    // Fallback if API fails
  }

  const fallbackTitle = formatSlugToTitle(slug) || "Category";
  return {
    title: `${fallbackTitle} | Buybox`,
    description: `Shop ${fallbackTitle} products online at Buybox.`,
  };
}

function CategoryPageFallback() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] animate-pulse">
      {/* Banner Skeleton */}
      <div className="h-44 sm:h-52 w-full bg-[#004D38]/80" />

      {/* Body Skeleton */}
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex items-start gap-6 xl:gap-8">
          {/* Sidebar Skeleton */}
          <div className="hidden lg:block w-64 xl:w-72 shrink-0 space-y-4">
            <div className="h-8 w-32 bg-slate-200 rounded-lg" />
            <div className="h-44 bg-slate-200 rounded-2xl" />
            <div className="h-44 bg-slate-200 rounded-2xl" />
          </div>

          {/* Grid Skeleton */}
          <div className="flex-1 min-w-0 space-y-4">
            <div className="flex justify-between items-center h-8">
              <div className="h-4 w-40 bg-slate-200 rounded" />
              <div className="h-8 w-32 bg-slate-200 rounded-lg" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-80 bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between"
                >
                  <div className="h-44 w-full bg-slate-100 rounded-xl mb-3" />
                  <div className="h-4 w-3/4 bg-slate-200 rounded mb-2" />
                  <div className="h-4 w-1/2 bg-slate-200 rounded mb-4" />
                  <div className="h-9 w-full bg-slate-200 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function CategoryPage({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug || "";

  let allCategories = [];
  let allBrands = [];
  let category = null;
  let initialProducts = [];
  let initialMeta = null;

  try {
    // 1. Fetch Categories
    const catRes = await categoryService.getCategories({ limit: 100 });
    allCategories =
      catRes?.data?.categories ||
      (Array.isArray(catRes?.data) ? catRes.data : []);

    // Match current category by slug or ID
    category = allCategories.find(
      (c) =>
        c.slug?.toLowerCase() === slug.toLowerCase() ||
        c._id === slug ||
        c.id === slug
    );
  } catch (err) {
    console.error("Error fetching categories for category page:", err);
  }

  try {
    // 2. Fetch Brands
    const brandRes = await brandService.getBrands({ limit: 100 });
    allBrands =
      brandRes?.data?.brands ||
      (Array.isArray(brandRes?.data) ? brandRes.data : []);
  } catch (err) {
    console.error("Error fetching brands for category page:", err);
  }

  // Construct fallback category object if not found in db
  if (!category) {
    category = {
      _id: slug,
      id: slug,
      slug,
      name: formatSlugToTitle(slug) || "Products",
      description: `Explore premium ${formatSlugToTitle(
        slug
      )} products with top ratings and fast delivery.`,
    };
  }

  // 3. Pre-fetch initial products on SSR
  if (category?._id) {
    try {
      const prodRes = await productService.getProducts({
        categoryId: category._id,
        limit: 12,
        sort: "featured",
      });
      initialProducts =
        prodRes?.data?.products ||
        (Array.isArray(prodRes?.data) ? prodRes.data : []);
      initialMeta = prodRes?.meta || null;
    } catch {
      // Client will fetch if SSR prefetch fails
    }
  }

  return (
    <Suspense fallback={<CategoryPageFallback />}>
      <CategoryListingView
        category={category}
        allCategories={allCategories}
        allBrands={allBrands}
        initialProducts={initialProducts}
        initialMeta={initialMeta}
      />
    </Suspense>
  );
}
