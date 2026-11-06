"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, Layers, LayoutGrid, Award, CheckCircle2 } from "lucide-react";
import { SectionContainer } from "./SectionContainer.jsx";
import { ProductCarousel } from "../ProductCarousel.jsx";
import { ProductCard } from "../ProductCard.jsx";
import { cn } from "../../../utils/cn.js";

export function CustomStorefrontSection({
  section,
  wishlistVariantIds = [],
  onWishlistToggle,
  onAddToCart,
}) {
  if (!section || section.isActive === false) return null;

  const {
    title = "Special Collection",
    subtitle,
    type,
    productIds = [],
    groups = [],
    bannerData,
    theme,
    viewMoreEnabled = true,
    viewMoreUrl,
    viewMoreTitle = "View All",
    key: sectionKey,
  } = section;

  // Active group tab state for multi-group category and brand showcases
  const [activeGroupId, setActiveGroupId] = useState(
    groups && groups.length > 0 ? (groups[0].id || groups[0]._id) : null
  );

  const defaultViewMoreHref =
    viewMoreEnabled !== false
      ? viewMoreUrl || `/sections/${sectionKey || section._id || section.id}`
      : null;

  // 1. Custom Product Carousel
  if (type === "carousel") {
    if (!productIds || productIds.length === 0) return null;
    return (
      <SectionContainer
        title={title}
        subtitle={subtitle}
        badge="FEATURED"
        badgeColor="bg-emerald-600 text-white"
        icon={Sparkles}
        iconBg="bg-emerald-50 text-[#007A55]"
        variant="plain"
        theme={theme}
        viewAllHref={defaultViewMoreHref}
        viewAllText={viewMoreTitle}
      >
        <ProductCarousel
          products={productIds}
          wishlistVariantIds={wishlistVariantIds}
          onWishlistToggle={onWishlistToggle}
          onAddToCart={onAddToCart}
        />
      </SectionContainer>
    );
  }

  // 2. Custom Product Grid or Mixed Collection
  if (type === "grid" || type === "mixed_collection" || type === "collection") {
    if (!productIds || productIds.length === 0) return null;
    return (
      <SectionContainer
        title={title}
        subtitle={subtitle}
        badge={type === "mixed_collection" ? "CURATED" : "COLLECTION"}
        badgeColor="bg-blue-600 text-white"
        icon={LayoutGrid}
        iconBg="bg-blue-50 text-blue-600"
        variant="plain"
        theme={theme}
        viewAllHref={defaultViewMoreHref}
        viewAllText={viewMoreTitle}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {productIds.map((product) => {
            const id = product._id || product.id;
            const isWishlisted = wishlistVariantIds.includes(id);
            return (
              <ProductCard
                key={id}
                product={product}
                isWishlisted={isWishlisted}
                onWishlistToggle={onWishlistToggle}
                onAddToCart={onAddToCart}
              />
            );
          })}
        </div>
      </SectionContainer>
    );
  }

  // 3. Category Showcase (Multi-Group Tabbed or Icon Grid)
  if (type === "category_showcase") {
    // A. Multi-group category showcase with interactive Flipkart-style tabs
    if (groups && groups.length > 0) {
      const activeGroup =
        groups.find((g) => (g.id || g._id) === activeGroupId) || groups[0];
      const activeProducts = activeGroup?.resolvedProducts || activeGroup?.productIds || [];
      const groupViewMoreHref =
        activeGroup?.viewMoreUrl ||
        (activeGroup?.categoryId
          ? `/shop?category=${activeGroup.categoryId}`
          : `${defaultViewMoreHref}?groupId=${activeGroup?.id || activeGroup?._id}`);

      return (
        <SectionContainer
          title={title}
          subtitle={subtitle}
          badge="CATEGORIES"
          badgeColor="bg-indigo-600 text-white"
          icon={Layers}
          iconBg="bg-indigo-50 text-indigo-600"
          variant="plain"
          theme={activeGroup?.theme || theme}
          viewAllHref={viewMoreEnabled !== false ? groupViewMoreHref : null}
          viewAllText={viewMoreTitle}
        >
          {/* Flipkart-inspired Tabbed Pill Category Selector */}
          <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none">
            {groups.map((group) => {
              const gId = group.id || group._id;
              const isSelected = gId === (activeGroup.id || activeGroup._id);
              const count = group.resolvedProducts?.length || group.limit || 0;

              return (
                <button
                  key={gId}
                  type="button"
                  onClick={() => setActiveGroupId(gId)}
                  className={cn(
                    "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer",
                    isSelected
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200/80"
                  )}
                  style={
                    isSelected && (theme?.buttonBgColor || activeGroup?.theme?.buttonBgColor)
                      ? {
                          backgroundColor:
                            activeGroup?.theme?.buttonBgColor || theme?.buttonBgColor,
                          color:
                            activeGroup?.theme?.buttonTextColor || theme?.buttonTextColor || "#FFF",
                        }
                      : {}
                  }
                >
                  <span>{group.title}</span>
                  {count > 0 && (
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded-md text-[10px] font-extrabold",
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-slate-200 text-slate-600"
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Category Group Heading & Subtitle if present */}
          {activeGroup.subtitle && (
            <p className="text-xs text-slate-500 mb-3 font-medium">
              {activeGroup.subtitle}
            </p>
          )}

          {/* Products for Selected Category Group */}
          {activeProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {activeProducts.map((product) => {
                const id = product._id || product.id;
                const isWishlisted = wishlistVariantIds.includes(id);
                return (
                  <ProductCard
                    key={id}
                    product={product}
                    isWishlisted={isWishlisted}
                    onWishlistToggle={onWishlistToggle}
                    onAddToCart={onAddToCart}
                  />
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-100">
              No products found in this category showcase.
            </div>
          )}
        </SectionContainer>
      );
    }

    // B. Legacy category icon grid
    const categories = section.categoryIds || [];
    if (!categories.length && (!productIds || productIds.length === 0)) return null;

    if (categories.length > 0) {
      return (
        <SectionContainer
          title={title}
          subtitle={subtitle}
          badge="EXPLORE"
          badgeColor="bg-indigo-600 text-white"
          icon={Layers}
          iconBg="bg-indigo-50 text-indigo-600"
          variant="plain"
          theme={theme}
          viewAllHref={defaultViewMoreHref}
          viewAllText={viewMoreTitle}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {categories.map((cat) => {
              const catId = cat._id || cat.id || cat;
              const name = cat.name || "Category";
              const slug = cat.slug || catId;
              return (
                <Link
                  key={catId}
                  href={`/shop?category=${slug}`}
                  className="group flex flex-col items-center justify-center p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:border-[#007A55] hover:shadow-xs transition-all duration-200 text-center"
                >
                  <div className="size-12 rounded-xl bg-emerald-50 text-[#007A55] flex items-center justify-center font-black text-base group-hover:scale-105 transition-transform">
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <span className="mt-2.5 text-xs font-bold text-slate-800 group-hover:text-[#007A55] line-clamp-1">
                    {name}
                  </span>
                </Link>
              );
            })}
          </div>
        </SectionContainer>
      );
    }
  }

  // 4. Dedicated Brand Showcase
  if (type === "brand_showcase") {
    // A. Multi-group brand showcase with tabs or brand cards
    if (groups && groups.length > 0) {
      const activeBrandGroup =
        groups.find((g) => (g.id || g._id) === activeGroupId) || groups[0];
      const brandProducts =
        activeBrandGroup?.resolvedProducts || activeBrandGroup?.productIds || [];
      const brandViewMoreHref =
        activeBrandGroup?.viewMoreUrl ||
        (activeBrandGroup?.brandId
          ? `/brand/${activeBrandGroup.brandId}`
          : `${defaultViewMoreHref}?groupId=${activeBrandGroup?.id || activeBrandGroup?._id}`);

      return (
        <SectionContainer
          title={title}
          subtitle={subtitle}
          badge="TOP BRANDS"
          badgeColor="bg-sky-600 text-white"
          icon={Award}
          iconBg="bg-sky-50 text-sky-600"
          variant="plain"
          theme={activeBrandGroup?.theme || theme}
          viewAllHref={viewMoreEnabled !== false ? brandViewMoreHref : null}
          viewAllText={viewMoreTitle}
        >
          {/* Brand Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none">
            {groups.map((group) => {
              const gId = group.id || group._id;
              const isSelected = gId === (activeBrandGroup.id || activeBrandGroup._id);

              return (
                <button
                  key={gId}
                  type="button"
                  onClick={() => setActiveGroupId(gId)}
                  className={cn(
                    "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer",
                    isSelected
                      ? "bg-sky-950 text-white shadow-xs"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200/80"
                  )}
                  style={
                    isSelected && (theme?.buttonBgColor || activeBrandGroup?.theme?.buttonBgColor)
                      ? {
                          backgroundColor:
                            activeBrandGroup?.theme?.buttonBgColor || theme?.buttonBgColor,
                          color:
                            activeBrandGroup?.theme?.buttonTextColor ||
                            theme?.buttonTextColor ||
                            "#FFF",
                        }
                      : {}
                  }
                >
                  {group.logoUrl ? (
                    <img
                      src={group.logoUrl}
                      alt={group.title}
                      className="size-4 object-contain rounded"
                    />
                  ) : (
                    <Award className="size-3.5" />
                  )}
                  <span>{group.title}</span>
                </button>
              );
            })}
          </div>

          {/* Brand Heading & Subtitle */}
          <div className="flex items-center justify-between gap-4 mb-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                {activeBrandGroup.title}
              </h3>
              {activeBrandGroup.subtitle && (
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {activeBrandGroup.subtitle}
                </p>
              )}
            </div>
            {brandViewMoreHref && (
              <Link
                href={brandViewMoreHref}
                className="text-xs font-bold text-sky-600 hover:text-sky-700 inline-flex items-center gap-1 shrink-0"
              >
                <span>Visit Brand Store</span>
                <ArrowRight className="size-3" />
              </Link>
            )}
          </div>

          {/* Brand Products */}
          {brandProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {brandProducts.map((product) => {
                const id = product._id || product.id;
                const isWishlisted = wishlistVariantIds.includes(id);
                return (
                  <ProductCard
                    key={id}
                    product={product}
                    isWishlisted={isWishlisted}
                    onWishlistToggle={onWishlistToggle}
                    onAddToCart={onAddToCart}
                  />
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-100">
              No products found for this brand showcase.
            </div>
          )}
        </SectionContainer>
      );
    }

    // Single brand showcase
    if (productIds && productIds.length > 0) {
      return (
        <SectionContainer
          title={title}
          subtitle={subtitle}
          badge="TOP BRANDS"
          badgeColor="bg-sky-600 text-white"
          icon={Award}
          iconBg="bg-sky-50 text-sky-600"
          variant="plain"
          theme={theme}
          viewAllHref={defaultViewMoreHref}
          viewAllText={viewMoreTitle}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {productIds.map((product) => {
              const id = product._id || product.id;
              const isWishlisted = wishlistVariantIds.includes(id);
              return (
                <ProductCard
                  key={id}
                  product={product}
                  isWishlisted={isWishlisted}
                  onWishlistToggle={onWishlistToggle}
                  onAddToCart={onAddToCart}
                />
              );
            })}
          </div>
        </SectionContainer>
      );
    }
  }

  // 5. Promotional Banner
  if (type === "promotional_banner") {
    const { imageUrl, linkUrl, headline, altText, ctaText = "Shop Now" } =
      bannerData || {};

    const containerStyle = {};
    if (theme?.backgroundColor) containerStyle.backgroundColor = theme.backgroundColor;
    if (theme?.borderColor) containerStyle.borderColor = theme.borderColor;

    return (
      <section className="py-4 sm:py-6" aria-label={title}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div
            style={containerStyle}
            className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-linear-to-r from-emerald-900 via-emerald-800 to-slate-900 p-6 sm:p-10 text-white shadow-xs"
          >
            <div className="relative z-10 max-w-xl space-y-3">
              {title && (
                <span className="inline-block rounded-md bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold tracking-wide uppercase text-emerald-300">
                  {title}
                </span>
              )}
              {headline && (
                <h3 className="text-xl sm:text-3xl font-black tracking-tight text-white">
                  {headline}
                </h3>
              )}
              {subtitle && (
                <p className="text-xs sm:text-sm text-slate-200 font-medium">
                  {subtitle}
                </p>
              )}
              {linkUrl && (
                <div className="pt-2">
                  <Link
                    href={linkUrl}
                    style={{
                      backgroundColor: theme?.buttonBgColor || "#007A55",
                      color: theme?.buttonTextColor || "#FFFFFF",
                    }}
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold shadow-xs hover:opacity-90 transition-opacity"
                  >
                    <span>{ctaText}</span>
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              )}
            </div>

            {imageUrl && (
              <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-25 sm:opacity-40 pointer-events-none overflow-hidden">
                <img
                  src={imageUrl}
                  alt={altText || headline || title}
                  className="h-full w-full object-cover object-right"
                />
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  return null;
}

export default CustomStorefrontSection;
