"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, Flame, Tag, Clock, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { ProductCard } from "../../../components/storefront/ProductCard.jsx";
import { useCart } from "../../../hooks/useCart.js";
import { useWishlist } from "../../../hooks/useWishlist.js";

export function DealsPageView({ campaigns = [], dealProducts = [] }) {
  const { addItem: addCartItem } = useCart();
  const { isInWishlist, addItem: addWishlistItem, removeItem: removeWishlistItem } = useWishlist();

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
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-br from-[#004D38] via-[#006346] to-slate-900 p-8 sm:p-12 text-white shadow-lg space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/20 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-amber-300 border border-amber-300/30">
          <Flame className="size-3.5" />
          <span>Verified Marketplace Deals</span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
          Today&apos;s Featured Deals &amp; Discounts
        </h1>
        <p className="text-sm sm:text-base text-emerald-100 max-w-2xl leading-relaxed">
          Unlock genuine value across high-performance studio monitors, wireless headsets, and premium tech accessories.
        </p>
      </div>

      {/* Active Campaigns Showcase */}
      {campaigns.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="size-5 text-amber-500" />
              <span>Active Seasonal Campaigns</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {campaigns.map((camp) => (
              <div
                key={camp._id || camp.slug}
                className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs hover:border-[#004D38] transition-colors"
              >
                <div className="space-y-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-[#004D38]">
                    <Clock className="size-3" />
                    <span>Live Event</span>
                  </span>
                  <h3 className="text-base font-black text-slate-900 line-clamp-1">{camp.name}</h3>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {camp.description || "Limited-time savings on selected brand items."}
                  </p>
                </div>

                <div className="pt-5 mt-4 border-t flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">
                    {camp.productIds?.length || 0} Products
                  </span>
                  <Link
                    href={`/campaign/${camp.slug}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#004D38] hover:underline"
                  >
                    <span>View Campaign</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Discounted Products Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Flame className="size-5 text-rose-500" />
            <span>Top Discounted Products ({dealProducts.length})</span>
          </h2>
          <Link href="/shop" className="text-xs font-bold text-[#004D38] hover:underline">
            View All Catalog
          </Link>
        </div>

        {dealProducts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center text-xs text-slate-500">
            No discounted items at this moment. Check back soon for flash promotions!
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
            {dealProducts.map((product) => {
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

export default DealsPageView;
