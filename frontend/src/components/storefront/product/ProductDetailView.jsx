"use client";

import React, { useEffect, useMemo } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useWishlist } from "../../../hooks/useWishlist.js";
import { useCart } from "../../../hooks/useCart.js";
import { ProductGallery } from "./ProductGallery.jsx";
import { ProductInfo } from "./ProductInfo.jsx";
import { ProductOffers } from "./ProductOffers.jsx";
import { ProductHighlights } from "./ProductHighlights.jsx";
import { ProductActions } from "./ProductActions.jsx";
import { DeliveryWidget } from "./DeliveryWidget.jsx";
import { ProductTabs } from "./ProductTabs.jsx";
import { MoreFromCategory } from "./MoreFromCategory.jsx";
import { RecentlyViewedSection } from "./RecentlyViewedSection.jsx";
import { MobileStickyBar } from "./MobileStickyBar.jsx";
import { recordRecentlyViewed } from "../../../utils/recentlyViewed.js";

export function ProductDetailView({
  product,
  brand,
  category,
  allCategories = [],
  sameCategoryProducts = [],
}) {
  const { items: wishlistItems, addItem: addWishlistItem, removeItem: removeWishlistItem } = useWishlist();
  const { addItem: addCartItem } = useCart();

  const productId = product?._id || product?.id;
  const isWishlisted = Array.isArray(wishlistItems) && wishlistItems.includes(productId);

  // Record product in recently viewed history
  useEffect(() => {
    if (productId) {
      recordRecentlyViewed(productId);
    }
  }, [productId]);

  const handleWishlistToggle = async () => {
    try {
      if (isWishlisted) {
        await removeWishlistItem(productId);
        toast.info("Removed from wishlist");
      } else {
        await addWishlistItem(productId);
        toast.success("Added to wishlist");
      }
    } catch {
      toast.error("Could not update wishlist.");
    }
  };

  const scrollToReviews = () => {
    const tabsElement = document.getElementById("product-details-tabs");
    if (tabsElement) {
      tabsElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Build hierarchical breadcrumbs if parent category exists
  const breadcrumbTrail = useMemo(() => {
    const trail = [
      { label: "Home", href: "/" },
      { label: "Shop", href: "/shop" },
    ];

    if (!category) return trail;

    const parentId = category.parentId;
    if (parentId && Array.isArray(allCategories) && allCategories.length > 0) {
      const parentCat = allCategories.find(
        (c) => String(c._id || c.id) === String(parentId)
      );
      if (parentCat) {
        trail.push({
          label: parentCat.name,
          href: `/category/${parentCat.slug || parentCat._id}`,
        });
      }
    }

    trail.push({
      label: category.name,
      href: `/category/${category.slug || category._id}`,
    });

    return trail;
  }, [category, allCategories]);

  const categoryName = category?.name || "";
  const categorySlug = category?.slug || product?.categoryId;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Breadcrumb Navigation */}
      <nav
        aria-label="Breadcrumb"
        className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
      >
        {breadcrumbTrail.map((item, idx) => (
          <React.Fragment key={item.href || idx}>
            <Link
              href={item.href}
              className="hover:text-[#004D38] transition-colors font-medium"
            >
              {item.label}
            </Link>
            <ChevronRight className="size-3 text-slate-300" />
          </React.Fragment>
        ))}
        <span className="font-semibold text-slate-900 line-clamp-1 max-w-[280px] sm:max-w-md">
          {product?.name}
        </span>
      </nav>

      {/* Main Product Grid (12 Columns) */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12 items-start">
        {/* Left Column: Vertical/Horizontal Zoomable Gallery (6 cols) */}
        <div className="lg:col-span-6 lg:sticky lg:top-24">
          <ProductGallery
            product={product}
            isWishlisted={isWishlisted}
            onWishlistToggle={handleWishlistToggle}
          />
        </div>

        {/* Right Column: Information, Offers, Highlights, Actions, Delivery (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          <ProductInfo
            product={product}
            brand={brand}
            category={category}
            onReviewsClick={scrollToReviews}
          />

          <ProductOffers />

          <ProductHighlights specifications={product?.specifications} />

          <ProductActions
            product={product}
            isWishlisted={isWishlisted}
            onWishlistToggle={handleWishlistToggle}
          />

          <DeliveryWidget product={product} />
        </div>
      </div>

      {/* 4-Tabbed Specifications, Description, Seller & Reviews */}
      <ProductTabs
        product={product}
        brand={brand}
        category={category}
      />

      {/* Same-Category Catalog Products */}
      <MoreFromCategory
        products={sameCategoryProducts}
        categoryName={categoryName}
        categorySlug={categorySlug}
        wishlistVariantIds={wishlistItems}
        onWishlistToggle={(item, val) => {
          const id = item._id || item.id;
          if (val) addWishlistItem(id);
          else removeWishlistItem(id);
        }}
        onAddToCart={(item) => {
          const prodId = item._id || item.id;
          const productVariantId =
            item.productVariantId ||
            item.defaultVariantId ||
            undefined;
          addCartItem({
            ...(productVariantId ? { productVariantId } : {}),
            productId: prodId,
            quantity: 1,
            itemSnapshot: {
              name: item.name,
              price: item.price,
              image: item.images?.[0]?.url || item.image,
            },
          });
        }}
      />

      {/* Customer Recently Viewed Products Section */}
      <RecentlyViewedSection
        currentProductId={productId}
        wishlistVariantIds={wishlistItems}
        onWishlistToggle={(item, val) => {
          const id = item._id || item.id;
          if (val) addWishlistItem(id);
          else removeWishlistItem(id);
        }}
        onAddToCart={(item) => {
          const prodId = item._id || item.id;
          const productVariantId =
            item.productVariantId ||
            item.defaultVariantId ||
            undefined;
          addCartItem({
            ...(productVariantId ? { productVariantId } : {}),
            productId: prodId,
            quantity: 1,
            itemSnapshot: {
              name: item.name,
              price: item.price,
              image: item.images?.[0]?.url || item.image,
            },
          });
        }}
      />

      {/* Fixed Sticky Action Bar for Mobile Screens */}
      <MobileStickyBar product={product} />
    </div>
  );
}

export default ProductDetailView;
