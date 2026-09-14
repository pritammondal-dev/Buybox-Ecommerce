"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Zap, ArrowRight, Clock } from "lucide-react";
import { ProductCard } from "../ProductCard.jsx";

/**
 * FlashSaleSection
 * Renders a Flash Sale campaign ONLY when backed by a genuine backend campaign.
 * In accordance with Buybox strict backend accuracy rules:
 * Returns null if no active campaign or products exist.
 * Does NOT invent mock items or simulated countdown timers.
 */
export function FlashSaleSection({
  campaign = null,
  wishlistVariantIds = [],
  onWishlistToggle,
  onAddToCart,
}) {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!campaign?.endDate) return;

    const targetTime = new Date(campaign.endDate).getTime();
    if (isNaN(targetTime) || targetTime <= Date.now()) return;

    const updateTimer = () => {
      const now = Date.now();
      const diff = targetTime - now;

      if (diff <= 0) {
        setTimeLeft(null);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ hours, minutes, seconds });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [campaign?.endDate]);

  const products = Array.isArray(campaign?.products) ? campaign.products : [];

  // Gracefully return null if no authentic campaign products exist
  if (!campaign || products.length === 0) {
    return null;
  }

  const formatUnit = (num) => String(num).padStart(2, "0");

  return (
    <section aria-label="Flash Sale" className="py-6 sm:py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-red-50/70 p-5 sm:p-7 md:p-8 lg:p-9 shadow-xs border border-red-200/80 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-red-200/60">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-red-100 text-red-600 shadow-xs">
                <Zap className="size-5.5 fill-red-500 text-red-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                    {campaign.title || "Flash Sale"}
                  </h2>
                  <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-xs">
                    LIMITED
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                  {campaign.description || "Limited-time flash event with strictly verified deals"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              {timeLeft && (
                <div className="flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 border border-red-200 text-xs font-bold text-red-700 shadow-xs">
                  <Clock className="size-3.5" />
                  <span>Ends in:</span>
                  <span className="font-mono">
                    {formatUnit(timeLeft.hours)} : {formatUnit(timeLeft.minutes)} : {formatUnit(timeLeft.seconds)}
                  </span>
                </div>
              )}

              <Link
                href="/shop?campaign=flash_sale"
                className="flex items-center gap-1.5 text-xs font-bold text-[#007A55] hover:text-[#006346] bg-white hover:bg-slate-50 px-3.5 py-1.5 rounded-full border border-slate-200/80 transition-all shadow-xs"
              >
                <span>View All</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 pt-6">
            {products.map((product) => {
              const id = product.id || product._id;
              const isWishlisted = Array.isArray(wishlistVariantIds) && wishlistVariantIds.includes(id);

              return (
                <ProductCard
                  key={id}
                  product={product}
                  isWishlisted={isWishlisted}
                  onWishlistToggle={(val) => onWishlistToggle?.(product, val)}
                  onAddToCart={() => onAddToCart?.(product)}
                />
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export default FlashSaleSection;
