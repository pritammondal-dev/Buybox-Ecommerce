import React from "react";
import { formatCurrency, calculateDiscountPercentage, parsePrice } from "../../utils/formatCurrency.js";
import { cn } from "../../utils/cn.js";

export function ProductPrice({
  price = 0,
  compareAtPrice,
  currency = "INR",
  size = "md",
  showDiscount = true,
  className,
}) {
  const discount = calculateDiscountPercentage(compareAtPrice, price);

  const sizeClasses = {
    sm: "text-sm",
    md: "text-base font-bold",
    lg: "text-xl font-extrabold",
    xl: "text-2xl font-extrabold",
  };

  return (
    <div className={cn("flex flex-wrap items-baseline gap-1.5", className)}>
      <span className={cn("text-foreground tracking-tight", sizeClasses[size])}>
        {formatCurrency(price, currency)}
      </span>

      {compareAtPrice && parsePrice(compareAtPrice) > parsePrice(price) && (
        <>
          <span className="text-xs text-muted-foreground line-through">
            {formatCurrency(compareAtPrice, currency)}
          </span>
          {showDiscount && discount > 0 && (
            <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              {discount}% OFF
            </span>
          )}
        </>
      )}
    </div>
  );
}

export default ProductPrice;
