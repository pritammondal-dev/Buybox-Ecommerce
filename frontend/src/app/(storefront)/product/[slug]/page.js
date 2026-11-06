import React from "react";
import { notFound } from "next/navigation";
import { productService } from "../../../../services/product.service.js";
import { categoryService } from "../../../../services/category.service.js";
import { brandService } from "../../../../services/brand.service.js";
import { getCategoryId, getBrandId } from "../../../../utils/category.util.js";
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

  // Safely extract string IDs and populated fallbacks (populated by product repository)
  const categoryId = getCategoryId(product.categoryId || product.category);
  const brandId = getBrandId(product.brandId || product.brand);

  const populatedCategory =
    typeof product.categoryId === "object" && product.categoryId !== null
      ? product.categoryId
      : typeof product.category === "object" && product.category !== null
      ? product.category
      : null;

  const populatedBrand =
    typeof product.brandId === "object" && product.brandId !== null
      ? product.brandId
      : typeof product.brand === "object" && product.brand !== null
      ? product.brand
      : null;

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
    categoryResult.status === "fulfilled" && categoryResult.value?.data
      ? categoryResult.value?.data?.category || categoryResult.value?.data || populatedCategory
      : populatedCategory;

  const brand =
    brandResult.status === "fulfilled" && brandResult.value?.data
      ? brandResult.value?.data?.brand || brandResult.value?.data || populatedBrand
      : populatedBrand;

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
