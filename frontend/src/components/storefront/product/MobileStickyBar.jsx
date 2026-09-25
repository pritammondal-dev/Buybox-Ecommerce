"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "../../../hooks/useCart.js";
import { formatCurrency, parsePrice } from "../../../utils/formatCurrency.js";
import { Button } from "../../ui/Button.jsx";

export function MobileStickyBar({ product }) {
  const router = useRouter();
  const { addItem: addCartItem } = useCart();
  const [isAdding, setIsAdding] = useState(false);

  if (!product) return null;

  const productId = product._id || product.id;
  const productVariantId =
    product?.productVariantId ||
    product?.defaultVariantId ||
    undefined;
  const isOutOfStock = product.stockStatus === "out_of_stock";
  const price = parsePrice(product.price || 0);

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
        quantity: 1,
        itemSnapshot: {
          name: product.name,
          price,
          image: primaryImage,
          sku: product.sku,
        },
      });
      toast.success("Added to shopping cart", {
        description: `1 × ${product.name}`,
      });
    } catch (err) {
      toast.error(err?.message || "Could not add to cart.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleBuyNow = async () => {
    if (isOutOfStock) return;
    try {
      await addCartItem({
        ...(productVariantId ? { productVariantId } : {}),
        productId,
        quantity: 1,
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
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md px-4 py-2.5 shadow-xl md:hidden">
      <div className="flex items-center justify-between gap-3">
        {/* Product Thumbnail + Name + Price */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {primaryImage && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={primaryImage}
              alt=""
              className="size-10 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-50"
            />
          )}
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-slate-700 line-clamp-1 font-medium">
              {product.name}
            </span>
            <span className="text-sm font-black text-[#004D38]">
              {formatCurrency(price)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            disabled={isOutOfStock || isAdding}
            onClick={handleAddToCart}
            size="sm"
            className="rounded-full bg-[#004D38] hover:bg-[#003D2C] text-white font-bold text-xs px-3.5 py-2 shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isAdding ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ShoppingBag className="size-3.5" />
            )}
            <span className="ml-1">{isOutOfStock ? "Unavailable" : "Add to Cart"}</span>
          </Button>

          <Button
            type="button"
            disabled={isOutOfStock}
            onClick={handleBuyNow}
            size="sm"
            className="rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-3.5 py-2 shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Zap className="size-3.5 text-amber-400 fill-amber-400" />
            <span className="ml-1">Buy</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default MobileStickyBar;
