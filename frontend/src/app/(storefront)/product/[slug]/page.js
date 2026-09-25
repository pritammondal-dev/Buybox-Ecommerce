import React from "react";
import { notFound } from "next/navigation";
import { productService } from "../../../../services/product.service.js";
import { categoryService } from "../../../../services/category.service.js";
import { brandService } from "../../../../services/brand.service.js";
import { ProductDetailView } from "../../../../components/storefront/product/ProductDetailView.jsx";

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug || "";

  try {
    let res;
    try {
      res = await productService.getProductBySlug(slug);
    } catch {
      res = await productService.getProductById(slug);
    }
    const product = res?.data?.product || res?.data;

    if (product) {
      const primaryImage = product.images?.[0]?.url || product.image || null;
      const title = `${product.name} | Buybox`;
      const description =
        product.shortDescription ||
        product.description?.slice(0, 160) ||
        `Explore ${product.name} with verified quality, genuine brand warranty, and fast delivery at Buybox.`;

      return {
        title,
        description,
        openGraph: {
          title,
          description,
          type: "website",
          url: `/product/${slug}`,
          images: primaryImage ? [{ url: primaryImage, alt: product.name }] : [],
        },
        alternates: {
          canonical: `/product/${slug}`,
        },
      };
    }
  } catch {
    // Return standard fallback metadata
  }

  return {
    title: "Product Details | Buybox",
    description: "Explore high-performance audio, tech & peripherals with genuine warranty at Buybox.",
  };
}

export default async function ProductDetailPage({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug || "";

  let product = null;

  try {
    try {
      const res = await productService.getProductBySlug(slug);
      product = res?.data?.product || res?.data;
    } catch {
      const res = await productService.getProductById(slug);
      product = res?.data?.product || res?.data;
    }
  } catch {
    notFound();
  }

  if (!product) {
    notFound();
  }

  // Resolve brand, category, same-category products, and all categories concurrently
  const categoryId = product.categoryId || product.category?._id;
  const brandId = product.brandId || product.brand?._id;

  const [categoryResult, brandResult, sameCategoryResult, allCategoriesResult] =
    await Promise.allSettled([
      categoryId ? categoryService.getCategoryById(categoryId) : Promise.resolve(null),
      brandId ? brandService.getBrandById(brandId) : Promise.resolve(null),
      categoryId
        ? productService.getProducts({ categoryId, limit: 5, status: "active" })
        : Promise.resolve(null),
      categoryService.getCategories(),
    ]);

  const category =
    categoryResult.status === "fulfilled"
      ? categoryResult.value?.data?.category || categoryResult.value?.data || null
      : null;

  const brand =
    brandResult.status === "fulfilled"
      ? brandResult.value?.data?.brand || brandResult.value?.data || null
      : null;

  const allCategories =
    allCategoriesResult.status === "fulfilled"
      ? allCategoriesResult.value?.data?.categories ||
        (Array.isArray(allCategoriesResult.value?.data)
          ? allCategoriesResult.value.data
          : [])
      : [];

  let sameCategoryProducts = [];
  if (sameCategoryResult.status === "fulfilled" && sameCategoryResult.value) {
    const list =
      sameCategoryResult.value?.data?.products ||
      (Array.isArray(sameCategoryResult.value?.data)
        ? sameCategoryResult.value.data
        : []);
    const currentId = product._id || product.id;
    sameCategoryProducts = list.filter((p) => (p._id || p.id) !== currentId);
  }

  return (
    <ProductDetailView
      product={product}
      brand={brand}
      category={category}
      allCategories={allCategories}
      sameCategoryProducts={sameCategoryProducts}
    />
  );
}
