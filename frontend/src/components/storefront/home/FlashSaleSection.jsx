"use client";

import React, { useState, useEffect } from "react";
import { Zap, Clock } from "lucide-react";
import { SectionContainer } from "./SectionContainer.jsx";
import { ProductCarousel } from "../ProductCarousel.jsx";

/**
 * FlashSaleSection
 * Renders a Flash Sale campaign ONLY when backed by a genuine backend campaign.
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
    if (!campaign?.endDate && !campaign?.endsAt) return;

    const endDateStr = campaign.endDate || campaign.endsAt;
    const targetTime = new Date(endDateStr).getTime();
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
  }, [campaign?.endDate, campaign?.endsAt]);

  const products = Array.isArray(campaign?.products) ? campaign.products : [];

  // Gracefully return null if no authentic campaign products exist
  if (!campaign || products.length === 0) {
    return null;
  }

  const formatUnit = (num) => String(num).padStart(2, "0");

  const countdownElement = timeLeft ? (
    <div className="flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 border border-amber-200 text-xs font-bold text-amber-800 shadow-2xs">
      <Clock className="size-3.5 text-amber-600" />
      <span>Ends in:</span>
      <span className="font-mono">
        {formatUnit(timeLeft.hours)} : {formatUnit(timeLeft.minutes)} :{" "}
        {formatUnit(timeLeft.seconds)}
      </span>
    </div>
  ) : null;

  return (
    <SectionContainer
      title={campaign.title || "Flash Sale Event"}
      subtitle={campaign.description || "Limited-time event with strictly verified deals"}
      badge="FLASH EVENT"
      badgeColor="bg-amber-600 text-white"
      icon={Zap}
      iconBg="bg-amber-100 text-amber-600"
      viewAllHref={campaign.slug ? `/campaign/${campaign.slug}` : "/shop"}
      viewAllText="View Event"
      variant="flash"
      headerRight={countdownElement}
      ariaLabel="Flash Sale Event"
    >
      <ProductCarousel
        products={products}
        wishlistVariantIds={wishlistVariantIds}
        onWishlistToggle={onWishlistToggle}
        onAddToCart={onAddToCart}
      />
    </SectionContainer>
  );
}

export default FlashSaleSection;
