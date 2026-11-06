"use client";

import React, { useState, useEffect } from "react";
import { Award } from "lucide-react";
import { SectionContainer } from "./SectionContainer.jsx";
import { ProductCarousel } from "../ProductCarousel.jsx";
import { storefrontService } from "../../../services/storefront.service.js";

export function BestSellersSection({
  initialProducts = [],
  wishlistVariantIds = [],
  onWishlistToggle,
  onAddToCart,
  title: propTitle,
  subtitle: propSubtitle,
  theme,
  viewAllHref: propViewAllHref,
  viewAllText: propViewAllText,
}) {
  const [products, setProducts] = useState(initialProducts);
  const [title, setTitle] = useState(propTitle || "Best Sellers");
  const [subtitle, setSubtitle] = useState(propSubtitle || "Most loved products, top quality.");

  useEffect(() => {
    if (propTitle) setTitle(propTitle);
    if (propSubtitle) setSubtitle(propSubtitle);
  }, [propTitle, propSubtitle]);

  useEffect(() => {
    if (initialProducts.length > 0) return;

    let isMounted = true;
    async function loadBestSellers() {
      try {
        const sectionRes = await storefrontService.getSections().catch(() => null);
        const activeSections = sectionRes?.data || [];
        const bestSellerSec = activeSections.find(
          (s) => s.key === "best_sellers" || s.type === "best_sellers"
        );

        if (
          bestSellerSec &&
          Array.isArray(bestSellerSec.productIds) &&
          bestSellerSec.productIds.length > 0
        ) {
          if (!isMounted) return;
          if (bestSellerSec.title && !propTitle) setTitle(bestSellerSec.title);
          if (bestSellerSec.subtitle && !propSubtitle) setSubtitle(bestSellerSec.subtitle);
          setProducts(bestSellerSec.productIds);
        } else {
          if (!isMounted) return;
          setProducts([]);
        }
      } catch {
        if (!isMounted) return;
        setProducts([]);
      }
    }

    loadBestSellers();
    return () => {
      isMounted = false;
    };
  }, [initialProducts, propTitle, propSubtitle]);

  if (products.length === 0) {
    return null;
  }

  return (
    <SectionContainer
      title={propTitle || title}
      subtitle={propSubtitle || subtitle}
      badge="TOP RATED"
      badgeColor="bg-purple-600 text-white"
      icon={Award}
      iconBg="bg-purple-200 text-purple-800"
      viewAllHref={propViewAllHref !== undefined ? propViewAllHref : "/shop?sort=bestsellers"}
      viewAllText={propViewAllText || "View All Best Sellers"}
      variant="trending"
      ariaLabel="Best Sellers"
      theme={theme}
    >
      <ProductCarousel
        products={products}
        wishlistVariantIds={wishlistVariantIds}
        onWishlistToggle={onWishlistToggle}
        onAddToCart={onAddToCart}
      />
    </SectionContainer>
  );
}

export default BestSellersSection;
