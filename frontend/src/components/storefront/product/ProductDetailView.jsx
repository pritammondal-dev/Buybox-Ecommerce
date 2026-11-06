"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useWishlist } from "../../../hooks/useWishlist.js";
import { useCart } from "../../../hooks/useCart.js";
import { productService } from "../../../services/product.service.js";
import { ProductGallery } from "./ProductGallery.jsx";
import { ProductInfo } from "./ProductInfo.jsx";
import {
  ProductVariantSelector,
  normalizeVariantAttributes,
} from "./ProductVariantSelector.jsx";
import { ProductOffers } from "./ProductOffers.jsx";
import { ProductHighlights } from "./ProductHighlights.jsx";
import { ProductActions } from "./ProductActions.jsx";
import { DeliveryWidget } from "./DeliveryWidget.jsx";
import { ProductTabs } from "./ProductTabs.jsx";
import { MoreFromCategory } from "./MoreFromCategory.jsx";
import { RecentlyViewedSection } from "./RecentlyViewedSection.jsx";
import { MobileStickyBar } from "./MobileStickyBar.jsx";
import { recordRecentlyViewed } from "../../../utils/recentlyViewed.js";
import { getCategorySlug } from "../../../utils/category.util.js";

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

  const isVariable = product?.productType === "variable";
  const activeVariants = useMemo(() => {
    return (product?.variants || []).filter((v) => v.isActive && !v.deletedAt);
  }, [product?.variants]);

  // Extract all attribute names across active variants
  const attributeGroupNames = useMemo(() => {
    const names = new Set();
    for (const v of activeVariants) {
      const attrs = normalizeVariantAttributes(v.attributes);
      for (const k of Object.keys(attrs)) {
        if (k) names.add(k.trim());
      }
    }
    return Array.from(names);
  }, [activeVariants]);

  // Attribute selection state
  const [selectedAttributes, setSelectedAttributes] = useState({});
  const [liveVariantStock, setLiveVariantStock] = useState({});

  // Initialize or reset selected attributes when product changes
  useEffect(() => {
    if (isVariable && activeVariants.length > 0) {
      const defaultVar =
        product?.defaultVariant ||
        activeVariants.find((v) => v.isDefault) ||
        activeVariants[0];
      if (defaultVar?.attributes) {
        setSelectedAttributes(normalizeVariantAttributes(defaultVar.attributes));
      } else {
        setSelectedAttributes({});
      }
    } else {
      setSelectedAttributes({});
    }
    setLiveVariantStock({});
  }, [productId, isVariable, activeVariants, product?.defaultVariant]);

  // Canonical variant for simple product
  const canonicalVariant = useMemo(() => {
    if (isVariable) return null;
    return (
      product?.defaultVariant ||
      activeVariants.find((v) => v.isDefault) ||
      activeVariants[0] ||
      null
    );
  }, [isVariable, product?.defaultVariant, activeVariants]);

  // Check if all required attribute groups are selected for variable product
  const isSelectionComplete = useMemo(() => {
    if (!isVariable) return true;
    if (attributeGroupNames.length === 0) return true;
    return attributeGroupNames.every((name) => Boolean(selectedAttributes[name]));
  }, [isVariable, attributeGroupNames, selectedAttributes]);

  // Resolve matching active variant
  const resolvedVariant = useMemo(() => {
    if (!isVariable) {
      return canonicalVariant;
    }
    if (!isSelectionComplete) {
      return null;
    }
    return (
      activeVariants.find((v) => {
        const vAttrs = normalizeVariantAttributes(v.attributes);
        return attributeGroupNames.every((name) => {
          const val = vAttrs[name];
          const selVal = selectedAttributes[name];
          return val && selVal && val.toLowerCase() === selVal.toLowerCase();
        });
      }) || null
    );
  }, [isVariable, canonicalVariant, isSelectionComplete, activeVariants, attributeGroupNames, selectedAttributes]);

  // Merge live stock and price data if refreshed
  const selectedVariant = useMemo(() => {
    if (!resolvedVariant) return null;
    const live = liveVariantStock[resolvedVariant._id];
    if (!live) return resolvedVariant;
    return {
      ...resolvedVariant,
      availableQuantity: live.availableQuantity !== undefined ? live.availableQuantity : resolvedVariant.availableQuantity,
      inStock: live.inStock !== undefined ? live.inStock : resolvedVariant.inStock,
      stockStatus: live.stockStatus || resolvedVariant.stockStatus,
      price: live.price !== undefined ? live.price : resolvedVariant.price,
      compareAtPrice: live.compareAtPrice !== undefined ? live.compareAtPrice : resolvedVariant.compareAtPrice,
    };
  }, [resolvedVariant, liveVariantStock]);

  const handleSelectAttribute = useCallback((attrName, attrValue) => {
    setSelectedAttributes((prev) => ({
      ...prev,
      [attrName]: attrValue,
    }));
  }, []);

  const handleStockRefresh = useCallback(async (variantId) => {
    if (!variantId) return;
    try {
      const res = await productService.getVariantAvailability(variantId);
      if (res?.data) {
        setLiveVariantStock((prev) => ({
          ...prev,
          [variantId]: {
            availableQuantity: res.data.availableQuantity,
            inStock: res.data.inStock,
            stockStatus: res.data.stockStatus,
            price: res.data.price,
            compareAtPrice: res.data.compareAtPrice,
          },
        }));
      }
    } catch (err) {
      console.error("Failed to refresh live variant stock:", err);
    }
  }, []);

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

  // Resolve effective category and brand (from props or populated product fields)
  const effectiveCategory = useMemo(() => {
    if (category && typeof category === "object") return category;
    if (product?.categoryId && typeof product.categoryId === "object") return product.categoryId;
    if (product?.category && typeof product.category === "object") return product.category;
    return null;
  }, [category, product]);

  const effectiveBrand = useMemo(() => {
    if (brand && typeof brand === "object") return brand;
    if (product?.brandId && typeof product.brandId === "object") return product.brandId;
    if (product?.brand && typeof product.brand === "object") return product.brand;
    return null;
  }, [brand, product]);

  // Build hierarchical breadcrumbs if parent category exists
  const breadcrumbTrail = useMemo(() => {
    const trail = [
      { label: "Home", href: "/" },
      { label: "Shop", href: "/shop" },
    ];

    if (!effectiveCategory) return trail;

    const parentId = effectiveCategory.parentId?._id || effectiveCategory.parentId?.id || effectiveCategory.parentId;
    if (parentId && Array.isArray(allCategories) && allCategories.length > 0) {
      const parentCat = allCategories.find(
        (c) => String(c._id || c.id) === String(parentId)
      );
      if (parentCat) {
        const parentSlug = getCategorySlug(parentCat);
        if (parentSlug) {
          trail.push({
            label: parentCat.name,
            href: `/category/${encodeURIComponent(parentSlug)}`,
          });
        }
      }
    }

    const currentSlug = getCategorySlug(effectiveCategory);
    if (currentSlug) {
      trail.push({
        label: effectiveCategory.name,
        href: `/category/${encodeURIComponent(currentSlug)}`,
      });
    }

    return trail;
  }, [effectiveCategory, allCategories]);

  const categoryName = effectiveCategory?.name || "";
  const categorySlug = getCategorySlug(effectiveCategory) || "";

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
            selectedVariant={selectedVariant}
            isWishlisted={isWishlisted}
            onWishlistToggle={handleWishlistToggle}
          />
        </div>

        {/* Right Column: Information, Offers, Highlights, Actions, Delivery (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          <ProductInfo
            product={product}
            brand={effectiveBrand}
            category={effectiveCategory}
            selectedVariant={selectedVariant}
            onReviewsClick={scrollToReviews}
          />

          {isVariable && (
            <ProductVariantSelector
              variants={product?.variants || []}
              selectedAttributes={selectedAttributes}
              onSelectAttribute={handleSelectAttribute}
              selectedVariant={selectedVariant}
              isSelectionComplete={isSelectionComplete}
            />
          )}

          <ProductOffers />

          <ProductHighlights specifications={product?.specifications} />

          <ProductActions
            product={product}
            selectedVariant={selectedVariant}
            isSelectionComplete={isSelectionComplete}
            isWishlisted={isWishlisted}
            onWishlistToggle={handleWishlistToggle}
            onStockRefresh={handleStockRefresh}
          />

          <DeliveryWidget product={product} />
        </div>
      </div>

      {/* 4-Tabbed Specifications, Description, Seller & Reviews */}
      <ProductTabs
        product={product}
        brand={effectiveBrand}
        category={effectiveCategory}
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
      <MobileStickyBar
        product={product}
        selectedVariant={selectedVariant}
        isSelectionComplete={isSelectionComplete}
        onStockRefresh={handleStockRefresh}
      />
    </div>
  );
}

export default ProductDetailView;
