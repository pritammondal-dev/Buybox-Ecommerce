"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Flame, ArrowRight, Clock } from "lucide-react";
import { ProductCard } from "../ProductCard.jsx";
import { parsePrice } from "../../../utils/formatCurrency.js";

export function FlashDealSection({
  initialProducts = [],
  dealExpiryDate = null,
  wishlistVariantIds = [],
  onWishlistToggle,
  onAddToCart,
}) {
  // Filter products that have a genuine backend discount (compareAtPrice > price)
  const dealProducts = (initialProducts || []).filter((p) => {
    const price = parsePrice(p.price);
    const compareAt = parsePrice(p.compareAtPrice);
    return compareAt > price;
  });

  // Countdown timer ONLY if a real backend expiry date is provided
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!dealExpiryDate) return;

    const targetTime = new Date(dealExpiryDate).getTime();
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
  }, [dealExpiryDate]);

  // Gracefully hide if no deal products exist in backend
  if (dealProducts.length === 0) {
    return null;
  }

  const formatUnit = (num) => String(num).padStart(2, "0");

  return (
    <section aria-label="Today's Hot Deals" className="py-6 sm:py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-rose-50/70 p-5 sm:p-7 md:p-8 lg:p-9 shadow-xs border border-rose-200/80 overflow-hidden">
          {/* Section Header with Deal Badge */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-rose-200/60">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 shadow-xs">
                <Flame className="size-5.5 fill-rose-500 text-rose-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                    Today&apos;s Hot Deals
                  </h2>
                  <span className="rounded bg-[#E02424] px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-white shadow-xs">
                    HOT
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                  Special savings on verified audio & electronics hardware
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              {/* Countdown Badge ONLY if backend provides an expiry date */}
              {timeLeft ? (
                <div className="flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 border border-rose-200 text-xs font-bold text-rose-700 shadow-xs">
                  <Clock className="size-3.5" />
                  <span>Ends in:</span>
                  <span className="font-mono">
                    {formatUnit(timeLeft.hours)} : {formatUnit(timeLeft.minutes)} : {formatUnit(timeLeft.seconds)}
                  </span>
                </div>
              ) : (
                <span className="text-xs font-semibold text-rose-700 bg-white px-3.5 py-1.5 rounded-full border border-rose-200 shadow-xs">
                  Limited Time Deals
                </span>
              )}

              <Link
                href="/shop?sort=discount"
                className="flex items-center gap-1.5 text-xs font-bold text-[#007A55] hover:text-[#006346] bg-white hover:bg-slate-50 px-3.5 py-1.5 rounded-full border border-slate-200/80 transition-all shadow-xs"
              >
                <span>View All Deals</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>

          {/* Product Grid: strictly live products, zero mock data */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 pt-6">
            {dealProducts.map((product) => {
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

export default FlashDealSection;
