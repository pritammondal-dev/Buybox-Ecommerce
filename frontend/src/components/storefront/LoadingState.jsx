import React from "react";
import { ProductCard } from "./ProductCard.jsx";
import { cn } from "../../utils/cn.js";

export function LoadingState({
  count = 8,
  className,
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 sm:gap-4 md:gap-5",
        className
      )}
    >
      {Array.from({ length: count }).map((_, index) => (
        <ProductCard key={`loading-skeleton-${index}`} isLoading />
      ))}
    </div>
  );
}

export default LoadingState;
