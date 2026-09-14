"use client";

import React from "react";
import { Heart } from "lucide-react";
import { cn } from "../../utils/cn.js";

export function WishlistButton({
  isWishlisted = false,
  onToggle,
  size = "md",
  className,
  ariaLabel = "Add to wishlist",
}) {
  const sizeClasses = {
    sm: "size-7 [&_svg]:size-3.5",
    md: "size-9 [&_svg]:size-4",
    lg: "size-11 [&_svg]:size-5",
  };

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle?.(!isWishlisted);
      }}
      aria-label={isWishlisted ? "Remove from wishlist" : ariaLabel}
      aria-pressed={isWishlisted}
      className={cn(
        "inline-flex items-center justify-center rounded-full border border-input/60 bg-background/90 backdrop-blur-xs text-foreground shadow-xs transition-all hover:scale-105 hover:bg-background active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isWishlisted && "border-rose-200 bg-rose-50/80 text-rose-500 hover:bg-rose-100/90",
        sizeClasses[size] || sizeClasses.md,
        className
      )}
    >
      <Heart
        className={cn(
          "transition-transform",
          isWishlisted && "fill-rose-500 text-rose-500 scale-110"
        )}
        aria-hidden="true"
      />
      <span className="sr-only">
        {isWishlisted ? "Remove from wishlist" : ariaLabel}
      </span>
    </button>
  );
}

export default WishlistButton;
