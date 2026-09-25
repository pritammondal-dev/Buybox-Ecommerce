"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Sparkles, Tag, Clock, Check, Copy, AlertCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { ProductCard } from "../../../../components/storefront/ProductCard.jsx";
import { useCart } from "../../../../hooks/useCart.js";
import { useWishlist } from "../../../../hooks/useWishlist.js";

function useCountdown(targetDate) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
  });

  useEffect(() => {
    if (!targetDate) return;

    function calculate() {
      const difference = new Date(targetDate).getTime() - new Date().getTime();
      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      setTimeLeft({ days, hours, minutes, seconds, isExpired: false });
    }

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return timeLeft;
}

export function CampaignDetailView({ campaign }) {
  const { addItem: addCartItem } = useCart();
  const { isInWishlist, addItem: addWishlistItem, removeItem: removeWishlistItem } = useWishlist();
  const [copiedCoupon, setCopiedCoupon] = useState(null);

  const countdown = useCountdown(campaign?.endsAt);
  const products = campaign?.productIds || [];
  const coupons = campaign?.couponIds || [];

  const handleCopyCoupon = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCoupon(code);
    toast.success(`Coupon code ${code} copied to clipboard!`);
    setTimeout(() => setCopiedCoupon(null), 2000);
  };

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
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-[#004D38] transition-colors">Home</Link>
        <span>/</span>
        <Link href="/deals" className="hover:text-[#004D38] transition-colors">Campaigns</Link>
        <span>/</span>
        <span className="font-bold text-slate-900 truncate">{campaign.name}</span>
      </nav>

      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#004D38] via-[#006346] to-slate-900 p-8 sm:p-12 text-white shadow-xl">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/20 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-amber-300 backdrop-blur-xs border border-amber-300/30">
            <Sparkles className="size-3.5" />
            <span>Featured Marketplace Event</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
            {campaign.name}
          </h1>

          {campaign.description && (
            <p className="text-sm sm:text-base text-emerald-100/90 leading-relaxed max-w-xl">
              {campaign.description}
            </p>
          )}

          {/* Countdown Clock */}
          {!countdown.isExpired ? (
            <div className="pt-2 flex items-center gap-3">
              <Clock className="size-4 text-amber-300 shrink-0" />
              <div className="flex items-center gap-2 text-xs font-mono font-bold">
                <span className="rounded-lg bg-black/40 px-2.5 py-1.5 border border-white/10">
                  {countdown.days}d
                </span>
                <span>:</span>
                <span className="rounded-lg bg-black/40 px-2.5 py-1.5 border border-white/10">
                  {String(countdown.hours).padStart(2, "0")}h
                </span>
                <span>:</span>
                <span className="rounded-lg bg-black/40 px-2.5 py-1.5 border border-white/10">
                  {String(countdown.minutes).padStart(2, "0")}m
                </span>
                <span>:</span>
                <span className="rounded-lg bg-black/40 px-2.5 py-1.5 border border-white/10">
                  {String(countdown.seconds).padStart(2, "0")}s
                </span>
                <span className="text-[11px] font-sans text-emerald-200 ml-1">remaining</span>
              </div>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-xl bg-rose-500/20 px-3 py-1.5 text-xs font-bold text-rose-200 border border-rose-400/30">
              <AlertCircle className="size-4" />
              <span>This promotional event has concluded</span>
            </div>
          )}
        </div>
      </div>

      {/* Applicable Coupons Section */}
      {coupons.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-[#FFF8D6]/60 p-6 space-y-3">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#004D38]">
            <Tag className="size-4" />
            <span>Event Exclusive Coupons</span>
          </div>
          <p className="text-xs text-slate-700">
            Apply these coupon codes at checkout to unlock guaranteed savings on qualifying products.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
            {coupons.map((coupon) => (
              <div
                key={coupon._id || coupon.code}
                className="flex items-center justify-between rounded-xl bg-white border border-dashed border-amber-300 p-3.5 shadow-xs"
              >
                <div>
                  <span className="font-mono font-black text-sm text-[#004D38]">
                    {coupon.code}
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {coupon.title || `Save ₹${coupon.discountAmount} on orders above ₹${coupon.minOrderAmount || 0}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyCoupon(coupon.code)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#004D38] hover:underline cursor-pointer ml-2 shrink-0"
                >
                  {copiedCoupon === coupon.code ? (
                    <>
                      <Check className="size-3.5 text-emerald-600" />
                      <span className="text-emerald-600">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Campaign Products Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-lg font-black text-slate-900 tracking-tight">
            Event Deals ({products.length})
          </h2>
          <span className="text-xs text-slate-500">Subject to inventory availability</span>
        </div>

        {products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center text-xs text-slate-500 space-y-3">
            <Tag className="size-8 mx-auto text-slate-300" />
            <p className="font-bold text-slate-700">No products assigned to this campaign yet.</p>
            <Link
              href="/shop"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#004D38] px-4 py-2 text-xs font-bold text-white hover:bg-[#003D2C] transition-colors shadow-xs"
            >
              Explore General Store
            </Link>
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

export default CampaignDetailView;
