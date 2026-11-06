"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  SlidersHorizontal,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Tag,
  Package,
  Layers,
  Sparkles,
  ArrowUpDown,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { storefrontService } from "../../../services/storefront.service.js";
import { useCart } from "../../../hooks/useCart.js";
import { useWishlist } from "../../../hooks/useWishlist.js";
import { ProductCard } from "../ProductCard.jsx";
import { Breadcrumbs } from "../Breadcrumbs.jsx";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../../ui/Sheet.jsx";
import { Checkbox } from "../../ui/Checkbox.jsx";
import { Button } from "../../ui/Button.jsx";
import { Skeleton } from "../../ui/Skeleton.jsx";
import { cn } from "../../../utils/cn.js";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest Arrivals" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "rating_desc", label: "Customer Rating" },
  { value: "discount_desc", label: "Discount %" },
];

export function SectionDiscoveryView({
  sectionKey,
  initialData = null,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Search params as single source of truth
  const currentGroupId = searchParams.get("groupId") || "";
  const currentCategory = searchParams.get("category") || "";
  const currentBrand = searchParams.get("brand") || "";
  const currentMinPrice = searchParams.get("minPrice") || "";
  const currentMaxPrice = searchParams.get("maxPrice") || "";
  const currentInStock = searchParams.get("inStockOnly") === "true";
  const currentSort = searchParams.get("sortBy") || "newest";
  const currentPage = Math.max(1, Number(searchParams.get("page")) || 1);

  // Local state
  const [sectionData, setSectionData] = useState(initialData?.meta?.section || null);
  const [products, setProducts] = useState(initialData?.data || []);
  const [pagination, setPagination] = useState(
    initialData?.meta?.pagination || {
      page: 1,
      limit: 16,
      total: 0,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    }
  );
  const [availableFilters, setAvailableFilters] = useState(
    initialData?.meta?.availableFilters || { categories: [], brands: [] }
  );
  const [isLoading, setIsLoading] = useState(!initialData);
  const [isError, setIsError] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Price input draft state for debounce / apply
  const [priceDraft, setPriceDraft] = useState({
    min: currentMinPrice,
    max: currentMaxPrice,
  });

  // Cart & Wishlist hooks
  const { addItem: addCartItem, isAdding: isAddingToCart } = useCart();
  const { isInWishlist, addItem: addWishlistItem, removeItem: removeWishlistItem } = useWishlist();

  // Update query params helper
  const updateQueryParams = useCallback(
    (newParams) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(newParams).forEach(([k, v]) => {
        if (v === null || v === undefined || v === "" || v === false) {
          params.delete(k);
        } else {
          params.set(k, String(v));
        }
      });
      // Reset page to 1 when filters change (unless updating page itself)
      if (!("page" in newParams)) {
        params.delete("page");
      }
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  // Fetch section products on filter/param changes
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setIsError(false);

    const query = {
      page: currentPage,
      sortBy: currentSort,
    };
    if (currentGroupId) query.groupId = currentGroupId;
    if (currentCategory) query.category = currentCategory;
    if (currentBrand) query.brand = currentBrand;
    if (currentMinPrice) query.minPrice = currentMinPrice;
    if (currentMaxPrice) query.maxPrice = currentMaxPrice;
    if (currentInStock) query.inStockOnly = true;

    storefrontService
      .getSectionProducts(sectionKey, query)
      .then((res) => {
        if (isCancelled) return;
        const data = res?.data || [];
        const meta = res?.meta || {};
        setProducts(data);
        if (meta.section) setSectionData(meta.section);
        if (meta.pagination) setPagination(meta.pagination);
        if (meta.availableFilters) setAvailableFilters(meta.availableFilters);
      })
      .catch((err) => {
        if (isCancelled) return;
        console.error("Failed to fetch section products:", err);
        setIsError(true);
        toast.error("Failed to load showcase products. Please try again.");
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [
    sectionKey,
    currentGroupId,
    currentCategory,
    currentBrand,
    currentMinPrice,
    currentMaxPrice,
    currentInStock,
    currentSort,
    currentPage,
  ]);

  // Sync draft price state if URL changed externally
  useEffect(() => {
    setPriceDraft({ min: currentMinPrice, max: currentMaxPrice });
  }, [currentMinPrice, currentMaxPrice]);

  // Handlers
  const handleGroupSelect = (groupId) => {
    if (groupId === currentGroupId) {
      updateQueryParams({ groupId: null, category: null, brand: null });
    } else {
      updateQueryParams({ groupId, category: null, brand: null });
    }
  };

  const handleCategoryToggle = (catId) => {
    if (currentCategory === catId) {
      updateQueryParams({ category: null });
    } else {
      updateQueryParams({ category: catId });
    }
  };

  const handleBrandToggle = (bId) => {
    if (currentBrand === bId) {
      updateQueryParams({ brand: null });
    } else {
      updateQueryParams({ brand: bId });
    }
  };

  const handleApplyPrice = (e) => {
    e?.preventDefault();
    updateQueryParams({
      minPrice: priceDraft.min || null,
      maxPrice: priceDraft.max || null,
    });
  };

  const handleClearFilters = () => {
    setPriceDraft({ min: "", max: "" });
    const params = new URLSearchParams();
    if (currentGroupId) params.set("groupId", currentGroupId);
    router.push(`${pathname}?${params.toString()}`);
  };

  // Section theme overrides
  const theme = sectionData?.theme || {};
  const bgColor = theme.backgroundColor || "#FFFFFF";
  const textColor = theme.textColor || "#0F172A";
  const badgeColor = theme.badgeColor || "#007A55";
  const badgeTextColor = theme.badgeTextColor || "#FFFFFF";

  const groups = sectionData?.groups || [];
  const hasActiveFilters = Boolean(
    currentCategory || currentBrand || currentMinPrice || currentMaxPrice || currentInStock
  );

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      {/* Breadcrumbs */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-4 pb-2">
        <Breadcrumbs
          items={[
            { label: "Sections", href: "/#storefront-sections" },
            { label: sectionData?.title || "Product Showcase" },
          ]}
        />
      </div>

      {/* Hero Header */}
      <div
        className="border-y border-slate-200/80 shadow-xs transition-colors"
        style={{ backgroundColor: bgColor, color: textColor }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider"
                style={{ backgroundColor: badgeColor, color: badgeTextColor }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{sectionData?.type?.replace(/_/g, " ") || "Merchandised Showcase"}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
                {sectionData?.title || "Curated Showcase"}
              </h1>
              {sectionData?.subtitle && (
                <p className="text-sm sm:text-base opacity-80 leading-relaxed">
                  {sectionData.subtitle}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right text-xs opacity-75">
                <span className="font-semibold text-sm">{pagination.total}</span> products available
              </div>
            </div>
          </div>

          {/* Multi-Group Tabs Navigation (Flipkart style) */}
          {groups.length > 0 && (
            <div className="mt-6 pt-4 border-t border-slate-200/40 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => handleGroupSelect("")}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 cursor-pointer shadow-xs",
                  !currentGroupId
                    ? "bg-slate-900 text-white ring-2 ring-slate-900/10 shadow-sm"
                    : "bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200/80"
                )}
              >
                All Showcase Items
              </button>
              {groups.map((grp) => {
                const isSelected = currentGroupId === (grp.id || grp._id);
                return (
                  <button
                    key={grp.id || grp._id}
                    type="button"
                    onClick={() => handleGroupSelect(grp.id || grp._id)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 cursor-pointer shadow-xs flex items-center gap-2",
                      isSelected
                        ? "bg-slate-900 text-white ring-2 ring-slate-900/10 shadow-sm"
                        : "bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200/80"
                    )}
                  >
                    <span>{grp.title}</span>
                    {grp.subtitle && (
                      <span className="text-[10px] opacity-70 font-normal hidden sm:inline">
                        ({grp.subtitle})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main Catalog Area */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        {/* Top Control Bar: Active filters & Sorting */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-200/80">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMobileFilterOpen(true)}
              className="lg:hidden flex items-center gap-1.5 text-xs font-semibold rounded-xl border-slate-300"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block ml-0.5" />
              )}
            </Button>

            {/* Active filter badges */}
            {hasActiveFilters && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {currentCategory && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-xs font-medium">
                    Category: {availableFilters.categories.find((c) => c._id === currentCategory || c.slug === currentCategory)?.name || currentCategory}
                    <button
                      type="button"
                      onClick={() => handleCategoryToggle(currentCategory)}
                      className="hover:text-emerald-950 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {currentBrand && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-xs font-medium">
                    Brand: {availableFilters.brands.find((b) => b._id === currentBrand || b.slug === currentBrand)?.name || currentBrand}
                    <button
                      type="button"
                      onClick={() => handleBrandToggle(currentBrand)}
                      className="hover:text-emerald-950 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {(currentMinPrice || currentMaxPrice) && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-200 text-xs font-medium">
                    ₹{currentMinPrice || "0"} - ₹{currentMaxPrice || "Any"}
                    <button
                      type="button"
                      onClick={() => updateQueryParams({ minPrice: null, maxPrice: null })}
                      className="hover:text-slate-950 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {currentInStock && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-200 text-xs font-medium">
                    In Stock Only
                    <button
                      type="button"
                      onClick={() => updateQueryParams({ inStockOnly: null })}
                      className="hover:text-slate-950 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2"
                >
                  Clear All
                </Button>
              </div>
            )}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-slate-500 font-medium hidden sm:inline">Sort by:</span>
            <select
              value={currentSort}
              onChange={(e) => updateQueryParams({ sortBy: e.target.value })}
              className="text-xs sm:text-sm font-semibold bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 shadow-xs cursor-pointer"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content Layout: Filters Sidebar + Grid */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Desktop Filter Sidebar */}
          <aside className="hidden lg:block lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <Filter className="w-4 h-4 text-emerald-600" />
                  <span>Showcase Filters</span>
                </h2>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="text-xs font-medium text-emerald-600 hover:underline cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* In-Stock Toggle */}
              <div className="flex items-center justify-between">
                <label htmlFor="inStockToggle" className="text-xs font-medium text-slate-700 cursor-pointer">
                  In Stock Items Only
                </label>
                <input
                  id="inStockToggle"
                  type="checkbox"
                  checked={currentInStock}
                  onChange={(e) => updateQueryParams({ inStockOnly: e.target.checked || null })}
                  className="rounded-md border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer h-4 w-4"
                />
              </div>

              {/* Price Range Filter */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800 block">
                  Price Range (₹)
                </span>
                <form onSubmit={handleApplyPrice} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      value={priceDraft.min}
                      onChange={(e) => setPriceDraft((prev) => ({ ...prev, min: e.target.value }))}
                      className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="text-slate-400 text-xs">-</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={priceDraft.max}
                      onChange={(e) => setPriceDraft((prev) => ({ ...prev, max: e.target.value }))}
                      className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-7 rounded-lg font-medium border-slate-300 hover:bg-slate-100"
                  >
                    Apply Price
                  </Button>
                </form>
              </div>

              {/* Scoped Categories */}
              {availableFilters.categories?.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 block">
                    Categories
                  </span>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {availableFilters.categories.map((cat) => {
                      const isChecked = currentCategory === cat._id || currentCategory === cat.slug;
                      return (
                        <div key={cat._id} className="flex items-center gap-2 py-0.5">
                          <Checkbox
                            id={`cat-filter-${cat._id}`}
                            checked={isChecked}
                            onChange={() => handleCategoryToggle(cat._id)}
                          />
                          <label
                            htmlFor={`cat-filter-${cat._id}`}
                            className="text-xs text-slate-700 hover:text-slate-900 cursor-pointer select-none flex-1 truncate"
                          >
                            {cat.name}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Scoped Brands */}
              {availableFilters.brands?.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 block">
                    Brands
                  </span>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {availableFilters.brands.map((brand) => {
                      const isChecked = currentBrand === brand._id || currentBrand === brand.slug;
                      return (
                        <div key={brand._id} className="flex items-center gap-2 py-0.5">
                          <Checkbox
                            id={`brand-filter-${brand._id}`}
                            checked={isChecked}
                            onChange={() => handleBrandToggle(brand._id)}
                          />
                          <label
                            htmlFor={`brand-filter-${brand._id}`}
                            className="text-xs text-slate-700 hover:text-slate-900 cursor-pointer select-none flex-1 truncate"
                          >
                            {brand.name}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* Product Grid Area */}
          <main className="lg:col-span-3 space-y-8">
            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-3.5 space-y-3">
                    <Skeleton className="aspect-square w-full rounded-xl" />
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-5 w-1/2" />
                  </div>
                ))}
              </div>
            ) : isError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-8 text-center space-y-3">
                <p className="text-sm font-semibold text-rose-800">
                  Unable to load products for this showcase.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateQueryParams({ page: currentPage })}
                  className="rounded-xl border-rose-300 text-rose-700 hover:bg-rose-100"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Retry
                </Button>
              </div>
            ) : products.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-4 shadow-xs">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <Package className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900">
                    No matching products found
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                    Try adjusting your filters, price range, or category group to discover more items in this showcase.
                  </p>
                </div>
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearFilters}
                    className="rounded-xl border-slate-300 text-xs font-semibold"
                  >
                    Reset All Filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {products.map((product) => (
                  <ProductCard
                    key={product._id || product.id}
                    product={product}
                    isWishlisted={isInWishlist(product._id || product.id)}
                    isAddingToCart={isAddingToCart}
                    onAddToCart={() => addCartItem(product)}
                    onWishlistToggle={() => {
                      const pId = product._id || product.id;
                      if (isInWishlist(pId)) {
                        removeWishlistItem(pId);
                      } else {
                        addWishlistItem(product);
                      }
                    }}
                  />
                ))}
              </div>
            )}

            {/* Pagination Controls */}
            {!isLoading && pagination.totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-200/80">
                <div className="text-xs text-slate-500">
                  Showing page <span className="font-semibold text-slate-900">{pagination.page}</span> of{" "}
                  <span className="font-semibold text-slate-900">{pagination.totalPages}</span> ({pagination.total} total products)
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!pagination.hasPrevPage}
                    onClick={() => updateQueryParams({ page: pagination.page - 1 })}
                    className="h-8 px-2.5 rounded-xl border-slate-300 text-xs font-semibold"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                    Previous
                  </Button>

                  {/* Page numbers preview */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      let pageNum = i + 1;
                      if (pagination.totalPages > 5 && pagination.page > 3) {
                        pageNum = pagination.page - 2 + i;
                        if (pageNum > pagination.totalPages) {
                          pageNum = pagination.totalPages - (4 - i);
                        }
                      }
                      const isActive = pageNum === pagination.page;
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => updateQueryParams({ page: pageNum })}
                          className={cn(
                            "w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer",
                            isActive
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-200"
                          )}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!pagination.hasNextPage}
                    onClick={() => updateQueryParams({ page: pagination.page + 1 })}
                    className="h-8 px-2.5 rounded-xl border-slate-300 text-xs font-semibold"
                  >
                    Next
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Mobile Filters Sheet */}
      <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
        <SheetContent side="left" className="w-[85vw] max-w-sm p-6 overflow-y-auto">
          <SheetHeader className="pb-4 border-b border-slate-100">
            <SheetTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Filter className="w-4 h-4 text-emerald-600" />
              <span>Showcase Filters</span>
            </SheetTitle>
          </SheetHeader>

          <div className="mt-5 space-y-6">
            {/* In-Stock Toggle */}
            <div className="flex items-center justify-between">
              <label htmlFor="mobileInStock" className="text-sm font-medium text-slate-700">
                In Stock Items Only
              </label>
              <input
                id="mobileInStock"
                type="checkbox"
                checked={currentInStock}
                onChange={(e) => updateQueryParams({ inStockOnly: e.target.checked || null })}
                className="rounded-md border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
              />
            </div>

            {/* Price Range */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 block">
                Price Range (₹)
              </span>
              <form onSubmit={(e) => { handleApplyPrice(e); setMobileFilterOpen(false); }} className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={priceDraft.min}
                    onChange={(e) => setPriceDraft((prev) => ({ ...prev, min: e.target.value }))}
                    className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                  <span className="text-slate-400 text-xs">-</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={priceDraft.max}
                    onChange={(e) => setPriceDraft((prev) => ({ ...prev, max: e.target.value }))}
                    className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <Button type="submit" size="sm" className="w-full text-xs h-8 rounded-lg bg-emerald-600 text-white font-medium">
                  Apply Price
                </Button>
              </form>
            </div>

            {/* Scoped Categories */}
            {availableFilters.categories?.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800 block">
                  Categories
                </span>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {availableFilters.categories.map((cat) => {
                    const isChecked = currentCategory === cat._id || currentCategory === cat.slug;
                    return (
                      <div key={cat._id} className="flex items-center gap-2">
                        <Checkbox
                          id={`mob-cat-${cat._id}`}
                          checked={isChecked}
                          onChange={() => handleCategoryToggle(cat._id)}
                        />
                        <label
                          htmlFor={`mob-cat-${cat._id}`}
                          className="text-xs text-slate-700 cursor-pointer flex-1"
                        >
                          {cat.name}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Scoped Brands */}
            {availableFilters.brands?.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800 block">
                  Brands
                </span>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {availableFilters.brands.map((brand) => {
                    const isChecked = currentBrand === brand._id || currentBrand === brand.slug;
                    return (
                      <div key={brand._id} className="flex items-center gap-2">
                        <Checkbox
                          id={`mob-brand-${brand._id}`}
                          checked={isChecked}
                          onChange={() => handleBrandToggle(brand._id)}
                        />
                        <label
                          htmlFor={`mob-brand-${brand._id}`}
                          className="text-xs text-slate-700 cursor-pointer flex-1"
                        >
                          {brand.name}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Reset / Done Buttons */}
            <div className="pt-6 border-t border-slate-100 flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { handleClearFilters(); setMobileFilterOpen(false); }}
                className="flex-1 text-xs rounded-xl"
              >
                Reset All
              </Button>
              <Button
                size="sm"
                onClick={() => setMobileFilterOpen(false)}
                className="flex-1 text-xs rounded-xl bg-slate-900 text-white"
              >
                Done
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default SectionDiscoveryView;
