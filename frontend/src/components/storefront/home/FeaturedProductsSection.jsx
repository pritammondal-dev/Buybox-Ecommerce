"use client";

import React, { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { SectionContainer } from "./SectionContainer.jsx";
import { ProductCarousel } from "../ProductCarousel.jsx";
import { storefrontService } from "../../../services/storefront.service.js";
import { productService } from "../../../services/product.service.js";

export function FeaturedProductsSection({
  initialProducts = [],
  wishlistVariantIds = [],
  onWishlistToggle,
  onAddToCart,
}) {
  const [products, setProducts] = useState(initialProducts);
  const [title, setTitle] = useState("Featured Products");
  const [subtitle, setSubtitle] = useState("Handpicked for you, only the best.");

  useEffect(() => {
    if (initialProducts.length > 0) return;

    let isMounted = true;
    async function loadFeatured() {
      try {
        // 1. Check active CMS sections for configured "featured_products" section
        const sectionRes = await storefrontService.getSections().catch(() => null);
        const activeSections = sectionRes?.data || [];
        const featuredSec = activeSections.find(
          (s) => s.key === "featured_products" || s.type === "featured_products"
        );

        if (
          featuredSec &&
          Array.isArray(featuredSec.productIds) &&
          featuredSec.productIds.length > 0
        ) {
          if (!isMounted) return;
          if (featuredSec.title) setTitle(featuredSec.title);
          if (featuredSec.subtitle) setSubtitle(featuredSec.subtitle);
          setProducts(featuredSec.productIds);
          return;
        }

        // 2. Fetch products from API prioritizing isFeatured: true
        const prodRes = await productService.getProducts({
          limit: 12,
          status: "active",
        });
        if (!isMounted) return;
        const list =
          prodRes?.data?.products ||
          (Array.isArray(prodRes?.data) ? prodRes.data : []);
        const featuredOnly = list.filter((p) => p.isFeatured);
        setProducts(featuredOnly.length > 0 ? featuredOnly : list);
      } catch {
        if (!isMounted) return;
        setProducts([]);
      }
    }

    loadFeatured();
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
      badge="CURATED"
      badgeColor="bg-amber-600 text-white"
      icon={Star}
      iconBg="bg-amber-100 text-amber-500"
      viewAllHref="/shop?sort=featured"
      viewAllText="View All Featured"
      variant="featured"
      ariaLabel="Featured Products"
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

export default FeaturedProductsSection;
