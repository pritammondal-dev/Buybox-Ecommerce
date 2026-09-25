"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { CategoryHeroBanner } from "./CategoryHeroBanner.jsx";
import { CategoryFilterSidebar } from "./CategoryFilterSidebar.jsx";
import { CategoryToolbar } from "./CategoryToolbar.jsx";
import { CategoryProductGrid } from "./CategoryProductGrid.jsx";
import { CategoryPagination } from "./CategoryPagination.jsx";
import { MobileFilterDrawer } from "./MobileFilterDrawer.jsx";

import { productService } from "../../../services/product.service.js";
import { useCart } from "../../../hooks/useCart.js";
import { useWishlist } from "../../../hooks/useWishlist.js";

const PAGE_LIMIT = 12;

export function CategoryListingView({
  category,
  allCategories = [],
  allBrands = [],
  initialProducts = [],
  initialMeta = null,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // URL Query Parameters
  const pageParam = Number(searchParams.get("page")) || 1;
  const sortParam = searchParams.get("sort") || "featured";
  const brandParam = searchParams.get("brand") || "";
  const minPriceParam = searchParams.get("minPrice") || "";
  const maxPriceParam = searchParams.get("maxPrice") || "";
  const ratingParam = searchParams.get("rating")
    ? Number(searchParams.get("rating"))
    : null;
  const stockParam = searchParams.get("stockStatus") || null;
  const discountParam = searchParams.get("discount")
    ? Number(searchParams.get("discount"))
    : null;

  const selectedBrandIds = useMemo(() => {
    return brandParam ? brandParam.split(",").filter(Boolean) : [];
  }, [brandParam]);

  // Brand Name Mapping for toolbar chips
  const brandNamesMap = useMemo(() => {
    const map = {};
    allBrands.forEach((b) => {
      const id = b._id || b.id;
      if (id) map[id] = b.name;
    });
    return map;
  }, [allBrands]);

  // Products State
  const [products, setProducts] = useState(initialProducts);
  const [meta, setMeta] = useState(
    initialMeta || {
      page: pageParam,
      limit: PAGE_LIMIT,
      total: initialProducts.length,
      totalPages: Math.ceil(initialProducts.length / PAGE_LIMIT) || 1,
    }
  );
  const [isLoading, setIsLoading] = useState(!initialProducts.length);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  // Mobile Filter Drawer
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Cart & Wishlist Actions
  const { addItem: addCartItem } = useCart();
  const {
    items: wishlistItems,
    addItem: addWishlistItem,
    removeItem: removeWishlistItem,
  } = useWishlist();
  const [addingCartId, setAddingCartId] = useState(null);

  // Construct active wishlist set
  const wishlistSet = useMemo(() => {
    const set = new Set();
    if (Array.isArray(wishlistItems)) {
      wishlistItems.forEach((item) => {
        const pId = item?.productId?._id || item?.productId || item;
        if (pId) set.add(String(pId));
      });
    }
    return set;
  }, [wishlistItems]);

  // Query Param Updater
  const updateQueryParams = useCallback(
    (updates) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, val]) => {
        if (
          val === null ||
          val === undefined ||
          val === "" ||
          (Array.isArray(val) && val.length === 0)
        ) {
          params.delete(key);
        } else if (Array.isArray(val)) {
          params.set(key, val.join(","));
        } else {
          params.set(key, String(val));
        }
      });

      // Reset page to 1 when filters change unless page is explicitly updated
      if (!("page" in updates)) {
        params.delete("page");
      }

      setIsLoading(true);
      const queryString = params.toString();
      router.push(`${pathname}${queryString ? `?${queryString}` : ""}`, {
        scroll: false,
      });
    },
    [router, pathname, searchParams]
  );

  // Fetch Products based on current active category and URL search params
  useEffect(() => {
    let isCancelled = false;
    const catId = category?._id;
    if (!catId) return;

    const queryParams = {
      categoryId: catId,
      page: pageParam,
      limit: PAGE_LIMIT,
      sort: sortParam,
    };

    if (selectedBrandIds.length > 0) {
      queryParams.brandId = selectedBrandIds.join(",");
    }
    if (minPriceParam) {
      queryParams.minPrice = minPriceParam;
    }
    if (maxPriceParam) {
      queryParams.maxPrice = maxPriceParam;
    }
    if (ratingParam) {
      queryParams.rating = ratingParam;
    }
    if (stockParam) {
      queryParams.stockStatus = stockParam;
    }

    productService
      .getProducts(queryParams)
      .then((response) => {
        if (isCancelled) return;
        const items =
          response?.data?.products ||
          (Array.isArray(response?.data) ? response.data : []);
        const responseMeta = response?.meta || {
          page: pageParam,
          limit: PAGE_LIMIT,
          total: items.length,
          totalPages: Math.ceil(items.length / PAGE_LIMIT) || 1,
        };

        // Client-side discount filtering if specified
        let finalItems = items;
        if (discountParam) {
          finalItems = items.filter((p) => {
            const price = Number(p.price?.$numberDecimal || p.price || 0);
            const comparePrice = Number(
              p.compareAtPrice?.$numberDecimal || p.compareAtPrice || 0
            );
            if (comparePrice > price) {
              const disc = Math.round(
                ((comparePrice - price) / comparePrice) * 100
              );
              return disc >= discountParam;
            }
            return false;
          });
        }

        setProducts(finalItems);
        setMeta(responseMeta);
        setIsLoading(false);
        setIsError(false);
      })
      .catch((err) => {
        if (isCancelled) return;
        console.error("Failed to load category products:", err);
        setIsError(true);
        setErrorMessage(
          err?.message || "Failed to load products. Please try again."
        );
        setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [
    category,
    pageParam,
    sortParam,
    selectedBrandIds,
    minPriceParam,
    maxPriceParam,
    ratingParam,
    stockParam,
    discountParam,
    retryCount,
  ]);

  // Filter Handlers
  const handleCategoryChange = (selectedCat) => {
    if (!selectedCat) return;
    const catSlug = selectedCat.slug || selectedCat._id || selectedCat.id;
    if (catSlug) {
      router.push(`/category/${catSlug}`);
    }
  };

  const handleBrandToggle = (brandId) => {
    const nextBrands = selectedBrandIds.includes(brandId)
      ? selectedBrandIds.filter((id) => id !== brandId)
      : [...selectedBrandIds, brandId];
    updateQueryParams({ brand: nextBrands });
  };

  const handlePriceChange = (min, max) => {
    updateQueryParams({ minPrice: min, maxPrice: max });
  };

  const handleRatingChange = (stars) => {
    const nextRating = ratingParam === stars ? null : stars;
    updateQueryParams({ rating: nextRating });
  };

  const handleAvailabilityChange = (status) => {
    const nextStatus = stockParam === status ? null : status;
    updateQueryParams({ stockStatus: nextStatus });
  };

  const handleDiscountChange = (disc) => {
    const nextDiscount = discountParam === disc ? null : disc;
    updateQueryParams({ discount: nextDiscount });
  };

  const handleSortChange = (newSort) => {
    updateQueryParams({ sort: newSort });
  };

  const handlePageChange = (newPage) => {
    updateQueryParams({ page: newPage });
    window.scrollTo({ top: 280, behavior: "smooth" });
  };

  const handleClearAllFilters = () => {
    updateQueryParams({
      brand: null,
      minPrice: null,
      maxPrice: null,
      rating: null,
      stockStatus: null,
      discount: null,
      page: 1,
    });
  };

  const handleRemoveFilter = (filterKey, value) => {
    if (filterKey === "brand") {
      const nextBrands = selectedBrandIds.filter((id) => id !== value);
      updateQueryParams({ brand: nextBrands });
    } else if (filterKey === "minPrice" || filterKey === "maxPrice") {
      updateQueryParams({ minPrice: null, maxPrice: null });
    } else if (filterKey === "rating") {
      updateQueryParams({ rating: null });
    } else if (filterKey === "stockStatus") {
      updateQueryParams({ stockStatus: null });
    } else if (filterKey === "discount") {
      updateQueryParams({ discount: null });
    }
  };

  const handleRetry = () => {
    setIsLoading(true);
    setRetryCount((prev) => prev + 1);
  };

  // Cart Handler
  const handleAddToCart = async (product) => {
    const id = product._id || product.id;
    try {
      setAddingCartId(id);
      await addCartItem(id, 1);
      toast.success("Added to cart", {
        description: `${product.name} was added to your cart.`,
      });
    } catch (err) {
      toast.error(err?.message || "Could not add item to cart.");
    } finally {
      setAddingCartId(null);
    }
  };

  // Wishlist Handler
  const handleWishlistToggle = async (product, isWishlisted) => {
    const id = product._id || product.id;
    try {
      if (isWishlisted) {
        await addWishlistItem(id);
        toast.success("Added to wishlist", {
          description: `${product.name} was saved to your wishlist.`,
        });
      } else {
        await removeWishlistItem(id);
        toast.info("Removed from wishlist");
      }
    } catch {
      toast.error("Could not update wishlist.");
    }
  };

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = selectedBrandIds.length;
    if (minPriceParam || maxPriceParam) count += 1;
    if (ratingParam) count += 1;
    if (stockParam) count += 1;
    if (discountParam) count += 1;
    return count;
  }, [
    selectedBrandIds.length,
    minPriceParam,
    maxPriceParam,
    ratingParam,
    stockParam,
    discountParam,
  ]);

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* 1. Category Hero Banner */}
      <CategoryHeroBanner category={category} />

      {/* 2. Main Catalog Area */}
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex items-start gap-6 xl:gap-8">
          {/* Left Filter Sidebar (Desktop >= lg) */}
          <aside className="hidden lg:block w-64 xl:w-72 shrink-0">
            <CategoryFilterSidebar
              categories={allCategories}
              brands={allBrands}
              currentCategoryId={category?._id}
              selectedBrandIds={selectedBrandIds}
              minPrice={minPriceParam}
              maxPrice={maxPriceParam}
              selectedRating={ratingParam}
              selectedAvailability={stockParam}
              selectedDiscount={discountParam}
              onCategoryChange={handleCategoryChange}
              onBrandToggle={handleBrandToggle}
              onPriceChange={handlePriceChange}
              onRatingChange={handleRatingChange}
              onAvailabilityChange={handleAvailabilityChange}
              onDiscountChange={handleDiscountChange}
              onClearAll={handleClearAllFilters}
              activeFilterCount={activeFilterCount}
            />
          </aside>

          {/* Right Content: Toolbar + Product Grid + Pagination */}
          <main className="flex-1 min-w-0">
            {/* Toolbar */}
            <CategoryToolbar
              totalProducts={meta?.total || products.length}
              currentPage={pageParam}
              limit={PAGE_LIMIT}
              sort={sortParam}
              onSortChange={handleSortChange}
              activeFilters={{
                brands: selectedBrandIds,
                minPrice: minPriceParam,
                maxPrice: maxPriceParam,
                rating: ratingParam,
                stockStatus: stockParam,
                discount: discountParam,
              }}
              brandNamesMap={brandNamesMap}
              onRemoveFilter={handleRemoveFilter}
              onClearAllFilters={handleClearAllFilters}
              onOpenMobileFilters={() => setIsMobileDrawerOpen(true)}
            />

            {/* Product Grid */}
            <CategoryProductGrid
              products={products}
              isLoading={isLoading}
              isError={isError}
              errorMessage={errorMessage}
              onRetry={handleRetry}
              onClearFilters={handleClearAllFilters}
              wishlistIds={wishlistSet}
              onWishlistToggle={handleWishlistToggle}
              onAddToCart={handleAddToCart}
              addingCartId={addingCartId}
            />

            {/* Pagination */}
            {!isLoading && !isError && products.length > 0 && (
              <CategoryPagination
                currentPage={pageParam}
                totalPages={meta?.totalPages || 1}
                onPageChange={handlePageChange}
              />
            )}
          </main>
        </div>
      </div>

      {/* 3. Mobile Filter Drawer */}
      <MobileFilterDrawer
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
        totalResults={meta?.total || products.length}
        categories={allCategories}
        brands={allBrands}
        currentCategoryId={category?._id}
        selectedBrandIds={selectedBrandIds}
        minPrice={minPriceParam}
        maxPrice={maxPriceParam}
        selectedRating={ratingParam}
        selectedAvailability={stockParam}
        selectedDiscount={discountParam}
        onCategoryChange={(cat) => {
          handleCategoryChange(cat);
          setIsMobileDrawerOpen(false);
        }}
        onBrandToggle={handleBrandToggle}
        onPriceChange={handlePriceChange}
        onRatingChange={handleRatingChange}
        onAvailabilityChange={handleAvailabilityChange}
        onDiscountChange={handleDiscountChange}
        onClearAll={handleClearAllFilters}
        activeFilterCount={activeFilterCount}
      />
    </div>
  );
}

export default CategoryListingView;
