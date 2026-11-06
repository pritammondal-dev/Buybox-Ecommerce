"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, Zap, Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "../../../hooks/useCart.js";
import { QuantitySelector } from "../QuantitySelector.jsx";
import { Button } from "../../ui/Button.jsx";
import { parsePrice } from "../../../utils/formatCurrency.js";
import { cn } from "../../../utils/cn.js";

export function ProductActions({
  product,
  selectedVariant = null,
  isSelectionComplete = false,
  isWishlisted = false,
  onWishlistToggle,
  onStockRefresh,
}) {
  const router = useRouter();
  const { addItem: addCartItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [isBuyingNow, setIsBuyingNow] = useState(false);

  const isVariable = product?.productType === "variable";
  const productId = product?._id || product?.id;

  // Resolve target purchasable variant
  const targetVariant = isVariable
    ? selectedVariant
    : (selectedVariant || product?.defaultVariant || product?.variants?.find((v) => v.isDefault) || product?.variants?.[0] || null);

  const productVariantId = targetVariant?._id || (!isVariable ? product?.defaultVariantId : undefined);

  // Authoritative stock resolution from warehouse inventory data
  const availableStock = targetVariant
    ? (typeof targetVariant.availableQuantity === "number" ? targetVariant.availableQuantity : 0)
    : (typeof product?.availableQuantity === "number" ? product.availableQuantity : 0);

  const isOutOfStock = targetVariant
    ? (availableStock <= 0 || targetVariant.stockStatus === "out_of_stock" || targetVariant.inStock === false)
    : (isVariable ? false : (availableStock <= 0 || product?.stockStatus === "out_of_stock"));

  const needsSelection = isVariable && (!isSelectionComplete || !selectedVariant);
  const isActionDisabled = needsSelection || isOutOfStock || isAdding || isBuyingNow;

  const maxAllowedQty = Math.max(1, Math.min(10, availableStock > 0 ? availableStock : 1));
  const authoritativePrice = targetVariant
    ? parsePrice(targetVariant.price)
    : parsePrice(product?.price || 0);

  const primaryImage =
    targetVariant?.image?.url ||
    product?.images?.[0]?.url ||
    product?.image ||
    null;

  const handleAddToCart = async () => {
    if (isActionDisabled) return;
    setIsAdding(true);

    try {
      await addCartItem({
        ...(productVariantId ? { productVariantId } : {}),
        productId,
        quantity,
        itemSnapshot: {
          name: targetVariant?.name || product?.name,
          price: authoritativePrice,
          image: primaryImage,
        },
      });

      toast.success("Added to shopping cart", {
        description: `${quantity} × ${targetVariant?.name || product?.name}`,
      });
    } catch (err) {
      // Re-query live inventory on rejection
      if (onStockRefresh && productVariantId) {
        onStockRefresh(productVariantId);
      }
      toast.error(err?.message || "Could not add item to cart. Please review availability.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleBuyNow = async () => {
    if (isActionDisabled) return;
    setIsBuyingNow(true);

    try {
      await addCartItem({
        ...(productVariantId ? { productVariantId } : {}),
        productId,
        quantity,
        itemSnapshot: {
          name: targetVariant?.name || product?.name,
          price: authoritativePrice,
          image: primaryImage,
        },
      });

      router.push("/checkout");
    } catch (err) {
      if (onStockRefresh && productVariantId) {
        onStockRefresh(productVariantId);
      }
      toast.error(err?.message || "Could not proceed to checkout.");
      setIsBuyingNow(false);
    }
  };

  return (
    <div className="space-y-4 pt-4 border-t border-slate-100">
      {/* Quantity & Primary Action Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <QuantitySelector
          value={quantity}
          onChange={setQuantity}
          min={1}
          max={maxAllowedQty}
          disabled={needsSelection || isOutOfStock}
          size="lg"
          className="rounded-full px-2 shadow-2xs"
        />

        {/* Add to Cart Pill Button */}
        <Button
          type="button"
          disabled={isActionDisabled}
          onClick={handleAddToCart}
          className="flex-1 rounded-full bg-[#004D38] hover:bg-[#003D2C] text-white font-bold text-sm py-3.5 px-6 shadow-md active:scale-95 transition-all gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isAdding ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>Adding to Cart...</span>
            </>
          ) : (
            <>
              <ShoppingBag className="size-4" />
              <span>
                {needsSelection
                  ? "Select Options"
                  : isOutOfStock
                  ? "Currently Unavailable"
                  : "Add to Cart"}
              </span>
            </>
          )}
        </Button>

        {/* Buy Now Pill Button */}
        <Button
          type="button"
          disabled={isActionDisabled}
          onClick={handleBuyNow}
          className="rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm py-3.5 px-6 shadow-md active:scale-95 transition-all gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isBuyingNow ? (
            <>
              <Loader2 className="size-4 animate-spin text-amber-400" />
              <span>Proceeding...</span>
            </>
          ) : (
            <>
              <Zap className="size-4 text-amber-400 fill-amber-400" />
              <span>Buy Now</span>
            </>
          )}
        </Button>

        {/* Wishlist Button */}
        <button
          type="button"
          onClick={onWishlistToggle}
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white shadow-xs transition-all active:scale-95 hover:border-[#004D38] cursor-pointer",
            isWishlisted && "border-red-200 bg-red-50 text-red-500"
          )}
        >
          <Heart className={cn("size-4", isWishlisted ? "fill-current text-red-500" : "text-slate-500")} />
        </button>
      </div>

      {needsSelection && (
        <p className="text-xs text-amber-700 font-medium pt-1">
          Please select your preferred options above to enable purchase.
        </p>
      )}

      {!needsSelection && isOutOfStock && (
        <p className="text-xs text-red-600 font-medium pt-1">
          This item is currently out of stock. You can still save it to your wishlist to receive updates when inventory is replenished.
        </p>
      )}
    </div>
  );
}

export default ProductActions;
