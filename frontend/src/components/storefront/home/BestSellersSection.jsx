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
}) {
  const [products, setProducts] = useState(initialProducts);
  const [title, setTitle] = useState("Best Sellers");
  const [subtitle, setSubtitle] = useState("Most loved products, top quality.");

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
          if (bestSellerSec.title) setTitle(bestSellerSec.title);
          if (bestSellerSec.subtitle) setSubtitle(bestSellerSec.subtitle);
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
  }, [initialProducts]);

  if (products.length === 0) {
    return null;
  }

  return (
    <SectionContainer
      title={title}
      subtitle={subtitle}
      badge="TOP RATED"
      badgeColor="bg-purple-600 text-white"
      icon={Award}
      iconBg="bg-purple-200 text-purple-800"
      viewAllHref="/shop?sort=bestsellers"
      viewAllText="View All Best Sellers"
      variant="trending"
      ariaLabel="Best Sellers"
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
