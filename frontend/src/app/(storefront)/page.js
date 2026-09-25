import React from "react";
import { HeroSection } from "../../components/storefront/home/HeroSection.jsx";
import { TrustSection } from "../../components/storefront/home/TrustSection.jsx";
import { FeaturedCategories } from "../../components/storefront/home/FeaturedCategories.jsx";
import { HomeClientWrapper } from "../../components/storefront/home/HomeClientWrapper.jsx";
import { categoryService } from "../../services/category.service.js";
import { storefrontService } from "../../services/storefront.service.js";
import { productService } from "../../services/product.service.js";
import { brandService } from "../../services/brand.service.js";

export const metadata = {
  title: "Buybox | High-Performance Audio, Tech & Peripherals",
  description:
    "Explore high-fidelity wireless audio, mechanical hardware, minimalist EDC, and smart electronics with manufacturer warranties at Buybox.",
  openGraph: {
    title: "Buybox | High-Performance Audio, Tech & Peripherals",
    description:
      "Explore high-fidelity wireless audio, mechanical hardware, minimalist EDC, and smart electronics with manufacturer warranties at Buybox.",
    url: "/",
    siteName: "Buybox E-Commerce",
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Buybox | High-Performance Audio, Tech & Peripherals",
    description:
      "Explore high-fidelity wireless audio, mechanical hardware, minimalist EDC, and smart electronics with manufacturer warranties at Buybox.",
  },
};

export default async function StorefrontHomePage() {
  // Fetch initial storefront data server-side across all domains
  const [
    categoriesResult,
    bannersResult,
    sectionsResult,
    productsResult,
    brandsResult,
  ] = await Promise.allSettled([
    categoryService.getCategories({ limit: 16 }),
    storefrontService.getBanners(),
    storefrontService.getSections(),
    productService.getProducts({ limit: 24, status: "active" }),
    brandService.getBrands({ limit: 16 }),
  ]);

  const categories =
    categoriesResult.status === "fulfilled"
      ? Array.isArray(categoriesResult.value?.data)
        ? categoriesResult.value.data
        : categoriesResult.value?.data?.categories || []
      : [];

  const banners =
    bannersResult.status === "fulfilled"
      ? Array.isArray(bannersResult.value?.data)
        ? bannersResult.value.data
        : []
      : [];

  const sections =
    sectionsResult.status === "fulfilled"
      ? Array.isArray(sectionsResult.value?.data)
        ? sectionsResult.value.data
        : []
      : [];

  const products =
    productsResult.status === "fulfilled"
      ? Array.isArray(productsResult.value?.data)
        ? productsResult.value.data
        : productsResult.value?.data?.products || []
      : [];

  const brands =
    brandsResult.status === "fulfilled"
      ? Array.isArray(brandsResult.value?.data)
        ? brandsResult.value.data
        : brandsResult.value?.data?.brands || []
      : [];

  // 1. Featured products from CMS section or fallback to isFeatured products
  const featuredSection = sections.find(
    (s) => s.key === "featured_products" || s.type === "featured_products"
  );
  const initialFeaturedProducts =
    featuredSection &&
    Array.isArray(featuredSection.productIds) &&
    featuredSection.productIds.length > 0
      ? featuredSection.productIds
      : products.filter((p) => p.isFeatured);

  // 2. New arrivals from CMS section or sorted by newest
  const newArrivalsSection = sections.find(
    (s) => s.key === "new_arrivals" || s.type === "new_arrivals"
  );
  const initialNewArrivals =
    newArrivalsSection &&
    Array.isArray(newArrivalsSection.productIds) &&
    newArrivalsSection.productIds.length > 0
      ? newArrivalsSection.productIds
      : products;

  // 3. Best sellers from CMS section or fallback to popular products
  const bestSellerSection = sections.find(
    (s) => s.key === "best_sellers" || s.type === "best_sellers"
  );
  const initialBestSellers =
    bestSellerSection &&
    Array.isArray(bestSellerSection.productIds) &&
    bestSellerSection.productIds.length > 0
      ? bestSellerSection.productIds
      : products.slice(0, 5);

  // 4. Hot deals from CMS section or fallback
  const hotDealsSection = sections.find(
    (s) => s.key === "flash_deal" || s.type === "flash_deal"
  );
  const initialHotDeals =
    hotDealsSection &&
    Array.isArray(hotDealsSection.productIds) &&
    hotDealsSection.productIds.length > 0
      ? hotDealsSection.productIds
      : products.slice(0, 4);

  // 5. Flash sale from CMS section or fallback
  const flashSaleSection = sections.find(
    (s) => s.key === "flash_sale" || s.type === "flash_sale"
  );
  const initialFlashSale =
    flashSaleSection &&
    Array.isArray(flashSaleSection.productIds) &&
    flashSaleSection.productIds.length > 0
      ? flashSaleSection.productIds
      : products.slice(4, 8);

  return (
    <div className="flex flex-col">
      {/* 5. Hero Showcase (2/3 width Big Summer Sale + 1/3 width 3 Stacked Cards) */}
      <HeroSection initialBanners={banners} />

      {/* 6. Marketplace Trust Bar (4 Guarantees in rounded container) */}
      <TrustSection />

      {/* 7. Shop by Category (8 Pastel Circular Cards) */}
      <FeaturedCategories initialCategories={categories} />

      {/* 8-18. Complete Marketplace Merchandising Journey */}
      <HomeClientWrapper
        initialBanners={banners}
        initialFeaturedProducts={initialFeaturedProducts}
        initialNewArrivals={initialNewArrivals}
        initialBestSellers={initialBestSellers}
        initialHotDeals={initialHotDeals}
        initialFlashSale={initialFlashSale}
        initialRecentlyViewed={products.slice(0, 5)}
        initialBrands={brands}
      />
    </div>
  );
}
