"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Zap, Clock, Flame } from "lucide-react";
import { toast } from "sonner";
import { ProductCard } from "../../../components/storefront/ProductCard.jsx";
import { useCart } from "../../../hooks/useCart.js";
import { useWishlist } from "../../../hooks/useWishlist.js";

export function FlashSalePageView({ products = [] }) {
  const { addItem: addCartItem } = useCart();
  const { isInWishlist, addItem: addWishlistItem, removeItem: removeWishlistItem } = useWishlist();

  // 12-hour rolling flash sale timer
  const [timeLeft, setTimeLeft] = useState({ hours: 7, minutes: 42, seconds: 19 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: 59, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 12, minutes: 0, seconds: 0 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleWishlistToggle = async (product, isWishlisted) => {
    const id = product._id || product.id;
    try {
      if (isWishlisted) {
        await addWishlistItem(id);
        toast.success("Added to wishlist");
      } else {
        await removeWishlistItem(id);
        toast.info("Removed from wishlist");
      }
    } catch {
      toast.error("Could not update wishlist");
    }
  };

  const handleAddToCart = async (product) => {
    try {
      const productId = product._id || product.id;
      const productVariantId = product.productVariantId || product.defaultVariantId || undefined;
      await addCartItem({
        ...(productVariantId ? { productVariantId } : {}),
        productId,
        quantity: 1,
        itemSnapshot: {
          name: product.name,
          price: product.price,
          image: product.images?.[0]?.url || product.image || null,
          sku: product.sku,
        },
      });
      toast.success("Added to cart", { description: `${product.name} added to your cart.` });
    } catch {
      toast.error("Could not add item to cart");
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Flash Sale Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-amber-600 via-rose-600 to-[#004D38] p-8 sm:p-12 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-3 max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3.5 py-1 text-xs font-black uppercase tracking-wider backdrop-blur-xs border border-white/20">
            <Zap className="size-3.5 fill-amber-300 text-amber-300" />
            <span>High Demand Flash Sale</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
            Lightning Deals. Limited Units.
          </h1>
          <p className="text-xs sm:text-sm text-amber-100 leading-relaxed">
            Strict allocation per household. Prices automatically reset when countdown reaches zero or inventory depletes.
          </p>
        </div>

        {/* Live Countdown Box */}
        <div className="rounded-2xl bg-black/40 p-5 sm:p-6 backdrop-blur-md border border-white/10 text-center space-y-2 shrink-0">
          <span className="text-[11px] font-black uppercase tracking-widest text-amber-300 flex items-center justify-center gap-1.5">
            <Clock className="size-3.5" />
            <span>Sale Ends In</span>
          </span>
          <div className="flex items-center justify-center gap-2 font-mono text-2xl sm:text-3xl font-black text-white">
            <div className="rounded-xl bg-black/60 px-3 py-2 border border-white/10">
              {String(timeLeft.hours).padStart(2, "0")}
            </div>
            <span>:</span>
            <div className="rounded-xl bg-black/60 px-3 py-2 border border-white/10">
              {String(timeLeft.minutes).padStart(2, "0")}
            </div>
            <span>:</span>
            <div className="rounded-xl bg-black/60 px-3 py-2 border border-white/10">
              {String(timeLeft.seconds).padStart(2, "0")}
            </div>
          </div>
          <p className="text-[10px] text-slate-300 pt-1">Authoritative pricing verified at checkout</p>
        </div>
      </div>

      {/* Product Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Flame className="size-5 text-amber-500" />
            <span>Featured Flash Deals ({products.length})</span>
          </h2>
          <Link href="/shop" className="text-xs font-bold text-[#004D38] hover:underline">
            All Products
          </Link>
        </div>

        {products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center text-xs text-slate-500">
            No active flash sale products currently. Check back shortly!
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
            {products.map((product) => {
              const id = product._id || product.id;
              const isWishlisted = isInWishlist(id);
              return (
                <ProductCard
                  key={id}
                  product={product}
                  isWishlisted={isWishlisted}
                  onWishlistToggle={(val) => handleWishlistToggle(product, val)}
                  onAddToCart={() => handleAddToCart(product)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default FlashSalePageView;
