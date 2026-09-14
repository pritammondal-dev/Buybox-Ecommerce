import React from "react";
import { ProductCard } from "./ProductCard.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { cn } from "../../utils/cn.js";

export function ProductGrid({
  products = [],
  isLoading = false,
  skeletonCount = 8,
  wishlistVariantIds = [],
  compareVariantIds = [],
  onWishlistToggle,
  onCompareToggle,
  onAddToCart,
  emptyTitle = "No products found",
  emptyDescription = "Try adjusting your search query or filters to find what you're looking for.",
  className,
}) {
  if (isLoading) {
    return (
      <div
        className={cn(
          "grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 sm:gap-4 md:gap-5",
          className
        )}
      >
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <ProductCard key={`skeleton-${index}`} isLoading />
        ))}
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        className="my-8"
      />
    );
  }

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 sm:gap-4 md:gap-5",
        className
      )}
    >
      {products.map((product) => {
        const id = product.id || product._id;
        const isWishlisted = wishlistVariantIds.includes(id);
        const isCompared = compareVariantIds.includes(id);

        return (
          <ProductCard
            key={id}
            product={product}
            isWishlisted={isWishlisted}
            isCompared={isCompared}
            onWishlistToggle={(val) => onWishlistToggle?.(product, val)}
            onCompareToggle={(val) => onCompareToggle?.(product, val)}
            onAddToCart={() => onAddToCart?.(product)}
          />
        );
      })}
    </div>
  );
}

export default ProductGrid;
