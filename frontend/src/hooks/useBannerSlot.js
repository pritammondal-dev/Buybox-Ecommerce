"use client";

import { useState, useMemo, useCallback } from "react";
import { BANNER_SLOT_MAP } from "../constants/banner-slots.constants.js";

/**
 * Resolve a banner slot from the authoritative active-banner API response.
 * There is intentionally NO promotional/static fallback here: when Superadmin
 * deactivates a banner, the slot becomes empty instead of showing stale artwork.
 */
export function resolveBannerSlot(banners = [], slotKey) {
  if (!Array.isArray(banners) || banners.length === 0) {
    return {
      imageUrl: null,
      mobileImageUrl: null,
      linkUrl: null,
      altText: "",
      isCustom: false,
      fallbackImage: null,
      slotKey,
      bannerId: null,
    };
  }

  const customBanner = banners.find(
    (b) =>
      b &&
      (b.slotKey === slotKey || b.placement === slotKey) &&
      b.isActive === true &&
      b.imageUrl &&
      typeof b.imageUrl === "string" &&
      b.imageUrl.trim().length > 0
  );

  if (!customBanner) {
    return {
      imageUrl: null,
      mobileImageUrl: null,
      linkUrl: null,
      altText: "",
      isCustom: false,
      fallbackImage: null,
      slotKey,
      bannerId: null,
    };
  }

  return {
    imageUrl: customBanner.imageUrl,
    mobileImageUrl: customBanner.mobileImageUrl || customBanner.imageUrl,
    linkUrl: customBanner.linkUrl || "/shop",
    altText: customBanner.altText || customBanner.title || "Buybox Promotional Banner",
    isCustom: true,
    fallbackImage: null,
    slotKey,
    bannerId: customBanner._id || customBanner.id || null,
  };
}

/**
 * React hook to resolve banner artwork with automatic error fallback
 *
 * @param {Array} banners - List of banners from API
 * @param {string} slotKey - Target slot identifier
 */
export function useBannerSlot(banners, slotKey) {
  const resolved = useMemo(
    () => resolveBannerSlot(banners, slotKey),
    [banners, slotKey]
  );

  const [failedUrl, setFailedUrl] = useState(null);

  const isFailed = failedUrl === resolved.imageUrl;
  const src = isFailed ? null : resolved.imageUrl;

  const handleImageError = useCallback(() => {
    setFailedUrl(resolved.imageUrl);
  }, [resolved.imageUrl]);

  return {
    ...resolved,
    src,
    handleImageError,
  };
}

export default useBannerSlot;
