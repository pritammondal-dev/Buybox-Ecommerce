"use client";

import React, { useState, useEffect } from "react";
import { Flame, Clock } from "lucide-react";
import { SectionContainer } from "./SectionContainer.jsx";
import { ProductCarousel } from "../ProductCarousel.jsx";
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
    const price = parsePrice(p.price || p.basePrice || 0);
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

  const countdownElement = timeLeft ? (
    <div className="flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 border border-rose-200 text-xs font-bold text-rose-700 shadow-2xs">
      <Clock className="size-3.5 text-rose-600" />
      <span>Ends in:</span>
      <span className="font-mono">
        {formatUnit(timeLeft.hours)} : {formatUnit(timeLeft.minutes)} :{" "}
        {formatUnit(timeLeft.seconds)}
      </span>
    </div>
  ) : null;

  return (
    <SectionContainer
      title="Today's Hot Deals"
      subtitle="Verified savings on authentic audio, displays & peripherals"
      badge="LIMITED TIME"
      badgeColor="bg-[#E02424] text-white"
      icon={Flame}
      iconBg="bg-rose-100 text-rose-600"
      viewAllHref="/shop?sort=discount"
      viewAllText="View All Deals"
      variant="deals"
      headerRight={countdownElement}
      ariaLabel="Today's Hot Deals"
    >
      <ProductCarousel
        products={dealProducts}
        wishlistVariantIds={wishlistVariantIds}
        onWishlistToggle={onWishlistToggle}
        onAddToCart={onAddToCart}
      />
    </SectionContainer>
  );
}

export default FlashDealSection;
