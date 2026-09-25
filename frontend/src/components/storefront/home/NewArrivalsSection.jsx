"use client";

import React, { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { SectionContainer } from "./SectionContainer.jsx";
import { ProductCarousel } from "../ProductCarousel.jsx";
import { storefrontService } from "../../../services/storefront.service.js";
import { productService } from "../../../services/product.service.js";

export function NewArrivalsSection({
  initialProducts = [],
  wishlistVariantIds = [],
  onWishlistToggle,
  onAddToCart,
}) {
  const [products, setProducts] = useState(initialProducts);

  useEffect(() => {
    if (initialProducts.length > 0) return;

    let isMounted = true;
    async function loadNewArrivals() {
      try {
        // 1. Check CMS section for configured "new_arrivals"
        const sectionRes = await storefrontService.getSections().catch(() => null);
        const activeSections = sectionRes?.data || [];
        const newArrivalsSec = activeSections.find(
          (s) => s.key === "new_arrivals" || s.type === "new_arrivals"
        );

        if (
          newArrivalsSec &&
          Array.isArray(newArrivalsSec.productIds) &&
          newArrivalsSec.productIds.length > 0
        ) {
          if (!isMounted) return;
          setProducts(newArrivalsSec.productIds);
          return;
        }

        // 2. Fetch products ordered by newest
        const prodRes = await productService.getProducts({
          limit: 12,
          status: "active",
        });
        if (!isMounted) return;
        const list =
          prodRes?.data?.products ||
          (Array.isArray(prodRes?.data) ? prodRes.data : []);
        setProducts(list);
      } catch {
        if (!isMounted) return;
        setProducts([]);
      }
    }

    loadNewArrivals();
    return () => {
      isMounted = false;
    };
  }, [initialProducts]);

  if (products.length === 0) {
    return null;
  }

  return (
    <SectionContainer
      title="New Arrivals"
      subtitle="Latest products, just for you."
      badge="JUST IN"
      badgeColor="bg-emerald-600 text-white"
      icon={Sparkles}
      iconBg="bg-emerald-100 text-emerald-600"
      viewAllHref="/shop?sort=newest"
      viewAllText="View All New Arrivals"
      variant="new"
      ariaLabel="New Arrivals"
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

export default NewArrivalsSection;
