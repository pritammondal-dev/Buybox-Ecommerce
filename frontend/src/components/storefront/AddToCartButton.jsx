"use client";

import React from "react";
import { ShoppingBag } from "lucide-react";
import { Button } from "../ui/Button.jsx";
import { cn } from "../../utils/cn.js";

export function AddToCartButton({
  onClick,
  isLoading = false,
  isOutOfStock = false,
  isSuccess = false,
  size = "default",
  variant = "default",
  className,
  children,
}) {
  if (isOutOfStock) {
    return (
      <Button
        variant="secondary"
        size={size}
        disabled
        className={cn("w-full opacity-60 cursor-not-allowed", className)}
      >
        Out of Stock
      </Button>
    );
  }

  return (
    <Button
      variant={isSuccess ? "success" : variant}
      size={size}
      isLoading={isLoading}
      onClick={onClick}
      className={cn("w-full gap-2 transition-all active:scale-[0.98]", className)}
    >
      <ShoppingBag className="size-4" aria-hidden="true" />
      <span>{children || (isSuccess ? "Added to Cart!" : "Add to Cart")}</span>
    </Button>
  );
}

export default AddToCartButton;
