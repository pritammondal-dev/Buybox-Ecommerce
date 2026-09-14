"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useWishlist } from "../../../hooks/useWishlist.js";
import { useCart } from "../../../hooks/useCart.js";
import { ProductGallery } from "./ProductGallery.jsx";
import { ProductInfo } from "./ProductInfo.jsx";
import { ProductActions } from "./ProductActions.jsx";
import { DeliveryWidget } from "./DeliveryWidget.jsx";
import { ProductTabs } from "./ProductTabs.jsx";
import { MoreFromCategory } from "./MoreFromCategory.jsx";
import { MobileStickyBar } from "./MobileStickyBar.jsx";
import { recordRecentlyViewed } from "../../../utils/recentlyViewed.js";

export function ProductDetailView({
  product,
  brand,
  category,
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

  const categoryName = category?.name || "";
  const categorySlug = category?.slug || product?.categoryId;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-[#007A55] transition-colors">
          Home
        </Link>
        <span>/</span>
        <Link href="/shop" className="hover:text-[#007A55] transition-colors">
          Shop
        </Link>
        <span>/</span>
        {category && (
          <>
            <Link
              href={`/category/${categorySlug}`}
              className="hover:text-[#007A55] transition-colors font-medium"
            >
              {categoryName}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="font-semibold text-slate-900 line-clamp-1">
          {product?.name}
        </span>
      </nav>

      {/* Main Product Grid (12 Columns) */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12 items-start">
        {/* Left Column: Gallery (6 cols) */}
        <div className="lg:col-span-6 lg:sticky lg:top-28">
          <ProductGallery
            product={product}
            isWishlisted={isWishlisted}
            onWishlistToggle={handleWishlistToggle}
          />
        </div>

        {/* Right Column: Product Meta, Actions, Delivery (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          <ProductInfo
            product={product}
            brand={brand}
            category={category}
            onReviewsClick={scrollToReviews}
          />

          <ProductActions
            product={product}
            isWishlisted={isWishlisted}
            onWishlistToggle={handleWishlistToggle}
          />

          <DeliveryWidget />
        </div>
      </div>

      {/* Tabbed Specifications, Description & Reviews */}
      <ProductTabs
        product={product}
        brand={brand}
        category={category}
      />

      {/* Same-Category Catalog Products (if any exist) */}
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
          const productId = item._id || item.id;
          const productVariantId =
            item.productVariantId ||
            item.defaultVariantId ||
            undefined;
          addCartItem({
            ...(productVariantId ? { productVariantId } : {}),
            productId,
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
