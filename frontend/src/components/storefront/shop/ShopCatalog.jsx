"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { X, ChevronLeft, ChevronRight, SlidersHorizontal, RefreshCw, Search, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { productService } from "../../../services/product.service.js";
import { categoryService } from "../../../services/category.service.js";
import { brandService } from "../../../services/brand.service.js";
import { useCart } from "../../../hooks/useCart.js";
import { useWishlist } from "../../../hooks/useWishlist.js";
import { ProductCard } from "../ProductCard.jsx";
import { SortSelect } from "../SortSelect.jsx";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../../ui/Sheet.jsx";
import { Checkbox } from "../../ui/Checkbox.jsx";
import { Button } from "../../ui/Button.jsx";
import { cn } from "../../../utils/cn.js";

const isObjectId = (str) => typeof str === "string" && /^[0-9a-fA-F]{24}$/.test(str);

export function ShopCatalog({
  initialCategoryId = null,
  initialCategoryName = null,
  initialSearchQuery = null,
  pageTitle = "All Products",
  pageDescription = "Explore our collection of high-performance audio, tech & electronics with genuine manufacturer warranty.",
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // URL query state as single source of truth
  const currentSearch = searchParams.get("search") || initialSearchQuery || "";
  const currentSort = searchParams.get("sort") || "newest";
  const currentPage = Math.max(1, Number(searchParams.get("page")) || 1);
  const currentCategory = searchParams.get("category") || initialCategoryId || "";
  const currentBrand = searchParams.get("brand") || "";
  const currentMinPrice = searchParams.get("minPrice") || "";
  const currentMaxPrice = searchParams.get("maxPrice") || "";
  const currentMinRating = searchParams.get("minRating") || "";
  const currentStockStatus = searchParams.get("stockStatus") || "";
  const currentMinDiscount = searchParams.get("minDiscount") || "";

  // Component states
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 16, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Cart & Wishlist hooks
  const { addItem: addCartItem } = useCart();
  const { isInWishlist, addItem: addWishlistItem, removeItem: removeWishlistItem } = useWishlist();

  // Load Categories and Brands once
  useEffect(() => {
    let isMounted = true;
    Promise.allSettled([
      categoryService.getCategories({ limit: 50 }),
      brandService.getBrands({ limit: 50 }),
    ]).then(([catRes, brandRes]) => {
      if (!isMounted) return;
      if (catRes.status === "fulfilled") {
        const catData = catRes.value?.data?.categories || catRes.value?.data || [];
        setCategories(Array.isArray(catData) ? catData : []);
      }
      if (brandRes.status === "fulfilled") {
        const brandData = brandRes.value?.data?.brands || brandRes.value?.data || [];
        setBrands(Array.isArray(brandData) ? brandData : []);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Resolve Category & Brand to valid MongoDB ObjectIds for backend query
  const resolvedCategory = useMemo(() => {
    if (!currentCategory) return null;
    return (
      categories.find(
        (c) =>
          c._id === currentCategory ||
          c.id === currentCategory ||
          c.slug === currentCategory
      ) || null
    );
  }, [currentCategory, categories]);

  const resolvedBrand = useMemo(() => {
    if (!currentBrand) return null;
    return (
      brands.find(
        (b) =>
          b._id === currentBrand ||
          b.id === currentBrand ||
          b.slug === currentBrand
      ) || null
    );
  }, [currentBrand, brands]);

  const backendCategoryId = useMemo(() => {
    if (resolvedCategory) return resolvedCategory._id || resolvedCategory.id;
    if (isObjectId(currentCategory)) return currentCategory;
    return null;
  }, [resolvedCategory, currentCategory]);

  const backendBrandId = useMemo(() => {
    if (resolvedBrand) return resolvedBrand._id || resolvedBrand.id;
    if (isObjectId(currentBrand)) return currentBrand;
    return null;
  }, [resolvedBrand, currentBrand]);

  // Synchronize URL with filter changes
  const updateUrl = useCallback((updates, shouldResetPage = true) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, val]) => {
      if (val === null || val === undefined || val === "") {
        params.delete(key);
      } else {
        params.set(key, String(val));
      }
    });

    if (shouldResetPage && !("page" in updates)) {
      params.set("page", "1");
    }

    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  // Fetch Products based on authoritative backend contract
  useEffect(() => {
    let isCancelled = false;

    const params = {
      page: currentPage,
      limit: 18,
      status: "active",
    };

    if (currentSearch) {
      params.search = currentSearch;
    }

    if (backendCategoryId) {
      params.categoryId = backendCategoryId;
    }

    if (backendBrandId) {
      params.brandId = backendBrandId;
    }
    if (currentMinPrice) params.minPrice = currentMinPrice;
    if (currentMaxPrice) params.maxPrice = currentMaxPrice;
    if (currentMinRating) params.minRating = currentMinRating;
    if (currentStockStatus) params.stockStatus = currentStockStatus;
    if (currentMinDiscount) params.minDiscount = currentMinDiscount;
    if (currentSort) params.sort = currentSort;

    productService
      .getProducts(params)
      .then((res) => {
        if (isCancelled) return;
        const productList = res?.data?.products || (Array.isArray(res?.data) ? res.data : []);
        const meta = res?.meta || {};

        setProducts(productList);
        setPagination({
          page: Number(meta.page) || currentPage,
          limit: Number(meta.limit) || 18,
          total: Number(meta.total) || productList.length,
          totalPages: Number(meta.totalPages) || Math.max(1, Math.ceil((Number(meta.total) || productList.length) / 18)),
        });
        setIsLoading(false);
      })
      .catch(() => {
        if (isCancelled) return;
        setIsError(true);
        setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [currentPage, currentSearch, backendCategoryId, backendBrandId, currentMinPrice, currentMaxPrice, currentMinRating, currentStockStatus, currentMinDiscount, currentSort, retryCount]);

  // Filter change handlers
  const handleCategoryToggle = (catIdentifier) => {
    setIsLoading(true);
    const isCurrentlySelected =
      currentCategory === catIdentifier ||
      (resolvedCategory && (resolvedCategory._id === catIdentifier || resolvedCategory.slug === catIdentifier));

    updateUrl({ category: isCurrentlySelected ? null : catIdentifier });
  };

  const handleBrandToggle = (brandIdentifier) => {
    setIsLoading(true);
    const isCurrentlySelected =
      currentBrand === brandIdentifier ||
      (resolvedBrand && (resolvedBrand._id === brandIdentifier || resolvedBrand.slug === brandIdentifier));

    updateUrl({ brand: isCurrentlySelected ? null : brandIdentifier });
  };

  const handleSortChange = (newSort) => {
    setIsLoading(true);
    updateUrl({ sort: newSort === "newest" ? null : newSort }, false);
  };

  const handleRetry = () => {
    setIsLoading(true);
    setIsError(false);
    setRetryCount((prev) => prev + 1);
  };

  const handleClearAll = () => {
    setIsLoading(true);
    router.push(pathname);
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    setIsLoading(true);
    updateUrl({ page: String(newPage) }, false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Cart & Wishlist actions
  const handleWishlistToggle = async (product, isWishlisted) => {
    const id = product._id || product.id;
    try {
      if (isWishlisted) {
        await addWishlistItem(id);
        toast.success("Added to wishlist", {
          description: `${product.name} saved.`,
        });
      } else {
        await removeWishlistItem(id);
        toast.info("Removed from wishlist", {
          description: `${product.name} removed.`,
        });
      }
    } catch {
      toast.error("Could not update wishlist.");
    }
  };

  const handleAddToCart = async (product) => {
    try {
      const productId = product._id || product.id;
      const productVariantId =
        product.productVariantId ||
        product.defaultVariantId ||
        undefined;
      await addCartItem({
        ...(productVariantId ? { productVariantId } : {}),
        productId,
        quantity: 1,
        itemSnapshot: {
          name: product.name,
          price: product.price,
          image: product.images?.[0]?.url || product.image || null,
          sku: product.sku,
        },
      });
      toast.success("Added to cart", {
        description: `${product.name} added to your cart.`,
      });
    } catch {
      toast.error("Could not add item to cart.");
    }
  };

  const hasActiveFilters = Boolean(
    currentSearch || currentCategory || currentBrand || currentMinPrice || currentMaxPrice ||
    currentMinRating || currentStockStatus || currentMinDiscount ||
    (currentSort && currentSort !== "newest")
  );
  const activeFilterCount =
    [currentSearch, currentCategory, currentBrand, currentMinPrice || currentMaxPrice,
      currentMinRating, currentStockStatus, currentMinDiscount].filter(Boolean).length;

  // Filter content component reused in Desktop Sidebar and Mobile Sheet
  const FilterContent = (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b">
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-foreground">
          Filters
        </h3>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs font-bold text-[#007A55] hover:underline cursor-pointer"
          >
            Clear all ({activeFilterCount})
          </button>
        )}
      </div>

      {/* Categories */}
      {categories.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Categories
            </h4>
            {currentCategory && (
              <button
                type="button"
                onClick={() => updateUrl({ category: null })}
                className="text-[11px] font-semibold text-muted-foreground hover:text-red-600 cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {categories.map((cat) => {
              const identifier = cat.slug || cat._id || cat.id;
              const isChecked =
                currentCategory === cat.slug ||
                currentCategory === cat._id ||
                currentCategory === cat.id ||
                (resolvedCategory &&
                  (resolvedCategory._id === cat._id || resolvedCategory.slug === cat.slug));

              return (
                <div key={cat._id || cat.id} className="flex items-center gap-2.5">
                  <Checkbox
                    id={`filter-cat-${cat._id || cat.id}`}
                    checked={Boolean(isChecked)}
                    onChange={() => handleCategoryToggle(identifier)}
                  />
                  <label
                    htmlFor={`filter-cat-${cat._id || cat.id}`}
                    className={cn(
                      "flex-1 cursor-pointer text-xs font-medium hover:text-[#007A55] transition-colors",
                      isChecked ? "text-[#007A55] font-bold" : "text-slate-700"
                    )}
                  >
                    {cat.name}
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Brands */}
      {brands.length > 0 && (
        <div className="space-y-3 pt-4 border-t">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Brands
            </h4>
            {currentBrand && (
              <button
                type="button"
                onClick={() => updateUrl({ brand: null })}
                className="text-[11px] font-semibold text-muted-foreground hover:text-red-600 cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {brands.map((brand) => {
              const identifier = brand.slug || brand._id || brand.id;
              const isChecked =
                currentBrand === brand.slug ||
                currentBrand === brand._id ||
                currentBrand === brand.id ||
                (resolvedBrand &&
                  (resolvedBrand._id === brand._id || resolvedBrand.slug === brand.slug));

              return (
                <div key={brand._id || brand.id} className="flex items-center gap-2.5">
                  <Checkbox
                    id={`filter-brand-${brand._id || brand.id}`}
                    checked={Boolean(isChecked)}
                    onChange={() => handleBrandToggle(identifier)}
                  />
                  <label
                    htmlFor={`filter-brand-${brand._id || brand.id}`}
                    className={cn(
                      "flex-1 cursor-pointer text-xs font-medium hover:text-[#007A55] transition-colors",
                      isChecked ? "text-[#007A55] font-bold" : "text-slate-700"
                    )}
                  >
                    {brand.name}
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Price */}
      <div className="space-y-3 pt-4 border-t">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Price</h4>
        <div className="grid grid-cols-2 gap-2">
          <input aria-label="Minimum price" inputMode="numeric" placeholder="Min" value={currentMinPrice}
            onChange={(e) => updateUrl({ minPrice: e.target.value })} className="h-8 w-full rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-[#007A55]" />
          <input aria-label="Maximum price" inputMode="numeric" placeholder="Max" value={currentMaxPrice}
            onChange={(e) => updateUrl({ maxPrice: e.target.value })} className="h-8 w-full rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-[#007A55]" />
        </div>
      </div>

      {/* Ratings */}
      <div className="space-y-3 pt-4 border-t">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Customer Ratings</h4>
        {[4, 3, 2].map((rating) => (
          <label key={rating} className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
            <Checkbox checked={currentMinRating === String(rating)} onChange={() => updateUrl({ minRating: currentMinRating === String(rating) ? null : rating })} />
            <span className="text-amber-500">{"★".repeat(rating)}<span className="text-slate-300">{"★".repeat(5-rating)}</span></span>
            <span>& up</span>
          </label>
        ))}
      </div>

      {/* Availability */}
      <div className="space-y-3 pt-4 border-t">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Availability</h4>
        {[
          ["in_stock", "In Stock"],
          ["preorder", "Pre-order"],
          ["out_of_stock", "Out of Stock"],
        ].map(([value, label]) => (
          <label key={value} className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
            <Checkbox checked={currentStockStatus === value} onChange={() => updateUrl({ stockStatus: currentStockStatus === value ? null : value })} />
            {label}
          </label>
        ))}
      </div>

      {/* Discount */}
      <div className="space-y-3 pt-4 border-t">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Discount</h4>
        {[10, 20, 30, 40].map((discount) => (
          <label key={discount} className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
            <Checkbox checked={currentMinDiscount === String(discount)} onChange={() => updateUrl({ minDiscount: currentMinDiscount === String(discount) ? null : discount })} />
            {discount}% or more
          </label>
        ))}
      </div>

      {/* Trust & Guarantee Perks */}
      <div className="rounded-xl bg-slate-50 p-4 border text-xs text-slate-600 space-y-2">
        <p className="font-bold text-slate-900">Why Shop Buybox?</p>
        <p className="text-[11px] leading-relaxed">
          ✓ 100% Genuine Certified Gear<br />
          ✓ 7-Day Hassle-Free Returns<br />
          ✓ Verified Manufacturer Warranty
        </p>
      </div>
    </div>
  );

  const displayTitle = initialCategoryName || resolvedCategory?.name || pageTitle;
  const categoryImage = resolvedCategory?.image?.url || resolvedCategory?.image?.src || null;

  return (
    <div className="mx-auto max-w-[1240px] px-3 py-5 sm:px-5 lg:px-6 lg:py-6">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-[#007A55] transition-colors">
          Home
        </Link>
        <span>/</span>
        {currentCategory && (
          <>
            <Link href="/shop" className="hover:text-[#007A55] transition-colors">
              Shop
            </Link>
            <span>/</span>
          </>
        )}
        <span className="font-semibold text-foreground truncate max-w-xs">{displayTitle}</span>
      </nav>

      {/* Reference-style category hero banner */}
      <section className="relative mb-5 overflow-hidden rounded-[8px] border border-[#0a5f46] bg-[#005b43] px-6 py-7 sm:px-9 sm:py-8">
        <div className="absolute inset-y-0 right-0 w-[42%] overflow-hidden opacity-90">
          {categoryImage ? (
            <img src={categoryImage} alt="" className="h-full w-full object-cover mix-blend-screen opacity-80" />
          ) : (
            <>
              <div className="absolute -right-12 -top-20 h-52 w-52 rounded-full bg-[#08765a]/70" />
              <div className="absolute -right-4 -bottom-24 h-56 w-56 rounded-full border-[28px] border-[#08765a]/60" />
            </>
          )}
        </div>
        <div className="relative max-w-2xl text-white">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200">
            Buybox Collection
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {displayTitle}
          </h1>
          <p className="mt-2 max-w-xl text-xs leading-5 text-emerald-50/85 sm:text-sm">
            {pageDescription}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-emerald-100">
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">Genuine products</span>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">Secure checkout</span>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">Fast delivery</span>
          </div>
        </div>
      </section>

      {/* Filter and Sort Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        {/* Mobile Filter Trigger & Results count */}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMobileFilterOpen(true)}
            className="flex items-center gap-2 rounded-full border-border text-xs font-bold lg:hidden"
          >
            <SlidersHorizontal className="size-3.5 text-[#007A55]" />
            Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
          </Button>

          <p className="text-xs font-medium text-muted-foreground">
            {isLoading
              ? "Searching products..."
              : `Showing ${products.length} of ${pagination.total} products`}
            {currentSearch && (
              <span className="font-bold text-foreground"> for &quot;{currentSearch}&quot;</span>
            )}
          </p>
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-3">
          <SortSelect
            value={currentSort}
            onChange={handleSortChange}
          />
        </div>
      </div>

      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Active:</span>

          {currentSearch && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-800">
              <span>Keyword: <strong>{currentSearch}</strong></span>
              <button
                type="button"
                onClick={() => updateUrl({ search: null })}
                aria-label="Remove search filter"
                className="cursor-pointer hover:text-red-600 transition-colors p-0.5"
              >
                <X className="size-3" />
              </button>
            </span>
          )}

          {currentCategory && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-[#007A55]">
              <span>Category: <strong>{resolvedCategory?.name || currentCategory}</strong></span>
              <button
                type="button"
                onClick={() => updateUrl({ category: null })}
                aria-label="Remove category filter"
                className="cursor-pointer hover:text-red-600 transition-colors p-0.5"
              >
                <X className="size-3" />
              </button>
            </span>
          )}

          {currentBrand && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800">
              <span>Brand: <strong>{resolvedBrand?.name || currentBrand}</strong></span>
              <button
                type="button"
                onClick={() => updateUrl({ brand: null })}
                aria-label="Remove brand filter"
                className="cursor-pointer hover:text-red-600 transition-colors p-0.5"
              >
                <X className="size-3" />
              </button>
            </span>
          )}

          {currentMinPrice && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs">Min ₹{currentMinPrice}</span>}
          {currentMaxPrice && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs">Max ₹{currentMaxPrice}</span>}
          {currentMinRating && <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{currentMinRating}★ & up</span>}
          {currentStockStatus && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs">{currentStockStatus.replace("_"," ")}</span>}
          {currentMinDiscount && <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">{currentMinDiscount}% off or more</span>}
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs font-bold text-red-600 hover:underline cursor-pointer ml-1"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Main Catalog Grid with Desktop Sidebar */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-6">
        {/* Desktop Left Filter Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-28 rounded-[8px] border border-slate-200 bg-white p-3.5 shadow-none">
            {FilterContent}
          </div>
        </aside>

        {/* Product Grid Area */}
        <div className="min-w-0">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-3 sm:gap-4">
              {Array.from({ length: 9 }).map((_, i) => (
                <ProductCard key={`skeleton-${i}`} isLoading />
              ))}
            </div>
          ) : isError ? (
            <div className="rounded-2xl border border-red-100 bg-red-50/50 p-8 text-center my-6">
              <p className="text-sm font-bold text-red-700">Failed to load catalog products</p>
              <p className="text-xs text-red-600 mt-1">Please check your network and try again.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="mt-4 rounded-full font-bold gap-1.5"
              >
                <RefreshCw className="size-3.5" />
                Retry
              </Button>
            </div>
          ) : products.length === 0 ? (
            <div className="my-12 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 sm:p-12 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mb-4">
                <Search className="size-6 stroke-[2]" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No matching products found</h3>
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
                {currentSearch
                  ? `We couldn't find any products matching "${currentSearch}". Try checking your spelling or adjusting your filters.`
                  : "No products match the selected filters. Try broadening your criteria."}
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {hasActiveFilters && (
                  <Button
                    type="button"
                    onClick={handleClearAll}
                    variant="outline"
                    size="sm"
                    className="rounded-full font-bold text-xs"
                  >
                    Clear All Filters
                  </Button>
                )}
                <Link
                  href="/shop"
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#007A55] px-4 py-2 text-xs font-bold text-white hover:bg-[#006346] transition-colors shadow-xs"
                >
                  <span>Browse All Products</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
                {products.map((product) => {
                  const id = product.id || product._id;
                  const isWishlisted = isInWishlist(id);

                  return (
                    <ProductCard
                      key={id}
                      product={product}
                      isWishlisted={isWishlisted}
                      onWishlistToggle={(val) => handleWishlistToggle(product, val)}
                      onAddToCart={() => handleAddToCart(product)}
                    />
                  );
                })}
              </div>

              {/* Pagination Bar */}
              {pagination.totalPages > 1 && (
                <div className="mt-12 flex items-center justify-center gap-2 border-t pt-6">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => handlePageChange(pagination.page - 1)}
                    className="rounded-full size-9 p-0 cursor-pointer disabled:cursor-not-allowed"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="size-4" />
                  </Button>

                  {Array.from({ length: pagination.totalPages }).map((_, index) => {
                    const pageNumber = index + 1;
                    const isCurrent = pageNumber === pagination.page;

                    return (
                      <button
                        key={pageNumber}
                        type="button"
                        onClick={() => handlePageChange(pageNumber)}
                        aria-current={isCurrent ? "page" : undefined}
                        className={`size-9 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                          isCurrent
                            ? "bg-[#007A55] text-white shadow-xs"
                            : "bg-white text-slate-700 border hover:border-[#007A55] hover:text-[#007A55]"
                        }`}
                      >
                        {pageNumber}
                      </button>
                    );
                  })}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => handlePageChange(pagination.page + 1)}
                    className="rounded-full size-9 p-0 cursor-pointer disabled:cursor-not-allowed"
                    aria-label="Next page"
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile Slide-out Filter Sheet */}
      <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
        <SheetContent side="left" className="w-[310px] p-5 overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>Filter Products</SheetTitle>
          </SheetHeader>
          {FilterContent}
          <div className="mt-6 pt-4 border-t">
            <Button
              className="w-full rounded-full bg-[#007A55] text-white font-bold text-xs py-2.5 hover:bg-[#006346] cursor-pointer"
              onClick={() => setMobileFilterOpen(false)}
            >
              Apply Filters
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default ShopCatalog;
