import React from "react";
import { Star } from "lucide-react";
import { cn } from "../../utils/cn.js";

export function ProductRating({
  rating = 0,
  reviewCount,
  showCount = true,
  size = "sm",
  className,
}) {
  const numericRating = Number(rating) || 0;
  const clampedRating = Math.max(0, Math.min(5, numericRating));

  const sizeClasses = {
    xs: "size-3",
    sm: "size-3.5",
    md: "size-4",
    lg: "size-5",
  };

  const starSize = sizeClasses[size] || sizeClasses.sm;

  return (
    <div
      className={cn("inline-flex items-center gap-1", className)}
      aria-label={`Rating: ${clampedRating} out of 5 stars`}
    >
      <div className="flex items-center text-amber-400">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = clampedRating >= star;
          const isHalf = !isFilled && clampedRating >= star - 0.5;

          return (
            <Star
              key={star}
              className={cn(
                starSize,
                isFilled
                  ? "fill-amber-400 text-amber-400"
                  : isHalf
                  ? "fill-amber-400/50 text-amber-400"
                  : "text-muted/60"
              )}
              aria-hidden="true"
            />
          );
        })}
      </div>

      {showCount && (
        <span className="text-xs text-muted-foreground ml-0.5">
          {numericRating > 0 ? numericRating.toFixed(1) : ""}
          {reviewCount !== undefined && ` (${reviewCount})`}
        </span>
      )}
    </div>
  );
}

export default ProductRating;
