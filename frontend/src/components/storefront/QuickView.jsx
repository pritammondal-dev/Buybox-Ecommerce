"use client";

import React from "react";
import Link from "next/link";
import { Dialog, DialogContent } from "../ui/Dialog.jsx";
import { ProductPrice } from "./ProductPrice.jsx";
import { ProductRating } from "./ProductRating.jsx";
import { ProductBadge } from "./ProductBadge.jsx";
import { AddToCartButton } from "./AddToCartButton.jsx";
import { WishlistButton } from "./WishlistButton.jsx";
import { cn } from "../../utils/cn.js";

export function QuickView({
  product,
  isOpen,
  onClose,
  onAddToCart,
  isAddingToCart = false,
  isWishlisted = false,
  onWishlistToggle,
}) {
  if (!product) return null;

  const image =
    product.images?.find((img) => img.isPrimary)?.url ||
    product.images?.[0]?.url ||
    product.image ||
    null;

  const isOutOfStock =
    product.stockStatus === "out_of_stock" ||
    product.status === "out_of_stock" ||
    (typeof product.stockQuantity === "number" && product.stockQuantity <= 0) ||
    (typeof product.stock === "number" && product.stock <= 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent onClose={onClose} className="max-w-2xl p-0 overflow-hidden sm:rounded-xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          {/* Image */}
          <div className="relative aspect-square rounded-lg bg-muted/40 overflow-hidden flex items-center justify-center border">
            {image ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={image}
                alt={product.name || "Product image"}
                className="size-full object-cover transition-transform hover:scale-105 duration-300"
              />
            ) : (
              <span className="text-sm text-muted-foreground font-medium">No Image</span>
            )}
            {isOutOfStock && (
              <div className="absolute top-3 left-3">
                <ProductBadge type="outOfStock" />
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex flex-col justify-between">
            <div>
              {product.brand?.name && (
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  {product.brand.name}
                </p>
              )}
              <h2 className="text-xl font-bold tracking-tight text-foreground line-clamp-2">
                {product.name}
              </h2>

              <div className="mt-2 flex items-center gap-2">
                <ProductRating
                  rating={
                    typeof product.ratingAverage === "number"
                      ? product.ratingAverage
                      : typeof product.rating === "number"
                      ? product.rating
                      : typeof product.averageRating === "number"
                      ? product.averageRating
                      : 0
                  }
                  reviewCount={
                    typeof product.ratingCount === "number"
                      ? product.ratingCount
                      : typeof product.reviewCount === "number"
                      ? product.reviewCount
                      : (product.reviews?.length ?? 0)
                  }
                />
              </div>

              <div className="mt-3">
                <ProductPrice
                  price={product.basePrice || product.price || 0}
                  compareAtPrice={product.compareAtPrice}
                  size="lg"
                />
              </div>

              {product.description && (
                <p className="mt-3 text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                  {product.description}
                </p>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-3 pt-4 border-t">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <AddToCartButton
                    onClick={() => onAddToCart?.(product)}
                    isLoading={isAddingToCart}
                    isOutOfStock={isOutOfStock}
                  />
                </div>
                <WishlistButton
                  isWishlisted={isWishlisted}
                  onToggle={onWishlistToggle}
                />
              </div>

              <Link
                href={`/product/${product.slug || product._id || product.id}`}
                onClick={onClose}
                className="text-center text-xs font-semibold text-primary hover:underline"
              >
                View Full Product Details &rarr;
              </Link>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default QuickView;
