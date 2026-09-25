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
  isWishlisted = false,
  onWishlistToggle,
}) {
  const router = useRouter();
  const { addItem: addCartItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [isBuyingNow, setIsBuyingNow] = useState(false);

  const productId = product?._id || product?.id;
  const productVariantId =
    product?.productVariantId ||
    product?.defaultVariantId ||
    undefined;
  const isOutOfStock = product?.stockStatus === "out_of_stock";
  const stockQuantity = typeof product?.stockQuantity === "number" ? product.stockQuantity : 99;
  const maxAllowedQty = Math.max(1, Math.min(10, stockQuantity > 0 ? stockQuantity : 10));
  const price = parsePrice(product?.price || 0);

  const primaryImage =
    product?.images?.[0]?.url ||
    product?.image ||
    null;

  const handleAddToCart = async () => {
    if (isOutOfStock || isAdding) return;
    setIsAdding(true);

    try {
      await addCartItem({
        ...(productVariantId ? { productVariantId } : {}),
        productId,
        quantity,
        itemSnapshot: {
          name: product.name,
          price,
          image: primaryImage,
          sku: product.sku,
        },
      });

      toast.success("Added to shopping cart", {
        description: `${quantity} × ${product.name}`,
      });
    } catch (err) {
      toast.error(err?.message || "Could not add item to cart. Please try again.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleBuyNow = async () => {
    if (isOutOfStock || isBuyingNow) return;
    setIsBuyingNow(true);

    try {
      await addCartItem({
        ...(productVariantId ? { productVariantId } : {}),
        productId,
        quantity,
        itemSnapshot: {
          name: product.name,
          price,
          image: primaryImage,
          sku: product.sku,
        },
      });

      router.push("/checkout");
    } catch (err) {
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
          disabled={isOutOfStock}
          size="lg"
          className="rounded-full px-2 shadow-2xs"
        />

        {/* Add to Cart Pill Button */}
        <Button
          type="button"
          disabled={isOutOfStock || isAdding}
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
              <span>{isOutOfStock ? "Currently Unavailable" : "Add to Cart"}</span>
            </>
          )}
        </Button>

        {/* Buy Now Pill Button */}
        <Button
          type="button"
          disabled={isOutOfStock || isBuyingNow}
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

      {isOutOfStock && (
        <p className="text-xs text-red-600 font-medium pt-1">
          This item is currently out of stock. You can still save it to your wishlist to receive updates when inventory is replenished.
        </p>
      )}
    </div>
  );
}

export default ProductActions;
