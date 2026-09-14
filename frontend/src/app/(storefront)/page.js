import React from "react";
import { HeroSection } from "../../components/storefront/home/HeroSection.jsx";
import { FeaturedCategories } from "../../components/storefront/home/FeaturedCategories.jsx";
import { HomeClientWrapper } from "../../components/storefront/home/HomeClientWrapper.jsx";
import { categoryService } from "../../services/category.service.js";
import { storefrontService } from "../../services/storefront.service.js";
import { productService } from "../../services/product.service.js";


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
  // Fetch initial storefront data server-side
  const [categoriesResult, bannersResult, sectionsResult, productsResult] =
    await Promise.allSettled([
      categoryService.getCategories({ limit: 12 }),
      storefrontService.getBanners(),
      storefrontService.getSections(),
      productService.getProducts({ limit: 8, status: "active" }),
    ]);

  const categories =
    categoriesResult.status === "fulfilled"
      ? (Array.isArray(categoriesResult.value?.data) ? categoriesResult.value.data : categoriesResult.value?.data?.categories || [])
      : [];

  const banners =
    bannersResult.status === "fulfilled"
      ? (Array.isArray(bannersResult.value?.data) ? bannersResult.value.data : [])
      : [];

  const sections =
    sectionsResult.status === "fulfilled"
      ? (Array.isArray(sectionsResult.value?.data) ? sectionsResult.value.data : [])
      : [];

  const products =
    productsResult.status === "fulfilled"
      ? (Array.isArray(productsResult.value?.data) ? productsResult.value.data : productsResult.value?.data?.products || [])
      : [];

  // Active featured products section or products with isFeatured: true
  const featuredSection = sections.find(
    (s) => s.key === "featured_products" || s.type === "featured_products"
  );
  const initialFeaturedProducts =
    featuredSection && Array.isArray(featuredSection.productIds) && featuredSection.productIds.length > 0
      ? featuredSection.productIds
      : products.filter((p) => p.isFeatured);

  // Active best sellers section from CMS
  const bestSellerSection = sections.find(
    (s) => s.key === "best_sellers" || s.type === "best_sellers"
  );
  const initialBestSellers =
    bestSellerSection && Array.isArray(bestSellerSection.productIds)
      ? bestSellerSection.productIds
      : [];

  // Active flash sale section from CMS if configured
  const flashSaleSection = sections.find(
    (s) => s.key === "flash_sale" || s.type === "flash_sale"
  );
  const initialCampaign =
    flashSaleSection && Array.isArray(flashSaleSection.productIds) && flashSaleSection.productIds.length > 0
      ? {
          title: flashSaleSection.title || "Flash Sale",
          description: flashSaleSection.subtitle,
          products: flashSaleSection.productIds,
        }
      : null;

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <HeroSection initialBanners={banners} />

      {/* Featured Categories */}
      <FeaturedCategories initialCategories={categories} />

      {/* Interactive Product & Promo Sections */}
      <HomeClientWrapper
        initialCampaign={initialCampaign}
        initialFlashDeals={products}
        initialFeaturedProducts={initialFeaturedProducts}
        initialBestSellers={initialBestSellers}
        initialNewArrivals={products}
      />
    </div>
  );
}
